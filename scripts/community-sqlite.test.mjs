import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
test('community migrations enforce pending content, moderator audit and rate-limit constraints in real SQLite', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await readFile(new URL('../migrations/community/0001_initial.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../migrations/community/0002_accounts_moderation.sql', import.meta.url), 'utf8'));
    db.prepare('INSERT INTO community_users(id,auth_subject,display_name,is_moderator) VALUES(?,?,?,?)').run('u1', 'issuer|subject', 'A Person', 1);
    db.prepare("INSERT INTO community_reports(id,user_id,route_id,category,body) VALUES('p1','u1','metro_T_L1_N','fare','Fare changed')").run();
    assert.equal(db.prepare('SELECT status FROM community_reports WHERE id=?').get('p1').status, 'pending');
    assert.throws(() => db.prepare("UPDATE community_reports SET status='approved' WHERE id='p1'").run());
    db.prepare("UPDATE community_reports SET status='approved',reviewed_at=1,reviewed_by='u1' WHERE id='p1'").run();
    db.prepare("INSERT INTO community_moderation_audit(id,actor_id,target_type,target_id,old_status,new_status,created_at) VALUES('a1','u1','post','p1','pending','approved',1)").run();
    db.prepare('INSERT INTO community_rate_limits(user_id,action,window_started,count) VALUES(?,?,?,?)').run('u1', 'post', 1, 2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM community_moderation_audit').get().n, 1);
    assert.throws(() => db.prepare('INSERT INTO community_votes(report_id,user_id,value) VALUES(?,?,?)').run('p1', 'u1', 2));
  } finally {
    db.close();
  }
});
