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
    if (saved) {
      const savedResults = JSON.parse(saved) as Result[];
      setResults(savedResults);
      // Collapse all groups by default
      const allKeys = new Set(
        savedResults.map((r) => groupBy === "company" ? r.company : r.keyword)
      );
      setCollapsedCompanies(allKeys);
    }
  }, []);

  // When results or groupBy changes, collapse all groups
  useEffect(() => {
    if (results.length > 0) {
      const allKeys = new Set(
        results.map((r) => groupBy === "company" ? r.company : r.keyword)
      );
      setCollapsedCompanies(allKeys);
    }
  }, [results, groupBy]);

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

  const expandAll = () => {
    setCollapsedCompanies(new Set());
  };

  const collapseAll = () => {
    const allKeys = new Set(
      results.map((r) => groupBy === "company" ? r.company : r.keyword)
    );
    setCollapsedCompanies(allKeys);
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
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Competitive Trawl</h1>
        <p className="text-sm text-gray-600">
          Scan all competitors for patent keyword violations across their websites
        </p>
      </div>

      {/* Controls Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={runTrawl}
          disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <span className="animate-spin text-lg">⟳</span>
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
                className="px-4 py-3 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                📥 Export CSV
              </button>
              
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as "company" | "keyword")}
                className="px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="company">Group by Company</option>
                <option value="keyword">Group by Keyword</option>
              </select>

              <button
                onClick={collapsedCompanies.size > 0 ? expandAll : collapseAll}
                className="px-4 py-3 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                {collapsedCompanies.size > 0 ? "▼ Expand All" : "▲ Collapse All"}
        </button>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {loading && progress.total > 0 && (
          <div className="mt-4 w-full">
            <div className="text-sm text-gray-700 mb-2 font-medium">
              Processing {progress.current}/{progress.total} competitors...
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {results.length > 0 && !loading && (
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.totalMatches}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wide font-medium mt-1">Total Matches</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.uniqueCompanies}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wide font-medium mt-1">Companies</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.uniqueKeywords}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wide font-medium mt-1">Keywords</div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Results Yet</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Click "Start Trawl" to scan all {stats.uniqueCompanies || 44} competitors for patent keyword violations
          </p>
        </div>
      )}

      {/* Grouped Results */}
      {results.length > 0 && (
        <div className="w-full">
          {sortedGroups.map(([groupKey, groupResults]) => {
            const isCollapsed = collapsedCompanies.has(groupKey);
            return (
              <div key={groupKey} className="mb-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleCompany(groupKey)}
                  className="w-full px-6 py-4 hover:bg-gray-50 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 font-bold">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="font-semibold text-base text-gray-900">{groupKey}</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                      {groupResults.length} match{groupResults.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                </button>

                {/* Group Content */}
                {!isCollapsed && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {groupBy === "company" ? (
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide w-1/3">
                              Keyword
                            </th>
                          ) : (
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide w-1/4">
                              Company
                            </th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Context
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide w-24">
                            Link
                          </th>
              </tr>
            </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupResults.map((result, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">
                                {groupBy === "company" ? result.keyword : result.company}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {result.context && (
                                <div className="text-xs text-gray-600 line-clamp-2">
                                  {result.context}
                                </div>
                    )}
                  </td>
                            <td className="px-6 py-4">
                    <a
                                href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                    >
                                View →
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
