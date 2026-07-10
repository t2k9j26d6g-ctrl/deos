const DEOS_VERSION = "V4.0";

const state = {
  actions: [], managers: [], projects: [], decisions: [],
  journal: [], documents: [], priorities: [], activity: []
};

const labels = { green:"Maîtrisé", orange:"À suivre", red:"Critique" };
const icons = { green:"🟢", orange:"🟠", red:"🔴" };

const defaults = {
  actions: [
    {title:"Remplacer les fichiers du dépôt par la version Cockpit V1", link:"DEOS", done:false},
    {title:"Tester la recherche globale", link:"DEOS", done:false},
    {title:"Valider l'affichage du cockpit sur PC pro", link:"DEOS", done:false},
    {title:"Structurer les décisions réelles du site", link:"Mémoire décisionnelle", done:false}
  ],
  managers: [
    {name:"Bérangère Perez", role:"REX Préparation", status:"orange", note:"Actions ouvertes sur productivité."},
    {name:"Gérard Diogon", role:"REX Réception / Expédition", status:"green", note:"Flux réception / expédition."},
    {name:"Hadrien Haza", role:"RH", status:"orange", note:"Dialogue social, RH."},
    {name:"Emilie Chautard", role:"Méthodes / Process", status:"green", note:"Process, volumes."},
    {name:"Nathalie Makota", role:"Maintenance", status:"red", note:"Maintenance site."},
    {name:"Stéphane Romeu", role:"RMP", status:"green", note:"Préparation terrain."}
  ],
  projects: [
    {name:"Dashboard GA",progress:70,status:"orange",next:"Sécuriser version mensuelle"},
    {name:"Projet Productivité",progress:55,status:"orange",next:"Concertation OS"},
    {name:"Prime Productivité",progress:45,status:"orange",next:"Simulation financière"},
    {name:"Polyvalence",progress:35,status:"red",next:"Clarifier critères"},
    {name:"Température Chocolat",progress:25,status:"red",next:"Note nationale thermosensible"}
  ],
  decisions: [
    {title:"Créer DEOS comme mémoire décisionnelle",context:"Retrouver les décisions, leur contexte, les personnes liées et les suites données.",date:"2026-07-06",tags:["DEOS","Décisions","Journal"]},
    {title:"Développer DEOS en GitHub Pages",context:"Le PC professionnel ne permet pas Node.js ; GitHub Pages permet une application accessible partout sans installation.",date:"2026-07-06",tags:["Architecture","GitHub"]}
  ],
  priorities: [
    {title:"Préparer CODIR",level:"orange",due:"Vendredi",link:"CODIR",done:false},
    {title:"Productivité",level:"red",due:"",link:"Projet Productivité",done:false},
    {title:"Température chocolat",level:"red",due:"",link:"Dossier chocolat",done:false},
    {title:"Entretien Hadrien",level:"orange",due:"",link:"Hadrien Haza",done:false}
  ],
  activity: [{type:"Projet", title:"Productivité", detail:"Modification", date:"08/07/2026 09:30"}],
  journal: [],
  documents: [
    {title:"Compte rendu CODIR",type:"Management",content:"Faits marquants · décisions · actions · alertes"},
    {title:"CSE",type:"Dialogue social",content:"Questions · réponses · décisions · points à sécuriser"},
    {title:"Mail professionnel",type:"Communication",content:"Objet clair · contexte · demande · échéance"}
  ]
};

