
ALTER TABLE public.sales_orders
  ADD COLUMN vat_amount numeric DEFAULT 0,
  ADD COLUMN ewt_amount numeric DEFAULT 0,
  ADD COLUMN underpayment numeric DEFAULT 0,
  ADD COLUMN overpayment numeric DEFAULT 0,
  ADD COLUMN discount_amount numeric DEFAULT 0;
