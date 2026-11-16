"use client";

<<<<<<< HEAD
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ShortageList } from "@/components/features/ShortageList";
import { Drawer } from "@/components/ui/Drawer";
import { ShortageDetail, shortageDetails } from "@/lib/api";
=======
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LocationTag } from "@/components/ui/LocationTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { Qty } from "@/components/ui/Qty";
import { Stepper } from "@/components/ui/Stepper";
>>>>>>> origin/feat/web-redesign
import { getUser } from "@/lib/auth";
import { formatClock, formatDateOnly, formatStamp, todayISO } from "@/lib/datetime";
import { formatQty } from "@/lib/format";
import { kitchenApi, type Menu, type MenuClosing } from "@/lib/kitchen";
import { canMutateKitchen } from "@/lib/rbac";
import { buildDraftLines, type DraftRecipe, type ItemInfo } from "@/lib/request-draft";
import { round3 } from "@/lib/request-stock";
import { toastSuccess } from "@/lib/toast";
import { warehouseApi } from "@/lib/warehouse";

type Loaded = {
  menus: Menu[];
  recipes: Record<string, { item_id: string; qty_per_paket: number }[]>;
  failedMenus: Set<string>;
  info: Map<string, ItemInfo>;
  stock: Map<string, number>;
};

const PAGE_SIZE = 8;

/** Turns the API's terse errors into something the operator can act on. */
function explainSaveError(message: string): { title: string; body: string } {
  if (message.includes("tidak mencukupi")) {
    return {
      title: "Stok dapur tidak cukup, akhir shift belum tersimpan",
      body: "Stok dapur berubah sejak halaman ini dibuka. Muat ulang untuk melihat stok terbaru, lalu cek lagi jumlah paketnya.",
    };
  }
  if (message.includes("data tidak valid")) {
    return {
      title: "Akhir shift belum tersimpan",
      body: "Data ditolak server. Pastikan tanggalnya terisi dan setiap menu yang dipilih masih aktif serta punya resep.",
    };
  }
  return { title: "Akhir shift belum tersimpan", body: message };
}

export default function ClosingsPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [closings, setClosings] = useState<MenuClosing[]>([]);
  const [details, setDetails] = useState<Record<string, MenuClosing>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [paket, setPaket] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
<<<<<<< HEAD
  const [packages, setPackages] = useState<DraftPkg[]>([
    { menu_id: "", qty_paket: "1" },
  ]);
  const [detail, setDetail] = useState<MenuClosing | null>(null);
  const [shortages, setShortages] = useState<ShortageDetail[] | null>(null);
  const [allowShortage, setAllowShortage] = useState(false);
  const [shortageNote, setShortageNote] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.closing_date.includes(q) ||
        (r.note ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, query]);
=======
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const requested = useRef<Set<string>>(new Set());
>>>>>>> origin/feat/web-redesign

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [menuRows, itemRows, unitRows, stockRows, closingRows] = await Promise.all([
        kitchenApi.listMenus(),
        warehouseApi.listItems(),
        warehouseApi.listUnits(),
        kitchenApi.listStocks(),
        kitchenApi.listClosings(),
      ]);
<<<<<<< HEAD
      setRows(closings);
      // Inactive menus stay selectable so usage of a just-deactivated menu can
      // still be recorded; active ones first.
      setMenus(
        [...menuRows].sort((a, b) => Number(b.is_active) - Number(a.is_active)),
      );
=======
      const active = menuRows.filter((m) => m.is_active);
      // TODO(api): GET /kitchen/menus returns no recipe lines, so each active menu needs its own GET.
      const settled = await Promise.allSettled(active.map((m) => kitchenApi.getMenu(m.id)));
      const recipes: Loaded["recipes"] = {};
      const failedMenus = new Set<string>();
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          recipes[active[i].id] = (result.value.lines ?? []).map((l) => ({
            item_id: l.item_id,
            qty_per_paket: l.qty_per_paket,
          }));
        } else {
          failedMenus.add(active[i].id);
        }
      });
      const unitCode = new Map(unitRows.map((u) => [u.id, u.code]));
      const info = new Map<string, ItemInfo>(
        itemRows.map((it) => [
          it.id,
          { name: it.name, sku: it.sku, unit: unitCode.get(it.unit_id) ?? "" },
        ]),
      );
      // Every item has a kitchen stock row; an item missing from the list counts as 0.
      const stock = new Map<string, number>(itemRows.map((it) => [it.id, 0]));
      for (const s of stockRows) stock.set(s.item_id, s.qty);
      setData({ menus: active, recipes, failedMenus, info, stock });
      setClosings(closingRows);
