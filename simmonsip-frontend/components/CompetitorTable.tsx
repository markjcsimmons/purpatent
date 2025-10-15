"use client";
import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { showToast } from "./Toast";

interface Row {
  name: string;
  URL: string;
}

export default function CompetitorTable({ filter = "" }: { filter?: string }) {
  const API = process.env.NEXT_PUBLIC_API_BASE || "";
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sortColumn, setSortColumn] = useState<"name" | "URL" | null>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // initial load from API, auto-restore if empty
  useEffect(() => {
    (async () => {
      try {
        const data: Row[] = await fetch(`${API}/api/competitors`).then((r) => r.json());
        const sorted = data.sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
        if (sorted.length === 0) {
          await restore();
          setLoaded(true);
        } else {
          setRows(sorted);
          setLoaded(true);
        }
      } catch {
        // if API fails, attempt restore from CSV to seed
        await restore();
        setLoaded(true);
      }
    })();
  }, [API]);

  const persist = async (data: Row[]) => {
    try {
      await fetch(`${API}/api/competitors`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      });
      setHasUnsavedChanges(false);
      showToast("Changes saved successfully", "success");
    } catch {
      showToast("Failed to save changes", "error");
    }
  };

  const handleSave = () => {
    if (editing !== null) {
      setEditing(null);
    }
    persist(rows);
  };

  useEffect(() => {
    // Mark as having unsaved changes when rows change (but don't auto-save)
    if (loaded) {
      setHasUnsavedChanges(true);
    }
  }, [rows, loaded]);

  const restore = async () => {
    const csv = await fetch("/competitors.csv").then((r) => r.text());
    const { data } = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true });
    const sorted = (data as Row[]).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    setRows(sorted);
    setEditing(null);
    persist(sorted);
  };

  const updateCell = (idx: number, field: keyof Row, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value } as Row;
      return next;
    });
  };

  const addRow = () =>
    setRows((prev) => {
      const next = [{ name: "", URL: "" }, ...prev];
      setEditing(0);
      return next;
    });
  const deleteRow = (idx: number) =>
    setRows((r) => r.filter((_, i) => i !== idx));

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const handleSort = (column: "name" | "URL") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied to clipboard", "success");
    });
  };

  const getUrlDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  let visibleRows = rows
    .map((r, originalIdx) => ({ ...r, originalIdx }))
    .filter((r) => norm(r.name).includes(norm(filter)));

  // Apply sorting
  if (sortColumn) {
    visibleRows = visibleRows.sort((a, b) => {
      const aVal = sortColumn === "name" ? a.name : a.URL;
      const bVal = sortColumn === "name" ? b.name : b.URL;
      const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }

  useEffect(() => {
    const handler = () => addRow();
    document.addEventListener("competitors:add-row-button", handler);
    return () => document.removeEventListener("competitors:add-row-button", handler);
  }, []);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-between mb-4 w-full">
        <div className="flex items-center gap-3">
        <button
          onClick={addRow}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium shadow-sm transition-colors"
          >
            + Add Row
          </button>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
              hasUnsavedChanges
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            💾 Save Changes
        </button>
        </div>
        <button
          onClick={restore}
          className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Restore from CSV
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th
              className="px-4 py-3 text-left cursor-pointer hover:bg-gray-50 select-none transition-colors"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Name
                {sortColumn === "name" && (
                  <span className="text-green-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </div>
            </th>
            <th
              className="px-4 py-3 text-left cursor-pointer hover:bg-gray-50 select-none transition-colors"
              onClick={() => handleSort("URL")}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                URL
                {sortColumn === "URL" && (
                  <span className="text-green-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </div>
            </th>
            <th className="px-4 py-3 w-32"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visibleRows.map((row) => (
            <tr key={row.originalIdx} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                {editing === row.originalIdx ? (
                  <input
                    value={row.name}
                    onChange={(e) => updateCell(row.originalIdx, "name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Company name"
                  />
                ) : (
                  <span className="text-gray-900 font-medium">
                    {row.name.replace(/\s*\(.*?\)\s*/g, "")}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {editing === row.originalIdx ? (
                  <input
                    value={row.URL}
                    onChange={(e) => updateCell(row.originalIdx, "URL", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="https://example.com"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <a
                      href={row.URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex-1 truncate transition-colors"
                      title={row.URL}
                    >
                      {getUrlDomain(row.URL)}
                    </a>
                    <button
                      onClick={() => copyToClipboard(row.URL)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Copy URL"
                    >
                      📋
                    </button>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setEditing(editing === row.originalIdx ? null : row.originalIdx)}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
                  >
                    {editing === row.originalIdx ? "Done" : "Edit"}
                  </button>
                  <button
                    onClick={() => deleteRow(row.originalIdx)}
                    className="text-red-500 hover:text-red-700 text-lg leading-none transition-colors"
                    aria-label="Delete row"
                  >
                    ×
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
