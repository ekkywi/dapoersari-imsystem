"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatClock, formatDay, formatExpiry, formatFullStamp } from "@/lib/datetime";
import { docNo, formatQty } from "@/lib/format";
import { type StockInDetail, warehouseApi } from "@/lib/warehouse";

function StockInDetailContent() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const wantsPrint = searchParams.get("print") === "1";

  const [doc, setDoc] = useState<StockInDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const printed = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setDoc(await warehouseApi.getStockIn(id));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat dokumen");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // "Simpan & cetak berita acara" lands here with ?print=1: print once, then drop the flag so a
  // reload does not open the print dialog again. No cleanup on purpose: dropping the flag re-runs
  // this effect, and a cleanup would cancel the print that is still pending.
  useEffect(() => {
    if (!doc || !wantsPrint || printed.current) return;
    printed.current = true;
    window.setTimeout(() => {
      window.print();
      router.replace(pathname);
    }, 350);
  }, [doc, wantsPrint, pathname, router]);

  if (loading) {
    return (
      <div className="ds-screen">
        <p className="ds-card-hint">Memuat dokumen…</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="ds-screen">
        <InlineAlert
          role="alert"
          title="Dokumen persediaan masuk tidak bisa dimuat"
          actions={
            <>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Coba lagi
              </Button>
              <LinkButton size="sm" variant="secondary" href="/app/warehouse/stock-ins">
                Kembali ke daftar
              </LinkButton>
            </>
          }
        >
          {loadError ?? "Dokumen tidak ditemukan"}. Bisa jadi dokumennya tidak ada atau tautannya
          keliru.
        </InlineAlert>
      </div>
    );
  }

  const number = docNo("SIN", doc.id);
  const expiredLabel = doc.expired_at ? formatExpiry(doc.expired_at) : "—";

  return (
    <div className="ds-screen">
      <div className="no-print">
        <PageHeader
          align="start"
          mono
          compactLede
          kicker={<LocationTag location="warehouse" label="Persediaan masuk" />}
          title={number}
          lede={
            <>
              Dicatat {formatDay(doc.created_at)}{" "}
              <span className="ds-num">{formatClock(doc.created_at)}</span> ·{" "}
              <strong className="ds-medium">{doc.item_name}</strong>{" "}
              <span className="ds-num">{formatQty(doc.qty, doc.unit_code)}</span>
            </>
          }
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              Cetak berita acara
            </Button>
          }
        />
      </div>

      <article className="si-doc" id="stock-in-print">
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara persediaan masuk</h2>

        <dl className="si-doc-meta-grid">
          <div className="si-doc-meta-row">
            <dt>Nomor</dt>
            <dd>{number}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Waktu</dt>
            <dd>{formatFullStamp(doc.created_at)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Pemasok</dt>
            <dd>{doc.supplier_name || "—"}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>ED</dt>
            <dd>{expiredLabel}</dd>
          </div>
        </dl>

        <p className="si-doc-lead">
          Pada tanggal {formatFullStamp(doc.created_at)} telah dicatat penerimaan barang masuk ke
          gudang dengan rincian sebagaimana tercantum dalam berita acara ini.
        </p>

        {doc.note ? (
          <p className="si-doc-note">
            <strong>Catatan:</strong> {doc.note}
          </p>
        ) : null}

        <h3 className="si-doc-section-title">Rincian barang</h3>
        <div className="data-table-wrap si-doc-table">
          <table className="data-table">
            <thead>
              <tr>
                <th className="si-doc-col-num">No</th>
                <th>SKU</th>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="si-doc-col-num">1</td>
                <td>
                  <strong>{doc.item_sku}</strong>
                </td>
                <td>{doc.item_name}</td>
                <td>{doc.category_name || "—"}</td>
                <td>{doc.unit_code}</td>
                <td>{formatQty(doc.qty)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="si-doc-closing">
          Status: tercatat. Saldo gudang sudah bertambah sesuai rincian di atas. Demikian berita
          acara ini dibuat untuk dipergunakan sebagaimana mestinya.
        </p>

        <footer className="si-doc-foot">
          <div className="si-doc-signs">
            <div>
              <p className="si-doc-sign-label">Petugas gudang</p>
              <p className="si-doc-sign-line">________________</p>
              <p className="si-doc-sign-caption">Nama &amp; tanda tangan</p>
            </div>
            <div>
              <p className="si-doc-sign-label">Mengetahui</p>
              <p className="si-doc-sign-line">________________</p>
              <p className="si-doc-sign-caption">Nama &amp; tanda tangan</p>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

export default function StockInDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <StockInDetailContent />
    </Suspense>
  );
}
