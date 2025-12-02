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
    console.log('Starting pull-po-from-autocount preview...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Get local POs
    const { data: localPOs, error: localError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, autocount_doc_no, status, total_amount');

    if (localError) {
      throw new Error(`Failed to fetch local POs: ${localError.message}`);
    }

    // Get all suppliers for mapping
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, supplier_code');

    if (suppliersError) {
      throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);
    }

    // Compare and build preview
    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const skipped: any[] = [];

    for (const acPO of autoCountPOs) {
      const localPO = localPOs?.find(p => p.autocount_doc_no === acPO.DocNo);
      const supplier = suppliers?.find(s => s.supplier_code === acPO.SupplierCode);

      if (!supplier) {
        skipped.push({
          docNo: acPO.DocNo,
          reason: `Supplier not found: ${acPO.SupplierCode}`,
        });
        continue;
      }

      if (!localPO) {
        toCreate.push({
          docNo: acPO.DocNo,
          supplierCode: acPO.SupplierCode,
          docDate: acPO.DocDate,
          status: acPO.IsCancelled ? 'cancelled' : 'approved',
          lineCount: acPO.Details?.length || 0,
        });
      } else {
        // Check if update needed (status change)
        const newStatus = acPO.IsCancelled ? 'cancelled' : 'approved';
        if (localPO.status !== newStatus) {
          toUpdate.push({
            docNo: acPO.DocNo,
            localPoNumber: localPO.po_number,
            currentStatus: localPO.status,
            newStatus,
          });
        }
      }
    }

    const summary = {
      totalAutoCount: autoCountPOs.length,
      toCreate: toCreate.length,
      toUpdate: toUpdate.length,
      skipped: skipped.length,
    };

    console.log('Preview summary:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        preview: { toCreate, toUpdate, skipped },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pull-po-from-autocount:', error);
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