>>>>>>> origin/feat/web-redesign
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setCanWrite(user ? canMutateKitchen(user.role) : false);
    void load();
  }, [load]);

<<<<<<< HEAD
  function openCreate() {
    setClosingDate(todayISO());
    setNote("");
    setPackages([{ menu_id: menus.find((m) => m.is_active)?.id ?? "", qty_paket: "1" }]);
    setFormError(null);
    setShortages(null);
    setAllowShortage(false);
    setShortageNote("");
    setDrawerOpen(true);
  }
=======
  // TODO(api): GET /kitchen/closings returns headers only, so "Isi" needs one GET per visible row.
  useEffect(() => {
    const missing = closings
      .slice(0, shown)
      .map((c) => c.id)
      .filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    void Promise.allSettled(missing.map((id) => kitchenApi.getClosing(id))).then((results) => {
      const next: Record<string, MenuClosing> = {};
      for (const r of results) if (r.status === "fulfilled") next[r.value.id] = r.value;
      setDetails((prev) => ({ ...prev, ...next }));
    });
  }, [closings, shown]);
>>>>>>> origin/feat/web-redesign

  const lines = useMemo(() => {
    if (!data) return [];
    const recipes: DraftRecipe[] = data.menus
      .filter((m) => data.recipes[m.id])
      .map((m) => ({ menuId: m.id, lines: data.recipes[m.id] }));
    return buildDraftLines(recipes, paket, [], data.info, data.stock);
  }, [data, paket]);

<<<<<<< HEAD
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const pkgs = packages
      .map((p) => ({
        menu_id: p.menu_id,
        qty_paket: Number(p.qty_paket),
      }))
      .filter((p) => p.menu_id && p.qty_paket > 0);
    if (!closingDate || pkgs.length === 0) {
      setFormError("Tanggal dan minimal satu paket menu wajib diisi");
      return;
    }
    if (allowShortage && !shortageNote.trim()) {
      setFormError("Catatan kekurangan wajib diisi");
      return;
    }
