"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { decompressBoardFromUrl } from "@/lib/serialize";
import { saveBoard, loadBoard } from "@/lib/storage";
import { BoardState } from "@/lib/boardTypes";

type Status = "loading" | "error" | "confirm" | "loaded";

export default function BoardSharePage({
  params,
}: {
  params: { hash: string };
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [incomingBoard, setIncomingBoard] = useState<BoardState | null>(null);
  const [existingNoteCount, setExistingNoteCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    try {
      const board = decompressBoardFromUrl(params.hash);

      if (!board || !mounted) {
        if (mounted) {
          setStatus("error");
          setErrorMessage("Invalid or corrupted board link");
        }
        return;
      }

      // Check if the user already has a non-empty board
      const existing = loadBoard();
      const hasExisting = existing && (existing.notes.length > 0 || existing.groups.length > 0);

      if (hasExisting && mounted) {
        setIncomingBoard(board);
        setExistingNoteCount(existing.notes.length);
        setStatus("confirm");
        return;
      }

      // No existing board — safe to overwrite
      saveBoard(board);
      if (mounted) {
        setStatus("loaded");
        setTimeout(() => router.replace("/"), 1000);
      }
    } catch {
      if (mounted) {
        setStatus("error");
        setErrorMessage("Could not decode board link");
      }
    }

    return () => {
      mounted = false;
    };
  }, [params.hash, router]);

  const handleReplace = useCallback(() => {
    if (incomingBoard) {
      saveBoard(incomingBoard);
      setStatus("loaded");
      setTimeout(() => router.replace("/"), 800);
    }
  }, [incomingBoard, router]);

  const handleKeepExisting = useCallback(() => {
    router.replace("/");
  }, [router]);

  return (
    <main className="w-full h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center" style={{ maxWidth: 360, padding: "0 20px" }}>

        {status === "loading" && (
          <>
            <div
              className="w-10 h-10 border-3 border-[var(--selection-color)] border-t-transparent rounded-full animate-spin mx-auto mb-4"
              style={{ borderWidth: "3px" }}
            />
            <p className="text-[var(--foreground)] text-lg font-medium">
              Loading board...
            </p>
          </>
        )}

        {status === "confirm" && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
              Replace Your Board?
            </h1>
            <p className="text-[var(--foreground)] mb-6" style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.5 }}>
              You have an existing board with {existingNoteCount} note{existingNoteCount !== 1 ? "s" : ""}.
              Loading this shared board will replace it.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={handleKeepExisting}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid var(--toolbar-border)",
                  background: "var(--toolbar-bg)",
                  color: "var(--foreground)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Keep Mine
              </button>
              <button
                onClick={handleReplace}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Replace
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
              Board Not Found
            </h1>
            <p className="text-[var(--foreground)] opacity-60 mb-6">
              {errorMessage}
            </p>
            <button
              onClick={handleKeepExisting}
              className="px-6 py-2.5 bg-[var(--selection-color)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Go to Board
            </button>
          </>
        )}

        {status === "loaded" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <p className="text-[var(--foreground)] text-lg font-medium">
              Board loaded! Redirecting...
            </p>
          </>
        )}

      </div>
    </main>
  );
}
