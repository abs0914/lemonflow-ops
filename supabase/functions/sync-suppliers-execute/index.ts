import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoCountSupplier {
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
    console.log('[sync-suppliers-execute] Starting sync execution');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate using /api/auth/login with email
    console.log('[sync-suppliers-execute] Authenticating');
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Get AutoCount suppliers
    console.log('[sync-suppliers-execute] Fetching AutoCount suppliers');
    const acResponse = await fetch(`${apiUrl}/autocount/suppliers`, {
      method: 'GET',
      headers: {
        // Backend returns PascalCase: AccessToken
        'Authorization': `Bearer ${authData.AccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!acResponse.ok) {
      throw new Error(`Failed to fetch AutoCount suppliers: ${acResponse.status}`);
    }

    const autoCountSuppliers: AutoCountSupplier[] = await acResponse.json();
    console.log(`[sync-suppliers-execute] Found ${autoCountSuppliers.length} AutoCount suppliers`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    // Process each supplier
    for (const acSupplier of autoCountSuppliers) {
      try {
        // Check if supplier exists
        const { data: existing } = await supabaseClient
          .from('suppliers')
          .select('id')
          .eq('supplier_code', acSupplier.code)
          .single();

        const supplierData = {
          supplier_code: acSupplier.code,
          company_name: acSupplier.companyName,
          contact_person: acSupplier.contactPerson || null,
          phone: acSupplier.phone || null,
          email: acSupplier.email || null,
          address: acSupplier.address || null,
          credit_terms: acSupplier.creditTerms || null,
          is_active: acSupplier.isActive,
          autocount_synced: true,
          last_synced_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing supplier
          const { error } = await supabaseClient
            .from('suppliers')
            .update(supplierData)
            .eq('id', existing.id);

          if (error) {
            console.error(`[sync-suppliers-execute] Update error for ${acSupplier.code}:`, error);
            results.errors.push(`Failed to update ${acSupplier.code}: ${error.message}`);
          } else {
            results.updated++;
            console.log(`[sync-suppliers-execute] Updated supplier: ${acSupplier.code}`);
          }
        } else {
          // Create new supplier
          const { error } = await supabaseClient
            .from('suppliers')
            .insert(supplierData);

          if (error) {
            console.error(`[sync-suppliers-execute] Insert error for ${acSupplier.code}:`, error);
            results.errors.push(`Failed to create ${acSupplier.code}: ${error.message}`);
          } else {
            results.created++;
            console.log(`[sync-suppliers-execute] Created supplier: ${acSupplier.code}`);
          }
        }

        // Log sync activity
        await supabaseClient
          .from('autocount_sync_log')
          .insert({
            reference_type: 'supplier',
            reference_id: acSupplier.code,
            sync_type: 'pull',
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          });

      } catch (error) {
        console.error(`[sync-suppliers-execute] Error processing ${acSupplier.code}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Error processing ${acSupplier.code}: ${errorMessage}`);
      }
    }

    console.log('[sync-suppliers-execute] Sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-suppliers-execute] Error:', error);
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
