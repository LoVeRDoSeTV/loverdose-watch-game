import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {botMessageTemplates,validateBotMessage,renderBotMessage} from '../src/game-bot-messages.js';
import {createGameBot} from '../src/routes/game-bot.js';

test('les modèles conservent les informations utiles et remplacent les variables une seule fois',()=>{
  for(const [key,item] of Object.entries(botMessageTemplates))assert.equal(validateBotMessage(key,item.text),item.text);
  assert.equal(renderBotMessage('Bravo {gagnants}, {recompense} !',{gagnants:'@Alice',recompense:'100 XP'}),'Bravo @Alice, 100 XP !');
  assert.equal(renderBotMessage('{joueur}',{joueur:'{recompense}'}),'{recompense}');
  for(const text of ['', 'x'.repeat(401),'Deux\nlignes','Inconnue {token}','Une {variable','Texte\u0000'])assert.throws(()=>validateBotMessage('',text));
  assert.throws(()=>validateBotMessage('drop','Un drop !catch'));
  assert.throws(()=>validateBotMessage('drop','Un drop {recompense}'));
  assert.throws(()=>renderBotMessage('{gagnants}',{gagnants:'x'.repeat(501)}));
});

test('les routes enregistrent, modifient et réinitialisent sans envoyer un message',async()=>{
  const db=new PGlite();await db.exec('CREATE TABLE game_bot_message_templates(key TEXT PRIMARY KEY,label TEXT NOT NULL,text TEXT NOT NULL,updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)');
  const bot=createGameBot({pool:db,baseUrl:'https://example.com',getBroadcasterAccount:async req=>req.allowed});
  const invoke=async(path,body,allowed=true)=>{const handler=bot.router.stack.find(layer=>layer.route?.path===path).route.stack[0].handle;let status=200,data;const res={status(n){status=n;return this;},sendStatus(n){status=n;},json(value){data=value;}};await handler({body,allowed},res);return {status,data};};
  try{
    const path='/admin/game-bot/messages';
    assert.equal((await invoke(path,{key:'egg',text:'🥚 {joueur}, à toi de découvrir ton Lovys !'})).status,200);
    assert.equal((await db.query('SELECT text FROM game_bot_message_templates WHERE key=$1',['egg'])).rows[0].text,'🥚 {joueur}, à toi de découvrir ton Lovys !');
    assert.equal((await invoke(path,{key:'egg',text:'Sans le joueur'})).status,400);
    assert.equal((await invoke(path,{key:'',label:'Rappel du jeu',text:'Retrouve les Lovys sur notre site !'})).status,200);
    const custom=(await db.query("SELECT * FROM game_bot_message_templates WHERE key LIKE 'custom-%'")).rows[0];
    assert.ok(custom.key.startsWith('custom-'));
    assert.equal((await invoke(path,{key:custom.key,label:'Nouveau titre',text:'Nouveau message'})).status,200);
    for(const suffix of ['', '/reset','/send'])assert.equal((await invoke(path+suffix,{key:custom.key,text:'Interdit'},false)).status,403);
    assert.equal((await invoke(path+'/send',{key:'egg'})).status,400);
    assert.equal((await invoke(path+'/reset',{key:'egg'})).status,200);
    assert.equal((await db.query('SELECT * FROM game_bot_message_templates WHERE key=$1',['egg'])).rows.length,0);
    await invoke(path+'/reset',{key:custom.key});
    assert.equal((await db.query('SELECT * FROM game_bot_message_templates')).rows.length,0);
  }finally{await db.close();}
});
