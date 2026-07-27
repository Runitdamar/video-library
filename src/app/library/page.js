"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, Film, X, ExternalLink, Search, Trash2,
  FolderOpen, LogOut, UploadCloud, Loader2,
} from "lucide-react";

const CATEGORIES = ["Tutorials", "Vlogs", "Projects", "Uncategorized"];
const CATEGORY_META = {
  Tutorials: { code: "TUT" },
  Vlogs: { code: "VLG" },
  Projects: { code: "PRJ" },
  Uncategorized: { code: "UNC" },
};

export default function Library() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", category: "Tutorials", notes: "", file: null });
  const fileInputRef = useRef(null);

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
    return entries
      .filter((e) => activeCategory === "All" || e.category === activeCategory)
      .filter((e) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return e.title.toLowerCase().includes(q) || (e.notes || "").toLowerCase().includes(q);
      })
      .sort((a, b) => b.catalogNo - a.catalogNo);
  }, [entries, activeCategory, query]);

  const counts = useMemo(() => {
    const c = { All: entries.length };
    CATEGORIES.forEach((cat) => (c[cat] = entries.filter((e) => e.category === cat).length));
    return c;
  }, [entries]);

  function resetForm() {
    setForm({ title: "", category: "Tutorials", notes: "", file: null });
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
      const fd = new FormData();
      fd.append("file", form.file);
      fd.append("title", form.title.trim());
      fd.append("category", form.category);
      fd.append("notes", form.notes.trim());

      const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }

      await loadLibrary();
      resetForm();
      setShowForm(false);
    } catch (e) {
      setError("Upload failed. Try again.");
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

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <header className="flex justify-between items-start p-5 border-b border-line gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-ink text-paper flex items-center justify-center shrink-0">
            <Film size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl -tracking-tight">The Shelf</h1>
            <p className="text-[11.5px] text-muted">
              {session?.user?.email} · {entries.length} {entries.length === 1 ? "reel" : "reels"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-amber text-ink rounded-md px-3.5 py-2.5 text-xs font-semibold"
          >
            <Plus size={16} strokeWidth={2} /> Upload
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center justify-center bg-transparent border border-line rounded-md p-2.5 text-muted"
            aria-label="Sign out"
          >
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="px-5 pt-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-2 bg-white border border-line rounded-lg px-3 py-2.5">
          <Search size={15} className="text-muted" strokeWidth={2} />
          <input
            className="border-none outline-none bg-transparent text-[13px] w-full font-mono"
            placeholder="Search title or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] whitespace-nowrap shrink-0 ${
                activeCategory === cat
                  ? "bg-ink text-paper border-ink"
                  : "border-line text-[#5c584d]"
              }`}
            >
              {cat}
              <span className="text-[10px] opacity-65">{counts[cat] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="px-5 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted" size={22} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2">
            <FolderOpen size={28} strokeWidth={1.5} className="text-[#b0aa98]" />
            <p className="font-display font-semibold text-base mt-2">
              {entries.length === 0 ? "The shelf is empty." : "Nothing matches."}
            </p>
            <p className="text-[12.5px] text-muted max-w-[260px] leading-relaxed">
              {entries.length === 0
                ? "Upload your first video — it'll land in a Video Library folder in your Drive."
                : "Try a different search or category."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex bg-cardbg border border-line rounded-xl overflow-hidden">
                <div className="bg-stamp border-r border-dashed border-[#D8D2C2] px-2.5 py-3 flex flex-col items-center justify-center gap-1 min-w-[56px]">
                  <span className="text-[10px] font-medium text-amber tracking-wide">
                    {CATEGORY_META[entry.category]?.code || "UNC"}
                  </span>
                  <span className="text-[10.5px] text-[#a39d8c]">
                    №{String(entry.catalogNo).padStart(3, "0")}
                  </span>
                </div>
                <div className="flex-1 p-3.5 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-display font-semibold text-[15px] leading-snug">{entry.title}</h3>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-[#b0aa98] shrink-0 p-0.5"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-[#6b6656] mt-1.5 leading-relaxed">{entry.notes}</p>
                  )}
                  <div className="flex justify-between items-center mt-2.5">
                    <span className="text-[10.5px] text-[#a39d8c]">
                      {new Date(entry.createdTime).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                    <a
                      href={entry.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11.5px] font-medium border-b border-amber pb-px"
                    >
                      Watch <ExternalLink size={12} strokeWidth={2} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
          onClick={() => { if (!uploading) { setShowForm(false); resetForm(); } }}
        >
          <div
            className="bg-paper w-full max-w-[480px] rounded-t-2xl p-5 pb-7 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10.5px] text-amber font-medium">New upload</p>
                <h2 className="font-display font-bold text-lg mt-0.5">Add to shelf</h2>
              </div>
              <button
                onClick={() => { if (!uploading) { setShowForm(false); resetForm(); } }}
                className="bg-[#EFEAE0] rounded-full w-[30px] h-[30px] flex items-center justify-center shrink-0"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5">Video file</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-line bg-white rounded-lg px-3 py-3 text-[13px] flex items-center gap-2 text-left"
              >
                <UploadCloud size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
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
              <label className="block text-[11px] text-[#6b6656] mb-1.5">Title</label>
              <input
                className="w-full border border-line bg-white rounded-lg px-3 py-2.5 text-[13px] font-mono outline-none"
                placeholder="e.g. Sunset timelapse, first cut"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`rounded-full border px-3.5 py-1.5 text-xs ${
                      form.category === cat
                        ? "bg-ink text-paper border-ink"
                        : "bg-white border-line text-[#5c584d]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-[#6b6656] mb-1.5">Notes (optional)</label>
              <textarea
                className="w-full border border-line bg-white rounded-lg px-3 py-2.5 text-[13px] font-mono outline-none resize-y"
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
              className="w-full bg-amber text-ink rounded-lg py-3.5 text-[13.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
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
