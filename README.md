# antlii · typography studio

A layer-based motion-poster studio (Next.js 16 + p5/three on canvas). Describe a poster in words and Claude designs it as live, editable layers — or compose it by hand from the built-in engines. Posters export to PNG/WebM, save to cloud templates, and render headlessly for automation.

Live at https://typography-exp.vercel.app (auto-deployed from `main` via Vercel).

## Features

- **✨ AI Design** — a prompt goes to Claude (Opus 4.8, structured outputs) which returns a full layer stack: `POST /api/generate` → `PosterState`. Every layer stays editable in the inspector.
- **8 layer engines** — `rastr` (halftone/pattern grid), `textr` (kinetic type), `dither` (typographic dither), `img-dither` (image dither), `object3d` (WebGL hero — extruded text/primitives/GLB), `label` (precise typographic blocks), `logo`, and `custom` (a Canvas2D sketch written by the AI or by hand, with live knobs `a–d`, two colors, and text).
- **Reactivity** — bind any numeric layer param to live inputs: mic audio (level/bass/treble, `Mic` toggle in the top bar), mouse X/Y, or an LFO. Set up in the inspector's Reactivity section; bindings persist in the design and the AI can emit them for "audio-reactive" briefs.
- **Rule-based generator** — calendar event → Swiss-modern poster in one of four house styles (`Generate` button; also drives the weekly automation).
- **Cloud templates + share links** — saved to Neon Postgres via `/api/templates`; `?t=<id>` loads a design.
- **Export** — PNG at 1–3×, WebM video capture, headless PNG/MP4 rendering (see `RENDER.md`).
- **Auth** — Clerk gates the studio UI; the templates and generate APIs require a session. Headless render (`?gen=`) needs `?key=<RENDER_SECRET>` (enforced in `src/proxy.ts`).

## Setup

```bash
npm install
npm run dev
```

`.env.local` needs:

| Var | For |
|---|---|
| `DATABASE_URL` | Neon Postgres (templates) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk auth |
| `ANTHROPIC_API_KEY` | AI Design (`/api/generate`) — Anthropic key, or a GLM key with the two vars below |
| `ANTHROPIC_BASE_URL` | optional — Anthropic-compatible endpoint, e.g. `https://api.z.ai/api/anthropic` for GLM |
| `POSTER_MODEL` | optional — model for AI Design (default `claude-opus-4-8`; e.g. `glm-5.2`). Non-Claude models use prompt-enforced JSON instead of structured outputs |
| `RENDER_SECRET` | headless render key (`?gen=&key=`) |
| `NEXT_PUBLIC_GIPHY_API_KEY` | GIF search panel |
| `POLY_PIZZA_API_KEY` | 3D model search |

## Architecture notes

- A design is pure data (`PosterState` in `src/lib/types.ts`); engines are rebuilt from it, so designs round-trip through JSON (AI generation, templates, share links, headless render all reuse this).
- Engines register in `src/lib/engine-registry.ts`; adding one there automatically surfaces it in the layer menu, the inspector, and the AI system prompt (`src/lib/poster-spec.ts` builds the model-facing docs from the registry).
- The AI wire format (`PosterSpec`) carries params as `{key, value}` entries because strict structured outputs forbid open objects; `specToPosterState()` merges them over engine defaults.
