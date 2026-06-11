## Goal
Prevent any production log from being created when its BOM would push a required ingredient (raw material or component) below its available stock. No partial writes, no clamping.

## Behavior
Before inserting **any** rows in `logProductionMutation` (`src/pages/Production.tsx`):

1. Resolve the BOM rows that will be consumed:
   - Raw material output → `bom_items` where `parent_raw_material_id = <rm.id>`.
   - Component/product output → `bom_items` where `product_id = <resolved product_id>`.
2. For each BOM row, compute `required = bi.quantity * data.quantity`.
3. Batch-fetch current `stock_quantity` and `reserved_quantity` for every distinct `raw_material_id` / `component_id` in the BOM.
4. For each required line, compute `available = stock_quantity - reserved_quantity` and compare against `required`.
5. If **any** line has `available < required`:
   - Abort. Do **not** insert the `assembly_produce` movement, do **not** update output stock, do **not** insert `assembly_consume` movements.
   - Throw an error with a per-item shortage list (name, SKU, required, available, short by). The mutation's `onError` already toasts; we'll format the message so each shortage appears on its own line.
6. If all lines pass, run the existing produce + consume flow. Remove the `Math.max(0, newQty)` clamps in `consumeBom` so any future drift (e.g. concurrent race) surfaces as a real negative instead of being silently floored — the pre-flight check makes this safe in the normal path.

## Edge cases
- **No BOM rows** for the selected output → still allow the log (matches current behavior; produces output with no consumption).
- **Zero-quantity BOM line** → skipped, same as today.
- **Empty product_id resolution** for component output → fall through to the existing SKU-based product lookup before running the pre-flight.
- **Concurrent race** (two users producing the same item) → first commits, second's pre-flight may pass but `consume` could still go slightly negative. Removing the clamp surfaces this honestly; the consume movement is the source of truth, so a tiny negative is recoverable via stock adjustment. (A DB-level transaction/RPC would be the only way to fully eliminate this; out of scope unless you want it.)
- **Reserved stock**: included in the availability calc so production cannot eat into stock already reserved by store orders, per `Stock Reservation Logic` memory.

## Files touched
- `src/pages/Production.tsx` — add `checkBomAvailability()` helper, call it at the top of both branches in `logProductionMutation.mutationFn`, drop the two `Math.max(0, …)` clamps in `consumeBom`.

## Out of scope
- No DB schema changes, no new RPC, no migration.
- No change to stock adjustment, store orders, or BOM editor.
- No override / admin bypass (hard block only, per your decision).

## Verification
- Pick a product whose BOM ingredient has known low stock; attempt to log production for a quantity that exceeds availability → expect toast listing each short ingredient and no rows written to `stock_movements`.
- Log a normal in-stock quantity → expect produce + consume movements written and stock updated exactly as before.
- Check `stock_movements` after a blocked attempt to confirm zero new rows for that timestamp.