async function loadJson(name) {
  try {
    const r = await fetch(`data/${name}.json?v=${Date.now()}`);
    if (!r.ok) return defaults[name] || [];
    return await r.json();
  } catch { return defaults[name] || []; }
}
function saved(name, fallback){ const v=localStorage.getItem(`deos_${name}`); return v?JSON.parse(v):fallback; }
function persist(name){ localStorage.setItem(`deos_${name}`, JSON.stringify(state[name])); }
function appHtml(html){ document.getElementById("app").innerHTML = html; }
function badge(status){ return `<span class="badge ${status}">${labels[status]||"À suivre"}</span>`; }
function esc(v=""){ return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function lines(id){ return document.getElementById(id).value.split("\n").map(x=>x.trim()).filter(Boolean); }
function splitTags(value){ return String(value||"").split(",").map(x=>x.trim()).filter(Boolean); }
function today(){ return new Date().toLocaleDateString("fr-FR"); }
function addActivity(type,title,detail=""){
  state.activity.unshift({type,title,detail,date:new Date().toLocaleString("fr-FR")});
  state.activity = state.activity.slice(0,50);
  persist("activity");
}

async function init(){
  for (const name of ["actions","managers","projects","decisions","priorities","activity","journal","documents"]) {
    state[name] = saved(name, await loadJson(name));
  }
  document.getElementById("today").textContent = new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
  document.querySelectorAll(".nav").forEach(btn => btn.onclick = () => setView(btn.dataset.view));
  document.getElementById("searchInput").oninput = e => runSearch(e.target.value);
  setView("cockpit");
}

function setView(view){
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view===view));
  const titles = {cockpit:"Cockpit décisionnel", folders:"Dossiers", priorities:"Priorités", actions:"Actions", managers:"Managers", projects:"Projets", decisions:"Mémoire décisionnelle", journal:"Journal du Directeur", documents:"Documents", activity:"Activité"};
  document.getElementById("viewTitle").textContent = titles[view] || "DEOS";
  const views = {cockpit:renderCockpit, folders:renderFolders, priorities:renderPriorities, actions:renderActions, managers:renderManagers, projects:renderProjects, decisions:renderDecisions, journal:renderJournal, documents:renderDocuments, activity:renderActivity};
  if (views[view]) views[view]();
}

function renderCockpit(){
  const openActions = state.actions.filter(a=>!a.done);
  const redProjects = state.projects.filter(p=>p.status==="red");
  const managersToFollow = state.managers.filter(m=>m.status!=="green");
  const activePriorities = state.priorities.filter(p=>!p.done);
  appHtml(`
    <div class="cockpit-top">
      <div class="card hero compact-hero">
        <h2>Bonjour Ludovic</h2><p class="muted">Brief du jour · DEOS ${DEOS_VERSION}</p>
        <div class="quick-kpis">
          <div><strong>${redProjects.length}</strong><span>🔴 Urgences</span></div>
          <div><strong>${openActions.length}</strong><span>🟠 Actions</span></div>
          <div><strong>${managersToFollow.length}</strong><span>👥 Managers</span></div>
          <div><strong>${activePriorities.length}</strong><span>🎯 Priorités</span></div>
        </div>
      </div>
      <div class="card agenda-card"><h2>📅 Aujourd'hui</h2>
        <div class="agenda-line"><strong>09:00</strong><span>Exploitation / REX</span></div>
        <div class="agenda-line"><strong>11:00</strong><span>Point RH</span></div>
        <div class="agenda-line"><strong>14:00</strong><span>Productivité</span></div>
        <div class="agenda-line"><strong>16:30</strong><span>Journal décision</span></div>
      </div>
    </div>
    <div class="grid two">
      <div class="card"><div class="row"><h2>🎯 Mes priorités</h2><button class="secondary" onclick="setView('priorities')">Gérer</button></div>${activePriorities.slice(0,5).map(priorityItem).join("") || `<div class="empty">Aucune priorité active.</div>`}</div>
      <div class="card"><h2>🕘 Activité récente</h2>${state.activity.slice(0,4).map(activityItem).join("") || `<div class="empty">Aucune activité récente.</div>`}</div>
    </div>
    <div class="grid two">
      <div class="card"><h2>📦 Dossiers sensibles</h2>${redProjects.map(projectMini).join("") || `<div class="empty">Aucun dossier critique.</div>`}</div>
      <div class="card"><h2>👥 Managers à suivre</h2>${managersToFollow.map(managerMini).join("") || `<div class="empty">Aucun manager à suivre.</div>`}</div>
    </div>`);
}

