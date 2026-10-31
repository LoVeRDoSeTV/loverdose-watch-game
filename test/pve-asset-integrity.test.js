import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PVE_ZONES,PVE_FIGHTS} from '../src/combat/zones.js';

test('all 100 PvE monster image assets remain present and unchanged in format',()=>{
  assert.equal(PVE_FIGHTS.length,100);
  const folder=new URL('../public/pve/',import.meta.url);
  const files=fs.readdirSync(folder,{recursive:true}).filter(name=>String(name).endsWith('.webp'));
  assert.equal(files.length,100);
  for(const asset of files){
    const bytes=fs.readFileSync(new URL(String(asset).replaceAll('\\','/'),folder));
    assert.equal(bytes.subarray(0,4).toString(),'RIFF',asset);
    assert.equal(bytes.subarray(8,12).toString(),'WEBP',asset);
  }
});
test('all ten PvE campaign zones retain complete encounters and boss landmarks',()=>{
  assert.equal(PVE_ZONES.length,10);
  for(const zone of PVE_ZONES){
    assert.equal(zone.fights.length,10,zone.key);
    assert.equal(zone.fights.filter(f=>f.miniBoss).length,1,zone.key);
    assert.equal(zone.fights.filter(f=>f.finalBoss).length,1,zone.key);
  }
});
