## Goal

Give Warehouse a consolidation report for store orders being prepared for fulfillment, grouped **per delivery date**, so they can compare what's been released vs. on-hand stock and see how many stores each delivery covers.

## Approach

New Warehouse-facing report added to the Reports page (visible to Admin + Warehouse). It pulls `sales_orders` with status `submitted` / `processing` (the "being prepared" pipeline), grouped by `delivery_date`.

Warehouse already has SELECT on `sales_orders` and `sales_order_lines` — no DB changes required.

## Report layout

User picks a **date range** (defaults to today → +7 days) filtering on `delivery_date`. Orders with no `delivery_date` are shown in a separate "Unscheduled" group so they aren't lost.

For each delivery date group:

- **Header row**: Delivery Date · # Stores · # Orders · Total Items
- **Items table** with columns:
  - Item Code
  - Item Name
  - UOM
  - **Total Released Qty** (sum across all orders for that delivery date)
  - **On-hand Qty** (from `components.stock_quantity` / `raw_materials.stock_quantity`, joined by item code → AutoCount code/SKU)
  - **Variance** (On-hand − Released), highlighted red when negative so warehouse instantly sees shortfalls

Top-of-card actions: Print, CSV export, date range picker. CSV/print preserve the per-delivery grouping.

## Changes

**New `src/components/reports/StoreOrderConsolidationReport.tsx`**
- Accepts `{ dateRange }` from Reports.tsx (used as the delivery_date filter).
- Fetches `sales_orders` (status in `submitted`, `processing`) where `delivery_date` is within range OR null, plus their `sales_order_lines` and stores.
- Fetches `components` + `raw_materials` (item code, stock_quantity, autocount_item_code, sku) once and builds an item-code → on-hand map.
- Groups in-memory by `delivery_date`, aggregates quantity per item_code, counts unique `store_id`s and order IDs.
- Renders one card/section per delivery date with the items table + summary chips.
- Print and CSV export.

**`src/pages/Reports.tsx`**
- Add report config:
  - id: `store-order-consolidation`
  - title: "Store Order Consolidation"
  - description: "Items released per delivery date for fulfillment, with on-hand variance"
  - roles: `["Admin", "Warehouse"]`
  - component: `StoreOrderConsolidationReport`

## Out of scope
- No changes to the existing Fulfillment Dashboard consolidation tab.
- No new RLS, hooks, or DB migrations.
- No editing of stock from this report (read-only).
