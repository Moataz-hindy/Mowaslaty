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

## Production connection — status (29 October 2026)

Production is configured on the dedicated Supabase project `wgggdxnzltbfavgerpww` and the Cloudflare D1 database `mowaslaty-community`, bound to Pages as `COMMUNITY_DB`. The repository migrations in `migrations/community/` were applied manually through the D1 Console. Wrangler migration tracking was not used. Do not reapply these SQL migrations to the production database.

Google OAuth with the `openid`, `email` and `profile` scopes is configured and the Google app audience is in production. The public privacy notice is available at `/privacy.html`; the owner-approved manual account/data request contact is `moatazhindy17@gmail.com`. Hiding a post or comment does not erase an account or all related records. Retention and provider backup/log policies are not represented as fixed periods.

The following Pages runtime values are configured. A publishable key is intentionally public. Never put a service-role key or provider secret in `VITE_` variables or publish them. Google client secrets belong only in the provider configuration; do not document or share secret values here.

| Runtime value | Meaning |
| --- | --- |
| `SUPABASE_URL` | Dedicated project's HTTPS URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Public key beginning `sb_publishable_`. |
| `COMMUNITY_GOOGLE_ENABLED` | Exact `true` when Google is configured. |
| `COMMUNITY_PUBLISHING_ENABLED` | Exact `true` to enable writes. |
| `COMMUNITY_DB` | D1 binding, not a string environment variable. |

### Deployed checks (29 October 2026)

Production checks confirmed human Google sign-in, account profile access, and moderator queue access. Anonymous requests to the account and moderation endpoints returned `401`. In private QA, a submission appeared as pending, was rejected through the moderator queue, and immediately appeared as rejected in the author's private submissions view without a reload. The public posts endpoint returned zero posts throughout; no test content was publicly visible. This did not exercise production comments or voting.

The deployed moderation status synchronization is verified for that private post rejection flow. Publishing is enabled in configuration. The other deployed-origin checks below remain pending unless explicitly listed above; in particular, this does not establish production comment/vote behavior or complete security validation. The offline community suite covers API, SQLite and integration behavior but does not replace those production checks.

### Setup and runtime validation recipe

For a new environment, create a dedicated Supabase project. Enable Google in Auth providers and configure Google OAuth credentials in the Supabase dashboard. In Google use the Supabase callback shown there. Set the production site as the Supabase Site URL and allow exactly `https://YOUR-SITE/auth/callback` as a redirect. For local testing allow the actual local origin plus `/auth/callback`. Avoid wildcard production redirects.

For a new D1 database, bind it to the Pages project as exactly `COMMUNITY_DB` and apply SQL migrations from `migrations/community/` in numerical order after review. The production database named above is already migrated; do not repeat those migrations there.

For a new deployment, test OAuth on the deployed origin. Submit a test update and verify it remains pending until moderation. Confirm that the resulting decision appears immediately in the author's private submissions view and that a non-approved post is absent from the public feed. A trusted operator must designate a moderator in D1; there is no automatic first-user administrator. Verify anonymous/expired sessions, owner isolation, comments, voting and rate limits on the deployed runtime. Production checks not recorded above remain pending.

PKCE uses the fixed `/auth/callback` route. The code is exchanged once and removed from browser history. The callback returns to `/#community`; arbitrary return URLs are not accepted. Sessions are managed by the Supabase SDK. Unit tests do not verify the deployed Google OAuth flow.

## Development and verification

Plain Vite runs only the frontend, not Pages Functions. Use a local Pages runtime with a local D1 binding for end-to-end API testing. `.dev.vars` is ignored and may contain local configuration. Copy names from `.dev.vars.example`, retaining existing local map/walking secrets.

`0001_initial.sql` defines users, reports, comments and votes. Further migrations add authorization, moderation and rate limits. Do not rewrite applied migrations. Soft deletion hides content; it is not account erasure. Manual account/data requests are handled through the contact published in `/privacy.html`; no fixed automatic retention period or self-service account deletion is documented.

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
