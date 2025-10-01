-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Production', 'Warehouse')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Label templates table
CREATE TABLE public.label_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('ZPL', 'PDF')),
  template_content TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view label templates"
  ON public.label_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage label templates"
  ON public.label_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- App configuration table
CREATE TABLE public.app_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view configs"
  ON public.app_configs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage configs"
  ON public.app_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_label_templates_updated_at
  BEFORE UPDATE ON public.label_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_configs_updated_at
  BEFORE UPDATE ON public.app_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Warehouse')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert default app configs
INSERT INTO public.app_configs (key, value, description) VALUES
  ('barcode_type', 'Code-128', 'Default barcode type for label printing'),
  ('qty_separator', '*', 'Separator character for quantity in barcodes'),
  ('include_qty_in_barcode', 'true', 'Whether to include quantity in barcode'),
  ('api_base_url', 'https://api.lemonco.com', 'Base URL for external API');

-- Insert default label templates
INSERT INTO public.label_templates (name, format, template_content, description, is_default) VALUES
  ('Standard ZPL Label', 'ZPL', '^XA^FO50,50^A0N,50,50^FD{ITEM_CODE}^FS^FO50,120^BY3^BCN,100,Y,N,N^FD{BARCODE}^FS^FO50,250^A0N,30,30^FD{DESCRIPTION}^FS^FO50,300^A0N,25,25^FDBatch: {BATCH_NO}^FS^FO50,340^A0N,25,25^FDMfg: {MFG_DATE}^FS^FO50,380^A0N,25,25^FDExp: {EXP_DATE}^FS^XZ', 'Standard ZPL template for Zebra printers', true),
  ('Standard PDF Label', 'PDF', '<div style="font-family: Arial; padding: 20px;"><h1>{ITEM_CODE}</h1><img src="{BARCODE_IMAGE}" /><p>{DESCRIPTION}</p><p>Batch: {BATCH_NO}</p><p>Mfg: {MFG_DATE}</p><p>Exp: {EXP_DATE}</p></div>', 'Standard PDF template for standard printers', false);