import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LemonCoAuthResponse {
  token: string;
}

interface AutoCountDebtor {
  Code: string;
  Name: string;
  ContactPerson: string;
  Email: string;
  Phone: string;
  Address: string;
  IsActive: boolean;
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

    // Step 2: Fetch debtors from AutoCount
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

    const debtors: AutoCountDebtor[] = await response.json();
    console.log(`Successfully fetched ${debtors.length} debtors from AutoCount`);
    console.log('Sample debtor data:', debtors[0]); // Log first debtor to see structure

    const mappedDebtors = debtors.map(d => ({
      debtor_code: d.Code,
      company_name: d.Name,
      contact_person: d.ContactPerson || null,
      email: d.Email || null,
      phone: d.Phone || null,
      address: d.Address || null,
      is_active: d.IsActive,
    }));

    console.log('Sample mapped debtor:', mappedDebtors[0]); // Log mapped data

    return new Response(
      JSON.stringify({ 
        success: true, 
        debtors: mappedDebtors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pull-autocount-debtors:', error);
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
