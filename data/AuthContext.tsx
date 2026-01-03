import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../firebaseConfig";

type SignUpInput = {
  email: string;
  password: string;
  displayName?: string;
};

type AuthContextValue = {
  user: User | null;
  initializing: boolean;

  signUp: (input: SignUpInput) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  async function signUp({ email, password, displayName }: SignUpInput) {
    const e = normalizeEmail(email);
    const cred = await createUserWithEmailAndPassword(auth, e, password);

    if (displayName?.trim()) {
      // Optional: set display name
      await updateProfile(cred.user, { displayName: displayName.trim() });
      // auth.currentUser may not update synchronously in state; but it will on next auth state tick.
    }

    return cred.user;
  }

  async function login(email: string, password: string) {
    const e = normalizeEmail(email);
    const cred = await signInWithEmailAndPassword(auth, e, password);
    return cred.user;
  }

  async function signOut() {
    await fbSignOut(auth);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signUp,
      login,
      signOut,
    }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
