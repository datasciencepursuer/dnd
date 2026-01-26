import { createCookieSessionStorage, redirect } from "react-router";
import { env } from "../env";

type SessionData = {
  isAuthenticated: boolean;
  username: string;
};

type SessionFlashData = {
  error: string;
};

const sessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>(
  {
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: "lax",
      secrets: [env.SESSION_SECRET],
      secure: process.env.NODE_ENV === "production",
    },
  }
);

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitSession(
  session: Awaited<ReturnType<typeof getSession>>
) {
  return sessionStorage.commitSession(session);
}

export async function destroySession(
  session: Awaited<ReturnType<typeof getSession>>
) {
  return sessionStorage.destroySession(session);
}

export async function requireAuth(request: Request) {
  const session = await getSession(request);
  if (!session.get("isAuthenticated")) {
    throw redirect("/login");
  }
  return session;
}
