import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RetryRequest {
  sync_log_id?: string;
  reference_id?: string;
  sync_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sync_log_id, reference_id, sync_type }: RetryRequest = await req.json();

    console.log("Retry request received:", { sync_log_id, reference_id, sync_type });

    // Get the sync log entry
    let query = supabase.from("autocount_sync_log").select("*");
    
    if (sync_log_id) {
      query = query.eq("id", sync_log_id);
    } else if (reference_id) {
      query = query.eq("reference_id", reference_id);
    }
    
    const { data: syncLog, error: fetchError } = await query.single();

    if (fetchError || !syncLog) {
      throw new Error(`Sync log not found: ${fetchError?.message || "No matching record"}`);
    }

    console.log("Found sync log:", syncLog);

    // Increment retry count
    await supabase
      .from("autocount_sync_log")
      .update({ 
        retry_count: (syncLog.retry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", syncLog.id);

    // Get AutoCount API credentials
    const apiUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount API credentials not configured");
    }

    let result: { success: boolean; docNo?: string; message?: string };

    // Handle different sync types
    switch (syncLog.sync_type) {
      case "production_complete": {
        // Fetch the stock movement
        const { data: movement, error: movementError } = await supabase
          .from("stock_movements")
          .select("*")
          .eq("id", syncLog.reference_id)
          .single();

        if (movementError || !movement) {
          throw new Error(`Stock movement not found: ${movementError?.message}`);
        }

        // Fetch component
        const { data: component, error: componentError } = await supabase
          .from("components")
          .select("*")
          .eq("id", movement.item_id)
          .single();

        if (componentError || !component?.autocount_item_code) {
          throw new Error("Component or AutoCount item code not found");
        }

        // Construct stock adjustment payload
        const payload = {
          ItemCode: component.autocount_item_code,
          Location: "MAIN",
          AdjustmentType: "IN",
          Quantity: movement.quantity,
          Description: `Production completed - ${component.name}`,
          Reason: "Production",
          DocDate: new Date().toISOString().split("T")[0],
        };

        console.log("Retrying production sync:", payload);

        const response = await fetch(`${apiUrl}/api/stock-adjustment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          },
          body: JSON.stringify(payload),
        });

        const autoCountResult = await response.json();

        if (!response.ok) {
          throw new Error(`AutoCount API error: ${autoCountResult.message || "Unknown error"}`);
        }

        // Update stock movement as synced
        await supabase
          .from("stock_movements")
          .update({
            autocount_synced: true,
            autocount_doc_no: autoCountResult.docNo || null,
          })
          .eq("id", movement.id);

        result = { success: true, docNo: autoCountResult.docNo };
        break;
      }

      case "grn":
      case "goods_receipt": {
        // Fetch the stock movement for GRN
        const { data: movement, error: movementError } = await supabase
          .from("stock_movements")
          .select("*")
          .eq("id", syncLog.reference_id)
          .single();

        if (movementError || !movement) {
          throw new Error(`Stock movement not found: ${movementError?.message}`);
        }

        // Determine item type and fetch details
        let itemCode: string | null = null;
        
        if (movement.item_type === "component") {
          const { data: component } = await supabase
            .from("components")
            .select("autocount_item_code")
            .eq("id", movement.item_id)
            .single();
          itemCode = component?.autocount_item_code || null;
        } else if (movement.item_type === "raw_material") {
          const { data: rawMaterial } = await supabase
            .from("raw_materials")
            .select("autocount_item_code")
            .eq("id", movement.item_id)
            .single();
          itemCode = rawMaterial?.autocount_item_code || null;
        }

        if (!itemCode) {
          throw new Error("AutoCount item code not found for this item");
        }

        const payload = {
          ItemCode: itemCode,
          Location: "MAIN",
          AdjustmentType: "IN",
          Quantity: movement.quantity,
          Description: `GRN Retry - ${movement.notes || "No notes"}`,
          Reason: "GoodsReceipt",
          DocDate: new Date().toISOString().split("T")[0],
        };

        const response = await fetch(`${apiUrl}/api/stock-adjustment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          },
          body: JSON.stringify(payload),
        });

        const autoCountResult = await response.json();

        if (!response.ok) {
          throw new Error(`AutoCount API error: ${autoCountResult.message || "Unknown error"}`);
        }

        await supabase
          .from("stock_movements")
          .update({
            autocount_synced: true,
            autocount_doc_no: autoCountResult.docNo || null,
          })
          .eq("id", movement.id);

        result = { success: true, docNo: autoCountResult.docNo };
        break;
      }

      case "stock_adjustment": {
        // Similar to production_complete
        const { data: movement, error: movementError } = await supabase
          .from("stock_movements")
          .select("*")
          .eq("id", syncLog.reference_id)
          .single();

        if (movementError || !movement) {
          throw new Error(`Stock movement not found: ${movementError?.message}`);
        }

        let itemCode: string | null = null;
        
        if (movement.item_type === "component") {
          const { data: component } = await supabase
            .from("components")
            .select("autocount_item_code")
            .eq("id", movement.item_id)
            .single();
          itemCode = component?.autocount_item_code || null;
        } else if (movement.item_type === "raw_material") {
          const { data: rawMaterial } = await supabase
            .from("raw_materials")
            .select("autocount_item_code")
            .eq("id", movement.item_id)
            .single();
          itemCode = rawMaterial?.autocount_item_code || null;
        }

        if (!itemCode) {
          throw new Error("AutoCount item code not found");
        }

        const adjustmentType = movement.quantity >= 0 ? "IN" : "OUT";
        const payload = {
          ItemCode: itemCode,
          Location: "MAIN",
          AdjustmentType: adjustmentType,
          Quantity: Math.abs(movement.quantity),
          Description: `Stock Adjustment Retry - ${movement.notes || "No notes"}`,
          Reason: "StockAdjustment",
          DocDate: new Date().toISOString().split("T")[0],
        };

        const response = await fetch(`${apiUrl}/api/stock-adjustment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          },
          body: JSON.stringify(payload),
        });

        const autoCountResult = await response.json();

        if (!response.ok) {
          throw new Error(`AutoCount API error: ${autoCountResult.message || "Unknown error"}`);
        }

        await supabase
          .from("stock_movements")
          .update({
            autocount_synced: true,
            autocount_doc_no: autoCountResult.docNo || null,
          })
          .eq("id", movement.id);

        result = { success: true, docNo: autoCountResult.docNo };
        break;
      }

      default:
        throw new Error(`Unknown sync type: ${syncLog.sync_type}`);
    }

    // Update sync log as successful
    await supabase
      .from("autocount_sync_log")
      .update({
        sync_status: "success",
        autocount_doc_no: result.docNo || null,
        synced_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", syncLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sync retry successful",
        docNo: result.docNo,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Retry sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Try to update the sync log with the new error
    try {
      const { sync_log_id } = await req.json();
      if (sync_log_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        await supabase
          .from("autocount_sync_log")
          .update({
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sync_log_id);
      }
    } catch (logError) {
      console.error("Failed to update error in sync log:", logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
