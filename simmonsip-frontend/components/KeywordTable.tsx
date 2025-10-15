"use client";
import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { showToast } from "./Toast";

interface Row {
  keyword: string;
  patent: string;
}

export default function KeywordTable({ filter = "" }: { filter?: string }) {
  const API = process.env.NEXT_PUBLIC_API_BASE || "";
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [sortColumn, setSortColumn] = useState<"keyword" | "patent">("keyword");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loaded, setLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // load from API; auto-restore if empty or on failure
  useEffect(() => {
    (async () => {
      try {
        const data: Row[] = await fetch(`${API}/api/keywords`).then((r) => r.json());
        const sorted = data.sort((a, b) =>
          a.keyword.toLowerCase().localeCompare(b.keyword.toLowerCase())
        );
        if (sorted.length === 0) {
          await restore();
          setLoaded(true);
        } else {
          setRows(sorted);
          setLoaded(true);
        }
      } catch {
        await restore();
        setLoaded(true);
      }
    })();
  }, [API]);

  // save to API
  const persist = async (data: Row[]) => {
    try {
      await fetch(`${API}/api/keywords`, {
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

  // Mark as having unsaved changes when rows change (but don't auto-save)
  useEffect(() => {
    if (loaded) {
      setHasUnsavedChanges(true);
    }
  }, [rows, loaded]);

  const restore = async () => {
    const csv = await fetch("/patent_keywords.csv").then((r) => r.text());
    const { data } = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true });
    const sorted = (data as Row[]).sort((a, b) =>
      a.keyword.toLowerCase().localeCompare(b.keyword.toLowerCase())
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

  const addRow = () => {
    setRows((r) => [{ keyword: "", patent: "" }, ...r]);
    setEditing(0);
  };
  const deleteRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const handleSort = (column: "keyword" | "patent") => {
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

  let visibleRows = rows
    .map((r, originalIdx) => ({ ...r, originalIdx }))
    .filter((r) => norm(r.keyword).includes(norm(filter)));

  // Apply sorting
  const sortedRows = [...visibleRows].sort((a, b) => {
    const aVal = sortColumn === "keyword" ? a.keyword : a.patent;
    const bVal = sortColumn === "keyword" ? b.keyword : b.patent;
    const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const displayRows = editing !== null ? visibleRows : sortedRows;

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
              onClick={() => handleSort("keyword")}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Keyword
                {sortColumn === "keyword" && (
                  <span className="text-green-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </div>
            </th>
            <th
              className="px-4 py-3 text-left cursor-pointer hover:bg-gray-50 select-none transition-colors"
              onClick={() => handleSort("patent")}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Patent
                {sortColumn === "patent" && (
                  <span className="text-green-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </div>
            </th>
            <th className="px-4 py-3 w-32"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {displayRows.map((row) => (
            <tr key={row.originalIdx} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                {editing === row.originalIdx ? (
                  <input
                    value={row.keyword}
                    onChange={(e) => updateCell(row.originalIdx, "keyword", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Keyword phrase"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-gray-900">{row.keyword}</span>
                    <button
                      onClick={() => copyToClipboard(row.keyword)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Copy keyword"
                    >
                      📋
                    </button>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {editing === row.originalIdx ? (
                  <input
                    value={row.patent}
                    onChange={(e) => updateCell(row.originalIdx, "patent", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Patent number"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-gray-700">{row.patent}</span>
                    <button
                      onClick={() => copyToClipboard(row.patent)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Copy patent"
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
