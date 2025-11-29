import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateItemRequest {
  itemCode: string;
  description: string;
  itemGroup?: string;
  itemType?: string;
  baseUom?: string;
  stockControl?: boolean;
  hasBatchNo?: boolean;
  standardCost?: number;
  price?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[create-autocount-item] Starting');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Parse request body
    const requestBody: CreateItemRequest = await req.json();
    console.log('[create-autocount-item] Request:', JSON.stringify(requestBody));

    // Validate required fields
    if (!requestBody.itemCode || !requestBody.description) {
      throw new Error('Item code and description are required');
    }

    // Authenticate
    console.log('[create-autocount-item] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[create-autocount-item] Auth failed:', errorText);
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('[create-autocount-item] Authenticated successfully');

    // Create item in AutoCount
    const itemPayload = {
      itemCode: requestBody.itemCode,
      description: requestBody.description,
      itemGroup: requestBody.itemGroup || '',
      itemType: requestBody.itemType || 'CONSUMABLE',
      baseUom: requestBody.baseUom || 'unit',
      stockControl: requestBody.stockControl !== false,
      hasBatchNo: requestBody.hasBatchNo || false,
      standardCost: requestBody.standardCost || 0,
      price: requestBody.price || 0,
      isActive: true,
    };

    console.log('[create-autocount-item] Creating item in AutoCount:', JSON.stringify(itemPayload));

    const createResponse = await fetch(`${apiUrl}/autocount/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemPayload),
    });

    console.log('[create-autocount-item] Response status:', createResponse.status);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[create-autocount-item] Create failed:', errorText);
      
      // Check if item already exists
      if (createResponse.status === 409 || errorText.includes('already exists')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Item already exists in AutoCount',
            details: errorText,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`Failed to create item in AutoCount: ${createResponse.status} - ${errorText}`);
    }

    const responseData = await createResponse.json();
    console.log('[create-autocount-item] Item created successfully:', JSON.stringify(responseData));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Item created in AutoCount successfully',
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[create-autocount-item] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
