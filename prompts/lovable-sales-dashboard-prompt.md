# Lovable Prompt: Lemon-co Sales Reporting Dashboard

Build a **Sales Reporting Dashboard** web application for Lemon-co, a beverage company with multiple owned stores and franchise locations. The dashboard consolidates sales data from two sources: in-store POS systems and online order management.

---

## User Authentication & Roles

### Authentication
- Use **JWT Bearer token** authentication
- Login endpoint: `POST https://api.thelemonco.online/auth/login`
- Request body: `{ "username": "string", "password": "string" }`
- Response: `{ "token": "JWT_TOKEN", "expiresAt": "2024-12-17T00:00:00Z" }`
- Store token securely and include in all API requests as: `Authorization: Bearer {token}`

### User Role: Admin/Owner
- Has access to view sales data from **all stores** (owned stores + franchise stores)
- Can view consolidated reports across all locations
- Can drill down into individual store performance

---

## Data Sources & API Integration

### 1. POS Daily Sales API (In-Store Sales)
**Base URL:** `https://api.thelemonco.online/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pos/daily-sales` | GET | List daily sales with filters |
| `/pos/daily-sales` | POST | Submit daily sales (not needed for dashboard) |
| `/pos/daily-sales/{docNo}` | GET | Get sales by document number |
| `/pos/daily-sales/by-reference/{posReference}` | GET | Get sales by POS reference |

**Query Parameters for GET /pos/daily-sales:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | date | Start date filter (YYYY-MM-DD) |
| `endDate` | date | End date filter (YYYY-MM-DD) |
| `storeCode` | string | Filter by store code (e.g., "STR-TLC-004") |
| `limit` | int | Max records to return (default 100, max 500) |

**Example Response:**
```json
{
  "count": 5,
  "startDate": "2024-12-01",
  "endDate": "2024-12-31",
  "storeCode": null,
  "data": [...]
}
```

**Key Fields from POS Daily Sales:**
```typescript
interface POSDailySales {
  storeCode: string;           // Store identifier (e.g., "STR-TLC-004")
  salesDate: string;           // Date of sales (YYYY-MM-DD)
  posReference: string;        // Unique POS reference
  autoCountDocNo: string;      // AutoCount document number
  subtotal: number;            // Pre-tax total
  taxAmount: number;           // Tax amount
  grandTotal: number;          // Total including tax
  status: "pending" | "synced" | "failed" | "already_synced";
  lines: {
    itemCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
    category?: string;
  }[];
  payments: {
    paymentMethod: "CASH" | "CREDIT_CARD" | "GCASH" | "MAYA" | "GRAB_PAY";
    amount: number;
    transactionCount: number;
  }[];
}
```

### 2. Stores API (Store Master Data)
**Base URL:** `https://api.thelemonco.online/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stores` | GET | List all stores |
| `/stores?type=own` | GET | List owned stores only |
| `/stores?type=franchise` | GET | List franchise stores only |
| `/stores/{storeCode}` | GET | Get specific store by code |
| `/stores/{storeCode}/exists` | GET | Check if store exists |

**Store Code Convention:**
- **Own Stores:** `STR-TLC-XXX` (e.g., `STR-TLC-004`)
- **Franchise Stores:** `FRC-TLC-XXX` (e.g., `FRC-TLC-001`)

**Example Response for GET /stores:**
```json
{
  "count": 2,
  "type": null,
  "data": [
    {
      "code": "STR-TLC-004",
      "name": "Main Store",
      "type": "own",
      "address": "123 Main Street, City",
      "phone": "02-1234567",
      "email": "store@lemonco.ph",
      "isActive": true
    },
    {
      "code": "FRC-TLC-001",
      "name": "Franchise Location 1",
      "type": "franchise",
      "address": "456 Branch Ave, Town",
      "phone": "02-7654321",
      "email": "franchise@partner.ph",
      "isActive": true
    }
  ]
}
```

