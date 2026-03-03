

## Plan: 5-Minute Auto-Sync to AutoCount + Hide Manual Sync Buttons for Non-Admins

### What This Solves
Currently all sync operations are manual. Users need automatic background syncing every 5 minutes, and manual sync buttons should only be visible to Admins.

### Part 1: Create an Auto-Sync Edge Function

Create a new edge function `auto-sync-to-autocount/index.ts` that runs as a batch job:

1. **Authenticate** with AutoCount backend
2. **Find unsynced records** across key tables using service role:
   - `sales_orders` where `autocount_synced = false` and status is `submitted`/`processing`/`completed`
   - `components` where changes detected (modified after `last_synced_at`)
   - `stores` where `autocount_synced = false`
   - `suppliers` where `autocount_synced = false`
3. **POST each unsynced record** to AutoCount (reusing existing sync logic patterns)
4. **Log results** to `autocount_sync_log`
5. Set `verify_jwt = false` in config.toml (will validate via a shared secret or service key internally)

The function will prioritize **POST/create operations** (sales orders, new items) since the frontend is the primary data entry point. Pull/GET operations will be minimal or skipped in the auto-sync.

### Part 2: Schedule with pg_cron

Use `pg_cron` + `pg_net` to call the edge function every 5 minutes:

```sql
SELECT cron.schedule(
  'auto-sync-autocount-5min',
  '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://pukezienbcenozlqmunf.supabase.co/functions/v1/auto-sync-to-autocount',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) AS request_id; $$
);
```

### Part 3: Hide Manual Sync Buttons for Non-Admins

Conditionally render sync buttons based on `profile?.role === 'Admin'` in these pages:

| Page | Buttons to hide |
|------|----------------|
| `src/pages/Inventory.tsx` | "Pull from AutoCount", "Sync to AutoCount" |
| `src/pages/Suppliers.tsx` | "Sync from AutoCount", "Sync to AutoCount" |
| `src/pages/Stores.tsx` | "Sync from AutoCount", "Sync to AutoCount", per-row sync icon |
| `src/pages/Purchasing.tsx` | "Pull from AutoCount", "Sync to AutoCount" |
| `src/pages/StoreOrderDetail.tsx` | "Sync to AutoCount" button |
| `src/components/inventory/AddInventoryDialog.tsx` | "Sync to AutoCount" checkbox |
| `src/components/inventory/EditInventoryDialog.tsx` | "Sync to AutoCount" checkbox |
| `src/components/inventory/StockAdjustmentDialog.tsx` | "Sync to AutoCount" checkbox |

Each page already has access to `useAuth()` or can import it. The sync buttons will be wrapped in `{profile?.role === 'Admin' && (...)}`.

### Part 4: Add Auto-Sync Status Indicator (Optional Enhancement)

Add a small status badge in the sidebar or settings page showing last auto-sync time and result, queried from `autocount_sync_log`.

### Technical Details

- The auto-sync function uses `SUPABASE_SERVICE_ROLE_KEY` for DB access (no user context needed for cron)
- Authentication to AutoCount uses existing `LEMONCO_API_URL`, `LEMONCO_USERNAME`, `LEMONCO_PASSWORD` secrets
- The function will process records in batches with error handling per record (one failure won't block others)
- Existing manual sync functions remain functional for Admin fallback
- The cron SQL must be run via the SQL editor (not migration) since it contains project-specific keys

### Files to Create/Modify

**New:**
- `supabase/functions/auto-sync-to-autocount/index.ts`

**Modified:**
- `supabase/config.toml` — add auto-sync function config
- `src/pages/Inventory.tsx` — hide sync buttons
- `src/pages/Suppliers.tsx` — hide sync buttons
- `src/pages/Stores.tsx` — hide sync buttons
- `src/pages/Purchasing.tsx` — hide sync buttons
- `src/pages/StoreOrderDetail.tsx` — hide sync button
- `src/components/inventory/AddInventoryDialog.tsx` — hide sync checkbox
- `src/components/inventory/EditInventoryDialog.tsx` — hide sync checkbox
- `src/components/inventory/StockAdjustmentDialog.tsx` — hide sync checkbox

