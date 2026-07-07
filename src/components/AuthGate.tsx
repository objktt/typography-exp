'use client';

import { useEffect, useState } from 'react';
import { useUser, SignIn } from '@clerk/nextjs';

// Gates the studio behind sign-in. Signed-out users see Clerk's prebuilt login
// screen (Google + email). Headless render (?gen=) bypasses the gate so the
// poster automation pipeline keeps working without a session — safe because
// the proxy only lets ?gen through when it carries a valid RENDER_SECRET key
// (see src/proxy.ts); unauthorized requests arrive here with ?gen stripped.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const [bypass, setBypass] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // ?gen (headless poster render) or ?key (headless thumbnail capture) —
    // both are validated against RENDER_SECRET by the proxy before they can
    // reach this code, so their presence here means the request was authorized.
    if (q.has('gen') || q.has('key')) setBypass(true);
  }, []);

  if (bypass) return <>{children}</>;

  if (!isLoaded) {
    return <div className="flex flex-1 min-h-screen items-center justify-center bg-[#0d0d0d] text-xs text-gray-600">Loading…</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-1 min-h-screen flex-col items-center justify-center gap-8 bg-[#0d0d0d] p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">antlii · typography studio</h1>
          <p className="mt-1 text-xs text-gray-500">Sign in to design and save posters.</p>
        </div>
        <SignIn routing="hash" />
      </div>
    );
  }

  return <>{children}</>;
}
