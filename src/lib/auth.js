import GoogleProvider from "next-auth/providers/google";

// Scopes we ask each user to grant:
// - drive.file: only lets us see/manage files THIS APP creates (their video
//   library folder), not their entire Drive. Safer and easier to get approved.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: stash the Drive access/refresh tokens on the JWT
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      // If the access token is still valid, keep using it
      if (Date.now() < (token.expiresAt || 0) * 1000) {
        return token;
      }

      // Otherwise refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

async function refreshAccessToken(token) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      refreshToken: refreshed.refresh_token || token.refreshToken,
    };
  } catch (err) {
    console.error("Failed to refresh access token", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
