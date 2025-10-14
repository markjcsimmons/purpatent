"use client";
import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

interface Result {
  company: string;
  keyword: string;
  url: string;
  context?: string;
}

interface GroupedResults {
  [company: string]: Result[];
}

export default function Home() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "";
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"company" | "keyword">("company");

  useEffect(() => {
    const saved = localStorage.getItem("pp_trawl_results");
    if (saved) setResults(JSON.parse(saved) as Result[]);
  }, []);

  const exportToCSV = () => {
    const csv = [
      ["Company", "Keyword", "URL", "Context"],
      ...results.map((r) => [r.company, r.keyword, r.url, r.context || ""]),
    ]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trawl-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully", "success");
  };

  const runTrawl = async () => {
    setLoading(true);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    
    try {
      const params = new URLSearchParams();
      params.set("maxSites", "50");
      params.set("concurrency", "3");
      params.set("renderDelayMs", "1500");
      params.set("fetchTimeoutMs", "15000");
      params.set("deadlineMs", "600000");

      const res = await fetch(`${API}/api/trawl?${params.toString()}`);
      const data = await res.json();
      
      if (data.results) {
        setResults(data.results);
        localStorage.setItem("pp_trawl_results", JSON.stringify(data.results));
        showToast(`Found ${data.results.length} matches!`, "success");
      }
      
      if (data.meta) {
        setProgress({ current: data.meta.sitesProcessed, total: data.meta.sitesProcessed });
      }
    } catch (error) {
      showToast("Failed to trawl", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (company: string) => {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(company)) {
        next.delete(company);
      } else {
        next.add(company);
      }
      return next;
    });
  };

  const groupedResults: GroupedResults = results.reduce((acc, result) => {
    const key = groupBy === "company" ? result.company : result.keyword;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {} as GroupedResults);

  const sortedGroups = Object.entries(groupedResults).sort(([a], [b]) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const stats = {
    totalMatches: results.length,
    uniqueCompanies: new Set(results.map((r) => r.company)).size,
    uniqueKeywords: new Set(results.map((r) => r.keyword)).size,
  };

  return (
    <div className="flex flex-col pt-8 w-full">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 items-center">
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={runTrawl}
            disabled={loading}
            className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-sm font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⟳</span>
                Trawling...
              </>
            ) : (
              "Start Trawl"
            )}
          </button>
          
          {results.length > 0 && (
            <>
              <button
                onClick={exportToCSV}
                className="px-3 py-2 border border-green-700 text-green-700 rounded hover:bg-green-50 text-sm"
              >
                Export CSV
              </button>
              
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as "company" | "keyword")}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="company">Group by Company</option>
                <option value="keyword">Group by Keyword</option>
              </select>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {loading && progress.total > 0 && (
          <div className="w-full max-w-md">
            <div className="text-xs text-gray-600 mb-1">
              Processing {progress.current}/{progress.total} competitors...
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {results.length > 0 && !loading && (
          <div className="flex gap-4 text-sm">
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded">
              <strong>{stats.totalMatches}</strong> matches
            </div>
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded">
              <strong>{stats.uniqueCompanies}</strong> companies
            </div>
            <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded">
              <strong>{stats.uniqueKeywords}</strong> keywords
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">No results yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Start Trawl" to find patent keyword matches across competitors
          </p>
        </div>
      )}

      {/* Grouped Results */}
      {results.length > 0 && (
        <div className="mt-8 w-full max-w-5xl mx-auto">
          {sortedGroups.map(([groupKey, groupResults]) => {
            const isCollapsed = collapsedCompanies.has(groupKey);
            return (
              <div key={groupKey} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleCompany(groupKey)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="font-semibold text-sm">{groupKey}</span>
                    <span className="text-xs text-gray-500">
                      ({groupResults.length} match{groupResults.length !== 1 ? "es" : ""})
                    </span>
                  </div>
                </button>

                {/* Group Content */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          {groupBy === "company" ? (
                            <th className="border-b border-gray-200 px-3 py-2 text-left w-1/3">Keyword</th>
                          ) : (
                            <th className="border-b border-gray-200 px-3 py-2 text-left w-1/4">Company</th>
                          )}
                          <th className="border-b border-gray-200 px-3 py-2 text-left">Context</th>
                          <th className="border-b border-gray-200 px-3 py-2 text-left w-32">URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupResults.map((result, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border-b border-gray-100 px-3 py-2">
                              <div className="font-semibold">
                                {groupBy === "company" ? result.keyword : result.company}
                              </div>
                            </td>
                            <td className="border-b border-gray-100 px-3 py-2">
                              {result.context && (
                                <div className="text-[11px] text-gray-600 line-clamp-2">
                                  {result.context}
                                </div>
                              )}
                            </td>
                            <td className="border-b border-gray-100 px-3 py-2">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline text-[11px]"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
