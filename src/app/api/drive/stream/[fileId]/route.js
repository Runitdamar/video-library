import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Streams a private Drive video through our server so it can be played with
// a real <video> element / Video.js. Supports range requests so seeking and
// scrubbing work properly instead of only playing from the start.
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { fileId } = params;
  const range = req.headers.get("range");

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(range ? { Range: range } : {}),
      },
    }
  );

  if (!driveRes.ok) {
    return NextResponse.json(
      { error: "Failed to stream file" },
      { status: driveRes.status }
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", driveRes.headers.get("content-type") || "video/mp4");
  const contentLength = driveRes.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = driveRes.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Accept-Ranges", "bytes");

  return new Response(driveRes.body, {
    status: driveRes.status === 206 ? 206 : 200,
    headers,
  });
}
