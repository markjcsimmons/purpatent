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
    <div className="py-4 w-full max-w-3xl mx-auto">
      <h2 className="text-base font-normal mb-4">Image Matching (beta)</h2>
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

      <button
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800 text-xs"
      >
        Upload File
      </button>

      <div className="mt-4 flex items-center gap-2 text-xs">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Image URL..."
          className="flex-1 border rounded px-2 py-0.5"
        />
        <button
          onClick={async () => {
            const clean = url.trim();
            if (!clean) return;
            setPendingUrls((prev) => [...prev, clean]);
            setUrl("");
          }}
          className="px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800">
          Add
        </button>
      </div>

      {/* Pending basket */}
      {(pendingFiles.length > 0 || pendingUrls.length > 0) && (
        <div className="mt-4 text-xs border rounded p-3 bg-gray-50 w-full max-w-md mx-auto">
          <p className="font-medium mb-2">Pending uploads ({pendingFiles.length + pendingUrls.length})</p>
          <ul className="list-disc list-inside space-y-0.5">
            {pendingFiles.map((f, i) => (
              <li key={`pf-${i}`} className="flex items-center gap-1">
                {f.name}
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  ×
                </button>
              </li>
            ))}
            {pendingUrls.map((u, i) => (
              <li key={`pu-${i}`} className="flex items-center gap-1">
                {u}
                <button
                  onClick={() => setPendingUrls((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {/* Folder selector reused here */}
          <div className="mt-3 flex items-center gap-2">
            <label>Folder:</label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="border rounded px-1 py-0.5"
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
                className="border rounded px-1 py-0.5 flex-1"
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
              className="px-3 py-1.5 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
            >
              Save to Folder
            </button>
          </div>
        </div>
      )}
      {uploaded.length > 0 && (
        <div className="mt-6 text-xs">
          <h3 className="font-semibold mb-2">Stored Images</h3>
          {Object.entries(
            uploaded.reduce((acc, cur) => {
              acc[cur.folder] = acc[cur.folder] ? [...acc[cur.folder], cur.url] : [cur.url];
              return acc;
            }, {} as Record<string, string[]>)
          ).map(([fold, urls]) => (
            <div key={fold} className="mb-3">
              <p className="font-medium text-green-700 mb-0.5 flex items-center justify-between">
                <span>{fold}</span>
                <button
                  onClick={async () => {
                    await fetch("/api/images/delete-folder", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ folder: fold }),
                    });
                    setUploaded((prev) => prev.filter((rec) => rec.folder !== fold));
                  }}
                  className="text-red-500 hover:text-red-700 text-xs"
                  aria-label={`Delete folder ${fold}`}
                >
                  Delete folder
                </button>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-0.5">
                {urls.map((u) => (
                  <li key={u} className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        await fetch("/api/images/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url: u }),
                        });
                        setUploaded((prev) => prev.filter((rec) => rec.url !== u));
                      }}
                      className="text-red-400 hover:text-red-600 text-sm"
                      aria-label="Delete"
                    >
                      ×
                    </button>
                    <a href={u} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 flex-1">
                      {u.split("/").pop()}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {/* original folder selector removed because handled in pending section */}
    </div>
  );
}
