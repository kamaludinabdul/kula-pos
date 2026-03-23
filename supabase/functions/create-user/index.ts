
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("Create-user function invoked with method:", req.method);
        const authHeader = req.headers.get('Authorization');
        
        // 1. Create Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        
        console.log("Supabase URL:", supabaseUrl);
        
        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
        )

        // 2. Verify Caller (Authentication)
        if (!authHeader) {
            console.error("Missing Authorization header");
            return new Response(JSON.stringify({ error: 'Unauthorized: Missing session' }), {
                status: 200, // Return 200 to see the message in frontend
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            console.error("Auth getUser failed:", userError);
            return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'No user session'}` }), {
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 3. Verify Role (Authorization) - Only Owner/Admin/SuperAdmin can create users
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError) {
            return new Response(JSON.stringify({ error: `Forbidden: Profile error - ${profileError.message}` }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const allowedRoles = ['owner', 'admin', 'super_admin'];
        if (!profile || !allowedRoles.includes(profile.role)) {
            return new Response(JSON.stringify({ error: `Forbidden: Insufficient permissions (Role: ${profile?.role || 'none'})` }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 4. Parse Request Body
        const { email, password, name, role, store_id, permissions } = await req.json()

        console.log("Edge Function processing user creation for email:", email, "Password length:", password?.length);

        if (!email || !password) {
            return new Response(JSON.stringify({ error: 'Email and password are required' }), {
                status: 200, // Return 200 to allow SDK to read the body easily
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 5. Create User using SERVICE ROLE key (Bypass email confirmation)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // <--- CRITICAL: Auto-confirm email
            user_metadata: {
                name: name,
                role: role,
                store_id: store_id,
                permissions: permissions
            }
        })

        if (createError) {
            return new Response(JSON.stringify({ error: createError.message }), {
                status: 200, // Return 200 so frontend can read data.error
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: newUser.user
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Return 200 for debugging
        })
    }
})
