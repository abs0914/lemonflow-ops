import { supabase } from "@/integrations/supabase/client";

export async function generateBatchNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_batch_number");
  if (error) throw error;
  return data as string;
}
