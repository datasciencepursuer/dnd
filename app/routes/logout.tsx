import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { getSession, destroySession } from "~/.server/auth/session";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

export async function loader() {
  return redirect("/");
}
