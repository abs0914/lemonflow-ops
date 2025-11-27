import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupplierData {
  code: string;
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditTerms?: number;
  isActive: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplierId } = await req.json();
    console.log('[create-autocount-supplier] Creating supplier in AutoCount:', supplierId);

    if (!supplierId) {
      throw new Error('Supplier ID is required');
    }

    // Get supplier data from Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: supplier, error: fetchError } = await supabaseClient
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (fetchError || !supplier) {
      throw new Error(`Failed to fetch supplier: ${fetchError?.message || 'Supplier not found'}`);
    }

    console.log('[create-autocount-supplier] Supplier data:', supplier);

    // Get AutoCount API credentials
    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate with LemonCo API
    console.log('[create-autocount-supplier] Authenticating with LemonCo API');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[create-autocount-supplier] Auth failed:', errorText);
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('[create-autocount-supplier] Authentication successful');

    // Prepare supplier data for AutoCount
    const supplierPayload: SupplierData = {
      code: supplier.supplier_code,
      companyName: supplier.company_name || '',
      contactPerson: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      creditTerms: supplier.credit_terms || 0,
      isActive: supplier.is_active !== false,
    };

    console.log('[create-autocount-supplier] Creating supplier in AutoCount:', supplierPayload);

    // Create supplier in AutoCount
    const createResponse = await fetch(`${apiUrl}/autocount/suppliers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supplierPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[create-autocount-supplier] AutoCount API Error:', errorText);
      
      // Log sync failure
      await supabaseClient.from('autocount_sync_log').insert({
        reference_id: supplierId,
        reference_type: 'supplier',
        sync_type: 'create',
        sync_status: 'failed',
        error_message: `AutoCount API returned ${createResponse.status}: ${errorText}`,
      });

      throw new Error(`Failed to create supplier in AutoCount: ${createResponse.status} - ${errorText}`);
    }

    const result = await createResponse.json();
    console.log('[create-autocount-supplier] Supplier created successfully:', result);

    // Update supplier as synced
    const { error: updateError } = await supabaseClient
      .from('suppliers')
      .update({
        autocount_synced: true,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', supplierId);

    if (updateError) {
      console.error('[create-autocount-supplier] Failed to update sync status:', updateError);
    }

    // Log successful sync
    await supabaseClient.from('autocount_sync_log').insert({
      reference_id: supplierId,
      reference_type: 'supplier',
      sync_type: 'create',
      sync_status: 'success',
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Supplier created in AutoCount successfully',
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-autocount-supplier] Error:', error);
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
