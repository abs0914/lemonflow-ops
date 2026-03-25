

# Single-Click Receive from Pending Receipts

## Problem
When clicking "Receive" on a pending PO, the app switches to the Receive tab but the user must manually select the same PO again from a dropdown -- a redundant 2-click process.

## Solution
Pass the selected PO ID from `PendingReceiptsList` through the parent `IncomingInventory` page into `EnhancedGoodsReceivedForm`, so the PO is auto-selected when switching tabs.

## Changes

### 1. `src/pages/IncomingInventory.tsx`
- Add state: `const [preselectedPOId, setPreselectedPOId] = useState<string>("")`
- In `onReceive` callback, set the preselected PO ID before switching tabs
- Pass `preselectedPOId` as a prop to `EnhancedGoodsReceivedForm`
- Clear `preselectedPOId` when user manually switches to the receive tab without clicking a PO

### 2. `src/components/inventory/EnhancedGoodsReceivedForm.tsx`
- Accept optional `preselectedPOId` prop
- Add a `useEffect` that sets `selectedPO` when `preselectedPOId` changes and is non-empty
- This auto-triggers the existing PO lines query since it's already keyed on `selectedPO`

## Technical Detail
```
PendingReceiptsList clicks "Receive" on PO-X
  → onReceive(poId) fires
  → Parent sets preselectedPOId = poId, activeTab = "receive"
  → EnhancedGoodsReceivedForm receives preselectedPOId prop
  → useEffect sets selectedPO = preselectedPOId
  → PO lines query auto-fires, form is ready
```

No database changes needed. Two files edited.

