import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PVE_ZONES} from '../src/combat/zones.js';
for(const file of ['app.js','app.min.js']){
 const source=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
 const helpers=source.slice(source.indexOf('function pveAtlasMarkup('),source.indexOf('function pveWorldSceneryMarkup('));
 function setup(desktop=true){
  const dialog={open:false,opens:0,closes:0,showModal(){this.open=true;this.opens++;},close(){this.open=false;this.closes++;}};
  const c=vm.createContext({isDesktopGameUi:()=>desktop,pveZoneAccessible:()=>true,pveZoneComplete:()=>false,escapeHtml:s=>String(s??''),$:id=>id==='pveAtlasDialog'?dialog:null});
  vm.runInContext(helpers,c);return {c,dialog};
 }
 test(`${file}: all ten desktop zones appear inside a labelled dialog, outside the inline details list`,()=>{
  const {c}=setup(),html=c.pveAtlasMarkup({zones:PVE_ZONES});
  assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/<dialog[^>]+aria-labelledby="pveAtlasTitle"/);
  const content=html.slice(html.indexOf('<dialog'));
  assert.equal((content.match(/class="pve-atlas-zone /g)||[]).length,10);assert.doesNotMatch(html,/<details/);assert.match(content,/data-pve-atlas-close/);
 });
 test(`${file}: touch devices retain the collapsible atlas`,()=>{
  const {c}=setup(false),html=c.pveAtlasMarkup({zones:PVE_ZONES});
  assert.match(html,/<details class="pve-world-atlas">/);assert.doesNotMatch(html,/<dialog/);assert.equal((html.match(/class="pve-atlas-zone /g)||[]).length,10);
 });
 test(`${file}: atlas opens once and closes with its close button or backdrop`,()=>{
  const {c,dialog}=setup(),event=(selector,backdrop=false)=>({target:{closest:s=>s===selector,matches:()=>backdrop}});
  assert.equal(c.handlePveAtlasClick(event('[data-pve-atlas-open]')),true);assert.equal(dialog.open,true);
  c.handlePveAtlasClick(event('[data-pve-atlas-open]'));assert.equal(dialog.opens,1);
  assert.equal(c.handlePveAtlasClick(event('[data-pve-atlas-close]')),true);assert.equal(dialog.open,false);
  c.handlePveAtlasClick(event('[data-pve-atlas-open]'));c.handlePveAtlasClick(event('',true));assert.equal(dialog.open,false);assert.equal(dialog.closes,2);
  assert.equal(c.handlePveAtlasClick(event('')),false);
 });
}
