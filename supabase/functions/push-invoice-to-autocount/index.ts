import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushInvoiceRequest {
  orderId: string;  // Sales order ID from Supabase
}

interface SalesOrderLine {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: {
    sku: string;
    name: string;
    unit: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[push-invoice-to-autocount] Starting');

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

    const requestBody: PushInvoiceRequest = await req.json();

    if (!requestBody.orderId) {
      throw new Error('Order ID is required');
    }

    // Fetch sales order with customer and lines
    const { data: order, error: orderError } = await supabaseClient
      .from('sales_orders')
      .select(`
        *,
        customers (*),
        sales_order_lines (
          *,
          products (sku, name, unit)
        )
      `)
      .eq('id', requestBody.orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to fetch order: ${orderError?.message || 'Order not found'}`);
    }

    console.log(`[push-invoice-to-autocount] Processing order ${order.order_number}`);

    // Build invoice payload for AutoCount
    const invoicePayload = {
      documentNo: order.order_number,
      debtorCode: order.customers?.customer_code || order.customer_id,
      invoiceDate: order.order_date,
      dueDate: order.delivery_date || order.order_date,
      currencyCode: 'PHP',
      exchangeRate: 1,
      remarks: order.remarks || '',
      lines: (order.sales_order_lines || []).map((line: SalesOrderLine, index: number) => ({
        lineNo: index + 1,
        itemCode: line.products?.sku || '',
        description: line.products?.name || '',
        quantity: line.quantity,
        unitOfMeasure: line.products?.unit || 'unit',
        unitPrice: line.unit_price,
        taxCode: 'SR',
        taxRate: 0,
        remarks: '',
      })),
    };

    console.log('[push-invoice-to-autocount] Invoice payload:', JSON.stringify(invoicePayload));

    // Create invoice in AutoCount
    const response = await fetch(`${apiUrl}/api/sales-invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: Sales invoice endpoint may need auth - check backend
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[push-invoice-to-autocount] Invoice created:', result);

    // Update order with AutoCount doc number
    await supabaseClient
      .from('sales_orders')
      .update({
        autocount_doc_no: result.documentNo || order.order_number,
        autocount_synced: true,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice created in AutoCount',
        documentNo: result.documentNo || order.order_number,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-invoice-to-autocount] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

