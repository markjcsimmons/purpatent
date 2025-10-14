"use client";
import React, { useEffect, useState } from "react";
import Papa from "papaparse";

interface Row {
  name: string;
  URL: string;
}

export default function CompetitorTable({ filter = "" }: { filter?: string }) {
  const API =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined" && window.location.hostname.endsWith("purpatent.com")
      ? "https://api.purpatent.com"
      : "");
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const persist = (data: Row[]) => {
    fetch(`${API}/api/competitors`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  };

  useEffect(() => {
    if (loaded) {
      persist(rows);
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

  const visibleRows = rows
    .map((r, originalIdx) => ({ ...r, originalIdx }))
    .filter((r) => norm(r.name).includes(norm(filter)));

  useEffect(() => {
    const handler = () => addRow();
    document.addEventListener("competitors:add-row-button", handler);
    return () => document.removeEventListener("competitors:add-row-button", handler);
  }, []);

  return (
    <div className="mt-8 w-full max-w-3xl mx-auto overflow-x-auto">
      <div className="flex items-center justify-between mb-2 w-full">
        <button
          onClick={addRow}
          className="px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800 text-xs font-bold tracking-wide"
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
            <th className="border border-gray-200 px-2 py-1 text-left">Name</th>
            <th className="border border-gray-200 px-2 py-1 text-left">URL</th>
            <th className="px-2 py-1 border-y border-r border-gray-200"></th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.originalIdx} className="hover:bg-gray-50">
              <td className="border px-1 py-0.5">
                {editing === row.originalIdx ? (
                  <input
                    value={row.name}
                    onChange={(e) => updateCell(row.originalIdx, "name", e.target.value)}
                    className="w-full border rounded px-1"
                  />
                ) : (
                  row.name.replace(/\s*\(.*?\)\s*/g, "")
                )}
              </td>
              <td className="border px-1 py-0.5">
                {editing === row.originalIdx ? (
                  <input
                    value={row.URL}
                    onChange={(e) => updateCell(row.originalIdx, "URL", e.target.value)}
                    className="w-full border rounded px-1"
                  />
                ) : (
                  <a href={row.URL} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">{row.URL}</a>
                )}
              </td>
              <td className="px-2 py-0 text-center whitespace-nowrap text-xs flex items-center justify-center gap-2 border-y border-r border-gray-200">
                {editing === row.originalIdx ? (
                  <button
                    onClick={() => setEditing(null)}
                    className="text-green-600 hover:underline"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => setEditing(row.originalIdx)}
                    className="text-black hover:underline"
                  >
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
