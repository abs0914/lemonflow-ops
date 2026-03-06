/**
 * auto-sync-to-autocount Edge Function
 * 
 * Runs every 5 minutes via pg_cron to automatically sync unsynced records to AutoCount.
 * Processes: sales_orders, stores, suppliers
 * 
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - LEMONCO_API_URL
 * - LEMONCO_USERNAME
 * - LEMONCO_PASSWORD
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SyncResult {
  type: string;
  id: string;
  success: boolean;
  error?: string;
  docNo?: string;
}


const MAX_AUTO_RETRY = 10; // Stop auto-retrying after 10 consecutive failures

async function getFailedRetryCount(supabaseClient: any, referenceId: string, referenceType: string): Promise<number> {
  const { data } = await supabaseClient
    .from('autocount_sync_log')
    .select('sync_status')
    .eq('reference_id', referenceId)
    .eq('reference_type', referenceType)
    .eq('sync_type', 'auto_create')
    .order('created_at', { ascending: false })
    .limit(MAX_AUTO_RETRY);
  
  if (!data || data.length === 0) return 0;
  // Count consecutive failures from most recent
  let count = 0;
  for (const log of data) {
    if (log.sync_status === 'failed') count++;
    else break;
  }
  return count;
}

async function authenticateAutoCount(apiUrl: string, username: string, password: string): Promise<string> {
  const loginResponse = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    throw new Error(`AutoCount authentication failed: ${loginResponse.status} - ${errorText}`);
  }

  const loginResult = await loginResponse.json();
  return loginResult.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: SyncResult[] = [];

  try {
    console.log('[auto-sync] Starting automatic sync batch...');

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

    // Authenticate with AutoCount
    let jwtToken: string;
    try {
      jwtToken = await authenticateAutoCount(apiUrl, username, password);
      console.log('[auto-sync] AutoCount authentication successful');
    } catch (authError) {
      console.error('[auto-sync] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'AutoCount authentication failed', details: String(authError) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================
    // 1. Sync unsynced Sales Orders (submitted status)
    // =============================================
    const { data: unsyncedOrders, error: soError } = await supabaseClient
      .from('sales_orders')
      .select(`*, stores (store_name, store_code)`)
      .eq('autocount_synced', false)
      .in('status', ['submitted'])
      .is('autocount_doc_no', null)
      .order('created_at', { ascending: true })
      .limit(20);

    if (soError) {
      console.error('[auto-sync] Error fetching unsynced sales orders:', soError);
    } else if (unsyncedOrders && unsyncedOrders.length > 0) {
      console.log(`[auto-sync] Found ${unsyncedOrders.length} unsynced sales orders`);

      for (const so of unsyncedOrders) {
        try {
          // Fetch order lines
          const { data: lines, error: linesError } = await supabaseClient
            .from('sales_order_lines')
            .select('*')
            .eq('sales_order_id', so.id)
            .order('line_number', { ascending: true });

          if (linesError || !lines || lines.length === 0) {
            results.push({ type: 'sales_order', id: so.id, success: false, error: 'No order lines found' });
            continue;
          }

          const soPayload = {
            DebtorCode: so.debtor_code,
            DocDate: so.doc_date,
            DeliveryDate: so.delivery_date || so.doc_date,
            Description: so.description || `Order from ${so.stores?.store_name || 'Store'}`,
            Lines: lines.map((line: any) => ({
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
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorText;
            } catch {
              errorMessage = errorText.substring(0, 200);
            }

            await supabaseClient.from('sales_orders').update({ sync_error_message: errorMessage }).eq('id', so.id);
            await supabaseClient.from('autocount_sync_log').insert({
              reference_id: so.id,
              reference_type: 'sales_order',
              sync_type: 'auto_create',
              sync_status: 'failed',
              error_message: errorMessage,
            });

            results.push({ type: 'sales_order', id: so.id, success: false, error: errorMessage });
            continue;
          }

          const result = await response.json();

          await supabaseClient.from('sales_orders').update({
            autocount_doc_no: result.docNo || so.order_number,
            autocount_synced: true,
            sync_error_message: null,
            synced_at: new Date().toISOString(),
            status: 'processing',
          }).eq('id', so.id);

          await supabaseClient.from('autocount_sync_log').insert({
            reference_id: so.id,
            reference_type: 'sales_order',
            sync_type: 'auto_create',
            sync_status: 'success',
            autocount_doc_no: result.docNo || so.order_number,
            synced_at: new Date().toISOString(),
          });

          results.push({ type: 'sales_order', id: so.id, success: true, docNo: result.docNo });
          console.log(`[auto-sync] Sales order ${so.order_number} synced successfully`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          results.push({ type: 'sales_order', id: so.id, success: false, error: errorMsg });
          console.error(`[auto-sync] Error syncing sales order ${so.order_number}:`, err);
        }
      }
    } else {
      console.log('[auto-sync] No unsynced sales orders found');
    }

    // =============================================
    // 2. Sync unsynced Stores
    // =============================================
    const { data: unsyncedStores, error: storeError } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('autocount_synced', false)
      .eq('is_active', true)
      .limit(20);

    if (storeError) {
      console.error('[auto-sync] Error fetching unsynced stores:', storeError);
    } else if (unsyncedStores && unsyncedStores.length > 0) {
      console.log(`[auto-sync] Found ${unsyncedStores.length} unsynced stores`);

      for (const store of unsyncedStores) {
        try {
          // Check if this store has exceeded max retry attempts
          const retryCount = await getFailedRetryCount(supabaseClient, store.id, 'store');
          if (retryCount >= MAX_AUTO_RETRY) {
            console.log(`[auto-sync] Skipping store ${store.store_code} - exceeded ${MAX_AUTO_RETRY} retries`);
            continue;
          }

          const storePayload = {
            Code: store.debtor_code,
            Name: store.store_name,
            ContactPerson: store.contact_person || '',
            Phone: store.phone || '',
            Email: store.email || '',
            Address1: store.address || '',
            IsActive: store.is_active ?? true,
            CurrencyCode: 'PHP',
            ParentAccNo: 'Trade Debtor',
          };

          // Try create first, then update on conflict
          const response = await fetch(`${apiUrl}/autocount/debtors`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify(storePayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            // If "not found" error, try update instead (backend bug workaround)
            if (errorText.toLowerCase().includes('not found') || errorText.toLowerCase().includes('already exists')) {
              const updateResponse = await fetch(`${apiUrl}/autocount/debtors/${store.debtor_code}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${jwtToken}`,
                },
                body: JSON.stringify(storePayload),
              });

              if (!updateResponse.ok) {
                const updateErrorText = await updateResponse.text();
                throw new Error(`Update also failed: ${updateErrorText.substring(0, 200)}`);
              }
            } else {
              throw new Error(errorText.substring(0, 200));
            }
          }

          await supabaseClient.from('stores').update({
            autocount_synced: true,
            last_synced_at: new Date().toISOString(),
            sync_error_message: null,
          }).eq('id', store.id);

          await supabaseClient.from('autocount_sync_log').insert({
            reference_id: store.id,
            reference_type: 'store',
            sync_type: 'auto_create',
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          });

          results.push({ type: 'store', id: store.id, success: true });
          console.log(`[auto-sync] Store ${store.store_code} synced successfully`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);

          await supabaseClient.from('stores').update({ sync_error_message: errorMsg }).eq('id', store.id);
          await supabaseClient.from('autocount_sync_log').insert({
            reference_id: store.id,
            reference_type: 'store',
            sync_type: 'auto_create',
            sync_status: 'failed',
            error_message: errorMsg,
          });

          results.push({ type: 'store', id: store.id, success: false, error: errorMsg });
          console.error(`[auto-sync] Error syncing store ${store.store_code}:`, err);
        }
      }
    } else {
      console.log('[auto-sync] No unsynced stores found');
    }

    // =============================================
    // 3. Sync unsynced Suppliers
    // =============================================
    const { data: unsyncedSuppliers, error: supplierError } = await supabaseClient
      .from('suppliers')
      .select('*')
      .eq('autocount_synced', false)
      .eq('is_active', true)
      .limit(20);

    if (supplierError) {
      console.error('[auto-sync] Error fetching unsynced suppliers:', supplierError);
    } else if (unsyncedSuppliers && unsyncedSuppliers.length > 0) {
      console.log(`[auto-sync] Found ${unsyncedSuppliers.length} unsynced suppliers`);

      for (const supplier of unsyncedSuppliers) {
        try {
          // Check if this supplier has exceeded max retry attempts
          const retryCount = await getFailedRetryCount(supabaseClient, supplier.id, 'supplier');
          if (retryCount >= MAX_AUTO_RETRY) {
            console.log(`[auto-sync] Skipping supplier ${supplier.supplier_code} - exceeded ${MAX_AUTO_RETRY} retries`);
            continue;
          }

          const supplierPayload = {
            code: supplier.supplier_code,
            companyName: supplier.company_name || '',
            contactPerson: supplier.contact_person || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            creditTerms: supplier.credit_terms || 0,
            isActive: supplier.is_active !== false,
          };

          const response = await fetch(`${apiUrl}/autocount/suppliers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify(supplierPayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (errorText.toLowerCase().includes('already exists')) {
              // Already exists in AutoCount, just mark as synced
              console.log(`[auto-sync] Supplier ${supplier.supplier_code} already exists in AutoCount`);
            } else {
              throw new Error(errorText.substring(0, 200));
            }
          }

          await supabaseClient.from('suppliers').update({
            autocount_synced: true,
            last_synced_at: new Date().toISOString(),
          }).eq('id', supplier.id);

          await supabaseClient.from('autocount_sync_log').insert({
            reference_id: supplier.id,
            reference_type: 'supplier',
            sync_type: 'auto_create',
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          });

          results.push({ type: 'supplier', id: supplier.id, success: true });
          console.log(`[auto-sync] Supplier ${supplier.supplier_code} synced successfully`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);

          await supabaseClient.from('autocount_sync_log').insert({
            reference_id: supplier.id,
            reference_type: 'supplier',
            sync_type: 'auto_create',
            sync_status: 'failed',
            error_message: errorMsg,
          });

          results.push({ type: 'supplier', id: supplier.id, success: false, error: errorMsg });
          console.error(`[auto-sync] Error syncing supplier ${supplier.supplier_code}:`, err);
        }
      }
    } else {
      console.log('[auto-sync] No unsynced suppliers found');
    }

    const elapsed = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[auto-sync] Batch complete in ${elapsed}ms. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        elapsed_ms: elapsed,
        total: results.length,
        synced: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-sync] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
