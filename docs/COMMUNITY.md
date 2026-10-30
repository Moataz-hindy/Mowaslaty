# Community accounts

The community lives at `/#community`, outside the planner. Supabase Auth handles Google sign-in; Cloudflare Pages Functions and D1 handle community data. No Supabase database is used. Repository code does not create cloud resources or enable production login by itself.

## Drafts, identity and publication filtering

Drafts use `mowaslaty_community_drafts_v1` in the current browser. They remain available when login or the API is unavailable. The former prototype's seeded storage key is ignored and left untouched. A draft is published only when its owner explicitly chooses Publish; saving a draft never sends it.

New posts and comments, and clean edits, publish immediately. Before content writes, the server checks the post/comment body and public name against the small explicit list in `functions/api/community/_content-filter.js`. Matching uses NFKC normalization, removes Arabic diacritics, tatweel and common invisible characters, normalizes selected Arabic letter variants, and matches whole tokens with a few common attached prefixes. A listed word returns `400 ContentBlocked`; the write does not change stored content. This limited word list is not exhaustive abuse detection. Moderators can still hide published content, and existing pending/rejected/hidden records are not bulk changed by this policy.

The display name is an explicitly chosen public alias. Google email/name, provider tokens, auth subject and internal user ID are not public feed fields. Provider profile metadata never grants moderator access. Role and banned status come from D1 on each authenticated request.

## API contract

All responses are JSON with `Cache-Control: no-store`. Missing configuration disables login and writes. Public reads require D1; an absent database returns service unavailable rather than an empty feed. There is no development identity bypass.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/community/capabilities` | Enabled login/publishing and public Supabase configuration. |
| `GET/PATCH /api/community/me` | Own account and chosen public alias. |
| `GET/POST /api/community/posts` | Approved feed / publish an update immediately after word filtering. |
| `PATCH/DELETE /api/community/posts/:id` | Edit own post (clean edits publish immediately) / hide own post. |
| `GET /api/community/mine` | Own submissions and their current status. |
| `GET/POST /api/community/posts/:id/comments` | Approved comments / publish a comment immediately after word filtering. |
| `PATCH/DELETE /api/community/comments/:id` | Edit or hide own comment. |
| `GET/PUT /api/community/posts/:id/vote` | Own vote, value `1`, `-1`, or `0` to remove. |
| `GET/PATCH /api/community/moderation` | Moderator queue and audited decisions. |

Public posts: `id`, `routeId`, `category`, `body`, `createdAt`, `authorDisplayName`, `voteScore`, `commentCount`. Public comments: `id`, `reportId`, `body`, `createdAt`, `authorDisplayName`. Only approved parent posts expose comments or accept comments/votes. Clean post/comment edits remain published immediately; blocked edits leave the old content and revision unchanged. Hidden content cannot be edited by its owner.

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

Before the immediate-publishing change, production QA confirmed human Google sign-in, account profile access, moderator queue access, and `401` responses to anonymous account/moderation requests. A clearly marked private test post was pending and then rejected; the public feed stayed empty and the author's private view updated without a reload. This record documents the previous moderation policy only. It is not a production test of the new immediate-publishing or word-filter behavior.

Publishing is enabled in configuration. The immediate-publishing and word-filter behavior has only been exercised by local SQLite integration tests so far. Production comments, votes, and broader security behavior are not asserted as verified. The offline community suite covers API, SQLite and integration behavior but does not replace deployed-origin checks.

### Setup and runtime validation recipe

For a new environment, create a dedicated Supabase project. Enable Google in Auth providers and configure Google OAuth credentials in the Supabase dashboard. In Google use the Supabase callback shown there. Set the production site as the Supabase Site URL and allow exactly `https://YOUR-SITE/auth/callback` as a redirect. For local testing allow the actual local origin plus `/auth/callback`. Avoid wildcard production redirects.

For a new D1 database, bind it to the Pages project as exactly `COMMUNITY_DB` and apply SQL migrations from `migrations/community/` in numerical order after review. The production database named above is already migrated; do not repeat those migrations there.

For a deployment, test OAuth on the deployed origin. Verify a clean update/comment appears immediately, a listed Arabic word is rejected without overwriting prior content on edit, and moderators can still hide published content. Avoid creating public test posts. A trusted operator must designate a moderator in D1; there is no automatic first-user administrator. Verify anonymous/expired sessions, owner isolation, comments, voting and rate limits on the deployed runtime. Production checks not recorded above remain pending.

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
