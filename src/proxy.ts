import { clerkMiddleware } from '@clerk/nextjs/server';

// Provides auth state app-wide. Routes stay public by default — gating is done
// in the UI (AuthGate) so headless render (?gen=) and share links keep working.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless referenced in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
