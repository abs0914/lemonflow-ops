import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SalesOrderLine } from "@/types/sales-order";

type NewLineInput = Omit<SalesOrderLine, "id" | "sales_order_id" | "created_at" | "updated_at" | "line_number">;

async function recalcOrderTotal(orderId: string) {
  const { data: lines, error } = await supabase
    .from("sales_order_lines")
    .select("id, sub_total")
    .eq("sales_order_id", orderId)
    .order("line_number", { ascending: true });
  if (error) throw error;
  const total = (lines || []).reduce((s, l: any) => s + Number(l.sub_total || 0), 0);

  // Renumber lines sequentially
  for (let i = 0; i < (lines?.length || 0); i++) {
    await supabase
      .from("sales_order_lines")
      .update({ line_number: i + 1 })
      .eq("id", (lines as any)[i].id);
  }

  const { data: upd, error: upErr } = await supabase
    .from("sales_orders")
    .update({ total_amount: total, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select();
  if (upErr) throw upErr;
  if (!upd || upd.length === 0) throw new Error("Failed to update order total (RLS)");
  return total;
}

async function logChange(orderId: string, action: string, details: any) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    user_id: user?.id,
    entity_type: "sales_order",
    entity_id: orderId,
    action,
    details,
  });
}

async function reReserveIfNeeded(orderId: string, wasReserved: boolean) {
  if (!wasReserved) return;
  await supabase.rpc("release_sales_order_stock", { p_sales_order_id: orderId });
  const { data, error } = await supabase.rpc("reserve_stock_for_sales_order", {
    p_sales_order_id: orderId,
  });
  if (error) throw error;
  if (data && (data as any).success === false) {
    toast.warning(`Stock re-reservation issue: ${(data as any).message || "insufficient stock"}`);
  }
}

export function useFulfillmentLineMutations(orderId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales-order-lines", orderId] });
    qc.invalidateQueries({ queryKey: ["sales-orders"] });
    qc.invalidateQueries({ queryKey: ["order-audit-logs", orderId] });
  };

  const updateLine = useMutation({
    mutationFn: async (input: { lineId: string; quantity: number; unit_price: number; reason: string }) => {
      const { data: order } = await supabase
        .from("sales_orders")
        .select("status, stock_reserved")
        .eq("id", orderId)
        .single();

      const { data: before } = await supabase
        .from("sales_order_lines")
        .select("*")
        .eq("id", input.lineId)
        .single();

      const sub_total = input.quantity * input.unit_price;
      const { data: upd, error } = await supabase
        .from("sales_order_lines")
        .update({ quantity: input.quantity, unit_price: input.unit_price, sub_total })
        .eq("id", input.lineId)
        .select();
      if (error) throw error;
      if (!upd || upd.length === 0) throw new Error("Update blocked (RLS)");

      await recalcOrderTotal(orderId);
      await reReserveIfNeeded(orderId, !!order?.stock_reserved);
      await logChange(orderId, "line_updated", {
        reason: input.reason,
        before: { item_code: before?.item_code, quantity: before?.quantity, unit_price: before?.unit_price, sub_total: before?.sub_total },
        after: { item_code: before?.item_code, quantity: input.quantity, unit_price: input.unit_price, sub_total },
      });
    },
    onSuccess: () => { invalidate(); toast.success("Line updated"); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const deleteLine = useMutation({
    mutationFn: async (input: { lineId: string; reason: string }) => {
      const { data: order } = await supabase
        .from("sales_orders")
        .select("status, stock_reserved")
        .eq("id", orderId)
        .single();

      const { data: before } = await supabase
        .from("sales_order_lines")
        .select("*")
        .eq("id", input.lineId)
        .single();

      const { data: del, error } = await supabase
        .from("sales_order_lines")
        .delete()
        .eq("id", input.lineId)
        .select();
      if (error) throw error;
      if (!del || del.length === 0) throw new Error("Delete blocked (RLS)");

      await recalcOrderTotal(orderId);
      await reReserveIfNeeded(orderId, !!order?.stock_reserved);
      await logChange(orderId, "line_deleted", {
        reason: input.reason,
        before: { item_code: before?.item_code, item_name: before?.item_name, quantity: before?.quantity, unit_price: before?.unit_price, sub_total: before?.sub_total },
      });
    },
    onSuccess: () => { invalidate(); toast.success("Line removed"); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const addLine = useMutation({
    mutationFn: async (input: { line: NewLineInput; reason: string }) => {
      const { data: order } = await supabase
        .from("sales_orders")
        .select("status, stock_reserved")
        .eq("id", orderId)
        .single();

      const { data: existing } = await supabase
        .from("sales_order_lines")
        .select("line_number")
        .eq("sales_order_id", orderId)
        .order("line_number", { ascending: false })
        .limit(1);
      const nextLineNumber = (existing?.[0]?.line_number || 0) + 1;

      const { data: ins, error } = await supabase
        .from("sales_order_lines")
        .insert({ ...input.line, sales_order_id: orderId, line_number: nextLineNumber })
        .select();
      if (error) throw error;
      if (!ins || ins.length === 0) throw new Error("Insert blocked (RLS)");

      await recalcOrderTotal(orderId);
      await reReserveIfNeeded(orderId, !!order?.stock_reserved);
      await logChange(orderId, "line_added", {
        reason: input.reason,
        after: { item_code: input.line.item_code, item_name: input.line.item_name, quantity: input.line.quantity, unit_price: input.line.unit_price, sub_total: input.line.sub_total },
      });
    },
    onSuccess: () => { invalidate(); toast.success("Item added"); },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { updateLine, deleteLine, addLine };
}
