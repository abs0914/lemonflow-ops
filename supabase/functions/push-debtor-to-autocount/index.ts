import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushDebtorRequest {
  storeIds?: string[];  // Optional: specific stores to push. If empty, push all unsynced.
  forceUpdate?: boolean;   // If true, update even if already synced
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }
  try {
    // --- Auth + role check ---
    const __authHeader = req.headers.get('Authorization');
    if (!__authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const __token = __authHeader.replace('Bearer ', '');
    const __authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const { data: { user: __user }, error: __userErr } = await __authClient.auth.getUser(__token);
    if (__userErr || !__user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const __admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: __profile } = await __admin.from('user_profiles').select('role').eq('id', __user.id).single();
    if (!__profile || !['Admin','Warehouse'].includes(__profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- end auth ---
  } catch (__e) { return new Response(JSON.stringify({error:String(__e)}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
);
  }

  try {
    console.log('[push-debtor-to-autocount] Starting');

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
    let requestBody: PushDebtorRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use defaults
    }

    // Authenticate with AutoCount API using /api/auth/login with email
    console.log('[push-debtor-to-autocount] Authenticating');
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Fetch stores to push
    let query = supabaseClient.from('stores').select('*');

    if (requestBody.storeIds && requestBody.storeIds.length > 0) {
      query = query.in('id', requestBody.storeIds);
    } else if (!requestBody.forceUpdate) {
      // Only fetch stores that haven't been synced yet
      query = query.eq('autocount_synced', false);
    }

    const { data: stores, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch stores: ${fetchError.message}`);
    }

    console.log(`[push-debtor-to-autocount] Found ${stores?.length || 0} stores to push`);

    const results = {
      success: [] as string[],
      failed: [] as { code: string; error: string }[],
      skipped: [] as string[],
    };

    // Get existing AutoCount debtors to check for duplicates
    const acDebtorsResponse = await fetch(`${apiUrl}/autocount/debtors`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.AccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    let existingDebtors: string[] = [];
    if (acDebtorsResponse.ok) {
      const acDebtors = await acDebtorsResponse.json();
      existingDebtors = acDebtors.map((d: { code: string }) => d.code);
    }

    for (const store of stores || []) {
      try {
        const debtorExists = existingDebtors.includes(store.debtor_code);

        const debtorPayload = {
          code: store.debtor_code,
          name: store.store_name || '',
          contactPerson: store.contact_person || '',
          phone: store.phone || '',
          email: store.email || '',
          address1: store.address || '',
          creditLimit: store.credit_limit || 0,
          isActive: store.is_active !== false,
        };

        let response: Response;
        if (debtorExists) {
          if (requestBody.forceUpdate) {
            // Update existing debtor
            response = await fetch(`${apiUrl}/autocount/debtors/${encodeURIComponent(store.debtor_code)}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${authData.AccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(debtorPayload),
            });
          } else {
            results.skipped.push(store.debtor_code);

            // Mark as synced since it exists in AutoCount
            await supabaseClient
              .from('stores')
              .update({
                autocount_synced: true,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', store.id);

            continue;
          }
        } else {
          // Create new debtor
          response = await fetch(`${apiUrl}/autocount/debtors`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authData.AccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(debtorPayload),
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          results.failed.push({ code: store.debtor_code, error: errorText });
          continue;
        }

        // Update store with sync status
        await supabaseClient
          .from('stores')
          .update({
            autocount_synced: true,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', store.id);

        // Log sync activity
        await supabaseClient
          .from('autocount_sync_log')
          .insert({
            reference_type: 'debtor',
            reference_id: store.debtor_code,
            sync_type: 'push',
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          });

        results.success.push(store.debtor_code);
        console.log(`[push-debtor-to-autocount] Pushed ${store.debtor_code} successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ code: store.debtor_code, error: errorMessage });
      }
    }

    console.log('[push-debtor-to-autocount] Complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-debtor-to-autocount] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

