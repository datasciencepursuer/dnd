import { redirect } from "react-router";
import { auth } from "./auth.server";

export async function getSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function requireAuth(request: Request) {
  const session = await getSession(request);
  if (!session) {
    throw redirect("/login");
  }
  return session;
}
