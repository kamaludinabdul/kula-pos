import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        const TO_EMAIL = 'kulapos2026@gmail.com'

        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured')
        }

        const body = await req.json()
        const {
            description,
            userEmail,
            userRole,
            userName,
            storeName,
            storeId,
            pageUrl,
            appVersion,
            browserInfo,
            timestamp,
            // Auto-captured error fields (from ErrorBoundary)
            errorMessage,
            errorStack,
        } = body

        const isAutoError = !!errorMessage
        const subject = isAutoError
            ? `🔴 [KulaPOS] Auto Error: ${errorMessage.slice(0, 60)}`
            : `🐛 [KulaPOS] Bug Report dari ${userName || userEmail || 'User'}`

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ef4444, #f97316); color: white; padding: 20px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header p { margin: 4px 0 0; opacity: 0.8; font-size: 13px; }
        .content { padding: 20px; }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; }
        .description { background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 14px; line-height: 1.5; color: #1e293b; white-space: pre-wrap; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .meta-item { background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .meta-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .meta-value { font-size: 13px; color: #334155; margin-top: 2px; word-break: break-all; }
        .error-block { background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #991b1b; white-space: pre-wrap; overflow-x: auto; }
        .footer { padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isAutoError ? '🔴 Auto Error Report' : '🐛 Bug Report'}</h1>
            <p>${new Date(timestamp || Date.now()).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
        </div>
        <div class="content">
            <div class="section">
                <div class="section-title">Deskripsi</div>
                <div class="description">${description || errorMessage || 'Tidak ada deskripsi'}</div>
            </div>

            ${errorStack ? `
            <div class="section">
                <div class="section-title">Error Stack</div>
                <div class="error-block">${errorStack}</div>
            </div>
            ` : ''}

            <div class="section">
                <div class="section-title">Context</div>
                <div class="meta-grid">
                    <div class="meta-item">
                        <div class="meta-label">User</div>
                        <div class="meta-value">${userEmail || '-'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Role</div>
                        <div class="meta-value">${userRole || '-'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Store</div>
                        <div class="meta-value">${storeName || '-'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Version</div>
                        <div class="meta-value">${appVersion || '-'}</div>
                    </div>
                    <div class="meta-item" style="grid-column: span 2;">
                        <div class="meta-label">Page</div>
                        <div class="meta-value">${pageUrl || '-'}</div>
                    </div>
                    <div class="meta-item" style="grid-column: span 2;">
                        <div class="meta-label">Browser</div>
                        <div class="meta-value">${browserInfo || '-'}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="footer">
            KulaPOS Error Reporting System
        </div>
    </div>
</body>
</html>`

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'KulaPOS Bug Report <onboarding@resend.dev>',
                to: [TO_EMAIL],
                subject: subject,
                html: htmlContent,
            }),
        })

        const result = await res.json()

        if (!res.ok) {
            console.error('Resend API error:', result)
            throw new Error(result.message || 'Failed to send email')
        }

        return new Response(
            JSON.stringify({ success: true, emailId: result.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
