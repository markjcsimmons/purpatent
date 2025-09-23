"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "pp_auth_ok";
const PASSWORD = "Mark32246!";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      setOk(v === "1");
    } catch {
      setOk(false);
    }
  }, []);

  if (ok === null) return null;
  if (ok) return <>{children}</>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-xs border border-gray-200 rounded-md p-4 bg-white/90">
        <h1 className="text-sm font-normal mb-3">Enter password</h1>
        <label className="sr-only" htmlFor="pp-password">Password</label>
        <input
          id="pp-password"
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (input === PASSWORD) {
                localStorage.setItem(STORAGE_KEY, "1");
                setOk(true);
              } else {
                setError("Incorrect password");
              }
            }
          }}
          placeholder="Password"
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
          autoFocus
          autoComplete="current-password"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button
          onClick={() => {
            if (input === PASSWORD) {
              localStorage.setItem(STORAGE_KEY, "1");
              setOk(true);
            } else {
              setError("Incorrect password");
            }
          }}
          className="mt-3 w-full px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-800 text-xs font-bold uppercase"
        >
          Continue
        </button>
      </div>
    </div>
  );
}


