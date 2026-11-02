import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {createLoginRateLimits} from '../src/middleware/security.js';

async function fixture(t){
 const app=express();app.use(express.json());app.set('trust proxy',1);
 app.post('/login',createLoginRateLimits(),(req,res)=>res.status(req.body.result||401).json({ok:req.body.result===200}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 return (email,result=401,ip='192.0.2.1')=>fetch(`http://127.0.0.1:${server.address().port}/login`,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':ip},body:JSON.stringify({email,result})});
}
test('ten wrong logins block only that identifier on that connection, with an explicit retry delay',async t=>{
 const request=await fixture(t);
 for(let i=0;i<10;i++)assert.equal((await request(i%2?' PLAYER ':'player')).status,401);
 const blocked=await request('PLAYER');assert.equal(blocked.status,429);const data=await blocked.json();assert.ok(data.retryAfterSeconds>0&&data.retryAfterSeconds<=900);assert.equal(blocked.headers.get('Retry-After'),String(data.retryAfterSeconds));
 assert.equal((await request('another-player',200)).status,200);
 assert.equal((await request('player',200,'192.0.2.2')).status,200);
});
test('successful connections and technical failures do not consume wrong-password attempts',async t=>{
 const request=await fixture(t);
 for(let i=0;i<12;i++){assert.equal((await request('player',200)).status,200);assert.equal((await request('player',500)).status,500);}
 for(let i=0;i<10;i++)assert.equal((await request('player')).status,401);
 assert.equal((await request('player')).status,429);
});
test('rotating identifiers still hits the shared connection safeguard',async t=>{
 const request=await fixture(t);
 for(let i=0;i<60;i++)assert.equal((await request('player-'+i)).status,401);
 assert.equal((await request('new-player')).status,429);
});
