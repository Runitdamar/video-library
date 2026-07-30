"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, Film, X, Play, Search, Trash2, Clock, Heart, EyeOff, Image as ImageIcon,
  LibraryBig, Bell, User, SlidersHorizontal,
  UploadCloud, Loader2,
} from "lucide-react";

const FILTERS = ["All", "Recent", "Favorites", "Unwatched"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

// Pulls the 11-character video ID out of any common YouTube URL shape.
// Returns null if the string isn't a recognizable YouTube link.
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function Library() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", notes: "", file: null, thumbnail: null, youtubeUrl: "" });
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") loadLibrary();
  }, [status]);

  async function loadLibrary() {
    setLoading(true);
    try {
      const res = await fetch("/api/drive/list");
      const data = await res.json();
      if (res.ok) setEntries(data.entries);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = [...entries];
    if (activeFilter === "Recent") {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((e) => new Date(e.createdTime).getTime() >= sevenDaysAgo);
    }
    if (activeFilter === "Favorites") {
      list = list.filter((e) => e.favorite);
    }
    if (activeFilter === "Unwatched") {
      list = list.filter((e) => !e.watched);
    }
    return list
      .filter((e) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return e.title.toLowerCase().includes(q) || (e.notes || "").toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  }, [entries, activeFilter, query]);

  function resetForm() {
    setForm({ title: "", notes: "", file: null, thumbnail: null, youtubeUrl: "" });
    setError("");
  }

  async function handleUpload() {
    const youtubeId = extractYouTubeId(form.youtubeUrl);

    if (form.youtubeUrl.trim() && !youtubeId) {
      setError("That doesn't look like a valid YouTube link.");
      return;
    }
    if (!form.file && !youtubeId) {
      setError("Choose a video file or paste a YouTube link.");
      return;
    }
    if (!form.title.trim()) {
      setError("Give it a title.");
      return;
    }

    if (youtubeId) {
      setUploading(true);
      setError("");
      try {
        const res = await fetch("/api/drive/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: `youtube-${youtubeId}`,
            title: form.title.trim(),
            notes: form.notes.trim(),
            source: "youtube",
            youtubeId,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Could not save this link.");
          return;
        }
        await loadLibrary();
        resetForm();
        setShowForm(false);
      } catch (e) {
        console.error(e);
        setError("Could not save this link. Try again.");
      } finally {
        setUploading(false);
      }
      return;
    }

    setUploading(true);
    setError("");
    try {
      const initRes = await fetch("/api/drive/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: form.file.name,
          mimeType: form.file.type || "video/mp4",
          fileSize: form.file.size,
        }),
      });
      const initData = await initRes.json();

      if (!initRes.ok || !initData.uploadUrl) {
        setError(initData.error || "Could not start upload.");
        return;
      }

      // We deliberately do NOT try to read anything back from this request.
      // Google's upload endpoint blocks the browser from reading its own
      // response here (a CORS restriction), even though the upload itself
      // succeeds. So we fire the upload and then ask our own server (which
      // isn't subject to that restriction) to confirm it landed.
      try {
        await fetch(initData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": form.file.type || "video/mp4" },
          body: form.file,
        });
      } catch (putErr) {
        // This throws due to CORS even when the upload succeeded — that's
        // expected and not itself a failure. We confirm success next by
        // asking our own server, which isn't subject to CORS.
        console.error("PUT threw (expected due to CORS)", putErr);
      }

      // Give Drive a brief moment to finish registering the file, then ask
      // our server to find it by name — server-to-server calls aren't
      // blocked by CORS the way browser calls are.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const listRes = await fetch("/api/drive/list");
      const listData = await listRes.json();
      const match = listData.entries?.find((e) => e.name === form.file.name);
      const uploadedFileId = match?.id || null;

      if (!uploadedFileId) {
        setError("Upload may still be finishing — check your library in a moment, or try again.");
        await loadLibrary();
        return;
      }

      // Custom thumbnails are handled entirely separately, after this
      // upload is confirmed saved — see handleAddThumbnail below. Keeping
      // them apart means a thumbnail issue can never affect the video
      // upload, and we can debug/fix each independently.
      const completeRes = await fetch("/api/drive/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: uploadedFileId,
          title: form.title.trim(),
          notes: form.notes.trim(),
        }),
      });

      if (!completeRes.ok) {
        const completeData = await completeRes.json();
        setError(completeData.error || "Uploaded, but failed to save details.");
        return;
      }

      // If a cover image was chosen, attempt it now as a separate, isolated
      // step — failures here never affect the video/title that's already
      // safely saved.
      if (form.thumbnail) {
        await handleAddThumbnail(uploadedFileId, form.thumbnail);
        await loadLibrary();
        setUploading(false);
        return; // stay open so the debug line above is readable
      }

      await loadLibrary();
      resetForm();
      setShowForm(false);
    } catch (e) {
      console.error(e);
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  // Fully isolated from the main video upload — if this fails, it never
  // affects the video/title, which is already safely saved by this point.
  async function handleAddThumbnail(fileId, imageFile) {
    try {
      const thumbFd = new FormData();
      thumbFd.append("file", imageFile);

      const thumbRes = await fetch("/api/drive/thumbnail-upload", {
        method: "POST",
        body: thumbFd,
      });
      if (!thumbRes.ok) return;

      const thumbData = await thumbRes.json();
      const thumbnailId = thumbData.thumbnailId;
      if (!thumbnailId) return;

      await fetch("/api/drive/entry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, customThumbnail: thumbnailId }),
      });
    } catch (thumbErr) {
      console.error("Cover image step failed", thumbErr);
    }
  }

  async function handleDelete(fileId) {
    setEntries((prev) => prev.filter((e) => e.id !== fileId));
    try {
      await fetch("/api/drive/entry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
    } catch (e) {
      console.error(e);
      loadLibrary();
    }
  }

  async function toggleFavorite(fileId, current) {
    setEntries((prev) =>
      prev.map((e) => (e.id === fileId ? { ...e, favorite: !current } : e))
    );
    try {
      await fetch("/api/drive/entry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, favorite: !current }),
      });
    } catch (e) {
      console.error(e);
      loadLibrary();
    }
  }

  function formatSize(bytes) {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    if (mb < 1000) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-28">
      {/* Header */}
      <header className="px-5 pt-7 pb-2 flex items-start justify-between">
        <div>
          <p className="text-[11px] tracking-widest text-muted uppercase font-medium">
            {greeting()}
          </p>
          <h1 className="font-display font-extrabold text-[32px] leading-tight -tracking-tight mt-0.5">
            Your Library
          </h1>
          <p className="text-[13px] text-muted mt-0.5">Your videos. In your Drive.</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center shrink-0 mt-1"
          aria-label="Sign out"
        >
          <User size={18} strokeWidth={1.75} />
        </button>
      </header>

      {/* Search */}
      <div className="px-5 mt-4">
        <div className="flex items-center gap-2 bg-white border border-line rounded-2xl px-4 py-3.5">
          <Search size={17} className="text-muted shrink-0" strokeWidth={2} />
          <input
            className="border-none outline-none bg-transparent text-[14px] w-full font-sans"
            placeholder="Search your videos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SlidersHorizontal size={16} className="text-muted shrink-0" strokeWidth={2} />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 mt-3.5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium whitespace-nowrap shrink-0 transition ${
              activeFilter === f
                ? "bg-ink text-paper"
                : "bg-white border border-line text-[#5c584d]"
            }`}
          >
            {f === "Recent" && <Clock size={13} strokeWidth={2} />}
            {f === "Favorites" && <Heart size={13} strokeWidth={2} />}
            {f === "Unwatched" && <EyeOff size={13} strokeWidth={2} />}
            {f}
            {f === "All" && (
              <span
                className={`ml-0.5 text-[11px] rounded-full px-1.5 py-0.5 ${
                  activeFilter === f ? "bg-red text-white" : "bg-[#EFEAE0] text-[#8C8778]"
                }`}
              >
                {entries.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="px-5 mt-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted" size={22} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 gap-3">
            <div className="w-20 h-20 rounded-full bg-[#E4E0D6] flex items-center justify-center">
              <LibraryBig size={30} strokeWidth={1.5} className="text-[#9c9686]" />
            </div>
            <p className="font-display font-bold text-lg mt-1">
              {entries.length === 0 ? "Your library is waiting" : "Nothing matches"}
            </p>
            <p className="text-[13px] text-muted max-w-[260px] leading-relaxed">
              {entries.length === 0
                ? "Upload a video to get started — it'll be saved straight to your Drive."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((entry) => {
              const sizeLabel = formatSize(entry.size);
              return (
                <div
                  key={entry.id}
                  className="bg-white border border-line rounded-3xl overflow-hidden"
                >
                  <button
                    onClick={() => router.push(`/library/watch/${encodeURIComponent(entry.id)}`)}
                    className="w-full flex gap-3.5 p-3.5 text-left"
                  >
                    <div className="relative w-[104px] h-[104px] rounded-2xl bg-[#DCD8CC] shrink-0 flex items-center justify-center overflow-hidden">
                      {entry.customThumbnail ? (
                        <img
                          src={`/api/drive/thumbnail/${entry.customThumbnail}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : entry.thumbnailLink ? (
                        <img
                          src={entry.thumbnailLink}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film size={26} strokeWidth={1.5} className="text-[#9c9686]" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
                          <Play size={15} strokeWidth={2} fill="white" className="text-white ml-0.5" />
                        </div>
                      </div>
                      {!entry.watched && (
                        <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red ring-2 ring-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h3 className="font-display font-bold text-[15.5px] leading-snug line-clamp-2">
                          {entry.title}
                        </h3>
                        <p className="text-[11.5px] text-muted mt-1">
                          {new Date(entry.createdTime).toLocaleDateString(undefined, {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                          {sizeLabel ? ` · ${sizeLabel}` : ""}
                        </p>
                      </div>
                      {entry.notes && (
                        <p className="text-[12px] text-[#6b6656] line-clamp-2 mt-1.5">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F7F5EF] border-t border-line">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#8C8778]">
                      {entry.source === "youtube" ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000">
                            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0[...]
                          </svg>
                          YouTube
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 8l10 6 10-6-10-6z" fill="#4285F4" />
                            <path d="M2 8v8l10 6V14L2 8z" fill="#34A853" />
                            <path d="M22 8v8l-10 6V14l10-6z" fill="#FBBC05" />
                          </svg>
                          Stored in Google Drive
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(entry.id, entry.favorite)}
                        className={`p-1 ${entry.favorite ? "text-red" : "text-[#b0aa98]"}`}
                        aria-label={entry.favorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Heart size={14} strokeWidth={1.75} fill={entry.favorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-[#b0aa98] p-1"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[440px] bg-ink rounded-full flex items-center justify-between px-3 py-2.5 shadow-lg z-40">
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-paper">
          <LibraryBig size={19} strokeWidth={2} />
          <span className="text-[9.5px] font-medium">Library</span>
        </button>

