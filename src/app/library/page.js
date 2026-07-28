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
  const [form, setForm] = useState({ title: "", notes: "", file: null, thumbnail: null });
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
    setForm({ title: "", notes: "", file: null, thumbnail: null });
    setError("");
  }

  async function handleUpload() {
    if (!form.file) {
      setError("Choose a video file.");
      return;
    }
    if (!form.title.trim()) {
      setError("Give it a title.");
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

      const driveRes = await fetch(initData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": form.file.type || "video/mp4" },
        body: form.file,
      });

      if (!driveRes.ok) {
        const driveErrText = await driveRes.text().catch(() => "");
        setError(`Drive upload failed (${driveRes.status}): ${driveErrText.slice(0, 200)}`);
        return;
      }

      const driveFile = await driveRes.json();

      // If a custom thumbnail was chosen, upload it too (small file, goes
      // straight through our server — no size-limit concern like video).
      let customThumbnail = null;
      if (form.thumbnail) {
        const thumbFd = new FormData();
        thumbFd.append("file", form.thumbnail);
        const thumbRes = await fetch("/api/drive/thumbnail-upload", {
          method: "POST",
          body: thumbFd,
        });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          customThumbnail = thumbData.thumbnailId;
        }
      }

      const completeRes = await fetch("/api/drive/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: driveFile.id,
          title: form.title.trim(),
          notes: form.notes.trim(),
          customThumbnail,
        }),
      });

      if (!completeRes.ok) {
        const completeData = await completeRes.json();
        setError(completeData.error || "Uploaded, but failed to save details.");
        return;
      }

      await loadLibrary();
      resetForm();
      setShowForm(false);
    } catch (e) {
      console.error(e);
      setError(`Upload failed: ${e.message || "unknown error"}`);
    } finally {
      setUploading(false);
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
                    onClick={() => router.push(`/library/watch/${entry.id}`)}
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
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 8l10 6 10-6-10-6z" fill="#4285F4" />
                        <path d="M2 8v8l10 6V14L2 8z" fill="#34A853" />
                        <path d="M22 8v8l-10 6V14l10-6z" fill="#FBBC05" />
                      </svg>
                      Stored in Google Drive
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

      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[440px] bg-ink rounded-full flex items-center justify-between px-3 py-2.5 shadow-lg z-40">
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-paper">
          <LibraryBig size={19} strokeWidth={2} />
          <span className="text-[9.5px] font-medium">Library</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-[#6f6c62]">
          <Search size={19} strokeWidth={1.75} />
          <span className="text-[9.5px]">Search</span>
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="w-12 h-12 rounded-full bg-red flex items-center justify-center -mt-4 shadow-md shrink-0"
          aria-label="Upload video"
        >
          <Plus size={22} strokeWidth={2.25} className="text-white" />
        </button>
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-[#6f6c62]">
          <Bell size={19} strokeWidth={1.75} />
          <span className="text-[9.5px]">Activity</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 px-3 py-1 text-[#6f6c62]">
          <User size={19} strokeWidth={1.75} />
          <span className="text-[9.5px]">Profile</span>
        </button>
      </nav>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
          onClick={() => { if (!uploading) { setShowForm(false); resetForm(); } }}
        >
          <div
            className="bg-paper w-full max-w-[480px] rounded-t-[28px] p-5 pb-7 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10.5px] text-red font-semibold uppercase tracking-wide">New upload</p>
                <h2 className="font-display font-bold text-xl mt-0.5">Add to library</h2>
              </div>
              <button
                onClick={() => { if (!uploading) { setShowForm(false); resetForm(); } }}
                className="bg-[#EFEAE0] rounded-full w-[30px] h-[30px] flex items-center justify-center shrink-0"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5 font-medium">Video file</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-line bg-white rounded-2xl px-4 py-3.5 text-[13.5px] flex items-center gap-2.5 text-left"
              >
                <UploadCloud size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
                <span className="truncate">{form.file ? form.file.name : "Choose a video from your phone"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              />
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5 font-medium">Cover image (optional)</label>
              <button
                onClick={() => thumbInputRef.current?.click()}
                className="w-full border border-line bg-white rounded-2xl px-4 py-3.5 text-[13.5px] flex items-center gap-2.5 text-left"
              >
                <ImageIcon size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
                <span className="truncate">{form.thumbnail ? form.thumbnail.name : "Use a custom cover instead of the auto preview"}</span>
              </button>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setForm({ ...form, thumbnail: e.target.files?.[0] || null })}
              />
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5 font-medium">Title</label>
              <input
                className="w-full border border-line bg-white rounded-2xl px-4 py-3 text-[13.5px] font-sans outline-none"
                placeholder="e.g. Weekend trip — Big Sur"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5 font-medium">Notes (optional)</label>
              <textarea
                className="w-full border border-line bg-white rounded-2xl px-4 py-3 text-[13.5px] font-sans outline-none resize-y"
                rows={3}
                placeholder="Anything worth remembering about it"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {error && <p className="text-[#B24444] text-xs mb-3">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-red text-white rounded-2xl py-4 text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Uploading to Drive…
               </>
              ) : (
                "Upload"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
                  }
