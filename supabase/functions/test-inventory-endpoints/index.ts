import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[test-inventory-endpoints] Starting endpoint test');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate
    console.log('[test-inventory-endpoints] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Test multiple endpoint variations
    const endpointsToTest = [
      '/autocount/items',
      '/autocount/stockitems',
      '/autocount/stock-items',
      '/autocount/stock_items',
      '/autocount/inventory',
      '/autocount/components',
      '/autocount/products',
    ];

    const results = [];

    for (const endpoint of endpointsToTest) {
      console.log(`[test-inventory-endpoints] Testing: ${endpoint}`);
      
      try {
        const response = await fetch(`${apiUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authData.token}`,
            'Content-Type': 'application/json',
          },
        });

        const result: any = {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
        };

        if (response.ok) {
          try {
            const data = await response.json();
            result.dataPreview = Array.isArray(data) ? `Array with ${data.length} items` : 'Object';
            result.firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
          } catch (e) {
            result.dataPreview = 'Non-JSON response';
          }
        } else {
          const errorText = await response.text();
          result.error = errorText.substring(0, 200);
        }

        results.push(result);
        console.log(`[test-inventory-endpoints] ${endpoint}: ${response.status}`);
      } catch (error) {
        results.push({
          endpoint,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`[test-inventory-endpoints] ${endpoint} error:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Endpoint test completed',
        results,
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-inventory-endpoints] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
