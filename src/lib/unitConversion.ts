import { supabase } from "@/integrations/supabase/client";

export interface UnitConversion {
  from_unit: string;
  to_unit: string;
  conversion_factor: number;
}

export async function convertUnits(
  quantity: number,
  fromUnit: string,
  toUnit: string
): Promise<number> {
  // If same unit, return as-is
  if (fromUnit === toUnit) return quantity;
  
  // Query unit_conversions table
  const { data, error } = await supabase
    .from('unit_conversions')
    .select('conversion_factor')
    .eq('from_unit', fromUnit)
    .eq('to_unit', toUnit)
    .maybeSingle();
    
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(`No conversion found from ${fromUnit} to ${toUnit}`);
  }
  
  return quantity * data.conversion_factor;
}

export async function getAvailableUnits(): Promise<string[]> {
  const { data, error } = await supabase
    .from('unit_conversions')
    .select('from_unit, to_unit');
  
  if (error) {
    console.error('Error fetching units:', error);
    return [];
  }
  
  const units = new Set<string>();
  data?.forEach(row => {
    units.add(row.from_unit);
    units.add(row.to_unit);
  });
  
  return Array.from(units).sort();
}

export async function getConversionFactor(
  fromUnit: string,
  toUnit: string
): Promise<number | null> {
  if (fromUnit === toUnit) return 1;
  
  const { data } = await supabase
    .from('unit_conversions')
    .select('conversion_factor')
    .eq('from_unit', fromUnit)
    .eq('to_unit', toUnit)
    .maybeSingle();
    
  return data?.conversion_factor || null;
}
