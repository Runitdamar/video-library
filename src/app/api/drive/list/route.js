import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateLibraryFolder, getMetadata, listVideoFiles } from "@/lib/drive";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const folderId = await getOrCreateLibraryFolder(session.accessToken);
    const [files, metadata] = await Promise.all([
      listVideoFiles(session.accessToken, folderId),
      getMetadata(session.accessToken, folderId),
    ]);

    const entries = files.map((f) => {
      const meta = metadata.entries[f.id] || {};
      return {
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink,
        thumbnailLink: f.thumbnailLink,
        createdTime: f.createdTime,
        size: f.size ? Number(f.size) : null,
        title: meta.title || f.name,
        notes: meta.notes || "",
        favorite: !!meta.favorite,
        watched: !!meta.watched,
      };
    });

    return NextResponse.json({ entries, folderId });
  } catch (err) {
    console.error("Drive list error", err);
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }
        }
