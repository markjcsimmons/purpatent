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
    <div className="mt-8 w-full max-w-3xl mx-auto overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800 text-xs font-bold uppercase"
          >
            + ADD ROW
          </button>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`px-3 py-1 rounded text-xs font-bold ${
              hasUnsavedChanges
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            💾 SAVE
          </button>
        </div>
        <button
          onClick={restore}
          className="border border-green-700 text-green-700 bg-transparent px-2 py-1 rounded text-xs hover:bg-green-50"
        >
          Restore
        </button>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th
              className="border border-gray-200 px-2 py-1 text-left cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => handleSort("keyword")}
            >
              <div className="flex items-center gap-1">
                Keyword
                {sortColumn === "keyword" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
              </div>
            </th>
            <th
              className="border border-gray-200 px-2 py-1 text-left cursor-pointer hover:bg-gray-200 select-none"
              onClick={() => handleSort("patent")}
            >
              <div className="flex items-center gap-1">
                Patent
                {sortColumn === "patent" && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
              </div>
            </th>
            <th className="px-2 py-1 border-y border-r border-gray-200 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => (
            <tr key={row.originalIdx} className="hover:bg-gray-50">
              <td className="border px-1 py-0.5">
                {editing === row.originalIdx ? (
                  <input
                    value={row.keyword}
                    onChange={(e) => updateCell(row.originalIdx, "keyword", e.target.value)}
                    className="w-full border rounded px-1"
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="flex-1">{row.keyword}</span>
                    <button
                      onClick={() => copyToClipboard(row.keyword)}
                      className="text-gray-500 hover:text-gray-700 px-1"
                      title="Copy keyword"
                    >
                      📋
                    </button>
                  </div>
                )}
              </td>
              <td className="border px-1 py-0.5">
                {editing === row.originalIdx ? (
                  <input
                    value={row.patent}
                    onChange={(e) => updateCell(row.originalIdx, "patent", e.target.value)}
                    className="w-full border rounded px-1"
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="flex-1">{row.patent}</span>
                    <button
                      onClick={() => copyToClipboard(row.patent)}
                      className="text-gray-500 hover:text-gray-700 px-1"
                      title="Copy patent"
                    >
                      📋
                    </button>
                  </div>
                )}
              </td>
              <td className="px-2 py-0 text-center whitespace-nowrap text-xs flex items-center justify-center gap-2 border-y border-r border-gray-200">
                <button
                  onClick={() => setEditing(editing === row.originalIdx ? null : row.originalIdx)}
                  className="text-black hover:underline"
                >
                  {editing === row.originalIdx ? "Done" : "Edit"}
                </button>
                <button
                  onClick={() => deleteRow(row.originalIdx)}
                  className="text-red-400 hover:text-red-600 hover:font-bold text-base"
                  aria-label="Delete row"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
