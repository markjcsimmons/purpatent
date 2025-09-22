"use client";
import CompetitorTable from "@/components/CompetitorTable";
import { useState } from "react";

export default function CompetitorsPage() {
  const [filter, setFilter] = useState("");

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-base font-normal mr-auto">Competitor List</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          className="border rounded px-2 py-0.5 text-xs"
        />
        <button
          onClick={() => {
            document.dispatchEvent(new Event("competitors:add-row-button"));
          }}
          className="px-3 py-1 rounded bg-brand text-white hover:opacity-90 text-xs"
        >
          + Add Row
        </button>
      </div>
      <CompetitorTable filter={filter} />
    </div>
  );
}
