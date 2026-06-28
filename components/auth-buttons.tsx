"use client";

import { useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";

type AuthButtonsProps = {
  isSignedIn: boolean;
  email?: string | null;
};

export function AuthButtons({ isSignedIn, email }: AuthButtonsProps) {
  const [isPending, startTransition] = useTransition();

  function signInWithGoogle() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/?view=author`
        }
      });
    });
  }

  if (isSignedIn) {
    return (
      <form action="/auth/sign-out" method="post" className="auth-box">
        <span>{email}</span>
        <button type="submit">Sign out</button>
      </form>
    );
  }

  return (
    <button className="primary" disabled={isPending} onClick={signInWithGoogle}>
      {isPending ? "Opening Google..." : "Sign in with Google"}
    </button>
  );
}
