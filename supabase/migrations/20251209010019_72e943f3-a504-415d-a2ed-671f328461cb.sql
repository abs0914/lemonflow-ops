-- Add fulfillment tracking columns to sales_orders
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS fulfilled_by uuid,
ADD COLUMN IF NOT EXISTS fulfilled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS delivery_notes text;

-- Create helper function for fulfillment role check
CREATE OR REPLACE FUNCTION public.is_fulfillment(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = user_id
      AND role = 'Fulfillment'
  )
$$;

-- RLS policy: Fulfillment users can view all orders
CREATE POLICY "Fulfillment can view all orders"
ON public.sales_orders
FOR SELECT
USING (is_fulfillment(auth.uid()));

-- RLS policy: Fulfillment users can update orders (for approval, fulfillment, edits)
CREATE POLICY "Fulfillment can update orders"
ON public.sales_orders
FOR UPDATE
USING (is_fulfillment(auth.uid()));

-- RLS policy: Fulfillment users can view all order lines
CREATE POLICY "Fulfillment can view all order lines"
ON public.sales_order_lines
FOR SELECT
USING (is_fulfillment(auth.uid()));

-- RLS policy: Fulfillment users can manage order lines for orders in submitted/processing status
CREATE POLICY "Fulfillment can manage order lines"
ON public.sales_order_lines
FOR ALL
USING (
  is_fulfillment(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_lines.sales_order_id
    AND so.status IN ('submitted', 'processing')
  )
);