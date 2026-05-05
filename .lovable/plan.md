## Goal

Let Warehouse, Production, and Admin write down weight loss on perishable raw materials (fruits, etc.) so stock figures match physical reality before items hit production.

## Approach

Manual Shrinkage Adjustment — flag perishable items, then post a `shrinkage` stock movement whenever a recount shows weight loss. No automatic depletion, no batch tracking. Fully auditable via existing `stock_movements` infrastructure.

---

## Database changes (migration)

1. **`raw_materials.is_perishable`** — new `boolean` column, default `false`. Marks fruit/produce items eligible for shrinkage tracking.
2. **`stock_movements` `valid_movement_type` constraint** — extend to allow `'shrinkage'` as a movement_type (alongside existing receipt/issue/adjustment/assembly_produce/etc).
3. **`post_shrinkage_adjustment` RPC** — security-definer function that:
   - Verifies caller is Admin/Warehouse/Production
   - Verifies the raw material has `is_perishable = true`
   - Inserts a `stock_movements` row (`movement_type = 'shrinkage'`, negative `quantity`, notes, `performed_by`)
   - Decrements `raw_materials.stock_quantity` by the loss amount (clamped at 0)
   - Returns the new stock quantity
   - Uses `.select()`-style verification per the RLS Mutation core rule

No CHECK constraints based on time; pure structural changes only.

## UI changes

**`src/pages/RawMaterials.tsx`**
- Add a "Perishable" toggle column (Admin-editable) in the raw material table/edit form.
- Add a "Log Shrinkage" action button on each perishable row (visible to Admin/Warehouse/Production).
- Visual badge ("Perishable") on perishable rows so operators can spot them at a glance.

**New `src/components/inventory/LogShrinkageDialog.tsx`**
- Inputs: current stock (read-only), recounted weight (numeric), auto-calculated loss, reason notes (required), date.
- On submit: calls `post_shrinkage_adjustment` RPC; toasts success; invalidates raw materials + stock movements queries.

**`src/pages/Inventory.tsx` / movement history views**
- Render `shrinkage` movements with a distinct label/color (e.g. amber "Shrinkage") so they're visually separate from regular issues/receipts.

## Reporting touch-up

- In existing stock movement listings, ensure `shrinkage` rows show up under raw material history with the negative quantity and reason.
- Optional (small): add a "Total shrinkage (last 30 days)" stat to the raw material detail/row for visibility. Confirm if you want this now or later.

## Production interaction

No change to BOM consumption logic. Because shrinkage is written down before production runs, the existing assembly reservation/consumption math stays correct — it always operates on the latest `stock_quantity`.

## Memory updates

- Update `mem://inventory/perishables-expiry-workflow` to also cover shrinkage adjustments, OR add a new memory `mem://inventory/perishables-shrinkage-workflow` describing: perishable flag, manual shrinkage movement type, allowed roles (Admin/Warehouse/Production), no auto-depletion.
- Update Core rule for Stock Movements to include `'shrinkage'` as a recognized movement type.

## Out of scope (can revisit later)

- Auto time-based shrinkage curves
- Per-batch tracking with FIFO
- Yield % auto-inflation on BOM consumption