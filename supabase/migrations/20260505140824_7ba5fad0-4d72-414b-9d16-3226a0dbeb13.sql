
-- =============================================================
-- Security hardening migration
-- =============================================================

-- 1. Restrict publicly-readable tables to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view stores" ON public.stores;
CREATE POLICY "Authenticated users can view stores" ON public.stores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can view stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view raw materials" ON public.raw_materials;
CREATE POLICY "Authenticated users can view raw materials" ON public.raw_materials
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view label templates" ON public.label_templates;
CREATE POLICY "Authenticated users can view label templates" ON public.label_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view configs" ON public.app_configs;
CREATE POLICY "Authenticated users can view configs" ON public.app_configs
  FOR SELECT TO authenticated USING (true);

-- 2. Restrict notifications INSERT and autocount_sync_log INSERT to authenticated
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert sync logs" ON public.autocount_sync_log;
CREATE POLICY "Authenticated can insert sync logs" ON public.autocount_sync_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Prevent privilege escalation on user_profiles (role/signature_url protected)
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to change anything
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin cannot change their role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_self_escalation_trigger ON public.user_profiles;
CREATE TRIGGER prevent_role_self_escalation_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 4. Tighten batch_sequences writes — use SECURITY DEFINER function instead
DROP POLICY IF EXISTS "Authenticated users can manage batch sequences" ON public.batch_sequences;
-- keep SELECT policy (already exists)

CREATE OR REPLACE FUNCTION public.next_batch_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date := current_date;
  v_seq integer;
  v_date_str text := to_char(v_date, 'YYYYMMDD');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.batch_sequences (date_key, last_sequence)
  VALUES (v_date, 1)
  ON CONFLICT (date_key) DO UPDATE
    SET last_sequence = batch_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;

  RETURN 'BATCH-' || v_date_str || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- Ensure unique index for the upsert
CREATE UNIQUE INDEX IF NOT EXISTS batch_sequences_date_key_uniq
  ON public.batch_sequences(date_key);

REVOKE EXECUTE ON FUNCTION public.next_batch_number() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_batch_number() TO authenticated;

-- 5. Make user-signatures bucket private
UPDATE storage.buckets SET public = false WHERE id = 'user-signatures';

-- Replace public-read policy on signatures with authenticated-only
DROP POLICY IF EXISTS "Anyone can view signatures" ON storage.objects;
CREATE POLICY "Authenticated users can view signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-signatures');
