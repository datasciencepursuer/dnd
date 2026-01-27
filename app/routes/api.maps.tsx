import type { Route } from "./+types/api.maps";
import { eq, or, desc } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps, mapPermissions } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { nanoid } from "nanoid";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  // Get maps where user is owner
  const ownedMaps = await db
    .select({
      id: maps.id,
      name: maps.name,
      userId: maps.userId,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
    })
    .from(maps)
    .where(eq(maps.userId, userId))
    .orderBy(desc(maps.updatedAt));

  // Get maps shared with user
  const sharedMapsData = await db
    .select({
      id: maps.id,
      name: maps.name,
      userId: maps.userId,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
      permission: mapPermissions.permission,
    })
    .from(mapPermissions)
    .innerJoin(maps, eq(mapPermissions.mapId, maps.id))
    .where(eq(mapPermissions.userId, userId))
    .orderBy(desc(maps.updatedAt));

  return Response.json({
    owned: ownedMaps.map((m) => ({
      ...m,
      permission: "owner" as const,
    })),
    shared: sharedMapsData.map((m) => ({
      id: m.id,
      name: m.name,
      userId: m.userId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      permission: m.permission,
    })),
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const userId = session.user.id;
  const body = await request.json();

  const { name, data } = body;

  if (!name || !data) {
    return new Response("Missing required fields", { status: 400 });
  }

  const id = nanoid();
  const now = new Date();

  await db.insert(maps).values({
    id,
    name,
    userId,
    data,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ id, name, userId, createdAt: now, updatedAt: now });
}
