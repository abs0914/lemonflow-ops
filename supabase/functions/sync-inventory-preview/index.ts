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
    // Try with limit parameter in case API uses pagination
    const itemsUrl = `${apiUrl}/items?limit=1000`;
    console.log('[sync-inventory-preview] Fetching AutoCount stock items');
    console.log('[sync-inventory-preview] API URL:', apiUrl);
    console.log('[sync-inventory-preview] Full URL:', itemsUrl);
    console.log('[sync-inventory-preview] Token present:', !!authData.token);
    
    const acResponse = await fetch(itemsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[sync-inventory-preview] Response status:', acResponse.status);
    console.log('[sync-inventory-preview] Response headers:', JSON.stringify([...acResponse.headers]));

    if (!acResponse.ok) {
      const errorText = await acResponse.text();
      console.error('[sync-inventory-preview] API Error Response:', errorText);
      console.error('[sync-inventory-preview] Full error details:', {
        status: acResponse.status,
        statusText: acResponse.statusText,
        url: `${apiUrl}/items`,
      });
      throw new Error(`Failed to fetch AutoCount stock items: ${acResponse.status} - ${errorText}`);
    }

    const responseData = await acResponse.json();
    console.log('[sync-inventory-preview] Raw API response:', JSON.stringify(responseData));
    
    // Handle different response structures
    let autoCountItems: AutoCountStockItem[] = [];
    if (Array.isArray(responseData)) {
      autoCountItems = responseData;
    } else if (responseData.items && Array.isArray(responseData.items)) {
      autoCountItems = responseData.items;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      autoCountItems = responseData.data;
    }
    
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
        c => c.autocount_item_code === acItem.itemCode || c.sku === acItem.itemCode
      );

      if (!localComponent) {
        // New item
        preview.push({
          action: 'create',
          itemCode: acItem.itemCode,
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
        if (localComponent.unit !== acItem.baseUom) {
          changes.unit = { old: localComponent.unit, new: acItem.baseUom };
        }
        if (localComponent.stock_control !== acItem.stockControl) {
          changes.stock_control = { old: localComponent.stock_control, new: acItem.stockControl };
        }
        if (localComponent.has_batch_no !== acItem.hasBatchNo) {
          changes.has_batch_no = { old: localComponent.has_batch_no, new: acItem.hasBatchNo };
        }
        if (localComponent.cost_per_unit !== acItem.standardCost) {
          changes.cost_per_unit = { old: localComponent.cost_per_unit, new: acItem.standardCost };
        }
        if (localComponent.price !== acItem.price) {
          changes.price = { old: localComponent.price, new: acItem.price };
        }

        if (Object.keys(changes).length > 0) {
          preview.push({
            action: 'update',
            itemCode: acItem.itemCode,
            description: acItem.description,
            changes,
            localData: localComponent,
            autoCountData: acItem,
          });
        } else {
          preview.push({
            action: 'none',
            itemCode: acItem.itemCode,
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
