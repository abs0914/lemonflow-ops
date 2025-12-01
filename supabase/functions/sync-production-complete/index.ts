import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProductionCompleteRequest {
  movement_id: string;
  component_id: string;
  quantity: number;
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

    const { movement_id, component_id, quantity }: ProductionCompleteRequest =
      await req.json();

    console.log("Processing production complete sync:", {
      movement_id,
      component_id,
      quantity,
    });

    // Fetch component details
    const { data: component, error: componentError } = await supabase
      .from("components")
      .select("*")
      .eq("id", component_id)
      .single();

    if (componentError) {
      throw new Error(`Failed to fetch component: ${componentError.message}`);
    }

    if (!component.autocount_item_code) {
      throw new Error("Component does not have an AutoCount item code");
    }

    // Fetch AutoCount API credentials
    const { data: apiUrl } = await supabase
      .from("app_configs")
      .select("value")
      .eq("key", "LEMONCO_API_URL")
      .single();

    const { data: username } = await supabase
      .from("app_configs")
      .select("value")
      .eq("key", "LEMONCO_USERNAME")
      .single();

    const { data: password } = await supabase
      .from("app_configs")
      .select("value")
      .eq("key", "LEMONCO_PASSWORD")
      .single();

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount API credentials not configured");
    }

    // Construct stock adjustment payload
    const autoCountPayload = {
      ItemCode: component.autocount_item_code,
      Location: "MAIN",
      AdjustmentType: "IN",
      Quantity: quantity,
      Description: `Production completed - ${component.name}`,
      Reason: "Production",
      DocDate: new Date().toISOString().split("T")[0],
    };

    console.log("Sending to AutoCount:", autoCountPayload);

    // Call AutoCount API
    const autoCountResponse = await fetch(
      `${apiUrl.value}/api/stock-adjustment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${username.value}:${password.value}`)}`,
        },
        body: JSON.stringify(autoCountPayload),
      }
    );

    const autoCountResult = await autoCountResponse.json();
    console.log("AutoCount response:", autoCountResult);

    if (!autoCountResponse.ok) {
      throw new Error(
        `AutoCount API error: ${autoCountResult.message || "Unknown error"}`
      );
    }

    // Update stock movement as synced
    await supabase
      .from("stock_movements")
      .update({
        autocount_synced: true,
        autocount_doc_no: autoCountResult.docNo || null,
      })
      .eq("id", movement_id);

    // Log successful sync
    await supabase.from("autocount_sync_log").insert({
      reference_id: movement_id,
      reference_type: "stock_movement",
      sync_type: "production_complete",
      sync_status: "success",
      autocount_doc_no: autoCountResult.docNo || null,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Production synced to AutoCount successfully",
        autoCountDocNo: autoCountResult.docNo,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Production sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log failed sync
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { movement_id } = await req.json();

      await supabase.from("autocount_sync_log").insert({
        reference_id: movement_id,
        reference_type: "stock_movement",
        sync_type: "production_complete",
        sync_status: "failed",
        error_message: errorMessage,
      });
    } catch (logError) {
      console.error("Failed to log sync error:", logError);
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
