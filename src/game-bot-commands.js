import {renderBotMessage} from './game-bot-messages.js';
import {playerCommands,renderPlayerCommand} from './game-bot-player-commands.js';

export function chatCommandName(text){
  const name=String(text||'').trim().split(/\s+/,1)[0].toLowerCase();
  return /^![a-z0-9_]{1,30}$/.test(name)?name:null;
}
export function validateChatCommand(body,kind='custom'){
  const name=String(body?.name||'').trim().toLowerCase();
  if(!/^![a-z0-9_]{1,30}$/.test(name))throw Error('Commande : ! suivi de 1 à 30 lettres, chiffres ou underscores.');
  if(name==='!catch')throw Error('!catch est réservé aux drops du jeu.');
  const definition=playerCommands[kind];
  if(definition&&name!==definition.name)throw Error('Le nom de cette commande du jeu est fixe.');
  if(!definition&&Object.values(playerCommands).some(c=>c.name===name))throw Error('Cette commande existe dans les commandes du jeu. Modifie-la depuis sa carte.');
  const text=body?.text;
  if(typeof text!=='string'||!text.trim()||text.trim().length>400||/[\r\n\x00-\x1f]/.test(text))throw Error('Écris une réponse sur une seule ligne, de 1 à 400 caractères.');
  const variables=definition?.variables||['joueur'];
  const rest=text.replace(/\{([a-z]+)\}/g,(_,key)=>{if(!variables.includes(key))throw Error(`Variable inconnue : {${key}}.`);return '';});
  if(/[{}]/.test(rest))throw Error('Vérifie les variables du message.');
  renderBotMessage(text,{joueur:'@'+'x'.repeat(25),niveau:'55',prestige:'999',cash:'999 999 999',lien:'https://loverwatchgame.fr/',oeufs:'x'.repeat(180),prets:'3',position:'hors classement (diffuseur)',podium:'x'.repeat(95)});
  const cooldownSeconds=Number(body.cooldownSeconds);
  if(!Number.isInteger(cooldownSeconds)||cooldownSeconds<5||cooldownSeconds>3600)throw Error('Choisis un délai entier de 5 à 3600 secondes.');
  if(typeof body.enabled!=='boolean')throw Error('Choisis si la commande est activée.');
  const id=body.id==null?null:Number(body.id);
  if(id!==null&&(!Number.isSafeInteger(id)||id<1))throw Error('Commande introuvable.');
  return {id,name,text:text.trim(),cooldownSeconds,enabled:body.enabled};
}
export async function initChatCommands(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_commands (
    id BIGSERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL,text TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,cooldown_seconds INTEGER NOT NULL DEFAULT 30 CHECK(cooldown_seconds BETWEEN 5 AND 3600),
    last_used_at TIMESTAMPTZ,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query("ALTER TABLE game_bot_commands ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'custom'");
  for(const [kind,c] of Object.entries(playerCommands))await pool.query(`INSERT INTO game_bot_commands(name,text,kind,cooldown_seconds) VALUES($1,$2,$3,10)
    ON CONFLICT(name) DO UPDATE SET kind=EXCLUDED.kind WHERE game_bot_commands.kind='custom'`,[c.name,c.text,kind]);
  await pool.query('ALTER TABLE game_bot_auth ADD COLUMN IF NOT EXISTS command_last_used_at TIMESTAMPTZ');
  await pool.query(`CREATE TABLE IF NOT EXISTS game_bot_command_queue (
    event_id TEXT PRIMARY KEY,command_id BIGINT NOT NULL REFERENCES game_bot_commands(id) ON DELETE CASCADE,
    message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query('ALTER TABLE game_bot_command_queue ADD COLUMN IF NOT EXISTS twitch_id TEXT, ADD COLUMN IF NOT EXISTS login TEXT');
}
// Called within the EventSub deduplication transaction. No Twitch call delays the webhook.
export async function enqueueChatCommand(client,name,event,eventId){
  const command=(await client.query(`SELECT * FROM game_bot_commands WHERE name=$1 AND enabled=TRUE
    AND (last_used_at IS NULL OR last_used_at<=CURRENT_TIMESTAMP-cooldown_seconds*INTERVAL '1 second') FOR UPDATE`,[name])).rows[0];
  if(!command)return;
  // One accepted command per three seconds across all viewers and all commands.
  const slot=await client.query(`UPDATE game_bot_auth SET command_last_used_at=CURRENT_TIMESTAMP WHERE id=1 AND enabled=TRUE
    AND (command_last_used_at IS NULL OR command_last_used_at<=CURRENT_TIMESTAMP-INTERVAL '3 seconds') RETURNING id`);
  if(!slot.rowCount)return;
  const joueur='@'+String(event.chatter_user_login||'joueur').replace(/[^a-zA-Z0-9_]/g,'');
  await client.query('INSERT INTO game_bot_command_queue(event_id,command_id,message,twitch_id,login) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[eventId,command.id,command.kind==='custom'?renderBotMessage(command.text,{joueur}):command.text,event.chatter_user_id,event.chatter_user_login]);
  await client.query('UPDATE game_bot_commands SET last_used_at=CURRENT_TIMESTAMP WHERE id=$1',[command.id]);
}
export async function deliverChatCommands(pool,send,options={}){
  await pool.query("DELETE FROM game_bot_command_queue WHERE created_at<CURRENT_TIMESTAMP-INTERVAL '2 minutes'");
  const rows=(await pool.query(`SELECT q.event_id,q.message,q.twitch_id,q.login,c.kind,c.text FROM game_bot_command_queue q
    JOIN game_bot_commands c ON c.id=q.command_id WHERE c.enabled=TRUE ORDER BY q.created_at,q.event_id LIMIT 1`)).rows;
  for(const row of rows){
    const message=row.kind==='custom'?row.message:await renderPlayerCommand(pool,row,{twitchId:row.twitch_id,login:row.login},options);
    try{await send(message,'command');}catch{/* send records the refusal; one failed reply must not block egg alerts. */}
    await pool.query('DELETE FROM game_bot_command_queue WHERE event_id=$1',[row.event_id]);
  }
}
