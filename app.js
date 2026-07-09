const DEOS_VERSION = "V5.0";

const entities = ["actions", "managers", "projects", "decisions", "priorities", "activity", "journal", "documents", "agenda"];
const state = Object.fromEntries(entities.map(name => [name, []]));
let agendaEditId = "";
let agendaFilter = "today";

const labels = { green: "Maîtrisé", orange: "À suivre", red: "Critique" };
const icons = { green: "🟢", orange: "🟠", red: "🔴" };

const defaults = {
  actions: [
    { id: "act-v5-001", title: "Remplacer les fichiers du dépôt par la version Cockpit V1", link: "DEOS", done: false },
    { id: "act-v5-002", title: "Tester la recherche globale", link: "DEOS", done: false },
    { id: "act-v5-003", title: "Valider l'affichage du cockpit sur PC pro", link: "DEOS", done: false },
    { id: "act-v5-004", title: "Structurer les décisions réelles du site", link: "Mémoire décisionnelle", done: false }
  ],
  managers: [
    { id: "mgr-v5-001", name: "Bérangère Perez", role: "REX Préparation", status: "orange", note: "Actions ouvertes sur productivité.", priority: "Productivité", lastInterview: "", nextMeeting: "", objectives: ["Stabiliser le suivi productivité"], strengths: [], watchPoints: ["Suivi des actions ouvertes"], actions: [], linkedActions: ["act-v5-002"], linkedProjects: ["prj-v5-002"], linkedDecisions: ["dec-v5-001"], events: [], directorNotes: [] },
    { id: "mgr-v5-002", name: "Gérard Diogon", role: "REX Réception / Expédition", status: "green", note: "Flux réception / expédition.", priority: "Maintenir la régularité des flux", lastInterview: "", nextMeeting: "", objectives: ["Consolider les routines réception / expédition"], strengths: ["Flux maîtrisés"], watchPoints: [], actions: [], linkedActions: [], linkedProjects: ["prj-v5-001"], linkedDecisions: [], events: [], directorNotes: [] },
    { id: "mgr-v5-003", name: "Hadrien Haza", role: "RH", status: "orange", note: "Dialogue social, RH.", priority: "Dialogue social", lastInterview: "", nextMeeting: "", objectives: ["Sécuriser les sujets RH sensibles"], strengths: [], watchPoints: ["Points RH sensibles"], actions: [], linkedActions: ["act-v5-004"], linkedProjects: ["prj-v5-002"], linkedDecisions: ["dec-v5-001"], events: [], directorNotes: [] },
    { id: "mgr-v5-004", name: "Emilie Chautard", role: "Méthodes / Process", status: "green", note: "Process, volumes.", priority: "Structurer les process clés", lastInterview: "", nextMeeting: "", objectives: ["Fiabiliser les données méthodes"], strengths: ["Maîtrise process"], watchPoints: [], actions: [], linkedActions: [], linkedProjects: ["prj-v5-001"], linkedDecisions: [], events: [], directorNotes: [] },
    { id: "mgr-v5-005", name: "Nathalie Makota", role: "Maintenance", status: "red", note: "Maintenance site.", priority: "Sécuriser les irritants maintenance", lastInterview: "", nextMeeting: "", objectives: ["Prioriser les interventions critiques"], strengths: [], watchPoints: ["Sujet critique"], actions: [], linkedActions: [], linkedProjects: ["prj-v5-005"], linkedDecisions: [], events: [], directorNotes: [] },
    { id: "mgr-v5-006", name: "Stéphane Romeu", role: "RMP", status: "green", note: "Préparation terrain.", priority: "Appuyer la préparation terrain", lastInterview: "", nextMeeting: "", objectives: ["Renforcer l'appui opérationnel"], strengths: ["Préparation terrain"], watchPoints: [], actions: [], linkedActions: [], linkedProjects: ["prj-v5-004"], linkedDecisions: [], events: [], directorNotes: [] }
  ],
  projects: [
    { id: "prj-v5-001", name: "Dashboard GA", progress: 70, status: "orange", objective: "Fiabiliser le pilotage mensuel", next: "Sécuriser version mensuelle", owner: "", linkedManagers: ["mgr-v5-002", "mgr-v5-004"], launchDate: "", deadline: "", priorityLevel: "orange", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: [], linkedDecisions: ["dec-v5-001"], linkedDocuments: ["doc-v5-001"], events: [], directorNotes: [] },
    { id: "prj-v5-002", name: "Projet Productivité", progress: 55, status: "orange", objective: "Améliorer durablement la productivité opérationnelle", next: "Concertation OS", owner: "", linkedManagers: ["mgr-v5-001", "mgr-v5-003"], launchDate: "", deadline: "", priorityLevel: "red", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: ["act-v5-002"], linkedDecisions: ["dec-v5-001"], linkedDocuments: [], events: [], directorNotes: [] },
    { id: "prj-v5-003", name: "Prime Productivité", progress: 45, status: "orange", objective: "Construire une prime lisible et soutenable", next: "Simulation financière", owner: "", linkedManagers: ["mgr-v5-001", "mgr-v5-003"], launchDate: "", deadline: "", priorityLevel: "orange", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [] },
    { id: "prj-v5-004", name: "Polyvalence", progress: 35, status: "red", objective: "Clarifier et structurer la polyvalence terrain", next: "Clarifier critères", owner: "", linkedManagers: ["mgr-v5-006"], launchDate: "", deadline: "", priorityLevel: "red", context: "", decisions: "", actions: "", risks: "Critères à clarifier", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [] },
    { id: "prj-v5-005", name: "Température Chocolat", progress: 25, status: "red", objective: "Sécuriser le traitement du dossier thermosensible", next: "Note nationale thermosensible", owner: "", linkedManagers: ["mgr-v5-005"], launchDate: "", deadline: "", priorityLevel: "red", context: "", decisions: "", actions: "", risks: "Dossier thermosensible", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: ["doc-v5-002"], events: [], directorNotes: [] }
  ],
  decisions: [
    { id: "dec-v5-001", title: "Créer DEOS comme mémoire décisionnelle", context: "Retrouver les décisions, leur contexte, les personnes liées et les suites données.", date: "2026-07-06", status: "decided", importance: "orange", problem: "Les décisions et leurs suites sont difficiles à retrouver dans le temps.", decision: "Créer DEOS comme mémoire décisionnelle.", rationale: "Centraliser contexte, personnes liées, projets, actions et historique.", alternatives: "Suivi par fichiers séparés ou notes dispersées.", impacts: "Mémoire de direction", risks: "Maintenir la discipline de saisie.", owner: "Ludovic", linkedManagers: ["mgr-v5-001", "mgr-v5-003"], linkedProjects: ["prj-v5-001", "prj-v5-002"], linkedActions: ["act-v5-004"], reviewDate: "", linkedDocuments: [], events: [], directorNotes: [], nextStep: "Alimenter les décisions réelles", tags: ["DEOS", "Décisions", "Journal"] },
    { id: "dec-v5-002", title: "Développer DEOS en GitHub Pages", context: "Le PC professionnel ne permet pas Node.js ; GitHub Pages permet une application accessible partout sans installation.", date: "2026-07-06", status: "decided", importance: "orange", problem: "Le poste professionnel ne permet pas une application nécessitant Node.js.", decision: "Développer DEOS en application statique compatible GitHub Pages.", rationale: "Accessibilité, simplicité de déploiement et absence d'installation locale.", alternatives: "Application locale Node.js, fichier tableur, outil externe.", impacts: "Architecture simple", risks: "Bien gérer la persistance locale et les sauvegardes.", owner: "Ludovic", linkedManagers: [], linkedProjects: ["prj-v5-001"], linkedActions: [], reviewDate: "", linkedDocuments: [], events: [], directorNotes: [], nextStep: "Conserver une application statique", tags: ["Architecture", "GitHub"] }
  ],
  priorities: [
    { id: "pri-v5-001", title: "Préparer CODIR", level: "orange", due: "Vendredi", link: "CODIR", done: false, owner: "Ludovic", impact: "" },
    { id: "pri-v5-002", title: "Productivité", level: "red", due: "", link: "Projet Productivité", done: false, owner: "", impact: "" },
    { id: "pri-v5-003", title: "Température chocolat", level: "red", due: "", link: "Dossier chocolat", done: false, owner: "", impact: "" },
    { id: "pri-v5-004", title: "Entretien Hadrien", level: "orange", due: "", link: "Hadrien Haza", done: false, owner: "", impact: "" }
  ],
  activity: [{ id: "acty-v5-001", type: "Projet", title: "Productivité", detail: "Modification", date: "08/07/2026 09:30", entityId: "prj-v5-002" }],
  journal: [],
  documents: [
    { id: "doc-v5-001", title: "Compte rendu CODIR", type: "Management", status: "Modèle", owner: "Ludovic", updatedAt: "2026-07-08", tags: ["CODIR"], content: "Faits marquants · décisions · actions · alertes" },
    { id: "doc-v5-002", title: "CSE", type: "Dialogue social", status: "Modèle", owner: "Ludovic", updatedAt: "2026-07-08", tags: ["CSE"], content: "Questions · réponses · décisions · points à sécuriser" },
    { id: "doc-v5-003", title: "Mail professionnel", type: "Communication", status: "Modèle", owner: "Ludovic", updatedAt: "2026-07-08", tags: ["Mail"], content: "Objet clair · contexte · demande · échéance" }
  ],
  agenda: []
};

async function loadJson(name) {
  try {
    const r = await fetch(`data/${name}.json?v=${Date.now()}`);
    if (!r.ok) return defaults[name] || [];
    return await r.json();
  } catch {
    return defaults[name] || [];
  }
}

function saved(name, fallback) {
  const v = localStorage.getItem(`deos_${name}`);
  return v ? JSON.parse(v) : fallback;
}

function persist(name) {
  localStorage.setItem(`deos_${name}`, JSON.stringify(state[name]));
}

function appHtml(html) {
  document.getElementById("app").innerHTML = html;
}

function badge(status) {
  return `<span class="badge ${status}">${labels[status] || "À suivre"}</span>`;
}

