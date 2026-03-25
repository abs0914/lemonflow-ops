-- Add received_quantity column to track partial receipts per line
ALTER TABLE purchase_order_lines 
ADD COLUMN received_quantity NUMERIC NOT NULL DEFAULT 0;

-- Create a function to increment received_quantity atomically
CREATE OR REPLACE FUNCTION public.increment_po_line_received(
  p_line_id UUID,
  p_qty NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_qty NUMERIC;
BEGIN
  UPDATE purchase_order_lines
  SET received_quantity = received_quantity + p_qty
  WHERE id = p_line_id
  RETURNING received_quantity INTO v_new_qty;
  
  RETURN v_new_qty;
END;
$$;