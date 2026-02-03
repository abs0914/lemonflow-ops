import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Store {
  id: string;
  store_code: string;
  store_name: string;
  store_type: string | null;
  debtor_code: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean | null;
  autocount_synced: boolean | null;
}

async function authenticateWithAutoCount(apiUrl: string, username: string, password: string): Promise<string> {
  console.log('Authenticating with AutoCount API...');
  
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Authentication failed:', errorText);
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('Authentication successful');
  return data.token;
}

async function checkDebtorExists(apiUrl: string, token: string, debtorCode: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/autocount/debtors/${encodeURIComponent(debtorCode)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error(`Error checking debtor ${debtorCode}:`, error);
    return false;
  }
}

async function createDebtor(apiUrl: string, token: string, store: Store): Promise<{ success: boolean; error?: string }> {
  console.log(`Creating debtor for store: ${store.store_name} (${store.debtor_code})`);
  
  const payload = {
    code: store.debtor_code,
    name: store.store_name,
    contactPerson: store.contact_person || '',
    phone: store.phone || '',
    email: store.email || '',
    address: store.address || '',
    isActive: store.is_active ?? true,
  };

  try {
    const response = await fetch(`${apiUrl}/autocount/debtors`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create debtor ${store.debtor_code}:`, errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    
    // Handle case where debtor already exists
    if (result.alreadyExists) {
      console.log(`Debtor ${store.debtor_code} already exists, updating instead`);
      return await updateDebtor(apiUrl, token, store);
    }

    console.log(`Successfully created debtor: ${store.debtor_code}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error creating debtor ${store.debtor_code}:`, error);
    return { success: false, error: error.message };
  }
}

async function updateDebtor(apiUrl: string, token: string, store: Store): Promise<{ success: boolean; error?: string }> {
  console.log(`Updating debtor for store: ${store.store_name} (${store.debtor_code})`);
  
  const payload = {
    name: store.store_name,
    contactPerson: store.contact_person || '',
    phone: store.phone || '',
    email: store.email || '',
    address: store.address || '',
    isActive: store.is_active ?? true,
  };

  try {
    const response = await fetch(`${apiUrl}/autocount/debtors/${encodeURIComponent(store.debtor_code)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to update debtor ${store.debtor_code}:`, errorText);
      return { success: false, error: errorText };
    }

    console.log(`Successfully updated debtor: ${store.debtor_code}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating debtor ${store.debtor_code}:`, error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      console.error('Missing LemonCo API credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing API credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate with AutoCount
    const token = await authenticateWithAutoCount(apiUrl, username, password);

    // Fetch unsynced stores
    const { data: stores, error: fetchError } = await supabase
      .from('stores')
      .select('*')
      .or('autocount_synced.is.null,autocount_synced.eq.false');

    if (fetchError) {
      console.error('Error fetching stores:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!stores || stores.length === 0) {
      console.log('No unsynced stores found');
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No stores to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${stores.length} unsynced stores`);

    let syncedCount = 0;
    const errors: { store: string; error: string }[] = [];

    for (const store of stores) {
      // Check if debtor exists
      const exists = await checkDebtorExists(apiUrl, token, store.debtor_code);
      
      let result;
      if (exists) {
        result = await updateDebtor(apiUrl, token, store);
      } else {
        result = await createDebtor(apiUrl, token, store);
      }

      if (result.success) {
        // Update store sync status in database
        const { error: updateError } = await supabase
          .from('stores')
          .update({
            autocount_synced: true,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', store.id);

        if (updateError) {
          console.error(`Error updating sync status for store ${store.id}:`, updateError);
          errors.push({ store: store.store_name, error: 'Failed to update sync status' });
        } else {
          syncedCount++;
        }

        // Log to sync log
        await supabase.from('autocount_sync_log').insert({
          reference_id: store.id,
          reference_type: 'store',
          sync_type: exists ? 'update_debtor' : 'create_debtor',
          sync_status: 'success',
          synced_at: new Date().toISOString(),
        });
      } else {
        errors.push({ store: store.store_name, error: result.error || 'Unknown error' });
        
        // Log failure to sync log
        await supabase.from('autocount_sync_log').insert({
          reference_id: store.id,
          reference_type: 'store',
          sync_type: exists ? 'update_debtor' : 'create_debtor',
          sync_status: 'failed',
          error_message: result.error,
        });
      }
    }

    console.log(`Sync complete. Synced: ${syncedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        synced: syncedCount,
        total: stores.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
