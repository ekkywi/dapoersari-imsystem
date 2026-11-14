import Link from "next/link";
import { LocationShape, type Location } from "@/components/ui/LocationTag";

type LocationSwitchProps = {
  current: Location;
  /** Hide a side the user cannot open (the route would just redirect them away). */
  show?: { warehouse: boolean; kitchen: boolean };
  hrefs?: { warehouse: string; kitchen: string };
};

/** Segmented Gudang | Dapur control. Two links, not state: each side is its own route. */
export function LocationSwitch({
  current,
  show = { warehouse: true, kitchen: true },
  hrefs = { warehouse: "/app/warehouse/stocks", kitchen: "/app/kitchen/stocks" },
}: LocationSwitchProps) {
  const sides: { loc: Location; label: string }[] = [
    { loc: "warehouse", label: "Gudang" },
    { loc: "kitchen", label: "Dapur" },
  ];
  const visible = sides.filter((s) => show[s.loc]);
  if (visible.length < 2) return null;
  return (
    <div className="ds-seg" role="group" aria-label="Lokasi">
      {visible.map(({ loc, label }) => (
        <Link
          key={loc}
          href={hrefs[loc]}
          className="ds-seg-item"
          aria-current={current === loc ? "page" : undefined}
        >
          <LocationShape location={loc} />
          {label}
        </Link>
      ))}
    </div>
  );
}
