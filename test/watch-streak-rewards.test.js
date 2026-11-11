import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {WATCH_STREAK_REWARDS,grantSharedWatchStreak,initWatchStreakRewards} from '../src/watch-streak-rewards.js';
import {createGameBot} from '../src/routes/game-bot.js';

test('un partage Twitch crédite son palier une seule fois, à un compte lié',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE accounts(id integer PRIMARY KEY,twitch_id text UNIQUE);
      CREATE TABLE users(id integer PRIMARY KEY,twitch_id text UNIQUE,points double precision DEFAULT 0,
        lifetime_lovercash_earned double precision DEFAULT 0,egg_fragments integer DEFAULT 0,
        xp double precision DEFAULT 0,pending_xp double precision DEFAULT 0,updated_at timestamptz DEFAULT now());
      CREATE TABLE user_lovys(id integer PRIMARY KEY,user_id integer,creature_id text,xp double precision DEFAULT 0,
        is_active boolean DEFAULT false,updated_at timestamptz DEFAULT now());
      CREATE TABLE shop_inventory(account_id integer,item_key text,quantity integer DEFAULT 1,
        purchased_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,item_key));
      INSERT INTO accounts VALUES(1,'viewer');
      INSERT INTO users(id,twitch_id) VALUES(1,'viewer');
      INSERT INTO user_lovys(id,user_id,creature_id,is_active) VALUES(1,1,'mossy',true);`);
    await initWatchStreakRewards(db);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'unknown',count:3,messageId:'a'}),false);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'viewer',count:351,messageId:'b'}),false);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'viewer',count:3,messageId:'c'}),true);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'viewer',count:3,messageId:'d'}),false);
    assert.equal((await db.query('SELECT points FROM users WHERE id=1')).rows[0].points,10);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'viewer',count:5,messageId:'e'}),true);
    // Les récompenses de série Twitch sont mises en banque, pas sur le Lovys actif.
    assert.equal((await db.query('SELECT xp FROM user_lovys WHERE id=1')).rows[0].xp,0);
    assert.equal((await db.query('SELECT xp,pending_xp FROM users WHERE id=1')).rows[0].xp,0);
    assert.equal((await db.query('SELECT pending_xp FROM users WHERE id=1')).rows[0].pending_xp,50);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'viewer',count:10,messageId:'f'}),true);
    assert.equal((await db.query("SELECT quantity FROM shop_inventory WHERE item_key='mystery_egg'")).rows[0].quantity,1);
    // Partager 10 lives valide aussi le palier 7 encore non réclamé.
    assert.equal((await db.query('SELECT count(*)::int total FROM user_watch_streak_rewards')).rows[0].total,4);
    assert.equal(await grantSharedWatchStreak(db,{twitchId:'viewer',count:4,messageId:'other'}),true);
    assert.equal((await db.query('SELECT points FROM users WHERE id=1')).rows[0].points,30);
    assert.equal((await db.query('SELECT xp FROM user_lovys WHERE id=1')).rows[0].xp,0);
    assert.equal((await db.query('SELECT pending_xp FROM users WHERE id=1')).rows[0].pending_xp,75);
  }finally{await db.close();}
});

test('la série Twitch crédite la réserve XP sans changer le Lovys et donne le boost final',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE accounts(id integer PRIMARY KEY,twitch_id text UNIQUE);
      CREATE TABLE users(id integer PRIMARY KEY,twitch_id text UNIQUE,points double precision DEFAULT 0,
        lifetime_lovercash_earned double precision DEFAULT 0,egg_fragments integer DEFAULT 0,
        xp double precision DEFAULT 0,pending_xp double precision DEFAULT 0,updated_at timestamptz DEFAULT now());
      CREATE TABLE user_lovys(id integer PRIMARY KEY,user_id integer,creature_id text,xp double precision DEFAULT 0,
        is_active boolean DEFAULT false,updated_at timestamptz DEFAULT now());
      CREATE TABLE shop_inventory(account_id integer,item_key text,quantity integer DEFAULT 1,
        purchased_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,item_key));
      INSERT INTO accounts VALUES(1,'viewer');
      INSERT INTO users(id,twitch_id,xp) VALUES(1,'viewer',24980);
      INSERT INTO user_lovys(id,user_id,creature_id,xp,is_active) VALUES(1,1,'mossy',24980,true);`);
    await initWatchStreakRewards(db);
    await grantSharedWatchStreak(db,{twitchId:'viewer',count:5,messageId:'xp'});
    const user=(await db.query('SELECT xp,pending_xp FROM users WHERE id=1')).rows[0];
    assert.equal(user.xp,24980);assert.equal(user.pending_xp,50);
    await grantSharedWatchStreak(db,{twitchId:'viewer',count:350,messageId:'final'});
    const inventory=(await db.query('SELECT item_key FROM shop_inventory ORDER BY item_key')).rows.map(row=>row.item_key);
    assert.ok(inventory.includes('boost_xp_x2'));
    assert.ok(inventory.includes('streak_avatarframe_350'));
    assert.equal((await db.query("SELECT quantity FROM shop_inventory WHERE item_key='boost_xp_x2'")).rows[0].quantity,1);
    assert.equal((await db.query('SELECT xp FROM user_lovys WHERE id=1')).rows[0].xp,24980);
    assert.equal(WATCH_STREAK_REWARDS.at(-1).count,350);
  }finally{await db.close();}
});

