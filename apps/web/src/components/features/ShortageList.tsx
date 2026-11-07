import { ShortageDetail } from "@/lib/api";

/** Lists every short item returned by a 409 insufficient_stock response. */
export function ShortageList({
  items,
  title = "Bahan yang kurang",
}: {
  items: ShortageDetail[];
  title?: string;
}) {
  return (
    <div className="error" role="alert">
      <p>
        <strong>{title}:</strong>
      </p>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bahan</th>
              <th>Dibutuhkan</th>
              <th>Tersedia</th>
              <th>Kurang</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.item_id}>
                <td>
                  <strong>{d.sku}</strong> — {d.name}
                </td>
                <td>
                  {d.dibutuhkan} {d.unit}
                </td>
                <td>
                  {d.tersedia} {d.unit}
                </td>
                <td>
                  <strong>
                    {d.kurang} {d.unit}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
