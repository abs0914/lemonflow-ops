import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateItemRequest {
  itemCode: string;
  description: string;
  itemGroup?: string;
  itemType?: string;
  baseUom: string;
  stockControl?: boolean;
  hasBatchNo?: boolean;
  standardCost?: number;
  price?: number;
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

    const requestData: UpdateItemRequest = await req.json();

    console.log("Updating AutoCount item:", requestData);

    // Get AutoCount credentials from config
    const { data: config, error: configError } = await supabaseClient
      .from("app_configs")
      .select("key, value")
      .in("key", ["lemonco_api_url", "lemonco_username", "lemonco_password"]);

    if (configError || !config) {
      throw new Error("Failed to fetch AutoCount configuration");
    }

    const configMap = config.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const apiUrl = configMap.lemonco_api_url;
    const username = configMap.lemonco_username;
    const password = configMap.lemonco_password;

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount configuration is incomplete");
    }

    // Create Basic Auth header
    const credentials = btoa(`${username}:${password}`);
    const basicAuth = `Basic ${credentials}`;

    // Update item in AutoCount
    const updatePayload = {
      ItemCode: requestData.itemCode,
      Description: requestData.description,
      ItemGroup: requestData.itemGroup || "",
      ItemType: requestData.itemType || "CONSUMABLE",
      BaseUOM: requestData.baseUom,
      StockControl: requestData.stockControl ?? true,
      HasBatchNo: requestData.hasBatchNo ?? false,
      StandardCost: requestData.standardCost || 0,
      Price: requestData.price || 0,
    };

    console.log("Calling AutoCount API to update item:", updatePayload);

    const response = await fetch(`${apiUrl}/api/stock/update-item`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AutoCount API error:", errorText);
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("AutoCount update successful:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Item updated in AutoCount successfully",
        data: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error updating AutoCount item:", error);
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