function esc(v = "") {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lines(id) {
  return document.getElementById(id).value.split("\n").map(x => x.trim()).filter(Boolean);
}

function splitTags(value) {
  return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
}

function today() {
  return new Date().toLocaleDateString("fr-FR");
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoAddDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function slug(value) {
  return String(value).slice(0, 4).replace(/[^a-z0-9]/gi, "").toLowerCase() || "deos";
}

function newId(type) {
  return `${slug(type)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split("\n").map(x => x.trim()).filter(Boolean);
}

function ensureTimeline(value) {
  return ensureArray(value).map(item => typeof item === "string" ? { id: newId("event"), date: today(), title: item, detail: "" } : { id: item.id || newId("event"), date: item.date || today(), title: item.title || "Événement", detail: item.detail || "" });
}

function ensureNotes(value) {
  return ensureArray(value).map(item => typeof item === "string" ? { id: newId("note"), date: today(), content: item } : { id: item.id || newId("note"), date: item.date || today(), content: item.content || "" });
}

function ensureMilestones(value) {
  return ensureArray(value).map(item => typeof item === "string" ? { id: newId("mile"), date: "", title: item, status: "À suivre" } : { id: item.id || newId("mile"), date: item.date || "", title: item.title || "Jalon", status: item.status || "À suivre" });
}

function normalizeEntity(name, item) {
  const base = { ...item, id: item.id || newId(name) };
  if (name === "managers") {
    const template = defaults.managers.find(m => m.id === base.id) || {};
    const merged = { priority: "", lastInterview: "", nextMeeting: "", objectives: [], strengths: [], watchPoints: [], actions: [], linkedActions: [], linkedProjects: [], linkedDecisions: [], events: [], directorNotes: [], ...template, ...base };
    return { ...merged, objectives: ensureArray(merged.objectives), strengths: ensureArray(merged.strengths), watchPoints: ensureArray(merged.watchPoints), actions: ensureArray(merged.actions), linkedActions: ensureArray(merged.linkedActions), linkedProjects: ensureArray(merged.linkedProjects), linkedDecisions: ensureArray(merged.linkedDecisions), events: ensureTimeline(merged.events), directorNotes: ensureNotes(merged.directorNotes) };
  }
  if (name === "projects") {
    const template = defaults.projects.find(p => p.id === base.id) || {};
    const inferredOwner = state.managers.find(m => m.id === base.ownerId || m.name === base.owner);
    const merged = { objective: "", owner: "", ownerId: "", linkedManagers: [], launchDate: "", deadline: "", priorityLevel: "orange", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [], ...template, ...base };
    if (!merged.ownerId && inferredOwner) merged.ownerId = inferredOwner.id;
    if (merged.ownerId && !merged.owner) merged.owner = projectOwnerName(merged);
    return { ...merged, progress: Number(merged.progress || 0), linkedManagers: ensureArray(merged.linkedManagers), milestones: ensureMilestones(merged.milestones), linkedActions: ensureArray(merged.linkedActions), linkedDecisions: ensureArray(merged.linkedDecisions), linkedDocuments: ensureArray(merged.linkedDocuments), events: ensureTimeline(merged.events), directorNotes: ensureNotes(merged.directorNotes) };
  }
  if (name === "decisions") {
    const template = defaults.decisions.find(d => d.id === base.id) || {};
    const merged = { date: today(), status: "decided", importance: "orange", context: "", problem: "", decision: "", rationale: "", alternatives: "", impacts: base.impact || "", risks: "", owner: "", linkedManagers: [], linkedProjects: [], linkedActions: [], reviewDate: "", linkedDocuments: [], events: [], directorNotes: [], nextStep: "", tags: [], ...template, ...base };
    return { ...merged, tags: ensureArray(merged.tags), linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects), linkedActions: ensureArray(merged.linkedActions), linkedDocuments: ensureArray(merged.linkedDocuments), events: ensureTimeline(merged.events), directorNotes: ensureNotes(merged.directorNotes) };
  }
  if (name === "priorities") return { owner: "", impact: "", done: false, ...base };
  if (name === "journal") {
    const merged = { date: today(), entryType: "Note rapide", summary: base.content || "", facts: "", analysis: "", decisionsText: "", actionsText: "", linkedManagers: [], linkedProjects: [], linkedDecisions: [], linkedActions: [], linkedDocuments: [], watchPoints: "", nextSteps: "", notes: "", events: [], tags: [], mood: "", links: "", ...base };
    return { ...merged, tags: ensureArray(merged.tags), linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects), linkedDecisions: ensureArray(merged.linkedDecisions), linkedActions: ensureArray(merged.linkedActions), linkedDocuments: ensureArray(merged.linkedDocuments), events: ensureTimeline(merged.events) };
  }
  if (name === "documents") return { type: "", status: "Brouillon", owner: "", updatedAt: isoToday(), tags: [], content: "", ...base, tags: ensureArray(base.tags) };
  if (name === "activity") return { detail: "", date: new Date().toLocaleString("fr-FR"), entityId: "", ...base };
  if (name === "agenda") {
    const merged = { date: isoToday(), startTime: base.time || "09:00", endTime: "", title: "Rendez-vous", type: "Autre", location: "", notes: base.detail || "", linkedManagers: [], linkedProjects: [], linkedView: "", linkedId: "", ...base };
    if (!merged.startTime && merged.time) merged.startTime = merged.time;
    if (!merged.notes && merged.detail) merged.notes = merged.detail;
    return { ...merged, linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects) };
  }
  return base;
}

function normalizeCollection(name, data) {
  return (Array.isArray(data) ? data : []).map(item => normalizeEntity(name, item));
}

function byId(name, id) {
  return state[name].find(x => x.id === id);
}

function indexById(name, id) {
  return state[name].findIndex(x => x.id === id);
}

function addActivity(type, title, detail = "", entityId = "") {
  state.activity.unshift({ id: newId("activity"), type, title, detail, entityId, date: new Date().toLocaleString("fr-FR") });
  state.activity = state.activity.slice(0, 50);
  persist("activity");
}

async function init() {
  for (const name of entities) {
    state[name] = normalizeCollection(name, saved(name, await loadJson(name)));
    persist(name);
  }
  document.getElementById("today").textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  document.querySelectorAll(".nav").forEach(btn => btn.onclick = () => setView(btn.dataset.view));
  document.getElementById("searchInput").oninput = e => runSearch(e.target.value);
  setView("cockpit");
}

function setView(view) {
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  const titles = { cockpit: "Cockpit décisionnel", folders: "Dossiers", priorities: "Priorités V5", actions: "Actions", managers: "Managers V5", projects: "Projets V5", decisions: "Décisions V5", journal: "Journal", documents: "Documents", activity: "Activité" };
  document.getElementById("viewTitle").textContent = titles[view] || "DEOS";
  const views = { cockpit: renderCockpit, folders: renderFolders, priorities: renderPriorities, actions: renderActions, managers: renderManagers, projects: renderProjects, decisions: renderDecisions, journal: renderJournal, documents: renderDocuments, activity: renderActivity };
  if (views[view]) views[view]();
}

function parseDateValue(value) {
  if (!value) return null;
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fr) return new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(value) {
  const d = parseDateValue(value);
  if (!d) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - start) / 86400000);
}

function levelRank(level) {
  return ({ red: 0, orange: 1, green: 2, critique: 0, important: 1, normal: 2 })[level] ?? 3;
}

function dateRank(value) {
  const d = parseDateValue(value);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

function createdRank(item) {
  const n = String(item.id || "").match(/-([a-z0-9]+)-/);
  return n ? parseInt(n[1], 36) : 0;
}

function linkedActionIds(item) {
  return ensureArray(item.linkedActions || item.actions);
}

function hasOverdueAction(item) {
  return state.actions.some(a => linkedActionIds(item).includes(a.id) && !a.done && daysUntil(a.due) !== null && daysUntil(a.due) < 0);
}

function cockpitPriorities() {
  return state.priorities.filter(p => !p.done).sort((a, b) => levelRank(a.level) - levelRank(b.level) || dateRank(a.due) - dateRank(b.due) || createdRank(a) - createdRank(b));
}

function cockpitActions() {
  return state.actions.filter(a => !a.done).filter(a => {
    const due = daysUntil(a.due);
    return (due !== null && due <= 7) || ((a.level === "red" || a.priorityLevel === "red" || /critique|urgent/i.test(`${a.title} ${a.link}`)) && !a.due);
  }).sort((a, b) => dateRank(a.due) - dateRank(b.due) || levelRank(a.level) - levelRank(b.level));
}

function cockpitManagers() {
  return state.managers.filter(m => {
    const next = daysUntil(m.nextMeeting);
    return m.status === "red" || m.status === "orange" || (next !== null && next <= 7) || hasOverdueAction(m);
  }).sort((a, b) => levelRank(a.status) - levelRank(b.status) || dateRank(a.nextMeeting) - dateRank(b.nextMeeting)).slice(0, 5);
}

function cockpitProjects() {
  return state.projects.filter(p => {
    const late = daysUntil(p.deadline);
    return p.status === "red" || p.priorityLevel === "red" || (late !== null && late < 0) || /risque|critique|vigilance|thermosensible/i.test(p.risks || "") || !p.next || !projectOwnerId(p);
  }).sort((a, b) => levelRank(a.status) - levelRank(b.status) || dateRank(a.deadline) - dateRank(b.deadline));
}

function cockpitDecisions() {
  return state.decisions.filter(d => {
    const review = daysUntil(d.reviewDate);
    return d.status === "applying" || d.status === "review" || (review !== null && review <= 7) || (d.importance === "red" && d.status !== "applied");
  }).sort((a, b) => levelRank(a.importance) - levelRank(b.importance) || dateRank(a.reviewDate) - dateRank(b.reviewDate));
}

function cockpitAlerts() {
  const alerts = [];
  const push = (type, id, title, detail, level = "orange") => {
    if (!alerts.some(a => a.type === type && a.id === id)) alerts.push({ type, id, title, detail, level });
  };
  cockpitProjects().forEach(p => push("projects", p.id, p.name, p.status === "red" ? "Projet critique" : "Projet à sécuriser", p.status));
  state.actions.filter(a => !a.done && daysUntil(a.due) !== null && daysUntil(a.due) < 0).forEach(a => push("actions", a.id, a.title, "Action en retard", "red"));
  state.managers.filter(m => m.status === "red").forEach(m => push("managers", m.id, m.name, "Manager critique", "red"));
  cockpitDecisions().forEach(d => push("decisions", d.id, d.title, d.status === "review" ? "Décision à réexaminer" : "Décision à suivre", d.importance === "red" ? "red" : "orange"));
  state.documents.filter(d => /validation|à valider|a valider/i.test(d.status || "")).forEach(d => push("documents", d.id, d.title, "Document en attente de validation", "orange"));
  return alerts;
}

function openCockpitEntity(entity, id) {
  if (entity === "managers") return openManager(id);
  if (entity === "projects") return openProject(id);
  if (entity === "decisions") return openDecision(id);
  if (entity === "journal") return openJournal(id);
  if (entity === "documents") return setView("documents");
  if (entity === "priorities") return setView("priorities");
  if (entity === "actions") return setView("actions");
  setView("cockpit");
}

function openLinkedFromPriority(id) {
  const p = byId("priorities", id);
  if (!p) return setView("priorities");
  const text = `${p.link || ""} ${p.title || ""}`.toLowerCase();
  const manager = state.managers.find(m => text.includes(m.name.toLowerCase()));
  const project = state.projects.find(pr => text.includes(pr.name.toLowerCase()));
  const decision = state.decisions.find(d => text.includes(d.title.toLowerCase()));
  if (manager) return openManager(manager.id);
  if (project) return openProject(project.id);
  if (decision) return openDecision(decision.id);
  setView("priorities");
}

function completeCockpitPriority(id) {
  const p = byId("priorities", id);
  if (!p) return;
  p.done = true;
  persist("priorities");
  addActivity("🎯 Priorité terminée", p.title, p.link || "", p.id);
  renderCockpit();
}

function completeCockpitAction(id) {
  const a = byId("actions", id);
  if (!a) return;
  a.done = true;
  persist("actions");
  addActivity("✅ Action terminée", a.title, a.link || "", a.id);
  renderCockpit();
}

function cockpitPriorityItem(p) {
  return `<div class="item row"><div><strong>${icons[p.level] || "🟠"} ${esc(p.title)}</strong><span class="muted">${esc(p.due || "Pas d'échéance")}${p.link ? " · " + esc(p.link) : ""}${p.owner ? " · " + esc(p.owner) : ""}</span><span class="meta">ID ${esc(p.id)}</span></div><div class="row-actions"><button class="secondary" onclick="completeCockpitPriority('${p.id}')">Terminer</button><button class="secondary" onclick="openLinkedFromPriority('${p.id}')">Ouvrir</button></div></div>`;
}

function cockpitActionItem(a) {
  const due = daysUntil(a.due);
  const label = due === null ? "Critique sans échéance" : due < 0 ? `En retard de ${Math.abs(due)} j` : due === 0 ? "Aujourd'hui" : `Dans ${due} j`;
  return `<div class="item row"><div><strong>${a.done ? "✅" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(label)}${a.link ? " · " + esc(a.link) : ""}</span><span class="meta">ID ${esc(a.id)}</span></div><div class="row-actions"><button class="secondary" onclick="completeCockpitAction('${a.id}')">Terminer</button><button class="secondary" onclick="openCockpitEntity('actions','${a.id}')">Ouvrir</button></div></div>`;
}

function cockpitAlertItem(a) {
  return `<div class="item clickable alert-${esc(a.level)}" onclick="openCockpitEntity('${a.type}','${a.id}')"><strong>${a.level === "red" ? "🔴" : "🟠"} ${esc(a.title)}</strong><span class="muted">${esc(a.detail)}</span><span class="meta">${esc(a.type)} · ID ${esc(a.id)}</span></div>`;
}

function cockpitProjectItem(p) {
  return `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${icons[p.status] || "🟠"} ${esc(p.name)}</strong><span class="muted">${Number(p.progress || 0)}% · Prochaine étape : ${esc(p.next || "À définir")}</span><span class="meta">Échéance ${esc(p.deadline || "Non définie")} · Responsable ${esc(projectOwnerName(p) || "Non défini")}</span></div>`;
}

function cockpitDecisionItem(d) {
  return `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${d.importance === "red" ? "🔴" : "🟠"} ${esc(d.title)}</strong><span class="muted">${esc(decisionStatusLabel(d.status))}${d.reviewDate ? " · Réexamen " + esc(d.reviewDate) : ""}</span><span class="meta">ID ${esc(d.id)}</span></div>`;
}

function openActivityTarget(id) {
  const hit = entities.find(name => name !== "activity" && byId(name, id));
  if (hit) return openCockpitEntity(hit, id);
  setView("activity");
}

function cockpitActivityItem(a) {
  return `<div class="item ${a.entityId ? "clickable" : ""}" ${a.entityId ? `onclick="openActivityTarget('${a.entityId}')"` : ""}><strong>${esc(a.type)} · ${esc(a.title)}</strong><span class="muted">${esc(a.date || "")}${a.detail ? " · " + esc(a.detail) : ""}</span><span class="meta">ID ${esc(a.id)}${a.entityId ? " · Entité " + esc(a.entityId) : ""}</span></div>`;
}

function agendaItems() {
  const todayIso = isoToday();
  const tomorrowIso = isoAddDays(1);
  const weekIso = isoAddDays(7);
  return state.agenda.filter(a => {
    if (agendaFilter === "today") return a.date === todayIso;
    if (agendaFilter === "tomorrow") return a.date === tomorrowIso;
    if (agendaFilter === "week") return a.date >= todayIso && a.date <= weekIso;
    return true;
  }).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.startTime || a.time || "").localeCompare(String(b.startTime || b.time || "")));
}

function agendaFilterLabel() {
  return ({ today: "Aujourd'hui", tomorrow: "Demain", week: "7 jours", all: "Tous" })[agendaFilter] || "Aujourd'hui";
}

function setAgendaFilter(filter) {
  agendaFilter = filter;
  renderCockpit();
}

function agendaLinkedNames(a) {
  const managers = state.managers.filter(m => (a.linkedManagers || []).includes(m.id)).map(m => m.name);
  const projects = state.projects.filter(p => (a.linkedProjects || []).includes(p.id)).map(p => p.name);
  return [...managers, ...projects].join(" · ");
}

function agendaItem(a) {
  const time = `${esc(a.startTime || a.time || "")}${a.endTime ? " - " + esc(a.endTime) : ""}`;
  const links = agendaLinkedNames(a);
  return `<div class="agenda-line"><strong>${time}</strong><span>${esc(a.title)}<small>${esc(a.type || "Autre")}${a.location ? " · " + esc(a.location) : ""}${links ? " · " + esc(links) : ""}</small></span><div class="row-actions"><button class="secondary" onclick="editAgenda('${a.id}')">Modifier</button><button class="danger" onclick="deleteAgenda('${a.id}')">Supprimer</button></div></div>`;
}

function agendaLinkedList(items) {
  return items.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.startTime || a.time || "").localeCompare(String(b.startTime || b.time || ""))).map(a => `<div class="item"><strong>${esc(a.date || "")} · ${esc(a.startTime || a.time || "")}${a.endTime ? " - " + esc(a.endTime) : ""}</strong><span class="muted">${esc(a.title)} · ${esc(a.type || "Autre")}</span>${a.location ? `<span class="meta">${esc(a.location)}</span>` : ""}</div>`).join("") || `<div class="empty">Aucun rendez-vous lié.</div>`;
}

function managerAgendaList(m) {
  return agendaLinkedList(state.agenda.filter(a => (a.linkedManagers || []).includes(m.id)));
}

function projectAgendaList(p) {
  return agendaLinkedList(state.agenda.filter(a => (a.linkedProjects || []).includes(p.id)));
}

function agendaForm() {
  const a = agendaEditId ? byId("agenda", agendaEditId) : null;
  return `<div class="agenda-form"><div class="form-grid"><input id="agDate" type="date" value="${esc(a?.date || isoToday())}"><input id="agStart" type="time" value="${esc(a?.startTime || a?.time || "09:00")}"><input id="agEnd" type="time" value="${esc(a?.endTime || "")}"><input id="agTitle" value="${esc(a?.title || "")}" placeholder="Titre"><select id="agType"><option ${(!a || a.type === "CODIR") ? "selected" : ""}>CODIR</option><option ${a?.type === "Exploitation" ? "selected" : ""}>Exploitation</option><option ${a?.type === "RH" ? "selected" : ""}>RH</option><option ${a?.type === "Projet" ? "selected" : ""}>Projet</option><option ${a?.type === "CSE" ? "selected" : ""}>CSE</option><option ${a?.type === "Entretien manager" ? "selected" : ""}>Entretien manager</option><option ${a?.type === "Autre" ? "selected" : ""}>Autre</option></select><input id="agLocation" value="${esc(a?.location || "")}" placeholder="Lieu"><textarea id="agNotes" class="full" placeholder="Notes">${esc(a?.notes || a?.detail || "")}</textarea></div><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("agManagers", state.managers, a?.linkedManagers || [], m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("agProjects", state.projects, a?.linkedProjects || [], p => p.name)}</div></div><button class="action" onclick="${a ? "saveAgenda()" : "addAgenda()"}">${a ? "Enregistrer" : "Ajouter"}</button>${a ? `<button class="secondary" onclick="cancelAgendaEdit()">Annuler</button>` : ""}</div>`;
}

function readAgendaForm(existing = {}) {
  const title = document.getElementById("agTitle").value.trim();
  if (!title) return null;
  return { ...existing, date: document.getElementById("agDate").value || isoToday(), startTime: document.getElementById("agStart").value || "09:00", time: document.getElementById("agStart").value || "09:00", endTime: document.getElementById("agEnd").value, title, type: document.getElementById("agType").value, location: document.getElementById("agLocation").value.trim(), notes: document.getElementById("agNotes").value.trim(), detail: document.getElementById("agNotes").value.trim(), linkedManagers: checkedValues("agManagers"), linkedProjects: checkedValues("agProjects") };
}

function addAgenda() {
  const data = readAgendaForm({ id: newId("agenda") });
  if (!data) return;
  state.agenda.push(data);
  persist("agenda");
  addActivity("📅 Agenda", data.title, `${data.date} ${data.startTime}`, data.id);
  agendaFilter = data.date === isoToday() ? "today" : agendaFilter;
  renderCockpit();
}

function editAgenda(id) {
  agendaEditId = id;
  renderCockpit();
}

function saveAgenda() {
  const a = byId("agenda", agendaEditId);
  if (!a) return;
  const data = readAgendaForm(a);
  if (!data) return;
  Object.assign(a, data);
  persist("agenda");
  addActivity("📅 Agenda modifié", a.title, `${a.date} ${a.startTime}`, a.id);
  agendaEditId = "";
  renderCockpit();
}

function cancelAgendaEdit() {
  agendaEditId = "";
  renderCockpit();
}

function deleteAgenda(id) {
  const i = indexById("agenda", id);
  if (i < 0 || !confirm("Supprimer ce rendez-vous ?")) return;
  const title = state.agenda[i].title;
  state.agenda.splice(i, 1);
  persist("agenda");
  addActivity("📅 Agenda supprimé", title);
  renderCockpit();
}

function renderCockpit() {
  const openActions = state.actions.filter(a => !a.done);
  const priorities = cockpitPriorities();
  const alerts = cockpitAlerts();
  const managers = cockpitManagers();
  const projects = cockpitProjects();
  const decisions = cockpitDecisions();
  const actions = cockpitActions();
  const agenda = agendaItems();
  appHtml(`
    <div class="cockpit-top">
      <div class="card hero compact-hero">
        <h2>Brief du jour</h2><p class="muted">${today()} · DEOS ${DEOS_VERSION}</p>
        <div class="quick-kpis">
          <div><strong>${alerts.filter(a => a.level === "red").length}</strong><span>Urgences</span></div>
          <div><strong>${openActions.length}</strong><span>Actions ouvertes</span></div>
          <div><strong>${managers.length}</strong><span>Managers à suivre</span></div>
          <div><strong>${priorities.length}</strong><span>Priorités actives</span></div>
        </div>
      </div>
      <div class="card agenda-card"><div class="row"><h2>Agenda · ${esc(agendaFilterLabel())}</h2></div><div class="agenda-filters"><button class="secondary ${agendaFilter === "today" ? "active-filter" : ""}" onclick="setAgendaFilter('today')">Aujourd'hui</button><button class="secondary ${agendaFilter === "tomorrow" ? "active-filter" : ""}" onclick="setAgendaFilter('tomorrow')">Demain</button><button class="secondary ${agendaFilter === "week" ? "active-filter" : ""}" onclick="setAgendaFilter('week')">7 jours</button><button class="secondary ${agendaFilter === "all" ? "active-filter" : ""}" onclick="setAgendaFilter('all')">Tous</button></div>
        ${agenda.map(agendaItem).join("") || `<div class="empty">Aucun rendez-vous local sur cette période.</div>`}
        ${agendaForm()}
      </div>
    </div>
    <div class="card quick-access"><h2>Accès rapides</h2><div class="row-actions"><button class="secondary" onclick="setView('priorities')">Nouvelle priorité</button><button class="secondary" onclick="setView('actions')">Nouvelle action</button><button class="secondary" onclick="setView('journal')">Nouvelle entrée Journal</button><button class="secondary" onclick="setView('decisions')">Nouvelle décision</button><button class="secondary" onclick="setView('documents')">Nouveau document</button></div></div>
    <div class="grid two">
      <div class="card"><div class="row"><h2>Mes priorités</h2><button class="secondary" onclick="setView('priorities')">Gérer mes priorités</button></div>${priorities.slice(0, 5).map(cockpitPriorityItem).join("") || `<div class="empty">Aucune priorité active.</div>`}</div>
      <div class="card"><h2>Alertes et points d'attention</h2>${alerts.map(cockpitAlertItem).join("") || `<div class="empty">Aucune alerte active.</div>`}</div>
    </div>
    <div class="grid two">
      <div class="card"><h2>Actions à traiter</h2>${actions.map(cockpitActionItem).join("") || `<div class="empty">Aucune action urgente à traiter.</div>`}</div>
      <div class="card"><h2>Managers à suivre</h2>${managers.map(managerMini).join("") || `<div class="empty">Aucun manager à suivre.</div>`}</div>
    </div>
    <div class="grid two">
      <div class="card"><h2>Projets sensibles</h2>${projects.map(cockpitProjectItem).join("") || `<div class="empty">Aucun projet sensible.</div>`}</div>
      <div class="card"><h2>Décisions à suivre</h2>${decisions.map(cockpitDecisionItem).join("") || `<div class="empty">Aucune décision à suivre.</div>`}</div>
    </div>
    <div class="card"><h2>Activité récente</h2>${state.activity.slice(0, 10).map(cockpitActivityItem).join("") || `<div class="empty">Aucune activité récente.</div>`}</div>`);
}

function priorityItem(p) {
  return `<div class="item row"><div><strong>${icons[p.level] || "🟠"} ${esc(p.title)}</strong><span class="muted">${esc(p.due || "Pas d'échéance")}${p.link ? " · " + esc(p.link) : ""}${p.owner ? " · " + esc(p.owner) : ""}</span><span class="meta">ID ${esc(p.id)}</span></div><div class="row-actions"><button class="secondary" onclick="completePriority('${p.id}')">Terminer</button><button class="danger" onclick="deletePriority('${p.id}')">Supprimer</button></div></div>`;
}

function renderPriorities() {
  appHtml(`<div class="card hero"><h2>🎯 Priorités V5</h2><p class="muted">Ajout, suivi, responsabilité, impact et clôture des priorités du cockpit.</p></div><div class="card"><h2>Nouvelle priorité</h2><div class="form-grid"><input id="pTitle" placeholder="Titre" class="full"><input id="pDue" placeholder="Échéance"><input id="pLink" placeholder="Lien"><input id="pOwner" placeholder="Responsable"><select id="pLevel"><option value="green">🟢 Normal</option><option value="orange" selected>🟠 Important</option><option value="red">🔴 Urgent</option></select><textarea id="pImpact" class="full" placeholder="Impact attendu"></textarea></div><button class="action" onclick="addPriority()">Ajouter</button></div><div class="grid two"><div class="card"><h2>Actives</h2>${state.priorities.filter(p => !p.done).map(priorityItem).join("") || `<div class="empty">Aucune priorité active.</div>`}</div><div class="card"><h2>Terminées</h2>${state.priorities.filter(p => p.done).map(priorityItem).join("") || `<div class="empty">Aucune priorité terminée.</div>`}</div></div>`);
}

function addPriority() {
  const title = document.getElementById("pTitle").value.trim();
  if (!title) return;
  const p = { id: newId("priority"), title, due: document.getElementById("pDue").value.trim(), link: document.getElementById("pLink").value.trim(), owner: document.getElementById("pOwner").value.trim(), impact: document.getElementById("pImpact").value.trim(), level: document.getElementById("pLevel").value, done: false };
  state.priorities.unshift(p);
  persist("priorities");
  addActivity("🎯 Priorité", p.title, p.due || p.link, p.id);
  renderPriorities();
}

function completePriority(id) {
  const p = byId("priorities", id);
  if (!p) return;
  p.done = true;
  persist("priorities");
  addActivity("🎯 Priorité terminée", p.title, p.link || "", p.id);
  renderPriorities();
}

function deletePriority(id) {
  const i = indexById("priorities", id);
  if (i < 0 || !confirm("Supprimer cette priorité ?")) return;
  const t = state.priorities[i].title;
  state.priorities.splice(i, 1);
  persist("priorities");
  addActivity("🎯 Priorité supprimée", t);
  renderPriorities();
}

function renderFolders() {
  appHtml(`<div class="card hero"><h2>⭐ Dossiers</h2><p class="muted">Accès rapide aux sujets, projets, managers et mémoire DEOS.</p></div><div class="grid two"><div class="card"><h2>📦 Projets</h2>${state.projects.map(projectMini).join("")}</div><div class="card"><h2>👥 Managers</h2>${state.managers.map(managerMini).join("")}</div><div class="card"><h2>⚖️ Dialogue social</h2><div class="item"><strong>CSE</strong><span class="muted">Questions, réponses, décisions, échéances</span></div><div class="item"><strong>Courriers OS</strong><span class="muted">Réponses, historique, points sensibles</span></div></div><div class="card"><h2>📖 Mémoire</h2><div class="item clickable" onclick="setView('journal')"><strong>Journal</strong><span class="muted">Faits marquants</span></div><div class="item clickable" onclick="setView('decisions')"><strong>Décisions</strong><span class="muted">Contexte et suites</span></div></div></div>`);
}

function renderActions() {
  appHtml(`<div class="card"><h2>Ajouter une action</h2><input id="aTitle" placeholder="Action"><input id="aLink" placeholder="Lien"><button class="action" onclick="addAction()">Ajouter</button></div>${state.actions.map(actionItem).join("") || `<div class="card empty">Aucune action.</div>`}`);
}

function actionItem(a) {
  return `<div class="item row"><div><strong>${a.done ? "✅" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><div class="row-actions"><button class="secondary" onclick="toggleAction('${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button><button class="danger" onclick="deleteAction('${a.id}')">Supprimer</button></div></div>`;
}

function addAction() {
  const title = document.getElementById("aTitle").value.trim();
  if (!title) return;
  const a = { id: newId("action"), title, link: document.getElementById("aLink").value.trim(), done: false };
  state.actions.unshift(a);
  persist("actions");
  addActivity("✅ Action", a.title, a.link, a.id);
  renderActions();
}

function toggleAction(id) {
  const a = byId("actions", id);
  if (!a) return;
  a.done = !a.done;
  persist("actions");
  addActivity("✅ Action modifiée", a.title, a.done ? "Terminée" : "Réouverte", a.id);
  renderActions();
}

function deleteAction(id) {
  const i = indexById("actions", id);
  if (i < 0 || !confirm("Supprimer cette action ?")) return;
  const t = state.actions[i].title;
  state.actions.splice(i, 1);
  persist("actions");
  addActivity("✅ Action supprimée", t);
  renderActions();
}

function managerMini(m) {
  return `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")}</span>${badge(m.status)}</div>`;
}

function idsFromTextarea(id) {
  return lines(id).map(x => x.split("·")[0].trim()).filter(Boolean);
}

function optionLines(items, currentIds, labelFn) {
  const selected = new Set(currentIds || []);
  return items.filter(item => selected.has(item.id)).map(item => `${item.id} · ${labelFn(item)}`).join("\n");
}

function linkedActionsList(m) {
  const linked = state.actions.filter(a => (m.linkedActions || []).includes(a.id));
  return linked.map(a => `<div class="item row"><div><strong>${a.done ? "✅" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><button class="secondary" onclick="toggleLinkedManagerAction('${m.id}','${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || `<div class="empty">Aucune action liée.</div>`;
}

function linkedProjectsList(m) {
  const linked = state.projects.filter(p => (m.linkedProjects || []).includes(p.id));
  return linked.map(p => `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next || "")}</span>${badge(p.status)}<span class="meta">ID ${esc(p.id)}</span></div>`).join("") || `<div class="empty">Aucun projet lié.</div>`;
}

function projectOwnerId(p) {
  if (p.ownerId && byId("managers", p.ownerId)) return p.ownerId;
  const owner = state.managers.find(m => m.name === p.owner || m.id === p.owner);
  return owner ? owner.id : "";
}

function projectOwnerName(p) {
  const owner = byId("managers", p.ownerId) || state.managers.find(m => m.name === p.owner || m.id === p.owner);
  return owner ? owner.name : (p.owner || "");
}

function ownerSelect(id, selectedId = "") {
  return `<select id="${id}"><option value="">Aucun responsable principal</option>${state.managers.map(m => `<option value="${esc(m.id)}" ${selectedId === m.id ? "selected" : ""}>${esc(m.name)} · ${esc(m.role || "")}</option>`).join("")}</select>`;
}

function managerResponsibleProjects(m) {
  return state.projects.filter(p => projectOwnerId(p) === m.id);
}

function managerAssociatedProjects(m) {
  return state.projects.filter(p => projectOwnerId(p) !== m.id && ((p.linkedManagers || []).includes(m.id) || (m.linkedProjects || []).includes(p.id)));
}

function managerProjectItem(p) {
  return `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(labels[p.status] || "À suivre")} · ${Number(p.progress || 0)}% · Échéance ${esc(p.deadline || "À préciser")}</span><span class="meta">Prochaine étape : ${esc(p.next || "À compléter")} · ID ${esc(p.id)}</span></div>`;
}

function managerResponsibleProjectsList(m) {
  const projects = managerResponsibleProjects(m);
  return projects.map(managerProjectItem).join("") || `<div class="empty">Aucun projet sous responsabilité.</div>`;
}

function managerAssociatedProjectsList(m) {
  const projects = managerAssociatedProjects(m);
  return projects.map(managerProjectItem).join("") || `<div class="empty">Aucun autre projet associé.</div>`;
}

function linkedDecisionsList(m) {
  const linked = state.decisions.filter(d => (m.linkedDecisions || []).includes(d.id) || (d.linkedManagers || []).includes(m.id));
  return linked.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.date || "")} · ${(d.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`;
}

function managerTimeline(m) {
  const managerEvents = (m.events || []).map(e => ({ date: e.date || "", title: e.title || "Événement", detail: e.detail || "", kind: "Échange" }));
  const activityEvents = state.activity.filter(a => a.entityId === m.id).map(a => ({ date: a.date || "", title: a.type || "Activité", detail: `${a.title || ""}${a.detail ? " · " + a.detail : ""}`, kind: "Activité" }));
  return [...managerEvents, ...activityEvents].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(e => `<div class="item"><strong>${esc(e.date || "Sans date")} · ${esc(e.title)}</strong><span class="muted">${esc(e.kind)}${e.detail ? " · " + esc(e.detail) : ""}</span></div>`).join("") || `<div class="empty">Aucun échange enregistré.</div>`;
}

function directorNotesList(m) {
  return (m.directorNotes || []).map(n => `<div class="item"><strong>${esc(n.date || "")}</strong><span class="muted">${esc(n.content || "")}</span></div>`).join("") || `<div class="empty">Aucune note du directeur.</div>`;
}

function managerJournalList(m) {
  const linked = state.journal.filter(j => (j.linkedManagers || []).includes(m.id));
  return linked.map(j => `<div class="item clickable" onclick="openJournal('${j.id}')"><strong>${esc(j.title)}</strong><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Journal")}</span><span class="meta">ID ${esc(j.id)}</span></div>`).join("") || `<div class="empty">Aucune entrée Journal liée.</div>`;
}

function renderManagers() {
  document.getElementById("viewTitle").textContent = "Managers V5";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "managers"));
  appHtml(`<div class="card"><h2>Ajouter un manager</h2><input id="mName" placeholder="Nom"><input id="mRole" placeholder="Poste"><select id="mStatus"><option value="green">Maîtrisé</option><option value="orange">À suivre</option><option value="red">Critique</option></select><input id="mPriority" placeholder="Priorité manager"><input id="mNext" placeholder="Prochain entretien"><textarea id="mNote" placeholder="Note"></textarea><button class="action" onclick="addManager()">Ajouter</button></div><div class="grid two">${state.managers.map(managerCard).join("")}</div>`);
}

