import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LemonCoAuthResponse {
  token: string;
}

interface AutoCountDebtor {
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isActive: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'Admin') {
      throw new Error('Only admins can pull from AutoCount');
    }

    // Get AutoCount API credentials
    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('AutoCount API credentials not configured');
    }

    // Step 1: Authenticate with LemonCo API
    console.log('Authenticating with LemonCo API...');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('Authentication failed:', errorText);
      throw new Error(`Authentication failed: ${authResponse.status} ${errorText}`);
    }

    const authData: LemonCoAuthResponse = await authResponse.json();
    console.log('Authentication successful');

    // Step 2: Fetch all debtors from AutoCount
    console.log('Fetching debtors from AutoCount API...');
    const response = await fetch(`${apiUrl}/autocount/debtors`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AutoCount API error:', errorText);
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const allDebtors: AutoCountDebtor[] = await response.json();
    console.log(`Fetched ${allDebtors.length} total debtors from AutoCount`);

    // Step 3: Filter for stores (STR-TLC- or FRC-TLC- prefix)
    const stores = allDebtors.filter(d => 
      d.code.startsWith('STR-TLC-') || d.code.startsWith('FRC-TLC-')
    );
    console.log(`Filtered to ${stores.length} stores (STR-TLC-* or FRC-TLC-*)`);

    // Step 3: Upsert stores to Supabase
    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: { storeCode: string; error: string }[] = [];

    for (const store of stores) {
      try {
        // Determine store type from code prefix
        let storeType = 'own_store';
        if (store.code.startsWith('FRC-TLC-')) {
          storeType = 'franchisee';
        }

        // Combine address fields
        const addressParts = [store.address1, store.address2, store.address3, store.address4]
          .filter(Boolean);
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

        const storeData = {
          store_code: store.code,
          debtor_code: store.code,
          store_name: store.name,
          store_type: storeType,
          contact_person: store.contactPerson || null,
          email: store.email || null,
          phone: store.phone || null,
          address: fullAddress,
          is_active: store.isActive,
          autocount_synced: true,
          last_synced_at: new Date().toISOString(),
        };

        // Check if store exists
        const { data: existing } = await supabase
          .from('stores')
          .select('id')
          .eq('store_code', store.code)
          .single();

        if (existing) {
          // Update existing store
          const { error: updateError } = await supabase
            .from('stores')
            .update(storeData)
            .eq('id', existing.id);

          if (updateError) throw updateError;
          updated++;
        } else {
          // Insert new store
          const { error: insertError } = await supabase
            .from('stores')
            .insert(storeData);

          if (insertError) throw insertError;
          created++;
        }

        synced++;
      } catch (storeError: any) {
        console.error(`Failed to upsert store ${store.code}:`, storeError);
        errors.push({
          storeCode: store.code,
          error: storeError.message || 'Unknown error',
        });
      }
    }

    console.log(`Sync complete: ${synced} synced (${created} created, ${updated} updated), ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        total: stores.length,
        synced,
        created,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pull-stores-from-autocount:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
