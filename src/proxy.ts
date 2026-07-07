import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Provides auth state app-wide. Routes stay public by default — gating is done
// in the UI (AuthGate) and per-route (templates API requires a session).
//
// Headless rendering (?gen= poster pipeline, ?key-only thumbnail capture)
// skips the sign-in gate, so it must prove itself: any request carrying ?gen
// or ?key is only let through when ?key matches RENDER_SECRET. Otherwise both
// params are stripped, which also disables the client-side AuthGate bypass.
// Fails closed when RENDER_SECRET is unset.
export default clerkMiddleware((_auth, req) => {
  const { nextUrl } = req;
  if (nextUrl.searchParams.has('gen') || nextUrl.searchParams.has('key')) {
    const secret = process.env.RENDER_SECRET;
    const key = nextUrl.searchParams.get('key');
    if (!secret || key !== secret) {
      const url = nextUrl.clone();
      url.searchParams.delete('gen');
      url.searchParams.delete('key');
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless referenced in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
