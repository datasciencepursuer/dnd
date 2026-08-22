import type { Route } from "./+types/api.maps.$mapId";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps, groupMembers, user } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import {
  requireMapPermission,
  getEffectivePermissions,
} from "~/.server/permissions/map-permissions";
import { getUserTierLimits } from "~/.server/subscription";
import {
  collectImageUrlValues,
  collectImageUrlStrings,
  validateOwnedImageUrls,
} from "~/.server/uploads/image-validation";
import { cleanupDeletedRecordImages } from "~/.server/uploads/lifecycle";
import { recompileGuidedToken } from "~/features/character-creator/rules/recompile-token";
import {
  canonicalizePlayerMapData,
  validateTokenIdUniqueness,
  validatePlayerTokenChanges,
} from "~/features/map-editor/utils/map-data-policy";

interface GroupMemberInfo {
  id: string;
  name: string;
}

interface RecordValue {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recompileTokenArray(
  value: unknown,
  existingValue: unknown,
  generatedAt: string,
) {
  if (!Array.isArray(value)) return { valid: true as const, value };

  const existingById = new Map<string, RecordValue>();
  if (Array.isArray(existingValue)) {
    for (const entry of existingValue) {
      if (isRecord(entry) && typeof entry.id === "string") {
        existingById.set(entry.id, entry);
      }
    }
  }

  let changed = false;
  const nextTokens: unknown[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      nextTokens.push(entry);
      continue;
    }

    const existingToken = typeof entry.id === "string" ? existingById.get(entry.id) : undefined;
    const hasSubmittedBuild = Object.prototype.hasOwnProperty.call(entry, "characterCreationBuild");
    let tokenForCompilation: RecordValue = !hasSubmittedBuild && existingToken?.characterCreationBuild !== undefined
      ? { ...entry, characterCreationBuild: existingToken.characterCreationBuild }
      : entry;

    // A full-map update may omit the cached sheet while still carrying a guided
    // source build. Keep the existing runtime state available to the compiler.
    if (
      tokenForCompilation.characterCreationBuild !== undefined &&
      tokenForCompilation.characterCreationBuild !== null &&
      existingToken?.characterSheet !== undefined
    ) {
      const existingSheet = isRecord(existingToken.characterSheet) ? existingToken.characterSheet : {};
      const submittedSheet = isRecord(tokenForCompilation.characterSheet)
        ? tokenForCompilation.characterSheet
        : {};
      tokenForCompilation = {
        ...tokenForCompilation,
        characterSheet: { ...existingSheet, ...submittedSheet },
      };
    }
    const compiledToken = recompileGuidedToken(tokenForCompilation, generatedAt);
    if (!compiledToken.valid) return compiledToken;

    if (compiledToken.token !== entry) changed = true;
    nextTokens.push(compiledToken.token);
  }

  return { valid: true as const, value: changed ? nextTokens : value };
}

