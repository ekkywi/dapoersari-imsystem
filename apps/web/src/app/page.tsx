import Link from "next/link";
import { LiveDate, LiveTime } from "@/components/ui/LiveClock";
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
      <section className="entry-hero" aria-label="Beranda">
        <div className="entry-hero-media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="entry-hero-photo"
            src="/hero-kitchen.png"
            alt=""
          />
          <div className="entry-hero-scrim" />
        </div>

        <div className="entry-hero-top">
          <p className="entry-kicker">Inventaris rumah makan</p>
          <ThemeToggle className="btn-on-dark" />
        </div>

        <div className="entry-hero-copy">
          <h1 className="entry-title">Dapoer Sari</h1>
          <hr className="entry-rule" />
          <p className="entry-headline">Catat stok gudang dan dapur.</p>
          <p className="entry-desc">
            Penerimaan, transfer, pemakaian shift, dan opname.
          </p>
          <Link href="/login" className="btn btn-hero">
            Masuk
          </Link>
        </div>
      </section>

      <section className="entry-strip" aria-label="Ringkasan">
        <p className="section-label entry-strip-label">Ringkasan</p>
        <div className="entry-strip-grid">
          <article className="entry-metric">
            <p className="stat-label">Layanan</p>
            <p className="stat-value entry-metric-value">
              <span
                className={
                  layananAktif ? "entry-dot is-ok" : "entry-dot is-off"
                }
                aria-hidden
              />
              {layananAktif ? "Aktif" : "Nonaktif"}
            </p>
            <p className="stat-hint">
              {layananAktif ? "API dapat dihubungi" : "API belum terhubung"}
            </p>
          </article>
          <article className="entry-metric">
            <p className="stat-label">Jam</p>
            <LiveTime className="entry-metric-value" />
            <p className="stat-hint">Waktu lokal perangkat</p>
          </article>
          <article className="entry-metric">
            <p className="stat-label">Tanggal</p>
            <LiveDate className="entry-metric-value" />
            <p className="stat-hint">Kalender operasional</p>
          </article>
        </div>
      </section>
    </main>
  );
}