function managerCard(m) {
  return `<div class="card clickable" onclick="openManager('${m.id}')"><h2>${esc(m.name)}</h2><p>${esc(m.role || "")}</p>${badge(m.status)}<p class="muted">${esc(m.note || "")}</p><span class="meta">ID ${esc(m.id)}</span></div>`;
}

function addManager() {
  const name = document.getElementById("mName").value.trim();
  if (!name) return;
  const m = { id: newId("manager"), name, role: document.getElementById("mRole").value.trim(), status: document.getElementById("mStatus").value, note: document.getElementById("mNote").value.trim(), priority: document.getElementById("mPriority").value.trim(), lastInterview: "", nextMeeting: document.getElementById("mNext").value.trim(), objectives: [], strengths: [], watchPoints: [], actions: [], linkedActions: [], linkedProjects: [], linkedDecisions: [], events: [], directorNotes: [] };
  state.managers.push(m);
  persist("managers");
  addActivity("👤 Manager", m.name, m.role, m.id);
  renderManagers();
}

function managerQuickForm(m, mode = "") {
  if (mode === "note") return `<div class="card full-span"><h2>Ajouter une note du directeur</h2><textarea id="mnContent" placeholder="Note du directeur"></textarea><button class="action" onclick="saveManagerNote('${m.id}')">Enregistrer</button><button class="secondary" onclick="openManager('${m.id}')">Annuler</button></div>`;
  if (mode === "event") return `<div class="card full-span"><h2>Ajouter un événement</h2><div class="form-grid"><input id="meTitle" placeholder="Titre de l'événement"><input id="meDate" value="${esc(new Date().toLocaleString("fr-FR"))}" placeholder="Date"></div><textarea id="meDetail" placeholder="Détail de l'événement"></textarea><button class="action" onclick="saveManagerEvent('${m.id}')">Enregistrer</button><button class="secondary" onclick="openManager('${m.id}')">Annuler</button></div>`;
  return "";
}

