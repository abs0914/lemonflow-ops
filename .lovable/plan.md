## Released Items by Item Report

A new report tab in `/reports` showing released items grouped by item + store, filterable by delivery date range and specific item(s), with print and CSV export.

### Definition
"Released" = sales order lines belonging to orders in `submitted` or `processing` status (stock has been reserved/committed) whose `delivery_date` falls in the selected range.

### UI

- New tab **"Released Items"** in `src/pages/Reports.tsx`
- Roles: Admin, Warehouse, Fulfillment, CEO, Finance
- File: `src/components/reports/ReleasedItemsReport.tsx`

### Filters

- Delivery date range (uses the global `ReportFilters` date range already on the page)
- **Item filter** (searchable multi-select of item code / item name, populated from distinct items appearing in the result set)
- Optional store filter
- Search box for free-text on item name / code

### Layout

Grouped by **Item**, then a sub-row per **Store**:

```text
Item: TLC00123 — Lemon Syrup 1L (UOM: BOT)        Total Released: 240
  ├─ Store A (FRC-TLC-001)           120   [3 orders: SO-001, SO-002, SO-003]
  ├─ Store B (STR-TLC-002)            80   [2 orders]
  └─ Store C (FRC-TLC-004)            40   [1 order]
```

Table columns:
- Item Code, Item Name, UOM, Store Code, Store Name, Released Qty, # Orders, Order Numbers

Plus a KPI strip: Total Items, Total Stores, Total Released Qty, Total Orders.

### Actions
- **Print** — opens print window with clean table styling (same pattern as `StoreOrderConsolidationReport`).
- **CSV** — exports the flat item × store rows.

### Technical

- Query `sales_orders` (status in submitted/processing, delivery_date between from/to) joined with `stores(store_name, store_code)` and `sales_order_lines`.
- Aggregate client-side into `Map<item_code, Map<store_id, { qty, orderNumbers: Set }>>`.
- Item filter dropdown built from distinct `(item_code, item_name)` pairs in the fetched lines.
- Reuse `format` from date-fns and existing shadcn `Table`, `Select`, `Input`, `Badge`, `Button` components.
- No DB schema changes, no new RLS — existing read policies cover Admin/Warehouse/Fulfillment/CEO/Finance.

### Files
- **New**: `src/components/reports/ReleasedItemsReport.tsx`
- **Edit**: `src/pages/Reports.tsx` (register new report config + import)
