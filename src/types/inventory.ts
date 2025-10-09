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