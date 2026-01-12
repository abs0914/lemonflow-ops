import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoCountStockItem {
  itemCode: string;
  description: string;
  itemGroup?: string;
  itemType?: string;
  baseUom?: string;
  stockControl?: boolean;
  hasBatchNo?: boolean;
  isActive?: boolean;
  standardCost?: number;
  price?: number;
  stockBalance?: number;
  mainSupplier?: string;
  barcode?: string;
  hasBom?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sync-inventory-execute] Starting sync');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate using /auth/login with username
    console.log('[sync-inventory-execute] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const authError = await authResponse.text();
      console.error('[sync-inventory-execute] Auth error:', authError);
      throw new Error(`Authentication failed: ${authResponse.status} - ${authError}`);
    }

    const authData = await authResponse.json();
    console.log('[sync-inventory-execute] Auth successful');

    // Get AutoCount stock items
    const itemsUrl = `${apiUrl}/autocount/items?limit=1000`;
    console.log('[sync-inventory-execute] Fetching AutoCount stock items from:', itemsUrl);

    const acResponse = await fetch(itemsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[sync-inventory-execute] Response status:', acResponse.status);

    if (!acResponse.ok) {
      const errorText = await acResponse.text();
      console.error('[sync-inventory-execute] API Error:', errorText);
      throw new Error(`Failed to fetch AutoCount stock items: ${acResponse.status} - ${errorText}`);
    }

    const responseData = await acResponse.json();
    console.log('[sync-inventory-execute] Raw API response:', JSON.stringify(responseData));
    
    // Handle different response structures
    let autoCountItems: AutoCountStockItem[] = [];
    if (Array.isArray(responseData)) {
      autoCountItems = responseData;
    } else if (responseData.items && Array.isArray(responseData.items)) {
      autoCountItems = responseData.items;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      autoCountItems = responseData.data;
    }
    
    console.log(`[sync-inventory-execute] Found ${autoCountItems.length} AutoCount items`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get existing components
    const { data: existingComponents } = await supabaseClient
      .from('components')
      .select('*');

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const acItem of autoCountItems) {
      try {
        console.log(`[sync-inventory-execute] Processing item ${acItem.itemCode}, stockBalance:`, acItem.stockBalance);
        
        const existingComponent = existingComponents?.find(
          c => c.autocount_item_code === acItem.itemCode || c.sku === acItem.itemCode
        );

        const componentData = {
          sku: acItem.itemCode,
          name: acItem.description,
          description: acItem.description,
          autocount_item_code: acItem.itemCode,
          item_group: acItem.itemGroup || null,
          item_type: acItem.itemType || 'CONSUMABLE',
          unit: acItem.baseUom || 'unit',
          stock_control: acItem.stockControl ?? true,
          has_batch_no: acItem.hasBatchNo ?? false,
          cost_per_unit: acItem.standardCost || null,
          price: acItem.price || null,
          stock_quantity: acItem.stockBalance !== undefined ? acItem.stockBalance : existingComponent?.stock_quantity || 0,
          last_synced_at: new Date().toISOString(),
        };

        console.log(`[sync-inventory-execute] Component data for ${acItem.itemCode}:`, componentData);

        if (existingComponent) {
          // Update existing
          const { error } = await supabaseClient
            .from('components')
            .update(componentData)
            .eq('id', existingComponent.id);

          if (error) throw error;
          updated++;
        } else {
          // Create new
          const { error } = await supabaseClient
            .from('components')
            .insert(componentData);

          if (error) throw error;
          created++;
        }
      } catch (error: any) {
        console.error(`Error syncing item ${acItem.itemCode}:`, error);
        errors.push(`${acItem.itemCode}: ${error.message}`);
      }
    }

    console.log('[sync-inventory-execute] Sync complete:', { created, updated, errors: errors.length });

    // Log sync summary
    await supabaseClient.from('autocount_sync_log').insert({
      reference_id: 'inventory_sync',
      reference_type: 'inventory',
      sync_type: 'pull',
      sync_status: errors.length === 0 ? 'success' : 'partial',
      error_message: errors.length > 0 ? errors.join('; ') : null,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          created,
          updated,
          errors,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-inventory-execute] Error:', error);
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
