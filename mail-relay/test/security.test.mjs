import assert from 'node:assert/strict';
import test from 'node:test';
import { createSignature, verifySignedRequest } from '../src/security.mjs';

const secret = '0123456789abcdef0123456789abcdef';
const now = 1_700_000_000_000;
const timestamp = String(now / 1000);
const nonce = 'nonce-1';
const rawBody = JSON.stringify({ subject: 'hello' });

test('accepts a valid signature exactly once', () => {
  const usedNonces = new Map();
  const signature = createSignature(secret, timestamp, nonce, rawBody);
  const input = {
    secret,
    timestamp,
    nonce,
    signature,
    rawBody,
    windowSeconds: 300,
    usedNonces,
    now,
  };

  assert.equal(verifySignedRequest(input), true);
  assert.equal(verifySignedRequest(input), false);
});

test('rejects tampered and expired requests', () => {
  const signature = createSignature(secret, timestamp, nonce, rawBody);
  const base = {
    secret,
    timestamp,
    nonce,
    signature,
    rawBody,
    windowSeconds: 300,
    usedNonces: new Map(),
    now,
  };

  assert.equal(verifySignedRequest({ ...base, rawBody: '{}' }), false);
  assert.equal(verifySignedRequest({ ...base, now: now + 301_000 }), false);
});
