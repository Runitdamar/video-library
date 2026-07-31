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

    const driveEntries = files.map((f) => {
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
        customThumbnail: meta.customThumbnail || null,
        source: "drive",
        collectionId: meta.collectionId || null,
      };
    });

    // YouTube links live only in the metadata file — there's no
    // corresponding Drive file to list, so we add them here directly.
    const driveFileIds = new Set(files.map((f) => f.id));
    const youtubeEntries = Object.entries(metadata.entries)
      .filter(([id, meta]) => meta.source === "youtube" && !driveFileIds.has(id))
      .map(([id, meta]) => ({
        id,
        name: meta.title,
        webViewLink: `https://www.youtube.com/watch?v=${meta.youtubeId}`,
        thumbnailLink: `https://img.youtube.com/vi/${meta.youtubeId}/hqdefault.jpg`,
        createdTime: meta.createdTime || new Date().toISOString(),
        size: null,
        title: meta.title || "Untitled",
        notes: meta.notes || "",
        favorite: !!meta.favorite,
        watched: !!meta.watched,
        customThumbnail: meta.customThumbnail || null,
        source: "youtube",
        youtubeId: meta.youtubeId,
        collectionId: meta.collectionId || null,
      }));

    const entries = [...driveEntries, ...youtubeEntries];

    return NextResponse.json({ entries, folderId });
  } catch (err) {
    console.error("Drive list error", err);
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }
}
