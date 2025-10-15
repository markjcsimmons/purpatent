"use client";
import KeywordTable from "@/components/KeywordTable";
import { useState } from "react";

export default function KeywordsPage() {
  const [filter, setFilter] = useState("");
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Patent Keywords</h1>
        <p className="text-sm text-gray-600">
          Manage your patent keyword database for competitive analysis
        </p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search keywords..."
            className="flex-1 max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <KeywordTable filter={filter} />
      </div>
    </div>
  );
}
