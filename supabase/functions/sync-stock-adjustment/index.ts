import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StockAdjustmentRequest {
  itemCode: string;
  location: string;
  adjustmentType: "IN" | "OUT" | "SET";
  quantity: number;
  uom: string;
  description: string;
  batchNumber?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const requestData: StockAdjustmentRequest = await req.json();

    console.log("[sync-stock-adjustment] Syncing to AutoCount:", requestData);

    // Get AutoCount credentials from environment variables (Supabase secrets)
    const apiUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount configuration is incomplete. Please check LEMONCO_API_URL, LEMONCO_USERNAME, and LEMONCO_PASSWORD secrets.");
    }

    // Authenticate using /auth/login with username
    console.log("[sync-stock-adjustment] Authenticating");
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("[sync-stock-adjustment] Auth error:", errorText);
      throw new Error(`Authentication failed: ${authResponse.status} - ${errorText}`);
    }

    const authData = await authResponse.json();
    console.log("[sync-stock-adjustment] Auth successful");

    // Create stock adjustment in AutoCount
    const adjustmentPayload = {
      itemCode: requestData.itemCode,
      location: requestData.location,
      adjustmentType: requestData.adjustmentType,
      quantity: requestData.quantity,
      uom: requestData.uom,
      description: requestData.description,
      batchNumber: requestData.batchNumber || null,
      reason: requestData.reason || "Manual Adjustment",
      docDate: new Date().toISOString().split('T')[0],
    };

    console.log("[sync-stock-adjustment] Calling AutoCount API:", adjustmentPayload);

    const response = await fetch(`${apiUrl}/autocount/stock-adjustments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authData.token}`,
      },
      body: JSON.stringify(adjustmentPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AutoCount API error:", errorText);
      
      // Provide specific error message for 404 (item not found)
      if (response.status === 404) {
        throw new Error(
          `Item "${requestData.itemCode}" does not exist in AutoCount. ` +
          `Please create the item in AutoCount first, or use the "Sync to AutoCount" ` +
          `option when creating/editing the item in the app.`
        );
      }
      
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("AutoCount adjustment successful:", result);

    // Log sync success
    await supabaseClient.from("autocount_sync_log").insert({
      reference_id: requestData.itemCode,
      reference_type: "stock_adjustment",
      sync_type: "stock_adjustment",
      sync_status: "success",
      autocount_doc_no: result.docNo || null,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stock adjustment synced to AutoCount successfully",
        data: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[sync-stock-adjustment] Error:", error);
    
    // Note: Cannot log to DB here as request body was already consumed
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});