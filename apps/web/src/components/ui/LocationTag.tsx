export type Location = "warehouse" | "kitchen";

/** ■ navy square = Gudang, ● teal circle = Dapur. Never colour alone. */
export function LocationShape({
  location,
  className = "",
}: {
  location: Location;
  className?: string;
}) {
  return (
    <span
      className={`ds-loc-shape ds-loc-shape-${location} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

type LocationTagProps = {
  location: Location;
  /** Overrides the default "Gudang" / "Dapur", e.g. "Pintu gudang". */
  label?: string;
  /** `sm` = 12px, for tight rows; `md` = 13px, for page content. */
  size?: "sm" | "md";
  /** Use on the dark navy sidebar / summary bars. */
  onDark?: boolean;
  className?: string;
};

export function LocationTag({
  location,
  label,
  size = "md",
  onDark = false,
  className = "",
}: LocationTagProps) {
  const text = label ?? (location === "kitchen" ? "Dapur" : "Gudang");
  const cls = [
    "ds-loc",
    `ds-loc-${location}`,
    size === "sm" ? "ds-loc-sm" : "",
    onDark ? "is-on-dark" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      <LocationShape location={location} />
      {text}
    </span>
  );
}
