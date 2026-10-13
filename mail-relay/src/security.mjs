import crypto from 'node:crypto';

export function createSignature(secret, timestamp, nonce, rawBody) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest('hex');
}

export function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left || '') || !/^[a-f0-9]{64}$/i.test(right || '')) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function verifySignedRequest({
  secret,
  timestamp,
  nonce,
  signature,
  rawBody,
  windowSeconds,
  usedNonces,
  now = Date.now(),
}) {
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(now / 1000 - timestampNumber) > windowSeconds) {
    return false;
  }
  if (!nonce || typeof nonce !== 'string' || nonce.length > 128 || usedNonces.has(nonce)) {
    return false;
  }

  const expected = createSignature(secret, timestamp, nonce, rawBody);
  if (!safeEqualHex(signature, expected)) {
    return false;
  }

  usedNonces.set(nonce, now);
  return true;
}
