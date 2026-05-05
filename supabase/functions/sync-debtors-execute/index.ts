import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoCountDebtor {
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  creditLimit?: number;
  isActive: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
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
  
  try {
    console.log('[sync-debtors-execute] Starting sync execution');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate using /api/auth/login with email
    console.log('[sync-debtors-execute] Authenticating');
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Get AutoCount debtors
    console.log('[sync-debtors-execute] Fetching AutoCount debtors');
    const acResponse = await fetch(`${apiUrl}/autocount/debtors`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.AccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!acResponse.ok) {
      throw new Error(`Failed to fetch AutoCount debtors: ${acResponse.status}`);
    }

    const autoCountDebtors: AutoCountDebtor[] = await acResponse.json();
    console.log(`[sync-debtors-execute] Found ${autoCountDebtors.length} AutoCount debtors`);

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

    // Process each debtor
    for (const acDebtor of autoCountDebtors) {
      try {
        // Check if store with this debtor_code exists
        const { data: existing } = await supabaseClient
          .from('stores')
          .select('id')
          .eq('debtor_code', acDebtor.code)
          .single();

        // Combine address fields
        const addressParts = [acDebtor.address1, acDebtor.address2, acDebtor.city, acDebtor.state, acDebtor.postalCode, acDebtor.country].filter(Boolean);
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

        // Determine store type based on debtor code pattern
        const storeType = acDebtor.code.startsWith('FRC-') ? 'franchisee' : 'own_store';
        // Generate store_code from debtor_code if not exists
        const storeCode = acDebtor.code;

        const storeData = {
          debtor_code: acDebtor.code,
          store_code: storeCode,
          store_name: acDebtor.name || acDebtor.code,
          store_type: storeType,
          contact_person: acDebtor.contactPerson || null,
          phone: acDebtor.phone || null,
          email: acDebtor.email || null,
          address: fullAddress,
          credit_limit: acDebtor.creditLimit || 0,
          is_active: acDebtor.isActive,
          autocount_synced: true,
          last_synced_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing store (don't overwrite store_code and store_name if already set)
          const { error } = await supabaseClient
            .from('stores')
            .update({
              contact_person: storeData.contact_person,
              phone: storeData.phone,
              email: storeData.email,
              address: storeData.address,
              credit_limit: storeData.credit_limit,
              is_active: storeData.is_active,
              autocount_synced: true,
              last_synced_at: storeData.last_synced_at,
            })
            .eq('id', existing.id);

          if (error) {
            console.error(`[sync-debtors-execute] Update error for ${acDebtor.code}:`, error);
            results.errors.push(`Failed to update ${acDebtor.code}: ${error.message}`);
          } else {
            results.updated++;
            console.log(`[sync-debtors-execute] Updated store: ${acDebtor.code}`);
          }
        } else {
          // Create new store
          const { error } = await supabaseClient
            .from('stores')
            .insert(storeData);

          if (error) {
            console.error(`[sync-debtors-execute] Insert error for ${acDebtor.code}:`, error);
            results.errors.push(`Failed to create ${acDebtor.code}: ${error.message}`);
          } else {
            results.created++;
            console.log(`[sync-debtors-execute] Created store: ${acDebtor.code}`);
          }
        }
        // Log sync activity
        await supabaseClient
          .from('autocount_sync_log')
          .insert({
            reference_type: 'debtor',
            reference_id: acDebtor.code,
            sync_type: 'pull',
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          });

      } catch (error) {
        console.error(`[sync-debtors-execute] Error processing ${acDebtor.code}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Error processing ${acDebtor.code}: ${errorMessage}`);
      }
    }

    console.log('[sync-debtors-execute] Sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-debtors-execute] Error:', error);
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

