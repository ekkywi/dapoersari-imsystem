export default function DashboardPage() {
  return (
    <div className="stack stack-loose">
      <header className="page-header">
        <div className="page-header-text">
          <p className="section-label">Operasional</p>
          <h1 className="page-title">Ringkasan</h1>
          <p className="lede">
            Pantau stok gudang dan dapur. Angka di bawah masih placeholder —
            terisi setelah modul stok dan transfer aktif.
          </p>
        </div>
      </header>

      <section>
        <p className="section-label">Status stok (contoh)</p>
        <div className="badge-row badge-row-spaced">
          <span className="badge badge-success">Aman</span>
          <span className="badge badge-warn">Menipis</span>
          <span className="badge badge-danger">Kritis</span>
          <span className="badge badge-neutral">Dalam perjalanan</span>
        </div>
        <div className="stat-grid">
          <article className="stat-card">
            <p className="stat-label">Gudang</p>
            <p className="stat-value">—</p>
            <p className="stat-hint">Item di bawah minimum</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Dapur</p>
            <p className="stat-value">—</p>
            <p className="stat-hint">Item di bawah minimum</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Permintaan</p>
            <p className="stat-value">—</p>
            <p className="stat-hint">Menunggu persetujuan</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Modul berikutnya</h2>
        <p className="muted">
          Master barang, resep/paket, transfer gudang↔dapur, penutupan shift,
          opname, lalu peringatan stok.
        </p>
      </section>
    </div>
  );
}
