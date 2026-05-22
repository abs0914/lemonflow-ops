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
    // --- Auth + role check ---
    const __authHeader = req.headers.get('Authorization');
    if (!__authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const __token = __authHeader.replace('Bearer ', '');
    const __authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const { data: { user: __user }, error: __userErr } = await __authClient.auth.getUser(__token);
    if (__userErr || !__user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const __admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: __profile } = await __admin.from('user_profiles').select('role').eq('id', __user.id).single();
    if (!__profile || !['Admin','Warehouse','Production'].includes(__profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- end auth ---
  
  let body: ProductionCompleteRequest | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    body = await req.json();
    const { movement_id, component_id, quantity } = body!;

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

    // Get AutoCount API credentials from environment variables
    const apiUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount API credentials not configured");
    }

    // Authenticate with AutoCount to get JWT
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!authResponse.ok) {
      const errTxt = await authResponse.text();
      throw new Error(`AutoCount auth failed: ${authResponse.status} - ${errTxt}`);
    }
    const authData = await authResponse.json();

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
      `${apiUrl}/autocount/stock-adjustments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.token}`,
        },
        body: JSON.stringify(autoCountPayload),
      }
    );

    const respText = await autoCountResponse.text();
    let autoCountResult: any = {};
    try { autoCountResult = JSON.parse(respText); } catch { autoCountResult = { raw: respText }; }
    console.log("AutoCount response:", autoCountResult);

    if (!autoCountResponse.ok) {
      throw new Error(
        `AutoCount API error: ${autoCountResponse.status} - ${respText || "Unknown error"}`
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

      if (body?.movement_id) {
        await supabase.from("autocount_sync_log").insert({
          reference_id: body.movement_id,
          reference_type: "stock_movement",
          sync_type: "production_complete",
          sync_status: "failed",
          error_message: errorMessage,
        });
      }
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
