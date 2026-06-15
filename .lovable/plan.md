## Goal
Give `finance@lemonco.com` access to the Accounting module without losing Finance permissions, in a way that scales to other users later.

## Approach
Introduce a supplementary `user_roles` table (the standard pattern already referenced in project memory) that grants *additional* roles on top of `user_profiles.role`. Wire it into the existing `is_accounting` / `is_finance` helpers, frontend route/menu gating, and the AuthContext so Accounting screens and RLS policies treat the user as Accounting too.

## Changes

### 1. Database (migration)
- Create `public.user_roles (user_id uuid, role text, ...)` with unique `(user_id, role)`, grants, RLS (user can read own; Admin manages).
- Update `is_accounting(uuid)`, `is_finance(uuid)`, `is_admin(uuid)`, `is_ceo(uuid)`, `is_fulfillment(uuid)` to also return true if a matching row exists in `user_roles`. This means every existing RLS policy that calls these helpers automatically respects extra roles — no policy rewrites needed.
- Seed: insert `('c273cb48-091e-4301-b1b9-b2b7f9e7eee0', 'Accounting')` for `finance@lemonco.com`.

### 2. Frontend
- Extend `AuthContext` to also fetch `user_roles` for the signed-in user and expose `extraRoles: string[]` plus a helper `hasRole(role)` that returns true if `profile.role === role || extraRoles.includes(role)`.
- Update `AppSidebar` role gate to use `hasRole(...)` instead of `roles.includes(profile.role)`.
- Update any route guards / page-level `profile.role === 'Accounting'` checks (e.g. Accounting pages, `PurchaseOrderDetail`, `StoreOrders` accounting actions) to use `hasRole('Accounting')`.

### 3. Out of scope
- No admin UI for managing extra roles in this pass (can be added later under Settings → Users). The single seed is applied via the migration.

## Notes
- Existing `user_profiles.role` stays as the primary role and is unchanged.
- Because RLS funnels through the `is_<role>` SECURITY DEFINER helpers, broadening them is sufficient — no policy edits required.
- After migration runs, finance@lemonco.com will see the Accounting menu item and pass Accounting RLS checks on next login (or token refresh).
