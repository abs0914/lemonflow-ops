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

interface PreviewChange {
  action: 'create' | 'update' | 'none';
  itemCode: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
  localData?: any;
  autoCountData: AutoCountStockItem;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sync-inventory-preview] Starting preview');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate
    console.log('[sync-inventory-preview] Authenticating');
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
    console.log('[sync-inventory-preview] Fetching AutoCount stock items from /items');
    const acResponse = await fetch(`${apiUrl}/items`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!acResponse.ok) {
      const errorText = await acResponse.text();
      console.error('[sync-inventory-preview] API Error:', errorText);
      throw new Error(`Failed to fetch AutoCount stock items: ${acResponse.status} - ${errorText}`);
    }

    const autoCountItems: AutoCountStockItem[] = await acResponse.json();
    console.log(`[sync-inventory-preview] Found ${autoCountItems.length} AutoCount items`);

    // Get local components
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: localComponents, error } = await supabaseClient
      .from('components')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch local components: ${error.message}`);
    }

    console.log(`[sync-inventory-preview] Found ${localComponents?.length || 0} local components`);

    // Compare and generate preview
    const preview: PreviewChange[] = [];

    for (const acItem of autoCountItems) {
      const localComponent = localComponents?.find(
        c => c.autocount_item_code === acItem.code || c.sku === acItem.code
      );

      if (!localComponent) {
        // New item
        preview.push({
          action: 'create',
          itemCode: acItem.code,
          description: acItem.description,
          autoCountData: acItem,
        });
      } else {
        // Check for changes
        const changes: Record<string, { old: any; new: any }> = {};

        if (localComponent.name !== acItem.description) {
          changes.name = { old: localComponent.name, new: acItem.description };
        }
        if (localComponent.item_group !== acItem.itemGroup) {
          changes.item_group = { old: localComponent.item_group, new: acItem.itemGroup };
        }
        if (localComponent.item_type !== acItem.itemType) {
          changes.item_type = { old: localComponent.item_type, new: acItem.itemType };
        }
        if (localComponent.unit !== acItem.baseUOM) {
          changes.unit = { old: localComponent.unit, new: acItem.baseUOM };
        }
        if (localComponent.stock_control !== acItem.stockControl) {
          changes.stock_control = { old: localComponent.stock_control, new: acItem.stockControl };
        }
        if (localComponent.has_batch_no !== acItem.hasBatchNo) {
          changes.has_batch_no = { old: localComponent.has_batch_no, new: acItem.hasBatchNo };
        }
        if (localComponent.cost_per_unit !== acItem.costPerUnit) {
          changes.cost_per_unit = { old: localComponent.cost_per_unit, new: acItem.costPerUnit };
        }
        if (localComponent.price !== acItem.price) {
          changes.price = { old: localComponent.price, new: acItem.price };
        }

        if (Object.keys(changes).length > 0) {
          preview.push({
            action: 'update',
            itemCode: acItem.code,
            description: acItem.description,
            changes,
            localData: localComponent,
            autoCountData: acItem,
          });
        } else {
          preview.push({
            action: 'none',
            itemCode: acItem.code,
            description: acItem.description,
            autoCountData: acItem,
          });
        }
      }
    }

    const summary = {
      total: preview.length,
      toCreate: preview.filter(p => p.action === 'create').length,
      toUpdate: preview.filter(p => p.action === 'update').length,
      noChange: preview.filter(p => p.action === 'none').length,
    };

    console.log('[sync-inventory-preview] Preview generated:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        preview,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-inventory-preview] Error:', error);
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
