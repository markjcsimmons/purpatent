"use client";
import KeywordTable from "@/components/KeywordTable";
import { useState } from "react";

export default function KeywordsPage() {
  const [filter, setFilter] = useState("");
  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-base font-normal mr-auto">Patent Keywords</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          className="border rounded px-2 py-0.5 text-xs"
        />
      </div>
      <KeywordTable filter={filter} />
    </div>
  );
}
