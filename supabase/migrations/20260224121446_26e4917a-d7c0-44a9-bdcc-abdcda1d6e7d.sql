-- Drop the restrictive policy that blocks pending_accounting status
DROP POLICY IF EXISTS "Finance can confirm payment" ON public.sales_orders;

-- Recreate with pending_accounting included in allowed statuses
CREATE POLICY "Finance can confirm payment" 
ON public.sales_orders 
FOR UPDATE 
USING ((status = 'pending_payment'::text) AND is_finance(auth.uid()))
WITH CHECK ((status = ANY (ARRAY['processing'::text, 'pending_payment'::text, 'pending_accounting'::text])) AND is_finance(auth.uid()));

-- Also update the other Finance update policy to be consistent
DROP POLICY IF EXISTS "Finance can update pending_payment orders" ON public.sales_orders;

CREATE POLICY "Finance can update pending_payment orders" 
ON public.sales_orders 
FOR UPDATE
USING (is_finance(auth.uid()) AND (status = 'pending_payment'::text));