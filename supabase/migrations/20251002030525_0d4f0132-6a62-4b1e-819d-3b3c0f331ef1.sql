-- Add inventory levels to products and components tables
ALTER TABLE public.products
ADD COLUMN stock_quantity numeric DEFAULT 0 NOT NULL;

ALTER TABLE public.components
ADD COLUMN stock_quantity numeric DEFAULT 0 NOT NULL;

-- Create stock_movements table to track all inventory changes
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_type text NOT NULL, -- 'receipt', 'issue', 'adjustment', 'assembly_consume', 'assembly_produce'
  item_type text NOT NULL, -- 'product' or 'component'
  item_id uuid NOT NULL,
  quantity numeric NOT NULL,
  reference_type text, -- 'assembly_order', 'manual_adjustment', etc.
  reference_id uuid,
  notes text,
  performed_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_movement_type CHECK (movement_type IN ('receipt', 'issue', 'adjustment', 'assembly_consume', 'assembly_produce')),
  CONSTRAINT valid_item_type CHECK (item_type IN ('product', 'component'))
);

-- Enable RLS on stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_movements
CREATE POLICY "Authenticated users can view stock movements"
ON public.stock_movements
FOR SELECT
USING (true);

CREATE POLICY "Admins and Production can create stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('Admin', 'Production', 'Warehouse')
  )
  AND performed_by = auth.uid()
);

-- Create index for better query performance
CREATE INDEX idx_stock_movements_item ON public.stock_movements(item_type, item_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- Create function to update stock quantity
CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.item_type = 'product' THEN
    UPDATE products
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF NEW.item_type = 'component' THEN
    UPDATE components
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.item_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update stock when movement is recorded
CREATE TRIGGER update_stock_on_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_quantity();