function priorityItem(p){ const i=state.priorities.indexOf(p); return `<div class="item row"><div><strong>${icons[p.level]||"🟠"} ${esc(p.title)}</strong><span class="muted">${esc(p.due||"Pas d'échéance")}${p.link ? " · "+esc(p.link) : ""}</span></div><div class="row-actions"><button class="secondary" onclick="completePriority(${i})">Terminer</button><button class="danger" onclick="deletePriority(${i})">Supprimer</button></div></div>`; }
function renderPriorities(){ appHtml(`<div class="card hero"><h2>🎯 Priorités</h2><p class="muted">Ajout, suivi et clôture des priorités du cockpit.</p></div><div class="card"><h2>Nouvelle priorité</h2><div class="form-grid"><input id="pTitle" placeholder="Titre" class="full"><input id="pDue" placeholder="Échéance"><input id="pLink" placeholder="Lien"><select id="pLevel"><option value="green">🟢 Normal</option><option value="orange" selected>🟠 Important</option><option value="red">🔴 Urgent</option></select></div><button class="action" onclick="addPriority()">Ajouter</button></div><div class="grid two"><div class="card"><h2>Actives</h2>${state.priorities.filter(p=>!p.done).map(priorityItem).join("") || `<div class="empty">Aucune priorité active.</div>`}</div><div class="card"><h2>Terminées</h2>${state.priorities.filter(p=>p.done).map(p=>`<div class="item"><strong>${esc(p.title)}</strong><span class="muted">${esc(p.link||"")}</span></div>`).join("") || `<div class="empty">Aucune priorité terminée.</div>`}</div></div>`); }
function addPriority(){ const title=document.getElementById("pTitle").value.trim(); if(!title)return; const p={title,due:document.getElementById("pDue").value.trim(),link:document.getElementById("pLink").value.trim(),level:document.getElementById("pLevel").value,done:false}; state.priorities.unshift(p); persist("priorities"); addActivity("🎯 Priorité",p.title,p.due||p.link); renderPriorities(); }
function completePriority(i){ state.priorities[i].done=true; persist("priorities"); addActivity("🎯 Priorité terminée",state.priorities[i].title,state.priorities[i].link||""); renderPriorities(); }
function deletePriority(i){ if(!confirm("Supprimer cette priorité ?"))return; const t=state.priorities[i].title; state.priorities.splice(i,1); persist("priorities"); addActivity("🎯 Priorité supprimée",t); renderPriorities(); }

function renderFolders(){ appHtml(`<div class="card hero"><h2>⭐ Dossiers</h2><p class="muted">Accès rapide aux sujets, projets et personnes.</p></div><div class="grid two"><div class="card"><h2>📦 Projets</h2>${state.projects.map(projectMini).join("")}</div><div class="card"><h2>👥 Managers</h2>${state.managers.map(managerMini).join("")}</div><div class="card"><h2>⚖️ Dialogue social</h2><div class="item"><strong>CSE</strong><span class="muted">Questions, réponses, décisions, échéances</span></div><div class="item"><strong>Courriers OS</strong><span class="muted">Réponses, historique, points sensibles</span></div></div><div class="card"><h2>📖 Mémoire</h2><div class="item clickable" onclick="setView('journal')"><strong>Journal</strong><span class="muted">Faits marquants</span></div><div class="item clickable" onclick="setView('decisions')"><strong>Décisions</strong><span class="muted">Contexte et suites</span></div></div></div>`); }

function renderActions(){ appHtml(`<div class="card"><h2>Ajouter une action</h2><input id="aTitle" placeholder="Action"><input id="aLink" placeholder="Lien"><button class="action" onclick="addAction()">Ajouter</button></div>${state.actions.map(actionItem).join("") || `<div class="card empty">Aucune action.</div>`}`); }
function actionItem(a,i){ return `<div class="item row"><div><strong>${a.done?"✅":"⬜"} ${esc(a.title)}</strong><span class="muted">${esc(a.link||"")}</span></div><div class="row-actions"><button class="secondary" onclick="toggleAction(${i})">${a.done?"Réouvrir":"Terminer"}</button><button class="danger" onclick="deleteAction(${i})">Supprimer</button></div></div>`; }
function addAction(){ const title=document.getElementById("aTitle").value.trim(); if(!title)return; const a={title,link:document.getElementById("aLink").value.trim(),done:false}; state.actions.unshift(a); persist("actions"); addActivity("✅ Action",a.title,a.link); renderActions(); }
function toggleAction(i){ state.actions[i].done=!state.actions[i].done; persist("actions"); addActivity("✅ Action modifiée",state.actions[i].title,state.actions[i].done?"Terminée":"Réouverte"); renderActions(); }
function deleteAction(i){ if(!confirm("Supprimer cette action ?"))return; const t=state.actions[i].title; state.actions.splice(i,1); persist("actions"); addActivity("✅ Action supprimée",t); renderActions(); }

