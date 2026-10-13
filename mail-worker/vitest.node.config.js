import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/self-hosted-mail-service.spec.js'],
	},
});
