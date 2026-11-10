"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
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
      const updated: Opname = await opnameApi.confirm(doc.id);
      setDoc(updated);
      toastSuccess("Opname dikonfirmasi; persediaan disesuaikan");
    } catch (e) {
      if (e instanceof ApiError && e.code === "closing_after_draft") {
        window.alert(
          "Ada akhir shift (closing) yang dicatat setelah draf ini dibuat. Pemakaiannya kemungkinan sudah tercermin di hitungan fisik, sehingga akan terpotong dua kali.\n\nBuat draf opname baru (hitung ulang) setelah closing.",
        );
        return;
      }
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
          <p className="lede">Dokumen hitung fisik.</p>
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
              {busy ? "Memproses…" : "Konfirmasi & sesuaikan persediaan"}
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
        <div className="si-filter-row">
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

      <article className="si-doc" id="opname-print">
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara opname persediaan</h2>

        <dl className="si-doc-meta-grid">
          <div className="si-doc-meta-row">
            <dt>Nomor</dt>
            <dd>{shortId(doc.id)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Lokasi</dt>
            <dd>{opnameLocationLabel(doc.location)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Status</dt>
            <dd>{opnameStatusLabel(doc.status)}</dd>
          </div>
          <div className="si-doc-meta-row">
            <dt>Dibuat</dt>
            <dd>{formatDateTime(doc.created_at)}</dd>
          </div>
          {confirmedAt ? (
            <div className="si-doc-meta-row">
              <dt>Dikonfirmasi</dt>
              <dd>{confirmedAt}</dd>
            </div>
          ) : null}
        </dl>

        <p className="si-doc-lead">
          Pada tanggal {formatDateTime(doc.created_at)} telah dilakukan
          penghitungan fisik persediaan di lokasi{" "}
          {opnameLocationLabel(doc.location).toLowerCase()} dengan hasil
          sebagaimana tercantum dalam berita acara ini.
        </p>

        {doc.note ? (
          <p className="si-doc-note">
            <strong>Catatan:</strong> {doc.note}
          </p>
        ) : null}

        <p className="si-doc-summary-line">
          <strong>Ringkasan:</strong> {summary.total} item dihitung ·{" "}
          {summary.matched} cocok · {summary.surplusItems} selisih (+) ·{" "}
          {summary.deficitItems} selisih (−)
        </p>

        <h3 className="si-doc-section-title">
          {onlyVariance ? "Rincian selisih" : "Rincian seluruh item"}
        </h3>

        {visibleLines.length === 0 ? (
          <p className="si-doc-note muted">
            {onlyVariance
              ? "Tidak ada selisih — semua item cocok dengan sistem."
              : "Tidak ada baris."}
          </p>
        ) : (
          <div className="data-table-wrap si-doc-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="si-doc-col-num">No</th>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Satuan</th>
                  <th>Qty sistem</th>
                  <th>Qty fisik</th>
                  <th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((l, i) => (
                  <tr key={l.id}>
                    <td className="si-doc-col-num">{i + 1}</td>
                    <td>
                      <strong>{l.item_sku}</strong>
                    </td>
                    <td>{l.item_name}</td>
                    <td>{l.category_name || "—"}</td>
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

        <p className="si-doc-closing">
          {doc.status === "confirmed"
            ? "Status dokumen: dikonfirmasi. Persediaan sistem sudah disesuaikan sesuai hasil hitung fisik di atas."
            : "Status dokumen: draf. Persediaan sistem belum diubah hingga dokumen dikonfirmasi."}{" "}
          Demikian berita acara ini dibuat untuk dipergunakan sebagaimana
          mestinya.
        </p>

        <footer className="si-doc-foot">
          <div className="si-doc-signs">
            <div>
              <p className="si-doc-sign-label">Petugas hitung</p>
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
