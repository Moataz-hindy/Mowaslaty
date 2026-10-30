import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPatch as mePatch } from '../functions/api/community/me.js';
import { onRequestPost as createPost, onRequestGet as feed } from '../functions/api/community/posts.js';
import { onRequestPatch as editPost } from '../functions/api/community/posts/[id].js';
import { onRequestGet as moderationGet, onRequestPatch as moderate } from '../functions/api/community/moderation.js';
import { onRequestPost as createComment, onRequestGet as listComments } from '../functions/api/community/posts/[id]/comments.js';
import { onRequestPatch as editComment } from '../functions/api/community/comments/[id].js';
import { onRequestPut as vote } from '../functions/api/community/posts/[id]/vote.js';
import { onRequestGet as capabilities } from '../functions/api/community/capabilities.js';
import { onRequestGet as getMine } from '../functions/api/community/mine.js';
import routeSummary from '../public/data/routes_summary.v2.json' with { type: 'json' };
import { filterRouteSummary, ROUTE_EXCLUSIONS } from '../src/utils/routePolicy.js';
import manifest from '../functions/api/community/route-ids.json' with { type: 'json' };
import runtimeManifest from '../functions/api/community/_route-ids.js';
class D1 {
  constructor(db) {
    this.db = db;
    this.beforeRun = null;
  }
  prepare(sql) {
    const db = this.db;
    const adapter = this;
    let values = [];
    const statement = {
      bind(...v) {
        values = v;
        return this;
      },
      async all() {
        return {
          success: true,
          results: db.prepare(sql).all(...values)
        };
      },
      async first() {
        return db.prepare(sql).get(...values) || null;
      },
      async run() {
        if (adapter.beforeRun) {
          const beforeRun = adapter.beforeRun;
          if (await beforeRun(sql, values)) adapter.beforeRun = null;
        }
        const r = db.prepare(sql).run(...values);
        return {
          success: true,
          meta: {
            changes: Number(r.changes)
          }
        };
      }
    };
    return statement;
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const out = statements.map(s => {
        const r = this.db.prepare(s.sql).run(...s.values);
        return {
          success: true,
          meta: {
            changes: Number(r.changes)
          }
        };
      });
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
// Keep bound SQL visible to the batch adapter, as the Cloudflare D1 statement does.
const originalPrepare = D1.prototype.prepare;
D1.prototype.prepare = function (sql) {
  const s = originalPrepare.call(this, sql),
    bind = s.bind;
  s.sql = sql;
  s.bind = function (...v) {
    bind(...v);
    this.values = v;
    return this;
  };
  return s;
};
const req = (path, method = 'GET', token = 'alice', data) => new Request(`https://site.test/api/community/${path}`, {
  method,
  headers: {
    ...(method === 'GET' ? {} : {
      'content-type': 'application/json'
    }),
    authorization: `Bearer ${token}`
  },
  ...(data === undefined ? {} : {
    body: JSON.stringify(data)
  })
});
const read = async r => ({
  status: r.status,
  body: await r.json()
});
test('authenticated D1 integration covers ownership, moderation revisions, parent visibility and idempotent votes', async () => {
  assert.deepEqual(runtimeManifest, manifest);
  assert.deepEqual(manifest, filterRouteSummary(routeSummary).map(route => route.id).filter((id, index, all) => typeof id === 'string' && id.length <= 128 && all.indexOf(id) === index).sort());
  assert.equal(manifest.some(id => Object.hasOwn(ROUTE_EXCLUSIONS, id)), false);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await readFile(new URL('../migrations/community/0001_initial.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../migrations/community/0002_accounts_moderation.sql', import.meta.url), 'utf8'));
    const COMMUNITY_DB = new D1(db),
      env = {
        COMMUNITY_DB,
        COMMUNITY_GOOGLE_ENABLED: 'true',
        COMMUNITY_PUBLISHING_ENABLED: 'true',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'x'.repeat(30)}`
      };
    assert.deepEqual(await read(await capabilities({
      env: {
        ...env,
        SUPABASE_PUBLISHABLE_KEY: `sb_secret_${'x'.repeat(30)}`
      }
    })), {
      status: 200,
      body: {
        authenticationAvailable: false,
        publishingAvailable: false
      }
    });
    const oldFetch = globalThis.fetch;
    let authRequest;
    globalThis.fetch = async (input, init) => {
      const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '');
      authRequest = { url: String(input), authorization: new Headers(init?.headers).get('authorization'), apikey: new Headers(init?.headers).get('apikey') };
      if (!token || token === 'expired') return new Response(JSON.stringify({
        message: 'invalid token'
      }), {
        status: 401
      });
      return new Response(JSON.stringify({
        id: token === 'moderator' ? 'user-mod' : token === 'bob' ? 'user-bob' : 'user-alice',
        email: 'private@example.test'
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    };
    try {
      const malformedOrigin = new Request('https://site.test/api/community/me', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer alice',
          origin: '://bad',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          displayName: 'Mallory'
        })
      });
      assert.equal((await read(await mePatch({
        request: malformedOrigin,
        env
      }))).status, 403);
      assert.equal((await read(await mePatch({
        request: req('me', 'PATCH', 'alice', {
          displayName: 'Alice',
          isModerator: true
        }),
        env
      }))).status, 200);
      assert.deepEqual(authRequest, {
        url: 'https://project.supabase.co/auth/v1/user',
        authorization: 'Bearer alice',
        apikey: env.SUPABASE_PUBLISHABLE_KEY
      });
      assert.equal(db.prepare("SELECT is_moderator FROM community_users WHERE auth_subject LIKE '%user-alice'").get().is_moderator, 0);
      db.prepare("INSERT INTO community_users(id,auth_subject,display_name,is_moderator) VALUES('mod','https://project.supabase.co|user-mod','Mod',1)").run();
      assert.equal((await read(await createPost({
        request: req('posts', 'POST', 'alice', {
          routeId: 'metro_T_L1_N',
          category: 'fare',
          body: 'أجرة جديدة'
        }),
        env
      }))).status, 201);
      const own = await read(await getMine({ request: req('mine'), env }));
      assert.deepEqual(Object.keys(own.body.posts[0]).sort(), ['authorDisplayName', 'body', 'category', 'commentCount', 'createdAt', 'id', 'routeId', 'status', 'voteScore'].sort());
      assert.equal(own.body.posts[0].authorDisplayName, 'Alice');
      assert.equal(own.body.posts[0].status, 'approved');
      const firstPublicPost = (await read(await feed({
        request: req('posts'),
        env
      }))).body.posts[0];
      assert.equal(firstPublicPost.id, own.body.posts[0].id);
      assert.equal((await read(await createPost({
        request: req('posts', 'POST', 'bob', {
          routeId: 'metro_T_L1_N',
          category: 'fare',
          body: 'other'
        }),
        env
      }))).body.code, 'DisplayNameRequired');
      await mePatch({
        request: req('me', 'PATCH', 'bob', {
          displayName: 'Bob'
        }),
        env
      });
      for (let i = 0; i < 8; i++) assert.equal((await read(await createPost({
        request: req('posts', 'POST', 'bob', {
          routeId: 'metro_T_L1_N',
          category: 'tip',
          body: `rate ${i}`
        }),
        env
      }))).status, 201);
      assert.equal((await read(await createPost({
        request: req('posts', 'POST', 'bob', {
          routeId: 'metro_T_L1_N',
          category: 'tip',
          body: 'rate excess'
        }),
        env
      }))).status, 429);
      assert.equal((await read(await createPost({
        request: req('posts', 'POST', 'alice', {
          routeId: 'forged-route',
          category: 'fare',
          body: 'bad'
        }),
        env
      }))).status, 400);
      assert.equal((await read(await createPost({
        request: req('posts', 'POST', 'alice', {
          routeId: Object.keys(ROUTE_EXCLUSIONS)[0],
          category: 'fare',
          body: 'excluded route'
        }),
        env
      }))).status, 400);
      const oversizedBody = JSON.stringify({
        routeId: 'metro_T_L1_N',
        category: 'tip',
        body: 'x'.repeat(17000)
      });
      assert.equal((await read(await createPost({
        request: new Request('https://site.test/api/community/posts', {
          method: 'POST',
          headers: {
            authorization: 'Bearer alice',
            'content-type': 'application/json'
          },
          body: oversizedBody
        }),
        env
      }))).status, 413);
      assert.equal((await read(await mePatch({
        request: req('me', 'PATCH', 'expired', {
          displayName: 'Nope'
        }),
        env
      }))).status, 401);
      const post = db.prepare("INSERT INTO community_reports(id,user_id,route_id,category,body,status) VALUES('pending-parent',(SELECT id FROM community_users WHERE auth_subject LIKE '%user-alice'),'metro_T_L1_N','tip','legacy pending parent','pending') RETURNING id,revision").get();
      assert.equal((await read(await editPost({
        request: req(`posts/${post.id}`, 'PATCH', 'bob', {
          routeId: 'metro_T_L1_N',
          category: 'fare',
          body: 'takeover'
        }),
        env,
        params: {
          id: post.id
        }
      }))).status, 404);
      const aliceId = db.prepare("SELECT id FROM community_users WHERE auth_subject LIKE '%user-alice'").get().id;
      db.prepare("INSERT INTO community_comments(id,report_id,user_id,body,status) VALUES('orphan-review',?,?,'pending test','pending')").run(post.id, aliceId);
      assert.equal((await read(await moderate({
        request: req('moderation', 'PATCH', 'moderator', {
          targetType: 'comment',
          id: 'orphan-review',
          status: 'approved',
          expectedRevision: 1
        }),
        env
      }))).status, 409);
      assert.equal((await read(await createComment({
        request: req(`posts/${post.id}/comments`, 'POST', 'bob', {
          body: 'hello'
        }),
        env,
        params: {
          id: post.id
        }
      }))).status, 404);
      await db.prepare("UPDATE community_reports SET status='approved',reviewed_at=1,reviewed_by='mod' WHERE id=?").run(post.id);
      COMMUNITY_DB.beforeRun = async sql => {
        if (sql.startsWith('INSERT INTO community_comments')) {
          db.prepare("UPDATE community_reports SET status='hidden' WHERE id=?").run(post.id);
          return true;
        }
        return false;
      };
      assert.equal((await read(await createComment({
        request: req(`posts/${post.id}/comments`, 'POST', 'alice', { body: 'hidden during comment submit' }),
        env,
        params: { id: post.id }
      }))).status, 404);
      assert.equal(db.prepare("SELECT count(*) AS n FROM community_comments WHERE body='hidden during comment submit'").get().n, 0);
      await db.prepare("UPDATE community_reports SET status='approved' WHERE id=?").run(post.id);
      const commentRes = await read(await createComment({
        request: req(`posts/${post.id}/comments`, 'POST', 'alice', {
          body: 'hello'
        }),
        env,
        params: {
          id: post.id
        }
      }));
      assert.equal(commentRes.status, 201);
      assert.equal(commentRes.body.comment.status, 'approved');
      assert.equal((await read(await listComments({
        request: req(`posts/${post.id}/comments`),
        env,
        params: {
          id: post.id
        }
      }))).body.comments.length, 1);
      const comment = db.prepare("SELECT id,revision FROM community_comments WHERE body='hello'").get();
      const originalCommentAt = commentRes.body.comment.createdAt;
      const editedComment = await read(await editComment({
        request: req(`comments/${comment.id}`, 'PATCH', 'alice', { body: 'updated comment' }),
        env,
        params: { id: comment.id }
      }));
      assert.equal(editedComment.status, 200);
      assert.equal(editedComment.body.comment.createdAt, originalCommentAt);
      assert.equal(editedComment.body.comment.authorDisplayName, 'Alice');
      assert.equal(editedComment.body.comment.status, 'approved');
      const immediatelyEditedComments = await read(await listComments({ request: req(`posts/${post.id}/comments`), env, params: { id: post.id } }));
      assert.equal(immediatelyEditedComments.body.comments[0].body, 'updated comment');
      COMMUNITY_DB.beforeRun = async sql => {
        if (sql.startsWith('INSERT INTO community_votes')) {
          db.prepare("UPDATE community_reports SET status='hidden' WHERE id=?").run(post.id);
          return true;
        }
        return false;
      };
      assert.equal((await read(await vote({
        request: req(`posts/${post.id}/vote`, 'PUT', 'alice', { value: 1 }),
        env,
        params: { id: post.id }
      }))).status, 404);
      assert.equal(db.prepare('SELECT count(*) AS n FROM community_votes WHERE report_id=?').get(post.id).n, 0);
      await db.prepare("UPDATE community_reports SET status='approved' WHERE id=?").run(post.id);
      const first = await read(await vote({
        request: req(`posts/${post.id}/vote`, 'PUT', 'alice', {
          value: 1
        }),
        env,
        params: {
          id: post.id
        }
      }));
      const second = await read(await vote({
        request: req(`posts/${post.id}/vote`, 'PUT', 'alice', {
          value: 1
        }),
        env,
        params: {
          id: post.id
        }
      }));
      assert.equal(first.body.voteScore, 1);
      assert.equal(second.body.voteScore, 1);
      COMMUNITY_DB.beforeRun = async sql => {
        if (sql.startsWith('INSERT INTO community_votes')) {
          db.prepare("UPDATE community_reports SET status='hidden' WHERE id=?").run(post.id);
          return true;
        }
        return false;
      };
      assert.equal((await read(await vote({
        request: req(`posts/${post.id}/vote`, 'PUT', 'alice', { value: -1 }),
        env,
        params: { id: post.id }
      }))).status, 404);
      assert.equal(db.prepare('SELECT value FROM community_votes WHERE report_id=?').get(post.id).value, 1);
      await db.prepare("UPDATE community_reports SET status='approved' WHERE id=?").run(post.id);
      COMMUNITY_DB.beforeRun = async sql => {
        if (sql.startsWith('DELETE FROM community_votes')) {
          db.prepare("UPDATE community_reports SET status='hidden' WHERE id=?").run(post.id);
          return true;
        }
        return false;
      };
      assert.equal((await read(await vote({
        request: req(`posts/${post.id}/vote`, 'PUT', 'alice', { value: 0 }),
        env,
        params: { id: post.id }
      }))).status, 404);
      assert.equal(db.prepare('SELECT value FROM community_votes WHERE report_id=?').get(post.id).value, 1);
      await db.prepare("UPDATE community_reports SET status='approved' WHERE id=?").run(post.id);
      const queue = await read(await moderationGet({
        request: req('moderation?kind=posts', 'GET', 'moderator'),
        env
      }));
      assert.equal(queue.status, 200);
      const pendingId = db.prepare("INSERT INTO community_reports(id,user_id,route_id,category,body) VALUES('p2',(SELECT id FROM community_users WHERE auth_subject LIKE '%user-alice'),'metro_T_L1_N','tip','pending') RETURNING id").get().id;
      const rev = db.prepare('SELECT revision FROM community_reports WHERE id=?').get(pendingId).revision;
      const approve = () => moderate({
        request: req('moderation', 'PATCH', 'moderator', {
          targetType: 'post',
          id: pendingId,
          status: 'approved',
          expectedRevision: rev
        }),
        env
      });
      assert.equal((await read(await approve())).status, 200);
      assert.equal((await read(await approve())).status, 409);
      assert.equal(db.prepare('SELECT count(*) AS n FROM community_moderation_audit WHERE target_id=?').get(pendingId).n, 1);
      assert.equal((await read(await feed({
        request: req('posts'),
        env
      }))).body.posts.some(x => x.id === pendingId), true);
      db.prepare("UPDATE community_users SET banned_at=1 WHERE auth_subject LIKE '%user-alice'").run();
      assert.equal((await read(await feed({
        request: req('posts'),
        env
      }))).status, 200);
      assert.equal((await read(await mePatch({
        request: req('me', 'PATCH', 'alice', {
          displayName: 'Hacker'
        }),
        env
      }))).status, 403);
      assert.equal(db.prepare("SELECT display_name FROM community_users WHERE auth_subject LIKE '%user-alice'").get().display_name, 'Alice');
      const privateFields = JSON.stringify((await read(await feed({
        request: req('posts'),
        env
      }))).body);
      assert.doesNotMatch(privateFields, /private@example|user-alice|subject/);
    } finally {
      globalThis.fetch = oldFetch;
    }
  } finally {
    db.close();
  }
});
test('approved feed applies route policy before keyset pagination and limits', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await readFile(new URL('../migrations/community/0001_initial.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../migrations/community/0002_accounts_moderation.sql', import.meta.url), 'utf8'));
    const owner = 'owner';
    db.prepare('INSERT INTO community_users(id,auth_subject,display_name) VALUES(?,?,?)').run(owner, 'issuer|user', 'Author');
    const allowed = manifest.slice(0, 3), excluded = Object.keys(ROUTE_EXCLUSIONS)[0];
    const records = [
      ['allow-a', allowed[0], 600],
      ['exclude-top', excluded, 550],
      ['allow-b', allowed[1], 500],
      ['exclude-middle', excluded, 450],
      ['allow-c', allowed[2], 400],
      ['exclude-tail', excluded, 300]
    ];
    const insert = db.prepare("INSERT INTO community_reports(id,user_id,route_id,category,body,status,created_at,updated_at,reviewed_at) VALUES(?,?,?,'tip',?,'approved',?,?,1)");
    for (const [id, routeId, createdAt] of records) insert.run(id, owner, routeId, id, createdAt, createdAt);
    const request = cursor => new Request(`https://site.test/api/community/posts?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const first = await read(await feed({ request: request(), env: { COMMUNITY_DB: new D1(db) } }));
    assert.deepEqual(first.body.posts.map(post => post.id), ['allow-a', 'allow-b']);
    assert.ok(first.body.nextCursor);
    const second = await read(await feed({ request: request(first.body.nextCursor), env: { COMMUNITY_DB: new D1(db) } }));
    assert.deepEqual(second.body.posts.map(post => post.id), ['allow-c']);
    assert.equal(second.body.nextCursor, null);
  } finally {
    db.close();
  }
});

