const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');const fs=require('node:fs'),assert=require('node:assert/strict');const {plan}=require('./direction.test.cjs');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.com/deos/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.indexedDB=new IDBFactory();w.fetch=async()=>({ok:true,json:async()=>[]});w.structuredClone=structuredClone;w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};w.console={...console,log:()=>{},info:()=>{},warn:()=>{}};
for(const [e,items] of Object.entries(plan.data))w.localStorage.setItem('deos_'+(e==='actionPlans'?'action_plans':e),JSON.stringify(items));
w.localStorage.setItem('deos_settings',JSON.stringify({remoteSync:{enabled:false}}));w.DEOS_REMOTE_CONFIG={enabled:false};
for(const file of ['tools/codir-transform.js','tools/codir-project-assignments.js','tools/direction-plan.js','tools/direction-release.js','supabase-client.js','remote-adapter.js','app.js'])w.eval(fs.readFileSync(file,'utf8'));
setTimeout(()=>{try{
 const nav=w.document.querySelector('[data-view="directionCommitments"]');assert(nav);nav.click();let text=w.document.getElementById('app').textContent;assert(text.includes('0 / 11'));assert(text.includes('Finaliser le benchmark'));assert(text.includes('Échéance : À définir'));
 const a=plan.data.actions.find(a=>a.directionCommitments?.some(x=>x.number===3));w.openAction(a.id);assert(w.document.body.textContent.includes(a.title));w.toggleAction(a.id);w.setView('directionCommitments');assert(w.document.getElementById('app').textContent.includes('1 / 11'));
 w.setView('folders');for(const name of Object.keys(w.DeosCodir.targets))assert(w.document.getElementById('app').textContent.includes(name));
 assert(!w.DeosTest,'Production must not use the isolated TEST runtime');assert(w.document.getElementById('brandVersion').textContent.includes('D27'));
 console.log('PASS: navigation intégrée, 11 objectifs issus des actions, ouverture/modification native, statut actualisé, six dossiers et absence du stockage TEST en PROD.');
 }catch(e){console.error(e);process.exitCode=1}finally{w.close();}},500);