### 3. Sales Orders API (Online/Franchise Orders)
**Base URL:** `https://api.thelemonco.online/autocount`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sales-orders` | GET | List all sales orders |
| `/sales-orders/{docNo}` | GET | Get specific order by document number |

**Query Parameters:**
- `limit`: Maximum number of records to return

**Key Fields from Sales Orders:**
```typescript
interface SalesOrder {
  docNo: string;               // Document number
  debtorCode: string;          // Customer/Store code
  docDate: string;             // Order date
  deliveryDate?: string;       // Expected delivery
  totalAmount: number;         // Order total
  isCancelled: boolean;        // Cancellation status
  lines: {
    itemCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    subTotal: number;
  }[];
}
```

---

## Dashboard Features

### 1. Summary Cards (Top Section)
Display key metrics for the selected period:
- **Total Sales** (combined POS + Orders)
- **POS Sales Total** (in-store sales only)
- **Order Sales Total** (online/franchise orders only)
- **Number of Transactions**
- **Average Transaction Value**

### 2. Sales Trend Chart
- Line or bar chart showing daily/weekly/monthly sales trends
- Toggle between POS sales, Order sales, or combined view
- Comparison with previous period (optional)

### 3. Sales by Store Table
| Store Code | Store Name | POS Sales | Order Sales | Total | % of Total |
|------------|------------|-----------|-------------|-------|------------|
| STR-TLC-004 | Main Store | ₱50,000 | ₱10,000 | ₱60,000 | 25% |
| FRC-TLC-001 | Franchise Location 1 | ₱30,000 | ₱15,000 | ₱45,000 | 18% |

- Sortable columns
- Click row to drill down into store details

### 4. Payment Method Breakdown (POS Sales)
Pie or donut chart showing:
- Cash vs Card vs E-Wallet distribution
- Payment methods: CASH, CREDIT_CARD, GCASH, MAYA, GRAB_PAY

### 5. Top Products Table
| Rank | Product | Category | Qty Sold | Revenue |
|------|---------|----------|----------|---------|
| 1 | Lemon Juice 500ml | Beverages | 500 | ₱22,500 |
| 2 | Lemon Tea 350ml | Beverages | 350 | ₱12,250 |

---

## Filters & Controls

### Date Range Filter
- Preset options: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, Custom Range
- Date picker for custom range selection

### Store Filter
- Dropdown with multi-select capability
- Options: "All Stores", individual store codes
- Group by: Own Stores, Franchise Stores

### Sales Channel Filter
- Radio buttons or toggle: "All", "POS Only", "Orders Only"

### Export Functionality
- Export to CSV button
- Export to Excel button (XLSX)
- Include all filtered data with columns matching the visible tables

---

## Technical Requirements

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- Recharts or Chart.js for visualizations
- React Query or SWR for data fetching
- Date-fns for date handling

### State Management
- Store JWT token in localStorage with expiry check
- Automatic token refresh or redirect to login on 401

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Stacked cards on small screens
- Horizontal scroll for tables on mobile

### Error Handling
- Display user-friendly error messages
- Retry mechanism for failed API calls
- Loading skeletons during data fetch

---

## Sample API Calls

### Login
```javascript
const response = await fetch('https://api.thelemonco.online/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' })
});
const { token } = await response.json();
```

### Fetch Stores (for filter dropdown)
```javascript
const response = await fetch('https://api.thelemonco.online/api/stores', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: stores } = await response.json();
// Returns: [{ code: "STR-TLC-004", name: "Main Store", type: "own", ... }]
```

### Fetch POS Daily Sales List
```javascript
const response = await fetch('https://api.thelemonco.online/api/pos/daily-sales?startDate=2024-12-01&endDate=2024-12-31', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { count, data: posSales } = await response.json();
```

### Fetch POS Daily Sales by Store
```javascript
const response = await fetch('https://api.thelemonco.online/api/pos/daily-sales?startDate=2024-12-01&endDate=2024-12-31&storeCode=STR-TLC-004', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: storeSales } = await response.json();
```

### Fetch Sales Orders
```javascript
const response = await fetch('https://api.thelemonco.online/autocount/sales-orders?limit=100', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const orders = await response.json();
```

---

## Color Scheme
- Primary: Lemon yellow (#FDE047)
- Secondary: Fresh green (#22C55E)
- Accent: Dark gray (#1F2937)
- Background: White (#FFFFFF) / Light gray (#F9FAFB)

---

## Pages Structure
1. **Login Page** - Simple login form
2. **Dashboard** - Main sales overview with all widgets
3. **Store Details** - Drill-down view for individual store
4. **Reports** - Detailed tabular reports with export options

---

## Important Notes

### ✅ All Required APIs Are Available

All endpoints needed for the dashboard are now live and operational:

| Endpoint | Status | Description |
|----------|--------|-------------|
| `GET /api/stores` | ✅ Live | List all stores for filter dropdown |
| `GET /api/stores?type=own` | ✅ Live | Filter by store type |
| `GET /api/pos/daily-sales` | ✅ Live | List POS sales with date/store filters |
| `GET /autocount/sales-orders` | ✅ Live | List sales orders |

### Store Code Convention
- **Own Stores:** Codes starting with `STR-TLC-` (e.g., `STR-TLC-004`)
- **Franchise Stores:** Codes starting with `FRC-TLC-` (e.g., `FRC-TLC-001`)

### Default Behavior
- The POS daily sales list endpoint defaults to the **last 30 days** if no date range is specified
- Maximum records per request: **500** (use `limit` parameter)

---

## Wireframe Description

```
┌─────────────────────────────────────────────────────────────────┐
│  🍋 Lemon-co Sales Dashboard                    [Logout] [User] │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [Date Range ▼] [Stores ▼] [Channel ▼]     [Export CSV] │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │Total     │ │POS Sales │ │Orders    │ │Trans-    │             │
│ │₱245,000  │ │₱180,000  │ │₱65,000   │ │actions   │             │
│ │▲ 12%     │ │▲ 8%      │ │▲ 25%     │ │1,245     │             │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │     Sales Trend Chart       │ │   Payment Method Breakdown  │ │
│ │   📊 [Bar/Line Graph]       │ │      🍩 [Pie Chart]         │ │
│ │                             │ │   Cash 60% | GCash 25%      │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Sales by Store                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Store Code    │ POS Sales │ Orders  │ Total   │ % Share  │   │
│ │ STR-TLC-004   │ ₱50,000   │ ₱10,000 │ ₱60,000 │ 24.5%    │   │
│ │ FRC-TLC-001   │ ₱30,000   │ ₱15,000 │ ₱45,000 │ 18.4%    │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