function openManager(id, mode = "") {
  const m = byId("managers", id);
  if (!m) return renderManagers();
  const responsibleCount = managerResponsibleProjects(m).length;
  document.getElementById("viewTitle").textContent = m.name;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderManagers()">Retour Managers</button><h2>${esc(m.name)}</h2><p>${esc(m.role || "")}</p>${badge(m.status)}<p class="muted">${esc(m.note || "")}</p><span class="meta">ID ${esc(m.id)} · ${responsibleCount} projet(s) sous responsabilité</span><div class="row-actions"><button class="action" onclick="editManager('${m.id}')">Modifier</button><button class="secondary" onclick="openManager('${m.id}','note')">Ajouter une note</button><button class="secondary" onclick="openManager('${m.id}','event')">Ajouter un événement</button><button class="danger" onclick="deleteManager('${m.id}')">Supprimer</button></div></div><div class="grid two">${managerQuickForm(m, mode)}<div class="card"><h2>Priorité managériale</h2><p>${esc(m.priority || "À compléter")}</p></div><div class="card"><h2>Entretiens</h2><p><strong>Dernier :</strong> ${esc(m.lastInterview || "À compléter")}</p><p><strong>Prochaine rencontre :</strong> ${esc(m.nextMeeting || "À planifier")}</p></div><div class="card full-span"><h2>Rendez-vous liés</h2>${managerAgendaList(m)}</div><div class="card full-span"><h2>Projets sous ma responsabilité</h2>${managerResponsibleProjectsList(m)}</div><div class="card full-span"><h2>Autres projets associés</h2>${managerAssociatedProjectsList(m)}</div><div class="card"><h2>Objectifs en cours</h2>${listItems(m.objectives)}</div><div class="card"><h2>Points forts</h2>${listItems(m.strengths)}</div><div class="card"><h2>Points de vigilance</h2>${listItems(m.watchPoints)}</div><div class="card"><h2>Actions internes</h2>${listItems(m.actions, "⬜ ")}</div><div class="card"><h2>Actions liées</h2>${linkedActionsList(m)}</div><div class="card"><h2>Décisions liées</h2>${linkedDecisionsList(m)}</div><div class="card"><h2>Journal lié</h2>${managerJournalList(m)}</div><div class="card"><h2>Notes du directeur</h2>${directorNotesList(m)}</div><div class="card full-span"><h2>Historique chronologique</h2>${managerTimeline(m)}</div></div>`);
}

function editManager(id) {
  const m = byId("managers", id);
  if (!m) return;
  document.getElementById("viewTitle").textContent = "Modifier " + m.name;
  appHtml(`<div class="card"><h2>Modifier manager</h2><div class="form-grid"><input id="emName" value="${esc(m.name)}" placeholder="Nom"><input id="emRole" value="${esc(m.role || "")}" placeholder="Fonction"><select id="emStatus"><option value="green" ${m.status === "green" ? "selected" : ""}>Maîtrisé</option><option value="orange" ${m.status === "orange" ? "selected" : ""}>À suivre</option><option value="red" ${m.status === "red" ? "selected" : ""}>Critique</option></select><input id="emPriority" value="${esc(m.priority || "")}" placeholder="Priorité managériale"><input id="emLast" value="${esc(m.lastInterview || "")}" placeholder="Date du dernier entretien"><input id="emNext" value="${esc(m.nextMeeting || "")}" placeholder="Date de la prochaine rencontre"></div><textarea id="emNote" placeholder="Note de synthèse">${esc(m.note || "")}</textarea><textarea id="emObjectives" placeholder="Objectifs en cours, un par ligne">${esc((m.objectives || []).join("\n"))}</textarea><textarea id="emStrengths" placeholder="Points forts, un par ligne">${esc((m.strengths || []).join("\n"))}</textarea><textarea id="emWatch" placeholder="Points de vigilance, un par ligne">${esc((m.watchPoints || []).join("\n"))}</textarea><textarea id="emActions" placeholder="Actions internes, une par ligne">${esc((m.actions || []).join("\n"))}</textarea><div class="grid three manager-links"><div><label>Actions liées par ID</label><textarea id="emLinkedActions" placeholder="Un ID action par ligne">${esc(optionLines(state.actions, m.linkedActions, a => a.title))}</textarea></div><div><label>Projets liés par ID</label><textarea id="emLinkedProjects" placeholder="Un ID projet par ligne">${esc(optionLines(state.projects, m.linkedProjects, p => p.name))}</textarea></div><div><label>Décisions liées par ID</label><textarea id="emLinkedDecisions" placeholder="Un ID décision par ligne">${esc(optionLines(state.decisions, m.linkedDecisions, d => d.title))}</textarea></div></div><button class="action" onclick="saveManager('${m.id}')">Enregistrer</button><button class="secondary" onclick="openManager('${m.id}')">Annuler</button></div>`);
}

function saveManager(id) {
  const i = indexById("managers", id);
  if (i < 0) return;
  state.managers[i] = { ...state.managers[i], name: document.getElementById("emName").value.trim(), role: document.getElementById("emRole").value.trim(), status: document.getElementById("emStatus").value, note: document.getElementById("emNote").value.trim(), priority: document.getElementById("emPriority").value.trim(), lastInterview: document.getElementById("emLast").value.trim(), nextMeeting: document.getElementById("emNext").value.trim(), objectives: lines("emObjectives"), strengths: lines("emStrengths"), watchPoints: lines("emWatch"), actions: lines("emActions"), linkedActions: idsFromTextarea("emLinkedActions").filter(actionId => byId("actions", actionId)), linkedProjects: idsFromTextarea("emLinkedProjects").filter(projectId => byId("projects", projectId)), linkedDecisions: idsFromTextarea("emLinkedDecisions").filter(decisionId => byId("decisions", decisionId)) };
  persist("managers");
  addActivity("👤 Manager modifié", state.managers[i].name, state.managers[i].role, id);
  openManager(id);
}

function saveManagerNote(id) {
  const m = byId("managers", id);
  if (!m) return;
  const content = document.getElementById("mnContent").value;
  if (!content || !content.trim()) return;
  m.directorNotes.unshift({ id: newId("note"), date: new Date().toLocaleString("fr-FR"), content: content.trim() });
  persist("managers");
  addActivity("📝 Note manager", m.name, content.trim(), id);
  openManager(id);
}

function saveManagerEvent(id) {
  const m = byId("managers", id);
  if (!m) return;
  const title = document.getElementById("meTitle").value;
  if (!title || !title.trim()) return;
  const detail = document.getElementById("meDetail").value || "";
  const date = document.getElementById("meDate").value.trim() || new Date().toLocaleString("fr-FR");
  m.events.unshift({ id: newId("event"), date, title: title.trim(), detail: detail.trim() });
  persist("managers");
  addActivity("📍 Événement manager", m.name, title.trim(), id);
  openManager(id);
}

