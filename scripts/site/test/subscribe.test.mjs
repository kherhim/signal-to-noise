import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSubscribe } from '../../../worker/subscribe.mjs';

const ENV = {
  BEEHIIV_API_KEY: 'test-key',
  BEEHIIV_PUBLICATION_ID: 'pub_00000000-0000-0000-0000-000000000000',
};

function post(fields, { accept = 'application/json', headers = {}, referer, origin, json = false } = {}) {
  const h = { accept, ...headers };
  if (referer) h.referer = referer;
  if (origin) h.origin = origin;
  let body;
  if (json) {
    h['content-type'] = 'application/json';
    body = JSON.stringify(fields);
  } else {
    h['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(fields);
  }
  return new Request('https://signal-to-noise.co/api/subscribe', { method: 'POST', headers: h, body });
}

function beehiiv(status, payload) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

test('rejects a missing or invalid email without calling Beehiiv', async () => {
  const { calls, fetchImpl } = beehiiv(200, {});
  for (const email of ['', 'not-an-email', 'a@b', 'a b@c.com']) {
    const res = await handleSubscribe(post({ email, location: 'homepage' }), ENV, fetchImpl);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.message, /valid email/i);
  }
  assert.equal(calls.length, 0);
});

test('rejects an unknown signup location', async () => {
  const { calls, fetchImpl } = beehiiv(200, {});
  const res = await handleSubscribe(post({ email: 'a@b.co', location: 'footer' }), ENV, fetchImpl);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('honeypot returns success and does not call Beehiiv', async () => {
  const { calls, fetchImpl } = beehiiv(200, {});
  const res = await handleSubscribe(
    post({ email: 'a@b.co', location: 'post-footer', company_website: 'https://spam.test' }),
    ENV,
    fetchImpl,
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.code, 'subscribed');
  assert.equal(calls.length, 0);
});

test('missing secrets fail with a clear message and do not call Beehiiv', async () => {
  const { calls, fetchImpl } = beehiiv(200, {});
  for (const env of [{}, { BEEHIIV_API_KEY: 'k' }, { BEEHIIV_API_KEY: 'k', BEEHIIV_PUBLICATION_ID: 'not-a-pub' }, { BEEHIIV_API_KEY: '  ', BEEHIIV_PUBLICATION_ID: ENV.BEEHIIV_PUBLICATION_ID }]) {
    const res = await handleSubscribe(post({ email: 'a@b.co', location: 'subscribe-page' }), env, fetchImpl);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'unconfigured');
    assert.match(body.message, /isn't configured yet/);
    assert.equal(JSON.stringify(body).includes('pub_'), false);
  }
  assert.equal(calls.length, 0);
});

test('creates a subscription with utm params and signup location', async () => {
  const { calls, fetchImpl } = beehiiv(200, { data: { status: 'active' } });
  const res = await handleSubscribe(
    post(
      {
        email: ' Reader@Example.com ',
        location: 'post-footer',
        utm_source: 'linkedin',
        utm_medium: 'newsletter',
        utm_campaign: 'the-verification-premium',
      },
      { referer: 'https://signal-to-noise.co/insights/the-verification-premium?utm_source=ignored&utm_term=boards' },
    ),
    ENV,
    fetchImpl,
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.code, 'subscribed');
  assert.match(body.message, /No emails for now/);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.beehiiv.com/v2/publications/pub_00000000-0000-0000-0000-000000000000/subscriptions',
  );
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.email, 'reader@example.com');
  assert.equal(sent.send_welcome_email, false);
  assert.equal(sent.reactivate_existing, false);
  assert.equal(sent.utm_source, 'linkedin');
  assert.equal(sent.utm_medium, 'newsletter');
  assert.equal(sent.utm_campaign, 'the-verification-premium');
  assert.equal(sent.utm_term, 'boards');
  assert.deepEqual(sent.custom_fields, [{ name: 'signup_location', value: 'post-footer' }]);
  assert.equal(sent.referring_site, 'signal-to-noise.co/insights/the-verification-premium');
});

