# Immediate community publishing implementation plan

> For agentic workers: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Publish new clean posts/comments immediately; reject Arabic profanity with an editable error.
**Architecture:** A dedicated server-side normalized, token-aware Arabic blocklist checks post/comment creates and edits before any content write. Existing approved status represents public content; manual hiding, ownership, rate limits and revision guards remain intact. Existing pending/rejected/hidden records are not bulk-published.
**Tech Stack:** React, Cloudflare Pages Functions, D1, node:test.
**Spec:** User request on 2026-10-29: remove mandatory review and reject blocked Arabic words only. Apply consistently to posts and comments.

## Constraints and review focus
- No new services/dependencies or auth configuration changes.
- Small explicit editable list of unambiguous profanity; word-aware matching avoids benign substrings/place names. Normalize Arabic diacritics/tatweel/letter variants and common invisible characters. Do not claim exhaustive abuse detection.
- Clean creates/edits approved immediately; rejected content returns ContentBlocked without storing it or altering existing public content. Preserve drafts/input on failure.
- Keep hidden content uneditable, moderator decisions/audit/revision rules, parent visibility checks, bans, ownership, route policy and rate limits.
- Public alias is also checked on update/create publishing to avoid bypass via author names; existing data unchanged.
- Refresh feed/comment state accurately after success; remove all promises of mandatory review from UI/docs/privacy notice where applicable.

## Tasks
- [x] Add failing filter tests for profanity, normalization, benign Arabic place/transit text and word boundaries. Implement helper with documented list.
- [x] Add integration regressions covering immediate clean create/edit visibility and blocked create/edit preservation for posts/comments, alias filtering, hidden parent and ownership safeguards. Update old pending assumptions without reducing coverage.
- [x] Implement server checks and explicit approved writes, no schema migration needed.
- [x] Update UI messages/errors and refresh public/own state, preserve inputs/drafts on block/network failure. Update accurate documentation/notice statements only.
- [x] Run community tests, Vite build and Functions build. No dedicated frontend test script exists. Deployment and live verification remain with the parent; no fake public content was created.
