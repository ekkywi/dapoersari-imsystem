"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { getUser } from "@/lib/auth";
import {
  parseRequestFocus,
  showOpnameMutate,
} from "@/lib/rbac";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  Opname,
  OpnameLine,
  opnameApi,
  opnameLocationLabel,
  opnameStatusLabel,
} from "@/lib/opname";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function varianceClass(v: number): string {
  if (v > 0) return "doc-variance is-plus";
  if (v < 0) return "doc-variance is-minus";
  return "doc-variance";
}

function OpnameDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [doc, setDoc] = useState<Opname | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [canMutate, setCanMutate] = useState(false);
  const [onlyVariance, setOnlyVariance] = useState(true);

  const listHref = focus ? `/app/opnames?focus=${focus}` : "/app/opnames";

  const load = useCallback(async () => {
    try {
      setDoc(await opnameApi.get(id));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat detail");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const user = getUser();
    const door =
      focus ??
      (doc?.location === "warehouse" || doc?.location === "kitchen"
        ? doc.location
        : null);
    setCanMutate(user ? showOpnameMutate(user.role, door) : false);
  }, [focus, doc?.location]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = doc?.lines ?? [];

  const summary = useMemo(() => {
    const withVar = lines.filter((l) => l.variance !== 0);
    let surplusItems = 0;
    let deficitItems = 0;
    for (const l of withVar) {
      if (l.variance > 0) surplusItems += 1;
      if (l.variance < 0) deficitItems += 1;
    }
    return {
      total: lines.length,
      withVariance: withVar.length,
      matched: lines.length - withVar.length,
      surplusItems,
      deficitItems,
    };
  }, [lines]);

  const visibleLines: OpnameLine[] = useMemo(() => {
    if (!onlyVariance) return lines;
    return lines.filter((l) => l.variance !== 0);
  }, [lines, onlyVariance]);

  async function confirm() {
    if (!doc || !canMutate) return;
    setBusy(true);
    try {
      const updated = await opnameApi.confirm(doc.id);
      setDoc(updated);
      toastSuccess("Opname dikonfirmasi; stok disesuaikan");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal konfirmasi");
    } finally {
      setBusy(false);
    }
  }

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
        <p className="error">Opname tidak ditemukan</p>
        <Link className="btn btn-ghost" href={listHref}>
          Kembali
        </Link>
      </div>
    );
  }

  const confirmedAt = doc.confirmed_at
    ? formatDateTime(doc.confirmed_at)
    : null;

  return (
    <div className="si-page">
      <header className="si-page-header no-print">
        <div className="page-header-text">
          <p className="section-label">{opnameLocationLabel(doc.location)}</p>
          <h1 className="page-title">Dokumen opname</h1>
          <p className="lede">
            Berita acara hitung fisik vs sistem — siap dilihat dan dicetak.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-ghost" href={listHref}>
            Kembali
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.print()}
          >
            Cetak
          </button>
          {canMutate && doc.status === "draft" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Memproses…" : "Konfirmasi & sesuaikan stok"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="si-toolbar no-print">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{summary.withVariance}</strong> item selisih dari{" "}
            {summary.total} baris
          </p>
        </div>
        <div className="si-filter-row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={
              onlyVariance ? "si-filter-chip is-active" : "si-filter-chip"
            }
            onClick={() => setOnlyVariance(true)}
          >
            Hanya selisih
          </button>
          <button
            type="button"
            className={
              !onlyVariance ? "si-filter-chip is-active" : "si-filter-chip"
            }
            onClick={() => setOnlyVariance(false)}
          >
            Semua item
          </button>
        </div>
      </div>

      <article className="opname-doc" id="opname-print">
        <header className="opname-doc-head">
          <div>
            <p className="opname-doc-brand">Dapoer Sari</p>
            <h2 className="opname-doc-title">Berita acara opname stok</h2>
            <p className="opname-doc-sub">
              Dokumen No. {shortId(doc.id)} · Lokasi{" "}
              {opnameLocationLabel(doc.location)}
            </p>
          </div>
          <div className="opname-doc-meta">
            <p>
              <span className="opname-doc-meta-label">Status</span>
              {opnameStatusLabel(doc.status)}
            </p>
            <p>
              <span className="opname-doc-meta-label">Dibuat</span>
              {formatDateTime(doc.created_at)}
            </p>
            {confirmedAt ? (
              <p>
                <span className="opname-doc-meta-label">Dikonfirmasi</span>
                {confirmedAt}
              </p>
            ) : null}
          </div>
        </header>

        {doc.note ? (
          <p className="opname-doc-note">
            <strong>Catatan:</strong> {doc.note}
          </p>
        ) : (
          <p className="opname-doc-note muted">Tanpa catatan.</p>
        )}

        <section className="opname-doc-summary" aria-label="Ringkasan selisih">
          <div>
            <p className="opname-doc-stat-label">Item dihitung</p>
            <p className="opname-doc-stat-value">{summary.total}</p>
          </div>
          <div>
            <p className="opname-doc-stat-label">Cocok</p>
            <p className="opname-doc-stat-value">{summary.matched}</p>
          </div>
          <div>
            <p className="opname-doc-stat-label">Selisih (+)</p>
            <p className="opname-doc-stat-value is-plus">
              {summary.surplusItems}
            </p>
          </div>
          <div>
            <p className="opname-doc-stat-label">Selisih (−)</p>
            <p className="opname-doc-stat-value is-minus">
              {summary.deficitItems}
            </p>
          </div>
        </section>

        <h3 className="opname-doc-section-title">
          {onlyVariance ? "Rincian selisih" : "Rincian seluruh item"}
        </h3>

        {visibleLines.length === 0 ? (
          <p className="muted">
            {onlyVariance
              ? "Tidak ada selisih — semua item cocok dengan sistem."
              : "Tidak ada baris."}
          </p>
        ) : (
          <div className="data-table-wrap opname-doc-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Satuan</th>
                  <th>Qty sistem</th>
                  <th>Qty fisik</th>
                  <th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.item_sku}</strong>
                    </td>
                    <td>{l.item_name}</td>
                    <td>{l.unit_code}</td>
                    <td>{l.system_qty}</td>
                    <td>{l.physical_qty}</td>
                    <td className={varianceClass(l.variance)}>
                      {l.variance > 0 ? `+${l.variance}` : l.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="opname-doc-foot">
          <p>
            Dokumen ini mencatat hasil hitung fisik terhadap qty sistem pada saat
            draf dibuat
            {doc.status === "confirmed"
              ? ", dan telah dikonfirmasi sehingga stok sistem disesuaikan."
              : ". Belum dikonfirmasi — stok sistem belum diubah."}
          </p>
          <div className="opname-doc-signs">
            <div>
              <p className="opname-doc-sign-label">Petugas hitung</p>
              <p className="opname-doc-sign-line">________________</p>
            </div>
            <div>
              <p className="opname-doc-sign-label">Mengetahui</p>
              <p className="opname-doc-sign-line">________________</p>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

export default function OpnameDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="si-page">
          <p className="muted">Memuat…</p>
        </div>
      }
    >
      <OpnameDetailContent />
    </Suspense>
  );
}