test('reads utm params from the referer when the form has none', async () => {
  const { calls, fetchImpl } = beehiiv(200, { data: { status: 'active' } });
  await handleSubscribe(
    post({ email: 'a@b.co', location: 'homepage' }, {
      referer: 'https://signal-to-noise.co/?utm_source=site&utm_medium=hero&utm_content=nov2026',
    }),
    ENV,
    fetchImpl,
  );
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.utm_source, 'site');
  assert.equal(sent.utm_medium, 'hero');
  assert.equal(sent.utm_content, 'nov2026');
  assert.equal(sent.custom_fields[0].value, 'homepage');
});

test('accepts a JSON body', async () => {
  const { calls, fetchImpl } = beehiiv(200, { data: { status: 'active' } });
  const res = await handleSubscribe(
    post({ email: 'a@b.co', location: 'subscribe-page', utm_source: 'direct' }, { json: true }),
    ENV,
    fetchImpl,
  );
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(calls[0].init.body).utm_source, 'direct');
});

test('pending subscriptions ask the reader to confirm', async () => {
  const { fetchImpl } = beehiiv(200, { data: { status: 'pending' } });
  const res = await handleSubscribe(post({ email: 'a@b.co', location: 'subscribe-page' }), ENV, fetchImpl);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.code, 'confirm');
  assert.match(body.message, /confirm/i);
});

test('an existing subscriber gets a friendly message', async () => {
  const { fetchImpl } = beehiiv(400, { errors: [{ message: 'This email is already subscribed', code: 'EMAIL_EXISTS' }] });
  const res = await handleSubscribe(post({ email: 'a@b.co', location: 'homepage' }), ENV, fetchImpl);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.code, 'already');
});

test('a bad Beehiiv key is reported as not configured, without the key', async () => {
  const { fetchImpl } = beehiiv(401, { errors: [{ message: 'unauthorized' }] });
  const res = await handleSubscribe(post({ email: 'a@b.co', location: 'homepage' }), ENV, fetchImpl);
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.code, 'unconfigured');
  assert.equal(JSON.stringify(body).includes('test-key'), false);
});

test('a browser form post returns HTML', async () => {
  const { fetchImpl } = beehiiv(200, { data: { status: 'active' } });
  const res = await handleSubscribe(
    post({ email: 'a@b.co', location: 'subscribe-page' }, {
      accept: 'text/html',
      referer: 'https://signal-to-noise.co/subscribe',
    }),
    ENV,
    fetchImpl,
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /You're on the list/);
  assert.match(html, /href="\/subscribe"/);
  assert.equal(html.includes('<script'), false);
});

test('GET is rejected', async () => {
  const res = await handleSubscribe(new Request('https://signal-to-noise.co/api/subscribe'), ENV, async () => {
    throw new Error('should not fetch');
  });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST');
});

test('a foreign origin is rejected', async () => {
  const { calls, fetchImpl } = beehiiv(200, {});
  const res = await handleSubscribe(
    post({ email: 'a@b.co', location: 'homepage' }, { origin: 'https://evil.example' }),
    ENV,
    fetchImpl,
  );
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test('an oversized body is rejected', async () => {
  const req = post({ email: 'a@b.co', location: 'homepage' });
  const headers = new Headers(req.headers);
  headers.set('content-length', '9000');
  const oversized = new Request(req, { headers, body: await req.text() });
  const res = await handleSubscribe(oversized, ENV, async () => {
    throw new Error('should not fetch');
  });
  assert.equal(res.status, 413);
});

test('a network failure is a friendly error', async () => {
  const res = await handleSubscribe(
    post({ email: 'a@b.co', location: 'post-footer' }),
    ENV,
    async () => { throw new Error('offline'); },
  );
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.match(body.message, /did not respond/);
});
