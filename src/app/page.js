"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Film } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/library");
    }
  }, [status, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red text-white flex items-center justify-center mb-6">
        <Film size={28} strokeWidth={1.75} />
      </div>
      <h1 className="font-display font-extrabold text-3xl mb-2 -tracking-tight">Your Library</h1>
      <p className="text-muted text-sm max-w-xs mb-8 leading-relaxed">
        Your videos. In your Drive. Sign in with Google to get started.
      </p>

      <button
        onClick={() => signIn("google")}
        disabled={status === "loading"}
        className="flex items-center gap-3 bg-white border border-line rounded-full px-6 py-3 text-sm font-medium shadow-sm active:scale-[0.98] transition"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.3 0 10.2-2 13.9-5.4l-6.4-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.9 39.6 16.4 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.4 5.4C40.7 36.3 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-xs text-muted mt-6 max-w-xs">
        We only ever see the videos you upload through this app — never your
        full Drive.
      </p>
    </main>
  );
    }

