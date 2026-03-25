

# Fulfillment Daily Consolidation Report

## What it does
Adds a new "Consolidation" tab to the Fulfillment Dashboard that shows a consolidated view of all items that need to be pulled/prepared for the day. It aggregates line items across all processing/submitted orders for a selected date, grouping by item code so fulfillment staff can see total quantities at a glance.

## Changes

### 1. New hook: `useFulfillmentConsolidation` in `src/hooks/useFulfillment.ts`
- Query `sales_orders` filtered by delivery_date (or doc_date) matching selected date and status in `['submitted', 'processing']`
- Join `sales_order_lines` to get all line items
- Return raw data for client-side aggregation

### 2. New component: `src/components/fulfillment/ConsolidationReport.tsx`
- Date picker defaulting to today
- Aggregates line items by `item_code` + `item_name`, summing quantities across all orders
- Shows a table: Item Code, Item Name, UOM, Total Qty, Number of Orders
- Print button for the consolidated pull-out list
- Export to CSV option

### 3. Update `src/pages/FulfillmentDashboard.tsx`
- Add a "Consolidation" tab trigger alongside existing tabs
- Render `ConsolidationReport` in that tab content

## Technical Detail
- No database changes needed -- uses existing `sales_orders` + `sales_order_lines` tables
- Query filters orders by delivery_date = selected date AND status in submitted/processing
- Client-side grouping using a Map keyed by item_code to sum quantities
- Print uses `window.print()` with a print-optimized container (same pattern as ManifestGenerator)

