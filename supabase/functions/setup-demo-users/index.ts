import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DemoUser {
  email: string
  password: string
  fullName: string
  role: 'Admin' | 'Production' | 'Warehouse'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const demoUsers: DemoUser[] = [
      {
        email: 'admin@lemonco.com',
        password: 'admin123',
        fullName: 'Admin User',
        role: 'Admin'
      },
      {
        email: 'production@lemonco.com',
        password: 'prod123',
        fullName: 'Production Manager',
        role: 'Production'
      },
      {
        email: 'warehouse@lemonco.com',
        password: 'wh123',
        fullName: 'Warehouse Operator',
        role: 'Warehouse'
      }
    ]

    const results = []

    for (const user of demoUsers) {
      console.log(`Creating user: ${user.email}`)
      
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const userExists = existingUser?.users?.some((u) => u.email === user.email)

      if (userExists) {
        console.log(`User ${user.email} already exists, skipping...`)
        results.push({
          email: user.email,
          status: 'skipped',
          message: 'User already exists'
        })
        continue
      }

      // Create user with metadata
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          role: user.role
        }
      })

      if (error) {
        console.error(`Error creating user ${user.email}:`, error)
        results.push({
          email: user.email,
          status: 'error',
          message: error.message
        })
      } else {
        console.log(`Successfully created user: ${user.email}`)
        results.push({
          email: user.email,
          status: 'success',
          userId: data.user?.id
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Demo users setup completed',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in setup-demo-users function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
