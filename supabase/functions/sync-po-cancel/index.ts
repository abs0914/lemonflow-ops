import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CancelPORequest {
  poNumber: string;
  autocountDocNo?: string;
}

Deno.serve(async (req) => {
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

    const requestData: CancelPORequest = await req.json();

    console.log("Cancelling PO in AutoCount:", requestData);

    // Get AutoCount credentials
    const apiUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount configuration is incomplete");
    }

    const credentials = btoa(`${username}:${password}`);
    const basicAuth = `Basic ${credentials}`;

    const docNo = requestData.autocountDocNo || requestData.poNumber;

    // Cancel PO in AutoCount
    console.log(`Calling AutoCount API to cancel PO: ${docNo}`);

    const response = await fetch(`${apiUrl}/api/purchase/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: JSON.stringify({
        DocNo: docNo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AutoCount API error:", errorText);
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("AutoCount PO cancelled successfully:", result);

    // Log sync success
    await supabaseClient.from("autocount_sync_log").insert({
      reference_id: requestData.poNumber,
      reference_type: "purchase_order",
      sync_type: "po_cancel",
      sync_status: "success",
      autocount_doc_no: docNo,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "PO cancelled in AutoCount successfully",
        data: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error cancelling PO in AutoCount:", error);
    
    // Log sync failure
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const requestData: CancelPORequest = await req.json();
      await supabaseClient.from("autocount_sync_log").insert({
        reference_id: requestData.poNumber,
        reference_type: "purchase_order",
        sync_type: "po_cancel",
        sync_status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } catch (logError) {
      console.error("Failed to log sync error:", logError);
    }
    
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