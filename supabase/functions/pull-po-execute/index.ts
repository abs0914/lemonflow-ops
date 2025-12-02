import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoCountPO {
  DocNo: string;
  SupplierCode: string;
  DocDate: string;
  DeliveryDate: string | null;
  Description: string;
  IsCancelled: boolean;
  Details: Array<{
    LineNumber: number;
    ItemCode: string;
    Description: string;
    Quantity: number;
    UnitPrice: number;
    UOM: string;
    LineRemarks: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting pull-po-execute...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    }

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Get LemonCo API credentials
    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API configuration');
    }

    // Authenticate with LemonCo API
    console.log('Authenticating with LemonCo API...');
    const loginResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Authentication failed: ${loginResponse.statusText}`);
    }

    const { token } = await loginResponse.json();

    // Fetch POs from AutoCount
    console.log('Fetching POs from AutoCount...');
    const posResponse = await fetch(`${apiUrl}/autocount/purchase-orders`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!posResponse.ok) {
      throw new Error(`Failed to fetch POs: ${posResponse.statusText}`);
    }

    const autoCountPOs: AutoCountPO[] = await posResponse.json();
    console.log(`Fetched ${autoCountPOs.length} POs from AutoCount`);

    // Get local data for mapping
    const { data: localPOs } = await supabase
      .from('purchase_orders')
      .select('id, po_number, autocount_doc_no, status');

    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, supplier_code');

    const { data: components } = await supabase
      .from('components')
      .select('id, sku, autocount_item_code');

    // Process each PO
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const acPO of autoCountPOs) {
      try {
        const supplier = suppliers?.find(s => s.supplier_code === acPO.SupplierCode);
        
        if (!supplier) {
          console.log(`Skipping PO ${acPO.DocNo}: Supplier ${acPO.SupplierCode} not found`);
          skipped++;
          errors.push(`PO ${acPO.DocNo}: Supplier not found`);
          continue;
        }

        const localPO = localPOs?.find(p => p.autocount_doc_no === acPO.DocNo);
        const status = acPO.IsCancelled ? 'cancelled' : 'approved';

        // Calculate total amount
        const totalAmount = acPO.Details?.reduce((sum, line) => 
          sum + (line.Quantity * line.UnitPrice), 0
        ) || 0;

        if (!localPO) {
          // Create new PO
          console.log(`Creating new PO: ${acPO.DocNo}`);
          
          const { data: newPO, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
              po_number: acPO.DocNo,
              supplier_id: supplier.id,
              doc_date: acPO.DocDate,
              delivery_date: acPO.DeliveryDate,
              status,
              total_amount: totalAmount,
              remarks: acPO.Description,
              created_by: userId,
              autocount_doc_no: acPO.DocNo,
              autocount_synced: true,
            })
            .select('id')
            .single();

          if (poError) {
            console.error(`Error creating PO ${acPO.DocNo}:`, poError);
            errors.push(`PO ${acPO.DocNo}: ${poError.message}`);
            skipped++;
            continue;
          }

          // Create line items
          if (acPO.Details && acPO.Details.length > 0) {
            const lines = [];
            
            for (const line of acPO.Details) {
              const component = components?.find(c => 
                c.autocount_item_code === line.ItemCode || c.sku === line.ItemCode
              );

              if (!component) {
                console.log(`Skipping line ${line.LineNumber}: Component ${line.ItemCode} not found`);
                continue;
              }

              lines.push({
                purchase_order_id: newPO.id,
                component_id: component.id,
                line_number: line.LineNumber,
                quantity: line.Quantity,
                unit_price: line.UnitPrice,
                uom: line.UOM,
                line_remarks: line.LineRemarks,
              });
            }

            if (lines.length > 0) {
              const { error: linesError } = await supabase
                .from('purchase_order_lines')
                .insert(lines);

              if (linesError) {
                console.error(`Error creating lines for PO ${acPO.DocNo}:`, linesError);
                errors.push(`PO ${acPO.DocNo} lines: ${linesError.message}`);
              }
            }
          }

          // Log sync
          await supabase.from('autocount_sync_log').insert({
            reference_id: newPO.id,
            reference_type: 'purchase_order',
            sync_type: 'pull_from_autocount',
            sync_status: 'success',
            autocount_doc_no: acPO.DocNo,
            synced_at: new Date().toISOString(),
          });

          created++;
        } else {
          // Update existing PO if status changed
          if (localPO.status !== status) {
            console.log(`Updating PO ${acPO.DocNo}: ${localPO.status} -> ${status}`);
            
            const { error: updateError } = await supabase
              .from('purchase_orders')
              .update({
                status,
                autocount_synced: true,
              })
              .eq('id', localPO.id);

            if (updateError) {
              console.error(`Error updating PO ${acPO.DocNo}:`, updateError);
              errors.push(`PO ${acPO.DocNo}: ${updateError.message}`);
              skipped++;
            } else {
              updated++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing PO ${acPO.DocNo}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`PO ${acPO.DocNo}: ${errorMessage}`);
        skipped++;
      }
    }

    const results = {
      created,
      updated,
      skipped,
      total: autoCountPOs.length,
    };

    console.log('Pull execution results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pull-po-execute:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
