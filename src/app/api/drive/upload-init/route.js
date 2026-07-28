import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateLibraryFolder } from "@/lib/drive";
import { NextResponse } from "next/server";

// This route does NOT touch the video bytes at all. It just asks Google Drive
// for a one-time "resumable upload" URL, and hands that URL back to the
// browser. The browser then uploads the actual file straight to Google,
// bypassing our server (and its body-size limit) entirely.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { fileName, mimeType, fileSize } = await req.json();
    if (!fileName || !fileSize) {
      return NextResponse.json({ error: "Missing file info" }, { status: 400 });
    }

    const folderId = await getOrCreateLibraryFolder(session.accessToken);

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mimeType || "video/mp4",
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify({
          name: fileName,
          parents: [folderId],
        }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      console.error("Drive resumable init failed", initRes.status, errText);
      return NextResponse.json({ error: "Could not start upload with Drive" }, { status: 500 });
    }

    // Google returns the one-time upload URL in this header
    const uploadUrl = initRes.headers.get("Location");

    return NextResponse.json({ uploadUrl, folderId });
  } catch (err) {
    console.error("Upload init error", err);
    return NextResponse.json({ error: "Failed to start upload" }, { status: 500 });
  }
      }
