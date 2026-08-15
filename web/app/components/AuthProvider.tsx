"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase";

type User = { id: string; email: string } | null;

type Auth = {
  user: User;
  status: "loading" | "signed-in" | "signed-out";
  signIn: (email: string) => Promise<{ error?: string; sent: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth>({
  user: null,
  status: "signed-out",
  signIn: async () => ({ sent: false }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Auth["status"]>("loading");

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setStatus("signed-out");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? "" } : null);
      setStatus(u ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? "" } : null);
      setStatus(u ? "signed-in" : "signed-out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string): Promise<{ error?: string; sent: boolean }> => {
    if (!supabase) return { error: "Accounts aren't configured yet", sent: false };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) return { error: error.message, sent: false };
    return { sent: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setUser(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo(() => ({ user, status, signIn, signOut }), [user, status, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
