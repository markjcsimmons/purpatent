"use client";
import React, { useEffect, useState } from "react";
import Papa from "papaparse";

interface Row {
  name: string;
  URL: string;
}

export default function CompetitorTable({ filter = "" }: { filter?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // initial load from API
  useEffect(() => {
    fetch("/api/competitors")
      .then((r) => r.json())
      .then((data: Row[]) => {
        const sorted = data.sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
        setRows(sorted);
        setLoaded(true);
      });
  }, []);

  const persist = (data: Row[]) => {
    fetch("/api/competitors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  };

  useEffect(() => {
    if (loaded && editing === null) {
      persist(rows);
    }
  }, [rows, editing, loaded]);

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

  const visibleRows = rows.filter((r) =>
    norm(r.name).includes(norm(filter))
  );

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
          {visibleRows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border px-1 py-0.5">
                {editing === idx ? (
                  <input
                    value={row.name}
                    onChange={(e) => updateCell(idx, "name", e.target.value)}
                    className="w-full border rounded px-1"
                  />
                ) : (
                  row.name.replace(/\s*\(.*?\)\s*/g, "")
                )}
              </td>
              <td className="border px-1 py-0.5">
                {editing === idx ? (
                  <input
                    value={row.URL}
                    onChange={(e) => updateCell(idx, "URL", e.target.value)}
                    className="w-full border rounded px-1"
                  />
                ) : (
                  <a href={row.URL} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">{row.URL}</a>
                )}
              </td>
              <td className="px-2 py-0 text-center whitespace-nowrap text-xs flex items-center justify-center gap-2 border-y border-r border-gray-200">
                {editing === idx ? (
                  <button
                    onClick={() => setEditing(null)}
                    className="text-green-600 hover:underline"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => setEditing(idx)}
                    className="text-black hover:underline"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => deleteRow(idx)}
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
