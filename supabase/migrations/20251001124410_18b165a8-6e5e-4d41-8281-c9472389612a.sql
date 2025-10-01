-- Create products table for finished goods
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create components table for raw materials and sub-assemblies
CREATE TABLE public.components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  cost_per_unit DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create BOM items table (junction table)
CREATE TABLE public.bom_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, component_id)
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage products"
ON public.products FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for components
CREATE POLICY "Authenticated users can view components"
ON public.components FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage components"
ON public.components FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for bom_items
CREATE POLICY "Authenticated users can view bom items"
ON public.bom_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage bom items"
ON public.bom_items FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_bom_items_product_id ON public.bom_items(product_id);
CREATE INDEX idx_bom_items_component_id ON public.bom_items(component_id);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_components_sku ON public.components(sku);

-- Create trigger for automatic timestamp updates on products
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on components
CREATE TRIGGER update_components_updated_at
BEFORE UPDATE ON public.components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on bom_items
CREATE TRIGGER update_bom_items_updated_at
BEFORE UPDATE ON public.bom_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();