function managerMini(m){ const i=state.managers.indexOf(m); return `<div class="item clickable" onclick="openManager(${i})"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role||"")}</span>${badge(m.status)}</div>`; }
function renderManagers(){ appHtml(`<div class="card"><h2>Ajouter un manager</h2><input id="mName" placeholder="Nom"><input id="mRole" placeholder="Poste"><select id="mStatus"><option value="green">Maîtrisé</option><option value="orange">À suivre</option><option value="red">Critique</option></select><textarea id="mNote" placeholder="Note"></textarea><button class="action" onclick="addManager()">Ajouter</button></div><div class="grid two">${state.managers.map(managerCard).join("")}</div>`); }
function managerCard(m,i){ return `<div class="card clickable" onclick="openManager(${i})"><h2>${esc(m.name)}</h2><p>${esc(m.role||"")}</p>${badge(m.status)}<p class="muted">${esc(m.note||"")}</p></div>`; }
function addManager(){ const name=document.getElementById("mName").value.trim(); if(!name)return; const m={name,role:document.getElementById("mRole").value.trim(),status:document.getElementById("mStatus").value,note:document.getElementById("mNote").value.trim(),priority:"",nextMeeting:"",strengths:[],watchPoints:[],actions:[]}; state.managers.push(m); persist("managers"); addActivity("👤 Manager",m.name,m.role); renderManagers(); }
function openManager(i){ const m=state.managers[i]; document.getElementById("viewTitle").textContent=m.name; appHtml(`<div class="card hero"><h2>${esc(m.name)}</h2><p>${esc(m.role||"")}</p>${badge(m.status)}<p class="muted">${esc(m.note||"")}</p><button class="action" onclick="editManager(${i})">Modifier</button><button class="danger" onclick="deleteManager(${i})">Supprimer</button></div><div class="grid two"><div class="card"><h2>Priorité</h2><p>${esc(m.priority||"À compléter")}</p></div><div class="card"><h2>Prochain entretien</h2><p>${esc(m.nextMeeting||"À planifier")}</p></div><div class="card"><h2>Forces</h2>${listItems(m.strengths)}</div><div class="card"><h2>Points de vigilance</h2>${listItems(m.watchPoints)}</div><div class="card"><h2>Actions</h2>${listItems(m.actions,"⬜ ")}</div><div class="card"><h2>Historique</h2><div class="item">Fiche manager dans DEOS</div></div></div>`); }
function editManager(i){ const m=state.managers[i]; document.getElementById("viewTitle").textContent="Modifier "+m.name; appHtml(`<div class="card"><h2>Modifier manager</h2><input id="emName" value="${esc(m.name)}"><input id="emRole" value="${esc(m.role||"")}"><input id="emPriority" value="${esc(m.priority||"")}" placeholder="Priorité"><input id="emNext" value="${esc(m.nextMeeting||"")}" placeholder="Prochain entretien"><select id="emStatus"><option value="green" ${m.status==="green"?"selected":""}>Maîtrisé</option><option value="orange" ${m.status==="orange"?"selected":""}>À suivre</option><option value="red" ${m.status==="red"?"selected":""}>Critique</option></select><textarea id="emNote">${esc(m.note||"")}</textarea><textarea id="emStrengths" placeholder="Forces, une par ligne">${(m.strengths||[]).join("\n")}</textarea><textarea id="emWatch" placeholder="Points de vigilance, un par ligne">${(m.watchPoints||[]).join("\n")}</textarea><textarea id="emActions" placeholder="Actions, une par ligne">${(m.actions||[]).join("\n")}</textarea><button class="action" onclick="saveManager(${i})">Enregistrer</button><button class="secondary" onclick="openManager(${i})">Annuler</button></div>`); }
function saveManager(i){ state.managers[i]={...state.managers[i],name:document.getElementById("emName").value.trim(),role:document.getElementById("emRole").value.trim(),priority:document.getElementById("emPriority").value.trim(),nextMeeting:document.getElementById("emNext").value.trim(),status:document.getElementById("emStatus").value,note:document.getElementById("emNote").value.trim(),strengths:lines("emStrengths"),watchPoints:lines("emWatch"),actions:lines("emActions")}; persist("managers"); addActivity("👤 Manager modifié",state.managers[i].name,state.managers[i].role); openManager(i); }
function deleteManager(i){ if(!confirm("Supprimer ce manager ?"))return; const t=state.managers[i].name; state.managers.splice(i,1); persist("managers"); addActivity("👤 Manager supprimé",t); renderManagers(); }

