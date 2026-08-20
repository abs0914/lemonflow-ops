# Export All BOMs to CSV

Add an "Export All BOMs" button to the BOM Manager page header that downloads one CSV containing every product and raw-material recipe with its line items.

## What the user gets

- A single button next to the BOM Manager title.
- Clicking it fetches all BOM parents (products + raw materials flagged as BOM products) and all their BOM lines, then downloads `bom-export-YYYY-MM-DD.csv`.
- Flat one-row-per-line-item layout so it can be filtered/pivoted in Excel:

```text
Parent SKU, Parent Name, Parent Type, Parent Unit, Item SKU, Item Name, Item Type, Quantity, Unit, Cost per Unit, Line Total
```

- BOMs with no line items still appear as one row with blank item fields, so nothing silently disappears.
- Rows are grouped by parent, in the same sort order as the on-screen list. No total rows are added — totals stay computable in Excel.
- Toast on success; toast error if the fetch fails or there is nothing to export.

## Technical notes

- New component `src/components/bom/ExportBomsButton.tsx`, rendered in `src/pages/BomManager.tsx` header row.
- On click (not on page load), query:
  - `products` (id, name, sku, unit) and `raw_materials` (id, name, sku, unit) for parents flagged via `is_bom_product` or referenced by `bom_items.parent_raw_material_id` — same logic as the existing `bom-parents` query in `ProductList.tsx`.
  - `bom_items` with `*, raw_materials!bom_items_raw_material_id_fkey(name, sku, unit, cost_per_unit), components(name, sku, unit, cost_per_unit)` — same select shape as `BomEditor.tsx`, no filter, then group in JS by `product_id` / `parent_raw_material_id`.
- Reuse the existing CSV escaping/download approach from `src/components/reports/ReportTable.tsx` (quote values containing commas/quotes, Blob + anchor download).
- Costs written as raw numbers (no currency symbol) so Excel treats them as numeric.
- No database changes, no changes to existing BOM edit behaviour.
