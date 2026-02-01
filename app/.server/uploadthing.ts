import { createUploadthing, type FileRouter } from "uploadthing/remix";
import { UploadThingError } from "uploadthing/server";
import { getSession } from "~/.server/auth/session";
import { getMapAccess } from "~/.server/permissions/map-permissions";
import { db } from "~/.server/db";
import { uploads } from "~/.server/db/schema";

const f = createUploadthing();

export const uploadRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ event }) => {
      const session = await getSession(event.request);
      if (!session) throw new UploadThingError("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.ufsUrl);

      // Save to uploads table
      await db.insert(uploads).values({
        id: crypto.randomUUID(),
        userId: metadata.userId,
        url: file.ufsUrl,
        type: "token",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),

  tokenImageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 10,
    },
  })
    .middleware(async ({ event }) => {
      const session = await getSession(event.request);
      if (!session) throw new UploadThingError("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Token image upload complete for userId:", metadata.userId);

      // Save to uploads table
      await db.insert(uploads).values({
        id: crypto.randomUUID(),
        userId: metadata.userId,
        url: file.ufsUrl,
        type: "token",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),

  mapBackgroundUploader: f({
    image: {
      maxFileSize: "8MB", // Larger for map backgrounds
      maxFileCount: 1,
    },
  })
    .middleware(async ({ event }) => {
      const session = await getSession(event.request);
      if (!session) throw new UploadThingError("Unauthorized");

      // Get mapId from custom header
      const mapId = event.request.headers.get("x-map-id");
      if (!mapId) {
        throw new UploadThingError("Map ID is required");
      }

      // Check if user has edit permission for this map (only DM can change background)
      const access = await getMapAccess(mapId, session.user.id);
      const canEditMap = access.isDungeonMaster || access.customPermissions?.canEditMap;

      if (!canEditMap) {
        throw new UploadThingError("You don't have permission to edit this map");
      }

      return { userId: session.user.id, mapId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Map background upload complete for map:", metadata.mapId);

      // Save to uploads table
      await db.insert(uploads).values({
        id: crypto.randomUUID(),
        userId: metadata.userId,
        url: file.ufsUrl,
        type: "map",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      return { uploadedBy: metadata.userId, mapId: metadata.mapId, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
