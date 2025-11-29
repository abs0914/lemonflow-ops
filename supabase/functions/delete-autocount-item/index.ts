import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteItemRequest {
  itemCode: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[delete-autocount-item] Starting');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Parse request body
    const requestBody: DeleteItemRequest = await req.json();
    console.log('[delete-autocount-item] Request:', JSON.stringify(requestBody));

    // Validate required fields
    if (!requestBody.itemCode) {
      throw new Error('Item code is required');
    }

    // Authenticate
    console.log('[delete-autocount-item] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[delete-autocount-item] Auth failed:', errorText);
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('[delete-autocount-item] Authenticated successfully');

    // Delete item in AutoCount (soft delete - sets IsActive = false)
    console.log('[delete-autocount-item] Deleting item in AutoCount');

    const deleteResponse = await fetch(`${apiUrl}/autocount/items/${requestBody.itemCode}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[delete-autocount-item] Response status:', deleteResponse.status);

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[delete-autocount-item] Delete failed:', errorText);
      
      // If item not found, consider it already deleted
      if (deleteResponse.status === 404) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Item not found in AutoCount (may already be deleted)',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`Failed to delete item in AutoCount: ${deleteResponse.status} - ${errorText}`);
    }

    const responseData = await deleteResponse.json();
    console.log('[delete-autocount-item] Item deleted successfully:', JSON.stringify(responseData));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Item deleted (deactivated) in AutoCount successfully',
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[delete-autocount-item] Error:', error);
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
