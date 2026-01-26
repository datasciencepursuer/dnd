import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { auth } from "~/.server/auth/auth.server";

export async function action({ request }: Route.ActionArgs) {
  // Get session token from cookies to revoke
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (session) {
    // Revoke the session
    await auth.api.revokeSession({
      headers: request.headers,
      body: {
        token: session.session.token,
      },
    });
  }

  // Clear the session cookie by redirecting to login
  // The cookie will expire naturally, but we redirect to login
  return redirect("/login");
}

export async function loader() {
  return redirect("/");
}
