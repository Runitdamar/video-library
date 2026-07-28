import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Serves a custom thumbnail image stored in Drive. Images are small, so
// relaying through our server (unlike video) is not a problem.
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { fileId } = params;

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );

  if (!driveRes.ok) {
    return NextResponse.json({ error: "Failed to load image" }, { status: driveRes.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", driveRes.headers.get("content-type") || "image/jpeg");
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(driveRes.body, { status: 200, headers });
    }
