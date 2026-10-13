import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: [
			'test/self-hosted-mail-service.spec.js',
			'test/mail-provider.spec.js',
			'test/setting-service.spec.js',
		],
	},
});