function toggleLinkedManagerAction(managerId, actionId) {
  const a = byId("actions", actionId);
  const m = byId("managers", managerId);
  if (!a || !m) return;
  a.done = !a.done;
  persist("actions");
  addActivity("✅ Action liée modifiée", a.title, a.done ? "Terminée" : "Réouverte", managerId);
  openManager(managerId);
}

function deleteManager(id) {
  const i = indexById("managers", id);
  if (i < 0 || !confirm("Supprimer ce manager ?")) return;
  const t = state.managers[i].name;
  state.managers.splice(i, 1);
  persist("managers");
  addActivity("👤 Manager supprimé", t);
  renderManagers();
}

function projectMini(p) {
  return `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next || "")}</span>${badge(p.status)}</div>`;
}

function renderProjects() {
  document.getElementById("viewTitle").textContent = "Projets V5";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "projects"));
  appHtml(`<div class="card"><h2>Ajouter un projet</h2><input id="prName" placeholder="Nom"><input id="prNext" placeholder="Prochaine étape"><div class="form-grid"><div><label>Responsable principal</label>${ownerSelect("prOwnerId")}</div><input id="prDeadline" placeholder="Échéance"><input id="prProgress" type="number" min="0" max="100" value="0"><select id="prStatus"><option value="green">Maîtrisé</option><option value="orange">À suivre</option><option value="red">Critique</option></select></div><button class="action" onclick="addProject()">Ajouter</button></div><div class="grid two">${state.projects.map(projectCard).join("")}</div>`);
}

function projectCard(p) {
  const owner = projectOwnerName(p);
  return `<div class="card clickable" onclick="openProject('${p.id}')"><h2>${esc(p.name)}</h2>${badge(p.status)}<p>${esc(p.next || "")}</p><div class="progress"><span style="width:${Number(p.progress || 0)}%"></span></div><span class="muted">${Number(p.progress || 0)}%${owner ? " · " + esc(owner) : ""}</span><span class="meta">ID ${esc(p.id)}</span></div>`;
}

function addProject() {
  const name = document.getElementById("prName").value.trim();
  if (!name) return;
  const ownerId = document.getElementById("prOwnerId").value;
  const owner = byId("managers", ownerId)?.name || "";
  const p = { id: newId("project"), name, next: document.getElementById("prNext").value.trim(), owner, ownerId, deadline: document.getElementById("prDeadline").value.trim(), progress: Number(document.getElementById("prProgress").value || 0), status: document.getElementById("prStatus").value, objective: "", linkedManagers: [], launchDate: "", priorityLevel: "orange", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [] };
  state.projects.push(p);
  persist("projects");
  addActivity("📦 Projet", p.name, p.next, p.id);
  renderProjects();
}

function checkboxList(id, items, selectedIds, labelFn) {
  const selected = new Set(selectedIds || []);
  return `<div id="${id}" class="check-list">${items.map(item => `<label class="check-row"><input type="checkbox" value="${esc(item.id)}" ${selected.has(item.id) ? "checked" : ""}> <span>${esc(labelFn(item))}</span><small>${esc(item.id)}</small></label>`).join("") || `<div class="empty">Aucune donnée disponible.</div>`}</div>`;
}

function checkedValues(id) {
  return [...document.querySelectorAll(`#${id} input:checked`)].map(x => x.value);
}

function projectManagersList(p) {
  const linked = state.managers.filter(m => (p.linkedManagers || []).includes(m.id));
  return linked.map(m => `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")}</span>${badge(m.status)}<span class="meta">ID ${esc(m.id)}</span></div>`).join("") || `<div class="empty">Aucun manager associé.</div>`;
}

