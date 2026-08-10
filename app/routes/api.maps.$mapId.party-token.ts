import { requireAuth } from "~/.server/auth/session";
import { env } from "~/.server/env";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { createPartyAuthToken } from "../../shared/party-auth";

interface RouteArgs {
  request: Request;
  params: { mapId?: string };
}

const PARTY_TOKEN_TTL_MS = 5 * 60 * 1000;

export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const mapId = params.mapId;
  if (!mapId) {
    return Response.json({ error: "Map ID required" }, { status: 400 });
  }

  const session = await requireAuth(request);
  await requireMapPermission(mapId, session.user.id, "view");

  const expiresAt = Date.now() + PARTY_TOKEN_TTL_MS;
  const token = await createPartyAuthToken(
    {
      userId: session.user.id,
      userName: session.user.name || "Anonymous",
      mapId,
      expiresAt,
    },
    env.PARTYKIT_AUTH_SECRET
  );

  return Response.json({ token, expiresAt });
}
