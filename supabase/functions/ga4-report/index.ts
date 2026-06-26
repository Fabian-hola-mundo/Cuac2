// supabase/functions/ga4-report/index.ts
// Reporta vistas de página desde Google Analytics 4 (Data API) para el
// dashboard de /admin. Usa una service account de Google Cloud — las
// credenciales viven solo como secrets de Supabase, nunca en el frontend.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRACKED_PATHS: Record<string, string> = {
  '/':            'Cuac Design',
  '/cuaquiverso': 'Cuaquiverso',
  '/portafolio':  'Portafolio',
}

const PINNED_PORTFOLIOS: Record<string, string> = {
  '/portafolio/natalia': 'Natalia',
  '/portafolio/nathali': 'Nathali',
}

interface RunReportRow {
  dimensionValues: { value: string }[]
  metricValues: { value: string }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const propertyId = Deno.env.get('GA4_PROPERTY_ID')
  const clientEmail = Deno.env.get('GA4_CLIENT_EMAIL')
  const privateKey  = Deno.env.get('GA4_PRIVATE_KEY')

  if (!propertyId || !clientEmail || !privateKey) {
    return json({ ok: true, configured: false, pages: [], portfolios: [] })
  }

  try {
    const accessToken = await getAccessToken(clientEmail, privateKey)
    const rows = await runReport(propertyId, accessToken)

    const byPath = new Map<string, { current: number; previous: number; title: string }>()
    for (const row of rows) {
      const [pagePath, pageTitle, dateRange] = row.dimensionValues.map(d => d.value)
      const views = Number(row.metricValues[0]?.value ?? 0)
      const entry = byPath.get(pagePath) ?? { current: 0, previous: 0, title: pageTitle }
      if (dateRange === 'date_range_0') entry.current += views
      else entry.previous += views
      if (pageTitle) entry.title = pageTitle
      byPath.set(pagePath, entry)
    }

    const pages = Object.entries(TRACKED_PATHS).map(([path, label]) => {
      const entry = byPath.get(path) ?? { current: 0, previous: 0, title: label }
      return {
        id: path === '/' ? 'cuac' : path.replace('/', ''),
        label,
        path,
        views7d: entry.current,
        delta: pctDelta(entry.current, entry.previous),
      }
    })

    const pinnedPortfolios = Object.entries(PINNED_PORTFOLIOS).map(([path, label]) => {
      const entry = byPath.get(path) ?? { current: 0, previous: 0, title: label }
      return {
        slug: path.replace('/portafolio/', ''),
        title: label,
        views7d: entry.current,
        delta: pctDelta(entry.current, entry.previous),
        pinned: true,
      }
    })

    const dynamicPortfolios = [...byPath.entries()]
      .filter(([path]) => path.startsWith('/portafolio/') && !(path in PINNED_PORTFOLIOS))
      .map(([path, entry]) => ({
        slug: path.replace('/portafolio/', ''),
        title: entry.title || path,
        views7d: entry.current,
        delta: pctDelta(entry.current, entry.previous),
        pinned: false,
      }))
      .sort((a, b) => b.views7d - a.views7d)
      .slice(0, 3)

    const portfolios = [...pinnedPortfolios, ...dynamicPortfolios]

    return json({ ok: true, configured: true, pages, portfolios })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('ga4-report error:', msg)
    return json({ ok: false, configured: true, error: msg, pages: [], portfolios: [] })
  }
})

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

async function runReport(propertyId: string, accessToken: string): Promise<RunReportRow[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }],
        dateRanges: [
          { startDate: '7daysAgo', endDate: 'today' },
          { startDate: '14daysAgo', endDate: '8daysAgo' },
        ],
        limit: '250',
      }),
    },
  )
  if (!res.ok) throw new Error(`GA4 Data API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.rows ?? []
}

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: unknown) => base64url(new TextEncoder().encode(JSON.stringify(obj)))
  const unsigned = `${encode(header)}.${encode(claim)}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n')
  const b64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