function projectActionsList(p) {
  const linked = state.actions.filter(a => (p.linkedActions || []).includes(a.id));
  return linked.map(a => `<div class="item row"><div><strong>${a.done ? "✅" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><button class="secondary" onclick="toggleLinkedProjectAction('${p.id}','${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || `<div class="empty">Aucune action liée.</div>`;
}

function projectDecisionsList(p) {
  const linked = state.decisions.filter(d => (p.linkedDecisions || []).includes(d.id) || (d.linkedProjects || []).includes(p.id));
  return linked.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.date || "")} · ${(d.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`;
}

function projectDocumentsList(p) {
  const linked = state.documents.filter(d => (p.linkedDocuments || []).includes(d.id));
  return linked.map(d => `<div class="item"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")}${d.status ? " · " + esc(d.status) : ""}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`;
}

function projectMilestonesList(p) {
  return (p.milestones || []).map(m => `<div class="item"><strong>${esc(m.title)}</strong><span class="muted">${esc(m.date || "Sans date")} · ${esc(m.status || "À suivre")}</span><span class="meta">ID ${esc(m.id)}</span></div>`).join("") || `<div class="empty">Aucun jalon.</div>`;
}

function projectTimeline(p) {
  const projectEvents = (p.events || []).map(e => ({ date: e.date || "", title: e.title || "Événement", detail: e.detail || "", kind: "Événement" }));
  const milestones = (p.milestones || []).map(m => ({ date: m.date || "", title: m.title || "Jalon", detail: m.status || "", kind: "Jalon" }));
  const activityEvents = state.activity.filter(a => a.entityId === p.id).map(a => ({ date: a.date || "", title: a.type || "Activité", detail: `${a.title || ""}${a.detail ? " · " + a.detail : ""}`, kind: "Activité" }));
  return [...projectEvents, ...milestones, ...activityEvents].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(e => `<div class="item"><strong>${esc(e.date || "Sans date")} · ${esc(e.title)}</strong><span class="muted">${esc(e.kind)}${e.detail ? " · " + esc(e.detail) : ""}</span></div>`).join("") || `<div class="empty">Aucun historique.</div>`;
}

function projectNotesList(p) {
  return (p.directorNotes || []).map(n => `<div class="item"><strong>${esc(n.date || "")}</strong><span class="muted">${esc(n.content || "")}</span></div>`).join("") || `<div class="empty">Aucune note du directeur.</div>`;
}

function projectJournalList(p) {
  const linked = state.journal.filter(j => (j.linkedProjects || []).includes(p.id));
  return linked.map(j => `<div class="item clickable" onclick="openJournal('${j.id}')"><strong>${esc(j.title)}</strong><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Journal")}</span><span class="meta">ID ${esc(j.id)}</span></div>`).join("") || `<div class="empty">Aucune entrée Journal liée.</div>`;
}

function projectQuickForm(p, mode = "") {
  if (mode === "milestone") return `<div class="card full-span"><h2>Ajouter un jalon</h2><div class="form-grid"><input id="pmTitle" placeholder="Titre du jalon"><input id="pmDate" placeholder="Date cible"><input id="pmStatus" class="full" placeholder="Statut" value="À suivre"></div><button class="action" onclick="saveProjectMilestone('${p.id}')">Enregistrer</button><button class="secondary" onclick="openProject('${p.id}')">Annuler</button></div>`;
  if (mode === "note") return `<div class="card full-span"><h2>Ajouter une note du directeur</h2><textarea id="pnContent" placeholder="Note du directeur"></textarea><button class="action" onclick="saveProjectNote('${p.id}')">Enregistrer</button><button class="secondary" onclick="openProject('${p.id}')">Annuler</button></div>`;
  if (mode === "event") return `<div class="card full-span"><h2>Ajouter un événement</h2><div class="form-grid"><input id="peTitle" placeholder="Titre de l'événement"><input id="peDate" value="${esc(new Date().toLocaleString("fr-FR"))}" placeholder="Date"></div><textarea id="peDetail" placeholder="Détail de l'événement"></textarea><button class="action" onclick="saveProjectEvent('${p.id}')">Enregistrer</button><button class="secondary" onclick="openProject('${p.id}')">Annuler</button></div>`;
  return "";
}

function openProject(id, mode = "") {
  const p = byId("projects", id);
  if (!p) return renderProjects();
  document.getElementById("viewTitle").textContent = p.name;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderProjects()">Retour Projets</button><h2>${esc(p.name)}</h2>${badge(p.status)}<p>${esc(p.objective || p.next || "")}</p><span class="meta">ID ${esc(p.id)}</span><div class="row-actions"><button class="action" onclick="editProject('${p.id}')">Modifier</button><button class="secondary" onclick="openProject('${p.id}','milestone')">Ajouter un jalon</button><button class="secondary" onclick="openProject('${p.id}','note')">Ajouter une note</button><button class="secondary" onclick="openProject('${p.id}','event')">Ajouter un événement</button><button class="danger" onclick="deleteProject('${p.id}')">Supprimer</button></div></div><div class="grid two">${projectQuickForm(p, mode)}<div class="card"><h2>Avancement</h2><div class="progress"><span style="width:${Number(p.progress || 0)}%"></span></div><p>${Number(p.progress || 0)}%</p><div class="row"><input id="quickProgress" type="number" min="0" max="100" value="${Number(p.progress || 0)}"><button class="secondary" onclick="updateProjectProgress('${p.id}')">Mettre à jour</button></div></div><div class="card"><h2>Pilotage</h2><p><strong>Responsable :</strong> ${esc(projectOwnerName(p) || "À compléter")}</p><p><strong>Lancement :</strong> ${esc(p.launchDate || "À compléter")}</p><p><strong>Échéance :</strong> ${esc(p.deadline || "À préciser")}</p><p><strong>Priorité :</strong> ${icons[p.priorityLevel] || ""} ${esc(labels[p.priorityLevel] || p.priorityLevel || "À suivre")}</p></div><div class="card full-span"><h2>Rendez-vous liés</h2>${projectAgendaList(p)}</div><div class="card"><h2>Objectif</h2><p>${esc(p.objective || "À compléter")}</p></div><div class="card"><h2>Contexte</h2><p>${esc(p.context || "À compléter")}</p></div><div class="card"><h2>Prochaine étape</h2><p>${esc(p.next || "À compléter")}</p></div><div class="card"><h2>Risques et points de vigilance</h2><p>${esc(p.risks || "À compléter")}</p></div><div class="card"><h2>Managers associés</h2>${projectManagersList(p)}</div><div class="card"><h2>Jalons</h2>${projectMilestonesList(p)}</div><div class="card"><h2>Actions liées</h2>${projectActionsList(p)}${p.actions ? `<p class="muted">${esc(p.actions)}</p>` : ""}</div><div class="card"><h2>Décisions liées</h2>${projectDecisionsList(p)}${p.decisions ? `<p class="muted">${esc(p.decisions)}</p>` : ""}</div><div class="card"><h2>Journal lié</h2>${projectJournalList(p)}</div><div class="card"><h2>Documents liés</h2>${projectDocumentsList(p)}</div><div class="card"><h2>Notes du directeur</h2>${projectNotesList(p)}</div><div class="card full-span"><h2>Historique chronologique</h2>${projectTimeline(p)}</div></div>`);
}

function editProject(id) {
  const p = byId("projects", id);
  if (!p) return;
  document.getElementById("viewTitle").textContent = "Modifier " + p.name;
  appHtml(`<div class="card"><h2>Modifier projet</h2><input id="epName" value="${esc(p.name)}" placeholder="Nom du projet"><div class="form-grid"><select id="epStatus"><option value="green" ${p.status === "green" ? "selected" : ""}>Maîtrisé</option><option value="orange" ${p.status === "orange" ? "selected" : ""}>À suivre</option><option value="red" ${p.status === "red" ? "selected" : ""}>Critique</option></select><input id="epProgress" type="number" min="0" max="100" value="${Number(p.progress || 0)}"><div><label>Responsable principal</label>${ownerSelect("epOwnerId", projectOwnerId(p))}</div><input id="epLaunch" value="${esc(p.launchDate || "")}" placeholder="Date de lancement"><input id="epDeadline" value="${esc(p.deadline || "")}" placeholder="Échéance cible"><select id="epPriority"><option value="green" ${p.priorityLevel === "green" ? "selected" : ""}>Priorité normale</option><option value="orange" ${p.priorityLevel === "orange" ? "selected" : ""}>Priorité importante</option><option value="red" ${p.priorityLevel === "red" ? "selected" : ""}>Priorité critique</option></select><input id="epNext" value="${esc(p.next || "")}" placeholder="Prochaine étape" class="full"></div><textarea id="epObjective" placeholder="Objectif">${esc(p.objective || "")}</textarea><textarea id="epContext" placeholder="Contexte">${esc(p.context || "")}</textarea><textarea id="epRisks" placeholder="Risques et points de vigilance">${esc(p.risks || "")}</textarea><textarea id="epDecisionsNote" placeholder="Note libre sur les décisions liées">${esc(p.decisions || "")}</textarea><textarea id="epActionsNote" placeholder="Note libre sur les actions liées">${esc(p.actions || "")}</textarea><div class="grid two manager-links"><div><label>Managers associés</label>${checkboxList("epManagers", state.managers, p.linkedManagers, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Actions liées</label>${checkboxList("epActionsLinked", state.actions, p.linkedActions, a => a.title)}</div><div><label>Décisions liées</label>${checkboxList("epDecisionsLinked", state.decisions, p.linkedDecisions, d => d.title)}</div><div><label>Documents liés</label>${checkboxList("epDocumentsLinked", state.documents, p.linkedDocuments, d => d.title)}</div></div><button class="action" onclick="saveProject('${p.id}')">Enregistrer</button><button class="secondary" onclick="openProject('${p.id}')">Annuler</button></div>`);
}

function saveProject(id) {
  const i = indexById("projects", id);
  if (i < 0) return;
  const ownerId = document.getElementById("epOwnerId").value;
  const owner = byId("managers", ownerId)?.name || "";
  state.projects[i] = { ...state.projects[i], name: document.getElementById("epName").value.trim(), status: document.getElementById("epStatus").value, progress: Number(document.getElementById("epProgress").value || 0), owner, ownerId, launchDate: document.getElementById("epLaunch").value.trim(), deadline: document.getElementById("epDeadline").value.trim(), priorityLevel: document.getElementById("epPriority").value, next: document.getElementById("epNext").value.trim(), objective: document.getElementById("epObjective").value.trim(), context: document.getElementById("epContext").value.trim(), risks: document.getElementById("epRisks").value.trim(), decisions: document.getElementById("epDecisionsNote").value.trim(), actions: document.getElementById("epActionsNote").value.trim(), linkedManagers: checkedValues("epManagers"), linkedActions: checkedValues("epActionsLinked"), linkedDecisions: checkedValues("epDecisionsLinked"), linkedDocuments: checkedValues("epDocumentsLinked") };
  persist("projects");
  addActivity("📦 Projet modifié", state.projects[i].name, state.projects[i].next, id);
  openProject(id);
}

function updateProjectProgress(id) {
  const p = byId("projects", id);
  if (!p) return;
  p.progress = Math.max(0, Math.min(100, Number(document.getElementById("quickProgress").value || 0)));
  persist("projects");
  addActivity("📈 Avancement projet", p.name, `${p.progress}%`, id);
  openProject(id);
}

function saveProjectMilestone(id) {
  const p = byId("projects", id);
  if (!p) return;
  const title = document.getElementById("pmTitle").value.trim();
  if (!title) return;
  p.milestones.unshift({ id: newId("mile"), title, date: document.getElementById("pmDate").value.trim(), status: document.getElementById("pmStatus").value.trim() || "À suivre" });
  persist("projects");
  addActivity("🚩 Jalon projet", p.name, title, id);
  openProject(id);
}

function saveProjectNote(id) {
  const p = byId("projects", id);
  if (!p) return;
  const content = document.getElementById("pnContent").value.trim();
  if (!content) return;
  p.directorNotes.unshift({ id: newId("note"), date: new Date().toLocaleString("fr-FR"), content });
  persist("projects");
  addActivity("📝 Note projet", p.name, content, id);
  openProject(id);
}

function saveProjectEvent(id) {
  const p = byId("projects", id);
  if (!p) return;
  const title = document.getElementById("peTitle").value.trim();
  if (!title) return;
  p.events.unshift({ id: newId("event"), date: document.getElementById("peDate").value.trim() || new Date().toLocaleString("fr-FR"), title, detail: document.getElementById("peDetail").value.trim() });
  persist("projects");
  addActivity("📍 Événement projet", p.name, title, id);
  openProject(id);
}

function toggleLinkedProjectAction(projectId, actionId) {
  const a = byId("actions", actionId);
  const p = byId("projects", projectId);
  if (!a || !p) return;
  a.done = !a.done;
  persist("actions");
  addActivity("✅ Action projet modifiée", a.title, a.done ? "Terminée" : "Réouverte", projectId);
  openProject(projectId);
}

function deleteProject(id) {
  const i = indexById("projects", id);
  if (i < 0 || !confirm("Supprimer ce projet ?")) return;
  const t = state.projects[i].name;
  state.projects.splice(i, 1);
  persist("projects");
  addActivity("📦 Projet supprimé", t);
  renderProjects();
}

const decisionStatusLabels = { decided: "Décidée", applying: "En cours d'application", applied: "Appliquée", review: "À réexaminer" };

function decisionStatusLabel(status) {
  return decisionStatusLabels[status] || status || "Décidée";
}

function decisionManagersList(d) {
  const linked = state.managers.filter(m => (d.linkedManagers || []).includes(m.id));
  return linked.map(m => `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")}</span>${badge(m.status)}<span class="meta">ID ${esc(m.id)}</span></div>`).join("") || `<div class="empty">Aucun manager concerné.</div>`;
}

function decisionProjectsList(d) {
  const linked = state.projects.filter(p => (d.linkedProjects || []).includes(p.id));
  return linked.map(p => `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next || "")}</span>${badge(p.status)}<span class="meta">ID ${esc(p.id)}</span></div>`).join("") || `<div class="empty">Aucun projet concerné.</div>`;
}

function decisionActionsList(d) {
  const linked = state.actions.filter(a => (d.linkedActions || []).includes(a.id));
  return linked.map(a => `<div class="item row"><div><strong>${a.done ? "✅" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><button class="secondary" onclick="toggleLinkedDecisionAction('${d.id}','${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || `<div class="empty">Aucune action générée.</div>`;
}

function decisionDocumentsList(d) {
  const linked = state.documents.filter(doc => (d.linkedDocuments || []).includes(doc.id));
  return linked.map(doc => `<div class="item"><strong>${esc(doc.title)}</strong><span class="muted">${esc(doc.type || "")}${doc.status ? " · " + esc(doc.status) : ""}</span><span class="meta">ID ${esc(doc.id)}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`;
}

function decisionTimeline(d) {
  const events = (d.events || []).map(e => ({ date: e.date || "", title: e.title || "Événement", detail: e.detail || "", kind: "Événement" }));
  const activities = state.activity.filter(a => a.entityId === d.id).map(a => ({ date: a.date || "", title: a.type || "Activité", detail: `${a.title || ""}${a.detail ? " · " + a.detail : ""}`, kind: "Activité" }));
  return [...events, ...activities].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(e => `<div class="item"><strong>${esc(e.date || "Sans date")} · ${esc(e.title)}</strong><span class="muted">${esc(e.kind)}${e.detail ? " · " + esc(e.detail) : ""}</span></div>`).join("") || `<div class="empty">Aucun historique.</div>`;
}

function decisionNotesList(d) {
  return (d.directorNotes || []).map(n => `<div class="item"><strong>${esc(n.date || "")}</strong><span class="muted">${esc(n.content || "")}</span></div>`).join("") || `<div class="empty">Aucune note du directeur.</div>`;
}

function decisionJournalList(d) {
  const linked = state.journal.filter(j => (j.linkedDecisions || []).includes(d.id));
  return linked.map(j => `<div class="item clickable" onclick="openJournal('${j.id}')"><strong>${esc(j.title)}</strong><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Journal")}</span><span class="meta">ID ${esc(j.id)}</span></div>`).join("") || `<div class="empty">Aucune entrée Journal liée.</div>`;
}

function decisionQuickForm(d, mode = "") {
  if (mode === "note") return `<div class="card full-span"><h2>Ajouter une note du directeur</h2><textarea id="dnContent" placeholder="Note du directeur"></textarea><button class="action" onclick="saveDecisionNote('${d.id}')">Enregistrer</button><button class="secondary" onclick="openDecision('${d.id}')">Annuler</button></div>`;
  if (mode === "event") return `<div class="card full-span"><h2>Ajouter un événement</h2><div class="form-grid"><input id="deTitle" placeholder="Titre de l'événement"><input id="deDate" value="${esc(new Date().toLocaleString("fr-FR"))}" placeholder="Date"></div><textarea id="deDetail" placeholder="Détail de l'événement"></textarea><button class="action" onclick="saveDecisionEvent('${d.id}')">Enregistrer</button><button class="secondary" onclick="openDecision('${d.id}')">Annuler</button></div>`;
  if (mode === "action") return `<div class="card full-span"><h2>Créer une action liée</h2><input id="daTitle" placeholder="Action à créer"><div class="grid two manager-links"><div><label>Managers concernés par l'action</label>${checkboxList("daManagers", state.managers, d.linkedManagers, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets concernés par l'action</label>${checkboxList("daProjects", state.projects, d.linkedProjects, p => p.name)}</div></div><button class="action" onclick="saveDecisionAction('${d.id}')">Enregistrer</button><button class="secondary" onclick="openDecision('${d.id}')">Annuler</button></div>`;
  return "";
}

function renderDecisions() {
  document.getElementById("viewTitle").textContent = "Décisions V5";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "decisions"));
  appHtml(`<div class="card"><h2>Ajouter une décision</h2><input id="dTitle" placeholder="Titre"><textarea id="dContext" placeholder="Contexte"></textarea><div class="form-grid"><input id="dOwner" placeholder="Responsable du suivi"><input id="dNext" placeholder="Suite attendue"><input id="dImpact" placeholder="Impacts attendus" class="full"><input id="dTags" placeholder="Mots-clés séparés par virgule" class="full"></div><button class="action" onclick="addDecision()">Ajouter</button></div>${state.decisions.map(decisionCard).join("") || `<div class="card empty">Aucune décision.</div>`}`);
}

function decisionCard(d) {
  return `<div class="card clickable" onclick="openDecision('${d.id}')"><h2>${esc(d.title)}</h2><p>${esc(d.context || "")}</p><span class="muted">${esc(d.date || "")} · ${esc(decisionStatusLabel(d.status))} · ${(d.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(d.id)}</span></div>`;
}

function addDecision() {
  const title = document.getElementById("dTitle").value.trim();
  if (!title) return;
  const d = { id: newId("decision"), title, context: document.getElementById("dContext").value.trim(), date: today(), status: "decided", importance: "orange", problem: "", decision: "", rationale: "", alternatives: "", impacts: document.getElementById("dImpact").value.trim(), risks: "", owner: document.getElementById("dOwner").value.trim(), linkedManagers: [], linkedProjects: [], linkedActions: [], reviewDate: "", linkedDocuments: [], events: [], directorNotes: [], nextStep: document.getElementById("dNext").value.trim(), tags: splitTags(document.getElementById("dTags").value) };
  state.decisions.unshift(d);
  persist("decisions");
  addActivity("📌 Décision", d.title, d.context, d.id);
  renderDecisions();
}

function openDecision(id, mode = "") {
  const d = byId("decisions", id);
  if (!d) return renderDecisions();
  document.getElementById("viewTitle").textContent = d.title;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderDecisions()">Retour Décisions</button><h2>${esc(d.title)}</h2><p>${esc(d.context || "")}</p><span class="muted">${esc(d.date || "")} · ${esc(decisionStatusLabel(d.status))}</span><span class="meta">ID ${esc(d.id)}</span><div class="row-actions"><button class="action" onclick="editDecision('${d.id}')">Modifier</button><button class="secondary" onclick="openDecision('${d.id}','note')">Ajouter une note</button><button class="secondary" onclick="openDecision('${d.id}','event')">Ajouter un événement</button><button class="secondary" onclick="openDecision('${d.id}','action')">Créer une action liée</button><button class="danger" onclick="deleteDecision('${d.id}')">Supprimer</button></div></div><div class="grid two">${decisionQuickForm(d, mode)}<div class="card"><h2>Statut et importance</h2><p><strong>Statut :</strong> ${esc(decisionStatusLabel(d.status))}</p><p><strong>Importance :</strong> ${icons[d.importance] || ""} ${esc(labels[d.importance] || d.importance || "Important")}</p><p><strong>Réexamen :</strong> ${esc(d.reviewDate || "À préciser")}</p></div><div class="card"><h2>Responsable du suivi</h2><p>${esc(d.owner || "À compléter")}</p></div><div class="card"><h2>Problème ou besoin initial</h2><p>${esc(d.problem || "À compléter")}</p></div><div class="card"><h2>Décision prise</h2><p>${esc(d.decision || d.nextStep || "À compléter")}</p></div><div class="card"><h2>Raisons et critères</h2><p>${esc(d.rationale || "À compléter")}</p></div><div class="card"><h2>Alternatives étudiées</h2><p>${esc(d.alternatives || "À compléter")}</p></div><div class="card"><h2>Impacts attendus</h2><p>${esc(d.impacts || d.impact || "À compléter")}</p></div><div class="card"><h2>Risques et points de vigilance</h2><p>${esc(d.risks || "À compléter")}</p></div><div class="card"><h2>Managers concernés</h2>${decisionManagersList(d)}</div><div class="card"><h2>Projets concernés</h2>${decisionProjectsList(d)}</div><div class="card"><h2>Actions générées</h2>${decisionActionsList(d)}</div><div class="card"><h2>Journal lié</h2>${decisionJournalList(d)}</div><div class="card"><h2>Documents liés</h2>${decisionDocumentsList(d)}</div><div class="card"><h2>Notes du directeur</h2>${decisionNotesList(d)}</div><div class="card"><h2>Mots-clés</h2>${listItems(d.tags)}</div><div class="card full-span"><h2>Historique chronologique</h2>${decisionTimeline(d)}</div></div>`);
}

function editDecision(id) {
  const d = byId("decisions", id);
  if (!d) return;
  document.getElementById("viewTitle").textContent = "Modifier " + d.title;
  appHtml(`<div class="card"><h2>Modifier décision</h2><input id="edTitle" value="${esc(d.title)}" placeholder="Titre"><div class="form-grid"><input id="edDate" value="${esc(d.date || "")}" placeholder="Date de décision"><select id="edStatus"><option value="decided" ${d.status === "decided" ? "selected" : ""}>Décidée</option><option value="applying" ${d.status === "applying" ? "selected" : ""}>En cours d'application</option><option value="applied" ${d.status === "applied" ? "selected" : ""}>Appliquée</option><option value="review" ${d.status === "review" ? "selected" : ""}>À réexaminer</option></select><select id="edImportance"><option value="green" ${d.importance === "green" ? "selected" : ""}>Normal</option><option value="orange" ${d.importance === "orange" ? "selected" : ""}>Important</option><option value="red" ${d.importance === "red" ? "selected" : ""}>Critique</option></select><input id="edOwner" value="${esc(d.owner || "")}" placeholder="Responsable du suivi"><input id="edReview" value="${esc(d.reviewDate || "")}" placeholder="Échéance de réexamen"><input id="edTags" value="${esc((d.tags || []).join(", "))}" placeholder="Mots-clés" class="full"></div><textarea id="edContext" placeholder="Contexte">${esc(d.context || "")}</textarea><textarea id="edProblem" placeholder="Problème ou besoin initial">${esc(d.problem || "")}</textarea><textarea id="edDecisionText" placeholder="Décision prise">${esc(d.decision || "")}</textarea><textarea id="edRationale" placeholder="Raisons et critères">${esc(d.rationale || "")}</textarea><textarea id="edAlternatives" placeholder="Alternatives étudiées">${esc(d.alternatives || "")}</textarea><textarea id="edImpacts" placeholder="Impacts attendus">${esc(d.impacts || d.impact || "")}</textarea><textarea id="edRisks" placeholder="Risques et points de vigilance">${esc(d.risks || "")}</textarea><textarea id="edNext" placeholder="Suite attendue">${esc(d.nextStep || "")}</textarea><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("edManagers", state.managers, d.linkedManagers, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("edProjects", state.projects, d.linkedProjects, p => p.name)}</div><div><label>Actions générées</label>${checkboxList("edActions", state.actions, d.linkedActions, a => a.title)}</div><div><label>Documents liés</label>${checkboxList("edDocuments", state.documents, d.linkedDocuments, doc => doc.title)}</div></div><button class="action" onclick="saveDecision('${d.id}')">Enregistrer</button><button class="secondary" onclick="openDecision('${d.id}')">Annuler</button></div>`);
}

function syncDecisionBacklinks(d) {
  state.managers.forEach(m => {
    m.linkedDecisions = ensureArray(m.linkedDecisions);
    const has = m.linkedDecisions.includes(d.id);
    if ((d.linkedManagers || []).includes(m.id) && !has) m.linkedDecisions.push(d.id);
    if (!(d.linkedManagers || []).includes(m.id) && has) m.linkedDecisions = m.linkedDecisions.filter(x => x !== d.id);
  });
  state.projects.forEach(p => {
    p.linkedDecisions = ensureArray(p.linkedDecisions);
    const has = p.linkedDecisions.includes(d.id);
    if ((d.linkedProjects || []).includes(p.id) && !has) p.linkedDecisions.push(d.id);
    if (!(d.linkedProjects || []).includes(p.id) && has) p.linkedDecisions = p.linkedDecisions.filter(x => x !== d.id);
  });
  persist("managers");
  persist("projects");
}

function saveDecision(id) {
  const i = indexById("decisions", id);
  if (i < 0) return;
  state.decisions[i] = { ...state.decisions[i], title: document.getElementById("edTitle").value.trim(), date: document.getElementById("edDate").value.trim(), status: document.getElementById("edStatus").value, importance: document.getElementById("edImportance").value, owner: document.getElementById("edOwner").value.trim(), reviewDate: document.getElementById("edReview").value.trim(), tags: splitTags(document.getElementById("edTags").value), context: document.getElementById("edContext").value.trim(), problem: document.getElementById("edProblem").value.trim(), decision: document.getElementById("edDecisionText").value.trim(), rationale: document.getElementById("edRationale").value.trim(), alternatives: document.getElementById("edAlternatives").value.trim(), impacts: document.getElementById("edImpacts").value.trim(), impact: document.getElementById("edImpacts").value.trim(), risks: document.getElementById("edRisks").value.trim(), nextStep: document.getElementById("edNext").value.trim(), linkedManagers: checkedValues("edManagers"), linkedProjects: checkedValues("edProjects"), linkedActions: checkedValues("edActions"), linkedDocuments: checkedValues("edDocuments") };
  persist("decisions");
  syncDecisionBacklinks(state.decisions[i]);
  addActivity("📌 Décision modifiée", state.decisions[i].title, state.decisions[i].nextStep, id);
  openDecision(id);
}

function saveDecisionNote(id) {
  const d = byId("decisions", id);
  if (!d) return;
  const content = document.getElementById("dnContent").value.trim();
  if (!content) return;
  d.directorNotes.unshift({ id: newId("note"), date: new Date().toLocaleString("fr-FR"), content });
  persist("decisions");
  addActivity("📝 Note décision", d.title, content, id);
  openDecision(id);
}

function saveDecisionEvent(id) {
  const d = byId("decisions", id);
  if (!d) return;
  const title = document.getElementById("deTitle").value.trim();
  if (!title) return;
  d.events.unshift({ id: newId("event"), date: document.getElementById("deDate").value.trim() || new Date().toLocaleString("fr-FR"), title, detail: document.getElementById("deDetail").value.trim() });
  persist("decisions");
  addActivity("📍 Événement décision", d.title, title, id);
  openDecision(id);
}

function saveDecisionAction(id) {
  const d = byId("decisions", id);
  if (!d) return;
  const title = document.getElementById("daTitle").value.trim();
  if (!title) return;
  const action = { id: newId("action"), title, link: d.title, done: false };
  state.actions.unshift(action);
  d.linkedActions = ensureArray(d.linkedActions);
  d.linkedActions.unshift(action.id);
  checkedValues("daManagers").forEach(managerId => {
    const m = byId("managers", managerId);
    if (m) {
      m.linkedActions = ensureArray(m.linkedActions);
      if (!m.linkedActions.includes(action.id)) m.linkedActions.unshift(action.id);
    }
  });
  checkedValues("daProjects").forEach(projectId => {
    const p = byId("projects", projectId);
    if (p) {
      p.linkedActions = ensureArray(p.linkedActions);
      if (!p.linkedActions.includes(action.id)) p.linkedActions.unshift(action.id);
    }
  });
  persist("actions");
  persist("decisions");
  persist("managers");
  persist("projects");
  addActivity("✅ Action créée depuis décision", action.title, d.title, id);
  openDecision(id);
}

function toggleLinkedDecisionAction(decisionId, actionId) {
  const a = byId("actions", actionId);
  if (!a) return;
  a.done = !a.done;
  persist("actions");
  addActivity("✅ Action décision modifiée", a.title, a.done ? "Terminée" : "Réouverte", decisionId);
  openDecision(decisionId);
}

function deleteDecision(id) {
  const i = indexById("decisions", id);
  if (i < 0 || !confirm("Supprimer cette décision ?")) return;
  const t = state.decisions[i].title;
  state.decisions.splice(i, 1);
  state.managers.forEach(m => m.linkedDecisions = ensureArray(m.linkedDecisions).filter(x => x !== id));
  state.projects.forEach(p => p.linkedDecisions = ensureArray(p.linkedDecisions).filter(x => x !== id));
  persist("decisions");
  persist("managers");
  persist("projects");
  addActivity("📌 Décision supprimée", t);
  renderDecisions();
}

const journalTypes = ["CODIR", "Gemba", "Entretien manager", "CSE", "Incident", "Note rapide", "Projet", "Autre"];

function renderJournal() {
  document.getElementById("viewTitle").textContent = "Journal";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "journal"));
  appHtml(`<div class="card hero"><h2>Journal opérationnel</h2><p class="muted">Faits observés, analyse, décisions, actions et suites de direction.</p></div><div class="card"><h2>Ajouter une entrée</h2><input id="jTitle" placeholder="Titre"><div class="form-grid"><input id="jDate" value="${esc(today())}" placeholder="Date"><select id="jType">${journalTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select><input id="jTags" placeholder="Mots-clés" class="full"></div><textarea id="jSummary" placeholder="Résumé"></textarea><button class="action" onclick="addJournal()">Ajouter</button></div>${state.journal.map(journalCard).join("") || `<div class="card empty">Aucune entrée.</div>`}`);
}

