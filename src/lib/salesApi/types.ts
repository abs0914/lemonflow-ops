// Sales API Types

export interface Store {
  code: string;
  name: string;
  type: "own" | "franchise";
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface StoresResponse {
  count: number;
  type: string | null;
  data: Store[];
}

export interface POSPayment {
  paymentMethod: "CASH" | "CREDIT_CARD" | "GCASH" | "MAYA" | "GRAB_PAY";
  amount: number;
  transactionCount: number;
}

export interface POSSalesLine {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  category?: string;
}

export interface POSDailySales {
  storeCode: string;
  salesDate: string;
  posReference: string;
  autoCountDocNo: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: "pending" | "synced" | "failed" | "already_synced";
  lines: POSSalesLine[];
  payments: POSPayment[];
}

export interface POSDailySalesResponse {
  count: number;
  startDate: string;
  endDate: string;
  storeCode: string | null;
  data: POSDailySales[];
}

export interface SalesOrderLine {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subTotal: number;
}

export interface SalesOrder {
  docNo: string;
  debtorCode: string;
  docDate: string;
  deliveryDate?: string;
  totalAmount: number;
  isCancelled: boolean;
  lines: SalesOrderLine[];
}

export interface SalesOrdersResponse {
  count: number;
  data: SalesOrder[];
}

export interface DateRange {
  from: Date;
  to: Date;
}

export type SalesChannel = "all" | "pos" | "orders";

export interface DashboardFilters {
  dateRange: DateRange;
  storeCodes: string[];
  channel: SalesChannel;
}
