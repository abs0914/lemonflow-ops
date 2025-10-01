-- Create assembly_orders table
CREATE TABLE public.assembly_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date timestamp with time zone,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assembly_orders ENABLE ROW LEVEL SECURITY;

-- Admins and Production can view all orders
CREATE POLICY "Admins and Production can view orders"
ON public.assembly_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('Admin', 'Production')
  )
);

-- Admins and Production can create orders
CREATE POLICY "Admins and Production can create orders"
ON public.assembly_orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('Admin', 'Production')
  )
  AND created_by = auth.uid()
);

-- Admins and Production can update orders
CREATE POLICY "Admins and Production can update orders"
ON public.assembly_orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('Admin', 'Production')
  )
);

-- Admins can delete orders
CREATE POLICY "Admins can delete orders"
ON public.assembly_orders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'Admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_assembly_orders_updated_at
BEFORE UPDATE ON public.assembly_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();