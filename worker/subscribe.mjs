/* Beehiiv signup for signal-to-noise.co.
   The site is static files on the GCE origin. This module is the Worker
   that Cloudflare runs only for /api/subscribe. Secrets are Worker
   bindings (BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID), never in the repo. */

export const LOCATIONS = new Set(['post-footer', 'subscribe-page', 'homepage']);

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

const ALLOWED_HOSTS = new Set(['signal-to-noise.co', 'www.signal-to-noise.co', 'localhost', '127.0.0.1', '[::1]']);

const SUCCESS_ACTIVE = "You're in. One essay a week, on Wednesdays.";
const SUCCESS_CONFIRM = 'Check your inbox to confirm. One essay a week, on Wednesdays.';
const UNCONFIGURED = "Email signup isn't configured yet. You can still subscribe on LinkedIn or via RSS.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

function cleanToken(value) {
  if (value == null) return '';
  const cleaned = String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned || cleaned.length > 200) return '';
  return cleaned;
}

export function readSecrets(env) {
  const apiKey = typeof env?.BEEHIIV_API_KEY === 'string' ? env.BEEHIIV_API_KEY.trim() : '';
  const publicationId = typeof env?.BEEHIIV_PUBLICATION_ID === 'string' ? env.BEEHIIV_PUBLICATION_ID.trim() : '';
  if (!apiKey || !/^pub_[A-Za-z0-9-]+$/.test(publicationId)) return null;
  return { apiKey, publicationId };
}

