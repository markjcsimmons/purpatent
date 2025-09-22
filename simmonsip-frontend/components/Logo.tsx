"use client";
import React, { useEffect, useState } from "react";

export default function Logo() {
  const fullText = "PürPatent";
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setDisplayed(fullText.slice(0, idx));
      if (idx === fullText.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1
      className="text-xl font-mono font-medium text-center select-none"
      style={{ color: "#000000" }}
    >
      {displayed}
    </h1>
  );
}
