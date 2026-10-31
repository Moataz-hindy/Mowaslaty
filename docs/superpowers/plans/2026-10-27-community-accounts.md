# Community accounts and participation

User authorization: finish all local preparation without requiring account setup. Implementation uses gpt-6-luna at medium reasoning. No deployment, paid resources, unrelated Supabase projects, or remote migrations.

## Architecture

Supabase Auth (Google OAuth, PKCE) supplies verified identities. Cloudflare Pages Functions and D1 store aliases, reports, comments, votes, moderation and rate limits. Authentication is disabled without valid SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and COMMUNITY_GOOGLE_ENABLED=true. Publishing additionally requires COMMUNITY_PUBLISHING_ENABLED=true and COMMUNITY_DB. Only sb_publishable_ keys may be exposed. Never expose secret/service-role keys. API uses auth.getUser(bearer) against configured server, not JWT decoding or user metadata. D1 owns role and banned status. No fake/local auth bypass.

## Shared API contract

All responses JSON, no-store. Error {code}, status400/401/403/404/409/413/429/503. Dates ISO strings, IDs opaque strings. All writes bounded JSON, same-origin checks when Origin supplied, bearer required, failed configuration returns503 before body/DB. Unsupported methods405 except original unavailable-write regression retained. Public aliases user-chosen, never provider email/name.

- GET /api/community/capabilities: authenticationAvailable, publishingAvailable; when configured auth:{url,publishableKey,provider:'google'}. Disabled response retains two false flags only.
- GET /api/community/me: {user:{id,displayName,isModerator}}. PATCH {displayName} returns same. No role updates.
- GET /api/community/posts: existing category/q/limit/cursor, approved only, {posts,nextCursor}; posts add voteScore/commentCount (public aggregates).
- POST /api/community/posts: {routeId,category,body}, returns201 {post}. Pending; valid exact policy-filtered route ID; public alias required.
- GET /api/community/mine: {posts,comments}; bounded recent own submissions with status. PATCH /posts/:id {routeId,category,body} resets pending; DELETE hides own post. Writes return {post} or {ok:true}.
- GET /posts/:id/comments: approved comments only under approved parent, {comments,nextCursor}, cursor/limit bounded. POST {body} returns201 {comment}, pending.
- PATCH /comments/:id {body} resets pending; DELETE hides own comment. {comment}/{ok:true}.
- PUT /posts/:id/vote {value:-1|0|1}: upsert/remove own vote, approved parent only, {voteScore,value}; GET same endpoint returns current value plus score, auth required.
- GET /moderation?kind=posts|comments&status=pending|approved|rejected|hidden: {items,nextCursor}, bounded pagination. Items include targetType:'post'|'comment', status and moderation fields plus normal data.
- PATCH /moderation {targetType:'post'|'comment',id,expectedRevision,status:'approved'|'rejected'|'hidden',note?}: {ok:true}. Queue items include integer revision. Edits/deletes/review increment revision. Conditional decision and audit written atomically only when expectedRevision matches; otherwise409. Comments approval requires approved parent in the atomic guard. No auto-first-moderator.

Public post fields id,routeId,category,body,createdAt,authorDisplayName,voteScore,commentCount. Own post adds status. Public comment fields id,reportId,body,createdAt,authorDisplayName; own adds status. Author internal ID/email/subject never public.

## Implementation ownership and order

1. Backend Luna owns package.json/package-lock.json (pin @supabase/supabase-js exact), server/community/, functions/api/community/, migrations/community/0002*, scripts/community* and scripts/generated route IDs tooling. Retain migration0001. Real in-memory SQLite D1 adapter integration tests plus trusted auth transport tests. Add test script. Atomic bounded rate limits, owner isolation, role/banned authorization, approved-parent visibility, route policy validation, audit batches. Validate SDK bundling locally if tooling permits.
2. Frontend Luna owns src/community/, new account/callback components, CommunityHub.jsx/css, AppEntry.jsx, frontend unit tests. Wait for backend dependency install; API contract above fixed. Preserve drafts, local failure handling and all planner/home flows. Google PKCE callback /auth/callback exchanges once under StrictMode, removes query, fixed return /#community. No arbitrary redirects. Account sign-in/out, alias editor, submissions CRUD, pending-review notices, comments/votes, moderator-only queue, pagination, responsive accessible Arabic UI. No real OAuth claims in tests.
3. Parent owns documentation/examples and integration/security review. Run API + relevant frontend tests, full Vite build, browser QA unconfigured feed/drafts/mobile. Independent Luna review after implementation; fix findings before final.

## Acceptance

Unconfigured deployment remains read-only; drafts readable/editable/deletable when routes/API unavailable. All public content approved and private fields absent. Invalid/expired identity, banned user, owner mismatch, forged role, disallowed route, oversize body, CSRF Origin mismatch and rate excess fail safely. Votes idempotent. Pending edits hide parent comments. Auth code never left in history or exchanged twice. No dataset/planner/native regression. Remaining production setup documented separately; no action required from user during implementation.