test('le webhook n’accorde un cadeau que pour une notification de série Twitch signée',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE accounts(id integer PRIMARY KEY,twitch_id text UNIQUE);
      CREATE TABLE users(id integer PRIMARY KEY,twitch_id text UNIQUE,points double precision DEFAULT 0,
        lifetime_lovercash_earned double precision DEFAULT 0,egg_fragments integer DEFAULT 0,
        xp double precision DEFAULT 0,pending_xp double precision DEFAULT 0,updated_at timestamptz DEFAULT now());
      CREATE TABLE user_lovys(id integer PRIMARY KEY,user_id integer,creature_id text,xp double precision DEFAULT 0,
        is_active boolean DEFAULT false,updated_at timestamptz DEFAULT now());
      CREATE TABLE shop_inventory(account_id integer,item_key text,quantity integer DEFAULT 1,
        purchased_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,item_key));
      CREATE TABLE game_bot_event_ids(id text PRIMARY KEY);
      CREATE TABLE game_bot_auth(id integer PRIMARY KEY,webhook_secret text,streak_subscription_id text,twitch_user_id text,enabled boolean);
      INSERT INTO accounts VALUES(1,'viewer'); INSERT INTO users(id,twitch_id) VALUES(1,'viewer');
      INSERT INTO game_bot_auth VALUES(1,'test-secret','streak-sub','bot',true);`);
    await initWatchStreakRewards(db);
    const pool={query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
    const shared={subscription:{type:'channel.chat.notification',id:'streak-sub'},event:{broadcaster_user_id:'channel',chatter_user_id:'viewer',notice_type:'watch_streak',watch_streak:{streak_count:3}}};
    const previous=process.env.TWITCH_BROADCASTER_ID;
    // createGameBot reads the broadcaster ID when constructed; rebuild after setting it.
    process.env.TWITCH_BROADCASTER_ID='channel';
    const activeBot=createGameBot({pool,baseUrl:'https://example.com'});
    const activeHandler=activeBot.router.stack.find(layer=>layer.route?.path==='/game-bot/eventsub').route.stack[0].handle;
    try{
      const invoke=async(body,valid=true)=>{
        const raw=Buffer.from(JSON.stringify(body)),timestamp=new Date().toISOString(),id=crypto.randomUUID();
        const signature='sha256='+crypto.createHmac('sha256','test-secret').update(id+timestamp).update(raw).digest('hex');
        let status;
        await activeHandler({body,rawEventSubBody:raw,headers:{'twitch-eventsub-message-type':'notification','twitch-eventsub-message-id':id,'twitch-eventsub-message-timestamp':timestamp,'twitch-eventsub-message-signature':valid?signature:'sha256=bad'}},{sendStatus(code){status=code;return this;}});
        return status;
      };
      assert.equal(await invoke(shared,false),403);
      assert.equal(await invoke({...shared,event:{...shared.event,notice_type:'announcement'}}),204);
      assert.equal(await invoke({...shared,subscription:{...shared.subscription,id:'foreign-sub'}}),204);
      assert.equal((await db.query('SELECT COUNT(*)::int count FROM user_watch_streak_rewards')).rows[0].count,0);
      assert.equal(await invoke(shared),204);
      assert.equal((await db.query('SELECT points FROM users WHERE id=1')).rows[0].points,10);
    }finally{if(previous===undefined)delete process.env.TWITCH_BROADCASTER_ID;else process.env.TWITCH_BROADCASTER_ID=previous;}
  }finally{await db.close();}
});

test('la félicitation attend le retour du joueur et ne peut être acquittée que par son compte',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE accounts(id integer PRIMARY KEY,twitch_id text UNIQUE);
      CREATE TABLE users(id integer PRIMARY KEY,twitch_id text UNIQUE,points double precision DEFAULT 0,
        lifetime_lovercash_earned double precision DEFAULT 0,egg_fragments integer DEFAULT 0,
        xp double precision DEFAULT 0,pending_xp double precision DEFAULT 0,updated_at timestamptz DEFAULT now());
      CREATE TABLE user_lovys(id integer PRIMARY KEY,user_id integer,xp double precision DEFAULT 0,
        is_active boolean DEFAULT false,updated_at timestamptz DEFAULT now());
      CREATE TABLE shop_inventory(account_id integer,item_key text,quantity integer DEFAULT 1,
        purchased_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,item_key));
      INSERT INTO accounts VALUES(1,'viewer'),(2,'other');
      INSERT INTO users(id,twitch_id) VALUES(1,'viewer'),(2,'other');`);
    await initWatchStreakRewards(db);
    await grantSharedWatchStreak(db,{twitchId:'viewer',count:3,messageId:'first-share'});
    const bot=createGameBot({pool:db,baseUrl:'https://example.com'});
    const handler=path=>bot.router.stack.find(layer=>layer.route?.path===path).route.stack[0].handle;
    const response=()=>({set(){return this;},json(value){this.body=value;return this;},sendStatus(code){this.status=code;return this;}});
    const pending=handler('/watch-streak/notifications/pending');
    const ack=handler('/watch-streak/notifications/acknowledge');
    const before=response();await pending({session:{account:{id:1}}},before);
    assert.deepEqual(before.body.rewards,[{count:3,description:'10 LoVeR’Cash'}]);
    await ack({session:{account:{id:2}},body:{count:3}},response());
    const stillPending=response();await pending({session:{account:{id:1}}},stillPending);
    assert.equal(stillPending.body.rewards.length,1);
    const confirmed=response();await ack({session:{account:{id:1}},body:{count:3}},confirmed);
    assert.equal(confirmed.body.acknowledged,1);
    const after=response();await pending({session:{account:{id:1}}},after);
    assert.deepEqual(after.body.rewards,[]);
  }finally{await db.close();}
});
