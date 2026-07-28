import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// Returns a Drive URL the browser can load directly — no bytes pass through
// our server. The access token is short-lived (it refreshes automatically
// via NextAuth), so this URL stops working once the token rotates.
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { fileId } = params;
  const directUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${session.accessToken}`;

  return NextResponse.json({ url: directUrl });
  }