function journalCard(j) {
  return `<div class="card clickable" onclick="openJournal('${j.id}')"><h2>${esc(j.title)}</h2><p>${esc(j.summary || j.content || "")}</p><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Note rapide")} · ${(j.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(j.id)}</span></div>`;
}

function addJournal() {
  const title = document.getElementById("jTitle").value.trim() || "Entrée journal";
  const j = { id: newId("journal"), title, date: document.getElementById("jDate").value.trim() || today(), entryType: document.getElementById("jType").value, summary: document.getElementById("jSummary").value.trim(), content: document.getElementById("jSummary").value.trim(), facts: "", analysis: "", decisionsText: "", actionsText: "", linkedManagers: [], linkedProjects: [], linkedDecisions: [], linkedActions: [], linkedDocuments: [], watchPoints: "", nextSteps: "", notes: "", events: [], tags: splitTags(document.getElementById("jTags").value), mood: "", links: "" };
  state.journal.unshift(j);
  persist("journal");
  addActivity("📝 Journal", j.title, j.summary, j.id);
  openJournal(j.id);
}

function journalManagersList(j) {
  const linked = state.managers.filter(m => (j.linkedManagers || []).includes(m.id));
  return linked.map(m => `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")}</span>${badge(m.status)}<span class="meta">ID ${esc(m.id)}</span></div>`).join("") || `<div class="empty">Aucun manager concerné.</div>`;
}

function journalProjectsList(j) {
  const linked = state.projects.filter(p => (j.linkedProjects || []).includes(p.id));
  return linked.map(p => `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next || "")}</span>${badge(p.status)}<span class="meta">ID ${esc(p.id)}</span></div>`).join("") || `<div class="empty">Aucun projet concerné.</div>`;
}

function journalDecisionsList(j) {
  const linked = state.decisions.filter(d => (j.linkedDecisions || []).includes(d.id));
  return linked.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.date || "")} · ${esc(decisionStatusLabel(d.status))}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`;
}

function journalActionsList(j) {
  const linked = state.actions.filter(a => (j.linkedActions || []).includes(a.id));
  return linked.map(a => `<div class="item"><strong>${a.done ? "✅" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div>`).join("") || `<div class="empty">Aucune action générée.</div>`;
}

function journalDocumentsList(j) {
  const linked = state.documents.filter(d => (j.linkedDocuments || []).includes(d.id));
  return linked.map(d => `<div class="item"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")}${d.status ? " · " + esc(d.status) : ""}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`;
}

function journalTimeline(j) {
  const events = (j.events || []).map(e => ({ date: e.date || "", title: e.title || "Événement", detail: e.detail || "", kind: "Événement" }));
  const activities = state.activity.filter(a => a.entityId === j.id).map(a => ({ date: a.date || "", title: a.type || "Activité", detail: `${a.title || ""}${a.detail ? " · " + a.detail : ""}`, kind: "Activité" }));
  return [...events, ...activities].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(e => `<div class="item"><strong>${esc(e.date || "Sans date")} · ${esc(e.title)}</strong><span class="muted">${esc(e.kind)}${e.detail ? " · " + esc(e.detail) : ""}</span></div>`).join("") || `<div class="empty">Aucun événement.</div>`;
}

function journalQuickForm(j, mode = "") {
  if (mode === "action") return `<div class="card full-span"><h2>Ajouter une action liée</h2><input id="jaTitle" placeholder="Action à créer"><div class="grid three manager-links"><div><label>Managers concernés</label>${checkboxList("jaManagers", state.managers, j.linkedManagers, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("jaProjects", state.projects, j.linkedProjects, p => p.name)}</div><div><label>Décisions concernées</label>${checkboxList("jaDecisions", state.decisions, j.linkedDecisions, d => d.title)}</div></div><button class="action" onclick="saveJournalAction('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`;
  if (mode === "decision") return `<div class="card full-span"><h2>Ajouter une décision liée</h2><input id="jdTitle" placeholder="Titre de la décision"><textarea id="jdContext" placeholder="Contexte"></textarea><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("jdManagers", state.managers, j.linkedManagers, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("jdProjects", state.projects, j.linkedProjects, p => p.name)}</div></div><button class="action" onclick="saveJournalDecision('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`;
  if (mode === "event") return `<div class="card full-span"><h2>Ajouter un événement</h2><div class="form-grid"><input id="jeTitle" placeholder="Titre de l'événement"><input id="jeDate" value="${esc(new Date().toLocaleString("fr-FR"))}" placeholder="Date"></div><textarea id="jeDetail" placeholder="Détail de l'événement"></textarea><button class="action" onclick="saveJournalEvent('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`;
  return "";
}

