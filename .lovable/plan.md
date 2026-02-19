

## Store Inventory Report

### Overview
Replace the "Sales Orders" report for Store users with a new "Store Inventory Report" that shows what items the store has ordered from central inventory. This report focuses on stock items received rather than sales metrics, which is more relevant for store operations.

### Changes Required

#### 1. Update Report Configuration (src/pages/Reports.tsx)
- Remove "Store" role from the existing "sales-orders" report config
- Add new "store-inventory" report config with Store-specific access
- Title: "Store Inventory"
- Description: "Summary of items ordered from central inventory"

#### 2. Create New Report Component (src/components/reports/StoreInventoryReport.tsx)
A new report component that aggregates ordered items by:

**Metrics Cards:**
- Total Items Ordered (count of unique items)
- Total Quantity Ordered (sum of all quantities)
- Total Order Value (sum of order amounts)
- Pending Deliveries (orders not yet fulfilled)

**Charts:**
- Orders by Status (pie chart)
- Top 10 Items Ordered (bar chart by quantity)

**Data Table:**
- Item Code
- Item Name
- Total Quantity Ordered
- Unit of Measure
- Number of Orders
- Total Value

The report will:
- Filter by date range
- Automatically filter to only show data for the logged-in store user's assigned stores
- Support CSV, Excel, and Print export

#### 3. Create Table Component (src/components/reports/StoreInventoryReportTable.tsx)
A dedicated table component following the existing pattern (like SalesOrderReportTable) with:
- Export to CSV
- Export to Excel
- Print functionality
- Clickable rows to navigate to the source order

### Technical Details

**Data Query Structure:**
```sql
-- Aggregate sales_order_lines for store's orders
SELECT 
  sol.item_code,
  sol.item_name,
  sol.uom,
  SUM(sol.quantity) as total_quantity,
  SUM(sol.sub_total) as total_value,
  COUNT(DISTINCT so.id) as order_count
FROM sales_order_lines sol
JOIN sales_orders so ON sol.sales_order_id = so.id
WHERE so.store_id IN (user's assigned stores)
  AND so.created_at BETWEEN dateRange.from AND dateRange.to
GROUP BY sol.item_code, sol.item_name, sol.uom
ORDER BY total_quantity DESC
```

**Role Access Matrix:**
| Report | Admin | CEO | Finance | Store | Warehouse | Production |
|--------|-------|-----|---------|-------|-----------|------------|
| Purchase Orders | Yes | Yes | Yes | No | Yes | No |
| Stock Movements | Yes | Yes | Yes | No | Yes | No |
| Assembly Orders | Yes | Yes | Yes | No | No | Yes |
| Sales Orders | Yes | Yes | Yes | No | No | No |
| Sales Dashboard | Yes | Yes | Yes | No | No | No |
| Store Inventory (NEW) | No | No | No | Yes | No | No |

### Files to Create
1. `src/components/reports/StoreInventoryReport.tsx` - Main report component
2. `src/components/reports/StoreInventoryReportTable.tsx` - Table with export functionality

### Files to Modify
1. `src/pages/Reports.tsx` - Update report configurations

