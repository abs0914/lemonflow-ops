
## Goal
Eliminate two remaining sources of inventory drift between database and physical stock:
1. Concurrent production race (pre-flight and consume not atomic).
2. Silent `GREATEST(0, ...)` clamps in sales-order completion and shrinkage RPCs that hide negatives.

---

## Part 1 — Atomic production logging RPC

### New function: `public.log_production(p_item_type, p_item_id, p_quantity, p_notes, p_batch_number)`

- `SECURITY DEFINER`, `search_path = public`.
- Wrapped implicitly in a single transaction (function call = txn).
- Steps inside the function:
  1. Validate auth + role (Admin/Production/Warehouse).
  2. Resolve the BOM:
     - `item_type = 'raw_material'` → `bom_items WHERE parent_raw_material_id = p_item_id`.
     - `item_type = 'component'` → resolve `product_id` from `components.sku`/`autocount_item_code` → `bom_items WHERE product_id = …`.
  3. **Lock every BOM ingredient row** with `SELECT ... FOR UPDATE` on `raw_materials` / `components` by id. This serializes concurrent runs against the same ingredients — second caller blocks until first commits, then re-reads fresh quantities.
  4. Pre-flight: for each BOM line, compute `required = bi.quantity * p_quantity`; compare against `stock_quantity - reserved_quantity`. If any short, `RAISE EXCEPTION` with a JSON-encoded shortage list (name, sku, required, available, short_by). Transaction rolls back, nothing written.
  5. Insert `assembly_produce` stock movement for the output and increment its `stock_quantity` (lock output row too).
  6. For each BOM line: insert `assembly_consume` movement (negative qty) and decrement `stock_quantity` **without clamping**. Reserved is left alone (production doesn't reserve, only respects).
  7. Return `jsonb` with `{ success, produced_movement_id, consumed_movement_ids[] }`.

### Client changes — `src/pages/Production.tsx`
- Replace the multi-step `logProductionMutation.mutationFn` body with a single `supabase.rpc('log_production', { ... })` call.
- Parse the thrown exception message; if it carries the shortage JSON, format the existing per-item toast. Otherwise show the raw message.
- Delete the now-unused `checkBomAvailability` helper and `consumeBom` helper (logic moved into the RPC).
- No change to mutation `onSuccess` invalidations.

### Grants
- `GRANT EXECUTE ON FUNCTION public.log_production(...) TO authenticated;`

---

## Part 2 — Remove silent zero-clamps

### `public.complete_sales_order_stock(p_sales_order_id)`
- Change both decrements from `GREATEST(0, stock_quantity - v_line.quantity)` and `GREATEST(0, reserved_quantity - v_line.quantity)` to plain `stock_quantity - v_line.quantity` and `reserved_quantity - v_line.quantity`.
- Real negatives now persist so reconciliation can see them.

### `public.post_shrinkage_adjustment(p_raw_material_id, p_loss_quantity, p_notes)`
- Change `v_new_qty := GREATEST(0, v_current_qty - p_loss_quantity);` to `v_new_qty := v_current_qty - p_loss_quantity;`.
- Keep the existing positive-loss validation.

Both changes are made via a single migration that `CREATE OR REPLACE`s the two functions.

---

## Files touched
- **New migration** — `log_production` function + grant; `CREATE OR REPLACE` `complete_sales_order_stock` and `post_shrinkage_adjustment` without `GREATEST`.
- **`src/pages/Production.tsx`** — swap inline produce/consume logic for `supabase.rpc('log_production', …)`; remove helpers; keep toast formatting for shortage errors.

## Out of scope
- No UI changes beyond Production.tsx wiring.
- No changes to stock-adjustment dialog, store-order reservation, BOM editor, or AutoCount sync paths.
- No reconciliation report (separate task if you want it next).
- No DB-level constraint to forbid negative `stock_quantity` (would break the visibility goal).

## Verification
- Two simultaneous production logs for the same BOM ingredient near its limit → first succeeds, second either succeeds with fresh availability or fails the pre-flight with a clean shortage error. No partial writes, no silent negatives caused by the race.
- Insufficient stock for a single run → RPC raises, zero new rows in `stock_movements` for that timestamp.
- Successful run → one `assembly_produce` + N `assembly_consume` rows, ingredient `stock_quantity` decremented exactly by `bi.quantity * p_quantity`.
- Complete a sales order whose component reservation is artificially desynced (e.g. reserved=0 but line qty=5) → `stock_quantity` and `reserved_quantity` go negative instead of flooring at 0; visible in inventory views.
- Log shrinkage greater than current stock → resulting `stock_quantity` is negative; movement row matches the loss; no exception.
