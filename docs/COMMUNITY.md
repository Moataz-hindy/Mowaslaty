# Community accounts

The community lives at `/#community`, outside the planner. Supabase Auth handles Google sign-in; Cloudflare Pages Functions and D1 handle community data. No Supabase database is used. Repository code does not create cloud resources or enable production login by itself.

## Drafts, identity and review

Drafts use `mowaslaty_community_drafts_v1` in the current browser. They remain available when login or the API is unavailable. The former prototype's seeded storage key is ignored and left untouched. A draft is sent only when explicitly submitted. New posts and comments require moderation; saving a draft never publishes it.

The display name is an explicitly chosen public alias. Google email/name, provider tokens, auth subject and internal user ID are not public feed fields. Provider profile metadata never grants moderator access. Role and banned status come from D1 on each authenticated request.

## API contract

All responses are JSON with `Cache-Control: no-store`. Missing configuration disables login and writes. Public reads require D1; an absent database returns service unavailable rather than an empty feed. There is no development identity bypass.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/community/capabilities` | Enabled login/publishing and public Supabase configuration. |
| `GET/PATCH /api/community/me` | Own account and chosen public alias. |
| `GET/POST /api/community/posts` | Approved feed / submit update for review. |
| `PATCH/DELETE /api/community/posts/:id` | Edit or hide own post; editing returns it to review. |
| `GET /api/community/mine` | Own submissions and review statuses. |
| `GET/POST /api/community/posts/:id/comments` | Approved comments / submit comment for review. |
| `PATCH/DELETE /api/community/comments/:id` | Edit or hide own comment. |
| `GET/PUT /api/community/posts/:id/vote` | Own vote, value `1`, `-1`, or `0` to remove. |
| `GET/PATCH /api/community/moderation` | Moderator queue and audited decisions. |

Public posts: `id`, `routeId`, `category`, `body`, `createdAt`, `authorDisplayName`, `voteScore`, `commentCount`. Public comments: `id`, `reportId`, `body`, `createdAt`, `authorDisplayName`. Only approved parent posts expose comments or accept comments/votes. Editing an approved post removes it from the feed until reviewed again.

Feed filters: `category=ALL|fare|detour|frequency|tip|route`, `q` up to120 characters, `limit`1–50 (default20), opaque `cursor`. Route IDs are validated against the application's policy-filtered dataset. Original transit data is unchanged.

Authenticated APIs accept `Authorization: Bearer ...`. The server verifies the access token using Supabase `auth.getUser(token)` against the configured Auth server. Browser session data and decoded JWT claims are not authorization evidence. Owner checks, fresh D1 roles/bans, bounded JSON, origin checks, parameterized SQL and D1 rate limits protect writes. Failures do not leak SQL or tokens.

Moderation decisions include the queue item's `expectedRevision`. The decision and audit entry share an atomic database batch and only succeed for that revision. Edits, hiding and review advance the revision; stale review returns409 and requires reloading the content. A moderator cannot approve text changed since it was shown in their queue.

## Production connection — later

These steps are separate from local implementation. Do not use unrelated existing projects, put server secrets in `VITE_` variables, or share credentials in chat.

1. Create a dedicated Supabase project. Enable Google in Auth providers; configure Google OAuth credentials in the Supabase dashboard. In Google use the Supabase callback shown there. Set the production site as the Supabase Site URL and allow exactly `https://YOUR-SITE/auth/callback` as a redirect. For local testing allow the actual local origin plus `/auth/callback`. Avoid wildcard production redirects.
2. Create a Cloudflare D1 database and bind it to the Pages project as exactly `COMMUNITY_DB`. Apply SQL migrations from `migrations/community/` in numerical order, first locally, then to the dedicated remote database after review. No remote migration has been applied by this implementation.
3. Set the Pages runtime values below. A publishable key is intentionally public. Never use a service-role or secret key here. Google client secrets belong only in the provider configuration.
4. Deploy and test OAuth on the deployed origin. Submit a test update and verify it stays pending. A trusted operator must designate a moderator in D1; there is no automatic first-user administrator.
5. Enable publishing after schema and moderation are ready. Verify anonymous/expired sessions, owner isolation, approval/rejection, comments, voting and rate limits on the deployed runtime.

| Runtime value | Meaning |
| --- | --- |
| `SUPABASE_URL` | Dedicated project's HTTPS URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Public key beginning `sb_publishable_`. |
| `COMMUNITY_GOOGLE_ENABLED` | Exact `true` when Google is configured. |
| `COMMUNITY_PUBLISHING_ENABLED` | Exact `true` to enable writes. |
| `COMMUNITY_DB` | D1 binding, not a string environment variable. |

PKCE uses the fixed `/auth/callback` route. The code is exchanged once and removed from browser history. The callback returns to `/#community`; arbitrary return URLs are not accepted. Sessions are managed by the Supabase SDK. Real Google OAuth requires external setup and is not verified by unit tests.

## Development and verification

Plain Vite runs only the frontend, not Pages Functions. Use a local Pages runtime with a local D1 binding for end-to-end API testing. `.dev.vars` is ignored and may contain local configuration. Copy names from `.dev.vars.example`, retaining existing local map/walking secrets.

`0001_initial.sql` defines users, reports, comments and votes. Further migrations add authorization, moderation and rate limits. Do not rewrite applied migrations. Soft deletion hides content; it is not account erasure. Account deletion, abuse response, retention and privacy notice require an explicit production operating policy before launch.

Community integration tests use in-memory SQLite to exercise SQL without an account. Auth transport is isolated in verifier tests. Tests do not log in real people, create external content or apply remote migrations.

Official references: [Google Auth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [server user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/), [D1](https://developers.cloudflare.com/d1/).

## Verified local runtime recipe

For an account-free runtime check, create an ignored `.wrangler/community-local.json` with a D1 entry whose binding is `COMMUNITY_DB` and whose database_name/database_id are both `local-COMMUNITY_DB`. This is a disposable local identifier, not a remote database ID. Run each migration once against a fresh local persistence directory:

```powershell
node node_modules/wrangler/bin/wrangler.js d1 execute COMMUNITY_DB --config .wrangler/community-local.json --local --persist-to .wrangler/community-local --file migrations/community/0001_initial.sql
node node_modules/wrangler/bin/wrangler.js d1 execute COMMUNITY_DB --config .wrangler/community-local.json --local --persist-to .wrangler/community-local --file migrations/community/0002_accounts_moderation.sql
npm run build
node node_modules/wrangler/bin/wrangler.js pages dev dist --d1 COMMUNITY_DB=local-COMMUNITY_DB --port 3003 --ip 127.0.0.1 --compatibility-date 2026-10-23 --persist-to .wrangler/community-local
```

The explicit `binding=database_id` is significant: `--d1 COMMUNITY_DB` alone uses a different local database ID. Do not add `--remote` to these test commands. A fresh migrated database returns an empty approved feed; capability flags remain false without Auth configuration, and public writes return503. Pages supports its standard config filename at the project root, so the custom config above is only used by the D1 CLI, not passed to `pages dev`.

Verification commands:

```sh
npm run community:test
node --test src/community/*.test.js src/utils/communityDrafts.test.js
npm run community:functions:build
npm run build
```

`community:test` and the Functions build check that the route manifest matches the current policy-filtered source. After route policy/data changes, run `npm run community:routes` and review the generated manifest. In a filesystem sandbox, set `WRANGLER_LOG_PATH` to a writable `.wrangler/logs/...log` file if the default user-level log directory is unavailable.
