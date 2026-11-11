import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
function snippet(start,end){
  const a=server.indexOf(start),b=server.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Route ou fonction manquante : '+start);
  return server.slice(a,b);
}
const normalizeTradeAsset=new Function('creatures','TRADE_MAX_QUANTITY',
  snippet('function normalizeTradeAsset(','async function tradeContext(')+'return normalizeTradeAsset;'
)([{id:'mossy'}],999);
const {tradeAssetBalance,changeTradeAsset}=new Function('tradeCreatureName',
  snippet('async function tradeAssetBalance(','async function restoreExpiredTrades(')+
  'return {tradeAssetBalance,changeTradeAsset};'
)(id=>id);

async function fixture(){
  const db=new PGlite();
  await db.exec(`
    CREATE TABLE shop_inventory(
      account_id integer,item_key text,quantity integer NOT NULL DEFAULT 0,
      purchased_at timestamptz DEFAULT now(),PRIMARY KEY(account_id,item_key));
    CREATE TABLE user_lovys(user_id integer,creature_id text,fragments integer DEFAULT 0,
      updated_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,creature_id));
    CREATE TABLE trade_offers(
      id bigserial PRIMARY KEY,creator_user_id integer NOT NULL,creator_account_id integer NOT NULL,
      offer_type text NOT NULL,offer_creature_id text,offer_quantity integer NOT NULL,
      status text DEFAULT 'open',expires_at timestamptz NOT NULL,updated_at timestamptz DEFAULT now());
    CREATE TABLE trade_offer_options(
      id bigserial PRIMARY KEY,offer_id bigint,receive_type text,
      receive_creature_id text,receive_quantity integer,position integer);
    INSERT INTO shop_inventory(account_id,item_key,quantity) VALUES(1,'mystery_egg',1);
    INSERT INTO user_lovys(user_id,creature_id,fragments) VALUES(10,'mossy',0);
    INSERT INTO trade_offers(creator_user_id,creator_account_id,offer_type,offer_quantity,expires_at)
      VALUES(10,1,'egg',2,CURRENT_TIMESTAMP+INTERVAL '3 days');
    INSERT INTO trade_offer_options(offer_id,receive_type,receive_quantity,position)
      VALUES(1,'xp_bottle',1,1);
  `);
  const pool={connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
  let handler,liveUpdates=0;
  const app={post:(name,rate,fn)=>{if(name==='/api/trades/:offerId/edit')handler=fn;}};
  new Function('app','tradeWriteRateLimit','normalizeTradeAsset','TRADE_MAX_OPTIONS','pool',
    'restoreExpiredTrades','tradeContext','tradeAssetBalance','tradeCreatureName',
    'changeTradeAsset','pushLiveUpdate',
    snippet("app.post('/api/trades/:offerId/edit'","app.post('/api/trades/:offerId/accept'")
  )(app,()=>{},normalizeTradeAsset,3,pool,async()=>{},
    async(client,req)=>({userId:req.session.user.id,accountId:req.session.account.id}),
    tradeAssetBalance,id=>id,changeTradeAsset,()=>{liveUpdates++;});
  assert.equal(typeof handler,'function');
  const request=async(offer,options,userId=10)=>{
    const req={params:{offerId:'1'},session:{user:{id:userId},account:{id:userId===10?1:2}},
      body:{offer,options}};
    const res={statusCode:200,status(code){this.statusCode=code;return this;},
      json(value){this.body=value;return this;}};
    await handler(req,res);
    return res;
  };
  return {db,request,updates:()=>liveUpdates};
}

test('modification conserve ID et expiration, adapte les objets réservés',async()=>{
  const {db,request,updates}=await fixture();
  try{
    const before=(await db.query('SELECT expires_at FROM trade_offers WHERE id=1')).rows[0].expires_at;
    const r=await request({type:'egg',quantity:3},[
      {type:'xp_bottle',quantity:2},{type:'xp_gourd',quantity:1}
    ]);
    assert.equal(r.statusCode,200);
    assert.equal(r.body.offerId,1);
    assert.equal(updates(),1);
    const after=(await db.query('SELECT offer_quantity,expires_at,status FROM trade_offers WHERE id=1')).rows[0];
    assert.equal(after.offer_quantity,3);assert.equal(after.status,'open');
    assert.equal(new Date(after.expires_at).getTime(),new Date(before).getTime());
    assert.equal((await db.query("SELECT quantity FROM shop_inventory WHERE account_id=1 AND item_key='mystery_egg'")).rows[0].quantity,0);
    assert.deepEqual((await db.query('SELECT receive_type,receive_quantity FROM trade_offer_options WHERE offer_id=1 ORDER BY position')).rows.map(r=>[r.receive_type,r.receive_quantity]),
      [['xp_bottle',2],['xp_gourd',1]]);
  }finally{await db.close();}
});

test('stock insuffisant ou autre propriétaire : aucun changement ni perte',async()=>{
  const {db,request,updates}=await fixture();
  try{
    const unauthorized=await request({type:'egg',quantity:1},[{type:'xp_bottle',quantity:2}],999);
    assert.equal(unauthorized.statusCode,400);
    const fail=await request({type:'xp_bottle',quantity:5},[{type:'egg',quantity:1}]);
    assert.equal(fail.statusCode,400);
    assert.equal(updates(),0);
    assert.equal((await db.query('SELECT offer_quantity FROM trade_offers WHERE id=1')).rows[0].offer_quantity,2);
    assert.equal((await db.query("SELECT quantity FROM shop_inventory WHERE account_id=1 AND item_key='mystery_egg'")).rows[0].quantity,1);
    assert.equal((await db.query('SELECT receive_quantity FROM trade_offer_options WHERE offer_id=1')).rows[0].receive_quantity,1);
    await db.query("UPDATE trade_offers SET status='completed' WHERE id=1");
    const completed=await request({type:'egg',quantity:1},[{type:'xp_bottle',quantity:1}]);
    assert.equal(completed.statusCode,400);
  }finally{await db.close();}
});

test('montants invalides et contreparties répétées refusés',async()=>{
  const {db,request}=await fixture();
  try{
    assert.equal((await request({type:'egg',quantity:0},[{type:'xp_bottle',quantity:1}])).statusCode,400);
    assert.equal((await request({type:'egg',quantity:1},[
      {type:'xp_bottle',quantity:1},{type:'xp_bottle',quantity:1}
    ])).statusCode,400);
    assert.equal((await request({type:'egg',quantity:1},[{type:'egg',quantity:1}])).statusCode,400);
  }finally{await db.close();}
});

test('interface Mes offres présente le bouton et conserve les quantités réservées',()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const bundle=readFileSync(new URL('../public/app.min.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  for(const js of [source,bundle]){
    assert.ok(js.includes('data-trade-edit'),'Bouton Modifier sur les offres ouvertes');
    assert.ok(js.includes("openTradeComposer('',offer)"),'Ouverture de l’annonce existante');
    assert.ok(js.includes('tradeComposerAvailableBalance(stockOffer)'),'Réservation déjà engagée réutilisable');
    assert.ok(js.includes("editingTradeOffer.options[index]"),'Contreparties préremplies');
    assert.ok(js.includes("payload.offerId?'/api/trades/'+payload.offerId+'/edit'"),'Enregistrement sur l’annonce existante');
  }
  assert.ok(html.includes('trade-offer-edit.css?v=1'));
  assert.ok(html.includes('app.min.js?v=649'));
});
