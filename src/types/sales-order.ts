export interface Store {
  id: string;
  store_code: string;
  store_name: string;
  store_type: 'own_store' | 'franchisee';
  debtor_code: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserStoreAssignment {
  id: string;
  user_id: string;
  store_id: string;
  is_primary: boolean;
  can_place_orders: boolean;
  created_at: string;
  stores?: Store;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  store_id: string;
  debtor_code: string;
  doc_date: string;
  delivery_date?: string;
  status: 'draft' | 'submitted' | 'pending_payment' | 'processing' | 'completed' | 'cancelled';
  description?: string;
  total_amount: number;
  created_by: string;
  submitted_at?: string;
  submitted_by?: string;
  autocount_doc_no?: string;
  autocount_synced: boolean;
  sync_error_message?: string;
  synced_at?: string;
  approved_by?: string;
  approved_at?: string;
  fulfilled_by?: string;
  fulfilled_at?: string;
  cancellation_reason?: string;
  delivery_notes?: string;
  payment_amount?: number;
  payment_confirmed_by?: string;
  payment_confirmed_at?: string;
  payment_reference?: string;
  stock_reserved?: boolean;
  created_at: string;
  updated_at: string;
  stores?: Store;
  user_profiles?: { full_name: string };
}

export interface SalesOrderLine {
  id: string;
  sales_order_id: string;
  line_number: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  uom: string;
  discount?: string;
  sub_total: number;
  tax_code?: string;
  line_remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSalesOrderInput {
  store_id: string;
  doc_date: string;
  delivery_date?: string;
  description?: string;
  lines: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at'>[];
}
