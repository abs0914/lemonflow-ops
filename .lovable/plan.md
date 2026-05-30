## Goal
Show Welnie's signature above "Prepared By" in the Purchase Order printout, mirroring how the CEO signature is shown above "Approved By (CEO)".

## Changes

### 1. Upload Welnie's signature and link it to her profile
- Upload `user-uploads://sign.png` to the existing `user-signatures` Supabase storage bucket (path like `welnie/signature.png`).
- Update Welnie Redoblado's row in `user_profiles` so `signature_url` points to that uploaded file (same storage path convention currently used for the CEO signature).

This reuses the existing signature mechanism — no new tables, buckets, or UI flows.

### 2. Render the "Prepared By" signature in `src/components/purchasing/POPrintView.tsx`
The data hook already returns `purchaseOrder.user_profiles.signature_url` (created_by profile). The print view currently shows only the name. Update it to:

- Add a `preparedSigUrl` state, resolved via the existing `resolveSignatureUrl` helper from `purchaseOrder.user_profiles?.signature_url`.
- Include `preparedSigUrl` in the image-preload effect so print waits for it like the other signatures.
- In the "Prepared By" signature cell, render the signature image (same `height: 3rem`, `maxWidth: 6rem`, `objectFit: contain` styling used for the CEO image) above the user's full name when a signature is available; fall back to the current name-only layout when there is no signature.

No changes to layout columns, copy count, or any other PO behavior.

## Technical notes
- `usePurchaseOrder` in `src/hooks/usePurchaseOrders.ts` already selects `signature_url` for the creator profile, so no query changes are needed.
- The storage bucket `user-signatures` and the `resolveSignatureUrl` helper already handle signed URLs — same path as the CEO signature.
