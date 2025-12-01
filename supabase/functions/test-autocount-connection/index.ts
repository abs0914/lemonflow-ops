import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LemonCoAuthResponse {
  accessToken: string;
  expiresAt: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[test-autocount-connection] Starting connection test');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Step 1: Authenticate with LemonCo API using /api/auth/login with email
    console.log('[test-autocount-connection] Authenticating with LemonCo API');
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[test-autocount-connection] Auth failed:', errorText);
      throw new Error(`Authentication failed: ${authResponse.status} ${errorText}`);
    }

    const authData: LemonCoAuthResponse = await authResponse.json();
    console.log('[test-autocount-connection] Authentication successful');

    // Step 2: Test AutoCount connection via LemonCo API
    console.log('[test-autocount-connection] Testing AutoCount connection');
    const testResponse = await fetch(`${apiUrl}/autocount/test-connection`, {
      method: 'GET',
      headers: {
        // Backend returns PascalCase: AccessToken
        'Authorization': `Bearer ${authData.AccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('[test-autocount-connection] Test failed:', errorText);
      throw new Error(`AutoCount test failed: ${testResponse.status} ${errorText}`);
    }

    const testData = await testResponse.json();
    console.log('[test-autocount-connection] Connection test successful:', testData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to AutoCount via LemonCo API',
        details: testData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-autocount-connection] Error:', error);
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
