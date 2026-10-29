import test from 'node:test';
import assert from 'node:assert/strict';
import { applyModerationDecision } from './moderationState.js';

test('a decision updates the matching private submission and removes non-approved posts from the feed', () => {
  const current = {
    posts: [{ id: 'post-1', status: 'pending' }, { id: 'post-2', status: 'approved' }],
    comments: [{ id: 'comment-1', status: 'pending' }],
    publicPosts: [{ id: 'post-2', status: 'approved' }],
  };

  assert.deepEqual(applyModerationDecision(current, 'post', 'post-1', 'rejected'), {
    posts: [{ id: 'post-1', status: 'rejected' }, { id: 'post-2', status: 'approved' }],
    comments: [{ id: 'comment-1', status: 'pending' }],
    publicPosts: [{ id: 'post-2', status: 'approved' }],
  });
  assert.deepEqual(applyModerationDecision(current, 'comment', 'comment-1', 'approved'), {
    ...current,
    comments: [{ id: 'comment-1', status: 'approved' }],
  });
  assert.deepEqual(applyModerationDecision(current, 'post', 'post-2', 'rejected').publicPosts, []);
});
