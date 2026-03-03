
-- Add new columns to purchase_orders
ALTER TABLE public.purchase_orders 
  ADD COLUMN verified_by UUID REFERENCES public.user_profiles(id) DEFAULT NULL,
  ADD COLUMN verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN po_proof_of_payment_url TEXT DEFAULT NULL;

-- Allow Accounting to update approved POs (to verify them)
CREATE POLICY "Accounting can update approved POs to verified"
ON public.purchase_orders FOR UPDATE
TO authenticated
USING (
  is_accounting(auth.uid()) AND status IN ('approved', 'verified')
)
WITH CHECK (
  is_accounting(auth.uid()) AND status IN ('approved', 'verified')
);

-- Allow Production to update approved POs (to upload proof of payment)
CREATE POLICY "Production can update approved POs for proof upload"
ON public.purchase_orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'Production'
  ) AND status = 'approved'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'Production'
  ) AND status = 'approved'
);

-- Create storage bucket for PO payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('po-payment-proofs', 'po-payment-proofs', false);

-- Warehouse/Production can upload payment proofs
CREATE POLICY "Warehouse Production can upload PO payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'po-payment-proofs' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('Admin', 'Warehouse', 'Production')
  )
);

-- Admin/CEO/Finance/Accounting/Warehouse/Production can view PO payment proofs
CREATE POLICY "Authorized users can view PO payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'po-payment-proofs' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('Admin', 'CEO', 'Finance', 'Accounting', 'Warehouse', 'Production')
  )
);
