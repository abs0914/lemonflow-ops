export interface Component {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  item_group: string | null;
  item_type: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  unit: string;
  price: number | null;
  cost_per_unit: number | null;
  stock_control: boolean | null;
  has_batch_no: boolean | null;
  autocount_item_code: string | null;
  last_synced_at: string | null;
}

export interface RawMaterial {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  item_group: string | null;
  item_type: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  unit: string;
  price: number | null;
  cost_per_unit: number | null;
  stock_control: boolean | null;
  has_batch_no: boolean | null;
  autocount_item_code: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinishedGood {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  item_group: string | null;
  item_type: string | null;
  stock_quantity: number;
  unit: string;
  price: number | null;
  cost_per_unit: number | null;
  autocount_item_code: string;
  autocount_synced: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_terms: number | null;
  is_active: boolean;
  autocount_synced: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_terms: number | null;
  is_active: boolean;
  autocount_synced: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  doc_date: string;
  delivery_date: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'cancelled';
  total_amount: number;
  remarks: string | null;
  created_by: string;
  autocount_doc_no: string | null;
  autocount_synced: boolean;
  sync_error_message: string | null;
  is_cash_purchase: boolean | null;
  cash_advance: number | null;
  cash_given_by: string | null;
  cash_returned: number | null;
  cash_returned_to: string | null;
  goods_received: boolean | null;
  received_by: string | null;
  received_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: Supplier;
  user_profiles?: { full_name: string };
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  component_id: string | null;
  raw_material_id: string | null;
  item_type: 'component' | 'raw_material';
  quantity: number;
  unit_price: number;
  uom: string;
  line_remarks: string | null;
  line_number: number;
  created_at: string;
  updated_at: string;
  components?: { id: string; sku: string; name: string; unit: string; autocount_item_code: string | null } | null;
  raw_materials?: { id: string; sku: string; name: string; unit: string; autocount_item_code: string | null } | null;
}
