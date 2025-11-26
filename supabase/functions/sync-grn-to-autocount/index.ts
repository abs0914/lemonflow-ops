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

    const { purchaseOrderId, componentId, quantity, batchNumber, warehouseLocation } = await req.json();

    console.log('[sync-grn-to-autocount] Starting GRN sync', {
      purchaseOrderId,
      componentId,
      quantity,
      batchNumber,
      warehouseLocation,
    });

    // Get PO details
    const { data: po, error: poError } = await supabaseClient
      .from('purchase_orders')
      .select('*, suppliers(*)')
      .eq('id', purchaseOrderId)
      .single();

    if (poError || !po) {
      throw new Error(`Purchase order not found: ${poError?.message}`);
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

    // Prepare AutoCount GRN data
    const autocountData = {
      creditorCode: po.suppliers.supplier_code,
      docNo: po.autocount_doc_no || po.po_number,
      docDate: new Date().toISOString().split('T')[0],
      description: `GRN for PO ${po.po_number}`,
      location: warehouseLocation || 'MAIN',
      detail: [
        {
          itemCode: component.autocount_item_code || component.sku,
          description: component.name,
          qty: quantity,
          uom: component.unit,
          batchNo: batchNumber || null,
        },
      ],
    };

    console.log('[sync-grn-to-autocount] AutoCount payload:', JSON.stringify(autocountData, null, 2));

    // Call AutoCount API
    const autocountResponse = await fetch(`${Deno.env.get('LEMONCO_API_URL')}/api/GoodsReceivedNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${Deno.env.get('LEMONCO_USERNAME')}:${Deno.env.get('LEMONCO_PASSWORD')}`)}`,
      },
      body: JSON.stringify(autocountData),
    });

    const responseText = await autocountResponse.text();
    console.log('[sync-grn-to-autocount] AutoCount response:', responseText);

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
      .eq('purchase_order_id', purchaseOrderId)
      .eq('item_id', componentId)
      .eq('movement_type', 'receipt');

    if (updateError) {
      console.error('[sync-grn-to-autocount] Failed to update stock movement:', updateError);
    }

    // Log sync
    await supabaseClient.from('autocount_sync_log').insert({
      sync_type: 'grn',
      reference_type: 'purchase_order',
      reference_id: purchaseOrderId,
      sync_status: 'success',
      autocount_doc_no: result.docNo || null,
      synced_at: new Date().toISOString(),
    });

    console.log('[sync-grn-to-autocount] Sync completed successfully');

    return new Response(
      JSON.stringify({ success: true, docNo: result.docNo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-grn-to-autocount] Error:', error);

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
