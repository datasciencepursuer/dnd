import { UTApi } from "uploadthing/server";
import { requireAuth } from "~/.server/auth/session";
import { env } from "~/.server/env";

export async function loader({ request }: { request: Request }) {
  // Require authentication to list files
  await requireAuth(request);

  const utapi = new UTApi({ token: env.UPLOADTHING_TOKEN });

  try {
    const files = await utapi.listFiles();
    return Response.json({ files: files.files });
  } catch (error) {
    console.error("Failed to list files:", error);
    return Response.json({ error: "Failed to list files" }, { status: 500 });
  }
}
