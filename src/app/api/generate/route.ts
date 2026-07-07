import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, specToPosterState, parseSpecText, POSTER_SPEC_SCHEMA, type PosterSpec } from '@/lib/poster-spec';

// POST /api/generate — prompt → LLM → PosterSpec → PosterState.
// Requires a Clerk session (same policy as the templates API).
//
// Provider is env-configured. The Anthropic SDK honors ANTHROPIC_BASE_URL, so
// any Anthropic-compatible endpoint works — e.g. Zhipu GLM:
//   ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
//   ANTHROPIC_API_KEY=<GLM key>
//   POSTER_MODEL=glm-5.2
// Claude models get schema-enforced structured outputs + adaptive thinking;
// other models get prompt-enforced JSON with lenient extraction (fences /
// leading prose stripped), and specToPosterState() validates the rest.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MODEL = process.env.POSTER_MODEL || 'claude-opus-4-8';
const IS_CLAUDE = MODEL.startsWith('claude');

// Built once per server instance; deterministic so the prompt prefix stays
// cacheable across requests. Non-Claude models don't support output_config,
// so their variant embeds the compact output-format contract in the prompt.
const SYSTEM_PROMPT = buildSystemPrompt();
const SYSTEM_PROMPT_JSON = buildSystemPrompt({ promptJson: true });

interface GenerateBody {
  prompt?: string;
  ratio?: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('unauthorized', { status: 401 });

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return new NextResponse('prompt required', { status: 400 });
  if (prompt.length > 4000) return new NextResponse('prompt too long', { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server. Set it in .env.local — an Anthropic key, or a GLM key with ANTHROPIC_BASE_URL + POSTER_MODEL (see README).' },
      { status: 500 },
    );
  }

  const client = new Anthropic();
  const userContent = body.ratio
    ? `Design a poster for this brief (preferred canvas ratio: ${body.ratio}):\n\n${prompt}`
    : `Design a poster for this brief:\n\n${prompt}`;

  // Prompt-JSON providers occasionally emit corrupt JSON; regeneration is the
  // reliable fix, so give them multiple attempts. Structured outputs (Claude)
  // are schema-enforced and get one.
  const maxAttempts = IS_CLAUDE ? 1 : 3;

  try {
    let lastParseError: SyntaxError | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await client.messages.create(
        IS_CLAUDE
          ? {
              model: MODEL,
              max_tokens: 16000,
              thinking: { type: 'adaptive' },
              system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
              output_config: { format: { type: 'json_schema', schema: POSTER_SPEC_SCHEMA } },
              messages: [{ role: 'user', content: userContent }],
            }
          : {
              // Anthropic-compatible endpoint (e.g. GLM): plain string system,
              // no structured outputs / thinking config — format rides in the prompt.
              model: MODEL,
              max_tokens: 16000,
              system: SYSTEM_PROMPT_JSON,
              messages: [{ role: 'user', content: userContent }],
            },
      );

      if (response.stop_reason === 'refusal') {
        return NextResponse.json({ error: 'The model declined this brief. Try rephrasing it.' }, { status: 422 });
      }

      const text = response.content.find((b) => b.type === 'text')?.text;
      if (!text) {
        return NextResponse.json({ error: 'Model returned no design.' }, { status: 502 });
      }

      let spec: PosterSpec;
      try {
        spec = parseSpecText(text);
      } catch (e) {
        lastParseError = e as SyntaxError;
        continue; // regenerate
      }
      return NextResponse.json({ state: specToPosterState(spec) });
    }
    return NextResponse.json(
      { error: `Model produced malformed design JSON in ${maxAttempts} attempts (${lastParseError?.message}). Try again or simplify the brief.` },
      { status: 502 },
    );
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'API key rejected — check ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL if using GLM).' }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Model API error (${err.status}) from ${MODEL}: ${err.message}` }, { status: 502 });
    }
    throw err;
  }
}
