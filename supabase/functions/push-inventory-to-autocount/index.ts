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
    console.log('[push-inventory-to-autocount] Starting push');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate with LemonCo API
    console.log('[push-inventory-to-autocount] Authenticating');
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all components from local database
    const { data: components, error: fetchError } = await supabaseClient
      .from('components')
      .select('*');

    if (fetchError) throw fetchError;
    if (!components || components.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          results: { created: 0, updated: 0, failed: 0, errors: [] },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[push-inventory-to-autocount] Pushing ${components.length} items`);

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const component of components) {
      try {
        const itemPayload = {
          ItemCode: component.autocount_item_code || component.sku,
          Description: component.description || component.name,
          ItemGroup: component.item_group,
          ItemType: component.item_type || 'CONSUMABLE',
          BaseUom: component.unit || 'unit',
          StockControl: component.stock_control ?? true,
          HasBatchNo: component.has_batch_no ?? false,
          IsActive: true,
          StandardCost: component.cost_per_unit || 0,
          Price: component.price || 0,
        };

        console.log(`[push-inventory-to-autocount] Pushing item ${itemPayload.ItemCode}`);

        // Try to create the item first
        const createResponse = await fetch(`${apiUrl}/autocount/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.AccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemPayload),
        });

        if (createResponse.ok) {
          created++;
          console.log(`[push-inventory-to-autocount] Created ${itemPayload.ItemCode}`);
        } else {
          const createError = await createResponse.text();
          console.log(`[push-inventory-to-autocount] Create failed for ${itemPayload.ItemCode}, trying update`);
          
          // If create failed, try to update
          const updateResponse = await fetch(`${apiUrl}/autocount/items/${itemPayload.ItemCode}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${authData.AccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(itemPayload),
          });

          if (updateResponse.ok) {
            updated++;
            console.log(`[push-inventory-to-autocount] Updated ${itemPayload.ItemCode}`);
          } else {
            const updateError = await updateResponse.text();
            console.error(`[push-inventory-to-autocount] Both create and update failed for ${itemPayload.ItemCode}`);
            failed++;
            errors.push(`${itemPayload.ItemCode}: ${updateError}`);
          }
        }

        // Update last_synced_at
        await supabaseClient
          .from('components')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', component.id);

      } catch (error: any) {
        console.error(`[push-inventory-to-autocount] Error pushing ${component.sku}:`, error);
        failed++;
        errors.push(`${component.sku}: ${error.message}`);
      }
    }

    console.log('[push-inventory-to-autocount] Push complete:', { created, updated, failed });

    // Log push summary
    await supabaseClient.from('autocount_sync_log').insert({
      reference_id: 'inventory_push',
      reference_type: 'inventory',
      sync_type: 'push',
      sync_status: failed === 0 ? 'success' : 'partial',
      error_message: errors.length > 0 ? errors.join('; ') : null,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        results: { created, updated, failed, errors },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-inventory-to-autocount] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
