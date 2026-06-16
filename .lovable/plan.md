# Store Ordering Process — Mermaid Diagram

Create `/mnt/documents/Store_Order_Flow.mmd` with a `flowchart TD` covering the full store order lifecycle, then surface it as a `lov-artifact`.

## Scope covered

1. **Order Creation (Franchisee / Own Store)**
   - Draft → add items (Quick Order or manual) → UOM auto-pulled from inventory master → totals calculated
   - Submit → status = `submitted` → `reserved_quantity += qty` on each item → `notify_store_users`

2. **Branching by store type**
   - **Franchisee** path:
     - `submitted` → Finance review → upload proof of payment (private bucket) → status = `awaiting_proof`
     - Finance validates proof, applies fees (delivery, shipping, expedite), VAT/EWT, discount, under/overpayment → approves → `for_accounting_approval`
     - Finance can reject → `cancelled` with reason shown to franchisee
   - **Own store** path:
     - `submitted` → Fulfillment approves directly → `for_accounting_approval`

3. **Accounting Approval**
   - Reviews financials → moves to `processing`
   - On this exact transition: **AutoCount sales order sync** fires (push to AutoCount)
   - Can reject → `cancelled` (releases `reserved_quantity`)

4. **Fulfillment**
   - `processing` → collect mandatory delivery date → choose Delivery vs Pickup (delivery_notes keyword)
   - Generate Manifest / Delivery Order PDFs (jsPDF) with digital signatures
   - Ship → status = `out_for_delivery`

5. **Completion**
   - Mark delivered → `completed`
   - Deducts `on_hand_quantity -= qty` AND `reserved_quantity -= qty`
   - Writes `stock_movements` row (type=`issue`)
   - AutoCount stock balance reflects on next 5-min pg_cron pull

6. **Exception paths**
   - **Issues** status (orange theme) — missing/damaged items reported post-delivery
   - **Cancel** at any pre-processing stage → reservation released
   - Franchisee sees rejection reason transparently in alerts

## Visual structure

- Subgraphs: Creation, Franchisee Path, Own Store Path, Accounting, Fulfillment, Completion, Exceptions
- Color hints via `classDef` for status nodes (submitted / awaiting_proof / processing / completed / cancelled / issues) — kept theme-safe
- Side annotations for stock-state changes (reserve, deduct, release) and AutoCount sync trigger point

## Deliverable

- File: `/mnt/documents/Store_Order_Flow.mmd`
- Artifact tag with `mime_type="text/vnd.mermaid"`
