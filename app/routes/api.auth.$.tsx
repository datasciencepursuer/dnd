import type { Route } from "./+types/api.auth.$";
import { auth } from "~/.server/auth/auth.server";

function maybeCleanupRateLimits() {
  if (Math.random() < 0.01) {
    import("~/.server/db").then(({ db }) =>
      import("drizzle-orm").then(({ sql }) =>
        db.execute(sql`DELETE FROM "rateLimit" WHERE expires_at < now()`)
      )
    ).catch(() => {});
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  maybeCleanupRateLimits();
  return auth.handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  maybeCleanupRateLimits();
  return auth.handler(request);
}
