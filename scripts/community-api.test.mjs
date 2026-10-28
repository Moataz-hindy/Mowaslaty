import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as capabilities } from '../functions/api/community/capabilities.js';
import { onRequestGet as posts, onRequestPost, onRequestPut, onRequestPatch, onRequestDelete } from '../functions/api/community/posts.js';
const request = (path, method = 'GET') => new Request(`https://example.test${path}`, {
  method
});
const parse = async response => ({
  status: response.status,
  body: await response.json()
});
test('capabilities explicitly disables auth and publishing', async () => {
  assert.deepEqual(await parse(await capabilities({
    request: request('/api/community/capabilities')
  })), {
    status: 200,
    body: {
      authenticationAvailable: false,
      publishingAvailable: false
    }
  });
});
test('missing D1 returns service unavailable rather than an empty feed', async () => {
  assert.deepEqual(await parse(await posts({
    request: request('/api/community/posts'),
    env: {}
  })), {
    status: 503,
    body: {
      code: 'CommunityUnavailable'
    }
  });
});
test('all write methods fail closed before database access', async () => {
  let touched = false;
  const env = {
    get COMMUNITY_DB() {
      touched = true;
      throw new Error('database touched');
    }
  };
  for (const [method, handler] of [['POST', onRequestPost], ['PUT', onRequestPut], ['PATCH', onRequestPatch], ['DELETE', onRequestDelete]]) {
    const response = await handler({
      request: request('/api/community/posts', method),
      env
    });
    assert.deepEqual(await parse(response), {
      status: 503,
      body: {
        code: 'PublishingUnavailable'
      }
    });
  }
  assert.equal(touched, false);
});
test('feed validates bounded inputs and query uses bound params', async () => {
  let query;
  let bound;
  const env = {
    COMMUNITY_DB: {
      prepare(sql) {
        query = sql;
        return {
          bind(...args) {
            bound = args;
            return this;
          },
          async all() {
            return {
              results: [{
                id: 'r1',
                routeId: 'metro_T_L1_N',
                category: 'fare',
                body: 'Fare changed',
                createdAt: 123,
                authorDisplayName: null,
                status: 'approved',
                email: 'private@example.test',
                subject: 'hidden',
                internalNotes: 'hidden'
              }]
            };
          }
        };
      }
    }
  };
  const response = await posts({
    request: request('/api/community/posts?category=fare&q=x%27%20OR%201%3D1--&limit=2&cursor=MTIzOnIx'),
    env
  });
  const {
    status,
    body
  } = await parse(response);
  assert.equal(status, 200);
  assert.deepEqual(body, {
    posts: [{
      id: 'r1',
      routeId: 'metro_T_L1_N',
      category: 'fare',
      body: 'Fare changed',
      createdAt: '1970-01-01T00:00:00.123Z',
      authorDisplayName: 'Community member',
      voteScore: 0,
      commentCount: 0
    }],
    nextCursor: null
  });
  assert.match(query, /status\s*=\s*'approved'/i);
  assert.match(query, /LIMIT \?/i);
  assert.doesNotMatch(query, /OR 1=1/);
  assert.ok(bound.includes("x' OR 1=1--"));
  assert.ok(bound.includes(123));
  assert.ok(bound.includes('r1'));
});
test('invalid category, oversized search and cursor are rejected without querying', async () => {
  let called = false;
  const env = {
    COMMUNITY_DB: {
      prepare() {
        called = true;
        throw new Error('must not query');
      }
    }
  };
  for (const path of ['/api/community/posts?category=all', `/api/community/posts?q=${'x'.repeat(121)}`, '/api/community/posts?cursor=-1']) {
    const response = await posts({
      request: request(path),
      env
    });
    assert.equal(response.status, 400);
  }
  assert.equal(called, false);
});
test('database failures do not leak SQL or internals', async () => {
  const env = {
    COMMUNITY_DB: {
      prepare() {
        throw new Error('SQL SELECT secret_table failed');
      }
    }
  };
  const {
    status,
    body
  } = await parse(await posts({
    request: request('/api/community/posts'),
    env
  }));
  assert.equal(status, 503);
  assert.deepEqual(body, {
    code: 'CommunityUnavailable'
  });
});
test('keyset pagination returns an opaque cursor for the last included row', async () => {
  const rows = [{
    id: 'newer',
    routeId: 'metro_T_L1_N',
    category: 'tip',
    body: 'A',
    createdAt: 200,
    authorDisplayName: 'Ada'
  }, {
    id: 'older',
    routeId: 'metro_T_L1_N',
    category: 'fare',
    body: 'B',
    createdAt: 100,
    authorDisplayName: null
  }];
  let bound;
  const env = {
    COMMUNITY_DB: {
      prepare() {
        return {
          bind(...args) {
            bound = args;
            return this;
          },
          async all() {
            return {
              success: true,
              results: rows
            };
          }
        };
      }
    }
  };
  const {
    status,
    body
  } = await parse(await posts({
    request: request('/api/community/posts?limit=1'),
    env
  }));
  assert.equal(status, 200);
  assert.equal(body.posts.length, 1);
  assert.equal(body.posts[0].createdAt, '1970-01-01T00:00:00.200Z');
  assert.equal(body.nextCursor, 'MjAwOm5ld2Vy');
  assert.equal(bound.at(-1), 2);
});
test('database-reported failures and malformed result shapes return unavailable', async () => {
  for (const all of [async () => ({
    success: false,
    results: []
  }), async () => ({})]) {
    const env = {
      COMMUNITY_DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            all
          };
        }
      }
    };
    const {
      status,
      body
    } = await parse(await posts({
      request: request('/api/community/posts'),
      env
    }));
    assert.equal(status, 503);
    assert.deepEqual(body, {
      code: 'CommunityUnavailable'
    });
  }
});
