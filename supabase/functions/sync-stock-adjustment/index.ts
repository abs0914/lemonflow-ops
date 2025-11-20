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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const requestData: StockAdjustmentRequest = await req.json();

    console.log("Syncing stock adjustment to AutoCount:", requestData);

    // Get AutoCount credentials from environment variables (Supabase secrets)
    const apiUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount configuration is incomplete. Please check LEMONCO_API_URL, LEMONCO_USERNAME, and LEMONCO_PASSWORD secrets.");
    }

    // Create Basic Auth header
    const credentials = btoa(`${username}:${password}`);
    const basicAuth = `Basic ${credentials}`;

    // Create stock adjustment in AutoCount
    const adjustmentPayload = {
      ItemCode: requestData.itemCode,
      Location: requestData.location,
      AdjustmentType: requestData.adjustmentType,
      Quantity: requestData.quantity,
      UOM: requestData.uom,
      Description: requestData.description,
      BatchNumber: requestData.batchNumber || null,
      Reason: requestData.reason || "Manual Adjustment",
      DocDate: new Date().toISOString().split('T')[0],
    };

    console.log("Calling AutoCount API for stock adjustment:", adjustmentPayload);

    const response = await fetch(`${apiUrl}/api/stock/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: JSON.stringify(adjustmentPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AutoCount API error:", errorText);
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("AutoCount adjustment successful:", result);

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
    console.error("Error syncing stock adjustment:", error);
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