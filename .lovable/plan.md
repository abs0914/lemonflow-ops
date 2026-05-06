
## Goal
Let users manually trigger the existing AutoCount sync edge functions from the Suppliers and Stores pages.

## Backend functions (already deployed)
- `push-supplier-to-autocount` — push local suppliers → AutoCount creditors
- `sync-suppliers-execute` (with `sync-suppliers-preview`) — pull AutoCount creditors → local
- `push-store-to-autocount` — push local stores → AutoCount debtors
- `sync-debtors-execute` — pull AutoCount debtors → local

## Changes

### 1. `src/pages/Suppliers.tsx`
- Replace the existing `handleSyncToAutoCount` (which loops `create-autocount-supplier` per supplier) with a single bulk call to `push-supplier-to-autocount` sending `{ supplierIds: [unsynced ids] }`.
- Add `isPushing` loading state.
- Compute `unsyncedCount = suppliers.filter(s => !s.autocount_synced).length`.
- Add two buttons in the header next to "Add Supplier":
  - **Pull from AutoCount** → opens existing `SyncSuppliersDialog` (preview + execute).
  - **Sync to AutoCount** (with badge of `unsyncedCount`) → calls push handler; disabled when `unsyncedCount === 0` or while pushing.
- On success: invalidate `["suppliers"]` and toast results.

### 2. `src/pages/Stores.tsx`
- Fix `handlePullFromAutoCount` to invoke `sync-debtors-execute` (currently calls non-existent `pull-stores-from-autocount`).
- Compute `unsyncedCount` (already present).
- Add two header buttons next to "Add Store":
  - **Pull from AutoCount** → calls `handlePullFromAutoCount`; spinner while `isPulling`.
  - **Sync to AutoCount** (badge of `unsyncedCount`) → calls `handleSyncToAutoCount()` (no args = all unsynced); disabled when count is 0 or `isSyncing`.
- Add a per-row sync icon button (RefreshCw) in the Actions column before Edit:
  - Visible only when `!store.autocount_synced`.
  - Calls `handleSyncToAutoCount(store.id)`.
  - Shows spinner when `syncingStoreId === store.id`.

### 3. `src/hooks/useStores.ts`
- In `useUpdateStore`, force `autocount_synced: false` in the update payload so edits flag the store for re-sync.

### 4. `src/components/suppliers/SupplierDialog.tsx`
- On edit (update path), include `autocount_synced: false` so edits re-flag the supplier.
- (View file first to confirm exact mutation location.)

## Notes
- All edge functions already enforce auth + role checks server-side; no RLS / migration changes needed.
- No new dependencies. Uses existing `sonner` toast, `lucide-react` icons (`RefreshCw`, `Upload`, `Download`), and `react-query` invalidation.
