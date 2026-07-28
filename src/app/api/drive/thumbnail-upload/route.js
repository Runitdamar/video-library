import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateLibraryFolder, uploadThumbnailImage } from "@/lib/drive";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Images are small (a few MB at most), so relaying through our server here
// is fine — this is unlike video uploads, which need the direct-to-Drive
// resumable flow because of Vercel's request body size limit.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const folderId = await getOrCreateLibraryFolder(session.accessToken);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const thumbnailId = await uploadThumbnailImage(
      session.accessToken,
      folderId,
      file.name,
      file.type || "image/jpeg",
      buffer
    );

    return NextResponse.json({ success: true, thumbnailId });
  } catch (err) {
    console.error("Thumbnail upload error", err);
    return NextResponse.json({ error: "Thumbnail upload failed" }, { status: 500 });
  }
                                                          }
