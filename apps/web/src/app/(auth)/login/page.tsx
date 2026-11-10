"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { apiPost } from "@/lib/api";
import { AuthUser, getToken, saveSession } from "@/lib/auth";

type LoginResult = {
  token: string;
  user: AuthUser;
};

function pesanLogin(raw: string): string {
  const key = raw.toLowerCase();
  if (
    key.includes("email atau kata sandi") ||
    key.includes("invalid email") ||
    key.includes("invalid credentials")
  ) {
    return "Email atau kata sandi salah";
  }
  if (key.includes("tidak aktif") || key.includes("inactive")) {
    return "Akun tidak aktif";
  }
  if (
    key.includes("terlalu banyak") ||
    key.includes("too many") ||
    key.includes("rate")
  ) {
    return "Terlalu banyak percobaan masuk; coba lagi nanti";
  }
  if (key.includes("failed to fetch") || key.includes("network")) {
    return "Tidak dapat menghubungi layanan";
  }
  if (key.startsWith("api ")) {
    return "Layanan tidak merespons";
  }
  if (key.includes("gagal masuk") || raw === "Gagal masuk") {
    return "Gagal masuk";
  }
  return "Gagal masuk";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@dapoersari.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace("/app");
    }
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<LoginResult>("/api/v1/auth/login", {
        email,
        password,
      });
      saveSession(data.token, data.user);
      router.replace("/app");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Gagal masuk";
      setError(pesanLogin(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <aside className="login-brand-panel" aria-hidden={false}>
        <div className="login-brand-media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="login-brand-photo"
            src="/hero-kitchen.png"
            alt=""
          />
          <div className="login-brand-scrim" />
        </div>
        <div className="login-brand-copy">
          <h1 className="login-brand">Dapoer Sari</h1>
          <hr className="login-brand-rule" />
          <p className="login-lede">Catat stok gudang dan dapur.</p>
        </div>
      </aside>

      <section className="login-form-panel">
        <div className="login-form-top">
          <p className="login-kicker">Inventaris rumah makan</p>
          <ThemeToggle />
        </div>

        <div className="login-form-wrap">
          <header className="login-form-head">
            <h2 className="login-form-title">Masuk</h2>
            <p className="login-card-desc">Masuk dengan akun staf Anda.</p>
          </header>

          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">Kata sandi</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Memproses…" : "Masuk"}
            </button>
          </form>
        </div>

        <p className="login-back">
          <Link href="/">Kembali ke beranda</Link>
        </p>
      </section>
    </main>
  );
}
