import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Service account credentials from secrets
const LEMONCO_API_URL = Deno.env.get('LEMONCO_API_URL') || 'https://api.thelemonco.online';
const LEMONCO_USERNAME = Deno.env.get('LEMONCO_USERNAME');
const LEMONCO_PASSWORD = Deno.env.get('LEMONCO_PASSWORD');

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

async function getServiceToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && tokenExpiry > new Date()) {
    return cachedToken;
  }

  console.log('Authenticating with Lemon-co API...');
  
  const response = await fetch(`${LEMONCO_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: LEMONCO_USERNAME,
      password: LEMONCO_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Auth failed:', error);
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.token;
  tokenExpiry = new Date(data.expiresAt);
  
  console.log('Successfully authenticated with Lemon-co API');
  return cachedToken!;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method = 'GET', params } = await req.json();
    
    console.log(`Proxying request: ${method} ${endpoint}`, params);

    // Get service token
    const token = await getServiceToken();

    // Build URL with query params
    let url = `${LEMONCO_API_URL}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url = `${url}?${queryString}`;
    }

    // Make request to Lemon-co API
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`API error ${response.status}:`, error);
      return new Response(
        JSON.stringify({ error: `API request failed: ${response.status}`, details: error }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