function projectMini(p){ const i=state.projects.indexOf(p); return `<div class="item clickable" onclick="openProject(${i})"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next||"")}</span>${badge(p.status)}</div>`; }
function renderProjects(){ appHtml(`<div class="card"><h2>Ajouter un projet</h2><input id="prName" placeholder="Nom"><input id="prNext" placeholder="Prochaine étape"><input id="prProgress" type="number" min="0" max="100" value="0"><select id="prStatus"><option value="green">Maîtrisé</option><option value="orange">À suivre</option><option value="red">Critique</option></select><button class="action" onclick="addProject()">Ajouter</button></div><div class="grid two">${state.projects.map(projectCard).join("")}</div>`); }
function projectCard(p,i){ return `<div class="card clickable" onclick="openProject(${i})"><h2>${esc(p.name)}</h2>${badge(p.status)}<p>${esc(p.next||"")}</p><div class="progress"><span style="width:${Number(p.progress||0)}%"></span></div><span class="muted">${Number(p.progress||0)}%</span></div>`; }
function addProject(){ const name=document.getElementById("prName").value.trim(); if(!name)return; const p={name,next:document.getElementById("prNext").value.trim(),progress:Number(document.getElementById("prProgress").value||0),status:document.getElementById("prStatus").value,decisions:"",actions:""}; state.projects.push(p); persist("projects"); addActivity("📦 Projet",p.name,p.next); renderProjects(); }
function openProject(i){ const p=state.projects[i]; document.getElementById("viewTitle").textContent=p.name; appHtml(`<div class="card hero"><h2>${esc(p.name)}</h2>${badge(p.status)}<p>${esc(p.next||"")}</p><button class="action" onclick="editProject(${i})">Modifier</button><button class="danger" onclick="deleteProject(${i})">Supprimer</button></div><div class="grid two"><div class="card"><h2>Avancement</h2><div class="progress"><span style="width:${Number(p.progress||0)}%"></span></div><p>${Number(p.progress||0)}%</p></div><div class="card"><h2>Prochaine étape</h2><p>${esc(p.next||"À compléter")}</p></div><div class="card"><h2>Décisions liées</h2><p>${esc(p.decisions||"À connecter")}</p></div><div class="card"><h2>Actions liées</h2><p>${esc(p.actions||"À connecter")}</p></div></div>`); }
function editProject(i){ const p=state.projects[i]; document.getElementById("viewTitle").textContent="Modifier "+p.name; appHtml(`<div class="card"><h2>Modifier projet</h2><input id="epName" value="${esc(p.name)}"><input id="epNext" value="${esc(p.next||"")}"><input id="epProgress" type="number" min="0" max="100" value="${Number(p.progress||0)}"><select id="epStatus"><option value="green" ${p.status==="green"?"selected":""}>Maîtrisé</option><option value="orange" ${p.status==="orange"?"selected":""}>À suivre</option><option value="red" ${p.status==="red"?"selected":""}>Critique</option></select><textarea id="epDecisions" placeholder="Décisions liées">${esc(p.decisions||"")}</textarea><textarea id="epActions" placeholder="Actions liées">${esc(p.actions||"")}</textarea><button class="action" onclick="saveProject(${i})">Enregistrer</button><button class="secondary" onclick="openProject(${i})">Annuler</button></div>`); }
function saveProject(i){ state.projects[i]={...state.projects[i],name:document.getElementById("epName").value.trim(),next:document.getElementById("epNext").value.trim(),progress:Number(document.getElementById("epProgress").value||0),status:document.getElementById("epStatus").value,decisions:document.getElementById("epDecisions").value.trim(),actions:document.getElementById("epActions").value.trim()}; persist("projects"); addActivity("📦 Projet modifié",state.projects[i].name,state.projects[i].next); openProject(i); }
function deleteProject(i){ if(!confirm("Supprimer ce projet ?"))return; const t=state.projects[i].name; state.projects.splice(i,1); persist("projects"); addActivity("📦 Projet supprimé",t); renderProjects(); }

