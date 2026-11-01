"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function DownloadArchive({
  endpoint,
  ids,
  status,
  children,
  disabled = false,
}: {
  endpoint: string;
  ids?: string[];
  status?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status, check: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Nie udało się przygotować pobierania.");
      }
      // Let the browser stream the archive to disk, without a multi-GB Blob in memory.
      form.current?.submit();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Sprawdź połączenie i spróbuj ponownie.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="download-archive">
      <form ref={form} action={endpoint} method="POST" target="_blank">
        {ids && <input type="hidden" name="ids" value={JSON.stringify(ids)} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button
          type="button"
          className="btn-primary"
          disabled={disabled || busy}
          onClick={prepare}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          {busy ? "Przygotowywanie..." : children}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 max-w-sm text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
