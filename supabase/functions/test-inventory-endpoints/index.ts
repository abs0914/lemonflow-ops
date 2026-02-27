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

    // --- Auth Guard: require authenticated Admin/Warehouse user ---
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: profile } = await supabaseClient.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !['Admin', 'Warehouse'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Admin or Warehouse access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- End Auth Guard ---

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate using /api/auth/login with email
    console.log('[test-inventory-endpoints] Authenticating');
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Test multiple endpoint variations
    const endpointsToTest = [
      '/autocount/StockItem',
      '/autocount/stockitem',
      '/autocount/stock-item',
      '/autocount/items',
      '/autocount/inventory',
      '/autocount/Item',
      '/api/public/v1/StockItem',
    ];

    const results = [];

    for (const endpoint of endpointsToTest) {
      console.log(`[test-inventory-endpoints] Testing: ${endpoint}`);

      try {
        const response = await fetch(`${apiUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authData.AccessToken}`,
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
      } catch (error) {
        results.push({
          endpoint,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
