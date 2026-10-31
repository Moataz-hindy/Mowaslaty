# Security fixes: production activation and configuration

The website security fixes were activated on **31 October 2026**, following the
owner's explicit approval. Production: https://mowaslaty.pages.dev/ . Deployment:
https://6c1d2152.mowaslaty.pages.dev/ . No commit or push was performed.

Android release **1.0.2** was not rebuilt or replaced. Its public manifest and
checksum match the original release. Previously distributed APKs retain their
previous contact details and client code; website deployment cannot erase them.
Do not replace or remove published APKs without the owner's release approval.

## Verified activation (31 October 2026)

- `FEEDBACK_FROM`, `FEEDBACK_TO`, `RESEND_API_KEY`, `SERVICE_RATE_SECRET`, and
  `GEOAPIFY_KEY` are encrypted Pages secrets. Secret values are not recorded here.
- Migration 0003 was applied through the D1 console to the existing
  `mowaslaty-community` database. Table and expiry index definitions were verified;
  migrations 0001/0002 were not reapplied.
- The deployed frontend entry bundle matches the locally tested build. The live
  privacy page does not contain the owner's personal mailbox address.
- `/api/feedback` returns only `{"available":true}` with `Cache-Control: no-store`.
  One labelled test was accepted by the sending service, and the form displayed
  its success message. Actual inbox placement was not independently inspected.
- A live walking request returned HTTP 200, one 235-metre route and 18 geometry
  coordinates. A lookalike Google hostname was rejected with HTTP 400.
- Community authentication and publishing capability flags remained enabled.
- The final local suite passed 69 tests, and the Functions bundle compiled.

Initial live checks exposed an unsupported `redirect:"error"` mode in the server
requests. It was replaced with `redirect:"manual"`; non-2xx provider responses
are rejected without following redirects or forwarding private credentials.
The corrected bundle was deployed and both provider paths passed their live
checks. See the [Cloudflare Request API](https://developers.cloudflare.com/workers/runtime-apis/request/).

## Server-only configuration

Keep all these values in Cloudflare Pages secrets (and ignored `.dev.vars` for
local Functions testing), never in `VITE_*`, source code, HTML or a public API:

- `SERVICE_RATE_SECRET`: a securely generated random value of at least 32 characters.
- `RESEND_API_KEY`: sending-service API key.
- `FEEDBACK_TO`: the owner's destination mailbox.
- `FEEDBACK_FROM`: a sender address authorized by the Resend account.
- Existing `GEOAPIFY_KEY` or `ORS_API_KEY`: walking provider credential.

The existing D1 binding `COMMUNITY_DB` is reused. Before deploying these Functions,
apply only `migrations/community/0003_service_budgets.sql` to the bound database
after review; do not reapply migrations 0001/0002. Production already has 0003.
Missing binding, migration, trusted client IP or rate secret causes outbound
services to fail closed. Cached walking responses can still be served.

Feedback uses the [Resend send-email endpoint](https://resend.com/docs/api-reference/emails/send-email).
Set up its authorized sender and configure the secrets before expecting delivery.
Neither the recipient nor provider response is returned to clients. Feedback is
sent as plain text; optional GPX/KML/GeoJSON attachments are limited to 400,000
UTF-8 bytes. No feedback body or attachment is stored in D1. Email/provider
retention still applies. Automated tests stub email delivery; the deliberate
production activation test described above used the real sending service.

## Quotas

Atomic D1 budgets apply to cache misses/outbound calls across all runtime
instances, with separate counters for each service:

| Service | Per connection IP per UTC hour | Global per UTC day |
| --- | ---: | ---: |
| Walking | 60 | 1,000 |
| Maps link expansion | 30 | 1,000 |
| Feedback (including invalid submissions) | 5 | 100 |

Only Cloudflare's trusted `CF-Connecting-IP` is used, never `X-Forwarded-For`.
Only hourly rotating HMAC hashes are retained, not raw IPs. Client counters
expire after two hours and expired rows are pruned on subsequent requests.
Global counters contain no client identity. Requests exceeding a quota return
429 with `Retry-After`. Database/configuration failures return 503, not unlimited
access. Provider errors are generic and do not echo exceptions or API URLs.

Set provider spending/quota caps and Cloudflare WAF limits as additional layers
before production activation; those account settings have not been changed.
Fixed-window limits can allow bursts around boundaries, and shared networks may
share a client budget. They protect quota, not guarantee availability under DoS.

The link expander accepts exact configured Google domains only, revalidates HTTPS,
credentials and ports on every redirect, caps response bodies and enforces a
deadline. Unsupported regional Google domains are deliberately rejected until
explicitly reviewed and added.

## Verification

Run `node --test src/utils/*.test.js src/community/*.test.js scripts/*.test.mjs`,
`npm run build`, `npm run native:build`, and `npm run community:functions:build`.
The native build is a local web-assets check; it does not publish an APK.

Before a future authorized deployment: configure secrets, apply migration 0003,
verify delivery with a deliberate private test, and confirm production quotas.
Public historical APKs need a separate release decision: editing source cannot
erase contact information from copies already distributed.
