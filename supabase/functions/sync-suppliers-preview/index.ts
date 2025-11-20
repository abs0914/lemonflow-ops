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

interface PreviewChange {
  action: 'create' | 'update' | 'none';
  supplierCode: string;
  companyName: string;
  changes?: Record<string, { old: any; new: any }>;
  localData?: any;
  autoCountData: AutoCountSupplier;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sync-suppliers-preview] Starting preview');

    const apiUrl = Deno.env.get('LEMONCO_API_URL');
    const username = Deno.env.get('LEMONCO_USERNAME');
    const password = Deno.env.get('LEMONCO_PASSWORD');

    if (!apiUrl || !username || !password) {
      throw new Error('Missing LemonCo API credentials');
    }

    // Authenticate
    console.log('[sync-suppliers-preview] Authenticating');
    const authResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();

    // Get AutoCount suppliers
    console.log('[sync-suppliers-preview] Fetching AutoCount suppliers');
    const acResponse = await fetch(`${apiUrl}/autocount/suppliers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!acResponse.ok) {
      throw new Error(`Failed to fetch AutoCount suppliers: ${acResponse.status}`);
    }

    const autoCountSuppliers: AutoCountSupplier[] = await acResponse.json();
    console.log(`[sync-suppliers-preview] Found ${autoCountSuppliers.length} AutoCount suppliers`);

    // Get local suppliers
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: localSuppliers, error } = await supabaseClient
      .from('suppliers')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch local suppliers: ${error.message}`);
    }

    console.log(`[sync-suppliers-preview] Found ${localSuppliers?.length || 0} local suppliers`);

    // Compare and generate preview
    const preview: PreviewChange[] = [];

    for (const acSupplier of autoCountSuppliers) {
      const localSupplier = localSuppliers?.find(
        s => s.supplier_code === acSupplier.code
      );

      if (!localSupplier) {
        // New supplier
        preview.push({
          action: 'create',
          supplierCode: acSupplier.code,
          companyName: acSupplier.companyName,
          autoCountData: acSupplier,
        });
      } else {
        // Check for changes
        const changes: Record<string, { old: any; new: any }> = {};

        if (localSupplier.company_name !== acSupplier.companyName) {
          changes.company_name = { old: localSupplier.company_name, new: acSupplier.companyName };
        }
        if (localSupplier.contact_person !== acSupplier.contactPerson) {
          changes.contact_person = { old: localSupplier.contact_person, new: acSupplier.contactPerson };
        }
        if (localSupplier.phone !== acSupplier.phone) {
          changes.phone = { old: localSupplier.phone, new: acSupplier.phone };
        }
        if (localSupplier.email !== acSupplier.email) {
          changes.email = { old: localSupplier.email, new: acSupplier.email };
        }
        if (localSupplier.address !== acSupplier.address) {
          changes.address = { old: localSupplier.address, new: acSupplier.address };
        }
        if (localSupplier.credit_terms !== acSupplier.creditTerms) {
          changes.credit_terms = { old: localSupplier.credit_terms, new: acSupplier.creditTerms };
        }
        if (localSupplier.is_active !== acSupplier.isActive) {
          changes.is_active = { old: localSupplier.is_active, new: acSupplier.isActive };
        }

        if (Object.keys(changes).length > 0) {
          preview.push({
            action: 'update',
            supplierCode: acSupplier.code,
            companyName: acSupplier.companyName,
            changes,
            localData: localSupplier,
            autoCountData: acSupplier,
          });
        } else {
          preview.push({
            action: 'none',
            supplierCode: acSupplier.code,
            companyName: acSupplier.companyName,
            autoCountData: acSupplier,
          });
        }
      }
    }

    const summary = {
      total: preview.length,
      toCreate: preview.filter(p => p.action === 'create').length,
      toUpdate: preview.filter(p => p.action === 'update').length,
      noChange: preview.filter(p => p.action === 'none').length,
    };

    console.log('[sync-suppliers-preview] Preview generated:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        preview,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-suppliers-preview] Error:', error);
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
