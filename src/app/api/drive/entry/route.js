import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateLibraryFolder,
  getMetadata,
  saveMetadata,
  deleteVideoFile,
} from "@/lib/drive";
import { NextResponse } from "next/server";

// Saves a YouTube link as a library entry — no Drive file involved, just
// metadata (title, notes, the video ID for playback/thumbnail).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { fileId, title, notes, source, youtubeId } = await req.json();
    if (!fileId || !youtubeId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const folderId = await getOrCreateLibraryFolder(session.accessToken);
    const { fileId: metaFileId, entries } = await getMetadata(session.accessToken, folderId);

    entries[fileId] = {
      title: title || "Untitled",
      notes: notes || "",
      source: source || "youtube",
      youtubeId,
      createdTime: new Date().toISOString(),
    };

    await saveMetadata(session.accessToken, folderId, metaFileId, entries);
    return NextResponse.json({ success: true, entry: entries[fileId] });
  } catch (err) {
    console.error("Save YouTube entry error", err);
    return NextResponse.json({ error: "Failed to save link" }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { fileId, title, category, notes, favorite, watched, customThumbnail } = await req.json();
    const folderId = await getOrCreateLibraryFolder(session.accessToken);
    const { fileId: metaFileId, entries } = await getMetadata(session.accessToken, folderId);

    if (!entries[fileId]) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    entries[fileId] = {
      ...entries[fileId],
      ...(title !== undefined && { title }),
      ...(category !== undefined && { category }),
      ...(notes !== undefined && { notes }),
      ...(favorite !== undefined && { favorite }),
      ...(watched !== undefined && { watched }),
      ...(customThumbnail !== undefined && { customThumbnail }),
    };

    await saveMetadata(session.accessToken, folderId, metaFileId, entries);
    return NextResponse.json({ success: true, entry: entries[fileId] });
  } catch (err) {
    console.error("Update error", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { fileId } = await req.json();
    const folderId = await getOrCreateLibraryFolder(session.accessToken);
    const { fileId: metaFileId, entries } = await getMetadata(session.accessToken, folderId);

    const isYoutube = entries[fileId]?.source === "youtube";
    delete entries[fileId];
    await saveMetadata(session.accessToken, folderId, metaFileId, entries);
    if (!isYoutube) {
      await deleteVideoFile(session.accessToken, fileId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
