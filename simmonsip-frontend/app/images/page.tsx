"use client";
import { useState, useRef, useEffect } from "react";

export default function ImagesPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("Unsorted");
  const [newFolder, setNewFolder] = useState("");
  const [uploaded, setUploaded] = useState<{ folder: string; url: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);

  // load previously uploaded list (images.json) on mount
  useEffect(() => {
    fetch("/api/images/list")
      .then((r) => r.json())
      .then((arr: { folder: string; url: string }[]) => setUploaded(arr));
  }, []);

  const folders = Array.from(new Set(uploaded.map((u) => u.folder))) as string[];
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Image Search</h1>
        <p className="text-sm text-gray-600">
          Upload and organize reference images for visual matching across competitor sites
        </p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Upload Images</h3>
      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        hidden
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          setPendingFiles((prev) => [...prev, ...files]);
          // clear input so selecting same files later will trigger change again
          e.target.value = "";
        }}
      />

        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium shadow-sm transition-colors"
          >
            📁 Upload Files
          </button>
          
          <div className="flex items-center gap-2 flex-1">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Or paste image URL..."
              className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={async () => {
                const clean = url.trim();
                if (!clean) return;
                setPendingUrls((prev) => [...prev, clean]);
                setUrl("");
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium transition-colors whitespace-nowrap">
              Add URL
            </button>
          </div>
        </div>
      </div>

      {/* Pending basket */}
      {(pendingFiles.length > 0 || pendingUrls.length > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Pending Uploads ({pendingFiles.length + pendingUrls.length})
          </h3>
          <ul className="space-y-2">
            {pendingFiles.map((f, i) => (
              <li key={`pf-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <span className="truncate flex-1">{f.name}</span>
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  ×
                </button>
              </li>
            ))}
            {pendingUrls.map((u, i) => (
              <li key={`pu-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <span className="truncate flex-1">{u}</span>
                <button
                  onClick={() => setPendingUrls((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {/* Folder selector */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Save to folder:</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option key="__new__" value="__new__">+ New folder…</option>
              </select>
              {folder === "__new__" && (
                <input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="Enter folder name"
                  className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              )}
              <button
                disabled={pendingFiles.length + pendingUrls.length === 0 || (folder === "__new__" && !newFolder.trim())}
                onClick={async () => {
                  const finalFolder = folder === "__new__" ? newFolder.trim() : folder;
                  // upload files
                  for (const f of pendingFiles) {
                    const form = new FormData();
                    form.append("file", f);
                    form.append("folder", finalFolder);
                    const res = await fetch("/api/images/upload", { method: "POST", body: form });
                    const data = await res.json();
                    if (data.url) setUploaded((prev) => [...prev, { folder: finalFolder, url: data.url }]);
                  }
                  // upload urls
                  for (const u of pendingUrls) {
                    await fetch("/api/images/uploadUrl", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: u, folder: finalFolder }),
                    });
                    setUploaded((prev) => [...prev, { folder: finalFolder, url: u }]);
                  }
                  // clear pending
                  setPendingFiles([]);
                  setPendingUrls([]);
                  if (folder === "__new__") {
                    setFolder(finalFolder);
                    setNewFolder("");
                  }
                }}
                className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                💾 Save All
              </button>
            </div>
          </div>
        </div>
      )}
      
      {uploaded.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Stored Images</h3>
          <div className="space-y-4">
            {Object.entries(
              uploaded.reduce((acc, cur) => {
                acc[cur.folder] = acc[cur.folder] ? [...acc[cur.folder], cur.url] : [cur.url];
                return acc;
              }, {} as Record<string, string[]>)
            ).map(([fold, urls]) => (
              <div key={fold} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">📁 {fold}</span>
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">
                      {urls.length} image{urls.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete all ${urls.length} images in "${fold}"?`)) return;
                      await fetch("/api/images/delete-folder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ folder: fold }),
                      });
                      setUploaded((prev) => prev.filter((rec) => rec.folder !== fold));
                    }}
                    className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                    aria-label={`Delete folder ${fold}`}
                  >
                    🗑 Delete Folder
                  </button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {urls.map((u) => (
                    <li key={u} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                      <a 
                        href={u} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex-1 text-sm text-blue-600 hover:text-blue-800 truncate font-medium transition-colors"
                      >
                        {u.split("/").pop()}
                      </a>
                      <button
                        onClick={async () => {
                          await fetch("/api/images/delete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url: u }),
                          });
                          setUploaded((prev) => prev.filter((rec) => rec.url !== u));
                        }}
                        className="text-red-400 hover:text-red-600 text-lg font-bold transition-colors"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* original folder selector removed because handled in pending section */}
    </div>
  );
}
