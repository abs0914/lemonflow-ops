
-- 1. Supplementary user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own extra roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage extra roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. Broaden role helpers to also consider user_roles
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = user_id AND role = 'Admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_admin.user_id AND role = 'Admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ceo(user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = user_id AND role = 'CEO'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_ceo.user_id AND role = 'CEO'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_finance(user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = user_id AND role = 'Finance'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_finance.user_id AND role = 'Finance'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_accounting(user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = user_id AND role = 'Accounting'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_accounting.user_id AND role = 'Accounting'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_fulfillment(user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = user_id AND role = 'Fulfillment'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_fulfillment.user_id AND role = 'Fulfillment'
  )
$$;

-- 3. Seed extra role for finance@lemonco.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('c273cb48-091e-4301-b1b9-b2b7f9e7eee0', 'Accounting')
ON CONFLICT (user_id, role) DO NOTHING;
