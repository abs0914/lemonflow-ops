import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { supplierId, componentId, quantity, reason, batchNumber } = await req.json();

    console.log('[sync-goods-return] Starting goods return sync', {
      supplierId,
      componentId,
      quantity,
      reason,
      batchNumber,
    });

    // Get supplier details
    const { data: supplier, error: supplierError } = await supabaseClient
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error(`Supplier not found: ${supplierError?.message}`);
    }

    // Get component details
    const { data: component, error: componentError } = await supabaseClient
      .from('components')
      .select('*')
      .eq('id', componentId)
      .single();

    if (componentError || !component) {
      throw new Error(`Component not found: ${componentError?.message}`);
    }

    // Prepare AutoCount Debit Note data
    const autocountData = {
      creditorCode: supplier.supplier_code,
      docDate: new Date().toISOString().split('T')[0],
      description: `Goods Return - ${reason}`,
      detail: [
        {
          itemCode: component.autocount_item_code || component.sku,
          description: component.name,
          qty: quantity,
          uom: component.unit,
          batchNo: batchNumber || null,
          remarks: reason,
        },
      ],
    };

    console.log('[sync-goods-return] AutoCount payload:', JSON.stringify(autocountData, null, 2));

    // Call AutoCount API for Debit Note
    const autocountResponse = await fetch(`${Deno.env.get('LEMONCO_API_URL')}/api/PurchaseDebitNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${Deno.env.get('LEMONCO_USERNAME')}:${Deno.env.get('LEMONCO_PASSWORD')}`)}`,
      },
      body: JSON.stringify(autocountData),
    });

    const responseText = await autocountResponse.text();
    console.log('[sync-goods-return] AutoCount response:', responseText);

    if (!autocountResponse.ok) {
      throw new Error(`AutoCount API error: ${responseText}`);
    }

    const result = JSON.parse(responseText);

    // Update stock movement with sync status
    const { error: updateError } = await supabaseClient
      .from('stock_movements')
      .update({
        autocount_synced: true,
        autocount_doc_no: result.docNo || null,
      })
      .eq('item_id', componentId)
      .eq('movement_type', 'return')
      .eq('supplier_reference', supplierId);

    if (updateError) {
      console.error('[sync-goods-return] Failed to update stock movement:', updateError);
    }

    // Log sync
    await supabaseClient.from('autocount_sync_log').insert({
      sync_type: 'goods_return',
      reference_type: 'supplier',
      reference_id: supplierId,
      sync_status: 'success',
      autocount_doc_no: result.docNo || null,
      synced_at: new Date().toISOString(),
    });

    console.log('[sync-goods-return] Sync completed successfully');

    return new Response(
      JSON.stringify({ success: true, docNo: result.docNo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-goods-return] Error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
