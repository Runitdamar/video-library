import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateLibraryFolder,
  getMetadata,
  saveMetadata,
  uploadVideoFile,
} from "@/lib/drive";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const title = formData.get("title") || file.name;
    const category = formData.get("category") || "Uncategorized";
    const notes = formData.get("notes") || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const folderId = await getOrCreateLibraryFolder(session.accessToken);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    const uploaded = await uploadVideoFile(
      session.accessToken,
      folderId,
      file.name,
      file.type || "video/mp4",
      stream
    );

    const { fileId: metaFileId, entries } = await getMetadata(session.accessToken, folderId);
    const catalogNo = Object.keys(entries).length + 1;

    entries[uploaded.id] = { title, category, notes, catalogNo };
    await saveMetadata(session.accessToken, folderId, metaFileId, entries);

    return NextResponse.json({
      success: true,
      entry: { id: uploaded.id, title, category, notes, catalogNo },
    });
  } catch (err) {
    console.error("Upload error", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
      }
