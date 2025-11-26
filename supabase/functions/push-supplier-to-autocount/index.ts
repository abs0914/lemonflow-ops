import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSupplierRequest {
  supplierIds?: string[];  // Optional: specific suppliers to push. If empty, push all unsynced.
  forceUpdate?: boolean;   // If true, update even if already synced
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[push-supplier-to-autocount] Starting');

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

    // Parse request
    let requestBody: PushSupplierRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use defaults
    }

    // Authenticate with AutoCount API
    console.log('[push-supplier-to-autocount] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Fetch suppliers to push
    let query = supabaseClient.from('suppliers').select('*');
    
    if (requestBody.supplierIds && requestBody.supplierIds.length > 0) {
      query = query.in('id', requestBody.supplierIds);
    } else if (!requestBody.forceUpdate) {
      // Only fetch suppliers that haven't been synced yet
      query = query.eq('autocount_synced', false);
    }

    const { data: suppliers, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch suppliers: ${fetchError.message}`);
    }

    console.log(`[push-supplier-to-autocount] Found ${suppliers?.length || 0} suppliers to push`);

    const results = {
      success: [] as string[],
      failed: [] as { code: string; error: string }[],
      skipped: [] as string[],
    };

    // Get existing AutoCount suppliers to check for duplicates
    const acSuppliersResponse = await fetch(`${apiUrl}/autocount/suppliers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    let existingSuppliers: string[] = [];
    if (acSuppliersResponse.ok) {
      const acSuppliers = await acSuppliersResponse.json();
      existingSuppliers = acSuppliers.map((s: { code: string }) => s.code);
    }

    for (const supplier of suppliers || []) {
      try {
        const supplierExists = existingSuppliers.includes(supplier.supplier_code);

        const supplierPayload = {
          code: supplier.supplier_code,
          companyName: supplier.company_name || '',
          contactPerson: supplier.contact_person || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          address: supplier.address || '',
          creditTerms: supplier.credit_terms || null,
          isActive: supplier.is_active !== false,
        };

        let response: Response;
        if (supplierExists) {
          if (requestBody.forceUpdate) {
            // Update existing supplier
            response = await fetch(`${apiUrl}/autocount/suppliers/${encodeURIComponent(supplier.supplier_code)}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${authData.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(supplierPayload),
            });
          } else {
            results.skipped.push(supplier.supplier_code);

            // Mark as synced since it exists in AutoCount
            await supabaseClient
              .from('suppliers')
              .update({
                autocount_synced: true,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', supplier.id);

            continue;
          }
        } else {
          // Create new supplier
          response = await fetch(`${apiUrl}/autocount/suppliers`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authData.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(supplierPayload),
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          results.failed.push({ code: supplier.supplier_code, error: errorText });
          continue;
        }

        // Update supplier with sync status
        await supabaseClient
          .from('suppliers')
          .update({
            autocount_synced: true,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', supplier.id);

        results.success.push(supplier.supplier_code);
        console.log(`[push-supplier-to-autocount] Pushed ${supplier.supplier_code} successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ code: supplier.supplier_code, error: errorMessage });
      }
    }

    console.log('[push-supplier-to-autocount] Complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-supplier-to-autocount] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

