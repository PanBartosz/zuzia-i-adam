"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@zuziaiadam.pl");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Nie udało się zalogować.");
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <main className="boho-bg grid min-h-screen place-items-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="paper-surface w-full max-w-sm rounded-[8px] border border-[var(--line)] p-6 shadow-[0_24px_70px_rgba(52,38,29,0.18)]"
      >
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-[#4e5d3e] text-white">
            <LockKeyhole size={22} />
          </span>
          <div>
            <h1 className="font-serif text-3xl leading-none">Panel admina</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Zuzia & Adam</p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="text-sm font-bold">E-mail</span>
          <input
            className="focus-ring mt-1 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white/80 px-3"
            value={email}
            autoComplete="username"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="mb-5 block">
          <span className="text-sm font-bold">Hasło</span>
          <input
            className="focus-ring mt-1 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white/80 px-3"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? (
          <p className="mb-4 rounded-[8px] border border-[#8d3e2f]/20 bg-[#8d3e2f]/10 px-3 py-2 text-sm font-semibold text-[#7a3529]">
            {error}
          </p>
        ) : null}

        <button className="btn-primary w-full" disabled={loading}>
          <LogIn size={18} />
          {loading ? "Logowanie..." : "Zaloguj"}
        </button>
      </form>
    </main>
  );
}
