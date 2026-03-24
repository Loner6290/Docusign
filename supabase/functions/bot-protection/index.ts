import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Bot protection data
const BOT_PROTECTION = {
  agents: ["Googlebot", "Telegram", "Bing", "bot", "above", "google", "softlayer", "amazonaws", "cyveillance", "compatible", "facebook", "netpilot", "calyxinstitute", "tor-exit", "apache-httpclient", "crawler", "spider", "TelegramBot", "TwitterBot", "Meta", "Scrapy"],
  ipRanges: ["66.102", "38.100", "107.170", "66.221", "74.125", "149.154", "64.37.103", "12.148.209", "198.54", "91.103.66", "64.106.213"],
  blockedIps: ["149.154.161.231", "34.86.177.154", "149.154.161.201", "172.217.0.0", "209.85.128.0"]
}

interface BotCheckRequest {
  ip: string
  userAgent: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { ip, userAgent }: BotCheckRequest = await req.json()

    if (!ip || !userAgent) {
      return new Response(
        JSON.stringify({ error: 'Missing IP or User Agent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let isBot = false
    let reason = ''

    // Check user agent
    const userAgentLower = userAgent.toLowerCase()
    for (const agent of BOT_PROTECTION.agents) {
      if (userAgentLower.includes(agent.toLowerCase())) {
        isBot = true
        reason = `Blacklisted user agent: ${agent}`
        break
      }
    }

    // Check IP ranges
    if (!isBot) {
      for (const range of BOT_PROTECTION.ipRanges) {
        if (ip.startsWith(range)) {
          isBot = true
          reason = `Blacklisted IP range: ${range}`
          break
        }
      }
    }

    // Check blocked IPs
    if (!isBot && BOT_PROTECTION.blockedIps.includes(ip)) {
      isBot = true
      reason = 'Blacklisted IP'
    }

    // Get country info
    let country = 'Unknown'
    try {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`)
      if (geoResponse.ok) {
        const geoData = await geoResponse.json()
        country = geoData.country_name || 'Unknown'
      }
    } catch (error) {
      console.error('Geo lookup failed:', error)
    }

    return new Response(
      JSON.stringify({
        isBot,
        reason,
        country,
        ip,
        userAgent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Bot protection error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})