

# Add `partially_received` Status + Batch Receipt Sub-rows to Purchase Orders

## Summary
Introduce a `partially_received` status to the PO lifecycle. When at least one line has received goods but not all are fully received, the PO transitions to `partially_received`. When all lines are fully received, it transitions to `received`. On the PO Detail page, each line item shows expandable sub-rows displaying individual receipt batches (from `stock_movements`).

## Database Changes

### Migration 1: Update PO status constraint + add `partially_received`
```sql
ALTER TABLE public.purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
ADD CONSTRAINT purchase_orders_status_check
CHECK (status = ANY (ARRAY[
  'draft'::text, 'submitted'::text, 'approved'::text, 
  'verified'::text, 'partially_received'::text, 'received'::text, 
  'cancelled'::text
]));
```

No new columns needed -- `goods_received` boolean is kept for backward compatibility but the `status` field now drives the lifecycle.

## Code Changes

### 1. `src/types/inventory.ts` — PurchaseOrder type
- Add `'partially_received' | 'received'` to the `status` union type

### 2. `src/components/inventory/EnhancedGoodsReceivedForm.tsx` — Receipt logic
- After incrementing `received_quantity` on lines, check:
  - If ALL lines fully received → set `status = 'received'`, `goods_received = true`, `received_at`, `received_by`
  - Else if ANY line has `received_quantity > 0` → set `status = 'partially_received'`
- Update the PO query filter to include `partially_received` status (so partially received POs still appear for further receipts)

### 3. `src/components/inventory/PendingReceiptsList.tsx`
- Update query to also show `partially_received` POs (not just `verified`)

### 4. `src/pages/IncomingInventory.tsx`
- Update KPI queries to include `partially_received` status in pending PO counts

### 5. `src/pages/Purchasing.tsx` — Status display
- Add `partially_received` and `received` to `getStatusBadge()` with appropriate colors (amber for partial, green for received)
- Add tab triggers for new statuses
- Update finance filter logic to recognize new statuses

### 6. `src/components/purchasing/MobilePOCard.tsx`
- Add `partially_received` and `received` to status variant map

### 7. `src/pages/PurchaseOrderDetail.tsx` — Batch sub-rows
- After the line items table, for each PO line, fetch `stock_movements` where `reference_type = 'purchase_order_line'` and `reference_id = line.id`
- Add a `received_quantity` column and a progress indicator (e.g., "5/10") to each line row
- Make each line expandable: clicking reveals sub-rows showing each receipt batch with: date received, batch number, quantity received, warehouse location, performed by
- Show delivery date tracking on the PO header (already exists as `delivery_date` column)

### 8. `src/hooks/usePurchaseOrders.ts` — Fetch receipt batches
- Add a new hook `usePOLineReceipts(purchaseOrderId)` that fetches stock movements grouped by PO line (`reference_type = 'purchase_order_line'`, `purchase_order_id = poId`) with performer profile names

### 9. `src/components/warehouse/ReceiveFromCashPO.tsx`
- Apply same partially_received / received logic as EnhancedGoodsReceivedForm

### 10. RLS — No changes needed
- Stock movements already allow authenticated reads; PO update policies for Warehouse/Admin cover the status update

## Status Lifecycle
```text
draft → submitted → approved → verified → partially_received → received
                                    └──────────────────────────→ received
                                                                  (if all lines received at once)
```

