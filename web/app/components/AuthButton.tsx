"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { supabaseConfigured } from "./supabase";

export default function AuthButton() {
  const { user, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <button
        onClick={() => signOut()}
        title="Sign out"
        className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
      >
        {user.email?.split("@")[0] ?? "Signed in"}
      </button>
    );
  }

  if (!supabaseConfigured) return null;

  async function submit() {
    if (!email || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await signIn(email);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Check your inbox for the magic link.");
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-85"
      >
        Sign in
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 z-50 w-72 rounded-2xl border border-hairline bg-panel p-4 shadow-[0_12px_40px_rgba(0,0,0,0.15)]">
            <p className="text-sm font-semibold text-ink">Save your progress</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Sync your watchlist and paper book across devices. No password, just a magic link.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="mt-3 flex flex-col gap-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 rounded-lg border border-hairline bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {busy ? "Sending link…" : "Email me a magic link"}
              </button>
            </form>
            {msg && <p className="mt-2 text-xs text-ink-soft">{msg}</p>}
          </div>
        </>
      )}
    </>
  );
}
