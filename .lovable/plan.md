## Goal

Stop showing "synced to AutoCount" when the `sync-grn-to-autocount` edge function fails. Show the returned `docNo` on success and surface partial-failure counts for multi-line receiving. No backend or DB changes.

## Files

1. `src/components/warehouse/GoodsReceivedForm.tsx` (single-line GRN)
2. `src/components/inventory/EnhancedGoodsReceivedForm.tsx` (multi-line GRN)

## Changes

### 1. `GoodsReceivedForm.tsx` — single line

In the mutation (around line 142–155), replace the silent error-swallow with a proper check that distinguishes the local receipt from the sync result.

- Capture both `data` and `syncError` from `supabase.functions.invoke(...)`.
- Treat `syncError` or `data?.success === false` as a **partial success** (local stock is already updated, so do not throw — the receipt is real). Instead, return a structured result `{ docNo, syncFailed, syncMessage }` from `mutationFn`.
- In `onSuccess`, branch on `syncFailed`:
  - Success: toast title "Goods Received", description `GRN synced to AutoCount: ${docNo}`.
  - Sync failed: toast variant `destructive` (or warning style), title "Received locally — AutoCount sync failed", description containing `syncMessage`.
- Keep the form reset and query invalidation in both branches (the local receipt did succeed).

### 2. `EnhancedGoodsReceivedForm.tsx` — multi line

In the per-line sync loop (lines 341–361):

- Track `syncSuccessCount`, `syncFailures: { itemName, message }[]`.
- For each `supabase.functions.invoke("sync-grn-to-autocount", ...)`:
  - Read `{ data, error }`. If `error || data?.success === false`, push to `syncFailures` with the line's display name (`components?.name` or `raw_materials?.name`) and the returned message; otherwise increment `syncSuccessCount`.
- Return `{ count: selectedLines.length, syncSuccessCount, syncFailures }` from `mutationFn`.
- In `onSuccess`, choose the toast based on `syncFailures.length`:
  - All synced: "Received and synced N item(s)" with optional comma-joined `docNo`s if returned.
  - Partial: warning/destructive toast "Received N item(s) locally — AutoCount sync failed for M" and list the failing item names (truncate to first 3 + "and X more").
- Replace the `try/catch` with explicit `{ data, error }` handling so `data?.success === false` is caught (the edge function returns 200 with `success:false` on some failures).

### 3. Toast styling

- Use existing `useToast` from `@/hooks/use-toast` (already imported in both files).
- For partial-failure variant, use `variant: "destructive"` since the project already uses that in the existing `onError` handlers — keeps it consistent without adding new variants.

## Out of scope

- No edge function, .NET backend, RLS, schema, or retry-policy changes.
- No changes to `Stores.tsx` or any other component.
- No changes to the local stock-update logic — those already throw on failure.

## Verification

- Trigger a GRN while the edge function returns 404 / `success:false` → confirm destructive toast says "Received locally — AutoCount sync failed" and stock is still incremented locally.
- Trigger a GRN with a working backend → confirm success toast shows the returned `docNo`.
- Multi-line: select 3 lines, force one to fail → confirm toast says "Received 3 item(s) locally — AutoCount sync failed for 1" with the failing item's name.