export function originAllowed(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return ALLOWED_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function wantsHtml(request) {
  const accept = request.headers.get('accept') || '';
  return !accept.includes('application/json');
}

function utmFromPairs(pairs) {
  const out = {};
  for (const key of UTM_KEYS) {
    const value = cleanToken(pairs[key]);
    if (value) out[key] = value;
  }
  return out;
}

export function utmFromUrl(urlString) {
  if (!urlString) return {};
  try {
    return utmFromPairs(Object.fromEntries(new URL(urlString).searchParams));
  } catch {
    return {};
  }
}

export function mergeUtms(fields, referer) {
  return { ...utmFromUrl(referer), ...utmFromPairs(fields) };
}

export function backHref(request) {
  const referer = request.headers.get('referer');
  if (!referer) return '/subscribe';
  try {
    const url = new URL(referer);
    if (!ALLOWED_HOSTS.has(url.hostname)) return '/subscribe';
    if (!/^\/[A-Za-z0-9/_\-.]*$/.test(url.pathname)) return '/subscribe';
    const search = url.search;
    if (search && !/^\?[A-Za-z0-9._~%=&+-]*$/.test(search)) return url.pathname;
    return url.pathname + search;
  } catch {
    return '/subscribe';
  }
}

function referringSite(request) {
  const referer = request.headers.get('referer');
  if (!referer) return 'signal-to-noise.co';
  try {
    const url = new URL(referer);
    if (!ALLOWED_HOSTS.has(url.hostname)) return 'signal-to-noise.co';
    const path = /^\/[A-Za-z0-9/_\-.]*$/.test(url.pathname) ? url.pathname : '/';
    return `signal-to-noise.co${path}`.slice(0, 200);
  } catch {
    return 'signal-to-noise.co';
  }
}

export function buildPayload({ email, location, utm, referring }) {
  const body = {
    email,
    reactivate_existing: false,
    send_welcome_email: true,
    referring_site: referring,
    custom_fields: [{ name: 'signup_location', value: location }],
  };
  for (const key of UTM_KEYS) {
    if (utm[key]) body[key] = utm[key];
  }
  return body;
}

async function readFields(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data;
  }
  const form = await request.formData();
  const out = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlPage(result, back) {
  const title = result.ok ? 'Subscribed' : 'Subscribe';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — signal-to-noise.co</title>
  <style>
    body { margin: 0; background: #0a0a0a; color: #f1f5f9; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
    main { max-width: 36rem; margin: 0 auto; padding: 6rem 1.5rem; }
    p.k { letter-spacing: .14em; text-transform: uppercase; font-size: .8rem; color: #94a3b8; }
    h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 600; font-size: 2rem; line-height: 1.2; margin: 1rem 0; }
    p { color: #94a3b8; line-height: 1.6; }
    a { color: #fff; }
  </style>
</head>
<body>
  <main>
    <p class="k">Subscribe</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(result.message)}</p>
    <p><a href="${escapeHtml(back)}">Back</a></p>
  </main>
</body>
</html>`;
}

function respond(request, result) {
  const headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  if (result.status === 405) headers.allow = 'POST';
  if (!wantsHtml(request)) {
    headers['content-type'] = 'application/json; charset=utf-8';
    return new Response(JSON.stringify({ ok: result.ok, code: result.code, message: result.message }), {
      status: result.status,
      headers,
    });
  }
  headers['content-type'] = 'text/html; charset=utf-8';
  return new Response(htmlPage(result, backHref(request)), { status: result.status, headers });
}

function errorText(body) {
  try {
    return JSON.stringify(body?.errors ?? body ?? '');
  } catch {
    return '';
  }
}

export async function handleSubscribe(request, env, fetchImpl = globalThis.fetch) {
  if (request.method !== 'POST') {
    return respond(request, { ok: false, status: 405, code: 'method', message: 'Use the subscribe form.' });
  }
  if (!originAllowed(request)) {
    return respond(request, { ok: false, status: 403, code: 'origin', message: "Signup from this site isn't accepted." });
  }

  const advertised = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(advertised) && advertised > 8192) {
    return respond(request, { ok: false, status: 413, code: 'invalid', message: 'That submission is too large.' });
  }

  let fields;
  try {
    fields = await readFields(request);
  } catch {
    return respond(request, { ok: false, status: 400, code: 'invalid', message: 'That submission could not be read.' });
  }

  if (String(fields.company_website ?? '').trim()) {
    return respond(request, { ok: true, status: 200, code: 'subscribed', message: SUCCESS_ACTIVE });
  }

  const email = normalizeEmail(fields.email);
  if (!email) {
    return respond(request, { ok: false, status: 400, code: 'invalid', message: 'Enter a valid email address.' });
  }

  const location = String(fields.location || '');
  if (!LOCATIONS.has(location)) {
    return respond(request, { ok: false, status: 400, code: 'invalid', message: 'Reload the page and try the form again.' });
  }

  const secrets = readSecrets(env);
  if (!secrets) {
    console.log(JSON.stringify({ msg: 'subscribe', location, result: 'unconfigured' }));
    return respond(request, { ok: false, status: 503, code: 'unconfigured', message: UNCONFIGURED });
  }

  const utm = mergeUtms(fields, request.headers.get('referer'));
  const payload = buildPayload({
    email,
    location,
    utm,
    referring: referringSite(request),
  });

  let res;
  try {
    res = await fetchImpl(
      `https://api.beehiiv.com/v2/publications/${encodeURIComponent(secrets.publicationId)}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secrets.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    console.log(JSON.stringify({ msg: 'subscribe', location, result: 'network' }));
    return respond(request, {
      ok: false,
      status: 502,
      code: 'unavailable',
      message: 'The newsletter service did not respond. Try again in a moment.',
    });
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  console.log(JSON.stringify({
    msg: 'subscribe',
    location,
    result: res.status,
    beehiiv: body?.data?.status || null,
  }));

  if (res.ok) {
    const status = body?.data?.status;
    if (status === 'invalid') {
      return respond(request, { ok: false, status: 400, code: 'invalid', message: 'That email does not look deliverable.' });
    }
    if (status === 'pending' || status === 'validating' || status === 'needs_attention') {
      return respond(request, { ok: true, status: 200, code: 'confirm', message: SUCCESS_CONFIRM });
    }
    return respond(request, { ok: true, status: 200, code: 'subscribed', message: SUCCESS_ACTIVE });
  }

  if (res.status === 429) {
    return respond(request, {
      ok: false,
      status: 429,
      code: 'unavailable',
      message: 'Too many attempts. Wait a minute and try again.',
    });
  }

  if (res.status === 401 || res.status === 404) {
    return respond(request, { ok: false, status: 503, code: 'unconfigured', message: UNCONFIGURED });
  }

  if ((res.status === 400 || res.status === 409) && /already|exists/i.test(errorText(body))) {
    return respond(request, { ok: true, status: 200, code: 'already', message: 'That address is already on the list.' });
  }

  return respond(request, {
    ok: false,
    status: 502,
    code: 'unavailable',
    message: 'Something went wrong adding that address. Try again in a moment.',
  });
}
