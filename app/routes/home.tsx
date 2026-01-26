import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { requireAuth } from "~/.server/auth/session";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  throw redirect("/maps");
}

export default function Home() {
  return null;
}
