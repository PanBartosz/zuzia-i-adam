"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { coupleName } from "@/lib/wedding";

export default function GuestAccess() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/guest/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Nie udało się otworzyć albumu.");
        return;
      }

      window.location.assign(body.url);
    } catch {
      setError("Nie udało się połączyć. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="boho-bg grid min-h-screen place-items-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="paper-surface w-full max-w-sm rounded-[8px] border border-[var(--line)] p-6 shadow-[0_24px_70px_rgba(52,38,29,0.18)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#4e5d3e] text-white">
            <LockKeyhole size={22} />
          </span>
          <div>
            <h1 className="font-serif text-3xl leading-none">{coupleName}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Prywatny album weselny</p>
          </div>
        </div>

        <p className="mb-5 text-sm text-[var(--muted)]">
          Wpisz kod dostępu otrzymany od organizatorów lub otwórz album kodem QR.
        </p>

        <label className="mb-5 block">
          <span className="text-sm font-bold">Kod lub hasło dostępu</span>
          <input
            className="focus-ring mt-1 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white/80 px-3"
            type="password"
            name="code"
            value={code}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={256}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>

        {error ? (
          <p role="alert" className="mb-4 rounded-[8px] border border-[#8d3e2f]/20 bg-[#8d3e2f]/10 px-3 py-2 text-sm font-semibold text-[#7a3529]">
            {error}
          </p>
        ) : null}

        <button className="btn-primary w-full" disabled={loading}>
          <LogIn size={18} />
          {loading ? "Sprawdzanie..." : "Otwórz album"}
        </button>
      </form>
    </main>
  );
}
