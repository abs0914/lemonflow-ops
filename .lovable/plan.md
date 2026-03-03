

## Add "Verified" Status to Purchase Order Workflow

### Current Flow
```text
draft → submitted → approved (CEO) → Receiving Report
```

### New Flow
```text
draft → submitted → approved (CEO) → verified (Accounting) → Receiving Report
```

After CEO approval, the PO moves to Accounting for verification. Accounting reviews PO details and proof of payment (uploaded by the purchaser), then marks it as "Verified". Only verified POs appear in the Receiving Report.

---

### Database Changes (Migration)

1. Add columns to `purchase_orders`:
   - `verified_by UUID` (nullable, references the Accounting user)
   - `verified_at TIMESTAMPTZ` (nullable)
   - `po_proof_of_payment_url TEXT` (nullable, for uploaded receipt/proof)

2. Update RLS policies:
   - Allow Accounting to UPDATE `purchase_orders` when status is `approved` (to set status to `verified`, record `verified_by`/`verified_at`)
   - Warehouse/Production can UPDATE approved POs to upload proof of payment

3. Create storage bucket `po-payment-proofs` (private) with RLS for upload by Warehouse/Production and viewing by Accounting/Admin/CEO/Finance

---

### File Changes

**`src/types/inventory.ts`**
- Add `'verified'` to the PurchaseOrder status union type
- Add `verified_by`, `verified_at`, `po_proof_of_payment_url` fields

**`src/pages/PurchaseOrderDetail.tsx`**
- When status is `approved`: show file upload for proof of payment (for Warehouse/Production users)
- When status is `approved`: show "Verify" button for Accounting users (reviews details + proof image, moves to `verified`)
- Add `verified` to status badge map (e.g., green "Verified" badge)
- Display uploaded proof of payment image using the existing `ProofImage` pattern

**`src/pages/Purchasing.tsx`**
- Add `verified` tab to the tab list
- Add `verified` to status badge map
- Update Accounting user view: show `approved` POs needing verification instead of only approved
- Update Receiving Report filter references

**`src/pages/IncomingInventory.tsx`** and related components
- Change filter from `status = 'approved'` to `status = 'verified'` so only verified POs appear in Receiving Report

**`src/components/warehouse/GoodsReceivedForm.tsx`**
- Change PO query filter from `"approved"` to `"verified"`

**`src/components/inventory/EnhancedGoodsReceivedForm.tsx`**
- Change PO query filter from `"approved"` to `"verified"`

**`src/components/inventory/PendingReceiptsList.tsx`**
- Change PO query filter from `"approved"` to `"verified"`

**`src/components/purchasing/MobilePOCard.tsx`**
- Add `verified` to status variant map

**`src/pages/CEODashboard.tsx`**
- No changes needed (CEO still approves, flow continues to Accounting)

**`src/hooks/usePurchaseOrders.ts`**
- No changes needed (already fetches all statuses)

---

### Technical Details

- Storage bucket: `po-payment-proofs` (private), files stored as `{po_id}/{filename}`
- Proof of payment upload reuses the same pattern as `ProofImage` component from sales orders
- Accounting verification records `verified_by` and `verified_at` for audit trail
- The `verified` action will also be logged to `audit_logs`

