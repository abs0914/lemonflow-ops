## Goal
Add a new column to the Purchase Order Detail "Line Items" table showing the current inventory quantity (stock on hand) for each line's item.

## Changes

**1. `src/hooks/usePurchaseOrders.ts` — `usePurchaseOrderLines`**
Extend the joined selects to include `stock_quantity`:
- `components(id, sku, name, unit, autocount_item_code, stock_quantity)`
- `raw_materials(id, sku, name, unit, autocount_item_code, stock_quantity)`

**2. `src/pages/PurchaseOrderDetail.tsx` — Line Items table**
- Add a new `<TableHead className="text-right">Stock On Hand</TableHead>` column after **SKU** (before **Ordered**).
- In each row, render `{item?.stock_quantity ?? 0}` with the item's UOM, e.g. `120 pcs`.
- Update the expanded-receipts `colSpan` values so the sub-rows still align (the row currently spans 9 columns; new total becomes 10).

## Notes
- Uses the local `stock_quantity` field already on `components` / `raw_materials` (same source used by other inventory views in the app). Per project memory, AutoCount remains the source of truth and is reconciled by the 5-min background sync, so this column reflects the latest synced balance without any new network calls.
- Display-only; no business logic, mutations, or schema changes.