"use client";

import React, { useEffect, useState, useCallback } from "react";
import { saveSettings, loadSettings } from "@/lib/storage";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = loadSettings();
    if (stored) {
      if (stored.theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return stored.theme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      saveSettings({
        theme: next,
        gridEnabled: true,
      });
      return next;
    });
  }, []);

  return (
    <button
      className="toolbar-btn"
      title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <span className="tooltip">
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </span>
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM6 3.07A5 5 0 1012.93 10 5 5 0 016 3.07z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="3.05" y1="12.95" x2="4.46" y2="11.54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="11.54" y1="4.46" x2="12.95" y2="3.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