test('clean community writes publish immediately and blocked edits leave approved content untouched', async () => {
  const db = new DatabaseSync(':memory:');
  const oldFetch = globalThis.fetch;
  try {
    db.exec(await readFile(new URL('../migrations/community/0001_initial.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../migrations/community/0002_accounts_moderation.sql', import.meta.url), 'utf8'));
    const COMMUNITY_DB = new D1(db);
    const env = {
      COMMUNITY_DB,
      COMMUNITY_GOOGLE_ENABLED: 'true',
      COMMUNITY_PUBLISHING_ENABLED: 'true',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'x'.repeat(30)}`
    };
    globalThis.fetch = async (_input, init) => {
      const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '');
      if (!token) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ id: token === 'moderator' ? 'user-moderator' : token === 'bob' ? 'user-bob' : 'user-alice' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
    assert.equal((await read(await mePatch({ request: req('me', 'PATCH', 'alice', { displayName: 'Alice' }), env }))).status, 200);
    db.prepare("INSERT INTO community_users(id,auth_subject,display_name,is_moderator) VALUES('moderator-id','https://project.supabase.co|user-moderator','Moderator',1)").run();

    const cleanPost = await read(await createPost({
      request: req('posts', 'POST', 'alice', { routeId: 'metro_T_L1_N', category: 'tip', body: 'محطة أكتوبر قريبة من كسوف الشمس' }), env
    }));
    assert.equal(cleanPost.status, 201);
    assert.equal(cleanPost.body.post.status, 'approved');
    assert.equal((await read(await feed({ request: req('posts'), env }))).body.posts[0].id, cleanPost.body.post.id);

    const reportCountBeforeBlockedCreate = db.prepare('SELECT count(*) AS n FROM community_reports').get().n;
    const blockedPost = await read(await createPost({
      request: req('posts', 'POST', 'alice', { routeId: 'metro_T_L1_N', category: 'tip', body: 'معلومة عَرْص' }), env
    }));
    assert.equal(blockedPost.status, 400);
    assert.equal(blockedPost.body.code, 'ContentBlocked');
    assert.equal(db.prepare('SELECT count(*) AS n FROM community_reports').get().n, reportCountBeforeBlockedCreate);

    const originalBody = cleanPost.body.post.body;
    const originalPostRevision = db.prepare('SELECT revision FROM community_reports WHERE id=?').get(cleanPost.body.post.id).revision;
    const blockedPostEdit = await read(await editPost({
      request: req(`posts/${cleanPost.body.post.id}`, 'PATCH', 'alice', { routeId: 'metro_T_L1_N', category: 'tip', body: 'معلومة كـسم' }),
      env,
      params: { id: cleanPost.body.post.id }
    }));
    assert.equal(blockedPostEdit.status, 400);
    assert.equal(blockedPostEdit.body.code, 'ContentBlocked');
    assert.equal(db.prepare('SELECT body,status FROM community_reports WHERE id=?').get(cleanPost.body.post.id).body, originalBody);
    assert.equal(db.prepare('SELECT status FROM community_reports WHERE id=?').get(cleanPost.body.post.id).status, 'approved');
    assert.equal(db.prepare('SELECT revision FROM community_reports WHERE id=?').get(cleanPost.body.post.id).revision, originalPostRevision);
    assert.equal((await read(await feed({ request: req('posts'), env }))).body.posts[0].body, originalBody);

    const cleanPostEdit = await read(await editPost({
      request: req(`posts/${cleanPost.body.post.id}`, 'PATCH', 'alice', { routeId: 'metro_T_L1_N', category: 'tip', body: 'تعديل نظيف عند كفر الشيخ' }),
      env,
      params: { id: cleanPost.body.post.id }
    }));
    assert.equal(cleanPostEdit.body.post.status, 'approved');
    assert.equal((await read(await feed({ request: req('posts'), env }))).body.posts[0].body, 'تعديل نظيف عند كفر الشيخ');

    const cleanComment = await read(await createComment({
      request: req(`posts/${cleanPost.body.post.id}/comments`, 'POST', 'alice', { body: 'شكراً على التوضيح' }),
      env,
      params: { id: cleanPost.body.post.id }
    }));
    assert.equal(cleanComment.status, 201);
    assert.equal(cleanComment.body.comment.status, 'approved');
    assert.equal((await read(await listComments({ request: req(`posts/${cleanPost.body.post.id}/comments`), env, params: { id: cleanPost.body.post.id } }))).body.comments.length, 1);

    const blockedComment = await read(await createComment({
      request: req(`posts/${cleanPost.body.post.id}/comments`, 'POST', 'alice', { body: 'يا خول' }),
      env,
      params: { id: cleanPost.body.post.id }
    }));
    assert.equal(blockedComment.status, 400);
    assert.equal(blockedComment.body.code, 'ContentBlocked');
    assert.equal(db.prepare('SELECT count(*) AS n FROM community_comments').get().n, 1);

    const originalCommentRevision = db.prepare('SELECT revision FROM community_comments WHERE id=?').get(cleanComment.body.comment.id).revision;
    const blockedCommentEdit = await read(await editComment({
      request: req(`comments/${cleanComment.body.comment.id}`, 'PATCH', 'alice', { body: 'ك​سمك' }),
      env,
      params: { id: cleanComment.body.comment.id }
    }));
    assert.equal(blockedCommentEdit.status, 400);
    assert.equal(blockedCommentEdit.body.code, 'ContentBlocked');
    assert.equal(db.prepare('SELECT body,status FROM community_comments WHERE id=?').get(cleanComment.body.comment.id).body, 'شكراً على التوضيح');
    assert.equal(db.prepare('SELECT status FROM community_comments WHERE id=?').get(cleanComment.body.comment.id).status, 'approved');
    assert.equal(db.prepare('SELECT revision FROM community_comments WHERE id=?').get(cleanComment.body.comment.id).revision, originalCommentRevision);
    assert.equal((await read(await listComments({ request: req(`posts/${cleanPost.body.post.id}/comments`), env, params: { id: cleanPost.body.post.id } }))).body.comments[0].body, 'شكراً على التوضيح');

    const cleanCommentEdit = await read(await editComment({
      request: req(`comments/${cleanComment.body.comment.id}`, 'PATCH', 'alice', { body: 'تعليق نظيف محدث' }),
      env,
      params: { id: cleanComment.body.comment.id }
    }));
    assert.equal(cleanCommentEdit.body.comment.status, 'approved');
    assert.equal((await read(await listComments({ request: req(`posts/${cleanPost.body.post.id}/comments`), env, params: { id: cleanPost.body.post.id } }))).body.comments[0].body, 'تعليق نظيف محدث');

    const blockedAlias = await read(await mePatch({ request: req('me', 'PATCH', 'alice', { displayName: 'عرص' }), env }));
    assert.equal(blockedAlias.status, 400);
    assert.equal(blockedAlias.body.code, 'ContentBlocked');
    assert.equal(db.prepare("SELECT display_name FROM community_users WHERE auth_subject LIKE '%user-alice'").get().display_name, 'Alice');

    db.prepare("UPDATE community_users SET display_name='عرص' WHERE auth_subject LIKE '%user-alice'").run();
    const commentCountBeforeBlockedAliasComment = db.prepare('SELECT count(*) AS n FROM community_comments').get().n;
    const blockedAliasComment = await read(await createComment({
      request: req(`posts/${cleanPost.body.post.id}/comments`, 'POST', 'alice', { body: 'Clean comment' }), env, params: { id: cleanPost.body.post.id }
    }));
    assert.equal(blockedAliasComment.status, 400);
    assert.equal(blockedAliasComment.body.code, 'ContentBlocked');
    assert.equal(db.prepare('SELECT count(*) AS n FROM community_comments').get().n, commentCountBeforeBlockedAliasComment);

    const reportCountBeforeBlockedAliasPost = db.prepare('SELECT count(*) AS n FROM community_reports').get().n;
    const blockedAliasPost = await read(await createPost({
      request: req('posts', 'POST', 'alice', { routeId: 'metro_T_L1_N', category: 'tip', body: 'Clean body' }), env
    }));
    assert.equal(blockedAliasPost.status, 400);
    assert.equal(blockedAliasPost.body.code, 'ContentBlocked');
    assert.equal(db.prepare('SELECT count(*) AS n FROM community_reports').get().n, reportCountBeforeBlockedAliasPost);

    db.prepare("UPDATE community_users SET display_name='Alice' WHERE auth_subject LIKE '%user-alice'").run();
    const commentRevision = db.prepare('SELECT revision FROM community_comments WHERE id=?').get(cleanComment.body.comment.id).revision;
    const staleHide = await read(await moderate({
      request: req('moderation', 'PATCH', 'moderator', { targetType: 'comment', id: cleanComment.body.comment.id, status: 'hidden', expectedRevision: commentRevision - 1 }), env
    }));
    assert.equal(staleHide.status, 409);
    const hiddenComment = await read(await moderate({
      request: req('moderation', 'PATCH', 'moderator', { targetType: 'comment', id: cleanComment.body.comment.id, status: 'hidden', expectedRevision: commentRevision }), env
    }));
    assert.equal(hiddenComment.status, 200);
    assert.equal((await read(await listComments({ request: req(`posts/${cleanPost.body.post.id}/comments`), env, params: { id: cleanPost.body.post.id } }))).body.comments.length, 0);

    const postRevision = db.prepare('SELECT revision FROM community_reports WHERE id=?').get(cleanPost.body.post.id).revision;
    const hiddenPost = await read(await moderate({
      request: req('moderation', 'PATCH', 'moderator', { targetType: 'post', id: cleanPost.body.post.id, status: 'hidden', expectedRevision: postRevision }), env
    }));
    assert.equal(hiddenPost.status, 200);
    assert.equal((await read(await feed({ request: req('posts'), env }))).body.posts.some(post => post.id === cleanPost.body.post.id), false);
  } finally {
    globalThis.fetch = oldFetch;
    db.close();
  }
});
