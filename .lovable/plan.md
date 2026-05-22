## Goal
Add a per-item checkbox in Inventory that controls whether each item appears in the Store Orders item selector.

## Database
Add a new column to `components`:
- `visible_in_store_orders boolean NOT NULL DEFAULT false`

No backfill — all existing items start hidden, per your choice. Admins toggle on the ones franchisees should see.

## Backend / Data layer
- `useInventoryItems` (used by store order create + quick entry): filter `.eq("visible_in_store_orders", true)` in addition to existing `stock_control = true`.
- `useValidateItemCodes` / quick-order parser: also gate on `visible_in_store_orders` so hidden items are reported as unavailable for store orders.

## UI changes
1. **Inventory list (`src/pages/Inventory.tsx` + table/MobileCard)** — add a "Store Orders" column with a Switch/Checkbox. Toggling instantly updates the row via Supabase using the `.select() + length` pattern. Admin/Warehouse only.
2. **Add Inventory dialog** — new "Show in Store Orders" checkbox (default off).
3. **Edit Inventory dialog (`EditInventoryDialog.tsx`)** — new "Show in Store Orders" checkbox bound to `visible_in_store_orders`.
4. **Bulk CSV import/export** — include the new column so admins can bulk-flag items.

## Out of scope
- Raw materials (already not exposed to store orders).
- No change to AutoCount sync — the flag is local-only.

## Memory
Add a new memory entry: `mem://inventory/store-order-visibility-flag` describing the `visible_in_store_orders` gate and that items default to hidden.
