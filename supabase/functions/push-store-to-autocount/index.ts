import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

interface DebtorPayload {
  code: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
}

interface RequestBody {
  storeId?: string;
}

async function authenticateWithAutoCount(apiUrl: string, username: string, password: string): Promise<string> {
  console.log('Authenticating with AutoCount API...');
  
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: username, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Authentication failed:', errorText);
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('Authentication successful');
  return data.AccessToken;
}

async function checkDebtorExists(apiUrl: string, token: string, debtorCode: string): Promise<{ exists: boolean; status: number; error?: string }> {
  console.log(`Checking if debtor exists: ${debtorCode}`);
  try {
    const response = await fetch(`${apiUrl}/autocount/debtors/${encodeURIComponent(debtorCode)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const status = response.status;
    console.log(`Debtor existence check for ${debtorCode}: HTTP ${status}`);

    if (response.ok) {
      return { exists: true, status };
    }

    // Capture response body for diagnostic purposes
    let errorBody = '';
    try {
      errorBody = await response.text();
      console.log(`Debtor ${debtorCode} existence check response body: ${errorBody.substring(0, 500)}`);
    } catch (e) {
      console.log(`Could not read existence check response body for ${debtorCode}`);
    }

    // 404 = not found (expected for new debtors)
    // 500 = backend throws exception for "not found" (known issue)
    if (status === 404 || status === 500) {
      console.log(`Debtor ${debtorCode} does not exist (status ${status})`);
      return { exists: false, status, error: errorBody };
    }

    // Other errors
    return { exists: false, status, error: errorBody };
  } catch (error: any) {
    console.error(`Error checking debtor ${debtorCode}:`, error);
    return { exists: false, status: 0, error: error.message };
  }
}

async function createDebtor(apiUrl: string, token: string, store: Store): Promise<{ success: boolean; error?: string; httpStatus?: number }> {
  console.log(`Creating debtor for store: ${store.store_name} (${store.debtor_code})`);
  
  const payload: DebtorPayload = {
    code: store.debtor_code,
    name: store.store_name,
    companyName: store.store_name,
    contactPerson: store.contact_person || '',
    phone: store.phone || '',
    email: store.email || '',
    address: store.address || '',
    isActive: store.is_active ?? true,
  };

  console.log(`Create debtor payload: ${JSON.stringify(payload)}`);

  try {
    const response = await fetch(`${apiUrl}/autocount/debtors`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const status = response.status;
    const responseText = await response.text();
    console.log(`Create debtor ${store.debtor_code} response: HTTP ${status}, body: ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      console.error(`Failed to create debtor ${store.debtor_code}: HTTP ${status} - ${responseText}`);
      return { success: false, error: responseText, httpStatus: status };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }
    
    // Handle case where debtor already exists
    if (result.alreadyExists) {
      console.log(`Debtor ${store.debtor_code} already exists, updating instead`);
      return await updateDebtor(apiUrl, token, store);
    }

    console.log(`Successfully created debtor: ${store.debtor_code}`);
    return { success: true, httpStatus: status };
  } catch (error: any) {
    console.error(`Error creating debtor ${store.debtor_code}:`, error);
    return { success: false, error: error.message };
  }
}

async function updateDebtor(apiUrl: string, token: string, store: Store): Promise<{ success: boolean; error?: string; httpStatus?: number }> {
  console.log(`Updating debtor for store: ${store.store_name} (${store.debtor_code})`);
  
  const payload: DebtorPayload = {
    code: store.debtor_code,
    name: store.store_name,
    companyName: store.store_name,
    contactPerson: store.contact_person || '',
    phone: store.phone || '',
    email: store.email || '',
    address: store.address || '',
    isActive: store.is_active ?? true,
  };

  console.log(`Update debtor payload: ${JSON.stringify(payload)}`);

  try {
    const response = await fetch(`${apiUrl}/autocount/debtors/${encodeURIComponent(store.debtor_code)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const status = response.status;
    const responseText = await response.text();
    console.log(`Update debtor ${store.debtor_code} response: HTTP ${status}, body: ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      console.error(`Failed to update debtor ${store.debtor_code}: HTTP ${status} - ${responseText}`);
      return { success: false, error: responseText, httpStatus: status };
    }

    console.log(`Successfully updated debtor: ${store.debtor_code}`);
    return { success: true, httpStatus: status };
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

    // Parse request body for optional storeId
    let storeId: string | undefined;
    try {
      const body: RequestBody = await req.json();
      storeId = body.storeId;
      if (storeId) {
        console.log(`Single-store sync requested for storeId: ${storeId}`);
      }
    } catch {
      // No body or invalid JSON - proceed with bulk sync
      console.log('No storeId specified, proceeding with bulk sync');
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate with AutoCount
    const token = await authenticateWithAutoCount(apiUrl, username, password);

    // Fetch stores to sync
    let query = supabase.from('stores').select('*');
    
    if (storeId) {
      // Single store sync
      query = query.eq('id', storeId);
    } else {
      // Bulk sync - only unsynced stores
      query = query.or('autocount_synced.is.null,autocount_synced.eq.false');
    }

    const { data: stores, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching stores:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!stores || stores.length === 0) {
      const message = storeId ? 'Store not found' : 'No stores to sync';
      console.log(message);
      return new Response(
        JSON.stringify({ success: true, synced: 0, message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${stores.length} store(s) to sync`);

    let syncedCount = 0;
    const errors: { store: string; storeCode: string; error: string; operation: string }[] = [];

    for (const store of stores) {
      // Check if debtor exists with enhanced diagnostics
      const existenceCheck = await checkDebtorExists(apiUrl, token, store.debtor_code);
      
      let result;
      let operation: string;
      
      if (existenceCheck.exists) {
        operation = 'update';
        result = await updateDebtor(apiUrl, token, store);
      } else {
        operation = 'create';
        // Log the existence check result for diagnostics
        if (existenceCheck.status === 500) {
          console.log(`Note: Existence check returned 500 for ${store.debtor_code} - backend may throw exception for "not found"`);
        }
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
          errors.push({ 
            store: store.store_name, 
            storeCode: store.store_code,
            error: 'Failed to update sync status in database', 
            operation 
          });
        } else {
          syncedCount++;
        }

        // Log to sync log
        await supabase.from('autocount_sync_log').insert({
          reference_id: store.id,
          reference_type: 'store',
          sync_type: operation === 'update' ? 'update_debtor' : 'create_debtor',
          sync_status: 'success',
          synced_at: new Date().toISOString(),
        });
      } else {
        // Parse error for more useful info
        let parsedError = result.error || 'Unknown error';
        try {
          const errorObj = JSON.parse(result.error || '{}');
          if (errorObj.ExceptionMessage) {
            parsedError = errorObj.ExceptionMessage;
            if (errorObj.InnerException?.ExceptionMessage) {
              parsedError += ` - ${errorObj.InnerException.ExceptionMessage}`;
            }
          }
        } catch {
          // Keep original error string
        }

        errors.push({ 
          store: store.store_name, 
          storeCode: store.store_code,
          error: parsedError, 
          operation 
        });
        
        // Log failure to sync log
        await supabase.from('autocount_sync_log').insert({
          reference_id: store.id,
          reference_type: 'store',
          sync_type: operation === 'update' ? 'update_debtor' : 'create_debtor',
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
