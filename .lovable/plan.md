# Remove AutoCount Syncing — Supabase Only

Goal: the app stops talking to AutoCount entirely. All order, purchasing, inventory, supplier and store operations write only to Supabase. The Sales Dashboard keeps its POS daily-sales feed. Existing sync columns and the sync log table stay in the database untouched — only the syncing behaviour and the sync UI go away.

## 1. Stop the automatic background sync

- Unschedule the `auto-sync-autocount-5min` cron job (runs every 5 minutes and calls `auto-sync-to-autocount`).

## 2. Remove sync from the workflows

Each place below currently calls an AutoCount function after saving locally. The local save stays; the AutoCount call and its error/toast handling are removed, so the action succeeds on the Supabase write alone.

- Store orders / fulfillment approval: `StoreOrderDetail`, `FulfillmentOrderDetail`, `FulfillmentOrderActions` (drop `sync-sales-order`). Approving into `processing` becomes a pure status change.
- Purchasing: `Purchasing`, `PurchaseOrderDetail`, `CEODashboard` (drop `sync-po-create`, `push-po-to-autocount`, `sync-po-cancel`, `pull-po-from-autocount`, `pull-po-execute`). PO approval, cancellation and deletion no longer touch AutoCount, and the "Pull POs from AutoCount" action is removed.
- Receiving / warehouse: `GoodsReceivedForm`, `EnhancedGoodsReceivedForm`, `GoodsReturnForm`, `CashPurchaseForm`, `ReceiveFromCashPO` (drop `sync-grn-to-autocount`, `sync-goods-return`, `sync-cash-purchase`).
- Production: `Production.tsx` (drop `retry-failed-sync` and the retry button).
- Inventory: remove Sync/Push dialogs (`SyncInventoryDialog`, `PushInventoryDialog`) and their buttons on `Inventory` and `RawMaterials`; item create/edit/delete no longer pushes to AutoCount.
- Suppliers: remove `SyncSuppliersDialog` and its button on `Suppliers`.
- Stores: remove sync/import actions in `Stores`, `StoresManagement`, `StoreDialog`, `ImportDebtorsDialog`, `SyncErrorsDialog`.

## 3. Remove the sync status surfaces

- Delete `AutoSyncStatusIndicator` and its slot in the sidebar.
- Remove the Admin "Sync Report" tab and `SyncReportTable` from Settings.
- Remove "Synced / Not synced" badges and AutoCount doc-number columns from inventory, purchasing, store-order and receiving lists, mobile cards and print views.

## 4. Delete the AutoCount edge functions

Delete: `auto-sync-to-autocount`, `create-autocount-item`, `create-autocount-supplier`, `delete-autocount-item`, `update-autocount-item`, `pull-autocount-debtors`, `pull-po-from-autocount`, `pull-po-execute`, `pull-stores-from-autocount`, `push-debtor-to-autocount`, `push-inventory-to-autocount`, `push-invoice-to-autocount`, `push-po-to-autocount`, `push-stock-to-autocount`, `push-store-to-autocount`, `push-supplier-to-autocount`, `retry-failed-sync`, `sync-assembly-complete`, `sync-cash-purchase`, `sync-debtors-execute`, `sync-goods-return`, `sync-grn-to-autocount`, `sync-inventory-execute`, `sync-inventory-preview`, `sync-po-cancel`, `sync-po-create`, `sync-production-complete`, `sync-sales-order`, `sync-stock-adjustment`, `sync-suppliers-execute`, `sync-suppliers-preview`, `test-autocount-connection`, `test-inventory-endpoints`.

Kept: `sales-api-proxy` (POS daily sales for the Sales Dashboard), `manage-users`, `send-push`, `register-push-subscription`, `push-config`, `setup-demo-users`.

Their `verify_jwt` entries are removed from `supabase/config.toml`; the entry for `sales-api-proxy` stays.

## 5. What stays in the database

- `autocount_sync_log`, `autocount_item_code`, `autocount_doc_no`, `autocount_synced`, `last_synced_at`, `sync_error_message` all remain with their current data, just no longer written or displayed.
- Item codes still identify items internally — `autocount_item_code` continues to be used for matching store-order line items, so nothing breaks in ordering.
- No changes to stock movement logic, reservations, production logging or RLS.

## Effects to be aware of

- No accounting records flow to AutoCount anymore. Sales orders, POs, GRNs, stock adjustments and item masters must be entered in AutoCount manually if it is still used for books.
- Stock quantities become purely local. The previous rule of trusting AutoCount's balance no longer applies; Supabase is the single source of truth.
- Item creation no longer needs an AutoCount counterpart, so the "item code does not exist" approval failures disappear.
- The on-prem `Backend/` C# project is left in the repo as-is but becomes unused by the app.
