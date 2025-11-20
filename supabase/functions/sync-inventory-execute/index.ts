import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoCountStockItem {
  code: string;
  description: string;
  itemGroup?: string;
  itemType?: string;
  baseUOM?: string;
  stockControl: boolean;
  hasBatchNo: boolean;
  isActive: boolean;
  costPerUnit?: number;
  price?: number;
  stockBalance?: number;
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

    // Authenticate
    console.log('[sync-inventory-execute] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Get AutoCount stock items
    console.log('[sync-inventory-execute] Fetching AutoCount stock items');
    console.log('[sync-inventory-execute] Using endpoint: /autocount/stockitem');
    const acResponse = await fetch(`${apiUrl}/autocount/stockitem`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!acResponse.ok) {
      throw new Error(`Failed to fetch AutoCount stock items: ${acResponse.status}`);
    }

    const autoCountItems: AutoCountStockItem[] = await acResponse.json();
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
        const existingComponent = existingComponents?.find(
          c => c.autocount_item_code === acItem.code || c.sku === acItem.code
        );

        const componentData = {
          sku: acItem.code,
          name: acItem.description,
          description: acItem.description,
          autocount_item_code: acItem.code,
          item_group: acItem.itemGroup || null,
          item_type: acItem.itemType || 'CONSUMABLE',
          unit: acItem.baseUOM || 'unit',
          stock_control: acItem.stockControl,
          has_batch_no: acItem.hasBatchNo,
          cost_per_unit: acItem.costPerUnit || null,
          price: acItem.price || null,
          stock_quantity: acItem.stockBalance || 0,
          last_synced_at: new Date().toISOString(),
        };

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
        console.error(`Error syncing item ${acItem.code}:`, error);
        errors.push(`${acItem.code}: ${error.message}`);
      }
    }

    console.log('[sync-inventory-execute] Sync complete:', { created, updated, errors: errors.length });

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
