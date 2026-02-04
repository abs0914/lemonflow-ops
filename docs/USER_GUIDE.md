# LemonFlow Operations User Guide

This comprehensive guide provides step-by-step instructions for using each module in the LemonFlow Operations system.

---

## Table of Contents

1. [BOM Manager](#1-bom-manager)
2. [Production](#2-production)
3. [Production - Create Order](#3-production---create-order)
4. [Inventory (AutoCount)](#4-inventory-autocount)
5. [Suppliers](#5-suppliers)
6. [Purchasing](#6-purchasing)
7. [Purchasing - Create Order](#7-purchasing---create-order)
8. [Raw Materials](#8-raw-materials)
9. [Incoming Inventory](#9-incoming-inventory)
10. [Store Orders](#10-store-orders)
11. [Store Orders - Create](#11-store-orders---create)
12. [Store Orders - Quick Entry](#12-store-orders---quick-entry)
13. [Fulfillment Dashboard](#13-fulfillment-dashboard)
14. [Finance Dashboard](#14-finance-dashboard)

---

## 1. BOM Manager
**Route:** `/bom`  
**Access:** Admin, Warehouse

The Bill of Materials (BOM) Manager allows you to define the components and raw materials required to produce each product.

### Features
- View all products and their associated BOMs
- Create, edit, and delete BOM items
- Define quantities of raw materials needed per product unit

### How to Use

1. **Select a Product**
   - Browse the product list on the left panel
   - Click on a product to view/edit its BOM

2. **View BOM Components**
   - The right panel displays all components/raw materials for the selected product
   - Each item shows quantity required and unit

3. **Add BOM Item**
   - Click "Add Item" in the BOM Editor panel
   - Select a raw material from the dropdown
   - Enter the quantity required
   - Add optional notes
   - Click "Save"

4. **Edit BOM Item**
   - Click the edit icon next to an existing BOM item
   - Modify quantity or notes
   - Save changes

5. **Delete BOM Item**
   - Click the delete icon next to the item
   - Confirm deletion in the dialog

---

## 2. Production
**Route:** `/production`  
**Access:** Admin, Production

The Production page allows you to log completed production runs and track production history.

### Features
- Log completed production
- View production history
- Track AutoCount sync status
- Retry failed syncs

### How to Use

1. **Log Production**
   - Click the "Log Production" button
   - In the dialog:
     - Select the product that was produced
     - Enter the quantity produced
     - Add optional notes
   - Click "Submit"
   - The system will update inventory and sync to AutoCount

2. **View Production History**
   - The table displays all production logs with:
     - Date & Time
     - Product name and SKU
     - Quantity produced
     - Who logged it
     - Sync status

3. **Retry Failed Sync**
   - If sync status shows "Pending", click the refresh icon
   - The system will attempt to sync to AutoCount again

---

## 3. Production - Create Order
**Route:** `/production/create`  
**Access:** Admin, Production

Create assembly orders to plan future production.

### How to Use

1. **Fill Order Details**
   - **Product:** Select the product to assemble
   - **Quantity:** Enter the number of units to produce
   - **Due Date (Optional):** Set a target completion date
   - **Notes (Optional):** Add any special instructions

2. **Create Order**
   - Click "Create Order" to save
   - The order will be created with "Pending" status
   - Click "Cancel" to return without saving

---

## 4. Inventory (AutoCount)
**Route:** `/inventory`  
**Access:** Admin, Warehouse

Manage inventory items synced from AutoCount. This is your main inventory for finished goods and components.

### Features
- View all inventory items with stock levels
- Filter by item group, type, and stock status
- Add, edit, and delete items
- Import/export inventory data
- Sync with AutoCount (pull and push)
- Adjust stock quantities

### KPI Cards
- **Total Items:** Count of active inventory items
- **Low Stock:** Items below their threshold (clickable to filter)
- **Out of Stock:** Items with zero available quantity (clickable to filter)

### How to Use

1. **Search & Filter**
   - Use the search bar to find items by name, SKU, or AutoCount code
   - Filter by Item Group or Item Type using dropdowns
   - Filter by stock status (In Stock, Low Stock, Out of Stock)
   - Click KPI cards to quickly filter low/out of stock items

2. **Add New Item**
   - Click "Add Item" button
   - Fill in required fields (SKU, Name, Unit)
   - Set stock quantity and low stock threshold
   - Save the item

3. **Adjust Stock**
   - Click the stock adjustment icon on any row
   - In the dialog:
     - Select adjustment type (Add/Remove/Set)
     - Enter quantity
     - Provide batch number if applicable
     - Add reason/notes
   - Click "Submit"

4. **Export Inventory**
   - Click "Export" button
   - A CSV file will download with all displayed items

5. **Import Inventory**
   - Click "Import" button
   - Upload a CSV file with columns: SKU, Name, Stock Qty, Unit, etc.
   - Preview the items to be imported
   - Click "Import" to confirm

6. **Sync with AutoCount**
   - **Pull from AutoCount:** Fetches latest inventory data from AutoCount
   - **Sync to AutoCount:** Pushes local changes to AutoCount

---

## 5. Suppliers
**Route:** `/suppliers`  
**Access:** Admin, Warehouse

Manage supplier/creditor information for procurement.

### Features
- View all suppliers with contact details
- Add, edit, and delete suppliers
- Sync with AutoCount
- Track sync status

### How to Use

1. **View Suppliers**
   - The table displays: Code, Company Name, Contact Person, Phone, Email, Status, AutoCount sync

2. **Add Supplier**
   - Click "Add Supplier" button
   - Fill in company details:
     - Supplier Code (auto-generated)
     - Company Name (required)
     - Contact Person
     - Phone, Email, Address
     - Credit Terms
   - Click "Save"

3. **Edit Supplier**
   - Click "Edit" on a supplier row
   - Modify details in the dialog
   - Save changes

4. **Delete Supplier**
   - Click the delete icon on a supplier row
   - Review any related purchase orders warning
   - Confirm deletion

5. **Sync with AutoCount**
   - **Sync from AutoCount:** Pulls supplier data from AutoCount
   - **Sync to AutoCount:** Pushes unsynced suppliers to AutoCount

---

## 6. Purchasing
**Route:** `/purchasing`  
**Access:** Admin, Warehouse, Finance

Manage purchase orders for procurement.

### Features
- View all purchase orders with status
- Filter by status (Draft, Submitted, Approved)
- Create, edit, and delete purchase orders
- Sync with AutoCount
- Track goods receipt status (for Finance users)

### Status Workflow
1. **Draft:** Initial creation
2. **Submitted:** Sent for approval
3. **Approved:** Ready for receiving
4. **Cancelled:** Order cancelled

### How to Use

1. **View Purchase Orders**
   - Use tabs to filter by status
   - Search by PO number or supplier name
   - Click on a row to view details

2. **Create New PO**
   - Click "New Purchase Order" button
   - (See Purchasing Create section below)

3. **Edit/Delete PO**
   - Only Draft and Submitted POs can be edited/deleted
   - Click Edit or Delete icons on the row

4. **Sync Operations**
   - **Pull from AutoCount:** Import POs from AutoCount
   - **Sync to AutoCount:** Push local POs to AutoCount

5. **Finance View**
   - Finance users see only Approved POs
   - Track Pending Receipt vs Goods Received status

---

## 7. Purchasing - Create Order
**Route:** `/purchasing/create`  
**Access:** Admin, Warehouse

Create new purchase orders for supplier procurement.

### Features
- Create regular or cash purchase orders
- Add inventory items or raw materials
- Set delivery dates and remarks

### How to Use

1. **Order Type Selection**
   - Check "This is a Cash Purchase" for market day purchases
   - Cash purchases use raw materials only

2. **Fill Order Details**
   - **Supplier:** Select from active suppliers (required)
   - **PO Date:** Set the order date (required)
   - **Delivery Date:** Optional expected delivery
   - **Remarks:** Add any notes

3. **Cash Purchase Details** (if applicable)
   - Enter cash advance amount
   - Select who provided the cash

4. **Add Line Items**
   - Select item type: Inventory Items or Raw Materials
   - Search and select the item
   - Click "Add Line"
   - Modify quantity and unit price in the table
   - Repeat for additional items

5. **Review & Create**
   - Check the total amount at the bottom
   - Click "Create Order" to save as Draft
   - The system will generate a PO number automatically

---

## 8. Raw Materials
**Route:** `/raw-materials`  
**Access:** Admin, Warehouse

Manage local raw materials for production and BOM assembly. Unlike Inventory, these are NOT synced to AutoCount.

### Features
- View all raw materials with stock levels
- Filter by group, type, and stock status
- Add and delete items
- Adjust stock quantities
- Import via CSV upload

### How to Use

1. **View Raw Materials**
   - Similar interface to Inventory page
   - Shows: SKU, Name, Stock Qty, Reserved, Available, Unit

2. **Add New Raw Material**
   - Click "Add Item" button
   - Fill in details (SKU, Name, Unit, Stock Qty)
   - Set low stock threshold
   - Save

3. **CSV Upload**
   - Click "CSV Upload" button
   - Upload a properly formatted CSV file
   - Preview and confirm import

4. **Adjust Stock**
   - Click the stock adjustment icon on any row
   - Select type, enter quantity, add notes
   - Submit adjustment

---

## 9. Incoming Inventory
**Route:** `/incoming-inventory`  
**Access:** Admin, Warehouse, Fulfillment, Production

Centralized hub for receiving goods, returns, and direct receipts.

### Tabs

#### Pending Tab
- View all approved POs awaiting goods receipt
- Shows supplier, PO number, expected date, and total
- Click "Receive" to start receiving process

#### Receive Tab
- Receive goods against approved purchase orders
- Select PO from dropdown
- Enter quantities received per line item
- Add batch numbers if required
- Record unit cost and warehouse location
- Submit to update inventory

#### Direct Tab (Stock Receipt)
- Receive stock without a PO
- Select inventory item
- Enter quantity, batch number, cost
- Useful for adjustments and corrections

#### Return Tab
- Process goods returns
- Select item and enter return quantity
- Add reason for return
- Updates inventory accordingly

#### History Tab
- View all past receiving transactions
- Filter by date range
- Track who received what and when

### KPI Cards
- **Pending POs:** Orders awaiting goods
- **Pending Items:** Line items to receive
- **Today's Receipts:** Items received today
- **Pending Syncs:** Items not yet synced to AutoCount

---

## 10. Store Orders
**Route:** `/store/orders`  
**Access:** Store, Admin, Warehouse, Fulfillment

View and manage sales orders from stores.

### Features
- View orders from assigned stores
- Filter by status
- Search by order number or store name
- Create new orders

### Status Types
- **Draft:** Order in progress
- **Submitted:** Sent for processing
- **Processing:** Being fulfilled
- **Completed:** Order fulfilled
- **Cancelled:** Order cancelled

### How to Use

1. **View Orders**
   - Use tabs to filter by status
   - Search for specific orders
   - Click on a row to view order details

2. **Create New Order**
   - Click "New Order" for standard order creation
   - Click "Quick Entry" for paste-and-parse method

3. **Refresh Data**
   - Click "Refresh" button to update the list

---

## 11. Store Orders - Create
**Route:** `/store/orders/create`  
**Access:** Store, Admin, Warehouse, Fulfillment

Create new sales orders for stores.

### How to Use

1. **Fill Order Details**
   - **Store:** Select the store placing the order
   - **Order Date:** Set the order date
   - **Delivery Date:** Optional delivery target
   - **Description/Notes:** Add any special instructions

2. **Add Order Items**
   - Use the Item Selector to search for products
   - Select item and enter quantity
   - Click "Add" to add to order
   - Repeat for all items

3. **Review Order Lines**
   - View all added items with pricing
   - Remove items if needed
   - Check total amount

4. **Submit Order**
   - **Save Draft:** Save without submitting
   - **Submit Order:** Send for processing
     - Franchisee stores: Goes to Finance for payment confirmation
     - Own stores: Goes directly to Fulfillment

---

## 12. Store Orders - Quick Entry
**Route:** `/store/orders/quick-entry`  
**Access:** Store, Admin, Warehouse, Fulfillment

Quickly create orders by pasting order messages from messaging apps.

### How to Use

1. **Set Order Details**
   - Select the store
   - Set order and delivery dates

2. **Paste Order Message**
   - Copy the order message from Messenger/WhatsApp/Viber
   - Paste into the text area
   - Click "Parse" button

3. **Review Parsed Items**
   - The system extracts item codes and quantities
   - Green checkmarks indicate recognized items
   - Red X marks indicate unrecognized item codes
   - Edit quantities or remove items as needed

4. **Handle Unparsed Lines**
   - Review any lines that couldn't be parsed
   - Manually add those items if needed

5. **Submit Order**
   - Click "Save Draft" or "Submit Order"
   - Same workflow as regular order creation

### Supported Format
The parser recognizes patterns like:
- `ABC123 x 10`
- `ABC123 - 10 pcs`
- `10x ABC123`
- `ABC123 10`

---

## 13. Fulfillment Dashboard
**Route:** `/fulfillment`  
**Access:** Fulfillment, Admin

Manage order fulfillment and delivery.

### Features
- View all submitted orders for processing
- Approve and fulfill orders
- Generate delivery manifests
- Track order status

### Status Cards
- **Pending Orders:** Own store orders awaiting processing
- **Awaiting Payment:** Franchisee orders pending payment confirmation
- **Processing:** Orders being fulfilled
- **Completed Today:** Orders completed

### How to Use

1. **View Pending Orders**
   - The default tab shows orders ready for fulfillment
   - Search by order number or store name

2. **Process an Order**
   - Click "View" to open order details
   - Review line items
   - Approve the order to begin processing
   - Mark items as picked
   - Complete the order when fulfilled

3. **Generate Manifest**
   - Select multiple orders using checkboxes
   - Click "Generate Manifest"
   - Print or download the delivery manifest

4. **Track Progress**
   - Use tabs to switch between:
     - Pending (ready to process)
     - Processing (in progress)
     - Completed (fulfilled orders)
     - All Orders

---

## 14. Finance Dashboard
**Route:** `/finance`  
**Access:** Finance, Admin

Manage payments and procurement tracking.

### Tabs

#### Sales Orders Tab
View franchisee orders pending payment confirmation.

**Stats Cards:**
- Pending Confirmation count
- Total Pending Value
- Action Required

**How to Use:**
1. Search for specific orders
2. Click "Review" on an order
3. In the order detail:
   - Verify payment reference
   - Confirm payment amount
   - Approve or reject the payment
4. Approved orders move to Fulfillment

#### Procurement Tab
Track purchase order spending and receipt status.

**Stats Cards:**
- Approved POs count
- Pending Receipt count
- Goods Received count
- Pending Value (awaiting receipt)

**Features:**
- Monthly procurement spend chart
- Pending receipt POs widget
- Quick actions to navigate to related pages

**Quick Actions:**
- View All Purchase Orders → `/purchasing`
- Incoming Inventory → `/incoming-inventory`

---

## Role-Based Access Summary

| Module | Admin | Warehouse | Production | Fulfillment | Finance | Store |
|--------|-------|-----------|------------|-------------|---------|-------|
| BOM Manager | ✓ | ✓ | | | | |
| Production | ✓ | | ✓ | | | |
| Inventory | ✓ | ✓ | | | | |
| Suppliers | ✓ | ✓ | | | | |
| Purchasing | ✓ | ✓ | | | ✓ | |
| Raw Materials | ✓ | ✓ | | | | |
| Incoming Inventory | ✓ | ✓ | ✓ | ✓ | | |
| Store Orders | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Fulfillment | ✓ | | | ✓ | | |
| Finance | ✓ | | | | ✓ | |

---

## Tips & Best Practices

1. **Regular Sync:** Periodically sync inventory with AutoCount to ensure data consistency
2. **Low Stock Alerts:** Set appropriate low stock thresholds per item
3. **Batch Tracking:** Always record batch numbers for items requiring traceability
4. **Order Notes:** Use notes fields to communicate special handling requirements
5. **Quick Entry:** Use Quick Entry for fast order processing from messaging apps
6. **Manifest Generation:** Generate manifests for batch deliveries to streamline logistics

---

*Last Updated: January 2026*
