## Goal
Make the Delivery Fee (and related Shipping/Expedite fees) appear on both print documents so the printed totals match what's shown on screen.

## Current state
- **Sales Order print** (`src/components/store-orders/SalesOrderPrintView.tsx`) — already shows Delivery Fee + Shipping Fee + Grand Total, but only if they are > 0. It does NOT include Expedite Fee.
- **Delivery Order print** (`src/components/fulfillment/DeliveryOrderDocument.tsx`) — only shows a single "Total Amount" row. No delivery fee, shipping fee, or expedite fee shown.

## Changes

### 1. `src/components/fulfillment/DeliveryOrderDocument.tsx`
- Extend the `order` prop type to include `delivery_fee`, `shipping_fee`, `expedite_fee` (all optional numbers).
- In the totals section of the table, replace the single "Total Amount" row with:
  - Subtotal (existing `total_amount`)
  - Delivery Fee row (only if > 0)
  - Shipping Fee row (only if > 0)
  - Expedite Fee row (only if > 0)
  - Grand Total row = subtotal + delivery + shipping + expedite
- Style the grand total row bold, matching the existing total-row style.

### 2. `src/components/store-orders/SalesOrderPrintView.tsx`
- Add `expedite_fee` to the totals calculation and render an "Expedite Fee" row (only if > 0), same pattern as the existing delivery/shipping rows.
- Update `grandTotal` to include expedite fee.

No backend or schema changes — both fees already exist on `sales_orders` and are passed through.
