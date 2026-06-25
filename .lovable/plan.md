## Goal
Enhance the **Reports → Store Order Consolidation** report with:
1. A new **Unit Cost** column per item (pulled from the inventory master).
2. Per-item **expand/collapse** that reveals each contributing order's line items (Order #, Store, Qty, Unit Cost, Subtotal).

## Changes — `src/components/reports/StoreOrderConsolidationReport.tsx`

### Data layer (`useStoreOrderConsolidation`)
- Extend the inventory fetch to also pull cost:
  - `components`: add `cost_per_unit`
  - `raw_materials`: add `unit_cost`
- Build a parallel `costMap: Map<string, number>` keyed by `autocount_item_code` and `sku` (mirrors the existing `stockMap` pattern).
- Extend the order select to include `store_id` and `stores(store_name)` (already present) so each per-order sub-row knows the store name.

### Aggregation
- `AggItem` gains `unit_cost: number | null`.
- Replace `orders: Map<string, number>` with `orders: Map<string, { qty: number; store_name: string; order_id: string }>` so each contributing order tracks store + qty.
- On first sight of an item, look up `unit_cost` from `costMap` (null if missing).

### Table UI
- Add an extra leading column with a chevron toggle (`ChevronRight` / `ChevronDown`) — clicking the row toggles expand state held in `expandedKeys: Set<string>` keyed by `${delivery_date}|${item_code}`.
- New headers (in order): **(toggle)**, Item Code, Item Name, Orders, UOM, **Unit Cost**, Released Qty, On-hand, Balance, **Subtotal** (Released Qty × Unit Cost).
- Show `—` for Unit Cost / Subtotal when cost is null.
- When expanded, render a sub-row spanning the full table with a nested compact table:
  - Columns: Order #, Store, Qty, Unit Cost, Subtotal.
  - Rows: one per contributing order, sorted by order number.
  - Footer row: total qty and total subtotal for that item.

### Print + CSV
- **Print** (`handlePrint`): the printable HTML already mirrors `printRef.current.innerHTML`. Force all groups expanded for print by temporarily setting all keys expanded before snapshotting, OR (simpler) build a print-only DOM block that always shows the sub-rows. Implementation: keep current approach but render hidden `data-print-only` expanded sub-rows alongside the toggle-controlled ones; add print CSS so `data-print-only` is visible only in the printed window (`<style>` already inlined in `handlePrint`).
- **CSV** (`handleCSV`): add `Unit Cost` and `Subtotal` columns to the header and to each item row. Keep one row per item (the existing aggregated shape) — the per-order detail is already encoded in the existing `Orders` column ("SO-… (qty); SO-… (qty)"), so no extra CSV rows needed.

### Misc
- Update the helper text under the filters to mention "Unit cost is the value set on the inventory master."
- No schema or RLS changes; cost columns already exist on `components.cost_per_unit` and `raw_materials.unit_cost`.

## Out of scope
- No changes to the Released Items report, no changes to sales order data, no edits to AutoCount sync.