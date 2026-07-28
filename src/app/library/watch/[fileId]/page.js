"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";

export default function WatchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const fileId = params.fileId;

  const [entry, setEntry] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const [listRes, urlRes] = await Promise.all([
          fetch("/api/drive/list"),
          fetch(`/api/drive/direct-url/${fileId}`),
        ]);
        const listData = await listRes.json();
        const urlData = await urlRes.json();

        if (listRes.ok) {
          const found = listData.entries.find((e) => e.id === fileId);
          setEntry(found || null);
        }
        if (urlRes.ok) {
          setVideoUrl(urlData.url);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status, fileId]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <header className="flex items-center gap-3 p-5 border-b border-line">
        <button
          onClick={() => router.push("/library")}
          className="flex items-center justify-center bg-transparent border border-line rounded-md p-2"
          aria-label="Back to library"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <h1 className="font-display font-semibold text-base truncate">
          {entry?.title || "Video"}
        </h1>
      </header>

      <main className="p-4">
        {!entry ? (
          <p className="text-sm text-muted text-center py-16">
            Couldn't find that video.
          </p>
        ) : (
          <>
            <VideoPlayer src={videoUrl} title={entry.title} />
            {entry.notes && (
              <p className="text-[13px] text-[#6b6656] mt-4 leading-relaxed">
                {entry.notes}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
      }
