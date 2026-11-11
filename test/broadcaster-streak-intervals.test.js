import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {initWatchStreakRewards} from '../src/watch-streak-rewards.js';
import {initBroadcasterStreak,registerBroadcasterLive} from '../src/broadcaster-streak.js';

test('le compteur streamer avance sans attribuer de cadeau automatiquement',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE accounts(id integer PRIMARY KEY,twitch_id text UNIQUE);
      CREATE TABLE users(id integer PRIMARY KEY,twitch_id text UNIQUE,points double precision DEFAULT 0,
        lifetime_lovercash_earned double precision DEFAULT 0,egg_fragments integer DEFAULT 0,
        pending_xp double precision DEFAULT 0,updated_at timestamptz DEFAULT now());
      CREATE TABLE shop_inventory(account_id integer,item_key text,quantity integer DEFAULT 1,
        purchased_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,item_key));
      INSERT INTO accounts VALUES(1,'streamer'); INSERT INTO users(id,twitch_id) VALUES(1,'streamer');`);
    await initWatchStreakRewards(db);
    const pool={
      query:(...args)=>db.query(...args),
      connect:async()=>({query:(...args)=>db.query(...args),release(){}})
    };
    await initBroadcasterStreak(pool,'streamer');
    const initial=(await db.query('SELECT points,pending_xp FROM users WHERE id=1')).rows[0];
    assert.equal((await db.query('SELECT COUNT(*)::int total FROM user_watch_streak_rewards')).rows[0].total,0,'Initialiser 200 lives ne distribue pas de cadeau');
    for(let day=1;day<=4;day++){
      assert.equal(await registerBroadcasterLive(pool,'streamer',new Date(Date.UTC(2026,10,day,18))),true);
      const state=(await db.query("SELECT count FROM broadcaster_watch_streak WHERE twitch_id='streamer'")).rows[0];
      assert.equal(state.count,200+day);
      const interim=(await db.query('SELECT points,pending_xp FROM users WHERE id=1')).rows[0];
      assert.deepEqual(interim,initial);
      const claimed=(await db.query('SELECT count(*)::int total FROM user_watch_streak_rewards WHERE milestone>200')).rows[0];
      assert.equal(claimed.total,0);
    }
    const nextLive=new Date(Date.UTC(2026,10,5,18));
    assert.equal(await registerBroadcasterLive(pool,'streamer',nextLive),true);
    assert.equal((await db.query("SELECT count FROM broadcaster_watch_streak WHERE twitch_id='streamer'")).rows[0].count,205);
    assert.equal((await db.query('SELECT count(*)::int total FROM user_watch_streak_rewards WHERE milestone=205')).rows[0].total,0);
    assert.equal(await registerBroadcasterLive(pool,'streamer',nextLive),false);
    assert.deepEqual((await db.query('SELECT points,pending_xp FROM users WHERE id=1')).rows[0],initial);
    await initBroadcasterStreak(pool,'streamer');
    assert.equal((await db.query('SELECT count(*)::int total FROM user_watch_streak_rewards WHERE milestone=205')).rows[0].total,0);
  }finally{await db.close();}
});
