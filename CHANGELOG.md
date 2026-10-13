# Changelog

## v4.0.0 - 2026-10-14

### Added

- Self-hosted Postfix/OpenDKIM mail engine with HMAC-signed HTTPS submission.
- LONGOS integrated relay support without requiring a separately managed relay checkout.
- Mail-engine selection for Auto, Cloudflare Email, Resend, and self-hosted delivery.
- Per-account sender identity propagation and provider/message ID audit fields.
- D1 migration for mail-engine settings and outbound provider metadata.
- Worker, frontend, and relay security tests in GitHub Actions.

### Security and reliability

- Isolated LONGOS and Cloud Mail relay client secrets.
- Replay protection, request idempotency, request/body/attachment/recipient limits, and per-sender/global rate limiting.
- Strict sender-domain and mailbox validation, credential-free relay URLs, and minimum secret length enforcement.
- JWT signing material and relay credentials are installed as Cloudflare Worker Secrets instead of plaintext variables.
- Request timeouts and payload-bound idempotency records for the relay HTTP server.
- Fail-closed database migrations: duplicate columns are skipped, unrelated D1 failures now stop deployment.
- Production deployment is manual and verified; Cloudflare Git Builds must remain disabled to prevent incomplete configurations from overwriting the Worker.
- Updated vulnerable AWS SDK, Cloudflare tooling, Axios, Vue, and related transitive dependencies.

### Upgrade notes

1. Back up the current D1 database and Worker settings.
2. Configure the GitHub Variables and Secrets documented in `doc/LONGOS_SELF_HOSTED_DEPLOYMENT.md`.
3. Disable Cloudflare Git Builds for this Worker.
4. Run `Deploy cloud-mail to Cloudflare Workers` from the `main` branch.
5. Confirm database initialization succeeds before selecting the self-hosted engine.
6. Do not configure `LONGOS_RELAY_URL` until its `/health` endpoint returns HTTP 200.

Upstream Cloud Mail license and attribution are retained. LONGOS-specific integration and modifications are released in this repository.
