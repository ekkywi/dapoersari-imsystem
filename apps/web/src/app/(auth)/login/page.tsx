"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { NowDate, NowTime } from "@/components/ui/LiveClock";
import { LocationShape } from "@/components/ui/LocationTag";
import { PasswordField } from "@/components/ui/PasswordField";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { apiGet, apiPost } from "@/lib/api";
import { type AuthUser, getToken, saveSession } from "@/lib/auth";

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
  return "Gagal masuk";
}

/** What the person can do next, per error: a wrong password and a dead server need different advice. */
function saranLogin(pesan: string): string {
  switch (pesan) {
    case "Email atau kata sandi salah":
      return "Periksa ejaan email dan kata sandi. Lupa sandi? Minta Super Admin mengatur ulang.";
    case "Akun tidak aktif":
      return "Akun ini sudah dinonaktifkan. Hubungi Super Admin kalau seharusnya masih bisa masuk.";
    case "Tidak dapat menghubungi layanan":
    case "Layanan tidak merespons":
      return "Periksa koneksi internet Anda, lalu coba lagi. Status layanan ada di panel kiri.";
    default:
      return "Coba lagi sebentar lagi. Kalau terus gagal, hubungi Super Admin.";
  }
}

type Health = "checking" | "up" | "down";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    if (getToken()) {
      router.replace("/app");
    }
  }, [router]);

  // The service check moved here from the old landing page.
  useEffect(() => {
    let alive = true;
    apiGet<{ status: string }>("/health")
      .then((h) => alive && setHealth(h.status === "ok" ? "up" : "down"))
      .catch(() => alive && setHealth("down"));
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<LoginResult>("/api/v1/auth/login", {
        email: email.trim(),
        password,
      });
      saveSession(data.token, data.user);
      router.replace("/app");
    } catch (err) {
      setError(pesanLogin(err instanceof Error ? err.message : "Gagal masuk"));
      setLoading(false);
    }
  }

  return (
<<<<<<< HEAD
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
=======
    <main className="ds-login">
      <section className="ds-login-aside" aria-label="Tentang sistem">
        <div className="ds-login-brand">
          <span className="ds-login-mark" aria-hidden="true">
            DS
          </span>
          <span className="ds-login-name">Dapoer Sari</span>
        </div>

        <div className="ds-login-pitch">
          <h1 className="ds-login-headline">Satu catatan stok untuk gudang dan dapur.</h1>
          <div className="ds-login-legend">
            <span>
              <LocationShape location="warehouse" className="on-dark" />
              Gudang: terima, setujui, kirim
            </span>
            <span>
              <LocationShape location="kitchen" className="on-dark" />
              Dapur: minta, terima, tutup shift
            </span>
          </div>
        </div>

        <dl className="ds-login-facts">
          <div>
            <dt>Layanan</dt>
            <dd>
              <span
                className={`ds-login-dot is-${health}`}
                aria-hidden="true"
              />
              {health === "checking" ? "Memeriksa…" : health === "up" ? "Aktif" : "Nonaktif"}
            </dd>
          </div>
          <div>
            <dt>Hari ini</dt>
            <dd>
              <NowDate />
            </dd>
          </div>
          <div>
            <dt>Jam</dt>
            <dd>
              <NowTime className="ds-num" />
            </dd>
          </div>
        </dl>
      </section>

      <section className="ds-login-main" aria-labelledby="login-title">
        <div className="ds-login-theme">
          <ThemeToggle />
        </div>
        {/* method="post": if the form is submitted before the script is ready, the browser must not
            put the password into the URL the way a GET would. */}
        <form className="ds-login-form" method="post" onSubmit={onSubmit}>
          <div className="ds-login-intro">
            <h2 id="login-title" className="ds-login-title">
              Masuk
            </h2>
            <p className="ds-login-lede">Pakai akun staf yang diberikan Super Admin.</p>
          </div>

          <label className="ds-field">
            Email
            <input
              className="ds-input ds-input-lg"
              type="email"
              autoComplete="username"
              placeholder="nama@dapoersari.local"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="ds-field">
            Kata sandi
            <PasswordField
              size="lg"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </label>

          {error ? (
            <InlineAlert role="alert" title={error}>
              {saranLogin(error)}
            </InlineAlert>
          ) : null}

          <Button type="submit" block size="md" className="ds-btn-lg" disabled={loading}>
            {loading ? "Memproses…" : "Masuk"}
          </Button>

          <p className="ds-login-note">
            Lupa kata sandi? Minta Super Admin mengatur ulang dari menu Pengguna.
          </p>
        </form>
>>>>>>> origin/feat/web-redesign
      </section>
    </main>
  );
}
