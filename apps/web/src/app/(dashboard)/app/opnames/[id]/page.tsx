"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { StepPills } from "@/components/ui/StepPills";
import { FilterChips } from "@/components/ui/Tabs";
import { getUser } from "@/lib/auth";
import { formatClock, formatDay, formatFullStamp, formatStamp } from "@/lib/datetime";
import { docNo, formatQty, signedQty } from "@/lib/format";
import { kitchenApi } from "@/lib/kitchen";
import {
  Opname,
  OpnameLine,
  opnameApi,
  opnameLocationLabel,
  opnameStatusLabel,
} from "@/lib/opname";
import { type VarianceKind, summarize } from "@/lib/opname-calc";
import { parseRequestFocus, showOpnameMutate } from "@/lib/rbac";
import { round3 } from "@/lib/request-stock";
import { toastSuccess } from "@/lib/toast";
import { warehouseApi } from "@/lib/warehouse";

function varianceClass(v: number): string {
  if (v > 0) return "doc-variance is-plus";
  if (v < 0) return "doc-variance is-minus";
  return "doc-variance";
}

function kindOf(l: OpnameLine): VarianceKind {
  return l.variance > 0 ? "over" : l.variance < 0 ? "under" : "match";
}

function explainConfirmError(message: string): { title: string; body: string } {
  if (message.includes("status opname tidak sesuai")) {
    return {
      title: "Opname ini sudah diproses",
      body: "Dokumen ini sudah dikonfirmasi atau dibatalkan oleh orang lain. Muat ulang untuk melihat keadaan terbarunya.",
    };
  }
  if (message.includes("akses ditolak")) {
    return {
      title: "Peran Anda tidak bisa mengonfirmasi opname ini",
      body: "Opname gudang dikonfirmasi Admin Gudang, opname dapur oleh Admin Dapur. Super Admin bisa keduanya.",
    };
  }
  return { title: "Konfirmasi belum berhasil", body: message };
}

function OpnameDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [doc, setDoc] = useState<Opname | null>(null);
  const [live, setLive] = useState<Map<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canMutate, setCanMutate] = useState(false);
  const [onlyVariance, setOnlyVariance] = useState(true);

  const listHref = focus ? `/app/opnames?focus=${focus}` : "/app/opnames";

  const load = useCallback(async () => {
    setLoadError(null);
    let opname: Opname;
    try {
      opname = await opnameApi.get(id);
      setDoc(opname);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat dokumen");
      setDoc(null);
      setLoading(false);
      return;
    }
    setLoading(false);
    // Confirming overwrites stock with the counted qty, so a draft needs today's stock to spot drift.
    if (opname.status === "draft") {
      try {
        const rows =
          opname.location === "kitchen"
            ? await kitchenApi.listStocks()
            : await warehouseApi.listStocks();
        setLive(new Map(rows.map((s) => [s.item_id, s.qty])));
      } catch {
        setLive(null);
      }
    } else {
      setLive(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const user = getUser();
    const door =
      focus ??
      (doc?.location === "warehouse" || doc?.location === "kitchen" ? doc.location : null);
    setCanMutate(user ? showOpnameMutate(user.role, door) : false);
  }, [focus, doc?.location]);

  const lines = useMemo(() => doc?.lines ?? [], [doc]);
  const summary = useMemo(() => summarize(lines.map(kindOf)), [lines]);
  const visibleLines = onlyVariance ? lines.filter((l) => l.variance !== 0) : lines;

  const drifted = useMemo(() => {
    if (!live || doc?.status !== "draft") return [];
    return lines.filter((l) => {
      const now = live.get(l.item_id);
      return now !== undefined && round3(now - l.system_qty) !== 0;
    });
  }, [live, lines, doc?.status]);

  async function confirm() {
    if (!doc || !canMutate) return;
    setBusy(true);
    setActionError(null);
    try {
      setDoc(await opnameApi.confirm(doc.id));
      setLive(null);
      toastSuccess("Opname dikonfirmasi; persediaan disesuaikan");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal konfirmasi");
    } finally {
      setBusy(false);
    }
  }

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
          title="Dokumen opname tidak bisa dimuat"
          actions={
            <>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Coba lagi
              </Button>
              <LinkButton size="sm" variant="secondary" href={listHref}>
                Kembali ke daftar
              </LinkButton>
            </>
          }
        >
          {loadError ?? "Opname tidak ditemukan"}. Bisa jadi dokumennya tidak ada atau tautannya
          keliru.
        </InlineAlert>
      </div>
    );
  }

  const where = opnameLocationLabel(doc.location).toLowerCase();
  const number = docNo("OPN", doc.id);
  const isDraft = doc.status === "draft";
  const confirmed = doc.status === "confirmed";
  const actionInfo = actionError ? explainConfirmError(actionError) : null;
  const location = doc.location === "kitchen" ? "kitchen" : "warehouse";

  const note = isDraft
    ? canMutate
      ? summary.over + summary.under === 0
        ? "Tidak ada selisih, jadi stok tidak berubah. Konfirmasi hanya menutup dokumen."
        : `Konfirmasi menimpa stok ${where} dengan hasil hitung untuk ${summary.over + summary.under} item yang selisih. Tidak bisa dibatalkan.`
      : `Menunggu konfirmasi petugas ${where}.`
    : confirmed
      ? `Stok ${where} sudah disesuaikan${doc.confirmed_at ? ` pada ${formatStamp(doc.confirmed_at)}` : ""}.`
      : "Dokumen ini dibatalkan. Stok tidak berubah.";

  return (
    <div className="ds-screen">
      <div className="ds-screen no-print">
        <PageHeader
          align="start"
          mono
          compactLede
          kicker={
            <LocationTag
              location={location}
              label={`Opname ${where}`}
            />
          }
          title={number}
          titleAside={<StatusChip kind="opname" status={doc.status} size="lg" />}
          lede={
            <>
              Dihitung <strong className="ds-medium">{opnameLocationLabel(doc.location)}</strong> ·{" "}
              {formatDay(doc.created_at)}{" "}
              <span className="ds-num">{formatClock(doc.created_at)}</span>
            </>
          }
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              Cetak berita acara
            </Button>
          }
        />

        <StepPills
          label="Langkah opname"
          steps={["Hitung", "Tinjau selisih", "Konfirmasi"]}
          current={1}
          complete={confirmed}
        />

        {loadError ? (
          <InlineAlert role="alert" title="Dokumen belum bisa dimuat ulang">
            {loadError}
          </InlineAlert>
        ) : null}

        {actionInfo ? (
          <InlineAlert
            role="alert"
            title={actionInfo.title}
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Muat ulang
              </Button>
            }
          >
            {actionInfo.body}
          </InlineAlert>
        ) : null}

        {drifted.length > 0 ? (
          <InlineAlert
            tone="warn"
            title={
              drifted.length === 1
                ? `Stok ${drifted[0].item_name} sudah berubah sejak dihitung`
                : `Stok ${drifted.length} item sudah berubah sejak dihitung`
            }
            actions={
              canMutate ? (
                <LinkButton
                  size="sm"
                  variant="secondary"
                  href={`/app/opnames/new?focus=${doc.location === "kitchen" ? "kitchen" : "warehouse"}`}
                >
                  Hitung ulang
                </LinkButton>
              ) : undefined
            }
          >
            Konfirmasi akan menimpa stok dengan hasil hitung, jadi pergerakan sesudah draf dibuat
            (kiriman, akhir shift, persediaan masuk) ikut tertimpa. Hitung ulang kalau hasilnya
            sudah tidak sesuai.
            <ul className="ds-drift-list">
              {drifted.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <span className="ds-medium">{l.item_name}</span>: sistem{" "}
                  <span className="ds-num">{formatQty(l.system_qty, l.unit_code)}</span> saat dihitung,{" "}
                  <span className="ds-num">
                    {formatQty(live?.get(l.item_id) ?? 0, l.unit_code)}
                  </span>{" "}
                  sekarang
                </li>
              ))}
              {drifted.length > 5 ? <li>dan {drifted.length - 5} item lain</li> : null}
            </ul>
          </InlineAlert>
        ) : null}

        <section className="ds-sumbar is-sticky" aria-label="Ringkasan opname">
          <dl className="ds-sumbar-stats">
            <div>
              <dt>Dihitung</dt>
              <dd className="ds-num">{formatQty(summary.total)}</dd>
            </div>
            <div>
              <dt>Cocok</dt>
              <dd className="ds-num">{formatQty(summary.match)}</dd>
            </div>
            <div>
              <dt>Lebih</dt>
              <dd className="ds-num is-over">{formatQty(summary.over)}</dd>
            </div>
            <div>
              <dt>Kurang</dt>
              <dd className="ds-num is-under">{formatQty(summary.under)}</dd>
            </div>
          </dl>
          <div className="ds-sumbar-side">
            {isDraft && canMutate ? (
              <div className="ds-sumbar-actions">
                <Button
                  variant="light"
                  disabled={busy}
                  aria-describedby="opname-note"
                  onClick={() => void confirm()}
                >
                  {busy ? "Mengonfirmasi…" : "Konfirmasi & sesuaikan persediaan"}
                </Button>
              </div>
            ) : null}
            <p id="opname-note" className="ds-sumbar-note">
              {note}
            </p>
          </div>
        </section>

        <div className="ds-toolbar-group ds-between">
          <p className="ds-card-hint">
            <strong className="ds-num ds-ink">{summary.over + summary.under}</strong> item selisih
            dari <span className="ds-num">{summary.total}</span> baris
          </p>
          <FilterChips
            label="Tampilan baris"
            value={onlyVariance ? "variance" : "all"}
            onChange={(v) => setOnlyVariance(v === "variance")}
            items={[
              { id: "variance", label: "Hanya selisih", count: summary.over + summary.under },
              { id: "all", label: "Semua item", count: summary.total },
            ]}
          />
        </div>
      </div>

      {/* Berita acara: tampil di layar sebagai dokumen, dan inilah yang tercetak */}
      <article className="si-doc" id="opname-print">
        <header className="si-doc-kop">
          <p className="si-doc-brand">Dapoer Sari</p>
          <p className="si-doc-org">Sistem manajemen inventaris</p>
        </header>

        <h2 className="si-doc-title">Berita acara opname persediaan</h2>

        <dl className="si-doc-meta-grid">
          <div className="si-doc-meta-row">
            <dt>Nomor</dt>
            <dd>{number}</dd>
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
            <dd>{formatFullStamp(doc.created_at)}</dd>
          </div>
          {doc.confirmed_at ? (
            <div className="si-doc-meta-row">
              <dt>Dikonfirmasi</dt>
              <dd>{formatFullStamp(doc.confirmed_at)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="si-doc-lead">
          Pada tanggal {formatFullStamp(doc.created_at)} telah dilakukan penghitungan fisik
          persediaan di lokasi {where} dengan hasil sebagaimana tercantum dalam berita acara ini.
        </p>

        {doc.note ? (
          <p className="si-doc-note">
            <strong>Catatan:</strong> {doc.note}
          </p>
        ) : null}

        <p className="si-doc-summary-line">
          <strong>Ringkasan:</strong> {summary.total} item dihitung · {summary.match} cocok ·{" "}
          {summary.over} selisih (+) · {summary.under} selisih (−)
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
            <table className="data-table is-stack">
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
                    <td data-label="No" className="si-doc-col-num">{i + 1}</td>
                    <td data-label="SKU">
                      <strong>{l.item_sku}</strong>
                    </td>
                    <td data-title>{l.item_name}</td>
                    <td data-label="Kategori">{l.category_name || "—"}</td>
                    <td data-label="Satuan">{l.unit_code}</td>
                    <td data-label="Qty sistem">{formatQty(l.system_qty)}</td>
                    <td data-label="Qty fisik">{formatQty(l.physical_qty)}</td>
                    <td data-label="Selisih" className={varianceClass(l.variance)}>{signedQty(l.variance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="si-doc-closing">
          {confirmed
            ? "Status dokumen: dikonfirmasi. Persediaan sistem sudah disesuaikan sesuai hasil hitung fisik di atas."
            : "Status dokumen: draf. Persediaan sistem belum diubah hingga dokumen dikonfirmasi."}{" "}
          Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.
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
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <OpnameDetailContent />
    </Suspense>
  );
}
