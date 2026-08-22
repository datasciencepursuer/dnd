import { requireAuth } from "~/.server/auth/session";
import { compileCharacterBuild } from "~/features/character-creator/rules/compile-build";

/**
 * Validate and compile a guided build without persisting a library record.
 * This is used by inline map tokens; library writes validate again in their
 * character create/update handlers.
 */
export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  await requireAuth(request);
  const body = await request.json();
  const result = compileCharacterBuild(body?.guidedBuild, new Date().toISOString());

  if (!result.valid) {
    return Response.json(
      { error: "Invalid guided character build", errors: result.errors },
      { status: 400 },
    );
  }

  return Response.json({
    characterSheet: result.sheet,
    build: result.build,
    rulesComplete: result.rulesComplete,
    unresolvedChoices: result.unresolvedChoices,
  });
}