function recompileGuidedTokensInMapData(
  data: unknown,
  existingData: unknown,
  generatedAt: string,
) {
  if (!isRecord(data)) return { valid: true as const, data };

  const existingRecord = isRecord(existingData) ? existingData : undefined;
  let nextData: RecordValue = data;
  let changed = false;

  const activeTokens = recompileTokenArray(data.tokens, existingRecord?.tokens, generatedAt);
  if (!activeTokens.valid) return activeTokens;
  if (activeTokens.value !== data.tokens) {
    nextData = { ...nextData, tokens: activeTokens.value };
    changed = true;
  }

  const scenes = data.scenes;
  if (Array.isArray(scenes)) {
    const existingScenes = Array.isArray(existingRecord?.scenes) ? existingRecord.scenes : [];
    const existingScenesById = new Map<string, RecordValue>();
    for (const scene of existingScenes) {
      if (isRecord(scene) && typeof scene.id === "string") {
        existingScenesById.set(scene.id, scene);
      }
    }

    const nextScenes: unknown[] = [];
    for (const scene of scenes) {
      if (!isRecord(scene)) {
        nextScenes.push(scene);
        continue;
      }

      const existingScene = typeof scene.id === "string" ? existingScenesById.get(scene.id) : undefined;
      const sceneTokens = recompileTokenArray(scene.tokens, existingScene?.tokens, generatedAt);
      if (!sceneTokens.valid) return sceneTokens;

      if (sceneTokens.value !== scene.tokens) {
        nextScenes.push({ ...scene, tokens: sceneTokens.value });
        changed = true;
      } else {
        nextScenes.push(scene);
      }
    }
    if (changed || nextScenes.some((scene, index) => scene !== scenes[index])) {
      nextData = { ...nextData, scenes: nextScenes };
      changed = true;
    }
  }

  return { valid: true as const, data: changed ? nextData : data };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  // Check permission
  const access = await requireMapPermission(mapId, session.user.id, "view");

  // Get map data
  const mapData = await db
    .select()
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (mapData.length === 0) {
    return new Response("Map not found", { status: 404 });
  }

  // Get group members if map belongs to a group (for token owner assignment)
  let groupMembersData: GroupMemberInfo[] = [];
  if (mapData[0].groupId) {
    const members = await db
      .select({
        id: user.id,
        name: user.name,
      })
      .from(groupMembers)
      .innerJoin(user, eq(groupMembers.userId, user.id))
      .where(eq(groupMembers.groupId, mapData[0].groupId));

    groupMembersData = members;
  }

  return Response.json({
    ...mapData[0],
    permission: access.permission,
    customPermissions: getEffectivePermissions(access),
    groupMembers: groupMembersData,
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  switch (request.method) {
    case "PUT": {
      // Check at least view permission (all group members can view)
      const access = await requireMapPermission(mapId, session.user.id, "view");
      // DM can edit everything, players have limited edit
      const isDM = access.isDungeonMaster;

      const body = await request.json();
      const { name, data, newDmId } = body;
      let persistedData = data;
      let dataForPersistence = data;

      let currentMapData: { data: unknown; groupId: string | null } | null = null;
      if (data !== undefined) {
        const currentMap = await db
          .select({ data: maps.data, groupId: maps.groupId })
          .from(maps)
          .where(eq(maps.id, mapId))
          .limit(1);

        if (currentMap.length === 0) {
          return new Response("Map not found", { status: 404 });
        }

        currentMapData = currentMap[0];
        if (!isDM) {
          const tokenIdValidation = validateTokenIdUniqueness(currentMapData.data, data);
          if (!tokenIdValidation.valid) {
            return new Response(tokenIdValidation.error, { status: 403 });
          }

          const tokenValidation = validatePlayerTokenChanges(
            currentMapData.data,
            data,
            session.user.id,
          );
          if (!tokenValidation.valid) {
            return new Response(tokenValidation.error, { status: 403 });
          }

          const mapDataPolicy = canonicalizePlayerMapData(currentMapData.data, data);
          if (!mapDataPolicy.valid) {
            return new Response(mapDataPolicy.error, { status: 403 });
          }
          dataForPersistence = mapDataPolicy.data;
        }

        const existingImageUrls = collectImageUrlValues(currentMapData.data).filter(
          (value): value is string => typeof value === "string"
        );
        const imageValidation = await validateOwnedImageUrls(
          session.user.id,
          collectImageUrlValues(dataForPersistence),
          {
            allowedExistingUrls: existingImageUrls,
            ...(currentMapData.groupId ? { groupId: currentMapData.groupId } : {}),
          }
        );
        if (!imageValidation.valid) {
          return Response.json({ error: imageValidation.error }, { status: 400 });
        }

        const guidedTokenResult = recompileGuidedTokensInMapData(
          dataForPersistence,
          currentMapData.data,
          new Date().toISOString(),
        );
        if (!guidedTokenResult.valid) {
          return Response.json(
            { error: "Invalid guided token build", errors: guidedTokenResult.errors },
            { status: 400 },
          );
        }
        persistedData = guidedTokenResult.data;
      }

      // Handle DM transfer
      if (newDmId !== undefined) {
        if (!isDM) {
          return new Response("Only the DM can transfer ownership", { status: 403 });
        }

        // Get current map to check group
        const currentMap = await db
          .select({ groupId: maps.groupId })
          .from(maps)
          .where(eq(maps.id, mapId))
          .limit(1);

        if (currentMap.length === 0) {
          return new Response("Map not found", { status: 404 });
        }

        // Verify new DM is a group member (if map belongs to a group)
        if (currentMap[0].groupId) {
          const memberCheck = await db
            .select({ userId: groupMembers.userId })
            .from(groupMembers)
            .where(eq(groupMembers.groupId, currentMap[0].groupId));

          const memberIds = memberCheck.map(m => m.userId);
          if (!memberIds.includes(newDmId)) {
            return new Response("New DM must be a group member", { status: 400 });
          }
        }

        // Transfer DM by updating map owner
        await db.update(maps).set({
          userId: newDmId,
          updatedAt: new Date()
        }).where(eq(maps.id, mapId));

        return Response.json({ success: true, transferred: true });
      }

      // Tier limit validation on map data
      if (dataForPersistence) {
        const mapRecord = await db
          .select({ userId: maps.userId })
          .from(maps)
          .where(eq(maps.id, mapId))
          .limit(1);

        if (mapRecord.length > 0) {
          const limits = await getUserTierLimits(mapRecord[0].userId);
          const mapData = dataForPersistence as { scenes?: unknown[]; walls?: unknown[]; areas?: unknown[] };

          // Scene count check: scenes array + 1 for the active scene
          if (mapData.scenes && mapData.scenes.length + 1 > limits.maxScenesPerMap) {
            return Response.json(
              { error: `Scene limit reached (${limits.maxScenesPerMap}). Upgrade for more.`, upgrade: true },
              { status: 403 }
            );
          }

          // Walls and terrain check
          if (!limits.wallsAndTerrain && ((mapData.walls && (mapData.walls as unknown[]).length > 0) || (mapData.areas && (mapData.areas as unknown[]).length > 0))) {
            return Response.json(
              { error: "Walls & terrain requires Hero plan.", upgrade: true },
              { status: 403 }
            );
          }
        }
      }

      const updateData: { name?: string; data?: unknown; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      // Only DM can change map name
      if (name !== undefined && isDM) {
        updateData.name = name;
      }
      if (data !== undefined) {
        updateData.data = persistedData;
      }

      await db.update(maps).set(updateData).where(eq(maps.id, mapId));

      return Response.json({ success: true });
    }

    case "DELETE": {
      // Check delete permission (owner only)
      const access = await requireMapPermission(
        mapId,
        session.user.id,
        "delete",
        { includeData: true }
      );
      const imageUrls = collectImageUrlStrings(access.mapData?.data);
      const ownerId = access.mapData?.userId;

      await db.delete(maps).where(eq(maps.id, mapId));

      try {
        if (ownerId) await cleanupDeletedRecordImages(imageUrls, ownerId);
      } catch (error) {
        console.error("Map deleted, but image cleanup failed:", error);
      }

      return Response.json({ success: true });
    }

    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
