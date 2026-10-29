import Link from "next/link";
import { LiveClock, LiveTime } from "@/components/ui/LiveClock";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { apiGet } from "@/lib/api";

type HealthPayload = {
  status: string;
};

export default async function HomePage() {
  let layananAktif = false;
  try {
    const health = await apiGet<HealthPayload>("/health");
    layananAktif = health.status === "ok";
  } catch {
    layananAktif = false;
  }

  return (
    <main className="entry">
      <div className="entry-theme">
        <ThemeToggle />
      </div>

      <div className="entry-wrap">
        <div className="entry-shell">
          <div className="entry-copy">
            <p className="entry-kicker">Sistem inventaris</p>
            <h1 className="entry-title">Dapoer Sari</h1>
            <hr className="entry-rule" />
            <p className="entry-desc">Sistem manajemen inventaris</p>
            <LiveClock />
          </div>

          <div className="entry-card">
            <p className="entry-card-title">Akses</p>
            <p className="entry-card-desc">Masuk dengan akun staf Anda.</p>
            <Link href="/login" className="btn btn-primary btn-block">
              Masuk
            </Link>
          </div>
        </div>

        <section className="entry-stats" aria-label="Ringkasan">
          <div className="entry-stats-head">
            <p className="section-label">Ringkasan</p>
          </div>
          <div className="entry-stats-grid">
            <article className="stat-card">
              <p className="stat-label">Layanan</p>
              <p className="stat-value">{layananAktif ? "Aktif" : "Nonaktif"}</p>
              <p className="stat-hint">
                {layananAktif ? "API dapat dihubungi" : "API belum terhubung"}
              </p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Jam</p>
              <LiveTime />
              <p className="stat-hint">Waktu lokal perangkat</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Akses data</p>
              <p className="stat-value">Terbatas</p>
              <p className="stat-hint">Stok &amp; laporan setelah masuk</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
