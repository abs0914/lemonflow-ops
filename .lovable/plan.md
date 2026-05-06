## Goal
When Fulfillment approves an order, require them to confirm the **delivery price** in addition to the delivery date. The price should auto-populate from a per-location rate table but remain editable.

## Location → Delivery Price Table
Store these as a constants map (keyed by store name, case-insensitive match):

| Location | Amount (₱) |
|---|---|
| PASEO | 900.00 |
| VIBO PLACE | 850.00 |
| SM SEASIDE | 900.00 |
| BTC | 800.00 |
| ROBINSONS GALLERIA | 800.00 |
| IT PARK | 800.00 |
| BASELINE | 850.00 |
| SM CEBU | 800.00 |
| 8 BANAWA | 900.00 |
| GRUBHUB MINGLANILLA | 1,150.00 |
| PUSO VILLAGE | 850.00 |
| OUTLETS-PUEBLO VERDE | 800.00 |
| NU | 800.00 |
| MANDANI | 750.00 |
| LG GARDEN | 900.00 |
| MACTAN AIRPORT | 800.00 |

## Changes

1. **New file `src/lib/deliveryRates.ts`**
   - Export `DELIVERY_RATES` map and `getDeliveryRate(storeName)` helper that does a normalized lookup (uppercase, trim) and returns the matching amount or `0` if unknown.

2. **`src/components/fulfillment/FulfillmentOrderActions.tsx`**
   - Add `deliveryFee` state next to `deliveryDate`, initialized from `order.delivery_fee` if set, otherwise `getDeliveryRate(order.stores?.store_name)`.
   - Add a labeled numeric input ("Delivery Price ₱") below the date picker for `submitted` non-franchisee orders.
   - Show a small hint when the value comes from the rate table ("Suggested rate for {store}").
   - Update `onApprove` signature to `(deliveryDate: Date, deliveryFee: number) => Promise<void>` and pass both in `handleApproveConfirm`.
   - Disable Approve button until both date and a non-negative fee are set.
   - Show the confirmed fee in the approval AlertDialog summary.

3. **`src/pages/FulfillmentOrderDetail.tsx`**
   - Update `handleApproveOrder` to accept `deliveryFee` and include `delivery_fee: deliveryFee` in the `updateMutation` updates payload (alongside status/delivery_date/etc).
   - Total amount display already sums in `delivery_fee`, so it will reflect the new value automatically.

## Out of scope
- Franchisee orders (Finance handles their fees in the existing finance flow — unchanged).
- Editing the rate table from the UI (hardcoded for now; can be promoted to `app_configs` later if needed).
- No DB migration required — `sales_orders.delivery_fee` already exists.
