-- Fix RLS: allow Finance to confirm payment on pending_payment orders
-- This enables PATCH /sales_orders for Finance users during confirmation.

DO $$
BEGIN
  -- Enable RLS (safe if already enabled)
  EXECUTE 'ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN
  -- ignore
END $$;

-- Drop old policy if it exists (idempotent)
DROP POLICY IF EXISTS "Finance can confirm payment" ON public.sales_orders;

-- Create policy for Finance role
CREATE POLICY "Finance can confirm payment"
ON public.sales_orders
FOR UPDATE
TO authenticated
USING (
  status = 'pending_payment'
  AND public.is_finance(auth.uid())
)
WITH CHECK (
  status IN ('processing', 'pending_payment')
  AND public.is_finance(auth.uid())
);
