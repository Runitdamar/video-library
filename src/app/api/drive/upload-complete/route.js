import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateLibraryFolder, getMetadata, saveMetadata } from "@/lib/drive";
import { NextResponse } from "next/server";

// Called after the browser has already uploaded the video bytes directly to
// Drive (via the resumable URL from upload-init). This just attaches our
// title/category/notes to the file that now exists in Drive.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { fileId, title, category, notes } = await req.json();
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const folderId = await getOrCreateLibraryFolder(session.accessToken);
    const { fileId: metaFileId, entries } = await getMetadata(session.accessToken, folderId);

    const catalogNo = Object.keys(entries).length + 1;
    entries[fileId] = {
      title: title || "Untitled",
      category: category || "Uncategorized",
      notes: notes || "",
      catalogNo,
    };

    await saveMetadata(session.accessToken, folderId, metaFileId, entries);

    return NextResponse.json({ success: true, entry: entries[fileId] });
  } catch (err) {
    console.error("Upload-complete error", err);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }
}
