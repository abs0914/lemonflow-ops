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
    const requestData: UpdateItemRequest = await req.json();

    console.log('[update-autocount-item] Updating AutoCount item:', requestData);

    // Get AutoCount credentials from environment variables (Supabase secrets)
    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate
    console.log('[update-autocount-item] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[update-autocount-item] Auth failed:', errorText);
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('[update-autocount-item] Authenticated successfully');

    // Update item in AutoCount - use camelCase payload
    const updatePayload = {
      itemCode: requestData.itemCode,
      description: requestData.description,
      itemGroup: requestData.itemGroup || '',
      itemType: requestData.itemType || 'CONSUMABLE',
      baseUom: requestData.baseUom,
      stockControl: requestData.stockControl ?? true,
      hasBatchNo: requestData.hasBatchNo ?? false,
      standardCost: requestData.standardCost || 0,
      price: requestData.price || 0,
      isActive: true,
    };

    console.log('[update-autocount-item] Updating item in AutoCount:', JSON.stringify(updatePayload));

    const response = await fetch(`${apiUrl}/autocount/items`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    console.log('[update-autocount-item] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[update-autocount-item] Update failed:', errorText);
      throw new Error(`Failed to update item in AutoCount: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[update-autocount-item] Item updated successfully:', JSON.stringify(result));

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