"use client";
import React, { useEffect, useState } from "react";
import Papa from "papaparse";

interface Row {
  keyword: string;
  patent: string;
}

export default function KeywordTable({ filter = "" }: { filter?: string }) {
  const API =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("purpatent.com")
      ? "https://api.purpatent.com"
      : "");
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [loaded, setLoaded] = useState(false);

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
  const persist = (data: Row[]) => {
    fetch(`${API}/api/keywords`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  };

  // whenever rows change after load & not editing
  useEffect(() => {
    if (loaded && editing === null) {
      persist(rows);
    }
  }, [rows, editing, loaded]);

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

  const visibleRows = rows
    .map((r, originalIdx) => ({ ...r, originalIdx }))
    .filter((r) => norm(r.keyword).includes(norm(filter)));

  const sortedRows = [...visibleRows].sort((a, b) =>
    sortOrder === "asc"
      ? a.keyword.toLowerCase().localeCompare(b.keyword.toLowerCase())
      : b.keyword.toLowerCase().localeCompare(a.keyword.toLowerCase())
  );

  const displayRows = editing !== null ? visibleRows : sortedRows;

  return (
    <div className="mt-8 w-full max-w-3xl mx-auto overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={addRow}
          className="px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800 text-xs font-bold uppercase"
        >
          + ADD ROW
        </button>
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
            <th className="border border-gray-200 px-2 py-1 text-left">Keyword</th>
            <th className="border border-gray-200 px-2 py-1 text-left">Patent</th>
            <th className="px-2 py-1 border-y border-r border-gray-200"></th>
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
                  row.keyword
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
                  row.patent
                )}
              </td>
              <td className="px-2 py-0 text-center whitespace-nowrap text-xs flex items-center justify-center gap-2 border-y border-r border-gray-200">
                {editing === row.originalIdx ? (
                  <button onClick={() => setEditing(null)} className="text-green-600 hover:underline">
                    Save
                  </button>
                ) : (
                  <button onClick={() => setEditing(row.originalIdx)} className="text-black hover:underline">
                    Edit
                  </button>
                )}
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
