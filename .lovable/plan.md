

# Mobile Responsiveness Audit and Fix Plan

## Issues Found

After reviewing all pages at a 390x844 viewport, here are the mobile responsiveness issues organized by page:

---

### 1. Dashboard (`Dashboard.tsx`)
- **Padding too large**: `p-8` (32px) is excessive on mobile; should be `p-4 md:p-8`
- **Title too large**: `text-4xl` on mobile is oversized; should be `text-2xl md:text-4xl`
- **Recent activity cards**: The flex row layout (`flex items-center justify-between`) causes content to squeeze on mobile. Badge + date + quantity all crammed into one row

### 2. Store Orders (`StoreOrders.tsx`)
- **Header not responsive**: `flex items-center justify-between` with 3 buttons (Refresh, Quick Entry, New Order) overflows on mobile. No `isMobile` check or stacking
- **Tabs overflow**: 6 tab triggers ("All", "Draft", "Submitted", "Awaiting Proof", "Processing", "Completed") overflow horizontally without scroll

### 3. Store Order Detail (`StoreOrderDetail.tsx`)
- **Header buttons overflow**: Action buttons (Submit, Delete, Sync) are in a non-wrapping row that overflows
- **Title too large on mobile**: `text-3xl` for order number

### 4. Store Order Create (`StoreOrderCreate.tsx`)
- **Bottom action buttons**: 3 buttons (Cancel, Save Draft, Submit) in `flex justify-end gap-4` overflow on small screens

### 5. Purchase Order Detail (`PurchaseOrderDetail.tsx`)
- **Header layout breaks**: `flex items-center justify-between` with back button + title on left and up to 5 action buttons on right overflows badly
- **Action buttons**: Many conditional buttons (Edit, Submit, Delete, Approve, Cancel, Print, Sync, Upload, Verify) with no mobile stacking

### 6. PO Create (`PurchasingCreate.tsx`)
- **Line items table**: Full `<Table>` with 7 columns doesn't fit on 390px. No mobile card view alternative
- **Item type radio buttons**: Horizontal layout may wrap awkwardly

### 7. Production (`Production.tsx`)
- **Table not responsive**: Full table with 8 columns (Date, Product, SKU, Qty, Logged By, Sync, Notes, Actions) shows on all screen sizes with no mobile card alternative

### 8. CEO Dashboard (`CEODashboard.tsx`)
- **PO approval cards**: `flex items-start justify-between` with details + 3 buttons side by side breaks on mobile. The `grid grid-cols-2` for PO info also squeezes
- **Action buttons stacked vertically** but still compete for space with the main content

### 9. Fulfillment Dashboard (`FulfillmentDashboard.tsx`)
- **Stats cards**: `grid-cols-1 md:grid-cols-4` is fine but the order cards have `flex items-center justify-between` with checkbox, order info, dates, total, badge, and View button all in one row -- severely overflows on mobile
- **Hidden date columns**: `hidden md:block` on dates is good but the remaining items still overflow

### 10. Accounting Dashboard (`AccountingDashboard.tsx`)
- **Full table on all screens**: 8-column table with no mobile card alternative. Completely unusable on 390px
- **Search bar**: `max-w-sm` is fine

### 11. BOM Manager (`BomManager.tsx`)
- **Padding**: `p-8` too large on mobile
- **Title**: `text-4xl` too large on mobile
- **Grid**: `lg:grid-cols-2` is fine but both panels stack -- no UX issue

### 12. Labels (`Labels.tsx`)
- **Padding**: `p-8` too large
- **Title**: `text-4xl` too large

### 13. My Account (`MyAccount.tsx`)
- Uses `SidebarProvider` + `SidebarInset` directly instead of `DashboardLayout`, which means no mobile header with sidebar trigger -- sidebar is inaccessible on mobile

### 14. Reports (`Reports.tsx`)
- Same issue as My Account: uses `SidebarProvider` + `SidebarInset` instead of `DashboardLayout` -- no mobile sidebar trigger
- Report tab list tries to do `grid-cols-2 md:grid-cols-4` which could be fine but may overflow with many reports

### 15. Finance Dashboard / Finance Order Detail
- Need to check but likely similar table overflow issues

---

## Implementation Plan

### Task 1: Fix global padding and typography on pages with hardcoded `p-8` / `text-4xl`
Pages: Dashboard, BOM Manager, Labels
- Change `p-8` to `p-4 md:p-8`
- Change `text-4xl` to `text-2xl md:text-4xl`

### Task 2: Fix Store Orders page header and tabs
- Wrap header buttons with `isMobile` check; use FAB for mobile actions (New Order)
- Add horizontal scroll to tabs or reduce tab labels on mobile

### Task 3: Fix detail page headers (PO Detail, Store Order Detail)
- Stack header vertically on mobile: title on top, action buttons below
- Use `flex-col md:flex-row` for the header wrapper
- On mobile, use a dropdown/sheet menu for multiple action buttons

### Task 4: Fix tables that have no mobile alternative
Pages: Production, Accounting Dashboard, PO Create line items
- Production: Add mobile card view using existing `MobileAssemblyOrderCard` pattern
- Accounting Dashboard: Add mobile card view for orders
- PO Create: Convert line items table to stacked cards on mobile

### Task 5: Fix CEO Dashboard and Fulfillment Dashboard card layouts
- CEO: Stack PO approval cards vertically on mobile -- info first, then action buttons as a row below
- Fulfillment: Restructure order cards for mobile -- stack info vertically, action button full-width

### Task 6: Fix My Account and Reports pages -- switch to DashboardLayout
- Replace `SidebarProvider` + `AppSidebar` + `SidebarInset` pattern with `DashboardLayout` wrapper so the mobile header with sidebar trigger appears

### Task 7: Fix Store Order Create bottom buttons
- Stack buttons vertically on mobile: `flex-col md:flex-row`

---

## Summary

17 pages reviewed. 14 have mobile responsiveness issues. The fixes involve:
- Responsive padding/typography (quick wins)
- Adding mobile card views for tables (Production, Accounting)
- Stacking header layouts and action buttons on mobile
- Switching 2 pages to use `DashboardLayout` for consistent mobile navigation

