
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
        // 1. Create Supabase Client (Admin context for auth check, though we trust the JWT from invoke)
        // Actually we need the Service Role key to create users with confirmed email
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 2. Verify Caller (Authentication)
        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 3. Verify Role (Authorization) - Only Owner/Admin/SuperAdmin can create users
        // We check the user's role in the public.profiles table or metadata
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const allowedRoles = ['owner', 'admin', 'super_admin'];
        if (!profile || !allowedRoles.includes(profile.role)) {
            return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 4. Parse Request Body
        const { email, password, name, role, store_id, permissions } = await req.json()

        if (!email || !password) {
            return new Response(JSON.stringify({ error: 'Email and password are required' }), {
                status: 400,
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
            throw createError
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
            status: 400,
        })
    }
})
