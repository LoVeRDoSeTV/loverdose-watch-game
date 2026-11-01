import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const context=vm.createContext({escapeHtml:v=>String(v)});
vm.runInContext(source.slice(source.indexOf('function adminPlayerTwitchLink('),source.indexOf('function renderAdminPlayers(')),context);
test('admin channel links use a validated Twitch login, never a supplied URL or display name',()=>{
 const link=context.adminPlayerTwitchLink({twitchLogin:'LoVeRMiyu',username:'someone else'});
 assert.match(link,/href="https:\/\/www\.twitch\.tv\/LoVeRMiyu"/);
 assert.match(link,/rel="noopener noreferrer"/);
 for(const login of ['',null,'https://evil.example','"><img src=x>','../other','name?x=1'])assert.equal(context.adminPlayerTwitchLink({twitchLogin:login}),'Twitch non lié');
});
