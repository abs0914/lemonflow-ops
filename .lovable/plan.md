

# Update PO Status on Goods Receipt

## Problem
When goods are received via the Receiving Report, the PO's `goods_received` flag and per-line received quantities are never updated. The system only tracks receipts through `stock_movements` lookups.

## Changes

### 1. Database migration: Add `received_quantity` to `purchase_order_lines`
- Add column `received_quantity NUMERIC NOT NULL DEFAULT 0`
- This becomes the authoritative tracker for partial receipts per line

### 2. Update `EnhancedGoodsReceivedForm.tsx` receive mutation
After inserting stock movements, add these steps:
- For each received line, increment `purchase_order_lines.received_quantity` by the quantity received (using current value + new qty via a read-then-update or raw SQL increment)
- After all lines are updated, re-fetch all lines for the PO and check if every line has `received_quantity >= quantity`
- If fully received: update `purchase_orders` set `goods_received = true`, `received_at = now()`, `received_by = profile.id`
- Invalidate the `approved-pos-for-receiving` query so the PO disappears from the dropdown once fully received

### 3. UI enhancement
- Use the new `received_quantity` column from `purchase_order_lines` instead of summing `stock_movements` (replace the `receivedData` query)
- Already-received and remaining columns will use this authoritative field

## Technical Detail
- The increment must handle concurrent receives safely. We'll use Supabase RPC or read-then-write pattern since `purchase_order_lines` doesn't support SQL increments via the JS client directly. A simple approach: read current `received_quantity`, add new qty, write back. Acceptable for this use case (low concurrency).
- Existing RLS policies on `purchase_order_lines` already allow Admin/Warehouse/Production to update, so no new policies needed.
- The `purchase_orders` table already has `goods_received`, `received_at`, and `received_by` columns ready to use.

