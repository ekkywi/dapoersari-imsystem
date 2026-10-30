"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toastError } from "@/lib/toast";
import { StockInDetail, warehouseApi } from "@/lib/warehouse";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export default function StockInDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [doc, setDoc] = useState<StockInDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setDoc(await warehouseApi.getStockIn(id));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat dokumen");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="si-page">
        <p className="muted">Memuat…</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="si-page">
        <p className="error">Persediaan masuk tidak ditemukan</p>
        <Link className="btn btn-ghost" href="/app/warehouse/stock-ins">
          Kembali
        </Link>
      </div>
    );
  }

  const expiredLabel = doc.expired_at
    ? new Date(doc.expired_at).toLocaleDateString("id-ID")
    : "—";

  return (
    <div className="si-page">
      <header className="si-page-header no-print">
        <div className="page-header-text">
          <p className="section-label">Transaksi gudang</p>
          <h1 className="page-title">Dokumen persediaan masuk</h1>
          <p className="lede">No. {shortId(doc.id)}</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" href="/app/warehouse/stock-ins">
            Kembali
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.print()}
          >
            Cetak
          </button>
        </div>
      </header>

      <article className="si-doc" id="stock-in-print">
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara persediaan masuk</h2>

        <dl className="si-doc-meta-grid">
          <div className="si-doc-meta-row">
            <dt>Nomor</dt>
            <dd>{shortId(doc.id)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Waktu</dt>
            <dd>{formatDateTime(doc.created_at)}</dd>
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
          Pada tanggal {formatDateTime(doc.created_at)} telah dicatat
          penerimaan barang masuk ke gudang dengan rincian sebagaimana
          tercantum dalam berita acara ini.
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
                <td>{doc.qty}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="si-doc-closing">
          Status: tercatat. Saldo gudang sudah bertambah sesuai rincian di atas.
          Demikian berita acara ini dibuat untuk dipergunakan sebagaimana
          mestinya.
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
