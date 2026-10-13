import assert from 'node:assert/strict';
import test from 'node:test';
import { createSignature } from '../src/security.mjs';

process.env.RELAY_SHARED_SECRET = '0123456789abcdef0123456789abcdef';
process.env.LONGOS_RELAY_SHARED_SECRET = 'longos-longos-longos-longos-123456';
process.env.CLOUD_MAIL_RELAY_SHARED_SECRET = 'cloud-mail-cloud-mail-cloud-123456';
process.env.ALLOWED_SENDER_DOMAINS = 'mail.example.com';
process.env.RELAY_NO_LISTEN = 'true';

const { normalizeAddress, normalizeMessage, server } = await import('../src/server.mjs');

test('normalizes safe mailbox syntax and rejects address-list injection', () => {
  assert.equal(normalizeAddress('sales+orders@MAIL.EXAMPLE.COM', 'sender'), 'sales+orders@mail.example.com');
  assert.throws(
    () => normalizeAddress('first@example.com,second@example.com', 'sender'),
    error => error.status === 400,
  );
  assert.throws(
    () => normalizeAddress('sender@-invalid.example', 'sender'),
    error => error.status === 400,
  );
  assert.throws(
    () => normalizeAddress('nul\0byte@mail.example.com', 'sender'),
    error => error.status === 400,
  );
});

test('normalizes all recipient classes and anchors rate limiting to the sender', () => {
  const result = normalizeMessage({
    requestId: 'cloud-mail:42',
    from: { address: 'sales@mail.example.com', name: 'Sales' },
    to: ['to@example.net'],
    cc: ['cc@example.net'],
    bcc: ['bcc@example.net', 'to@example.net'],
    subject: 'Hello',
    text: 'Body',
    senderContext: { source: 'cloud-mail', tenantId: '7', accountId: '9', category: 'compose' },
  });

  assert.deepEqual(result.mail.envelope.to, ['to@example.net', 'cc@example.net', 'bcc@example.net']);
  assert.equal(result.rateKey, 'cloud-mail:sales@mail.example.com');
  assert.equal(result.senderContext.accountId, '9');
});

test('rejects a sender outside the signing allowlist', () => {
  assert.throws(() => normalizeMessage({
    from: { address: 'sales@other.example' },
    to: ['to@example.net'],
    subject: 'Hello',
    text: 'Body',
  }), error => error.status === 403);
});

test('rejects malformed header and body value types as client errors', () => {
  const base = {
    from: { address: 'sales@mail.example.com' },
    to: ['to@example.net'],
    subject: 'Hello',
  };
  assert.throws(
    () => normalizeMessage({ ...base, text: 'Body', headers: null }),
    error => error.status === 400 && error.message === 'Headers must be an object',
  );
  assert.throws(
    () => normalizeMessage({ ...base, text: 42 }),
    error => error.status === 400 && error.message === 'Message text or HTML is required',
  );
});

test('rejects a valid client signature with a mismatched sender context', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const body = JSON.stringify({
      requestId: 'mismatch:1',
      from: { address: 'sales@mail.example.com' },
      to: ['to@example.net'],
      subject: 'Hello',
      text: 'Body',
      senderContext: { source: 'longos', tenantId: '42' },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = 'client-mismatch-nonce';
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-relay-client': 'cloud-mail',
        'x-relay-timestamp': timestamp,
        'x-relay-nonce': nonce,
        'x-relay-signature': createSignature(process.env.CLOUD_MAIL_RELAY_SHARED_SECRET, timestamp, nonce, body),
      },
      body,
    });
    assert.equal(response.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
