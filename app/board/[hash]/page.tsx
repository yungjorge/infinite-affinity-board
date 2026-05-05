"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { decompressBoardFromUrl } from "@/lib/serialize";
import { saveBoard } from "@/lib/storage";

export default function BoardSharePage({
  params,
}: {
  params: { hash: string };
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
  const [errorMessage, setErrorMessage] = useState("");

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

      // Save to localStorage
      saveBoard(board);

      if (mounted) {
        setStatus("loaded");
        // Redirect to main page after a brief delay
        setTimeout(() => {
          router.replace("/");
        }, 1000);
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

  const handleRetry = useCallback(() => {
    router.replace("/");
  }, [router]);

  return (
    <main className="w-full h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center">
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
              onClick={handleRetry}
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
