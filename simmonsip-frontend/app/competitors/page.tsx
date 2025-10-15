"use client";
import CompetitorTable from "@/components/CompetitorTable";
import { useState } from "react";

export default function CompetitorsPage() {
  const [filter, setFilter] = useState("");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Competitors</h1>
        <p className="text-sm text-gray-600">
          Manage your competitor list and monitor their online presence
        </p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search competitors..."
            className="flex-1 max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            onClick={() => {
              document.dispatchEvent(new Event("competitors:add-row-button"));
            }}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium shadow-sm"
          >
            + Add Competitor
          </button>
        </div>
        <CompetitorTable filter={filter} />
      </div>
    </div>
  );
}
