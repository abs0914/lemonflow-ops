import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export async function generateBatchNumber(): Promise<string> {
  const today = new Date();
  const dateKey = format(today, "yyyy-MM-dd");
  const dateStr = format(today, "yyyyMMdd");

  // Upsert the sequence for today
  const { data: sequence, error } = await supabase
    .from("batch_sequences")
    .select("last_sequence")
    .eq("date_key", dateKey)
    .maybeSingle();

  if (error) throw error;

  let nextSeq = 1;
  
  if (sequence) {
    // Increment existing sequence
    nextSeq = sequence.last_sequence + 1;
    await supabase
      .from("batch_sequences")
      .update({ last_sequence: nextSeq })
      .eq("date_key", dateKey);
  } else {
    // Create new sequence for today
    await supabase
      .from("batch_sequences")
      .insert({ date_key: dateKey, last_sequence: 1 });
  }

  // Format: BATCH-YYYYMMDD-001
  return `BATCH-${dateStr}-${nextSeq.toString().padStart(3, "0")}`;
}
