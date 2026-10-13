export function selectExternalMailProvider({
	mailEngine,
	relayUrl,
	hasRelaySecret,
	useCloudflareEmail,
	hasResendToken,
}) {
	if (mailEngine !== 'auto') {
		return mailEngine;
	}

	if (relayUrl && hasRelaySecret) {
		return 'self_hosted';
	}

	if (useCloudflareEmail) {
		return 'cloudflare';
	}

	return hasResendToken ? 'resend' : '';
}
