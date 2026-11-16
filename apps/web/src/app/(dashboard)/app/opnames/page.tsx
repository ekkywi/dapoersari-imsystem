"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
<<<<<<< HEAD
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { ApiError } from "@/lib/api";
=======
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
>>>>>>> origin/feat/web-redesign
import { getUser } from "@/lib/auth";
import { formatStamp, relativeTime } from "@/lib/datetime";
import { docNo } from "@/lib/format";
import { Opname, opnameApi } from "@/lib/opname";
import { parseRequestFocus, showOpnameMutate } from "@/lib/rbac";

function titleFor(focus: "warehouse" | "kitchen" | null): string {
  if (focus === "warehouse") return "Opname gudang";
  if (focus === "kitchen") return "Opname dapur";
  return "Opname";
}

function OpnamesContent() {
  const searchParams = useSearchParams();
  const focus = parseRequestFocus(searchParams.get("focus"));

  const [rows, setRows] = useState<Opname[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canMutate, setCanMutate] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setRows(await opnameApi.list(focus ?? undefined));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat opname");
    } finally {
      setLoading(false);
    }
  }, [focus]);

  useEffect(() => {
    const user = getUser();
    setCanMutate(user ? showOpnameMutate(user.role, focus) : false);
    void load();
  }, [load, focus]);

  const drafts = rows.filter((r) => r.status === "draft").length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        docNo("OPN", r.id).toLowerCase().includes(q) ||
        r.id.toLowerCase().startsWith(q) ||
        (r.note ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

<<<<<<< HEAD
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canMutate || !location) return;
    const lines = draftLines
      .map((l) => ({
        item_id: l.item_id,
        physical_qty: Number(l.physical_qty),
      }))
      .filter((l) => l.item_id && Number.isFinite(l.physical_qty) && l.physical_qty >= 0);
    if (lines.length === 0) {
      setFormError("Minimal satu item dengan qty fisik");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = { location, note: note.trim() || null, lines };
      try {
        await opnameApi.create(body);
      } catch (err) {
        if (!(err instanceof ApiError && err.code === "closing_missing")) throw err;
        const go = window.confirm(
          "Belum ada akhir shift (closing) dapur untuk hari ini. Sebaiknya lakukan closing dulu, lalu hitung fisik, baru buat draf.\n\nPeringatan: closing yang dicatat SETELAH draf ini akan membuat draf tidak bisa dikonfirmasi.\n\nTetap buat draf sekarang?",
        );
        if (!go) return;
        await opnameApi.create({ ...body, acknowledge_no_closing: true });
      }
      setDrawerOpen(false);
      toastSuccess("Draf opname dibuat — konfirmasi di detail");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat opname");
    } finally {
      setSaving(false);
    }
=======
  function detailHref(id: string): string {
    return focus ? `/app/opnames/${id}?focus=${focus}` : `/app/opnames/${id}`;
>>>>>>> origin/feat/web-redesign
  }

  return (
    <div className="ds-screen">
      <PageHeader
        kicker={
          focus ? (
            <LocationTag
              location={focus}
              label={focus === "warehouse" ? "Pintu gudang" : "Pintu dapur"}
            />
          ) : undefined
        }
        title={titleFor(focus)}
        lede="Hitung fisik versus persediaan sistem. Stok baru berubah setelah dokumen dikonfirmasi."
        actions={
          canMutate && focus ? (
            <LinkButton href={`/app/opnames/new?focus=${focus}`}>Buat opname</LinkButton>
          ) : undefined
        }
      />

      {drafts > 0 ? (
        <InlineAlert tone="info" title={`${drafts} draf opname belum dikonfirmasi`}>
          Stok sistem belum berubah sampai drafnya dikonfirmasi. Buka drafnya untuk meninjau
          selisih.
        </InlineAlert>
      ) : null}

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Daftar opname belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Periksa koneksi Anda, lalu coba lagi.
        </InlineAlert>
      ) : null}

      <section className="ds-card ds-card-clip">
        <div className="ds-toolbar">
          <p className="ds-card-hint">Terbaru di atas.</p>
          <label className="ds-search">
            Cari
            <input
              type="search"
              placeholder="No. dokumen atau catatan"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="ds-empty">
            <p className="ds-empty-text">Memuat opname…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="ds-empty">
            <p className="ds-empty-title">{query.trim() ? "Tidak ada yang cocok" : "Belum ada opname"}</p>
            <p className="ds-empty-text">
              {query.trim()
                ? "Coba nomor dokumen atau kata di catatan yang lain."
                : canMutate
                  ? "Mulai dengan membuat opname baru."
                  : "Belum ada dokumen opname."}
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table is-stack">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Dokumen</th>
                  <th>Lokasi</th>
                  <th>Status</th>
                  <th>Catatan</th>
                  <th>
                    <span className="ds-sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Waktu" className="ds-nowrap">
                      <div className="ds-cell-stack">
                        <span className="ds-cell-main">{relativeTime(r.created_at)}</span>
                        <span className="ds-cell-sub ds-num">{formatStamp(r.created_at)}</span>
                      </div>
                    </td>
                    <td data-title>
                      <Link className="ds-doc-link ds-num" href={detailHref(r.id)}>
                        {docNo("OPN", r.id)}
                      </Link>
                    </td>
                    <td data-label="Lokasi" className="ds-nowrap">
                      <LocationTag
                        location={r.location === "kitchen" ? "kitchen" : "warehouse"}
                        size="sm"
                      />
                    </td>
                    <td data-label="Status" className="ds-nowrap">
                      <StatusChip kind="opname" status={r.status} />
                    </td>
                    <td data-label="Catatan" data-block className="ds-ink-2">{r.note || "—"}</td>
                    <td data-action className="ds-cell-right">
                      <LinkButton
                        href={detailHref(r.id)}
                        size="sm"
                        variant={r.status === "draft" && canMutate ? "primary" : "secondary"}
                      >
                        {r.status === "draft" && canMutate ? "Tinjau" : "Buka"}
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function OpnamesPage() {
  return (
    <Suspense
      fallback={
        <div className="ds-screen">
          <p className="ds-card-hint">Memuat…</p>
        </div>
      }
    >
      <OpnamesContent />
    </Suspense>
  );
}
