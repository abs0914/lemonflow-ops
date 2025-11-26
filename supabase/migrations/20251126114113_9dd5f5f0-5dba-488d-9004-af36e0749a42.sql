-- Add cash purchase and goods receipt fields to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN is_cash_purchase BOOLEAN DEFAULT false,
ADD COLUMN cash_advance NUMERIC DEFAULT 0,
ADD COLUMN cash_returned NUMERIC DEFAULT 0,
ADD COLUMN cash_given_by UUID REFERENCES user_profiles(id),
ADD COLUMN cash_returned_to UUID REFERENCES user_profiles(id),
ADD COLUMN goods_received BOOLEAN DEFAULT false,
ADD COLUMN received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN received_by UUID REFERENCES user_profiles(id);

-- Add cost tracking and expiry fields to stock_movements
ALTER TABLE stock_movements 
ADD COLUMN unit_cost NUMERIC,
ADD COLUMN total_cost NUMERIC,
ADD COLUMN is_expired BOOLEAN DEFAULT false,
ADD COLUMN expired_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN expiry_notes TEXT,
ADD COLUMN marked_expired_by UUID REFERENCES user_profiles(id);

-- Create batch_sequences table for auto-generating batch numbers
CREATE TABLE batch_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key DATE NOT NULL UNIQUE,
  last_sequence INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on batch_sequences
ALTER TABLE batch_sequences ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sequences
CREATE POLICY "Authenticated users can view batch sequences"
ON batch_sequences FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert/update sequences (for batch generation)
CREATE POLICY "Authenticated users can manage batch sequences"
ON batch_sequences FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);