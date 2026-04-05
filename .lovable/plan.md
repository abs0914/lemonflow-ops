

# Franchisee Store-Specific Notifications

## Problem
`notify_roles()` broadcasts to all users of a role. Franchisee users should only receive notifications about their own store's orders, and they should get updates at more lifecycle stages.

## Solution

### 1. New database function: `notify_store_users(p_store_id, p_title, p_message, p_type, p_entity_type, p_entity_id)`
- Inserts notifications only for users assigned to the given store via `user_store_assignments`
- Replaces `notify_roles(ARRAY['Store'], ...)` calls in the sales order trigger

### 2. Update `on_sales_order_change()` trigger function
Replace all `notify_roles(ARRAY['Store'], ...)` calls with `notify_store_users(NEW.store_id, ...)` and add new status transitions:

| Status transition | Notification to store users |
|---|---|
| `submitted` → `pending_payment` | "Order Under Review — Finance is reviewing your order" |
| `pending_payment` → `awaiting_proof` | "Upload Proof of Payment" (existing, but now store-filtered) |
| `awaiting_proof` → `pending_accounting` | "Payment Received — Awaiting final verification" |
| `pending_accounting` → `processing` | "Order Approved — Your order is now being processed" |
| any → `fulfilled` | "Order Fulfilled" (existing, but now store-filtered) |
| any → `cancelled` | "Order Cancelled" |

### 3. No code changes needed
- The client-side `useNotifications` hook already filters by `user_id`, so store-specific inserts will just work
- `NotificationBell` routing for `sales_order` entity type already navigates to the order detail

## Database Migration
```sql
-- 1. Create store-specific notification function
CREATE OR REPLACE FUNCTION public.notify_store_users(
  p_store_id uuid, p_title text, p_message text,
  p_type text DEFAULT 'info', p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id)
  SELECT usa.user_id, p_title, p_message, p_type, p_entity_type, p_entity_id
  FROM user_store_assignments usa
  WHERE usa.store_id = p_store_id;
END;
$$;

-- 2. Replace on_sales_order_change with store-filtered version
--    (full function replacement updating all Store notification calls)
```

## What changes for users
- Franchisees only see notifications for their own store
- They get progress updates at every stage, not just "upload proof" and "fulfilled"
- Operational roles (Admin, Fulfillment, etc.) continue receiving notifications as before via `notify_roles`

