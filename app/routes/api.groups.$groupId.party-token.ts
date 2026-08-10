import { requireAuth } from "~/.server/auth/session";
import { env } from "~/.server/env";
import { requireGroupPermission } from "~/.server/permissions/group-permissions";
import { createPartyAuthToken } from "../../shared/party-auth";

interface RouteArgs {
  request: Request;
  params: { groupId?: string };
}

const PARTY_TOKEN_TTL_MS = 5 * 60 * 1000;

export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const groupId = params.groupId;
  if (!groupId) {
    return Response.json({ error: "Group ID required" }, { status: 400 });
  }

  const session = await requireAuth(request);
  await requireGroupPermission(groupId, session.user.id, "view");

  const expiresAt = Date.now() + PARTY_TOKEN_TTL_MS;
  const token = await createPartyAuthToken(
    {
      userId: session.user.id,
      userName: session.user.name || "Anonymous",
      mapId: `schedule-${groupId}`,
      expiresAt,
    },
    env.PARTYKIT_AUTH_SECRET
  );

  return Response.json({ token, expiresAt });
}
