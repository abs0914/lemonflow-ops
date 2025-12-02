/**
 * sync-sales-order Edge Function
 * 
 * Syncs a Sales Order from Supabase to AutoCount.
 * Called when a store user submits an order.
 * 
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - LEMONCO_API_URL (e.g., https://api.thelemonco.online)
 * - LEMONCO_USERNAME
 * - LEMONCO_PASSWORD
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncSalesOrderRequest {
  salesOrderId: string;
}

interface SalesOrderLine {
  line_number: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  uom: string;
  discount?: string;
  tax_code?: string;
  line_remarks?: string;
}

interface SalesOrder {
  id: string;
  order_number: string;
  debtor_code: string;
  doc_date: string;
  delivery_date?: string;
  description?: string;
  autocount_synced: boolean;
  autocount_doc_no?: string;
  stores?: {
    store_name: string;
    store_code: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sync-sales-order] Starting sync...');

    // Get environment variables
    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials in environment');
    }

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const requestBody: SyncSalesOrderRequest = await req.json();

    if (!requestBody.salesOrderId) {
      throw new Error('Sales Order ID is required');
    }

    // Fetch sales order with store info
    const { data: salesOrder, error: soError } = await supabaseClient
      .from('sales_orders')
      .select(`
        *,
        stores (store_name, store_code)
      `)
      .eq('id', requestBody.salesOrderId)
      .single();

    if (soError || !salesOrder) {
      throw new Error(`Failed to fetch sales order: ${soError?.message || 'Not found'}`);
    }

    const so = salesOrder as SalesOrder;

    // Check if already synced
    if (so.autocount_synced && so.autocount_doc_no) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Sales Order already synced to AutoCount',
          documentNo: so.autocount_doc_no,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order lines
    const { data: lines, error: linesError } = await supabaseClient
      .from('sales_order_lines')
      .select('*')
      .eq('sales_order_id', so.id)
      .order('line_number', { ascending: true });

    if (linesError) {
      throw new Error(`Failed to fetch order lines: ${linesError.message}`);
    }

    if (!lines || lines.length === 0) {
      throw new Error('Sales order has no line items');
    }

    console.log(`[sync-sales-order] Processing order ${so.order_number} with ${lines.length} lines`);

    // Step 1: Authenticate with AutoCount backend
    console.log('[sync-sales-order] Authenticating with backend...');
    const loginResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      throw new Error(`Authentication failed: ${loginResponse.status} - ${loginError}`);
    }

    const loginResult = await loginResponse.json();
    const jwtToken = loginResult.token;
    console.log('[sync-sales-order] Authentication successful');

    // Step 2: Build AutoCount Sales Order payload
    const soPayload = {
      DebtorCode: so.debtor_code,
      DocDate: so.doc_date,
      DeliveryDate: so.delivery_date || so.doc_date,
      Description: so.description || `Order from ${so.stores?.store_name || 'Store'}`,
      Lines: (lines as SalesOrderLine[]).map((line) => ({
        LineNumber: line.line_number,
        ItemCode: line.item_code,
        Description: line.item_name,
        Quantity: line.quantity,
        UnitPrice: line.unit_price,
        UOM: line.uom || 'UNIT',
        Discount: line.discount || '',
        TaxCode: line.tax_code || '',
        Remarks: line.line_remarks || '',
      })),
    };

    console.log('[sync-sales-order] Sending to AutoCount:', JSON.stringify(soPayload));

    // Step 3: Create Sales Order in AutoCount
    const response = await fetch(`${apiUrl}/autocount/sales-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(soPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-sales-order] AutoCount API error:', errorText);

      // Update order with error
      await supabaseClient
        .from('sales_orders')
        .update({
          sync_error_message: `AutoCount error: ${response.status} - ${errorText}`,
        })
        .eq('id', so.id);

      // Log sync failure
      await supabaseClient
        .from('autocount_sync_log')
        .insert({
          reference_id: so.id,
          reference_type: 'sales_order',
          sync_type: 'create',
          sync_status: 'failed',
          error_message: `AutoCount error: ${response.status} - ${errorText}`,
        });

      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[sync-sales-order] Sales Order created:', result);

    // Step 4: Update Supabase record with AutoCount doc number
    await supabaseClient
      .from('sales_orders')
      .update({
        autocount_doc_no: result.docNo || so.order_number,
        autocount_synced: true,
        sync_error_message: null,
        synced_at: new Date().toISOString(),
        status: 'processing',
      })
      .eq('id', so.id);

    // Step 5: Log successful sync
    await supabaseClient
      .from('autocount_sync_log')
      .insert({
        reference_id: so.id,
        reference_type: 'sales_order',
        sync_type: 'create',
        sync_status: 'success',
        autocount_doc_no: result.docNo || so.order_number,
        synced_at: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sales Order synced to AutoCount successfully',
        documentNo: result.docNo || so.order_number,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-sales-order] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

