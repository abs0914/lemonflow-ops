import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPORequest {
  purchaseOrderId: string;  // Purchase order ID from Supabase
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[push-po-to-autocount] Starting');

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

    const requestBody: PushPORequest = await req.json();

    if (!requestBody.purchaseOrderId) {
      throw new Error('Purchase Order ID is required');
    }

    // Fetch purchase order with supplier and lines
    const { data: po, error: poError } = await supabaseClient
      .from('purchase_orders')
      .select(`
        *,
        suppliers (*),
        purchase_order_lines (
          *,
          components (sku, name, unit)
        )
      `)
      .eq('id', requestBody.purchaseOrderId)
      .single();

    if (poError || !po) {
      throw new Error(`Failed to fetch PO: ${poError?.message || 'PO not found'}`);
    }

    if (po.autocount_synced && po.autocount_doc_no) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'PO already synced to AutoCount',
          documentNo: po.autocount_doc_no,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[push-po-to-autocount] Processing PO ${po.po_number}`);

    // Build PO payload for AutoCount
    const poPayload = {
      DocNo: po.po_number,
      SupplierCode: po.suppliers?.supplier_code || '',
      DocDate: po.doc_date,
      DeliveryDate: po.delivery_date || po.doc_date,
      Description: po.remarks || '',
      Details: (po.purchase_order_lines || []).map((line: any) => ({
        LineNumber: line.line_number,
        ItemCode: line.components?.sku || '',
        Description: line.components?.name || '',
        Quantity: line.quantity,
        UnitPrice: line.unit_price,
        UOM: line.uom || line.components?.unit || 'unit',
        LineRemarks: line.line_remarks || '',
      })),
    };

    console.log('[push-po-to-autocount] PO payload:', JSON.stringify(poPayload));

    // Create PO in AutoCount using Basic Auth
    const credentials = btoa(`${username}:${password}`);
    const response = await fetch(`${apiUrl}/api/purchase/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(poPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Update PO with error
      await supabaseClient
        .from('purchase_orders')
        .update({
          sync_error_message: `AutoCount error: ${response.status} - ${errorText}`,
        })
        .eq('id', po.id);
      
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[push-po-to-autocount] PO created:', result);

    // Update PO with AutoCount doc number
    await supabaseClient
      .from('purchase_orders')
      .update({
        autocount_doc_no: result.docNo || po.po_number,
        autocount_synced: true,
        sync_error_message: null,
      })
      .eq('id', po.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PO created in AutoCount',
        documentNo: result.docNo || po.po_number,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-po-to-autocount] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