function openJournal(id, mode = "") {
  const j = byId("journal", id);
  if (!j) return renderJournal();
  document.getElementById("viewTitle").textContent = j.title;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderJournal()">Retour Journal</button><h2>${esc(j.title)}</h2><p>${esc(j.summary || j.content || "")}</p><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Note rapide")}</span><span class="meta">ID ${esc(j.id)}</span><div class="row-actions"><button class="action" onclick="editJournal('${j.id}')">Modifier</button><button class="secondary" onclick="openJournal('${j.id}','action')">Ajouter une action liée</button><button class="secondary" onclick="openJournal('${j.id}','decision')">Ajouter une décision liée</button><button class="secondary" onclick="openJournal('${j.id}','event')">Ajouter un événement</button><button class="danger" onclick="deleteJournal('${j.id}')">Supprimer</button></div></div><div class="grid two">${journalQuickForm(j, mode)}<div class="card"><h2>Résumé</h2><p>${esc(j.summary || "À compléter")}</p></div><div class="card"><h2>Faits observés</h2><p>${esc(j.facts || "À compléter")}</p></div><div class="card"><h2>Analyse du directeur</h2><p>${esc(j.analysis || "À compléter")}</p></div><div class="card"><h2>Décisions prises</h2><p>${esc(j.decisionsText || "À compléter")}</p></div><div class="card"><h2>Actions générées</h2>${journalActionsList(j)}${j.actionsText ? `<p class="muted">${esc(j.actionsText)}</p>` : ""}</div><div class="card"><h2>Managers concernés</h2>${journalManagersList(j)}</div><div class="card"><h2>Projets concernés</h2>${journalProjectsList(j)}</div><div class="card"><h2>Décisions liées</h2>${journalDecisionsList(j)}</div><div class="card"><h2>Documents liés</h2>${journalDocumentsList(j)}</div><div class="card"><h2>Points de vigilance</h2><p>${esc(j.watchPoints || "À compléter")}</p></div><div class="card"><h2>Suites à donner</h2><p>${esc(j.nextSteps || "À compléter")}</p></div><div class="card"><h2>Notes complémentaires</h2><p>${esc(j.notes || "À compléter")}</p></div><div class="card"><h2>Mots-clés</h2>${listItems(j.tags)}</div><div class="card full-span"><h2>Historique chronologique</h2>${journalTimeline(j)}</div></div>`);
}

function editJournal(id) {
  const j = byId("journal", id);
  if (!j) return;
  document.getElementById("viewTitle").textContent = "Modifier " + j.title;
  appHtml(`<div class="card"><h2>Modifier entrée Journal</h2><input id="ejTitle" value="${esc(j.title)}" placeholder="Titre"><div class="form-grid"><input id="ejDate" value="${esc(j.date || "")}" placeholder="Date"><select id="ejType">${journalTypes.map(t => `<option value="${esc(t)}" ${j.entryType === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><input id="ejTags" value="${esc((j.tags || []).join(", "))}" placeholder="Mots-clés" class="full"></div><textarea id="ejSummary" placeholder="Résumé">${esc(j.summary || j.content || "")}</textarea><textarea id="ejFacts" placeholder="Faits observés">${esc(j.facts || "")}</textarea><textarea id="ejAnalysis" placeholder="Analyse du directeur">${esc(j.analysis || "")}</textarea><textarea id="ejDecisionsText" placeholder="Décisions prises">${esc(j.decisionsText || "")}</textarea><textarea id="ejActionsText" placeholder="Actions générées">${esc(j.actionsText || "")}</textarea><textarea id="ejWatch" placeholder="Points de vigilance">${esc(j.watchPoints || "")}</textarea><textarea id="ejNext" placeholder="Suites à donner">${esc(j.nextSteps || "")}</textarea><textarea id="ejNotes" placeholder="Notes complémentaires">${esc(j.notes || "")}</textarea><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("ejManagers", state.managers, j.linkedManagers, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("ejProjects", state.projects, j.linkedProjects, p => p.name)}</div><div><label>Décisions liées</label>${checkboxList("ejDecisions", state.decisions, j.linkedDecisions, d => d.title)}</div><div><label>Actions liées</label>${checkboxList("ejActions", state.actions, j.linkedActions, a => a.title)}</div><div><label>Documents liés</label>${checkboxList("ejDocuments", state.documents, j.linkedDocuments, d => d.title)}</div></div><button class="action" onclick="saveJournal('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`);
}

function saveJournal(id) {
  const i = indexById("journal", id);
  if (i < 0) return;
  state.journal[i] = { ...state.journal[i], title: document.getElementById("ejTitle").value.trim(), date: document.getElementById("ejDate").value.trim(), entryType: document.getElementById("ejType").value, summary: document.getElementById("ejSummary").value.trim(), content: document.getElementById("ejSummary").value.trim(), facts: document.getElementById("ejFacts").value.trim(), analysis: document.getElementById("ejAnalysis").value.trim(), decisionsText: document.getElementById("ejDecisionsText").value.trim(), actionsText: document.getElementById("ejActionsText").value.trim(), watchPoints: document.getElementById("ejWatch").value.trim(), nextSteps: document.getElementById("ejNext").value.trim(), notes: document.getElementById("ejNotes").value.trim(), tags: splitTags(document.getElementById("ejTags").value), linkedManagers: checkedValues("ejManagers"), linkedProjects: checkedValues("ejProjects"), linkedDecisions: checkedValues("ejDecisions"), linkedActions: checkedValues("ejActions"), linkedDocuments: checkedValues("ejDocuments") };
  persist("journal");
  addActivity("📝 Journal modifié", state.journal[i].title, state.journal[i].summary, id);
  openJournal(id);
}

function saveJournalAction(id) {
  const j = byId("journal", id);
  if (!j) return;
  const title = document.getElementById("jaTitle").value.trim();
  if (!title) return;
  const action = { id: newId("action"), title, link: j.title, done: false };
  state.actions.unshift(action);
  j.linkedActions = ensureArray(j.linkedActions);
  j.linkedActions.unshift(action.id);
  checkedValues("jaManagers").forEach(managerId => {
    const m = byId("managers", managerId);
    if (m) {
      m.linkedActions = ensureArray(m.linkedActions);
      if (!m.linkedActions.includes(action.id)) m.linkedActions.unshift(action.id);
    }
  });
  checkedValues("jaProjects").forEach(projectId => {
    const p = byId("projects", projectId);
    if (p) {
      p.linkedActions = ensureArray(p.linkedActions);
      if (!p.linkedActions.includes(action.id)) p.linkedActions.unshift(action.id);
    }
  });
  checkedValues("jaDecisions").forEach(decisionId => {
    const d = byId("decisions", decisionId);
    if (d) {
      d.linkedActions = ensureArray(d.linkedActions);
      if (!d.linkedActions.includes(action.id)) d.linkedActions.unshift(action.id);
    }
  });
  persist("actions"); persist("journal"); persist("managers"); persist("projects"); persist("decisions");
  addActivity("✅ Action créée depuis Journal", action.title, j.title, id);
  openJournal(id);
}

function saveJournalDecision(id) {
  const j = byId("journal", id);
  if (!j) return;
  const title = document.getElementById("jdTitle").value.trim();
  if (!title) return;
  const decision = { id: newId("decision"), title, context: document.getElementById("jdContext").value.trim() || j.summary || j.title, date: today(), status: "decided", importance: "orange", problem: j.facts || "", decision: title, rationale: j.analysis || "", alternatives: "", impacts: "", impact: "", risks: j.watchPoints || "", owner: "", linkedManagers: checkedValues("jdManagers"), linkedProjects: checkedValues("jdProjects"), linkedActions: [], reviewDate: "", linkedDocuments: [], events: [], directorNotes: [], nextStep: j.nextSteps || "", tags: ensureArray(j.tags) };
  state.decisions.unshift(decision);
  j.linkedDecisions = ensureArray(j.linkedDecisions);
  j.linkedDecisions.unshift(decision.id);
  persist("decisions");
  syncDecisionBacklinks(decision);
  persist("journal");
  addActivity("📌 Décision créée depuis Journal", decision.title, j.title, id);
  openJournal(id);
}

function saveJournalEvent(id) {
  const j = byId("journal", id);
  if (!j) return;
  const title = document.getElementById("jeTitle").value.trim();
  if (!title) return;
  j.events.unshift({ id: newId("event"), date: document.getElementById("jeDate").value.trim() || new Date().toLocaleString("fr-FR"), title, detail: document.getElementById("jeDetail").value.trim() });
  persist("journal");
  addActivity("📍 Événement Journal", j.title, title, id);
  openJournal(id);
}

function deleteJournal(id) {
  const i = indexById("journal", id);
  if (i < 0 || !confirm("Supprimer cette entrée ?")) return;
  const t = state.journal[i].title;
  state.journal.splice(i, 1);
  persist("journal");
  addActivity("📝 Journal supprimé", t);
  renderJournal();
}

function renderDocuments() {
  appHtml(`<div class="card hero"><h2>Documents</h2><p class="muted">Modèles, notes, supports et traces utiles au pilotage.</p></div><div class="card"><h2>Ajouter un document</h2><input id="docTitle" placeholder="Titre"><div class="form-grid"><input id="docType" placeholder="Type"><input id="docOwner" placeholder="Responsable"><input id="docStatus" placeholder="Statut" value="Brouillon"><input id="docTags" placeholder="Tags"></div><textarea id="docContent" placeholder="Contenu ou structure"></textarea><button class="action" onclick="addDocument()">Ajouter</button></div><div class="grid two">${state.documents.map(documentCard).join("") || `<div class="card empty">Aucun document.</div>`}</div>`);
}

function documentCard(d) {
  return `<div class="card"><h2>${esc(d.title)}</h2><span class="muted">${esc(d.type || "")}${d.status ? " · " + esc(d.status) : ""}${d.owner ? " · " + esc(d.owner) : ""}</span><p>${esc(d.content || "")}</p><span class="meta">ID ${esc(d.id)} · MAJ ${esc(d.updatedAt || "")}</span><br><button class="secondary" onclick="editDocument('${d.id}')">Modifier</button><button class="danger" onclick="deleteDocument('${d.id}')">Supprimer</button></div>`;
}

function addDocument() {
  const title = document.getElementById("docTitle").value.trim();
  if (!title) return;
  const d = { id: newId("document"), title, type: document.getElementById("docType").value.trim(), owner: document.getElementById("docOwner").value.trim(), status: document.getElementById("docStatus").value.trim(), tags: splitTags(document.getElementById("docTags").value), content: document.getElementById("docContent").value.trim(), updatedAt: isoToday() };
  state.documents.unshift(d);
  persist("documents");
  addActivity("📄 Document", d.title, d.type, d.id);
  renderDocuments();
}

function editDocument(id) {
  const d = byId("documents", id);
  if (!d) return;
  appHtml(`<div class="card"><h2>Modifier document</h2><input id="edocTitle" value="${esc(d.title)}"><div class="form-grid"><input id="edocType" value="${esc(d.type || "")}" placeholder="Type"><input id="edocOwner" value="${esc(d.owner || "")}" placeholder="Responsable"><input id="edocStatus" value="${esc(d.status || "")}" placeholder="Statut"><input id="edocTags" value="${esc((d.tags || []).join(", "))}" placeholder="Tags"></div><textarea id="edocContent">${esc(d.content || "")}</textarea><button class="action" onclick="saveDocument('${d.id}')">Enregistrer</button><button class="secondary" onclick="renderDocuments()">Annuler</button></div>`);
}

function saveDocument(id) {
  const i = indexById("documents", id);
  if (i < 0) return;
  state.documents[i] = { ...state.documents[i], title: document.getElementById("edocTitle").value.trim(), type: document.getElementById("edocType").value.trim(), owner: document.getElementById("edocOwner").value.trim(), status: document.getElementById("edocStatus").value.trim(), tags: splitTags(document.getElementById("edocTags").value), content: document.getElementById("edocContent").value.trim(), updatedAt: isoToday() };
  persist("documents");
  addActivity("📄 Document modifié", state.documents[i].title, state.documents[i].type, id);
  renderDocuments();
}

function deleteDocument(id) {
  const i = indexById("documents", id);
  if (i < 0 || !confirm("Supprimer ce document ?")) return;
  const t = state.documents[i].title;
  state.documents.splice(i, 1);
  persist("documents");
  addActivity("📄 Document supprimé", t);
  renderDocuments();
}

function activityItem(a) {
  return `<div class="item"><strong>${esc(a.type)} · ${esc(a.title)}</strong><span class="muted">${esc(a.date || "")}${a.detail ? " · " + esc(a.detail) : ""}</span><span class="meta">ID ${esc(a.id)}${a.entityId ? " · Entité " + esc(a.entityId) : ""}</span></div>`;
}

function renderActivity() {
  appHtml(`<div class="card hero"><h2>🕘 Activité</h2><p class="muted">Trace chronologique des créations, modifications et suppressions.</p></div>${state.activity.map(activityItem).join("") || `<div class="card empty">Aucune activité.</div>`}`);
}

function runSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    setView("cockpit");
    return;
  }
  const relationText = item => {
    const managers = state.managers.filter(m => (item.linkedManagers || []).includes(m.id)).map(m => `${m.name} ${m.role || ""}`).join(" ");
    const owner = item.ownerId ? state.managers.filter(m => m.id === item.ownerId).map(m => `${m.name} ${m.role || ""}`).join(" ") : "";
    const projects = state.projects.filter(p => (item.linkedProjects || []).includes(p.id)).map(p => p.name).join(" ");
    const actions = state.actions.filter(a => (item.linkedActions || []).includes(a.id)).map(a => a.title).join(" ");
    const decisions = state.decisions.filter(d => (item.linkedDecisions || []).includes(d.id)).map(d => d.title).join(" ");
    const documents = state.documents.filter(d => (item.linkedDocuments || []).includes(d.id)).map(d => d.title).join(" ");
    return `${managers} ${owner} ${projects} ${actions} ${decisions} ${documents}`;
  };
  const results = entities.flatMap(name => state[name].map(item => ({
    entity: name,
    id: item.id,
    title: item.title || item.name || item.type || item.id,
    text: `${JSON.stringify(item)} ${relationText(item)}`
  }))).filter(x => `${x.title} ${x.text}`.toLowerCase().includes(q));
  document.getElementById("viewTitle").textContent = "Recherche";
  appHtml(`<div class="card"><h2>${results.length} résultat(s)</h2>${results.map(r => `<div class="item"><strong>${esc(r.title)}</strong><span class="muted">${esc(r.entity)} · ID ${esc(r.id)}</span></div>`).join("") || `<div class="empty">Aucun résultat.</div>`}</div>`);
}

function listItems(items, prefix = "") {
  return (items || []).map(x => `<div class="item">${prefix}${esc(x)}</div>`).join("") || `<div class="empty">À compléter</div>`;
}

init();
