import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushStockRequest {
  componentIds?: string[];  // Optional: specific components to push. If empty, push all unsynced.
  forceUpdate?: boolean;    // If true, update even if already synced
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[push-stock-to-autocount] Starting');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    let requestBody: PushStockRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use defaults
    }

    // Authenticate with AutoCount API
    console.log('[push-stock-to-autocount] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Fetch components to push
    let query = supabaseClient.from('components').select('*');
    
    if (requestBody.componentIds && requestBody.componentIds.length > 0) {
      query = query.in('id', requestBody.componentIds);
    } else if (!requestBody.forceUpdate) {
      // Only fetch components that haven't been synced yet
      query = query.is('autocount_item_code', null);
    }

    const { data: components, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch components: ${fetchError.message}`);
    }

    console.log(`[push-stock-to-autocount] Found ${components?.length || 0} components to push`);

    const results = {
      success: [] as string[],
      failed: [] as { sku: string; error: string }[],
      skipped: [] as string[],
    };

    for (const component of components || []) {
      try {
        // Check if item already exists in AutoCount
        const checkResponse = await fetch(`${apiUrl}/items/${encodeURIComponent(component.sku)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authData.token}`,
            'Content-Type': 'application/json',
          },
        });

        const itemExists = checkResponse.ok;

        const itemPayload = {
          itemCode: component.sku,
          description: component.name,
          itemGroup: component.item_group || '',
          itemType: component.item_type || 'CONSUMABLE',
          baseUom: component.unit || 'unit',
          stockControl: component.stock_control !== false,
          hasBatchNo: component.has_batch_no || false,
          standardCost: component.cost_per_unit || 0,
          price: component.price || 0,
          isActive: true,
        };

        let response: Response;
        if (itemExists && requestBody.forceUpdate) {
          // Update existing item
          response = await fetch(`${apiUrl}/api/stock/update-item`, {
            method: 'PUT',
            headers: {
              'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(itemPayload),
          });
        } else if (!itemExists) {
          // Create new item
          response = await fetch(`${apiUrl}/items`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authData.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(itemPayload),
          });
        } else {
          results.skipped.push(component.sku);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          results.failed.push({ sku: component.sku, error: errorText });
          continue;
        }

        // Update component with sync status
        await supabaseClient
          .from('components')
          .update({
            autocount_item_code: component.sku,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', component.id);

        results.success.push(component.sku);
        console.log(`[push-stock-to-autocount] Pushed ${component.sku} successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ sku: component.sku, error: errorMessage });
      }
    }

    console.log('[push-stock-to-autocount] Complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-stock-to-autocount] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

