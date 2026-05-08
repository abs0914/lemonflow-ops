## Goal

Let Fulfillment users edit quantities, remove existing items, or add new items to a sales order (in `submitted` or `processing` status) — instead of only being able to mark the order with issues. Every change is logged in `audit_logs` so the trail is preserved, and reserved stock is re-synced when lines change.

## UX

On `FulfillmentOrderDetail` (Order Items card), when the order status is `submitted` or `processing` and the user is Fulfillment/Admin:

- Each line row gets two icon buttons: **Edit** (pencil) and **Delete** (trash).
- Clicking Edit opens a small dialog with Quantity + Unit Price inputs (recomputes subtotal live). Save requires a short "Reason for change" note.
- Clicking Delete opens a confirm dialog also requiring a reason.
- An **"Add Item"** button above the table opens the existing item-picker (reusing `ItemSelector` from Store Order Create) to append a new line; also requires a reason.
- After every change: order `total_amount` is recalculated, line numbers are renumbered, and an `audit_logs` row is written with `entity_type='sales_order'`, `entity_id=<order id>`, `action='line_updated' | 'line_deleted' | 'line_added'`, and `details` containing the before/after snapshot + reason + user.
- A new **"Order Change History"** collapsible card on the detail page lists those audit log entries (timestamp, user, action, item, qty before/after, reason).

The existing **Mark with Issues** button stays as-is for cases where the team wants to flag the whole order without editing it.

## Stock handling

For `processing` orders (stock already reserved/synced) we must keep reservations consistent:

1. Before applying a line change, call `release_sales_order_stock(order_id)` to free reserved qty.
2. Apply the line insert/update/delete.
3. Recalculate and update `sales_orders.total_amount`.
4. Re-reserve via the existing `reserve_sales_order_stock` RPC (already used at submit time).
5. If the order is already AutoCount-synced (`autocount_synced=true`), show a warning toast: "Order already synced to AutoCount — please update there manually" (we will not auto-push edits to AutoCount in this iteration).

For `submitted` (not yet approved/reserved) orders, no stock RPC calls are needed — just edit the lines and recalc total.

## Technical changes

**New file `src/components/fulfillment/EditOrderLinesPanel.tsx`**
- Renders the lines table with Edit/Delete buttons + Add Item button.
- Internal dialogs for edit/delete/add, each with a required "Reason" textarea.
- Calls a new hook `useFulfillmentLineMutations` for all mutations.

**New hook `src/hooks/useFulfillmentLineMutations.ts`**
- `updateLine({ orderId, lineId, quantity, unit_price, reason })`
- `deleteLine({ orderId, lineId, reason })`
- `addLine({ orderId, item, quantity, reason })` (item shape from ItemSelector)
- Each mutation:
  1. Reads current line (for before-snapshot).
  2. If order.status === 'processing' && order.stock_reserved → `supabase.rpc('release_sales_order_stock', { p_sales_order_id })`.
  3. Performs insert/update/delete on `sales_order_lines` (with `.select()` + length check per memory rule).
  4. Re-fetches lines, recomputes `total_amount = sum(sub_total)`, renumbers `line_number`.
  5. Updates `sales_orders` total + `updated_at`.
  6. If was reserved → `supabase.rpc('reserve_sales_order_stock', { p_sales_order_id })`.
  7. Inserts an `audit_logs` row with full before/after JSON + reason.
  8. Invalidates `['sales-order-lines', orderId]`, `['sales-orders']`, and a new `['order-audit-logs', orderId]` query.

**New hook `src/hooks/useOrderAuditLogs.ts`**
- Fetches `audit_logs` where `entity_type='sales_order'` and `entity_id=orderId`, joined with `user_profiles(full_name)` for display.

**New component `src/components/fulfillment/OrderChangeHistory.tsx`**
- Collapsible card showing the audit log timeline.

**Modify `src/pages/FulfillmentOrderDetail.tsx`**
- Replace the readonly `OrderLineForm` block with `EditOrderLinesPanel` when the user can edit (status submitted/processing, role Fulfillment/Admin), keeping readonly view otherwise.
- Add `OrderChangeHistory` card in the right column.

**Modify `src/components/store-orders/OrderLineForm.tsx`**
- No change required (still used in readonly mode).

**RLS**
- `sales_order_lines` already has *"Fulfillment can manage order lines"* policy covering submitted/processing — no migration needed.
- `audit_logs` already has *"Authenticated users can insert audit logs"* — no migration needed.
- Confirm `reserve_sales_order_stock` exists; if not, a small migration adds it (mirroring `release_sales_order_stock`). I will check during implementation and add only if missing.

**Audit log shape**
```json
{
  "action": "line_updated",
  "reason": "Customer requested less qty",
  "before": { "item_code": "...", "quantity": 10, "unit_price": 50, "sub_total": 500 },
  "after":  { "item_code": "...", "quantity": 6,  "unit_price": 50, "sub_total": 300 }
}
```

## Out of scope

- Auto-pushing line edits to AutoCount (warning shown instead).
- Editing other order fields (delivery date, fees) — already handled elsewhere.