function renderDecisions(){ appHtml(`<div class="card"><h2>Ajouter une décision</h2><input id="dTitle" placeholder="Titre"><textarea id="dContext" placeholder="Contexte"></textarea><input id="dTags" placeholder="Tags séparés par virgule"><button class="action" onclick="addDecision()">Ajouter</button></div>${state.decisions.map(decisionCard).join("")||`<div class="card empty">Aucune décision.</div>`}`); }
function decisionCard(d,i){ return `<div class="card clickable" onclick="openDecision(${i})"><h2>${esc(d.title)}</h2><p>${esc(d.context||"")}</p><span class="muted">${esc(d.date||"")} · ${(d.tags||[]).join(", ")}</span></div>`; }
function addDecision(){ const title=document.getElementById("dTitle").value.trim(); if(!title)return; const d={title,context:document.getElementById("dContext").value.trim(),date:today(),tags:splitTags(document.getElementById("dTags").value)}; state.decisions.unshift(d); persist("decisions"); addActivity("📌 Décision",d.title,d.context); renderDecisions(); }
function openDecision(i){ const d=state.decisions[i]; document.getElementById("viewTitle").textContent=d.title; appHtml(`<div class="card hero"><h2>${esc(d.title)}</h2><p>${esc(d.context||"")}</p><span class="muted">${esc(d.date||"")} · ${(d.tags||[]).join(", ")}</span><br><br><button class="danger" onclick="deleteDecision(${i})">Supprimer</button></div>`); }
function deleteDecision(i){ if(!confirm("Supprimer cette décision ?"))return; const t=state.decisions[i].title; state.decisions.splice(i,1); persist("decisions"); addActivity("📌 Décision supprimée",t); renderDecisions(); }

function renderJournal(){ appHtml(`<div class="card hero"><h2>Journal du Directeur</h2></div><div class="card"><h2>Ajouter une entrée</h2><input id="jTitle" placeholder="Titre"><textarea id="jContent" placeholder="Contenu"></textarea><input id="jTags" placeholder="Tags"><button class="action" onclick="addJournal()">Ajouter</button></div>${state.journal.map(journalCard).join("")||`<div class="card empty">Aucune entrée.</div>`}`); }
function journalCard(j,i){ return `<div class="card"><h2>${esc(j.title)}</h2><p>${esc(j.content||"")}</p><span class="muted">${esc(j.date||"")} · ${(j.tags||[]).join(", ")}</span></div>`; }
function addJournal(){ const title=document.getElementById("jTitle").value.trim()||"Entrée journal"; const j={title,content:document.getElementById("jContent").value.trim(),date:today(),tags:splitTags(document.getElementById("jTags").value)}; state.journal.unshift(j); persist("journal"); addActivity("📝 Journal",j.title,j.content); renderJournal(); }

function renderDocuments(){ appHtml(`<div class="card hero"><h2>Documents & modèles</h2></div><div class="grid two">${state.documents.map(d=>`<div class="card"><h2>${esc(d.title)}</h2><span class="muted">${esc(d.type||"")}</span><p>${esc(d.content||"")}</p></div>`).join("")}</div>`); }
function activityItem(a){ return `<div class="item"><strong>${esc(a.type)} · ${esc(a.title)}</strong><span class="muted">${esc(a.date||"")}${a.detail ? " · "+esc(a.detail) : ""}</span></div>`; }
function renderActivity(){ appHtml(`<div class="card hero"><h2>🕘 Activité</h2></div>${state.activity.map(activityItem).join("") || `<div class="card empty">Aucune activité.</div>`}`); }

function runSearch(query){ const q=query.toLowerCase().trim(); if(!q){setView("cockpit");return;} const results=[...state.managers.map(x=>({type:"Manager",title:x.name,text:x.role})),...state.projects.map(x=>({type:"Projet",title:x.name,text:x.next})),...state.actions.map(x=>({type:"Action",title:x.title,text:x.link})),...state.priorities.map(x=>({type:"Priorité",title:x.title,text:x.link})),...state.decisions.map(x=>({type:"Décision",title:x.title,text:x.context}))].filter(x=>`${x.title} ${x.text}`.toLowerCase().includes(q)); document.getElementById("viewTitle").textContent="Recherche"; appHtml(`<div class="card"><h2>${results.length} résultat(s)</h2>${results.map(r=>`<div class="item"><strong>${esc(r.title)}</strong><span class="muted">${esc(r.type)} · ${esc(r.text||"")}</span></div>`).join("")}</div>`); }
function listItems(items,prefix=""){ return (items||[]).map(x=>`<div class="item">${prefix}${esc(x)}</div>`).join("") || `<div class="empty">À compléter</div>`; }

init();
