

## Give Fulfillment Access to Stores Module

### Changes

1. **Sidebar Navigation** (`src/components/AppSidebar.tsx`)
   - Add `"Fulfillment"` to the roles array for the Stores menu item

2. **Database RLS** (migration)
   - Fulfillment users can already **view** stores via the existing "Authenticated users can view stores" SELECT policy
   - If Fulfillment should also **manage** (create/update/delete) stores, a new RLS policy is needed. However, typically Fulfillment only needs read access to stores (to see store info for order fulfillment). No new migration needed unless full CRUD is required.

### Summary
This is a one-line sidebar change — adding `"Fulfillment"` to the Stores menu roles so Fulfillment users can navigate to the Stores page and view store information.

