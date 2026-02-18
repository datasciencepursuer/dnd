import { env } from "~/.server/env";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { analyzeMapBackground } from "~/.server/ai/auto-draw";
import { getUserTierLimits } from "~/.server/subscription";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI features are not configured on this server" },
      { status: 503 }
    );
  }

  const session = await requireAuth(request);
  const mapId = params.mapId;

  // Check tier permission
  const limits = await getUserTierLimits(session.user.id);
  if (!limits.aiDmAssistant) {
    return Response.json(
      { error: "AI Auto-Draw requires a Hero subscription.", upgrade: true },
      { status: 403 }
    );
  }

  // Only DM can use AI auto-draw
  const access = await requireMapPermission(mapId, session.user.id, "view");
  if (!access.isDungeonMaster) {
    return Response.json(
      { error: "Only the Dungeon Master can use AI Auto-Draw" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { imageUrl, gridWidth, gridHeight, region } = body as {
    imageUrl: string;
    gridWidth: number;
    gridHeight: number;
    region?: { x: number; y: number; width: number; height: number };
  };

  if (!imageUrl || typeof imageUrl !== "string") {
    return Response.json({ error: "imageUrl is required" }, { status: 400 });
  }
  if (!gridWidth || typeof gridWidth !== "number" || gridWidth < 1) {
    return Response.json({ error: "gridWidth must be a positive number" }, { status: 400 });
  }
  if (!gridHeight || typeof gridHeight !== "number" || gridHeight < 1) {
    return Response.json({ error: "gridHeight must be a positive number" }, { status: 400 });
  }

  // Validate region if provided
  if (region) {
    if (typeof region.x !== "number" || typeof region.y !== "number" ||
        typeof region.width !== "number" || typeof region.height !== "number") {
      return Response.json({ error: "region must have numeric x, y, width, height" }, { status: 400 });
    }
    if (region.x < 0 || region.y < 0 || region.width < 10 || region.height < 10) {
      return Response.json({ error: "Region must be at least 10x10 cells" }, { status: 400 });
    }
    if (region.x + region.width > gridWidth || region.y + region.height > gridHeight) {
      return Response.json({ error: "region exceeds grid bounds" }, { status: 400 });
    }
  }

  try {
    const suggestions = await analyzeMapBackground(apiKey, imageUrl, gridWidth, gridHeight, region);
    return Response.json({ suggestions });
  } catch (error) {
    console.error("[AI Auto-Draw] Error:", error);
    return Response.json(
      { error: "Failed to analyze map image. Please try again." },
      { status: 500 }
    );
  }
}
