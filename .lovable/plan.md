

# Consolidation Report: Date Range on Order Date

## Summary
Update the consolidation report to use a date range picker filtering by **order date** (`doc_date`) instead of `delivery_date`. Include all processing orders in the results.

## Changes

### 1. `src/hooks/useFulfillment.ts` — `useFulfillmentConsolidation`
- Change signature from `(date: string)` to `(fromDate: string, toDate: string)`
- Replace `.eq("delivery_date", date)` with `.gte("doc_date", fromDate).lte("doc_date", toDate)`
- Add second query for all `processing` status orders with no `doc_date` filter (to ensure none are missed)
- Merge and deduplicate order IDs before fetching lines
- Update query key to `["fulfillment-consolidation", fromDate, toDate]`

### 2. `src/components/fulfillment/ConsolidationReport.tsx`
- Replace single `selectedDate` state with `dateRange: { from: Date; to: Date }` defaulting to today-to-today
- Switch Calendar to `mode="range"` with `pointer-events-auto`
- Update button label to show "MMM dd – MMM dd, yyyy" range format
- Pass `fromDate` and `toDate` strings to the updated hook
- Update print header, CSV filename, and empty-state message to reflect date range and "Order Date" label

### 3. No database changes needed

