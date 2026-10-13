import { describe, expect, it } from 'vitest';
import settingService from '../src/service/setting-service';

describe('LONGOS relay runtime defaults', () => {
	it('uses the deployment URL when the database value is blank', () => {
		const result = settingService.applyRuntimeMailDefaults({
			env: {longos_relay_url: 'https://shop.example.com/_longos/mail-relay/'},
		}, {relayUrl: '', mailEngine: 'auto'});

		expect(result.relayUrl).toBe('https://shop.example.com/_longos/mail-relay');
	});

	it('does not overwrite an administrator URL', () => {
		const result = settingService.applyRuntimeMailDefaults({
			env: {longos_relay_url: 'https://shop.example.com/_longos/mail-relay'},
		}, {relayUrl: 'https://relay.example.net', mailEngine: 'self_hosted'});

		expect(result.relayUrl).toBe('https://relay.example.net');
	});
});