=======
  const selectedMenus = data ? data.menus.filter((m) => (paket[m.id] ?? 0) > 0) : [];
  const total = selectedMenus.reduce((sum, m) => sum + (paket[m.id] ?? 0), 0);
  const short = lines.filter((l) => l.shortBy > 0);
  const sameDay = closings.filter((c) => c.closing_date === date).length;
  const isToday = date === todayISO();
  const canSubmit = canWrite && date !== "" && total > 0 && short.length === 0 && !saving;

  const shortTitle =
    short.length === 0
      ? ""
      : short.length === 1
        ? `${short[0].name} kurang ${formatQty(short[0].shortBy, short[0].unit)} di dapur`
        : `${short[0].name} dan ${short.length - 1} bahan lain kurang di dapur`;

  const blockedReason = !canWrite
    ? "Hanya Admin Dapur yang bisa menyimpan akhir shift."
    : date === ""
      ? "Pilih tanggal akhir shift."
      : total === 0
        ? "Isi jumlah paket yang terjual."
        : short.length > 0
          ? `Belum bisa disimpan: ${shortTitle}.`
          : null;

  async function onSave() {
    if (!canSubmit) return;
>>>>>>> origin/feat/web-redesign
    setSaving(true);
    setSaveError(null);
    try {
<<<<<<< HEAD
      const saved = await kitchenApi.createClosing({
        closing_date: closingDate,
        note: note.trim() || null,
        packages: pkgs,
        ...(allowShortage
          ? { allow_shortage: true, shortage_note: shortageNote.trim() }
          : {}),
      });
      setDrawerOpen(false);
      toastSuccess(
        saved.has_shortage
          ? "Akhir shift tersimpan dengan kekurangan; stok dikurangi sebesar yang tersedia"
          : "Akhir shift tersimpan; persediaan dapur dikurangi",
      );
      await load();
    } catch (err) {
      const short = shortageDetails(err);
      setShortages(short);
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
=======
      await kitchenApi.createClosing({
        closing_date: date,
        note: note.trim() || null,
        packages: selectedMenus.map((m) => ({ menu_id: m.id, qty_paket: paket[m.id] })),
      });
      toastSuccess("Akhir shift tersimpan; stok dapur dikurangi");
      setPaket({});
      setNote("");
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal menyimpan");
>>>>>>> origin/feat/web-redesign
    } finally {
      setSaving(false);
    }
  }

  const openDetail = openId ? (details[openId] ?? closings.find((c) => c.id === openId)) : undefined;

  useEffect(() => {
    if (openId && !details[openId]) {
      void kitchenApi
        .getClosing(openId)
        .then((c) => setDetails((prev) => ({ ...prev, [c.id]: c })))
        .catch(() => {});
    }
  }, [openId, details]);

  const saveInfo = saveError ? explainSaveError(saveError) : null;

  return (
<<<<<<< HEAD
    <div className="si-page">
      <header className="si-page-header">
        <div className="page-header-text">
          <p className="section-label">Dapur</p>
          <h1 className="page-title">Akhir shift</h1>
          <p className="lede">Qty paket terjual atau diproduksi.</p>
        </div>
      </header>

      <div className="si-toolbar">
        <div className="si-toolbar-meta">
          <p className="si-count">
            <strong>{filtered.length}</strong> dari {rows.length} dokumen
          </p>
          <input
            className="input si-search"
            type="search"
            placeholder="Cari tanggal / catatan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="si-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Muat ulang
          </button>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Tutup shift
            </button>
          ) : null}
        </div>
      </div>

      <section className="si-table-card">
        {loading ? (
          <div className="si-empty">
            <p className="muted">Memuat data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="si-empty">
            <p className="si-empty-title">Belum ada penutupan</p>
            <p className="si-empty-desc">Belum ada dokumen penutupan.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Dicatat</th>
                  <th>Catatan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.closing_date}{" "}
                      {r.has_shortage ? (
                        <span className="badge badge-warn">Ada kekurangan</span>
                      ) : null}
                    </td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{r.note || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void openDetail(r.id)}
                      >
                        Buka
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={drawerOpen}
        title="Akhir shift"
        description="Input qty paket terjual atau diproduksi."
        onClose={() => setDrawerOpen(false)}
      >
        {formError ? <p className="error">{formError}</p> : null}
        {shortages && shortages.length > 0 ? <ShortageList items={shortages} /> : null}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label">Tanggal</label>
=======
    <div className="ds-screen">
      <PageHeader
        kicker={<LocationTag location="kitchen" label="Pintu dapur" />}
        title="Akhir shift"
        lede="Masukkan jumlah paket yang terjual atau dimasak. Stok dapur dikurangi sesuai resep saat disimpan."
        actions={
          <label className="ds-field ds-field-sm ds-date-field">
            Tanggal
>>>>>>> origin/feat/web-redesign
            <input
              className="ds-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        }
      />

      {loadError ? (
        <InlineAlert
          role="alert"
          title="Data menu dan stok dapur belum bisa dimuat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        >
          {loadError}. Tanpa data ini bahan yang terpakai tidak bisa dihitung.
        </InlineAlert>
      ) : null}

      {loading && !data ? <p className="ds-card-hint">Memuat menu dan stok dapur…</p> : null}

      {data ? (
        <div className="ds-split">
          <div className="ds-form-col">
            <section className="ds-card ds-sold-card-wrap" aria-labelledby="sold-title">
              <div className="ds-sold-head">
                <h2 id="sold-title" className="ds-card-title">
                  {isToday
                    ? "Paket terjual hari ini"
                    : date
                      ? `Paket terjual pada ${formatDateOnly(date)}`
                      : "Paket terjual"}
                </h2>
                <p className="ds-card-hint">
                  Total <strong className="ds-num ds-ink">{formatQty(total)}</strong> paket
                </p>
              </div>

              {data.menus.length === 0 ? (
                <p className="ds-preview-empty">
                  Belum ada menu aktif. Tambahkan resep di Resep / menu lebih dulu.
                </p>
              ) : (
                <div className="ds-sold-grid">
                  {data.menus.map((m) => {
                    const recipe = data.recipes[m.id];
                    const failed = data.failedMenus.has(m.id);
                    const empty = !failed && (!recipe || recipe.length === 0);
                    return (
                      <div key={m.id} className="ds-sold-card">
                        <div className="ds-cell-stack">
                          <span className="ds-menu-name">{m.name}</span>
                          <span className="ds-cell-sub">
                            {failed
                              ? "Resep tidak bisa dimuat"
                              : empty
                                ? "Resep masih kosong"
                                : `${recipe.length} bahan per paket`}
                          </span>
                        </div>
                        {failed || empty ? (
                          <LinkButton size="sm" variant="secondary" href="/app/kitchen/menus">
                            {failed ? "Buka resep" : "Isi resep dulu"}
                          </LinkButton>
                        ) : (
                          <Stepper
                            size="lg"
                            fill
                            label={m.name}
                            noun="paket terjual"
                            disabled={!canWrite}
                            value={paket[m.id] ?? 0}
                            onChange={(n) => setPaket((p) => ({ ...p, [m.id]: n }))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <label className="ds-field ds-field-sm">
                Catatan <span className="ds-field-hint">Opsional</span>
                <input
                  className="ds-input"
                  type="text"
                  placeholder="Contoh: shift siang, ada pesanan 20 nasi kotak"
                  value={note}
                  disabled={!canWrite}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </section>

            <section className="ds-card ds-card-clip" aria-labelledby="past-title">
              <h2 id="past-title" className="ds-card-title-pad">
                Akhir shift sebelumnya
              </h2>
              {closings.length === 0 ? (
                <p className="ds-preview-empty">Belum ada akhir shift yang dicatat.</p>
              ) : (
                <>
                  <div className="ds-table-wrap">
                    <table className="ds-table is-compact is-stack">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Isi</th>
                          <th>Dicatat</th>
                          <th>
                            <span className="ds-sr-only">Aksi</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {closings.slice(0, shown).map((c) => {
                          const d = details[c.id];
                          const pkgs = d?.packages ?? [];
                          const sum = pkgs.reduce((acc, p) => acc + p.qty_paket, 0);
                          return (
                            <tr key={c.id}>
                              <td data-title>{formatDateOnly(c.closing_date)}</td>
                              <td data-label="Isi" data-block className="ds-ink-2">
                                {d ? (
                                  <>
                                    {pkgs.length} menu ·{" "}
                                    <span className="ds-num">{formatQty(sum)}</span> paket
                                  </>
                                ) : (
                                  <span className="ds-cell-sub">Memuat isi…</span>
                                )}
                              </td>
                              <td data-label="Dicatat" className="ds-num ds-muted-cell">{formatClock(c.created_at)}</td>
                              <td data-action className="ds-cell-right">
                                <button
                                  type="button"
                                  className="ds-link-btn"
                                  aria-label={`Buka akhir shift ${formatDateOnly(c.closing_date)}`}
                                  onClick={() => setOpenId(c.id)}
                                >
                                  Buka
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {closings.length > shown ? (
                    <div className="ds-toolbar is-foot">
                      <p className="ds-card-hint">
                        Menampilkan {shown} dari {closings.length} akhir shift
                      </p>
                      <Button size="sm" variant="secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                        Tampilkan lebih banyak
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
<<<<<<< HEAD
          {packages.map((p, idx) => (
            <div key={idx} className="field">
              <label className="label">Paket {idx + 1}</label>
              <select
                className="input select"
                value={p.menu_id}
                onChange={(e) => {
                  const next = [...packages];
                  next[idx] = { ...p, menu_id: e.target.value };
                  setPackages(next);
                }}
              >
                <option value="">— pilih menu —</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.is_active ? "" : " (nonaktif)"}
                  </option>
                ))}
              </select>
              <input
                className="input field-control"
                type="number"
                min={0.001}
                step="0.001"
                value={p.qty_paket}
                onChange={(e) => {
                  const next = [...packages];
                  next[idx] = { ...p, qty_paket: e.target.value };
                  setPackages(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setPackages((prev) => [
                ...prev,
                { menu_id: menus.find((m) => m.is_active)?.id ?? "", qty_paket: "1" },
              ])
            }
          >
            + Tambah paket
          </button>
          <div className="field">
            <label className="label">Catatan</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {shortages && shortages.length > 0 ? (
            <div className="field">
              <label className="label">
                <input
                  type="checkbox"
                  checked={allowShortage}
                  onChange={(e) => setAllowShortage(e.target.checked)}
                />{" "}
                Simpan dengan kekurangan (stok dikurangi sebesar yang tersedia)
              </label>
              {allowShortage ? (
                <input
                  className="input field-control"
                  placeholder="Catatan kekurangan (wajib), mis. stok sistem kurang dari fisik"
                  value={shortageNote}
                  onChange={(e) => setShortageNote(e.target.value)}
                  required
                />
              ) : null}
            </div>
          ) : null}
          <div className="drawer-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDrawerOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? "Menyimpan…"
                : allowShortage
                  ? "Simpan dengan kekurangan"
                  : "Simpan & kurangi persediaan"}
            </button>
          </div>
        </form>
      </Drawer>
=======

          <section className="ds-card ds-preview" aria-labelledby="use-title">
            <div className="ds-preview-head">
              <h2 id="use-title" className="ds-card-title">
                Bahan yang akan dikurangi
              </h2>
              <p className="ds-card-hint">Dari stok dapur · dihitung dari resep</p>
            </div>

            {lines.length === 0 ? (
              <p className="ds-preview-empty">
                Isi jumlah paket di sebelah kiri. Bahan yang terpakai muncul di sini.
              </p>
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table is-compact">
                  <thead>
                    <tr>
                      <th>Bahan</th>
                      <th className="is-num">Dipakai</th>
                      <th className="is-num">Stok dapur</th>
                      <th className="is-num">Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const stock = l.stock ?? 0;
                      const after = round3(stock - l.qty);
                      return (
                        <tr key={l.item_id} className={l.shortBy > 0 ? "is-short" : undefined}>
                          <td>
                            <span className={`ds-use-name${l.shortBy > 0 ? " is-short" : ""}`}>
                              {l.name}
                            </span>
                          </td>
                          <td className="is-num">
                            <Qty value={l.qty} unit={l.unit} />
                          </td>
                          <td className="is-num ds-muted-cell">
                            <Qty value={stock} />
                          </td>
                          <td className="is-num">
                            {after < 0 ? (
                              <Qty value={after} unit={l.unit} signed tone="danger" />
                            ) : (
                              <Qty value={after} unit={l.unit} className="ds-medium" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ds-preview-foot">
              {short.length > 0 ? (
                <InlineAlert
                  title={shortTitle}
                  actions={
                    <>
                      <LinkButton size="sm" variant="secondary" href="/app/opnames/new?focus=kitchen">
                        Opname dapur
                      </LinkButton>
                      <LinkButton
                        size="sm"
                        variant="secondary"
                        href="/app/stock-requests/new?focus=kitchen"
                      >
                        Ajukan permintaan
                      </LinkButton>
                    </>
                  }
                >
                  Stok dapur tidak boleh minus, jadi akhir shift belum bisa disimpan. Cek lagi
                  jumlah paket, atau sesuaikan stoknya dulu.
                </InlineAlert>
              ) : null}

              {sameDay > 0 && total > 0 ? (
                <InlineAlert tone="warn" title={`Tanggal ini sudah punya ${sameDay} akhir shift`}>
                  Menyimpan lagi akan mengurangi stok dapur sekali lagi. Lanjutkan hanya kalau ini
                  shift yang berbeda.
                </InlineAlert>
              ) : null}

              {saveInfo ? (
                <InlineAlert
                  role="alert"
                  title={saveInfo.title}
                  actions={
                    <Button size="sm" variant="secondary" onClick={() => void load()}>
                      Muat ulang
                    </Button>
                  }
                >
                  {saveInfo.body}
                </InlineAlert>
              ) : null}

              {blockedReason ? (
                <p id="save-reason" className="ds-reason">
                  {blockedReason}
                </p>
              ) : null}

              <Button
                block
                disabled={!canSubmit}
                aria-describedby={blockedReason ? "save-reason" : undefined}
                onClick={() => void onSave()}
              >
                {saving ? "Menyimpan…" : "Simpan & kurangi stok dapur"}
              </Button>
              <p className="ds-footnote">
                Akhir shift tidak bisa diubah setelah disimpan. Kesalahan dikoreksi lewat opname.
              </p>
            </div>
          </section>
        </div>
      ) : null}
>>>>>>> origin/feat/web-redesign

      <Drawer
        open={!!openId}
        title={openDetail ? `Akhir shift ${formatDateOnly(openDetail.closing_date)}` : "Akhir shift"}
        description={openDetail ? `Dicatat ${formatStamp(openDetail.created_at)}` : undefined}
        onClose={() => setOpenId(null)}
        footer={
          <>
<<<<<<< HEAD
            <p className="muted">{detail.note || "Tanpa catatan"}</p>
            {detail.has_shortage ? (
              <p className="error">
                <span className="badge badge-warn">Ada kekurangan</span>{" "}
                {detail.shortage_note}
              </p>
            ) : null}
            <h2 className="panel-title">Paket</h2>
            <ul>
              {(detail.packages ?? []).map((p) => (
                <li key={p.id}>
                  {p.menu_name} × {p.qty_paket}
                </li>
              ))}
            </ul>
            <h2 className="panel-title">Rincian bahan</h2>
            <ul>
              {(detail.lines ?? []).map((l) => (
                <li key={l.id}>
                  {l.item_sku} — {l.item_name}: {l.qty} {l.unit_code}
                  {l.shortage_qty > 0 ? (
                    <>
                      {" "}
                      <span className="badge badge-warn">
                        kurang {l.shortage_qty} {l.unit_code} (dikurangi{" "}
                        {Math.round((l.qty - l.shortage_qty) * 1000) / 1000})
                      </span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDetail(null)}
              >
                Tutup
              </button>
              <Link className="btn btn-ghost" href="/app/history">
                Lihat riwayat
              </Link>
            </div>
=======
            <LinkButton variant="secondary" href="/app/history">
              Lihat riwayat
            </LinkButton>
            <Button onClick={() => setOpenId(null)}>Tutup</Button>
          </>
        }
      >
        {openDetail ? (
          <>
            <p className="ds-side-text">{openDetail.note || "Tanpa catatan."}</p>
            <h3 className="ds-drawer-section">Paket terjual</h3>
            {(openDetail.packages ?? []).length === 0 ? (
              <p className="ds-card-hint">Memuat isi…</p>
            ) : (
              <ul className="ds-pkg-list">
                {(openDetail.packages ?? []).map((p) => (
                  <li key={p.id}>
                    <span>{p.menu_name}</span>
                    <span className="ds-num ds-medium">{formatQty(p.qty_paket)} paket</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="ds-drawer-section">Bahan yang dikurangi</h3>
            {(openDetail.lines ?? []).length === 0 ? (
              <p className="ds-card-hint">Memuat isi…</p>
            ) : (
              <div className="ds-table-card">
                <div className="ds-table-wrap">
                  <table className="ds-table is-compact">
                    <thead>
                      <tr>
                        <th>Bahan</th>
                        <th className="is-num">Dipakai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(openDetail.lines ?? []).map((l) => (
                        <tr key={l.id}>
                          <td>
                            <div className="ds-cell-stack">
                              <span className="ds-cell-name">{l.item_name}</span>
                              <span className="ds-cell-sub ds-num">{l.item_sku}</span>
                            </div>
                          </td>
                          <td className="is-num">
                            <Qty value={l.qty} unit={l.unit_code} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
>>>>>>> origin/feat/web-redesign
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
