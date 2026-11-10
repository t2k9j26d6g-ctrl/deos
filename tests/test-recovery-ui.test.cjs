const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb'),{webcrypto}=require('node:crypto');const fs=require('node:fs'),assert=require('node:assert/strict');const {plan}=require('./direction.test.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
let liveWindow;
async function main(){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.com/deos/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 liveWindow=w;Object.defineProperty(w,'crypto',{value:webcrypto});w.indexedDB=new IDBFactory();w.TextEncoder=TextEncoder;w.AbortController=AbortController;w.structuredClone=structuredClone;w.fetch=async()=>({ok:true,json:async()=>[]});w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};w.console={...console,log:()=>{},info:()=>{},warn:()=>{}};w.DEOS_REMOTE_CONFIG={enabled:false};
 const prod=clone(plan.data),base=clone(prod);base.folders=base.folders.filter(f=>!f.archived);const test=clone(base);test.actions[0].notes='Saisie TEST à récupérer';test.journal.push({id:'journal-from-test',summary:'Note TEST conservée',processed:false});
 for(const [e,items] of Object.entries(prod))w.localStorage.setItem('deos_'+(e==='actionPlans'?'action_plans':e),JSON.stringify(items));w.localStorage.setItem('deos_settings',JSON.stringify({remoteSync:{enabled:false}}));
 await new Promise((resolve,reject)=>{const r=w.indexedDB.open('deos-codir-test',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots');s.put({ready:true,values:Object.fromEntries(Object.entries(test).map(([e,v])=>['deos_'+(e==='actionPlans'?'action_plans':e),JSON.stringify(v)]))},'deos_codir_test_v1');s.put({source:base},'deos_codir_test_source_v1');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};});
 for(const file of ['tools/codir-transform.js','tools/codir-project-assignments.js','tools/direction-plan.js','tools/direction-release.js','tools/test-recovery.js','supabase-client.js','remote-adapter.js'])w.eval(fs.readFileSync(file,'utf8'));
 w.eval(fs.readFileSync('app.js','utf8')+`
window.__recoveryTest={state:()=>state,ready:()=>deosDirectionReleaseReady,configure(api){createDirectionReleaseTransport=()=>api;syncAllMultiDeviceNow=async()=>({lastError:''});deosRemoteAuthService={isAuthenticated:()=>true};deosRemoteRuntime.workspace={id:'workspace'};deosDirectionReleaseReady=false;}};`);
 await new Promise(r=>setTimeout(r,100));
 const db=Object.fromEntries(w.DeosDirectionRelease.ENTITIES.map(e=>[e,clone(prod[e]||[]).map(item=>({item,version:1}))]));db.documents.push({version:1,item:{id:w.DeosDirectionRelease.MARKER,content:JSON.stringify({status:'completed',report:plan.report})}});
 w.mockApi={workspaceId:'workspace',async list(e){return clone(db[e])},async backup(){},async create(e,item){const r={item:clone(item),version:1};db[e].push(r);return clone(r)},async update(e,id,item,version){const r=db[e].find(r=>r.item.id===id);assert.equal(r.version,version);r.item=clone(item);r.version++;return clone(r)}};
 w.__recoveryTest.configure(w.mockApi);
 await w.runDirectionReleaseUpgrade();
 assert.equal(w.__recoveryTest.state().actions.find(a=>a.id===test.actions[0].id).notes,'Saisie TEST à récupérer');assert(w.__recoveryTest.state().journal.some(j=>j.id==='journal-from-test'));
 assert(w.__recoveryTest.state().documents.some(d=>d.sourceType==='DEOS_JOURNAL_SYNC'&&JSON.stringify(d.content).includes('journal-from-test')),'Recovered Journal must remain in staged Documents transport');
 assert(w.__recoveryTest.ready());assert(!w.document.getElementById('app').inert);
 const checkpoint=await new Promise(resolve=>{const r=w.indexedDB.open('deos-codir-test');r.onsuccess=()=>{const db=r.result,q=db.transaction('snapshots').objectStore('snapshots').get('deos-test-recovered-workspace');q.onsuccess=()=>{db.close();resolve(q.result)}}});assert(checkpoint?.hash);
 console.log('PASS: application complète, reprise des saisies TEST et du Journal, transport Documents conservé et point de reprise validé après synchronisation.');w.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;liveWindow?.close();});
