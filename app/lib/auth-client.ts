import { createAuthClient } from "better-auth/react";
import { API_BASE_URL } from "./api-config";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : ""),
});

export const { signIn, signUp, signOut, useSession, linkSocial } = authClient;
