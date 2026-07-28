import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateLibraryFolder,
  getMetadata,
  saveMetadata,
  deleteVideoFile,
} from "@/lib/drive";
import { NextResponse } from "next/server";

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { fileId, title, category, notes, favorite } = await req.json();
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

    delete entries[fileId];
    await saveMetadata(session.accessToken, folderId, metaFileId, entries);
    await deleteVideoFile(session.accessToken, fileId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
      }
