import { NextRequest, NextResponse } from 'next/server';

// Streams a remote GLB through our origin so GLTFLoader can fetch it without a
// CORS error. Basic SSRF guard: https only, no private/loopback hosts.

function isSafe(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('missing url', { status: 400 });

  let url: URL;
  try { url = new URL(raw); } catch { return new NextResponse('bad url', { status: 400 }); }
  if (!isSafe(url)) return new NextResponse('blocked', { status: 400 });

  try {
    const r = await fetch(url.toString());
    if (!r.ok || !r.body) return new NextResponse('fetch failed', { status: 502 });
    return new NextResponse(r.body, {
      headers: {
        'Content-Type': r.headers.get('content-type') || 'model/gltf-binary',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('fetch error', { status: 502 });
  }
}
