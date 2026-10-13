import { describe, expect, it } from 'vitest';
import { constantTimeEqual, isAuthorizedInitRequest } from '../src/init/init';

function context(secret, authorization) {
	return {
		env: { jwt_secret: secret },
		req: { header: name => name === 'authorization' ? authorization : '' },
	};
}

describe('database initialization authorization', () => {
	it('accepts only an exact URL-safe bearer secret', () => {
		const secret = '0123456789abcdef0123456789abcdef';
		expect(isAuthorizedInitRequest(context(secret, `Bearer ${secret}`))).toBe(true);
		expect(isAuthorizedInitRequest(context(secret, secret))).toBe(false);
		expect(isAuthorizedInitRequest(context(secret, `Bearer ${secret}x`))).toBe(false);
	});

	it('fails closed when the configured secret is missing or too short', () => {
		expect(isAuthorizedInitRequest(context('', 'Bearer 0123456789abcdef0123456789abcdef'))).toBe(false);
		expect(isAuthorizedInitRequest(context('short', 'Bearer short'))).toBe(false);
	});

	it('compares values without accepting unequal lengths', () => {
		expect(constantTimeEqual('same-value', 'same-value')).toBe(true);
		expect(constantTimeEqual('same-value', 'same-value-longer')).toBe(false);
	});
});
