

## Add Proof of Payment Upload & Updated Franchisee Workflow

### Updated Workflow

The franchisee order flow changes from:

```text
Current:  submitted → pending_payment (Finance) → pending_accounting (Accounting) → processing (Fulfillment)

New:      submitted → pending_payment (Finance sets fees/dates) → awaiting_proof (Franchisee uploads proof) → pending_accounting (Accounting reviews proof & approves) → processing (Fulfillment)
```

Finance no longer confirms payment directly. Instead, Finance sets delivery/shipping fees and delivery date, then sends it back to the franchisee to upload proof of payment. Only after the franchisee uploads the screenshot does it go to Accounting for final approval.

### Database Changes

1. **New status value**: Add `awaiting_proof` to the sales order status flow
2. **New column on `sales_orders`**: `proof_of_payment_url TEXT` to store the uploaded file path
3. **Storage bucket**: Create `payment-proofs` bucket (private) with RLS policies allowing:
   - Store users to upload files for their own orders
   - Finance, Accounting, Admin to view files
4. **RLS policy updates**: 
   - Store users can UPDATE orders in `awaiting_proof` status (to set `proof_of_payment_url`)
   - Finance `WITH CHECK` expression updated to allow transitioning to `awaiting_proof`

### File Changes

**`src/types/sales-order.ts`**
- Add `awaiting_proof` to the status union type
- Add `proof_of_payment_url?: string` field

**`src/hooks/useFinanceOrders.ts`** (`useConfirmPayment`)
- Change target status from `pending_accounting` to `awaiting_proof`
- Remove AutoCount sync from this step (moved to later, or kept at accounting approval)

**`src/pages/FinanceOrderDetail.tsx`**
- Update button label from "Confirm Payment" to "Send for Proof of Payment" or similar
- Finance sets fees, dates, and sends order back to franchisee

**`src/pages/StoreOrderDetail.tsx`**
- When order status is `awaiting_proof`, show:
  - Order summary with fees set by Finance (grand total)
  - File upload input for proof of payment screenshot
  - "Submit Proof" button that uploads file to storage and updates `proof_of_payment_url`, moving status to `pending_accounting`

**`src/pages/StoreOrders.tsx`**
- Add `awaiting_proof` tab/filter so franchisees can see orders needing their action

**`src/pages/AccountingOrderDetail.tsx`**
- Display the uploaded proof of payment image
- Keep existing approve flow (moves to `processing`)

**`src/hooks/useAccountingOrders.ts`** / **`src/hooks/useFinanceOrders.ts`**
- Update mutation logic for new status transitions

**Status color maps** (multiple files)
- Add `awaiting_proof: "bg-amber-100 text-amber-800"` entry

**`src/components/store-orders/MobileOrderCard.tsx`**
- Add `awaiting_proof` status color

**RLS policies** (migration)
- Store users: allow UPDATE on `awaiting_proof` orders (to upload proof)
- Finance: update WITH CHECK to include `awaiting_proof` as target status

### Technical Details

**Storage setup** (SQL migration):
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Store users can upload to their order folders
CREATE POLICY "Store users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND ...);

-- Finance, Accounting, Admin can view
CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs' AND ...);
```

**Upload flow**: File is uploaded to `payment-proofs/{order_id}/{filename}`, then the signed/public URL is stored in `sales_orders.proof_of_payment_url`.

**Sales order column** (SQL migration):
```sql
ALTER TABLE sales_orders ADD COLUMN proof_of_payment_url TEXT DEFAULT NULL;
```

### Files Modified
- New database migration (column + storage bucket + RLS)
- `src/types/sales-order.ts`
- `src/hooks/useFinanceOrders.ts`
- `src/hooks/useAccountingOrders.ts`
- `src/pages/StoreOrderDetail.tsx`
- `src/pages/StoreOrders.tsx`
- `src/pages/FinanceOrderDetail.tsx`
- `src/pages/AccountingOrderDetail.tsx`
- `src/components/store-orders/MobileOrderCard.tsx`
- Status color maps across affected files

