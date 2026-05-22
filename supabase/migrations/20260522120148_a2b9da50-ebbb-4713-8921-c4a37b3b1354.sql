
-- Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- push_subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: enqueue a push request to the send-push edge function
CREATE OR REPLACE FUNCTION public.trigger_push(
  p_user_ids UUID[],
  p_title TEXT,
  p_body TEXT,
  p_url TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Skip if no recipients
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_supabase_url := 'https://pukezienbcenozlqmunf.supabase.co';
  -- Pull service role key from vault if available, else from settings
  BEGIN
    v_service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  -- Fire-and-forget HTTP POST to edge function
  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(p_user_ids),
      'title', p_title,
      'body', p_body,
      'url', p_url,
      'tag', p_tag
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Never break the calling transaction on push failure
  NULL;
END;
$$;

-- Update notify_roles to also fan out browser push
CREATE OR REPLACE FUNCTION public.notify_roles(
  p_roles text[],
  p_title text,
  p_message text,
  p_type text DEFAULT 'info'::text,
  p_entity_type text DEFAULT NULL::text,
  p_entity_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_ids UUID[];
  v_url TEXT;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
  SELECT up.id, p_title, p_message, p_type, p_entity_type, p_entity_id
  FROM public.user_profiles up
  WHERE up.role = ANY(p_roles);

  SELECT array_agg(up.id) INTO v_user_ids
  FROM public.user_profiles up
  WHERE up.role = ANY(p_roles);

  IF p_entity_type = 'sales_order' AND p_entity_id IS NOT NULL THEN
    v_url := '/fulfillment/orders/' || p_entity_id;
  ELSIF p_entity_type = 'assembly_order' THEN
    v_url := '/production';
  ELSIF p_entity_type IN ('component', 'raw_material') THEN
    v_url := '/inventory';
  ELSE
    v_url := '/dashboard';
  END IF;

  PERFORM public.trigger_push(v_user_ids, p_title, p_message, v_url, p_entity_id);
END;
$$;

-- Update notify_store_users to also fan out browser push
CREATE OR REPLACE FUNCTION public.notify_store_users(
  p_store_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info'::text,
  p_entity_type text DEFAULT NULL::text,
  p_entity_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_ids UUID[];
  v_url TEXT;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id)
  SELECT usa.user_id, p_title, p_message, p_type, p_entity_type, p_entity_id
  FROM user_store_assignments usa
  WHERE usa.store_id = p_store_id;

  SELECT array_agg(usa.user_id) INTO v_user_ids
  FROM user_store_assignments usa
  WHERE usa.store_id = p_store_id;

  IF p_entity_type = 'sales_order' AND p_entity_id IS NOT NULL THEN
    v_url := '/store/orders/' || p_entity_id;
  ELSE
    v_url := '/dashboard';
  END IF;

  PERFORM public.trigger_push(v_user_ids, p_title, p_message, v_url, p_entity_id);
END;
$$;
