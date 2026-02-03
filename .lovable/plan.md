

## Overview
This plan adds a **Stores** section to manage customers/debtors with bidirectional sync to AutoCount. The system will allow users to:
- View and manage all store/customer records
- Import debtors from AutoCount (already exists)
- **Push stores to AutoCount as debtors (new feature)**

## Changes Summary

### 1. Add "Stores" to Main Navigation
Update the sidebar to include "Stores" as a main menu item (currently it's hidden under Settings).

**File:** `src/components/AppSidebar.tsx`
- Add new menu item "Stores" with `Store` icon between Suppliers and Purchasing
- Visible to Admin and Warehouse roles
- Route: `/stores`

### 2. Create New Route
**File:** `src/App.tsx`
- Add route `/stores` pointing to a new `Stores.tsx` page

### 3. Create Stores Page with AutoCount Sync
**File:** `src/pages/Stores.tsx` (new file)

Features:
- Full CRUD for customer/debtor records
- **Import from AutoCount** - Pull debtors to create stores (existing functionality, reused)
- **Sync to AutoCount** - Push local stores as debtors to AutoCount (new)
- Display sync status per store
- Search and filter functionality
- Mobile responsive design

### 4. Create Edge Function to Push Stores to AutoCount
**File:** `supabase/functions/push-store-to-autocount/index.ts` (new)

This function will:
1. Authenticate with the LemonCo API
2. Fetch stores that need syncing
3. For each store, create or update a debtor in AutoCount
4. Update sync status in the database

**API Payload Structure (mapping store to debtor):**
```javascript
{
  code: store.debtor_code,
  name: store.store_name,
  contactPerson: store.contact_person,
  phone: store.phone,
  email: store.email,
  address: store.address,
  isActive: store.is_active
}
```

### 5. Update Supabase Config
**File:** `supabase/config.toml`
- Add entry for the new edge function

### 6. Add Sync Tracking to Stores Table
Add `autocount_synced` and `last_synced_at` columns to track sync status (if not already present - need to verify schema).

---

## Technical Details

### Database Schema Update
The `stores` table currently has:
- `store_code`, `store_name`, `store_type`, `debtor_code`, `address`, `contact_person`, `phone`, `email`, `is_active`

To add sync tracking, we need:
```sql
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS autocount_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
```

### Edge Function: push-store-to-autocount

```typescript
// Pattern similar to push-supplier-to-autocount
// 1. Authenticate with LemonCo API
// 2. Fetch unsynced stores
// 3. Check if debtor exists in AutoCount
// 4. Create or update debtor
// 5. Update store sync status
```

### UI Components
Reuse existing patterns from Suppliers page:
- Table with search
- "Sync from AutoCount" button (existing ImportDebtorsDialog)
- "Sync to AutoCount" button (new functionality)
- Edit/Delete actions
- Sync status badges

### Stores Type Update
**File:** `src/types/sales-order.ts`
- Add `autocount_synced` and `last_synced_at` to Store interface

### Hooks Update
**File:** `src/hooks/useStores.ts`
- Already has CRUD operations
- Will work with updated type

---

## File Changes Summary

| Action | File |
|--------|------|
| Modify | `src/components/AppSidebar.tsx` - Add Stores menu item |
| Modify | `src/App.tsx` - Add /stores route |
| Create | `src/pages/Stores.tsx` - New stores page with sync |
| Create | `supabase/functions/push-store-to-autocount/index.ts` - Edge function |
| Modify | `supabase/config.toml` - Add function config |
| Modify | `src/types/sales-order.ts` - Add sync fields to Store type |
| Modify | `src/integrations/supabase/types.ts` - Will auto-regenerate after schema change |

---

## User Flow

1. Navigate to **Stores** in sidebar
2. View list of all stores with sync status
3. Click **Import from AutoCount** to pull debtors as stores
4. Click **Sync to AutoCount** to push local stores as debtors
5. Individual sync status shows "Synced" or "Not Synced" badges
6. Manual create/edit/delete for store records

