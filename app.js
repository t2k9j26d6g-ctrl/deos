const DEOS_VERSION = "V5.17.5.1";
const DEOS_BACKUP_VERSION = 1;
const DEOS_TECHNICAL_BACKUP_KEYS = ["deos_backup_last_export", "deos_backup_last_restore", "deos_backup_category_count", "deos_restore_success"];

// -- Google Calendar V5.6 ------------------------------------------------------
// Méthode OAuth : Google Identity Services (GIS) — initTokenClient (Implicit Grant)
// Scope minimal principe du moindre privilège : lecture seule calendriers + événements
// Access token : sessionStorage uniquement — jamais localStorage ni code source
// Client Secret : jamais stocké dans DEOS — uniquement le Client ID public OAuth
// Documentation API : https://developers.google.com/calendar/api/v3/reference
// V5.6 : Synchronisation automatique, gestion expiration token, réconciliation
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_SYNC_PAST_DAYS = 30;     // jours dans le passé à importer
const GOOGLE_SYNC_FUTURE_DAYS = 90;   // jours dans le futur à importer
const GOOGLE_SYNC_INTERVALS = {       // Mapping fréquence configurée ? intervalle en ms (V5.6)
  manual: null,      // aucun timer
  "15min": 15 * 60 * 1000,      // 15 minutes
  "hourly": 60 * 60 * 1000,     // 1 heure
  "daily": 24 * 60 * 60 * 1000  // 1 jour
};

// Variables de runtime Google (non persistées en localStorage)
let googleAccessToken = null;
let googleConnectionStatus = "not_configured";
let googleAvailableCalendars = [];
let googleConnectedEmail = "";
let googleExternalEventModalId = "";
let googleSyncInProgress = false;
let googleSyncTimerId = null;          // ID du timer automatique (V5.6)
let googleLastSyncAt = null;           // timestamp dernière synchro (V5.6)
let googleNextSyncAt = null;           // timestamp prochaine synchro (V5.6)

let decisionDetailId = "";
let decisionEditDialog = {
  open: false,
  decisionId: "",
  error: ""
};

function editDecision(id) {
  decisionDetailId = String(id);
  openDecisionEditModal(id);
}

function saveDecision(id) {
  return saveDecisionEdit(id);
}

function deleteDecision(id) {
  openDecisionDeleteModal(id);
}

const identityDefaults = {
  appName: "DEOS",
  appVersion: DEOS_VERSION,
  siteName: "Saint-Gilles",
  directorName: "Ludovic",
  directorRole: "Directeur d'entrepôt",
  organizationName: "Carrefour Supply Chain",
  logoType: "monogram",
  logoText: "D",
  logoImage: "",
  createdAt: isoToday(),
  updatedAt: isoToday()
};
let identity = { ...identityDefaults };

const entities = ["actions", "managers", "projects", "decisions", "priorities", "activity", "journal", "documents", "agenda", "folders", "performance", "meetingPreparations", "links", "performance_imports"];
const state = Object.fromEntries(entities.map(name => [name, []]));
state.settings = {};
state.externalCalendarEvents = []; // Événements Google Calendar importés (V5.5)
state.externalEventEnrichments = {}; // Enrichissements locaux des événements Google (V5.7)
let agendaEditId = "";
let agendaFilter = "today";
let agendaModalOpen = false;
let meetingSubjectModalAgendaId = null;
let cockpitFocus = "";
let folderSearch = "";
let folderCategoryFilter = "all";
let folderStatusFilter = "all";
let folderPriorityFilter = "all";
let folderSort = "activity";
let folderViewMode = "list";
let folderGraphFilter = "all";
let folderGraphSearch = "";
let folderGraphSelected = "";
let folderGraphZoom = 1;
let folderGraphPan = { x: 0, y: 0 };
let folderGraphDrag = null;
let folderOperationNotice = "";
let folderDeletionDialog = {
  open: false,
  folderId: "",
  step: 1,
  impact: null,
  confirmText: "",
  error: "",
  busy: false
};
let folderDeletionFailureMode = "";
let reportWizard = null;
let linkEditId = "";
let linkCategoryFilter = "all";
let linkFavoriteFilter = false;
let linkSearch = "";
let performanceImportWizard = null;
let expandedPerformanceImportId = "";
let restoreSuccessMessage = "";
let backupPreviewPayload = null;
let backupPreviewSummary = null;
let backupPreviewOpen = false;
let backupSafetySnapshot = null;
let agendaFormError = "";
let currentView = "cockpit";
let meetingOriginContext = null;
let meetingCreateState = null;
let pendingMeetingCreateReveal = null;
let cockpitQuickCreateMode = "";
let graphTypeFilter = "all";
let graphOnlyLinked = false;
let graphSearch = "";
let graphDepth = "all";
let graphSelectedNodeId = "";
let graphZoom = 1;
let graphPan = { x: 0, y: 0 };
let graphDragPan = null;
let graphDragNode = null;
let graphLayoutCache = null;
let graphSimulationActive = false;
let graphRafId = 0;
let graphDataSignature = "";
let graphReturnContext = null;
let graphNavigationLock = false;
let a5SummaryDialog = {
  open: false,
  type: "",
  sourceId: "",
  orientation: "portrait",
  model: null,
  error: ""
};
let actionDetailId = "";
let actionEditDialog = {
  open: false,
  actionId: "",
  error: ""
};
let actionDeleteDialog = {
  open: false,
  actionId: "",
  error: ""
};
let decisionDeleteDialog = {
  open: false,
  decisionId: "",
  error: ""
};
let projectEditDialog = {
  open: false,
  projectId: "",
  error: ""
};
let projectDeleteDialog = {
  open: false,
  projectId: "",
  error: "",
  busy: false,
  impact: null
};
let managerDeleteDialog = {
  open: false,
  managerId: "",
  error: "",
  busy: false,
  impact: null
};
let a5PrintCleanupBound = false;
let modalEscapeBound = false;

const labels = { green: "Maîtrisé", orange: "À suivre", red: "Critique", not_configured: "Non configuré", configuration_saved: "Configuration enregistrée", connection_required: "Connexion requise", connected: "Connecté", connection_error: "Erreur de connexion" };
const icons = { green: "🟢", orange: "🟠", red: "🔴" };

const defaults = {
  performance_imports: [],
  links: [],
  meetingPreparations: [],
  performance: [],
  folders: [
    { id: "fol-v5-001", name: "Productivité", category: "Performance", status: "orange", priorityLevel: "red", owner: "Ludovic", ownerId: "", linkedManagers: ["mgr-v5-001", "mgr-v5-003"], description: "Pilotage transversal de la productivité opérationnelle.", context: "Suivi des projets, décisions et actions liés à la productivité.", objectives: "Améliorer durablement la performance opérationnelle.", expectedResults: "Actions clarifiées, décisions tracées et échéances visibles.", createdAt: isoToday(), deadline: "", tags: ["Productivité", "Préparation", "Performance"], directorNotes: "" }
  ],
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

async function loadIdentityDefaults() {
  try {
    const r = await fetch(`data/settings.json?v=${Date.now()}`);
    if (!r.ok) return identityDefaults;
    const data = await r.json();
    return normalizeIdentity(data);
  } catch {
    return identityDefaults;
  }
}

function saved(name, fallback) {
  const v = localStorage.getItem(`deos_${name}`);
  return v ? JSON.parse(v) : fallback;
}

function persist(name) {
  localStorage.setItem(`deos_${name}`, JSON.stringify(state[name]));
}

function normalizeIdentity(value = {}) {
  const merged = { ...identityDefaults, ...value };
  const clean = key => String(merged[key] || "").trim();
  const appName = clean("appName") || identityDefaults.appName;
  const logoText = clean("logoText") || appName.slice(0, 1).toUpperCase() || "D";
  return {
    ...merged,
    appName,
    appVersion: clean("appVersion") || identityDefaults.appVersion,
    siteName: clean("siteName") || identityDefaults.siteName,
    directorName: clean("directorName") || identityDefaults.directorName,
    directorRole: clean("directorRole") || identityDefaults.directorRole,
    organizationName: clean("organizationName"),
    logoType: clean("logoType") || "monogram",
    logoText,
    logoImage: clean("logoImage"),
    updatedAt: clean("updatedAt") || isoToday()
  };
}

function savedIdentity(fallback) {
  const v = localStorage.getItem("deos_identity");
  return normalizeIdentity(v ? JSON.parse(v) : fallback);
}

function persistIdentity() {
  localStorage.setItem("deos_identity", JSON.stringify(identity));
}

function identityName() {
  return identity.directorName || identityDefaults.directorName;
}

function identitySignature() {
  return [identity.appName, identity.siteName].filter(Boolean).join(" - ");
}

function applyIdentity() {
  document.title = `${identity.appName} ${identity.appVersion || ""}`.trim();
  const logo = document.getElementById("brandLogo");
  if (logo) {
    logo.textContent = "";
    logo.style.backgroundImage = "";
    if (identity.logoType === "image" && identity.logoImage) {
      logo.style.backgroundImage = `url("${identity.logoImage.replace(/"/g, "%22")}")`;
      logo.classList.add("logo-image");
      logo.setAttribute("aria-label", identity.appName);
    } else {
      logo.classList.remove("logo-image");
      logo.textContent = identity.logoText || identity.appName.slice(0, 1).toUpperCase() || "D";
    }
  }
  const app = document.getElementById("brandAppName");
  const site = document.getElementById("brandSiteName");
  const version = document.getElementById("brandVersion");
  const search = document.getElementById("searchInput");
  if (app) app.textContent = identity.appName;
  if (site) site.textContent = identity.siteName || identity.organizationName || "";
  if (version) version.textContent = `DEOS ${DEOS_VERSION}`;
  if (search) search.placeholder = `Rechercher : chocolat, ${identityName()}, CSE...`;
}

function hideVisibleTechnicalIds(html) {
  return String(html)
    .replace(/(<span class="meta">)\s*ID [a-z0-9_-]+(?:\s*[·?]\s*)?([^<]*<\/span>)/gi, (match, start, tail) => {
      const remaining = tail.replace("</span>", "").trim();
      return remaining ? `${start}${remaining}</span>` : "";
    })
    .replace(/<span class="meta">\s*Entité\s+[a-z0-9_-]+<\/span>/gi, "")
    .replace(/\s*[·?]\s*ID [a-z0-9_-]+/gi, "")
    .replace(/\s*[·?]\s*Entité\s+[a-z0-9_-]+/gi, "")
    .replace(/\s*[?·-]\s*(mana|mgr|proj|dec|act|pri|meet|jour|doc|fol|folder|agenda|agen|event|note|mile|link|file|preview|perf|perfimport|activity)-[a-z0-9_-]+/gi, "");
}

function appHtml(html) {
  const graphReturnBanner = graphReturnContext && currentView !== "graph"
    ? `<div class="card graph-return-banner"><div><strong>Vue graphique</strong><p class="muted">Contexte conservé (filtres, zoom, sélection).</p></div><div class="row-actions"><button class="secondary" onclick="returnToGraph()">Retour à la vue graphique</button></div></div>`
    : "";
  document.getElementById("app").innerHTML = hideVisibleTechnicalIds(`${graphReturnBanner}${html}`);
  injectA5SummaryButtons();
  renderA5SummaryOverlay();
  renderActionModalOverlays();
  renderDecisionModalOverlays();
}

function badge(status) {
  return `<span class="badge ${status}">${labels[status] || "À suivre"}</span>`;
}

function esc(v = "") {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isTechnicalBackupKey(key) {
  return DEOS_TECHNICAL_BACKUP_KEYS.includes(key);
}

function deosKeys() {
  return Object.keys(localStorage).filter(key => typeof key === "string" && key.startsWith("deos_"));
}

function deosBackupKeys(payload) {
  if (!payload || typeof payload !== "object" || payload === null) return [];
  const keys = payload.localStorage && typeof payload.localStorage === "object" && !Array.isArray(payload.localStorage)
    ? Object.keys(payload.localStorage).filter(key => typeof key === "string" && key.startsWith("deos_"))
    : [];
  return keys;
}

function localStorageBackupPayload() {
  const data = {};
  for (const key of deosKeys()) {
    const value = localStorage.getItem(key);
    if (typeof value === "string") {
      data[key] = value;
    }
  }
  return data;
}

function backupFileName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `DEOS_sauvegarde_${y}-${m}-${d}_${hh}-${mm}.json`;
}

function buildBackupPayload() {
  return {
    date: new Date().toISOString(),
    adresse: window.location.origin + window.location.pathname,
    version: DEOS_BACKUP_VERSION,
    localStorage: localStorageBackupPayload(),
    sessionStorage: {}
  };
}

function saveBackupMetadata(type, date, categoryCount) {
  if (type === "export") {
    localStorage.setItem("deos_backup_last_export", date);
  } else if (type === "restore") {
    localStorage.setItem("deos_backup_last_restore", date);
  }
  if (typeof categoryCount === "number") {
    localStorage.setItem("deos_backup_category_count", String(categoryCount));
  }
}

function renderBackupMessage(message, type = "green") {
  restoreSuccessMessage = message;
  if (type === "green") {
    return `<p class="settings-confirm" role="status">${esc(message)}</p>`;
  }
  return `<p class="settings-confirm" style="background:#fee2e2;color:#991b1b;">${esc(message)}</p>`;
}

function getBackupMetadata() {
  return {
    lastExport: localStorage.getItem("deos_backup_last_export") || "Aucune exportation enregistrée",
    lastRestore: localStorage.getItem("deos_backup_last_restore") || "Aucune restauration enregistrée",
    categoryCount: Number(localStorage.getItem("deos_backup_category_count") || "0")
  };
}

function downloadBackupFile(payload) {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName(new Date());
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateBackupContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return { valid: false, error: "Le fichier doit contenir un objet JSON valide." };

  const payload = {
    date: String(content.date || content.exportedAt || content.createdAt || "").trim(),
    adresse: String(content.adresse || content.url || "").trim(),
    version: Number(content.version || DEOS_BACKUP_VERSION),
    localStorage: {},
    sessionStorage: {}
  };

  const appendStorageValue = (key, value) => {
    if (typeof key !== "string" || !key.startsWith("deos_")) return;
    if (typeof value === "string") {
      payload.localStorage[key] = value;
      return;
    }
    try {
      payload.localStorage[key] = JSON.stringify(value ?? null);
    } catch {
      // Ignore non serializable values.
    }
  };

  if (content.localStorage && typeof content.localStorage === "object" && !Array.isArray(content.localStorage)) {
    for (const [key, value] of Object.entries(content.localStorage)) {
      appendStorageValue(key, value);
    }
  }

  // Compatibilité anciennes sauvegardes stockées à la racine.
  const legacyRootMap = {
    identity: "deos_identity",
    settings: "deos_settings",
    actions: "deos_actions",
    managers: "deos_managers",
    projects: "deos_projects",
    decisions: "deos_decisions",
    priorities: "deos_priorities",
    activity: "deos_activity",
    journal: "deos_journal",
    documents: "deos_documents",
    agenda: "deos_agenda",
    folders: "deos_folders",
    performance: "deos_performance",
    meetingPreparations: "deos_meetingPreparations",
    links: "deos_links",
    performance_imports: "deos_performance_imports",
    externalCalendarEvents: "deos_external_events",
    externalEventEnrichments: "deos_external_event_enrichments"
  };
  for (const [rootKey, storageKey] of Object.entries(legacyRootMap)) {
    if (Object.prototype.hasOwnProperty.call(content, rootKey)) {
      appendStorageValue(storageKey, content[rootKey]);
    }
  }

  const keys = Object.keys(payload.localStorage);
  if (keys.length === 0) {
    return { valid: false, error: "La sauvegarde ne contient aucune donnée DEOS reconnue." };
  }
  const deos = keys.filter(key => typeof key === "string" && key.startsWith("deos_") && !isTechnicalBackupKey(key));
  if (deos.length === 0) {
    return { valid: false, error: "La sauvegarde ne contient aucune catégorie DEOS restaurable." };
  }
  for (const key of keys) {
    if (typeof key !== "string") return { valid: false, error: "Toutes les clés de localStorage doivent être des chaînes." };
    if (typeof payload.localStorage[key] !== "string") return { valid: false, error: `La valeur de ${key} doit être une chaîne sérialisée.` };
  }
  if (!payload.date) payload.date = new Date().toISOString();
  payload.localStorage = Object.fromEntries(deos.map(key => [key, payload.localStorage[key]]));
  return { valid: true, payload };
}

function backupCategoryCount(payload) {
  const keys = deosBackupKeys(payload).filter(key => !isTechnicalBackupKey(key));
  return keys.length;
}

function currentLocalStorageCategoryCount() {
  return deosKeys().filter(key => !isTechnicalBackupKey(key)).length;
}

function backupStats(payload) {
  const keys = deosBackupKeys(payload).filter(key => !isTechnicalBackupKey(key));
  const categories = new Set();
  const counts = {
    managers: 0,
    projects: 0,
    actions: 0,
    priorities: 0,
    decisions: 0,
    folders: 0,
    documents: 0,
    journal: 0
  };
  for (const key of keys) {
    const value = payload.localStorage[key];
    if (typeof value !== "string") continue;
    let data = null;
    try {
      data = JSON.parse(value);
    } catch {
      continue;
    }
    if (Array.isArray(data) && data.length > 0) {
      categories.add(key);
    }
    if (key === "deos_managers") counts.managers = Array.isArray(data) ? data.length : 0;
    if (key === "deos_projects") counts.projects = Array.isArray(data) ? data.length : 0;
    if (key === "deos_actions") counts.actions = Array.isArray(data) ? data.length : 0;
    if (key === "deos_priorities") counts.priorities = Array.isArray(data) ? data.length : 0;
    if (key === "deos_decisions") counts.decisions = Array.isArray(data) ? data.length : 0;
    if (key === "deos_folders") counts.folders = Array.isArray(data) ? data.length : 0;
    if (key === "deos_documents") counts.documents = Array.isArray(data) ? data.length : 0;
    if (key === "deos_journal") counts.journal = Array.isArray(data) ? data.length : 0;
  }
  return { categoryCount: categories.size, counts };
}

function renderBackupPreviewModal(payload, summary, message = "") {
  backupPreviewPayload = payload;
  backupPreviewSummary = summary;
  backupPreviewOpen = true;
  renderSettings(message);
}

function closeBackupPreview() {
  backupPreviewOpen = false;
  backupPreviewPayload = null;
  backupPreviewSummary = null;
  resetBackupImportInput();
  renderSettings();
}

function applyBackupPayload(payload) {
  const currentSnapshot = localStorageBackupPayload();
  const backupKeys = deosBackupKeys(payload);
  try {
    for (const key of backupKeys) {
      localStorage.setItem(key, payload.localStorage[key]);
    }
    return { success: true };
  } catch (error) {
    for (const [key, value] of Object.entries(currentSnapshot)) {
      localStorage.setItem(key, value);
    }
    return { success: false, error: `La restauration a échoué : ${error.message || String(error)}` };
  }
}

function prepareRestoreBackup(payload) {
  try {
    backupSafetySnapshot = buildBackupPayload();
  } catch {
    backupSafetySnapshot = null;
  }
  const message = backupSafetySnapshot
    ? "Sauvegarde de sécurité interne créée. Confirmez la restauration pour appliquer le fichier sélectionné."
    : "Attention: aucune sauvegarde de sécurité interne n'a pu être créée. Confirmez uniquement si vous êtes certain.";
  renderBackupPreviewModal(payload, backupStats(payload), message);
}

function confirmRestoreBackup() {
  if (!backupPreviewPayload) return;
  const result = applyBackupPayload(backupPreviewPayload);
  if (!result.success) {
    renderSettings(result.error);
    return;
  }
  backupSafetySnapshot = null;
  saveBackupMetadata("restore", new Date().toISOString(), backupCategoryCount(backupPreviewPayload));
  localStorage.setItem("deos_restore_success", "Restauration réussie.");
  location.reload();
}

function exportBackup() {
  try {
    const payload = buildBackupPayload();
    const categoryCount = backupCategoryCount(payload);
    if (categoryCount <= 0) {
      renderSettings("Aucune donnée DEOS à exporter.");
      return false;
    }
    downloadBackupFile(payload);
    saveBackupMetadata("export", new Date().toISOString(), categoryCount);
    renderSettings("Exportation réussie.");
    return true;
  } catch (error) {
    console.error(error);
    renderSettings("Erreur pendant l'exportation. Aucun fichier de sauvegarde n'a été généré.");
    return false;
  }
}

function handleImportBackupFile(file) {
  if (!file) {
    resetBackupImportInput();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const content = safeParseJson(reader.result);
    const validated = validateBackupContent(content);
    if (!validated.valid) {
      renderSettings(validated.error);
      resetBackupImportInput();
      return;
    }
    prepareRestoreBackup(validated.payload);
    resetBackupImportInput();
  };
  reader.onerror = () => {
    renderSettings("Impossible de lire le fichier sélectionné.");
    resetBackupImportInput();
  };
  reader.readAsText(file, "UTF-8");
}

function resetBackupImportInput() {
  const input = document.getElementById("backupFileInput");
  if (input) input.value = "";
}

function onBackupFileInputChange(event) {
  const input = event?.target;
  const file = input?.files && input.files[0];
  if (!file) {
    resetBackupImportInput();
    return;
  }
  handleImportBackupFile(file);
}

function triggerBackupImport() {
  const input = document.getElementById("backupFileInput");
  if (!input) {
    renderSettings("Champ d'import introuvable. Rechargez la page puis réessayez.");
    return;
  }
  input.value = "";
  input.click();
}

function renderBackupPreviewCard(summary) {
  if (!summary) return "";
  const counts = summary.counts || {};
  return `<div class="card settings-card"><h2>Aperçu de la sauvegarde</h2><div class="grid two"><div class="item"><strong>Date de la sauvegarde</strong><span class="muted">${esc(summary.date || "Inconnue")}</span></div><div class="item"><strong>Catégories métier</strong><span class="muted">${esc(String(summary.categoryCount || 0))}</span></div><div class="item"><strong>Managers</strong><span class="muted">${esc(String(counts.managers || 0))}</span></div><div class="item"><strong>Projets</strong><span class="muted">${esc(String(counts.projects || 0))}</span></div><div class="item"><strong>Actions</strong><span class="muted">${esc(String(counts.actions || 0))}</span></div><div class="item"><strong>Priorités</strong><span class="muted">${esc(String(counts.priorities || 0))}</span></div><div class="item"><strong>Décisions</strong><span class="muted">${esc(String(counts.decisions || 0))}</span></div><div class="item"><strong>Dossiers</strong><span class="muted">${esc(String(counts.folders || 0))}</span></div><div class="item"><strong>Documents</strong><span class="muted">${esc(String(counts.documents || 0))}</span></div><div class="item"><strong>Journal</strong><span class="muted">${esc(String(counts.journal || 0))}</span></div></div></div>`;
}

function splitTags(value) {
  return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
}

function today() {
  return new Date().toLocaleDateString("fr-FR");
}

function isoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function cockpitDateLabel(date = new Date()) {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  return `${label} · S${isoWeekNumber(date)}`;
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

function normalizeLinkedManagerIds(value) {
  return [...new Set((value || []).map(String).map(x => x.trim()).filter(Boolean))];
}

function normalizeLinkedIdArray(value) {
  return [...new Set(ensureArray(value).map(String).map(x => x.trim()).filter(Boolean))];
}

const MEETING_CONFIDENTIALITY_VALUES = ["normal", "restricted", "confidential"];

function normalizeMeetingConfidentiality(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return MEETING_CONFIDENTIALITY_VALUES.includes(normalized) ? normalized : "normal";
}

function meetingConfidentialityLabel(value) {
  return ({ normal: "Normal", restricted: "Restreint", confidential: "Confidentiel" })[normalizeMeetingConfidentiality(value)] || "Normal";
}

function meetingConfidentialityBadge(value) {
  const level = normalizeMeetingConfidentiality(value);
  const css = level === "confidential" ? "red" : level === "restricted" ? "orange" : "green";
  return `<span class="badge ${css}">${meetingConfidentialityLabel(level)}</span>`;
}

function normalizeMeetingEnrichment(value = {}, options = {}) {
  const source = value && typeof value === "object" ? value : {};
  const legacyNotes = options.external === true ? source.notes : "";
  const legacyReport = options.external === true ? source.report : "";
  const normalized = {
    ...source,
    preparation: String(source.preparation ?? ""),
    meetingNotes: String(source.meetingNotes ?? legacyNotes ?? ""),
    meetingReport: String(source.meetingReport ?? legacyReport ?? ""),
    nextSteps: String(source.nextSteps ?? ""),
    confidentiality: normalizeMeetingConfidentiality(source.confidentiality)
  };
  if (options.external === true) {
    normalized.linkedFolderIds = normalizeLinkedIdArray(source.linkedFolderIds ?? source.linkedFolders ?? []);
    normalized.linkedProjectIds = normalizeLinkedIdArray(source.linkedProjectIds ?? source.linkedProjects ?? []);
    normalized.linkedActionIds = normalizeLinkedIdArray(source.linkedActionIds ?? source.linkedActions ?? []);
    normalized.linkedDecisionIds = normalizeLinkedIdArray(source.linkedDecisionIds ?? source.linkedDecisions ?? []);
    normalized.linkedDocumentIds = normalizeLinkedIdArray(source.linkedDocumentIds ?? source.linkedDocuments ?? []);
    const managerSource = ensureArray(source.linkedManagerIds).length ? source.linkedManagerIds : source.linkedManagers;
    normalized.linkedManagerIds = normalizeLinkedManagerIds(ensureArray(managerSource));
  }
  return normalized;
}

function meetingFollowUpSummaryHtml(value, options = {}) {
  const meeting = normalizeMeetingEnrichment(value);
  const restricted = ["restricted", "confidential"].includes(meeting.confidentiality);
  const rows = [];
  if (meeting.preparation) rows.push(`<div><strong>Préparation</strong><p>${esc(meeting.preparation)}</p></div>`);
  if (meeting.meetingNotes) rows.push(`<div><strong>Notes</strong><p>${esc(meeting.meetingNotes)}</p></div>`);
  if (meeting.meetingReport) rows.push(`<div><strong>Compte rendu</strong><p>${esc(meeting.meetingReport)}</p></div>`);
  if (meeting.nextSteps) rows.push(`<div><strong>Prochaines étapes</strong><p>${esc(meeting.nextSteps)}</p></div>`);
  const badge = meetingConfidentialityBadge(meeting.confidentiality);
  if (!rows.length && meeting.confidentiality === "normal") return "";
  if (restricted && options.maskSensitive === true) {
    return `<div class="deos-link-summary"><strong>Suivi du rendez-vous</strong>${badge}<p class="muted">Le contenu détaillé est masqué dans ce contexte.</p></div>`;
  }
  return `<div class="deos-link-summary"><strong>Suivi du rendez-vous</strong>${badge}<div class="meeting-followup-summary">${rows.join("")}</div></div>`;
}

function sameId(a, b) {
  return String(a) === String(b);
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

function normalizeMeetingPreparation(item) {
  const base = {
    agendaId: "", status: "À préparer", organizer: identityName(), template: "", objectiveMain: "", expectedResults: "", expectedDecisions: "", prepLevel: "à démarrer",
    linkedManagers: [], linkedProjects: [], linkedFolders: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], linkedPerformance: [], finalReportId: "",
    ideas: [], agendaTopics: [], participants: [], prepItems: [], usefulDocuments: [], performanceLinks: [], arbitrations: [],
    run: { currentIndex: 0, presentParticipants: [], notes: [], decisions: [], actions: [], postponed: [], startedAt: "", finishedAt: "" }
  };
  const merged = { ...base, ...item, run: { ...base.run, ...(item.run || {}) } };
  const withIds = list => ensureArray(list).map(x => typeof x === "string" ? { id: newId("prep"), text: x } : { ...x, id: x.id || newId("prep") });
  return {
    ...merged,
    linkedManagers: ensureArray(merged.linkedManagers),
    linkedProjects: ensureArray(merged.linkedProjects),
    linkedFolders: ensureArray(merged.linkedFolders),
    linkedActions: ensureArray(merged.linkedActions),
    linkedDecisions: ensureArray(merged.linkedDecisions),
    linkedDocuments: ensureArray(merged.linkedDocuments),
    linkedPerformance: ensureArray(merged.linkedPerformance),
    ideas: withIds(merged.ideas).map((idea, i) => ({
      category: "Sujet",
      status: "À traiter",
      createdAt: idea.createdAt || new Date().toLocaleString("fr-FR"),
      conclusion: "",
      order: i + 1,
      ...idea
    })),
    agendaTopics: withIds(merged.agendaTopics).map((t, i) => ({ order: i + 1, status: "À traiter", ...t })),
    participants: withIds(merged.participants).map(p => ({ type: "external", status: "Présent attendu", role: "", topics: "", ...p })),
    prepItems: withIds(merged.prepItems).map(x => ({ status: "À faire", priority: "normale", ...x })),
    usefulDocuments: withIds(merged.usefulDocuments).map(x => ({ status: "À préparer", ...x })),
    performanceLinks: withIds(merged.performanceLinks),
    arbitrations: withIds(merged.arbitrations).map(x => ({ status: "À préparer", ...x })),
    run: { ...merged.run, presentParticipants: ensureArray(merged.run.presentParticipants), notes: withIds(merged.run.notes), decisions: withIds(merged.run.decisions), actions: withIds(merged.run.actions), postponed: withIds(merged.run.postponed) }
  };
}

function suggestLinkIcon(value = "") {
  const text = String(value || "").toLowerCase();
  if (/gmail|mail|email|courriel/.test(text)) return "✉️";
  if (/google drive|drive/.test(text)) return "📁";
  if (/\brh\b|ressources humaines|portail rh/.test(text)) return "👥";
  if (/tableau de bord|dashboard|kpi|performance/.test(text)) return "📊";
  if (/planning|agenda|calendrier/.test(text)) return "🗓️";
  if (/\bcse\b|social|dialogue/.test(text)) return "👥";
  if (/blink/.test(text)) return "🔗";
  if (/appollo|apollo/.test(text)) return "🚀";
  if (/temptation/.test(text)) return "🍫";
  if (/signature/.test(text)) return "✍️";
  if (/document|docs|pdf|fichier/.test(text)) return "📄";
  return "🔗";
}

function repairEncodingText(value) {
  const fixes = [
    ["\\u00f0\\u0178\\u0178\\u00a0", "??"], ["\\u00f0\\u0178\\u0178\\u00a2", "??"], ["\\u00f0\\u0178\\u0178", "??"],
    ["\\u00f0\\u0178\\u017d\\u00af", "??"], ["\\u00f0\\u0178\\u201c\\u2026", "??"], ["\\u00f0\\u0178\\u2018\\u00a4", "??"],
    ["\\u00f0\\u0178\\u201c\\u009d", "??"], ["\\u00f0\\u0178\\u201c\\u008d", "??"], ["\\u00f0\\u0178\\u201c\\u00a6", "??"],
    ["\\u00f0\\u0178\\u201c\\u02c6", "??"], ["\\u00f0\\u0178\\u0161\\u00a9", "??"], ["\\u00f0\\u0178\\u201c\\u0152", "??"],
    ["\\u00f0\\u0178\\u201c\\u201e", "??"], ["\\u00f0\\u0178\\u2022\\u02dc", "??"],
    ["\\u00c3\\u20ac", "À"], ["\\u00c3\\u2030", "É"], ["\\u00c3\\u00a9", "é"], ["\\u00c3\\u00a8", "è"],
    ["\\u00c3\\u00aa", "ê"], ["\\u00c3\\u00ab", "ë"], ["\\u00c3\\u00a2", "â"], ["\\u00c3\\u00b4", "ô"],
    ["\\u00c3\\u00bb", "û"], ["\\u00c3\\u00b9", "ù"], ["\\u00c3\\u00a7", "ç"], ["\\u00c3\\u00ae", "î"],
    ["\\u00c3\\u00af", "ï"], ["\\u00c2\\u00b7", "·"], ["\\u00c2", ""]
  ];
  return fixes.reduce((text, [pattern, replacement]) => text.replace(new RegExp(pattern, "g"), replacement), String(value));
}

function repairEncodingValue(value) {
  if (typeof value === "string") return repairEncodingText(value);
  if (Array.isArray(value)) return value.map(repairEncodingValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairEncodingValue(v)]));
  return value;
}

function normalizeEntity(name, item) {
  item = repairEncodingValue(item);
  const base = { ...item, id: item.id || newId(name) };
  if (name === "managers") {
    const template = defaults.managers.find(m => m.id === base.id) || {};
    const merged = { priority: "", lastInterview: "", nextMeeting: "", objectives: [], strengths: [], watchPoints: [], actions: [], linkedActions: [], linkedProjects: [], linkedDecisions: [], linkedFolders: [], events: [], directorNotes: [], ...template, ...base };
    return { ...merged, objectives: ensureArray(merged.objectives), strengths: ensureArray(merged.strengths), watchPoints: ensureArray(merged.watchPoints), actions: ensureArray(merged.actions), linkedActions: ensureArray(merged.linkedActions), linkedProjects: ensureArray(merged.linkedProjects), linkedDecisions: ensureArray(merged.linkedDecisions), linkedFolders: ensureArray(merged.linkedFolders), events: ensureTimeline(merged.events), directorNotes: ensureNotes(merged.directorNotes) };
  }
  if (name === "projects") {
    const template = defaults.projects.find(p => p.id === base.id) || {};
    const inferredOwner = state.managers.find(m => m.id === base.ownerId || m.name === base.owner);
    const merged = { objective: "", owner: "", ownerId: "", linkedManagers: [], linkedFolders: [], launchDate: "", deadline: "", priorityLevel: "orange", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [], ...template, ...base };
    if (!merged.ownerId && inferredOwner) merged.ownerId = inferredOwner.id;
    if (merged.ownerId && !merged.owner) merged.owner = projectOwnerName(merged);
    return { ...merged, progress: Number(merged.progress || 0), linkedManagers: ensureArray(merged.linkedManagers), linkedFolders: ensureArray(merged.linkedFolders), milestones: ensureMilestones(merged.milestones), linkedActions: ensureArray(merged.linkedActions), linkedDecisions: ensureArray(merged.linkedDecisions), linkedDocuments: ensureArray(merged.linkedDocuments), events: ensureTimeline(merged.events), directorNotes: ensureNotes(merged.directorNotes) };
  }
  if (name === "decisions") {
    const template = defaults.decisions.find(d => d.id === base.id) || {};
    const merged = { date: today(), status: "decided", importance: "orange", context: "", problem: "", decision: "", rationale: "", alternatives: "", impacts: base.impact || "", risks: "", owner: "", linkedManagers: [], linkedProjects: [], linkedActions: [], linkedDocuments: [], linkedFolders: [], reviewDate: "", events: [], directorNotes: [], nextStep: "", tags: [], ...template, ...base };
    return { ...merged, tags: ensureArray(merged.tags), linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects), linkedActions: ensureArray(merged.linkedActions), linkedDocuments: ensureArray(merged.linkedDocuments), linkedFolders: ensureArray(merged.linkedFolders), events: ensureTimeline(merged.events), directorNotes: ensureNotes(merged.directorNotes) };
  }
  if (name === "priorities") return { owner: "", impact: "", done: false, linkedFolders: [], ...base, linkedFolders: ensureArray(base.linkedFolders) };
  if (name === "journal") {
    const merged = { date: today(), entryType: "Note rapide", summary: base.content || "", facts: "", analysis: "", decisionsText: "", actionsText: "", linkedManagers: [], linkedProjects: [], linkedDecisions: [], linkedActions: [], linkedDocuments: [], linkedFolders: [], watchPoints: "", nextSteps: "", notes: "", events: [], tags: [], mood: "", links: "", ...base };
    return { ...merged, tags: ensureArray(merged.tags), linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects), linkedDecisions: ensureArray(merged.linkedDecisions), linkedActions: ensureArray(merged.linkedActions), linkedDocuments: ensureArray(merged.linkedDocuments), linkedFolders: ensureArray(merged.linkedFolders), events: ensureTimeline(merged.events) };
  }
  if (name === "documents") {
    const merged = { type: "", category: "", status: "Brouillon", owner: "", author: "", version: "V1", date: base.updatedAt || isoToday(), updatedAt: isoToday(), summary: "", tags: [], content: "", linkedManagers: [], linkedProjects: [], linkedFolders: [], linkedDecisions: [], linkedJournal: [], linkedActions: [], linkedPerformance: [], sourceType: "", sourceId: "", reportTemplate: "", ...base };
    return { ...merged, tags: ensureArray(merged.tags), linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects), linkedFolders: ensureArray(merged.linkedFolders), linkedDecisions: ensureArray(merged.linkedDecisions), linkedJournal: ensureArray(merged.linkedJournal), linkedActions: ensureArray(merged.linkedActions), linkedPerformance: ensureArray(merged.linkedPerformance) };
  }
  if (name === "activity") return { detail: "", date: new Date().toLocaleString("fr-FR"), entityId: "", ...base };
  if (name === "agenda") {
    const raw = { ...base };
    const hasStartTime = Object.prototype.hasOwnProperty.call(raw, "startTime") && String(raw.startTime || "").trim() !== "";
    const hasTime = Object.prototype.hasOwnProperty.call(raw, "time") && String(raw.time || "").trim() !== "";
    const allDay = raw.allDay === true || (!hasStartTime && !hasTime && raw.allDay !== false);
    const description = String(raw.description || raw.notes || raw.detail || "").trim();
    const linkedManagerIds = normalizeLinkedManagerIds(ensureArray(raw.linkedManagerIds).length ? ensureArray(raw.linkedManagerIds) : ensureArray(raw.linkedManagers));
    const followUp = normalizeMeetingEnrichment(raw);
    const merged = {
      ...raw,
      date: raw.date || localIsoDate(),
      startTime: hasStartTime ? String(raw.startTime || "").trim() : hasTime ? String(raw.time || "").trim() : "",
      endTime: String(raw.endTime || "").trim(),
      title: raw.title || "Rendez-vous",
      type: raw.type || "Autre",
      location: raw.location || "",
      description,
      notes: raw.notes || description,
      detail: raw.detail || description,
      allDay,
      status: raw.status || "confirmed",
      source: raw.source || "manual",
      externalId: raw.externalId || "",
      calendarId: raw.calendarId || "",
      syncStatus: raw.syncStatus || "local",
      lastSyncedAt: raw.lastSyncedAt || "",
      createdAt: raw.createdAt || localIsoDate(),
      updatedAt: raw.updatedAt || localIsoDate(),
      linkedManagerIds,
      linkedManagers: linkedManagerIds,
      linkedProjects: ensureArray(raw.linkedProjects),
      linkedFolders: ensureArray(raw.linkedFolders),
      preparation: followUp.preparation,
      meetingNotes: followUp.meetingNotes,
      meetingReport: followUp.meetingReport,
      nextSteps: followUp.nextSteps,
      confidentiality: followUp.confidentiality
    };
    return merged;
  }
  if (name === "actions") return { link: "", owner: "", due: "", level: "orange", done: false, linkedFolders: [], linkedProjects: [], linkedDecisions: [], linkedMeetingPreparations: [], ...base, linkedFolders: ensureArray(base.linkedFolders), linkedProjects: ensureArray(base.linkedProjects), linkedDecisions: ensureArray(base.linkedDecisions), linkedMeetingPreparations: ensureArray(base.linkedMeetingPreparations) };
  if (name === "performance") return normalizePerformance(base);
  if (name === "performance_imports") {
    const merged = { importDate: new Date().toLocaleString("fr-FR"), sourceFile: "", sourceType: "", period: "", indicators: [], status: "brouillon", validatedBy: "", comments: "", files: [], preview: [], conflicts: [], ...base };
    return { ...merged, indicators: ensureArray(merged.indicators), files: ensureArray(merged.files), preview: ensureArray(merged.preview), conflicts: ensureArray(merged.conflicts) };
  }
  if (name === "meetingPreparations") return normalizeMeetingPreparation(base);
  if (name === "links") {
    const merged = { name: "", url: "", category: "Autre", description: "", status: "actif", favorite: false, icon: "", order: Date.now(), createdAt: isoToday(), updatedAt: isoToday(), ...base };
    return { ...merged, favorite: Boolean(merged.favorite), icon: merged.icon || suggestLinkIcon(`${merged.name} ${merged.url} ${merged.category}`), order: Number(merged.order || Date.now()) };
  }
  if (name === "folders") {
    const template = defaults.folders.find(f => f.id === base.id) || {};
    const merged = { name: "", category: "Autre", status: "orange", priorityLevel: "orange", owner: "", ownerId: "", linkedManagers: [], description: "", context: "", objectives: "", expectedResults: "", createdAt: isoToday(), deadline: "", tags: [], directorNotes: "", archived: false, ...template, ...base };
    const managerSource = ensureArray(merged.linkedManagers).length ? merged.linkedManagers : ensureArray(merged.linkedManagerIds);
    const { linkedManagerIds: _legacyLinkedManagerIds, ...rest } = merged;
    return { ...rest, linkedManagers: normalizeLinkedManagerIds(ensureArray(managerSource)), tags: ensureArray(merged.tags) };
  }
  return base;
}

function normalizeCollection(name, data) {
  return (Array.isArray(data) ? data : []).map(item => normalizeEntity(name, item));
}

function byId(name, id) {
  return state[name].find(x => sameId(x.id, id));
}

function indexById(name, id) {
  return state[name].findIndex(x => sameId(x.id, id));
}

function addActivity(type, title, detail = "", entityId = "") {
  state.activity.unshift({ id: newId("activity"), type, title, detail, entityId, date: new Date().toLocaleString("fr-FR") });
  state.activity = state.activity.slice(0, 50);
  persist("activity");
}

async function init() {
  identity = savedIdentity(await loadIdentityDefaults());
  persistIdentity();
  applyIdentity();
  for (const name of entities) {
    state[name] = normalizeCollection(name, saved(name, await loadJson(name)));
    persist(name);
  }
  state.settings = ensureSettings(saved("settings", {}));
  // V5.5 — Charger les événements externes (Google Calendar)
  state.externalCalendarEvents = saved("external_events", []);
  // V5.7 — Charger les enrichissements locaux des événements Google
  state.externalEventEnrichments = saved("external_event_enrichments", {});
  ensureExternalEventEnrichments();
  // [DEOS STATE TRACE] After loadState
  console.log("[DEOS STATE TRACE] after loadState:", state.externalCalendarEvents.length);
  // Restaurer la session Google si disponible (token sessionStorage seulement)
  const _gcToken = sessionStorage.getItem("deos_gc_token");
  if (_gcToken) {
    googleAccessToken = _gcToken;
    googleConnectionStatus = "connected";
    googleConnectedEmail = sessionStorage.getItem("deos_gc_email") || "";
  } else if (getCalendarConnectionSettings().provider === "google") {
    googleConnectionStatus = "connection_required";
  }
  // V5.6 — Restaurer l'état de synchronisation Google et lancer auto-sync
  const settings = getCalendarConnectionSettings();
  if (settings.lastSyncAt) googleLastSyncAt = parseInt(settings.lastSyncAt, 10) || null;
  if (googleConnectionStatus === "connected" && settings.googleCalendarId && settings.syncFrequency !== "manual") {
    if (shouldRunGoogleSyncNow()) {
      console.log("[DEOS Google Calendar] Sync immédiate au démarrage (dernière synchro dépassée)");
      syncGoogleCalendarNow().catch(e => console.error("[DEOS Google Calendar] Erreur sync démarrage:", e));
    } else {
      scheduleNextGoogleSync();
    }
    startGoogleCalendarAutoSync();
  }
  const restoreMessage = localStorage.getItem("deos_restore_success");
  if (restoreMessage) {
    restoreSuccessMessage = restoreMessage;
    localStorage.removeItem("deos_restore_success");
  }
  document.getElementById("today").textContent = cockpitDateLabel(new Date());
  document.querySelectorAll(".nav").forEach(btn => btn.onclick = () => setView(btn.dataset.view));
  document.addEventListener("change", onAgendaFormSelectionChange);
  document.getElementById("searchInput").oninput = e => runSearch(e.target.value);
  if (restoreSuccessMessage) {
    setView("settings");
  } else {
    setView("cockpit");
  }
}

function setView(view) {
  currentView = view;
  if (view !== "graph" && !graphNavigationLock) graphReturnContext = null;
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  const titles = { cockpit: "Cockpit décisionnel", graph: "Vue graphique", folders: "Dossiers", performance: "Performance", priorities: "Priorités V5", actions: "Actions", managers: "Managers V5", projects: "Projets V5", decisions: "Décisions V5", journal: "Journal", documents: "Documents", links: "Liens utiles", activity: "Agenda / Réunions", settings: "Paramètres" };
  document.getElementById("viewTitle").textContent = titles[view] || identity.appName;
  const views = { cockpit: renderCockpit, graph: renderGraph, folders: renderFolders, performance: renderPerformance, priorities: renderPriorities, actions: renderActions, managers: renderManagers, projects: renderProjects, decisions: renderDecisions, journal: renderJournal, documents: renderDocuments, links: renderLinks, activity: renderActivity, settings: renderSettings };
  if (views[view]) views[view]();
}

function renderGraph() {
  const data = buildDeosGraph({
    typeFilter: graphTypeFilter,
    onlyLinked: graphOnlyLinked,
    search: graphSearch,
    depth: graphDepth,
    selectedNodeId: graphSelectedNodeId
  });
  if (graphSelectedNodeId && !data.nodes.some(node => node.id === graphSelectedNodeId)) {
    graphSelectedNodeId = "";
  }
  const selected = data.nodes.find(node => node.id === graphSelectedNodeId) || null;
  const layout = layoutDeosGraph(data);
  const viewWidth = layout.width / graphZoom;
  const viewHeight = layout.height / graphZoom;
  const nodesById = new Map(data.nodes.map(node => [node.id, node]));
  const connectedIds = new Set();
  if (selected) {
    data.edges.forEach(edge => {
      if (edge.from === selected.id) connectedIds.add(edge.to);
      if (edge.to === selected.id) connectedIds.add(edge.from);
    });
  }
  const edgesHtml = data.edges.map(edge => {
    const a = layout.positions[edge.from];
    const b = layout.positions[edge.to];
    if (!a || !b) return "";
    const active = selected && (edge.from === selected.id || edge.to === selected.id);
    return `<line class="deos-graph-link ${active ? "active" : selected ? "dim" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  }).join("");
  const nodesHtml = data.nodes.map(node => {
    const pos = layout.positions[node.id] || { x: 200, y: 200 };
    const isSelected = selected && node.id === selected.id;
    const isDim = selected && !isSelected && !connectedIds.has(node.id);
    const conf = node.confidentiality && node.confidentiality !== "normal"
      ? `<tspan class="node-conf"> · ${esc(meetingConfidentialityLabel(node.confidentiality))}</tspan>`
      : "";
    return `<g class="deos-graph-node kind-${esc(node.kind)} ${isSelected ? "selected" : ""} ${isDim ? "dim" : ""}" data-node-id="${esc(node.id)}" onclick="selectGraphNode('${esc(node.id)}')">
      <circle cx="${pos.x}" cy="${pos.y}" r="31"></circle>
      <text x="${pos.x}" y="${pos.y - 2}" text-anchor="middle" class="deos-graph-emoji">${esc(node.icon || "•")}</text>
      <text x="${pos.x}" y="${pos.y + 48}" text-anchor="middle" class="deos-graph-label">${esc(node.shortLabel)}</text>
      <text x="${pos.x}" y="${pos.y + 63}" text-anchor="middle" class="deos-graph-meta">${esc(node.kindLabel)}${conf}</text>
    </g>`;
  }).join("");

  appHtml(`<div class="card hero"><div class="row"><div><h2>Vue graphique des liens DEOS</h2><p class="muted">Visualisation multi-entités des relations structurées, sans modification des données métier.</p></div><div class="row-actions"><button class="secondary" onclick="setView('cockpit')">Retour Cockpit</button></div></div></div>
  <div class="card deos-graph-card">
    <div class="deos-graph-toolbar">
      <input value="${esc(graphSearch)}" placeholder="Rechercher (nom, titre, rôle, tag...)" oninput="setGraphSearch(this.value)">
      <select onchange="setGraphTypeFilter(this.value)">
        <option value="all" ${graphTypeFilter === "all" ? "selected" : ""}>Tous les types</option>
        <option value="core" ${graphTypeFilter === "core" ? "selected" : ""}>Dossiers / Projets / Managers</option>
        <option value="execution" ${graphTypeFilter === "execution" ? "selected" : ""}>Actions / Décisions / Priorités</option>
        <option value="knowledge" ${graphTypeFilter === "knowledge" ? "selected" : ""}>Journal / Documents / Performance</option>
        <option value="meetings" ${graphTypeFilter === "meetings" ? "selected" : ""}>Rendez-vous (DEOS + Google)</option>
      </select>
      <select onchange="setGraphDepth(this.value)">
        <option value="all" ${graphDepth === "all" ? "selected" : ""}>Profondeur : tout le graphe</option>
        <option value="1" ${graphDepth === "1" ? "selected" : ""}>Profondeur : 1 lien</option>
        <option value="2" ${graphDepth === "2" ? "selected" : ""}>Profondeur : 2 liens</option>
        <option value="3" ${graphDepth === "3" ? "selected" : ""}>Profondeur : 3 liens</option>
      </select>
      <label class="graph-check"><input type="checkbox" ${graphOnlyLinked ? "checked" : ""} onchange="setGraphOnlyLinked(this.checked)"> Masquer les nœuds isolés</label>
      <button class="secondary" onclick="zoomGraph(1.18)">Zoom +</button>
      <button class="secondary" onclick="zoomGraph(0.85)">Zoom -</button>
      <button class="secondary" onclick="recenterGraph()">Recentrer</button>
      <button class="secondary" onclick="resetGraphZoom()">Réinitialiser zoom</button>
      <button class="secondary" onclick="clearGraphSelection()">Réinitialiser sélection</button>
    </div>
    <div class="deos-graph-layout">
      <svg class="deos-graph-svg" viewBox="${graphPan.x} ${graphPan.y} ${viewWidth} ${viewHeight}" onwheel="graphWheel(event)" onmousedown="startGraphPan(event)" onmousemove="moveGraphPan(event)" onmouseup="endGraphPan()" onmouseleave="endGraphPan()">
        <rect class="deos-graph-bg" x="${graphPan.x}" y="${graphPan.y}" width="${viewWidth}" height="${viewHeight}"></rect>
        ${edgesHtml}
        ${nodesHtml}
      </svg>
      <aside class="deos-graph-side">
        <div class="graph-legend">
          <span>${data.nodes.length} nœud(s) visibles · ${data.edges.length} relation(s) visibles</span>
          <span>${data.totalNodes} nœud(s) total · ${data.totalEdges} relation(s) total</span>
          <span>Rendu : SVG natif</span>
        </div>
        ${renderGraphDetailPanel(selected, nodesById, data)}
      </aside>
    </div>
  </div>`);
}

function graphNodeId(kind, sourceId) {
  return `${String(kind || "")}:${String(sourceId || "")}`;
}

function parseGraphNodeId(nodeId) {
  const value = String(nodeId || "");
  const idx = value.indexOf(":");
  if (idx < 0) return { kind: "", sourceId: value };
  return { kind: value.slice(0, idx), sourceId: value.slice(idx + 1) };
}

function graphKindMeta(kind) {
  const meta = {
    folder: { label: "Dossier", icon: "📁" },
    project: { label: "Projet", icon: "📁" },
    action: { label: "Action", icon: "✅" },
    decision: { label: "Décision", icon: "📌" },
    manager: { label: "Manager", icon: "👥" },
    journal: { label: "Journal", icon: "📝" },
    document: { label: "Document", icon: "📄" },
    priority: { label: "Priorité", icon: "🎯" },
    performance: { label: "Performance", icon: "📊" },
    agenda_manual: { label: "Réunion DEOS", icon: "🕘" },
    agenda_google: { label: "Réunion Google", icon: "📅" }
  };
  return meta[kind] || { label: "Objet", icon: "•" };
}

function graphShortLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "Sans titre";
  return text.length > 32 ? `${text.slice(0, 29)}...` : text;
}

function graphEntitySearchText(item, extra = "") {
  return normalizeText([item?.name, item?.title, item?.role, item?.category, item?.type, item?.status, item?.summary, item?.context, item?.objective, item?.owner, item?.location, item?.date, ensureArray(item?.tags).join(" "), extra].filter(Boolean).join(" "));
}

function buildDeosGraph(options = {}) {
  const nodes = new Map();
  const edges = new Map();
  const addNode = (kind, sourceId, label, item = {}, extra = {}) => {
    const id = String(sourceId || "").trim();
    if (!id) return;
    const key = graphNodeId(kind, id);
    if (nodes.has(key)) return;
    const meta = graphKindMeta(kind);
    nodes.set(key, {
      id: key,
      kind,
      sourceId: id,
      label: String(label || "Sans titre"),
      shortLabel: graphShortLabel(label),
      kindLabel: meta.label,
      icon: meta.icon,
      confidentiality: normalizeMeetingConfidentiality(extra.confidentiality || item?.confidentiality || "normal"),
      searchText: graphEntitySearchText(item, extra.searchText || ""),
      source: item,
      extra
    });
  };
  const ensureNode = (kind, sourceId) => nodes.has(graphNodeId(kind, sourceId));
  const addEdge = (fromKind, fromId, toKind, toId, relation) => {
    const from = graphNodeId(fromKind, fromId);
    const to = graphNodeId(toKind, toId);
    if (from === to || !nodes.has(from) || !nodes.has(to)) return;
    const id = [from, to, relation].join("=>");
    if (!edges.has(id)) edges.set(id, { id, from, to, relation });
  };
  const linkMany = (fromKind, fromId, toKind, ids, relation) => {
    ensureArray(ids).map(x => String(x || "").trim()).filter(Boolean).forEach(targetId => {
      if (ensureNode(toKind, targetId)) addEdge(fromKind, fromId, toKind, targetId, relation);
    });
  };

  state.folders.forEach(folder => addNode("folder", folder.id, folder.name, folder));
  state.projects.forEach(project => addNode("project", project.id, project.name, project));
  state.actions.forEach(action => addNode("action", action.id, action.title, action));
  state.decisions.forEach(decision => addNode("decision", decision.id, decision.title, decision));
  state.managers.forEach(manager => addNode("manager", manager.id, manager.name, manager));
  state.journal.forEach(journal => addNode("journal", journal.id, journal.title, journal));
  state.documents.forEach(document => addNode("document", document.id, document.title, document));
  state.priorities.forEach(priority => addNode("priority", priority.id, priority.title, priority));
  state.performance.forEach(perf => addNode("performance", perf.id, perfPeriodLabel(perf), perf));

  state.agenda.forEach(meeting => {
    const confidentiality = normalizeMeetingConfidentiality(meeting.confidentiality || "normal");
    const hidden = confidentiality !== "normal";
    addNode("agenda_manual", meeting.id, hidden ? "Rendez-vous confidentiel" : (meeting.title || "Rendez-vous"), meeting, {
      confidentiality,
      searchText: hidden ? "reunion deos confidentielle" : ""
    });
  });
  (state.externalCalendarEvents || []).forEach(event => {
    const eventKey = String(event._key || `google_${event.externalId || event.id || ""}`);
    if (!eventKey) return;
    const enrichment = getExternalEventEnrichment(eventKey);
    const confidentiality = normalizeMeetingConfidentiality(enrichment.confidentiality || "normal");
    const hidden = confidentiality !== "normal";
    addNode("agenda_google", eventKey, hidden ? "Rendez-vous Google confidentiel" : (event.title || "Rendez-vous Google"), event, {
      confidentiality,
      searchText: hidden ? "reunion google confidentielle" : (event.calendarName || "")
    });
  });

  state.projects.forEach(project => {
    linkMany("project", project.id, "folder", project.linkedFolders, "linkedFolders");
    linkMany("project", project.id, "manager", project.linkedManagers, "linkedManagers");
    if (project.ownerId) linkMany("project", project.id, "manager", [project.ownerId], "ownerId");
    linkMany("project", project.id, "action", project.linkedActions, "linkedActions");
    linkMany("project", project.id, "decision", project.linkedDecisions, "linkedDecisions");
    linkMany("project", project.id, "document", project.linkedDocuments, "linkedDocuments");
  });
  state.actions.forEach(action => {
    linkMany("action", action.id, "folder", action.linkedFolders, "linkedFolders");
    linkMany("action", action.id, "project", action.linkedProjects, "linkedProjects");
    linkMany("action", action.id, "decision", action.linkedDecisions, "linkedDecisions");
    linkMany("action", action.id, "manager", action.linkedManagers, "linkedManagers");
  });
  state.decisions.forEach(decision => {
    linkMany("decision", decision.id, "folder", decision.linkedFolders, "linkedFolders");
    linkMany("decision", decision.id, "project", decision.linkedProjects, "linkedProjects");
    linkMany("decision", decision.id, "action", decision.linkedActions, "linkedActions");
    linkMany("decision", decision.id, "manager", decision.linkedManagers, "linkedManagers");
    linkMany("decision", decision.id, "document", decision.linkedDocuments, "linkedDocuments");
  });
  state.managers.forEach(manager => {
    linkMany("manager", manager.id, "folder", manager.linkedFolders, "linkedFolders");
    linkMany("manager", manager.id, "project", manager.linkedProjects, "linkedProjects");
    linkMany("manager", manager.id, "action", manager.linkedActions, "linkedActions");
    linkMany("manager", manager.id, "decision", manager.linkedDecisions, "linkedDecisions");
  });
  state.journal.forEach(journal => {
    linkMany("journal", journal.id, "folder", journal.linkedFolders, "linkedFolders");
    linkMany("journal", journal.id, "project", journal.linkedProjects, "linkedProjects");
    linkMany("journal", journal.id, "manager", journal.linkedManagers, "linkedManagers");
    linkMany("journal", journal.id, "action", journal.linkedActions, "linkedActions");
    linkMany("journal", journal.id, "decision", journal.linkedDecisions, "linkedDecisions");
    linkMany("journal", journal.id, "document", journal.linkedDocuments, "linkedDocuments");
  });
  state.documents.forEach(document => {
    linkMany("document", document.id, "folder", document.linkedFolders, "linkedFolders");
    linkMany("document", document.id, "project", document.linkedProjects, "linkedProjects");
    linkMany("document", document.id, "manager", document.linkedManagers, "linkedManagers");
    linkMany("document", document.id, "action", document.linkedActions, "linkedActions");
    linkMany("document", document.id, "decision", document.linkedDecisions, "linkedDecisions");
    linkMany("document", document.id, "journal", document.linkedJournal, "linkedJournal");
    linkMany("document", document.id, "performance", document.linkedPerformance, "linkedPerformance");
  });
  state.priorities.forEach(priority => {
    linkMany("priority", priority.id, "folder", priority.linkedFolders, "linkedFolders");
  });
  state.performance.forEach(perf => {
    linkMany("performance", perf.id, "folder", perf.linkedFolders, "linkedFolders");
    linkMany("performance", perf.id, "project", perf.linkedProjects, "linkedProjects");
    linkMany("performance", perf.id, "manager", perf.linkedManagers, "linkedManagers");
    linkMany("performance", perf.id, "action", perf.linkedActions, "linkedActions");
    linkMany("performance", perf.id, "decision", perf.linkedDecisions, "linkedDecisions");
    linkMany("performance", perf.id, "journal", perf.linkedJournal, "linkedJournal");
    linkMany("performance", perf.id, "document", perf.linkedDocuments, "linkedDocuments");
  });
  state.agenda.forEach(meeting => {
    const source = "manual";
    const meetingId = meeting.id;
    linkMany("agenda_manual", meetingId, "folder", meetingLinkIdsForType(meeting, "folder", source), "meetingLinkedFolder");
    linkMany("agenda_manual", meetingId, "project", meetingLinkIdsForType(meeting, "project", source), "meetingLinkedProject");
    linkMany("agenda_manual", meetingId, "manager", meetingLinkIdsForType(meeting, "manager", source), "meetingLinkedManager");
    linkMany("agenda_manual", meetingId, "action", meetingLinkIdsForType(meeting, "action", source), "meetingLinkedAction");
    linkMany("agenda_manual", meetingId, "decision", meetingLinkIdsForType(meeting, "decision", source), "meetingLinkedDecision");
  });
  (state.externalCalendarEvents || []).forEach(event => {
    const meetingId = String(event._key || `google_${event.externalId || event.id || ""}`);
    if (!meetingId) return;
    const enrichment = getExternalEventEnrichment(meetingId);
    const source = "google";
    linkMany("agenda_google", meetingId, "folder", meetingLinkIdsForType(enrichment, "folder", source), "meetingLinkedFolder");
    linkMany("agenda_google", meetingId, "project", meetingLinkIdsForType(enrichment, "project", source), "meetingLinkedProject");
    linkMany("agenda_google", meetingId, "manager", meetingLinkIdsForType(enrichment, "manager", source), "meetingLinkedManager");
    linkMany("agenda_google", meetingId, "action", meetingLinkIdsForType(enrichment, "action", source), "meetingLinkedAction");
    linkMany("agenda_google", meetingId, "decision", meetingLinkIdsForType(enrichment, "decision", source), "meetingLinkedDecision");
  });

  const totalNodes = nodes.size;
  const totalEdges = edges.size;
  let filteredNodes = [...nodes.values()];
  let filteredEdges = [...edges.values()];

  if (options.onlyLinked) {
    const linked = new Set();
    filteredEdges.forEach(edge => { linked.add(edge.from); linked.add(edge.to); });
    filteredNodes = filteredNodes.filter(node => linked.has(node.id));
  }

  const typeFilter = String(options.typeFilter || "all");
  if (typeFilter !== "all") {
    const allowed = {
      core: new Set(["folder", "project", "manager"]),
      execution: new Set(["action", "decision", "priority"]),
      knowledge: new Set(["journal", "document", "performance"]),
      meetings: new Set(["agenda_manual", "agenda_google"])
    }[typeFilter] || new Set();
    filteredNodes = filteredNodes.filter(node => allowed.has(node.kind));
  }

  const search = normalizeText(options.search || "").trim();
  if (search) {
    filteredNodes = filteredNodes.filter(node => node.searchText.includes(search));
  }

  const visibleNodeIds = new Set(filteredNodes.map(node => node.id));
  filteredEdges = filteredEdges.filter(edge => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));

  if (options.selectedNodeId && options.depth !== "all" && visibleNodeIds.has(options.selectedNodeId)) {
    const depthLimit = Math.max(1, Number(options.depth || 1));
    const adjacency = new Map();
    filteredEdges.forEach(edge => {
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
      if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
      adjacency.get(edge.from).add(edge.to);
      adjacency.get(edge.to).add(edge.from);
    });
    const keep = new Set([options.selectedNodeId]);
    let frontier = new Set([options.selectedNodeId]);
    for (let depth = 0; depth < depthLimit; depth += 1) {
      const next = new Set();
      frontier.forEach(nodeId => {
        (adjacency.get(nodeId) || new Set()).forEach(targetId => {
          if (!keep.has(targetId)) next.add(targetId);
          keep.add(targetId);
        });
      });
      frontier = next;
      if (!frontier.size) break;
    }
    filteredNodes = filteredNodes.filter(node => keep.has(node.id));
    const scoped = new Set(filteredNodes.map(node => node.id));
    filteredEdges = filteredEdges.filter(edge => scoped.has(edge.from) && scoped.has(edge.to));
  }

  return { nodes: filteredNodes, edges: filteredEdges, totalNodes, totalEdges };
}

function layoutDeosGraph(data) {
  const signature = `${data.nodes.map(node => node.id).sort().join("|")}::${data.edges.length}`;
  if (!graphLayoutCache || graphDataSignature !== signature) {
    graphLayoutCache = { positions: {} };
    graphDataSignature = signature;
  }
  const kindOrder = ["folder", "project", "manager", "action", "decision", "priority", "document", "journal", "performance", "agenda_manual", "agenda_google"];
  const grouped = new Map(kindOrder.map(kind => [kind, []]));
  data.nodes.forEach(node => {
    if (!grouped.has(node.kind)) grouped.set(node.kind, []);
    grouped.get(node.kind).push(node);
  });
  grouped.forEach(nodes => nodes.sort((a, b) => String(a.label).localeCompare(String(b.label))));

  const positions = graphLayoutCache.positions;
  let col = 0;
  const used = [];
  kindOrder.forEach(kind => {
    const items = grouped.get(kind) || [];
    if (!items.length) return;
    const x = 160 + (col * 250);
    items.forEach((node, index) => {
      if (!positions[node.id]) positions[node.id] = { x, y: 110 + (index * 110) };
      used.push(positions[node.id]);
    });
    col += 1;
  });

  const minX = used.length ? Math.min(...used.map(p => p.x)) : 0;
  const maxX = used.length ? Math.max(...used.map(p => p.x)) : 1200;
  const minY = used.length ? Math.min(...used.map(p => p.y)) : 0;
  const maxY = used.length ? Math.max(...used.map(p => p.y)) : 700;
  const width = Math.max(1200, (maxX - minX) + 360);
  const height = Math.max(720, (maxY - minY) + 260);
  return { positions, width, height, minX, maxX, minY, maxY };
}

function renderGraphDetailPanel(selected, nodesById, data) {
  if (!selected) {
    return `<div class="graph-preview empty"><strong>Aucun nœud sélectionné</strong><span>Cliquez un nœud pour afficher le détail, les relations et les actions d'ouverture.</span></div>`;
  }
  const related = data.edges.filter(edge => edge.from === selected.id || edge.to === selected.id);
  const neighbors = related.map(edge => nodesById.get(edge.from === selected.id ? edge.to : edge.from)).filter(Boolean);
  const rows = neighbors.slice(0, 10).map(node => `<div class="item clickable" onclick="selectGraphNode('${esc(node.id)}')"><strong>${esc(node.label)}</strong><span class="muted">${esc(node.kindLabel)}</span></div>`).join("") || `<div class="empty">Aucune relation visible avec les filtres actuels.</div>`;
  const conf = selected.confidentiality !== "normal" ? `<span class="badge orange">${esc(meetingConfidentialityLabel(selected.confidentiality))}</span>` : "";
  return `<div class="graph-preview"><strong>${esc(selected.label)}</strong><span>${esc(selected.kindLabel)} ${conf}</span><span>${related.length} relation(s) visible(s)</span><div class="row-actions"><button class="action" onclick="openGraphNode('${esc(selected.id)}')">Ouvrir la fiche</button></div></div><div class="card" style="margin-top:10px"><h2>Objets connectés</h2>${rows}</div>`;
}

function setGraphTypeFilter(value) {
  graphTypeFilter = value;
  renderGraph();
}

function setGraphDepth(value) {
  graphDepth = value;
  renderGraph();
}

function setGraphOnlyLinked(value) {
  graphOnlyLinked = Boolean(value);
  renderGraph();
}

function setGraphSearch(value) {
  graphSearch = value;
  renderGraph();
}

function clearGraphSelection() {
  graphSelectedNodeId = "";
  graphDepth = "all";
  renderGraph();
}

function selectGraphNode(nodeId) {
  graphSelectedNodeId = String(nodeId || "");
  renderGraph();
}

function captureGraphContext() {
  return {
    typeFilter: graphTypeFilter,
    onlyLinked: graphOnlyLinked,
    search: graphSearch,
    depth: graphDepth,
    selectedNodeId: graphSelectedNodeId,
    zoom: graphZoom,
    pan: { ...graphPan },
    layout: graphLayoutCache ? JSON.parse(JSON.stringify(graphLayoutCache)) : null,
    signature: graphDataSignature
  };
}

function returnToGraph() {
  const ctx = graphReturnContext;
  graphReturnContext = null;
  if (ctx) {
    graphTypeFilter = ctx.typeFilter || "all";
    graphOnlyLinked = Boolean(ctx.onlyLinked);
    graphSearch = String(ctx.search || "");
    graphDepth = String(ctx.depth || "all");
    graphSelectedNodeId = String(ctx.selectedNodeId || "");
    graphZoom = Number(ctx.zoom || 1);
    graphPan = ctx.pan || { x: 0, y: 0 };
    graphLayoutCache = ctx.layout || null;
    graphDataSignature = String(ctx.signature || "");
  }
  graphNavigationLock = true;
  setView("graph");
  graphNavigationLock = false;
}

function openGraphNode(nodeId) {
  const parsed = parseGraphNodeId(nodeId);
  const sourceId = parsed.sourceId;
  if (!parsed.kind || !sourceId) return;
  graphReturnContext = captureGraphContext();
  graphNavigationLock = true;
  try {
    if (parsed.kind === "folder") { setView("folders"); openFolder(sourceId); return; }
    if (parsed.kind === "project") { setView("projects"); openProject(sourceId); return; }
    if (parsed.kind === "action") { setView("actions"); openAction(sourceId); return; }
    if (parsed.kind === "decision") { setView("decisions"); openDecision(sourceId); return; }
    if (parsed.kind === "manager") { setView("managers"); openManager(sourceId); return; }
    if (parsed.kind === "journal") { setView("journal"); openJournal(sourceId); return; }
    if (parsed.kind === "document") { setView("documents"); editDocument(sourceId); return; }
    if (parsed.kind === "priority") { setView("priorities"); return; }
    if (parsed.kind === "performance") { setView("performance"); return; }
    if (parsed.kind === "agenda_manual") {
      setView("activity");
      meetingOriginContext = { type: "graph", id: "" };
      editAgenda(sourceId);
      return;
    }
    if (parsed.kind === "agenda_google") {
      setView("activity");
      meetingOriginContext = { type: "graph", id: "" };
      openExternalEventModal(sourceId);
      return;
    }
  } finally {
    graphNavigationLock = false;
  }
}

function zoomGraph(ratio) {
  graphZoom = Math.max(0.45, Math.min(2.8, graphZoom * ratio));
  renderGraph();
}

function recenterGraph() {
  const data = buildDeosGraph({
    typeFilter: graphTypeFilter,
    onlyLinked: graphOnlyLinked,
    search: graphSearch,
    depth: graphDepth,
    selectedNodeId: graphSelectedNodeId
  });
  const layout = layoutDeosGraph(data);
  graphPan = { x: Math.max(0, layout.minX - 140), y: Math.max(0, layout.minY - 120) };
  renderGraph();
}

function resetGraphZoom() {
  graphZoom = 1;
  graphPan = { x: 0, y: 0 };
  renderGraph();
}

function graphWheel(event) {
  event.preventDefault();
  zoomGraph(event.deltaY < 0 ? 1.12 : 0.9);
}

function startGraphPan(event) {
  if (event.target.closest(".deos-graph-node")) return;
  graphDragPan = { x: event.clientX, y: event.clientY, panX: graphPan.x, panY: graphPan.y };
}

function moveGraphPan(event) {
  if (!graphDragPan) return;
  graphPan = {
    x: graphDragPan.panX - (event.clientX - graphDragPan.x) / graphZoom,
    y: graphDragPan.panY - (event.clientY - graphDragPan.y) / graphZoom
  };
  const svg = document.querySelector(".deos-graph-svg");
  if (!svg) return;
  const [, , width, height] = String(svg.getAttribute("viewBox") || "0 0 1200 720").split(/\s+/).map(Number);
  svg.setAttribute("viewBox", `${graphPan.x} ${graphPan.y} ${width || 1200} ${height || 720}`);
}

function endGraphPan() {
  graphDragPan = null;
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

function localIsoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localIsoAddDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return localIsoDate(d);
}

// Agenda helpers V5.3
function agendaStartTime(a) {
  return String((a && (a.startTime || a.time)) || "").trim();
}

function agendaDescription(a) {
  return String((a && (a.description || a.notes || a.detail)) || "").trim();
}

function agendaIsAllDay(a) {
  return Boolean(a && (a.allDay === true || String(a.allDay) === "true"));
}

function compareAgendaEvents(a, b) {
  const dr = dateRank(a?.date) - dateRank(b?.date);
  if (dr !== 0) return dr;
  const aAll = agendaIsAllDay(a);
  const bAll = agendaIsAllDay(b);
  if (aAll !== bAll) return aAll ? -1 : 1;
  const at = agendaStartTime(a) || "~"; // empty times sort after normal times
  const bt = agendaStartTime(b) || "~";
  const tcmp = String(at).localeCompare(String(bt));
  if (tcmp !== 0) return tcmp;
  return String((a?.title || "")).localeCompare(String((b?.title || "")));
}

function meetingLinkIdsForType(item, type, source = "manual") {
  if (!item || typeof item !== "object") return [];
  const map = {
    folder: source === "google" ? ["linkedFolderIds"] : ["linkedFolders", "linkedFolderIds"],
    project: source === "google" ? ["linkedProjectIds"] : ["linkedProjects", "linkedProjectIds"],
    action: source === "google" ? ["linkedActionIds"] : ["linkedActions", "linkedActionIds"],
    decision: source === "google" ? ["linkedDecisionIds"] : ["linkedDecisions", "linkedDecisionIds"],
    manager: ["linkedManagerIds", "linkedManagers"]
  };
  const keys = map[type] || [];
  if (!keys.length) return [];
  if (type === "manager") {
    return normalizeLinkedManagerIds(keys.flatMap(k => ensureArray(item[k])));
  }
  return normalizeLinkedIdArray(keys.flatMap(k => ensureArray(item[k])));
}

function normalizeMeetingForLinkedRender(item) {
  if (!item) return null;
  const source = item.source === "google" ? "google" : "manual";
  const sourceMeetingId = source === "google"
    ? String(item.eventKey || item._key || item.externalId || "")
    : String(item.id || "");
  if (!sourceMeetingId) return null;
  return {
    key: `${source}:${sourceMeetingId}`,
    source,
    sourceMeetingId,
    title: String(item.title || "Rendez-vous"),
    date: String(item.date || ""),
    startTime: String(item.startTime || item.time || ""),
    endTime: String(item.endTime || ""),
    allDay: agendaIsAllDay(item),
    location: String(item.location || ""),
    confidentiality: normalizeMeetingConfidentiality(item.confidentiality || "normal")
  };
}

function getMeetingsLinkedToObject(type, objectId) {
  const targetType = String(type || "").toLowerCase().trim();
  const targetId = String(objectId || "").trim();
  const supported = ["folder", "project", "action", "decision", "manager"];
  if (!targetId || !supported.includes(targetType)) return [];

  const out = [];
  const seen = new Set();
  const push = meeting => {
    if (!meeting || seen.has(meeting.key)) return;
    seen.add(meeting.key);
    out.push(meeting);
  };

  state.agenda.forEach(a => {
    const linked = meetingLinkIdsForType(a, targetType, "manual");
    if (!linked.includes(targetId)) return;
    push(normalizeMeetingForLinkedRender({ ...a, source: "manual" }));
  });

  (state.externalCalendarEvents || []).forEach(ev => {
    const eventKey = String(ev?._key || `google_${ev?.externalId || ""}`);
    if (!eventKey) return;
    const enrichment = getExternalEventEnrichment(eventKey);
    const linked = meetingLinkIdsForType(enrichment, targetType, "google");
    if (!linked.includes(targetId)) return;
    push(normalizeMeetingForLinkedRender({ ...ev, source: "google", eventKey, confidentiality: enrichment.confidentiality }));
  });

  return out.slice().sort(compareAgendaEvents);
}

function linkedMeetingSourceBadge(source) {
  return source === "google" ? `<span class="badge orange">Google</span>` : `<span class="badge green">DEOS</span>`;
}

function openLinkedMeetingFromObject(originType, originId, source, meetingId) {
  meetingOriginContext = { type: String(originType || ""), id: String(originId || "") };
  if (source === "google") {
    openExternalEventModal(meetingId);
    return;
  }
  editAgenda(meetingId);
}

function restoreMeetingOriginContext() {
  if (!meetingOriginContext) return false;
  const ctx = meetingOriginContext;
  meetingOriginContext = null;
  if (ctx.type === "graph") return returnToGraph(), true;
  if (ctx.type === "folder") return openFolder(ctx.id), true;
  if (ctx.type === "project") return openProject(ctx.id), true;
  if (ctx.type === "action") return openAction(ctx.id), true;
  if (ctx.type === "decision") return openDecision(ctx.id), true;
  if (ctx.type === "manager") return openManager(ctx.id), true;
  if (ctx.type === "document") return editDocument(ctx.id), true;
  return false;
}

function linkedMeetingItem(meeting, originType, originId) {
  const timeLabel = meeting.allDay
    ? "Journée entière"
    : (meeting.startTime ? `${esc(meeting.startTime)}${meeting.endTime ? " - " + esc(meeting.endTime) : ""}` : "Heure à confirmer");
  return `<div class="item clickable" onclick="openLinkedMeetingFromObject('${esc(originType)}','${esc(originId)}','${esc(meeting.source)}','${esc(meeting.sourceMeetingId)}')"><strong>${esc(meeting.date || "Sans date")} · ${timeLabel}</strong><span class="muted">${esc(meeting.title)}</span><span class="meta">${linkedMeetingSourceBadge(meeting.source)} ${meetingConfidentialityBadge(meeting.confidentiality)}${meeting.location ? " · " + esc(meeting.location) : ""}</span></div>`;
}

function renderLinkedMeetingsSection(type, objectId) {
  const meetings = getMeetingsLinkedToObject(type, objectId);
  if (!meetings.length) return `<div class="empty">Aucun rendez-vous lié.</div>`;
  return meetings.map(m => linkedMeetingItem(m, type, objectId)).join("");
}

function parseEntityIdFromCall(source, fnName) {
  const match = String(source || "").match(new RegExp(`${fnName}\\('([^']+)'\\)`));
  return match ? String(match[1]) : "";
}

function injectA5SummaryButtons() {
  const actions = document.querySelector(".manager-hero .row-actions");
  if (!actions) return;
  const buttons = [...actions.querySelectorAll("button")];
  if (!buttons.length) return;
  if (!actions.querySelector("button[data-a5-summary='folder']")) {
    const folderBtn = buttons.find(btn => String(btn.getAttribute("onclick") || "").includes("editFolder('"));
    const folderId = parseEntityIdFromCall(folderBtn?.getAttribute("onclick"), "editFolder");
    if (folderBtn && folderId) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "secondary";
      node.setAttribute("data-a5-summary", "folder");
      node.setAttribute("onclick", `openA5SummaryPreview('folder','${esc(folderId)}')`);
      node.textContent = "🧾 Synthèse A5";
      folderBtn.insertAdjacentElement("afterend", node);
    }
  }
  if (!actions.querySelector("button[data-a5-summary='project']")) {
    const projectBtn = buttons.find(btn => String(btn.getAttribute("onclick") || "").includes("editProject('"));
    const projectId = parseEntityIdFromCall(projectBtn?.getAttribute("onclick"), "editProject");
    if (projectBtn && projectId) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "secondary";
      node.setAttribute("data-a5-summary", "project");
      node.setAttribute("onclick", `openA5SummaryPreview('project','${esc(projectId)}')`);
      node.textContent = "🧾 Synthèse A5";
      projectBtn.insertAdjacentElement("afterend", node);
    }
  }
  if (!actions.querySelector("button[data-a5-summary='action']")) {
    const actionBtn = buttons.find(btn => String(btn.getAttribute("onclick") || "").includes("editAction('"));
    const actionId = parseEntityIdFromCall(actionBtn?.getAttribute("onclick"), "editAction");
    if (actionBtn && actionId) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "secondary";
      node.setAttribute("data-a5-summary", "action");
      node.setAttribute("onclick", `openA5SummaryPreview('action','${esc(actionId)}')`);
      node.textContent = "🧾 Synthèse A5";
      actionBtn.insertAdjacentElement("afterend", node);
    }
  }
  if (!actions.querySelector("button[data-a5-summary='decision']")) {
    const decisionBtn = buttons.find(btn => String(btn.getAttribute("onclick") || "").includes("editDecision('"));
    const decisionId = parseEntityIdFromCall(decisionBtn?.getAttribute("onclick"), "editDecision");
    if (decisionBtn && decisionId) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "secondary";
      node.setAttribute("data-a5-summary", "decision");
      node.setAttribute("onclick", `openA5SummaryPreview('decision','${esc(decisionId)}')`);
      node.textContent = "🧾 Synthèse A5";
      decisionBtn.insertAdjacentElement("afterend", node);
    }
  }
}

function ensureA5PrintHooks() {
  if (a5PrintCleanupBound) return;
  window.addEventListener("afterprint", cleanupA5PrintClasses);
  a5PrintCleanupBound = true;
}

function cleanupA5PrintClasses() {
  document.body.classList.remove("a5-print-active", "a5-print-portrait", "a5-print-landscape");
}

function a5SafeText(value, max = 140) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trim()}…` : text;
}

function a5LevelLabel(level) {
  return level === "red" ? "Critique" : level === "orange" ? "Important" : level === "green" ? "Normal" : (level || "A suivre");
}

function a5MeetingTime(meeting) {
  if (!meeting) return "Heure a confirmer";
  if (meeting.allDay) return "Journee entiere";
  const start = String(meeting.startTime || "").trim();
  const end = String(meeting.endTime || "").trim();
  if (!start) return "Heure a confirmer";
  return end ? `${start} - ${end}` : start;
}

function a5Date(value) {
  const d = parseDateValue(value);
  if (!d) return "";
  return d.toLocaleDateString("fr-FR");
}

function a5DateTimeNow() {
  return new Date().toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function a5IsUpcoming(value) {
  const days = daysUntil(value);
  return days !== null && days >= 0;
}

function a5ActionSort(a, b) {
  const ad = daysUntil(a.due);
  const bd = daysUntil(b.due);
  const aOver = ad !== null && ad < 0 ? 0 : 1;
  const bOver = bd !== null && bd < 0 ? 0 : 1;
  if (aOver !== bOver) return aOver - bOver;
  const byDue = dateRank(a.due) - dateRank(b.due);
  if (byDue !== 0) return byDue;
  return levelRank(a.level || a.priorityLevel || "orange") - levelRank(b.level || b.priorityLevel || "orange");
}

function a5DecisionSort(a, b) {
  const byLevel = levelRank(a.importance || "orange") - levelRank(b.importance || "orange");
  if (byLevel !== 0) return byLevel;
  return dateRank(a.reviewDate || a.date) - dateRank(b.reviewDate || b.date);
}

function a5DueStateLabel(value) {
  if (!value) return "Sans échéance";
  const days = daysUntil(value);
  if (days === null) return "Échéance invalide";
  if (days < 0) return "En retard";
  if (days === 0) return "Aujourd'hui";
  return "À venir";
}

function a5UniqueItemsById(items) {
  const map = new Map();
  ensureArray(items).forEach(item => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    if (!map.has(id)) map.set(id, item);
  });
  return [...map.values()];
}

function actionRelationsForA5(action) {
  const actionId = String(action?.id || "");
  const linkedFolderIds = normalizeLinkedIdArray(ensureArray(action.linkedFolders));
  const linkedProjectIds = normalizeLinkedIdArray(ensureArray(action.linkedProjects));
  const linkedDecisionIds = normalizeLinkedIdArray(ensureArray(action.linkedDecisions));
  const linkedManagerIds = normalizeLinkedManagerIds(ensureArray(action.linkedManagers).length ? action.linkedManagers : ensureArray(action.linkedManagerIds));

  const folders = state.folders.filter(folder => linkedFolderIds.some(id => sameId(id, folder.id)));
  const projects = state.projects.filter(project => linkedProjectIds.some(id => sameId(id, project.id)) || ensureArray(project.linkedActions).some(id => sameId(id, actionId)));
  const decisions = state.decisions.filter(decision => linkedDecisionIds.some(id => sameId(id, decision.id)) || ensureArray(decision.linkedActions).some(id => sameId(id, actionId)));
  const meetings = getMeetingsLinkedToObject("action", actionId);

  const managerMap = new Map();
  linkedManagerIds.forEach(id => {
    const manager = byId("managers", id);
    if (manager) managerMap.set(String(manager.id), manager);
  });
  state.managers.forEach(manager => {
    if (ensureArray(manager.linkedActions).some(id => sameId(id, actionId))) managerMap.set(String(manager.id), manager);
  });
  projects.forEach(project => {
    state.managers.forEach(manager => {
      if (sameId(project.ownerId, manager.id) || ensureArray(project.linkedManagers).some(id => sameId(id, manager.id))) {
        managerMap.set(String(manager.id), manager);
      }
    });
  });
  decisions.forEach(decision => {
    state.managers.forEach(manager => {
      if (ensureArray(decision.linkedManagers).some(id => sameId(id, manager.id))) managerMap.set(String(manager.id), manager);
    });
  });
  folders.forEach(folder => {
    state.managers.forEach(manager => {
      if (ensureArray(folder.linkedManagers).some(id => sameId(id, manager.id)) || sameId(folder.ownerId, manager.id)) {
        managerMap.set(String(manager.id), manager);
      }
    });
  });

  return {
    folders: a5UniqueItemsById(folders),
    projects: a5UniqueItemsById(projects),
    decisions: a5UniqueItemsById(decisions),
    meetings,
    managers: [...managerMap.values()]
  };
}

function decisionRelationsForA5(decision) {
  const decisionId = String(decision?.id || "");
  const linkedFolderIds = normalizeLinkedIdArray(ensureArray(decision.linkedFolders));
  const linkedProjectIds = normalizeLinkedIdArray(ensureArray(decision.linkedProjects));
  const linkedActionIds = normalizeLinkedIdArray(ensureArray(decision.linkedActions));
  const linkedManagerIds = normalizeLinkedManagerIds(ensureArray(decision.linkedManagers).length ? decision.linkedManagers : ensureArray(decision.linkedManagerIds));

  const folders = state.folders.filter(folder => linkedFolderIds.some(id => sameId(id, folder.id)));
  const projects = state.projects.filter(project => linkedProjectIds.some(id => sameId(id, project.id)) || ensureArray(project.linkedDecisions).some(id => sameId(id, decisionId)));
  const actions = state.actions.filter(action => linkedActionIds.some(id => sameId(id, action.id)) || ensureArray(action.linkedDecisions).some(id => sameId(id, decisionId)));
  const meetings = getMeetingsLinkedToObject("decision", decisionId);

  const managerMap = new Map();
  linkedManagerIds.forEach(id => {
    const manager = byId("managers", id);
    if (manager) managerMap.set(String(manager.id), manager);
  });
  state.managers.forEach(manager => {
    if (ensureArray(manager.linkedDecisions).some(id => sameId(id, decisionId))) managerMap.set(String(manager.id), manager);
  });
  projects.forEach(project => {
    state.managers.forEach(manager => {
      if (sameId(project.ownerId, manager.id) || ensureArray(project.linkedManagers).some(id => sameId(id, manager.id))) {
        managerMap.set(String(manager.id), manager);
      }
    });
  });
  folders.forEach(folder => {
    state.managers.forEach(manager => {
      if (ensureArray(folder.linkedManagers).some(id => sameId(id, manager.id)) || sameId(folder.ownerId, manager.id)) {
        managerMap.set(String(manager.id), manager);
      }
    });
  });

  return {
    folders: a5UniqueItemsById(folders),
    projects: a5UniqueItemsById(projects),
    actions: a5UniqueItemsById(actions),
    meetings,
    managers: [...managerMap.values()]
  };
}

function a5MeetingDisplay(meeting) {
  const confidentiality = normalizeMeetingConfidentiality(meeting.confidentiality || "normal");
  const restricted = confidentiality === "restricted" || confidentiality === "confidential";
  const label = restricted ? "Rendez-vous restreint ou confidentiel" : (meeting.title || "Rendez-vous");
  return {
    label,
    date: a5Date(meeting.date) || String(meeting.date || ""),
    time: a5MeetingTime(meeting),
    confidentiality,
    restricted
  };
}

function a5Section(title, body) {
  if (!body) return "";
  return `<section class="a5-section"><h3>${esc(title)}</h3>${body}</section>`;
}

function a5List(items, renderItem, emptyText = "") {
  const rows = ensureArray(items).map(renderItem).filter(Boolean);
  if (!rows.length) return emptyText ? `<p class="muted">${esc(emptyText)}</p>` : "";
  return `<div class="a5-list">${rows.join("")}</div>`;
}

function projectRelationsForA5(project) {
  const projectId = String(project?.id || "");
  const linkedManagers = new Map();
  const linkedManagerIds = normalizeLinkedManagerIds(ensureArray(project.linkedManagers).length ? project.linkedManagers : ensureArray(project.linkedManagerIds));
  linkedManagerIds.forEach(id => {
    const manager = byId("managers", id);
    if (manager) linkedManagers.set(String(manager.id), manager);
  });
  const owner = state.managers.find(manager => sameId(project.ownerId, manager.id)
    || (project.owner && String(manager.name || "").trim().toLowerCase() === String(project.owner || "").trim().toLowerCase()));
  if (owner) linkedManagers.set(String(owner.id), owner);
  const actions = state.actions.filter(a => ensureArray(project.linkedActions).some(id => sameId(id, a.id)) || ensureArray(a.linkedProjects).some(id => sameId(id, projectId)));
  const decisions = state.decisions.filter(d => ensureArray(project.linkedDecisions).some(id => sameId(id, d.id)) || ensureArray(d.linkedProjects).some(id => sameId(id, projectId)));
  const documents = state.documents.filter(d => ensureArray(project.linkedDocuments).some(id => sameId(id, d.id)) || ensureArray(d.linkedProjects).some(id => sameId(id, projectId)));
  const journal = state.journal.filter(j => ensureArray(j.linkedProjects).some(id => sameId(id, projectId)));
  const meetings = getMeetingsLinkedToObject("project", projectId);
  return {
    managers: [...linkedManagers.values()],
    actions,
    decisions,
    documents,
    journal,
    meetings,
    milestones: ensureArray(project.milestones)
  };
}

function buildFolderA5Summary(folderId) {
  const folder = byId("folders", folderId);
  if (!folder) return null;
  const folderManagerIds = normalizeLinkedManagerIds(ensureArray(folder.linkedManagers).length ? folder.linkedManagers : ensureArray(folder.linkedManagerIds));
  const linkedManagers = new Map();
  folderManagerIds.forEach(id => {
    const manager = byId("managers", id);
    if (manager) linkedManagers.set(String(manager.id), manager);
  });
  const ownerManager = state.managers.find(manager => sameId(folder.ownerId, manager.id)
    || (folder.owner && String(manager.name || "").trim().toLowerCase() === String(folder.owner || "").trim().toLowerCase()));
  if (ownerManager) linkedManagers.set(String(ownerManager.id), ownerManager);
  const managers = [...linkedManagers.values()];
  const managerNames = normalizeLinkedIdArray(managers.map(manager => String(manager.name || "").trim()).filter(Boolean));
  const matchesFolder = (item) => ensureArray(item?.linkedFolders).some(id => sameId(id, folder.id));
  const projects = state.projects.filter(project => matchesFolder(project));
  const projectIds = projects.map(project => String(project.id));
  const managerIds = managers.map(manager => String(manager.id));
  const actionsFromLinks = state.actions.filter(action => matchesFolder(action)
    || projectIds.some(id => ensureArray(action.linkedProjects).some(link => sameId(link, id)))
    || projects.some(project => ensureArray(project.linkedActions).some(link => sameId(link, action.id))));
  const priorities = state.priorities.filter(priority => matchesFolder(priority));
  const decisions = state.decisions.filter(decision => matchesFolder(decision)
    || projectIds.some(id => ensureArray(decision.linkedProjects).some(link => sameId(link, id)))
    || actionsFromLinks.some(action => ensureArray(decision.linkedActions).some(link => sameId(link, action.id))));
  const decisionIds = decisions.map(decision => String(decision.id));
  const journal = state.journal.filter(entry => matchesFolder(entry)
    || projectIds.some(id => ensureArray(entry.linkedProjects).some(link => sameId(link, id)))
    || decisionIds.some(id => ensureArray(entry.linkedDecisions).some(link => sameId(link, id))));
  const documents = state.documents.filter(doc => matchesFolder(doc)
    || projects.some(project => ensureArray(project.linkedDocuments).some(link => sameId(link, doc.id)))
    || decisions.some(decision => ensureArray(decision.linkedDocuments).some(link => sameId(link, doc.id))));
  const agenda = state.agenda.filter(meeting => matchesFolder(meeting)
    || projectIds.some(id => ensureArray(meeting.linkedProjects).some(link => sameId(link, id)))
    || managerIds.some(id => ensureArray(meeting.linkedManagers).some(link => sameId(link, id))));
  const rel = { projects, managers, actions: actionsFromLinks, priorities, decisions, journal, documents, agenda };
  const actionsAll = rel.actions.slice();
  const openActions = actionsAll.filter(a => !a.done);
  const actionPool = (openActions.length ? openActions : actionsAll).slice().sort(a5ActionSort);
  const sortedDecisions = rel.decisions.slice().sort(a5DecisionSort);
  const sortedProjects = rel.projects.slice().sort((a, b) => {
    const ar = (a.status === "red" || a.priorityLevel === "red") ? 0 : 1;
    const br = (b.status === "red" || b.priorityLevel === "red") ? 0 : 1;
    if (ar !== br) return ar - br;
    return dateRank(a.deadline) - dateRank(b.deadline);
  });
  const meetings = getMeetingsLinkedToObject("folder", folder.id).map(a5MeetingDisplay);
  const upcomingMeetings = meetings.filter(m => a5IsUpcoming(m.date));
  const overdueActions = openActions.filter(a => {
    const d = daysUntil(a.due);
    return d !== null && d < 0;
  });
  const risks = [];
  sortedProjects.filter(p => p.risks || p.status === "red" || p.priorityLevel === "red").slice(0, 3).forEach(p => {
    risks.push(`Projet ${p.name}: ${a5SafeText(p.risks || "Statut critique", 90)}`);
  });
  overdueActions.filter(a => levelRank(a.level || a.priorityLevel || "orange") <= 1).slice(0, 2).forEach(a => {
    risks.push(`Action en retard: ${a5SafeText(a.title, 90)}`);
  });
  sortedDecisions.filter(d => d.status === "review" || d.status === "applying").slice(0, 2).forEach(d => {
    risks.push(`Decision a suivre: ${a5SafeText(d.title, 90)}`);
  });
  rel.priorities.filter(p => !p.done && p.level === "red").slice(0, 1).forEach(p => {
    risks.push(`Priorite critique: ${a5SafeText(p.title, 90)}`);
  });
  const nextSteps = [];
  const nextDue = [...actionsAll.map(a => a.due), ...priorities.map(p => p.due), ...sortedProjects.map(p => p.deadline), ...sortedDecisions.map(d => d.reviewDate), ...agenda.map(a => a.date), folder.deadline]
    .filter(Boolean)
    .sort((a, b) => dateRank(a) - dateRank(b))[0] || "";
  if (nextDue) nextSteps.push(`Prochaine echeance: ${a5Date(nextDue) || nextDue}`);
  const nextMeeting = upcomingMeetings[0];
  if (nextMeeting) nextSteps.push(`Prochain rendez-vous: ${nextMeeting.date} ${nextMeeting.time}`);
  const nextAction = actionPool[0];
  if (nextAction) nextSteps.push(`Prochaine action importante: ${a5SafeText(nextAction.title, 90)}`);
  const nextDecision = sortedDecisions.find(d => d.status === "review" || d.status === "applying");
  if (nextDecision) nextSteps.push(`Decision attendue: ${a5SafeText(nextDecision.title, 90)}`);

  return {
    type: "folder",
    title: folder.name,
    metadata: {
      category: folder.category || "",
      status: folderStatusLabel(folder.status),
      priority: folderPriorityLabel(folder.priorityLevel),
      owner: folder.owner || "",
      deadline: folder.deadline || "",
      generatedAt: a5DateTimeNow(),
      version: DEOS_VERSION
    },
    context: {
      description: folder.description || "",
      context: folder.context || "",
      objectives: folder.objectives || "",
      expectedResults: folder.expectedResults || ""
    },
    metrics: {
      linkedProjects: rel.projects.length,
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      linkedDecisions: rel.decisions.length,
      upcomingMeetings: upcomingMeetings.length,
      linkedManagers: managerNames.length
    },
    managerNames,
    projects: sortedProjects.slice(0, 4).map(p => ({
      name: p.name,
      status: folderStatusLabel(p.status),
      progress: Number(p.progress || 0),
      deadline: p.deadline || "",
      risk: a5SafeText(p.risks || "", 90)
    })),
    actions: actionPool.slice(0, 5).map(a => ({
      title: a.title,
      owner: a.owner || "",
      due: a.due || "",
      overdue: (() => {
        const d = daysUntil(a.due);
        return d !== null && d < 0 ? `${Math.abs(d)} j` : "";
      })(),
      level: a5LevelLabel(a.level || a.priorityLevel || "orange"),
      done: Boolean(a.done)
    })),
    decisions: sortedDecisions.slice(0, 3).map(d => ({
      title: d.title,
      status: decisionStatusLabel(d.status),
      date: d.date || "",
      owner: d.owner || "",
      importance: a5LevelLabel(d.importance || "orange")
    })),
    risks: normalizeLinkedIdArray(risks).slice(0, 5),
    meetings: meetings.slice(0, 4),
    nextSteps: nextSteps.slice(0, 5)
  };
}

function buildProjectA5Summary(projectId) {
  const project = byId("projects", projectId);
  if (!project) return null;
  const rel = projectRelationsForA5(project);
  const managerNames = normalizeLinkedIdArray(rel.managers.map(manager => String(manager.name || "").trim()).filter(Boolean));
  const openActions = rel.actions.filter(a => !a.done).sort(a5ActionSort);
  const actionPool = (openActions.length ? openActions : rel.actions.slice().sort(a5ActionSort));
  const decisions = rel.decisions.slice().sort(a5DecisionSort);
  const milestones = rel.milestones.slice().sort((a, b) => dateRank(a.date) - dateRank(b.date));
  const meetings = rel.meetings.map(a5MeetingDisplay);
  const upcomingMeetings = meetings.filter(m => a5IsUpcoming(m.date));
  const overdueActions = openActions.filter(a => {
    const d = daysUntil(a.due);
    return d !== null && d < 0;
  });
  const risks = [];
  if (project.risks) risks.push(a5SafeText(project.risks, 120));
  overdueActions.slice(0, 2).forEach(a => risks.push(`Action en retard: ${a5SafeText(a.title, 90)}`));
  milestones.filter(m => {
    const d = daysUntil(m.date);
    return d !== null && d < 0;
  }).slice(0, 2).forEach(m => risks.push(`Jalon en retard: ${a5SafeText(m.title, 90)}`));
  decisions.filter(d => d.status === "review" || d.status === "applying").slice(0, 2).forEach(d => risks.push(`Decision en attente: ${a5SafeText(d.title, 90)}`));
  if (!risks.length && (project.status === "red" || project.priorityLevel === "red")) risks.push("Projet en statut critique.");

  const nextSteps = [];
  if (project.deadline) nextSteps.push(`Prochaine echeance: ${a5Date(project.deadline) || project.deadline}`);
  const nextMilestone = milestones.find(m => a5IsUpcoming(m.date));
  if (nextMilestone) nextSteps.push(`Prochain jalon: ${a5SafeText(nextMilestone.title, 90)} (${a5Date(nextMilestone.date) || nextMilestone.date})`);
  const nextAction = actionPool[0];
  if (nextAction) nextSteps.push(`Prochaine action: ${a5SafeText(nextAction.title, 90)}`);
  const nextMeeting = upcomingMeetings[0];
  if (nextMeeting) nextSteps.push(`Prochain rendez-vous: ${nextMeeting.date} ${nextMeeting.time}`);
  const nextDecision = decisions.find(d => d.status === "review" || d.status === "applying");
  if (nextDecision) nextSteps.push(`Decision attendue: ${a5SafeText(nextDecision.title, 90)}`);

  return {
    type: "project",
    title: project.name,
    metadata: {
      status: folderStatusLabel(project.status),
      progress: Number(project.progress || 0),
      priority: folderPriorityLabel(project.priorityLevel || "orange"),
      owner: projectOwnerName(project) || "",
      deadline: project.deadline || "",
      generatedAt: a5DateTimeNow(),
      version: DEOS_VERSION
    },
    objectiveBlock: {
      description: project.actions || "",
      context: project.context || "",
      objective: project.objective || "",
      expectedResults: project.next || ""
    },
    metrics: {
      progress: Number(project.progress || 0),
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      linkedDecisions: decisions.length,
      milestones: milestones.length,
      upcomingMeetings: upcomingMeetings.length,
      linkedManagers: managerNames.length
    },
    managerNames,
    milestones: milestones.slice(0, 4).map(m => {
      const d = daysUntil(m.date);
      return {
        title: m.title || "Jalon",
        date: m.date || "",
        status: m.status || "A suivre",
        overdue: d !== null && d < 0 ? `${Math.abs(d)} j` : ""
      };
    }),
    actions: actionPool.slice(0, 5).map(a => ({
      title: a.title,
      owner: a.owner || "",
      due: a.due || "",
      level: a5LevelLabel(a.level || a.priorityLevel || "orange"),
      overdue: (() => {
        const d = daysUntil(a.due);
        return d !== null && d < 0 ? `${Math.abs(d)} j` : "";
      })()
    })),
    decisions: decisions.slice(0, 4).map(d => ({
      title: d.title,
      status: decisionStatusLabel(d.status),
      date: d.date || "",
      importance: a5LevelLabel(d.importance || "orange"),
      owner: d.owner || ""
    })),
    risks: normalizeLinkedIdArray(risks).slice(0, 5),
    meetings: meetings.slice(0, 4),
    nextSteps: nextSteps.slice(0, 5)
  };
}

function buildActionA5Summary(actionId) {
  const action = byId("actions", actionId);
  if (!action) return null;
  const rel = actionRelationsForA5(action);
  const managerNames = normalizeLinkedIdArray(rel.managers.map(manager => String(manager.name || "").trim()).filter(Boolean));
  const meetings = rel.meetings.map(a5MeetingDisplay);

  const description = a5SafeText(action.description || action.objective || action.link || "", 260);
  const expected = a5SafeText(action.expectedResults || action.result || action.next || "", 220);
  const notes = a5SafeText(action.notes || action.note || "", 220);
  const risks = normalizeLinkedIdArray([
    a5SafeText(action.risks || action.blockers || "", 140),
    ...((!action.done && daysUntil(action.due) !== null && daysUntil(action.due) < 0) ? ["Action en retard"] : [])
  ].filter(Boolean));
  const nextSteps = normalizeLinkedIdArray([
    a5SafeText(action.nextStep || "", 140),
    action.due ? `Échéance : ${a5Date(action.due) || action.due}` : ""
  ].filter(Boolean));

  return {
    type: "action",
    title: action.title || "Action",
    metadata: {
      status: action.done ? "Terminée" : "En cours",
      priority: a5LevelLabel(action.level || action.priorityLevel || "orange"),
      deadline: action.due || "",
      progress: Number.isFinite(Number(action.progress)) ? Number(action.progress) : null,
      generatedAt: a5DateTimeNow(),
      version: DEOS_VERSION
    },
    body: {
      description,
      expectedResults: expected,
      owner: String(action.owner || "").trim(),
      notes
    },
    metrics: {
      linkedFolders: rel.folders.length,
      linkedProjects: rel.projects.length,
      linkedDecisions: rel.decisions.length,
      linkedMeetings: meetings.length,
      linkedManagers: managerNames.length,
      dueState: a5DueStateLabel(action.due)
    },
    managerNames,
    folders: rel.folders.map(folder => ({
      name: folder.name || "Dossier",
      category: folder.category || "",
      status: folderStatusLabel(folder.status)
    })),
    projects: rel.projects.map(project => ({
      name: project.name || "Projet",
      status: folderStatusLabel(project.status),
      progress: Number(project.progress || 0)
    })),
    decisions: rel.decisions.map(decision => ({
      title: decision.title || "Décision",
      status: decisionStatusLabel(decision.status),
      date: decision.date || ""
    })),
    meetings: meetings.slice(0, 5),
    risks: risks.slice(0, 5),
    nextSteps: nextSteps.slice(0, 5)
  };
}

function buildDecisionA5Summary(decisionId) {
  const decision = byId("decisions", decisionId);
  if (!decision) return null;
  const rel = decisionRelationsForA5(decision);
  const managerNames = normalizeLinkedIdArray(rel.managers.map(manager => String(manager.name || "").trim()).filter(Boolean));
  const meetings = rel.meetings.map(a5MeetingDisplay);
  const notes = ensureArray(decision.directorNotes).map(note => a5SafeText(note.content || "", 140)).filter(Boolean);
  const followUp = normalizeLinkedIdArray([
    decision.reviewDate ? `Réexamen : ${a5Date(decision.reviewDate) || decision.reviewDate}` : "",
    a5SafeText(decision.nextStep || "", 140)
  ].filter(Boolean));

  return {
    type: "decision",
    title: decision.title || "Décision",
    metadata: {
      status: decisionStatusLabel(decision.status),
      priority: a5LevelLabel(decision.importance || "orange"),
      decisionDate: decision.date || "",
      deadline: decision.reviewDate || decision.effectDate || decision.effectiveDate || decision.due || "",
      generatedAt: a5DateTimeNow(),
      version: DEOS_VERSION
    },
    body: {
      decisionText: a5SafeText(decision.decision || decision.nextStep || "", 260),
      context: a5SafeText(decision.context || "", 220),
      rationale: a5SafeText(decision.rationale || decision.problem || "", 220),
      impacts: a5SafeText(decision.impacts || decision.impact || "", 220),
      owner: String(decision.owner || "").trim(),
      risks: a5SafeText(decision.risks || "", 180)
    },
    metrics: {
      linkedFolders: rel.folders.length,
      linkedProjects: rel.projects.length,
      linkedActions: rel.actions.length,
      linkedMeetings: meetings.length,
      linkedManagers: managerNames.length,
      implementationState: decisionStatusLabel(decision.status)
    },
    managerNames,
    folders: rel.folders.map(folder => ({
      name: folder.name || "Dossier",
      category: folder.category || "",
      status: folderStatusLabel(folder.status)
    })),
    projects: rel.projects.map(project => ({
      name: project.name || "Projet",
      status: folderStatusLabel(project.status),
      progress: Number(project.progress || 0)
    })),
    actions: rel.actions.map(action => ({
      title: action.title || "Action",
      status: action.done ? "Terminée" : "En cours",
      due: action.due || ""
    })),
    meetings: meetings.slice(0, 5),
    followUp: followUp.slice(0, 5),
    notes: notes.slice(0, 6)
  };
}

function openA5SummaryPreview(type, sourceId) {
  const normalizedType = String(type || "").trim().toLowerCase();
  const id = String(sourceId || "").trim();
  if (!normalizedType || !id) return;
  const builders = {
    folder: buildFolderA5Summary,
    project: buildProjectA5Summary,
    action: buildActionA5Summary,
    decision: buildDecisionA5Summary
  };
  const builder = builders[normalizedType];
  const model = builder ? builder(id) : null;
  if (!model) {
    alert("Impossible de générer la synthèse : objet introuvable.");
    return;
  }
  ensureA5PrintHooks();
  a5SummaryDialog = {
    open: true,
    type: normalizedType,
    sourceId: id,
    orientation: "portrait",
    model,
    error: ""
  };
  renderA5SummaryOverlay();
}

function closeA5SummaryPreview() {
  a5SummaryDialog.open = false;
  a5SummaryDialog.error = "";
  cleanupA5PrintClasses();
  renderA5SummaryOverlay();
}

function setA5SummaryOrientation(orientation) {
  const value = orientation === "landscape" ? "landscape" : "portrait";
  a5SummaryDialog.orientation = value;
  renderA5SummaryOverlay();
}

function a5PrintStyles(orientation) {
  const pageSize = orientation === "landscape" ? "A5 landscape" : "A5 portrait";
  const pageWidth = orientation === "landscape" ? "210mm" : "148mm";
  const sheetWidth = orientation === "landscape" ? "210mm" : "148mm";
  return `
    html,body{margin:0!important;padding:0!important;height:auto!important;width:${pageWidth}!important;min-width:${pageWidth}!important;max-width:${pageWidth}!important;background:#fff!important;color:#0f172a!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    @page{size:${pageSize};margin:0}
    .a5-print-root{display:flex!important;justify-content:center!important;align-items:stretch!important;margin:0!important;padding:0!important;position:static!important;transform:none!important;width:${pageWidth}!important;min-width:${pageWidth}!important;max-width:${pageWidth}!important;min-height:0!important;break-before:auto!important;page-break-before:auto!important;box-sizing:border-box!important}
    .a5-summary-sheet{width:${sheetWidth}!important;min-width:${sheetWidth}!important;max-width:${sheetWidth}!important;margin:0!important;break-before:auto!important;page-break-before:auto!important;min-height:0!important;box-sizing:border-box!important}
    .a5-summary-meta-badges{display:flex!important;flex-wrap:wrap!important;gap:6px!important;align-items:center!important}
    .a5-summary-meta-badge{display:inline-flex!important;white-space:nowrap!important}
    .a5-summary-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
    .a5-summary-metrics.is-landscape{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .a5-content.two-columns{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;align-items:start!important}
    .a5-content.one-column{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
    .a5-section,.a5-item{break-inside:avoid;page-break-inside:avoid}
    @media (max-width:900px){
      .a5-summary-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .a5-content.two-columns{grid-template-columns:1fr 1fr!important}
      .a5-summary-meta-badges{display:flex!important}
    }
    @media (max-width:640px){
      .a5-summary-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .a5-content.two-columns{grid-template-columns:1fr 1fr!important}
      .a5-summary-meta-badge{display:inline-flex!important}
    }
  `;
}

function collectA5PrintHeadMarkup(orientation) {
  const links = Array.from(document.querySelectorAll("link[rel='stylesheet']"))
    .map(link => {
      const href = link.getAttribute("href");
      if (!href) return "";
      const media = link.getAttribute("media");
      return `<link rel="stylesheet" href="${esc(href)}"${media ? ` media="${esc(media)}"` : ""}>`;
    })
    .filter(Boolean)
    .join("\n");
  const styleBlocks = Array.from(document.querySelectorAll("style"))
    .map(style => `<style>${style.textContent || ""}</style>`)
    .join("\n");
  let inlineCss = "";
  Array.from(document.styleSheets || []).forEach(sheet => {
    try {
      inlineCss += Array.from(sheet.cssRules || []).map(rule => rule.cssText).join("\n");
      inlineCss += "\n";
    } catch {}
  });
  const extracted = inlineCss.trim() ? `<style>${inlineCss}</style>` : "";
  return `${links}\n${styleBlocks}\n${extracted}\n<style>${a5PrintStyles(orientation)}</style>`;
}

function buildA5PrintWindowHtml(orientation) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DEOS Synthèse A5</title>
  ${collectA5PrintHeadMarkup(orientation)}
</head>
<body></body>
</html>`;
}

function bindA5IframeCleanup(frame, iframeWin, fallbackMs = 1400) {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    try {
      frame.remove();
    } catch {}
  };
  try {
    iframeWin.addEventListener("afterprint", cleanup, { once: true });
  } catch {}
  try {
    iframeWin.onafterprint = cleanup;
  } catch {}
  setTimeout(cleanup, fallbackMs);
}

function printA5ViaIframe(previewNode, orientation) {
  if (!previewNode) return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(buildA5PrintWindowHtml(orientation));
  doc.close();
  const clonedNode = doc.importNode(previewNode, true);
  doc.body.appendChild(clonedNode);

  const waitForStyles = (done) => {
    const links = Array.from(doc.querySelectorAll("link[rel='stylesheet']"));
    if (!links.length) {
      setTimeout(done, 60);
      return;
    }
    let pending = links.length;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      done();
    };
    const mark = () => {
      pending -= 1;
      if (pending <= 0) finish();
    };
    links.forEach(link => {
      if (link.sheet) {
        mark();
        return;
      }
      link.addEventListener("load", mark, { once: true });
      link.addEventListener("error", mark, { once: true });
    });
    setTimeout(finish, 500);
  };

  let printed = false;
  const launch = () => {
    if (printed) return;
    printed = true;
    const iframeWin = frame.contentWindow;
    if (!iframeWin) {
      frame.remove();
      return;
    }
    bindA5IframeCleanup(frame, iframeWin, 1400);
    try {
      iframeWin.focus();
      iframeWin.print();
    } catch {}
  };
  if (doc.readyState === "complete") {
    waitForStyles(launch);
  } else {
    frame.addEventListener("load", () => waitForStyles(launch), { once: true });
  }
}

function printA5Summary() {
  if (!a5SummaryDialog.open) return;
  const previewRoot = document.querySelector(".a5-summary-modal .a5-print-root");
  if (!previewRoot) return;
  const orientation = a5SummaryDialog.orientation === "landscape" ? "landscape" : "portrait";
  const clone = previewRoot.cloneNode(true);
  printA5ViaIframe(clone, orientation);
}

function a5SummaryBadge(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<span class="a5-summary-meta-badge"><strong class="a5-summary-meta-badge-label">${esc(label)}</strong><span class="a5-summary-meta-badge-sep"> · </span><span class="a5-summary-meta-badge-value">${esc(String(value))}</span></span>`;
}

function a5SummaryMetrics(model) {
  const metrics = model.metrics || {};
  const defs = model.type === "folder"
    ? [
      { label: "Projets liés", value: metrics.linkedProjects || 0 },
      { label: "Actions ouvertes", value: metrics.openActions || 0 },
      { label: "Actions en retard", value: metrics.overdueActions || 0 },
      { label: "Décisions liées", value: metrics.linkedDecisions || 0 },
      { label: "Rendez-vous à venir", value: metrics.upcomingMeetings || 0 },
      { label: "Managers liés", value: metrics.linkedManagers || 0 }
    ]
    : model.type === "project"
      ? [
      { label: "Actions ouvertes", value: metrics.openActions || 0 },
      { label: "Actions en retard", value: metrics.overdueActions || 0 },
      { label: "Décisions liées", value: metrics.linkedDecisions || 0 },
      { label: "Jalons", value: metrics.milestones || 0 },
      { label: "Rendez-vous à venir", value: metrics.upcomingMeetings || 0 },
      { label: "Managers liés", value: metrics.linkedManagers || 0 }
      ]
      : model.type === "action"
        ? [
          { label: "Dossiers liés", value: metrics.linkedFolders || 0 },
          { label: "Projets liés", value: metrics.linkedProjects || 0 },
          { label: "Décisions liées", value: metrics.linkedDecisions || 0 },
          { label: "Rendez-vous liés", value: metrics.linkedMeetings || 0 },
          { label: "Managers associés", value: metrics.linkedManagers || 0 },
          { label: "Échéance", value: metrics.dueState || "Sans échéance" }
        ]
        : [
          { label: "Dossiers liés", value: metrics.linkedFolders || 0 },
          { label: "Projets liés", value: metrics.linkedProjects || 0 },
          { label: "Actions liées", value: metrics.linkedActions || 0 },
          { label: "Rendez-vous liés", value: metrics.linkedMeetings || 0 },
          { label: "Managers associés", value: metrics.linkedManagers || 0 },
          { label: "Mise en œuvre", value: metrics.implementationState || "À suivre" }
        ];
  return defs.map(d => `<article class="a5-summary-metric"><strong class="a5-summary-metric-value">${esc(String(d.value))}</strong><span class="a5-summary-metric-label"> ${esc(d.label)}</span></article>`).join("");
}

function renderA5SummaryHeader(model, orientation) {
  const m = model.metadata || {};
  const badges = model.type === "folder"
    ? [
      a5SummaryBadge("Catégorie", m.category),
      a5SummaryBadge("Statut", m.status),
      a5SummaryBadge("Priorité", m.priority),
      a5SummaryBadge("Échéance", m.deadline ? (a5Date(m.deadline) || m.deadline) : "")
    ]
    : model.type === "project"
      ? [
      a5SummaryBadge("Statut", m.status),
      a5SummaryBadge("Priorité", m.priority),
      a5SummaryBadge("Avancement", `${Number(m.progress || 0)} %`),
      a5SummaryBadge("Échéance", m.deadline ? (a5Date(m.deadline) || m.deadline) : "")
      ]
      : model.type === "action"
        ? [
          a5SummaryBadge("Statut", m.status),
          a5SummaryBadge("Priorité", m.priority),
          a5SummaryBadge("Échéance", m.deadline ? (a5Date(m.deadline) || m.deadline) : ""),
          a5SummaryBadge("Avancement", m.progress === null || m.progress === undefined ? "" : `${Number(m.progress || 0)} %`)
        ]
        : [
          a5SummaryBadge("Statut", m.status),
          a5SummaryBadge("Priorité", m.priority),
          a5SummaryBadge("Date de décision", m.decisionDate ? (a5Date(m.decisionDate) || m.decisionDate) : ""),
          a5SummaryBadge("Échéance", m.deadline ? (a5Date(m.deadline) || m.deadline) : "")
        ];
  const badgeHtml = badges.filter(Boolean).join("");
  const generatedAt = m.generatedAt ? `Généré le ${m.generatedAt}` : "";
  return `
    <header class="a5-header a5-summary-head">
      <div class="a5-summary-kicker-row">
        <p class="a5-summary-kicker">${model.type === "folder" ? "DOSSIER" : model.type === "project" ? "PROJET" : model.type === "action" ? "ACTION" : "DÉCISION"}</p>
        <p class="a5-summary-version">DEOS ${esc(DEOS_VERSION)}</p>
      </div>
      <h1 class="a5-summary-title">${esc(model.title || "Synthèse")}</h1>
      <div class="a5-summary-meta-badges">${badgeHtml}</div>
      <div class="a5-summary-metrics ${orientation === "landscape" ? "is-landscape" : "is-portrait"}">${a5SummaryMetrics(model)}</div>
      ${generatedAt ? `<p class="a5-summary-generated-at">${esc(generatedAt)}</p>` : ""}
      <div class="a5-summary-divider"></div>
    </header>
  `;
}

function renderA5SummaryFolder(model) {
  const context = model.context || {};
  const managerNames = ensureArray(model.managerNames).filter(Boolean);
  const contextBody = [
    context.description ? `<p><strong>Description:</strong> ${esc(a5SafeText(context.description, 300))}</p>` : "",
    context.context ? `<p><strong>Contexte:</strong> ${esc(a5SafeText(context.context, 260))}</p>` : "",
    context.objectives ? `<p><strong>Objectifs:</strong> ${esc(a5SafeText(context.objectives, 220))}</p>` : "",
    context.expectedResults ? `<p><strong>Resultats attendus:</strong> ${esc(a5SafeText(context.expectedResults, 220))}</p>` : ""
  ].join("");
  const projectsBody = a5List(model.projects, p => `<article class="a5-item"><strong>${esc(p.name)}</strong><p>${esc(p.status)} · ${esc(String(p.progress))}%${p.deadline ? " · Echeance " + esc(a5Date(p.deadline) || p.deadline) : ""}</p>${p.risk ? `<p class="muted">Risque: ${esc(p.risk)}</p>` : ""}</article>`);
  const actionsBody = a5List(model.actions, a => `<article class="a5-item"><strong>${esc(a5SafeText(a.title, 90))}</strong><p>${esc(a.owner || "Responsable a definir")} · ${esc(a.level)}${a.due ? " · " + esc(a5Date(a.due) || a.due) : ""}${a.overdue ? " · Retard " + esc(a.overdue) : ""}</p></article>`);
  const decisionsBody = a5List(model.decisions, d => `<article class="a5-item"><strong>${esc(a5SafeText(d.title, 90))}</strong><p>${esc(d.status)}${d.date ? " · " + esc(a5Date(d.date) || d.date) : ""}${d.owner ? " · " + esc(d.owner) : ""}</p></article>`);
  const managersBody = a5List(managerNames, name => `<article class="a5-item"><p>${esc(name)}</p></article>`, "Aucun manager associé");
  const risksBody = a5List(model.risks, r => `<article class="a5-item"><p>${esc(r)}</p></article>`);
  const nextBody = a5List(model.nextSteps, n => `<article class="a5-item"><p>${esc(n)}</p></article>`, "Aucune donnée renseignée.");
  const meetingsBody = a5List(model.meetings, m => `<article class="a5-item"><strong>${esc(m.label)}</strong><p>${esc(m.date)} · ${esc(m.time)} ${meetingConfidentialityBadge(m.confidentiality)}</p></article>`);
  return `
    ${a5Section("Contexte", contextBody || `<p class="muted">Aucune donnée renseignée.</p>`) }
    ${a5Section("MANAGERS ASSOCIÉS", managersBody)}
    ${a5Section("Rendez-vous", meetingsBody)}
    ${a5Section("Projets clés", projectsBody)}
    ${a5Section("Actions prioritaires", actionsBody)}
    ${a5Section("Décisions", decisionsBody)}
    ${a5Section("Risques / Points d'attention", risksBody)}
    ${a5Section("Prochaines étapes", nextBody)}
  `;
}

function renderA5SummaryProject(model) {
  const objective = model.objectiveBlock || {};
  const managerNames = ensureArray(model.managerNames).filter(Boolean);
  const objectiveBody = [
    objective.description ? `<p><strong>Description:</strong> ${esc(a5SafeText(objective.description, 260))}</p>` : "",
    objective.context ? `<p><strong>Contexte:</strong> ${esc(a5SafeText(objective.context, 220))}</p>` : "",
    objective.objective ? `<p><strong>Objectif:</strong> ${esc(a5SafeText(objective.objective, 220))}</p>` : "",
    objective.expectedResults ? `<p><strong>Resultats attendus:</strong> ${esc(a5SafeText(objective.expectedResults, 200))}</p>` : ""
  ].join("");
  const milestonesBody = a5List(model.milestones, m => `<article class="a5-item"><strong>${esc(a5SafeText(m.title, 90))}</strong><p>${m.date ? esc(a5Date(m.date) || m.date) : "Sans date"} · ${esc(m.status)}${m.overdue ? " · Retard " + esc(m.overdue) : ""}</p></article>`);
  const actionsBody = a5List(model.actions, a => `<article class="a5-item"><strong>${esc(a5SafeText(a.title, 90))}</strong><p>${esc(a.owner || "Responsable a definir")} · ${esc(a.level)}${a.due ? " · " + esc(a5Date(a.due) || a.due) : ""}${a.overdue ? " · Retard " + esc(a.overdue) : ""}</p></article>`);
  const decisionsBody = a5List(model.decisions, d => `<article class="a5-item"><strong>${esc(a5SafeText(d.title, 90))}</strong><p>${esc(d.status)}${d.date ? " · " + esc(a5Date(d.date) || d.date) : ""} · ${esc(d.importance)}${d.owner ? " · " + esc(d.owner) : ""}</p></article>`);
  const managersBody = a5List(managerNames, name => `<article class="a5-item"><p>${esc(name)}</p></article>`, "Aucun manager associé");
  const risksBody = a5List(model.risks, r => `<article class="a5-item"><p>${esc(r)}</p></article>`);
  const meetingsBody = a5List(model.meetings, m => `<article class="a5-item"><strong>${esc(m.label)}</strong><p>${esc(m.date)} · ${esc(m.time)} ${meetingConfidentialityBadge(m.confidentiality)}</p></article>`);
  const nextBody = a5List(model.nextSteps, n => `<article class="a5-item"><p>${esc(n)}</p></article>`, "Aucune donnée renseignée.");
  return `
    ${a5Section("Objectif", objectiveBody || `<p class="muted">Aucune donnée renseignée.</p>`) }
    ${a5Section("MANAGERS ASSOCIÉS", managersBody)}
    ${a5Section("Jalons", milestonesBody)}
    ${a5Section("Actions prioritaires", actionsBody)}
    ${a5Section("Décisions", decisionsBody)}
    ${a5Section("Rendez-vous", meetingsBody)}
    ${a5Section("Risques et blocages", risksBody)}
    ${a5Section("Prochaines étapes", nextBody)}
  `;
}

function renderA5SummaryAction(model) {
  const body = model.body || {};
  const managerNames = ensureArray(model.managerNames).filter(Boolean);
  const descriptionBody = [
    body.description ? `<p><strong>Description / objectif :</strong> ${esc(body.description)}</p>` : "",
    body.expectedResults ? `<p><strong>Résultat attendu :</strong> ${esc(body.expectedResults)}</p>` : "",
    body.owner ? `<p><strong>Responsable :</strong> ${esc(body.owner)}</p>` : ""
  ].join("");
  const foldersBody = a5List(model.folders, folder => `<article class="a5-item"><strong>${esc(folder.name)}</strong><p>${esc(folder.category || "")} · ${esc(folder.status || "")}</p></article>`, "Aucun dossier lié.");
  const projectsBody = a5List(model.projects, project => `<article class="a5-item"><strong>${esc(project.name)}</strong><p>${esc(project.status)} · ${esc(String(project.progress || 0))}%</p></article>`, "Aucun projet lié.");
  const decisionsBody = a5List(model.decisions, decision => `<article class="a5-item"><strong>${esc(decision.title)}</strong><p>${esc(decision.status)}${decision.date ? " · " + esc(a5Date(decision.date) || decision.date) : ""}</p></article>`, "Aucune décision liée.");
  const managersBody = a5List(managerNames, name => `<article class="a5-item"><p>${esc(name)}</p></article>`, "Aucun manager associé");
  const meetingsBody = a5List(model.meetings, meeting => `<article class="a5-item"><strong>${esc(meeting.label)}</strong><p>${esc(meeting.date)} · ${esc(meeting.time)} ${meetingConfidentialityBadge(meeting.confidentiality)}</p></article>`, "Aucun rendez-vous lié.");
  const risksBody = a5List(model.risks, risk => `<article class="a5-item"><p>${esc(risk)}</p></article>`, "Aucun blocage ou risque.");
  const nextBody = a5List(model.nextSteps, step => `<article class="a5-item"><p>${esc(step)}</p></article>`, "Aucune donnée renseignée.");
  const notesBody = body.notes ? `<p>${esc(body.notes)}</p>` : `<p class="muted">Aucune donnée renseignée.</p>`;
  return `
    ${a5Section("Description", descriptionBody || `<p class="muted">Aucune donnée renseignée.</p>`) }
    ${a5Section("MANAGERS ASSOCIÉS", managersBody)}
    ${a5Section("Dossiers liés", foldersBody)}
    ${a5Section("Projets liés", projectsBody)}
    ${a5Section("Décisions liées", decisionsBody)}
    ${a5Section("Rendez-vous liés", meetingsBody)}
    ${a5Section("Blocages ou risques", risksBody)}
    ${a5Section("Prochaines étapes", nextBody)}
    ${a5Section("Notes", notesBody)}
  `;
}

function renderA5SummaryDecision(model) {
  const body = model.body || {};
  const managerNames = ensureArray(model.managerNames).filter(Boolean);
  const mainBody = [
    body.decisionText ? `<p><strong>Décision prise :</strong> ${esc(body.decisionText)}</p>` : "",
    body.context ? `<p><strong>Contexte :</strong> ${esc(body.context)}</p>` : "",
    body.rationale ? `<p><strong>Motifs / justification :</strong> ${esc(body.rationale)}</p>` : "",
    body.impacts ? `<p><strong>Impacts attendus :</strong> ${esc(body.impacts)}</p>` : "",
    body.owner ? `<p><strong>Responsable / décideur :</strong> ${esc(body.owner)}</p>` : "",
    body.risks ? `<p><strong>Risques :</strong> ${esc(body.risks)}</p>` : ""
  ].join("");
  const foldersBody = a5List(model.folders, folder => `<article class="a5-item"><strong>${esc(folder.name)}</strong><p>${esc(folder.category || "")} · ${esc(folder.status || "")}</p></article>`, "Aucun dossier lié.");
  const projectsBody = a5List(model.projects, project => `<article class="a5-item"><strong>${esc(project.name)}</strong><p>${esc(project.status)} · ${esc(String(project.progress || 0))}%</p></article>`, "Aucun projet lié.");
  const actionsBody = a5List(model.actions, action => `<article class="a5-item"><strong>${esc(action.title)}</strong><p>${esc(action.status)}${action.due ? " · " + esc(a5Date(action.due) || action.due) : ""}</p></article>`, "Aucune action liée.");
  const managersBody = a5List(managerNames, name => `<article class="a5-item"><p>${esc(name)}</p></article>`, "Aucun manager associé");
  const meetingsBody = a5List(model.meetings, meeting => `<article class="a5-item"><strong>${esc(meeting.label)}</strong><p>${esc(meeting.date)} · ${esc(meeting.time)} ${meetingConfidentialityBadge(meeting.confidentiality)}</p></article>`, "Aucun rendez-vous lié.");
  const followUpBody = a5List(model.followUp, row => `<article class="a5-item"><p>${esc(row)}</p></article>`, "Aucune donnée renseignée.");
  const notesBody = a5List(model.notes, note => `<article class="a5-item"><p>${esc(note)}</p></article>`, "Aucune donnée renseignée.");
  return `
    ${a5Section("Décision et contexte", mainBody || `<p class="muted">Aucune donnée renseignée.</p>`) }
    ${a5Section("MANAGERS ASSOCIÉS", managersBody)}
    ${a5Section("Dossiers liés", foldersBody)}
    ${a5Section("Projets liés", projectsBody)}
    ${a5Section("Actions liées", actionsBody)}
    ${a5Section("Rendez-vous liés", meetingsBody)}
    ${a5Section("Modalités de suivi", followUpBody)}
    ${a5Section("Prochaines étapes", followUpBody)}
    ${a5Section("Notes", notesBody)}
  `;
}

function renderA5SummaryModal() {
  if (!a5SummaryDialog.open || !a5SummaryDialog.model) return "";
  const model = a5SummaryDialog.model;
  const orientation = a5SummaryDialog.orientation === "landscape" ? "landscape" : "portrait";
  const body = model.type === "folder"
    ? renderA5SummaryFolder(model)
    : model.type === "project"
      ? renderA5SummaryProject(model)
      : model.type === "action"
        ? renderA5SummaryAction(model)
        : renderA5SummaryDecision(model);
  const typeLabel = model.type === "folder"
    ? "Dossier"
    : model.type === "project"
      ? "Projet"
      : model.type === "action"
        ? "Action"
        : "Décision";
  return `<div class="modal-backdrop a5-summary-modal" onclick="closeA5SummaryPreview()">
    <div class="modal-panel a5-summary-panel" onclick="event.stopPropagation()">
      <div class="modal-head no-print">
        <h2>Synthèse A5 · ${typeLabel}</h2>
        <button class="icon-close" type="button" onclick="closeA5SummaryPreview()" aria-label="Fermer">×</button>
      </div>
      <div class="a5-summary-toolbar no-print">
        <div class="a5-orientation-switch" role="group" aria-label="Orientation">
          <button type="button" class="secondary ${orientation === "portrait" ? "active-filter" : ""}" onclick="setA5SummaryOrientation('portrait')">Portrait</button>
          <button type="button" class="secondary ${orientation === "landscape" ? "active-filter" : ""}" onclick="setA5SummaryOrientation('landscape')">Paysage</button>
        </div>
        <div class="row-actions">
          <button type="button" class="action" onclick="printA5Summary()">Imprimer / Exporter en PDF</button>
          <button type="button" class="secondary" onclick="closeA5SummaryPreview()">Fermer</button>
        </div>
      </div>
      <div class="a5-print-root ${orientation}">
        <article class="a5-summary-sheet ${orientation}">
          ${renderA5SummaryHeader(model, orientation)}
          <div class="a5-content ${orientation === "landscape" ? "two-columns" : "one-column"}">${body}</div>
          <footer class="a5-footer">Document interne DEOS</footer>
        </article>
      </div>
    </div>
  </div>`;
}

function renderA5SummaryOverlay() {
  const root = document.getElementById("app");
  if (!root) return;
  root.querySelectorAll(".a5-summary-modal").forEach(node => node.remove());
  if (!a5SummaryDialog.open) return;
  root.insertAdjacentHTML("beforeend", renderA5SummaryModal());
}

function ensureActionModalHooks() {
  if (modalEscapeBound) return;
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (managerDeleteDialog.open) {
      closeManagerDeleteModal();
      event.preventDefault();
      return;
    }
    if (projectDeleteDialog.open) {
      closeProjectDeleteModal();
      event.preventDefault();
      return;
    }
    if (projectEditDialog.open) {
      closeProjectEditModal();
      event.preventDefault();
      return;
    }
    if (decisionDeleteDialog.open) {
      closeDecisionDeleteModal();
      event.preventDefault();
      return;
    }
    if (decisionEditDialog.open) {
      closeDecisionEditModal();
      event.preventDefault();
      return;
    }
    if (actionDeleteDialog.open) {
      closeActionDeleteModal();
      event.preventDefault();
      return;
    }
    if (actionEditDialog.open) {
      closeActionEditModal();
      event.preventDefault();
    }
  });
  modalEscapeBound = true;
}

function actionEditableManagerIds(action) {
  return normalizeLinkedManagerIds(ensureArray(action?.linkedManagers).length ? action.linkedManagers : ensureArray(action?.linkedManagerIds));
}

function actionRenderRelatedMeetings(action) {
  const meetings = actionRelationsForA5(action).meetings.map(a5MeetingDisplay);
  return a5List(meetings, meeting => `<article class="a5-item"><strong>${esc(meeting.label)}</strong><p>${esc(meeting.date)} · ${esc(meeting.time)} ${meetingConfidentialityBadge(meeting.confidentiality)}</p></article>`, "Aucun rendez-vous lié.");
}

function actionEditModalBody(action) {
  const relations = actionRelationsForA5(action);
  const hasManagersField = Object.prototype.hasOwnProperty.call(action, "linkedManagers") || Object.prototype.hasOwnProperty.call(action, "linkedManagerIds");
  const hasProgressField = Object.prototype.hasOwnProperty.call(action, "progress");
  const managerIds = actionEditableManagerIds(action);
  const descriptionValue = action.description || action.link || "";
  const objectiveValue = action.objective || action.next || "";
  const expectedValue = action.expectedResults || action.result || "";
  const notesValue = action.notes || action.note || "";
  const risksValue = action.risks || action.blockers || "";
  const nextStepValue = action.nextStep || action.next || "";
  const progressValue = hasProgressField ? Number(action.progress || 0) : 0;
  const relatedManagersHtml = hasManagersField
    ? `<div><label>Managers associés</label>${checkboxList("eaManagers", state.managers, managerIds, m => `${m.name} · ${m.role || ""}`)}</div>`
    : `<div><label>Managers associés</label>${a5List(relations.managers, manager => `<article class="a5-item"><p>${esc(manager.name || "Manager")}${manager.role ? " · " + esc(manager.role) : ""}</p></article>`, "Aucun manager associé.")}</div>`;

  return `
    <div class="form-grid">
      <input id="eaTitle" value="${esc(action.title || "")}" placeholder="Titre ou libellé" class="full">
      <input id="eaLink" value="${esc(action.link || "")}" placeholder="Description / contexte" class="full">
      <input id="eaOwner" value="${esc(action.owner || "")}" placeholder="Responsable">
      <select id="eaLevel">
        <option value="green" ${action.level === "green" ? "selected" : ""}>Normal</option>
        <option value="orange" ${action.level === "orange" || !action.level ? "selected" : ""}>Important</option>
        <option value="red" ${action.level === "red" ? "selected" : ""}>Critique</option>
      </select>
      <input id="eaDue" type="date" value="${esc(action.due || "")}" placeholder="Échéance">
      <label class="check-row"><input id="eaDone" type="checkbox" ${action.done ? "checked" : ""}> <span>Action réalisée</span></label>
      ${hasProgressField ? `<input id="eaProgress" type="number" min="0" max="100" value="${Number(progressValue || 0)}" placeholder="Avancement">` : ""}
    </div>
    <textarea id="eaDescription" placeholder="Description">${esc(descriptionValue)}</textarea>
    <textarea id="eaObjective" placeholder="Objectif">${esc(objectiveValue)}</textarea>
    <textarea id="eaExpectedResults" placeholder="Résultat attendu">${esc(expectedValue)}</textarea>
    <textarea id="eaRisks" placeholder="Blocages ou risques">${esc(risksValue)}</textarea>
    <textarea id="eaNextStep" placeholder="Prochaines étapes">${esc(nextStepValue)}</textarea>
    <textarea id="eaNotes" placeholder="Notes">${esc(notesValue)}</textarea>
    <div class="grid two manager-links">
      <div><label>Dossiers liés</label>${checkboxList("eaFolders", state.folders, normalizeLinkedIdArray(action.linkedFolders), folder => folder.name)}</div>
      <div><label>Projets liés</label>${checkboxList("eaProjects", state.projects, normalizeLinkedIdArray(action.linkedProjects), project => project.name)}</div>
      <div><label>Décisions liées</label>${checkboxList("eaDecisions", state.decisions, normalizeLinkedIdArray(action.linkedDecisions), decision => decision.title)}</div>
      ${relatedManagersHtml}
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Rendez-vous liés</h3>
      ${actionRenderRelatedMeetings(action)}
    </div>
    <div class="modal-actions">
      <button class="action" type="button" onclick="saveActionEdit('${esc(action.id)}')">Enregistrer</button>
      <button class="secondary" type="button" onclick="closeActionEditModal()">Annuler</button>
    </div>
  `;
}

function renderActionEditModal() {
  if (!actionEditDialog.open) return "";
  const action = byId("actions", actionEditDialog.actionId);
  if (!action) return "";
  const errorHtml = actionEditDialog.error ? `<p class="folder-delete-error">${esc(actionEditDialog.error)}</p>` : "";
  return `<div class="modal-backdrop action-edit-modal" onclick="closeActionEditModal()"><div class="modal-panel" style="max-height:88vh;overflow-y:auto" onclick="event.stopPropagation()"><div class="modal-head"><h2>Modifier action</h2><button class="icon-close" type="button" onclick="closeActionEditModal()" aria-label="Fermer">×</button></div>${errorHtml}${actionEditModalBody(action)}</div></div>`;
}

function renderActionDeleteModal() {
  if (!actionDeleteDialog.open) return "";
  const action = byId("actions", actionDeleteDialog.actionId);
  if (!action) return "";
  const relations = actionRelationsForA5(action);
  const errorHtml = actionDeleteDialog.error ? `<p class="folder-delete-error">${esc(actionDeleteDialog.error)}</p>` : "";
  return `<div class="modal-backdrop action-delete-modal" onclick="closeActionDeleteModal()"><div class="modal-panel" onclick="event.stopPropagation()"><div class="modal-head"><h2>Supprimer l'action</h2><button class="icon-close" type="button" onclick="closeActionDeleteModal()" aria-label="Fermer">×</button></div><p>Confirmer la suppression de <strong>${esc(action.title || "Action")}</strong>.</p><p class="muted">Les liens visibles resteront dans les autres objets, mais cette Action sera retirée de DEOS.</p>${errorHtml}<div class="grid two"><div class="card"><h3>Impacts</h3><p><strong>Dossiers :</strong> ${relations.folders.length}</p><p><strong>Projets :</strong> ${relations.projects.length}</p><p><strong>Décisions :</strong> ${relations.decisions.length}</p><p><strong>Rendez-vous :</strong> ${relations.meetings.length}</p></div><div class="card"><h3>Managers associés</h3><p>${relations.managers.length ? esc(relations.managers.map(manager => manager.name).join(" · ")) : "Aucun"}</p></div></div><div class="modal-actions"><button class="danger" type="button" onclick="confirmActionDelete('${esc(action.id)}')">Supprimer définitivement</button><button class="secondary" type="button" onclick="closeActionDeleteModal()">Annuler</button></div></div></div></div>`;
}

function renderActionModalOverlays() {
  const root = document.getElementById("app");
  if (!root) return;
  root.querySelectorAll(".action-edit-modal, .action-delete-modal").forEach(node => node.remove());
  if (actionEditDialog.open) root.insertAdjacentHTML("beforeend", renderActionEditModal());
  if (actionDeleteDialog.open) root.insertAdjacentHTML("beforeend", renderActionDeleteModal());
}

function openActionEditModal(id) {
  const action = byId("actions", id);
  if (!action) return;
  ensureActionModalHooks();
  actionEditDialog = { open: true, actionId: String(id), error: "" };
  renderActionModalOverlays();
}

function closeActionEditModal() {
  if (!actionEditDialog.open) return;
  actionEditDialog = { open: false, actionId: "", error: "" };
  renderActionModalOverlays();
}

function openActionDeleteModal(id) {
  const action = byId("actions", id);
  if (!action) return;
  ensureActionModalHooks();
  actionDeleteDialog = { open: true, actionId: String(id), error: "" };
  renderActionModalOverlays();
}

function closeActionDeleteModal() {
  if (!actionDeleteDialog.open) return;
  actionDeleteDialog = { open: false, actionId: "", error: "" };
  renderActionModalOverlays();
}

function saveActionEdit(id) {
  const i = indexById("actions", id);
  if (i < 0) return false;
  const current = state.actions[i];
  const title = document.getElementById("eaTitle")?.value.trim() || "";
  if (!title) {
    actionEditDialog.error = "Le titre de l'action est obligatoire.";
    renderActionModalOverlays();
    return false;
  }
  const hasManagersField = Object.prototype.hasOwnProperty.call(current, "linkedManagers") || Object.prototype.hasOwnProperty.call(current, "linkedManagerIds");
  const hasProgressField = Object.prototype.hasOwnProperty.call(current, "progress");
  const next = {
    ...current,
    title,
    link: document.getElementById("eaLink")?.value.trim() || "",
    description: document.getElementById("eaDescription")?.value.trim() || "",
    objective: document.getElementById("eaObjective")?.value.trim() || "",
    expectedResults: document.getElementById("eaExpectedResults")?.value.trim() || "",
    owner: document.getElementById("eaOwner")?.value.trim() || "",
    level: document.getElementById("eaLevel")?.value || "orange",
    done: document.getElementById("eaDone")?.checked || false,
    due: document.getElementById("eaDue")?.value || "",
    notes: document.getElementById("eaNotes")?.value.trim() || "",
    note: document.getElementById("eaNotes")?.value.trim() || "",
    risks: document.getElementById("eaRisks")?.value.trim() || "",
    blockers: document.getElementById("eaRisks")?.value.trim() || "",
    nextStep: document.getElementById("eaNextStep")?.value.trim() || "",
    linkedFolders: normalizeLinkedIdArray(checkedValues("eaFolders")),
    linkedProjects: normalizeLinkedIdArray(checkedValues("eaProjects")),
    linkedDecisions: normalizeLinkedIdArray(checkedValues("eaDecisions"))
  };
  if (hasProgressField) next.progress = Number(document.getElementById("eaProgress")?.value || 0);
  if (hasManagersField) {
    const managerIds = normalizeLinkedManagerIds(checkedValues("eaManagers"));
    next.linkedManagers = managerIds;
    if (Object.prototype.hasOwnProperty.call(current, "linkedManagerIds")) next.linkedManagerIds = managerIds;
  }
  state.actions[i] = normalizeEntity("actions", next);
  persist("actions");
  addActivity("? Action modifiée", state.actions[i].title, state.actions[i].link || state.actions[i].owner || "", id);
  if (a5SummaryDialog.open && a5SummaryDialog.type === "action" && sameId(a5SummaryDialog.sourceId, id)) {
    a5SummaryDialog.model = buildActionA5Summary(id);
  }
  closeActionEditModal();
  if (sameId(actionDetailId, id)) {
    openAction(id);
  } else {
    renderActions();
  }
  return true;
}

function confirmActionDelete(id) {
  const i = indexById("actions", id);
  if (i < 0) return false;
  const title = state.actions[i].title;
  state.actions.splice(i, 1);
  persist("actions");
  addActivity("🗑️ Action supprimée", title);
  if (a5SummaryDialog.open && a5SummaryDialog.type === "action" && sameId(a5SummaryDialog.sourceId, id)) {
    closeA5SummaryPreview();
  }
  closeActionDeleteModal();
  if (sameId(actionDetailId, id)) {
    actionDetailId = "";
    renderActions();
  } else {
    renderActions();
  }
  return true;
}

function toggleAgendaTimeFields() {
  const allDay = document.getElementById("agAllDay")?.checked;
  const start = document.getElementById("agStart");
  const end = document.getElementById("agEnd");
  if (!start || !end) return;
  if (allDay) {
    start.disabled = true;
    end.disabled = true;
    start.classList.add("muted");
    end.classList.add("muted");
  } else {
    start.disabled = false;
    end.disabled = false;
    start.classList.remove("muted");
    end.classList.remove("muted");
  }
}

function agendaTimeLabel(a) {
  const start = agendaStartTime(a);
  if (agendaIsAllDay(a)) return "Journée entière";
  if (start) return `${esc(start)}${a.endTime ? " - " + esc(a.endTime) : ""}`;
  return "Heure à confirmer";
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

function levelLabel(level) {
  return labels[level] || ({ decided: "Décidée", applying: "En cours", review: "À réexaminer", applied: "Appliquée" })[level] || "À suivre";
}

function dueLabel(value) {
  const due = daysUntil(value);
  if (!value) return "Sans échéance";
  if (due === null) return value;
  if (due < 0) return `En retard de ${Math.abs(due)} j`;
  if (due === 0) return "Aujourd'hui";
  if (due === 1) return "Demain";
  return `Dans ${due} j`;
}

function isPendingDecision(d) {
  return d.status !== "applied";
}

function cockpitEntityKey(entity, id) {
  return `${entity}:${id}`;
}

function relatedProjectFromText(text = "") {
  const s = String(text).toLowerCase();
  return state.projects.find(p => s.includes(String(p.name || "").toLowerCase()));
}

function relatedManagerFromText(text = "") {
  const s = String(text).toLowerCase();
  return state.managers.find(m => s.includes(String(m.name || "").toLowerCase()));
}

function relatedDecisionFromText(text = "") {
  const s = String(text).toLowerCase();
  return state.decisions.find(d => s.includes(String(d.title || "").toLowerCase()));
}

function cockpitItem({ entity, id, type, title, level = "orange", due = "", time = "", owner = "", link = "", detail = "", action = "" }) {
  return { key: cockpitEntityKey(entity, id), entity, id, type, title, level, due, time, owner, link, detail, action };
}

function cockpitTodayItems() {
  const items = [];
  const push = item => {
    if (!items.some(x => x.key === item.key)) items.push(item);
  };
  state.priorities.filter(p => !p.done).forEach(p => {
    const due = daysUntil(p.due);
    if ((due !== null && due <= 0) || p.level === "red") push(cockpitItem({ entity: "priorities", id: p.id, type: "Priorité", title: p.title, level: p.level, due: p.due, owner: p.owner, link: p.link, action: "priority" }));
  });
  state.actions.filter(a => !a.done).forEach(a => {
    const due = daysUntil(a.due);
    const level = a.level || a.priorityLevel || (/critique|urgent/i.test(`${a.title} ${a.link}`) ? "red" : "orange");
    if ((due !== null && due <= 0) || level === "red") push(cockpitItem({ entity: "actions", id: a.id, type: "Action", title: a.title, level, due: a.due, link: a.link, action: "action" }));
  });
  state.projects.forEach(p => {
    const due = daysUntil(p.deadline);
    const level = p.status === "red" || p.priorityLevel === "red" ? "red" : p.status || p.priorityLevel || "orange";
    if ((due !== null && due <= 0) || level === "red") push(cockpitItem({ entity: "projects", id: p.id, type: "Projet", title: p.name, level, due: p.deadline, owner: projectOwnerName(p), link: p.next || p.objective }));
  });
  state.decisions.filter(isPendingDecision).forEach(d => {
    const due = daysUntil(d.reviewDate);
    const level = d.importance === "red" || d.status === "review" ? "red" : d.importance || "orange";
    if ((due !== null && due <= 0) || d.status === "review" || d.status === "applying" || d.nextStep) push(cockpitItem({ entity: "decisions", id: d.id, type: "Décision", title: d.title, level, due: d.reviewDate, owner: d.owner, link: d.nextStep || d.context, detail: decisionStatusLabel(d.status) }));
  });
  state.meetingPreparations.filter(p => !["Prête", "Réalisée", "Compte rendu à finaliser", "Clôturée"].includes(p.status)).forEach(p => {
    const a = byId("agenda", p.agendaId);
    const due = daysUntil(a?.date);
    if (a && due !== null && due <= 2) push(cockpitItem({ entity: "meetingPreparations", id: p.id, type: "Réunion à préparer", title: a.title, level: due <= 0 ? "red" : "orange", due: a.date, time: agendaStartTime(a), owner: p.organizer, link: p.status, detail: p.objectiveMain || a.type }));
  });
  return items.sort((a, b) => levelRank(a.level) - levelRank(b.level) || dateRank(a.due) - dateRank(b.due) || String(a.time).localeCompare(String(b.time)));
}

function cockpitUpcomingItems() {
  const items = [];
  const push = item => {
    const due = daysUntil(item.due);
    if (due !== null && due >= 0 && due <= 7 && !items.some(x => x.key === item.key)) items.push(item);
  };
  state.agenda.forEach(a => push(cockpitItem({ entity: "agenda", id: a.id, type: "Rendez-vous", title: a.title, level: "green", due: a.date, time: agendaStartTime(a), owner: agendaLinkedNames(a), link: a.location || a.type })));
  state.actions.filter(a => !a.done).forEach(a => push(cockpitItem({ entity: "actions", id: a.id, type: "Action", title: a.title, level: a.level || a.priorityLevel || "orange", due: a.due, link: a.link, action: "action" })));
  state.priorities.filter(p => !p.done).forEach(p => push(cockpitItem({ entity: "priorities", id: p.id, type: "Priorité", title: p.title, level: p.level, due: p.due, owner: p.owner, link: p.link, action: "priority" })));
  state.projects.forEach(p => push(cockpitItem({ entity: "projects", id: p.id, type: "Projet", title: p.name, level: p.status || p.priorityLevel || "orange", due: p.deadline, owner: projectOwnerName(p), link: p.next })));
  state.decisions.filter(isPendingDecision).forEach(d => push(cockpitItem({ entity: "decisions", id: d.id, type: "Décision", title: d.title, level: d.importance || "orange", due: d.reviewDate, owner: d.owner, link: d.nextStep || d.context, detail: decisionStatusLabel(d.status) })));
  state.meetingPreparations.forEach(p => {
    const a = byId("agenda", p.agendaId);
    if (a) push(cockpitItem({ entity: "meetingPreparations", id: p.id, type: "Préparation réunion", title: a.title, level: p.status === "À préparer" ? "orange" : "green", due: a.date, time: agendaStartTime(a), owner: p.organizer, link: p.status }));
  });
  return items.sort((a, b) => dateRank(a.due) - dateRank(b.due) || String(a.time).localeCompare(String(b.time)) || levelRank(a.level) - levelRank(b.level));
}

function cockpitOverdueItems() {
  return [...cockpitTodayItems(), ...cockpitUpcomingItems()].filter(item => daysUntil(item.due) !== null && daysUntil(item.due) < 0);
}

function cockpitAlertItems(todayItems = cockpitTodayItems()) {
  const blocked = new Set(todayItems.map(i => i.key));
  const alerts = [];
  const push = item => {
    if (!blocked.has(item.key) && !alerts.some(a => a.key === item.key)) alerts.push(item);
  };
  state.actions.filter(a => !a.done && daysUntil(a.due) !== null && daysUntil(a.due) < 0).forEach(a => push(cockpitItem({ entity: "actions", id: a.id, type: "Action", title: a.title, level: "red", due: a.due, link: a.link, detail: "Action en retard", action: "action" })));
  state.projects.filter(p => p.status === "red" || p.priorityLevel === "red").forEach(p => push(cockpitItem({ entity: "projects", id: p.id, type: "Projet", title: p.name, level: "red", due: p.deadline, owner: projectOwnerName(p), link: p.next, detail: "Projet critique" })));
  state.decisions.filter(isPendingDecision).forEach(d => push(cockpitItem({ entity: "decisions", id: d.id, type: "Décision", title: d.title, level: d.importance === "red" || d.status === "review" ? "red" : "orange", due: d.reviewDate, owner: d.owner, link: d.nextStep || d.context, detail: decisionStatusLabel(d.status) })));
  state.managers.filter(m => m.status === "red" || m.status === "orange").forEach(m => push(cockpitItem({ entity: "managers", id: m.id, type: "Manager", title: m.name, level: m.status, due: m.nextMeeting, owner: m.role, link: m.priority, detail: m.status === "red" ? "Manager critique" : "Manager À suivre" })));
  state.meetingPreparations.filter(p => p.status === "À préparer").forEach(p => {
    const a = byId("agenda", p.agendaId);
    const due = daysUntil(a?.date);
    if (a && due !== null && due >= 0 && due <= 2) push(cockpitItem({ entity: "meetingPreparations", id: p.id, type: "Réunion à préparer", title: a.title, level: "orange", due: a.date, time: agendaStartTime(a), owner: p.organizer, link: p.status, detail: "Moins de 48 h" }));
  });
  cockpitUpcomingItems().forEach(item => {
    if (item.entity === "agenda") return;
    if (daysUntil(item.due) !== null && daysUntil(item.due) > 0 && daysUntil(item.due) <= 7) push({ ...item, level: item.level === "red" ? "red" : "orange", detail: "Échéance à 7 jours" });
  });
  return alerts.sort((a, b) => levelRank(a.level) - levelRank(b.level) || dateRank(a.due) - dateRank(b.due));
}

function cockpitMetrics(todayItems, alertItems, upcomingItems) {
  const overdueKeys = new Set([...todayItems, ...alertItems].filter(i => daysUntil(i.due) !== null && daysUntil(i.due) < 0).map(i => i.key));
  const pendingDecisions = state.decisions.filter(isPendingDecision);
  return {
    red: [...todayItems, ...alertItems].filter(i => i.level === "red").length,
    openActions: state.actions.filter(a => !a.done).length,
    managers: cockpitManagers().length,
    priorities: state.priorities.filter(p => !p.done).length,
    overdue: overdueKeys.size,
    decisions: pendingDecisions.length,
    week: upcomingItems.length
  };
}

function setCockpitFocus(focus) {
  cockpitFocus = cockpitFocus === focus ? "" : focus;
  renderCockpit();
}


function editDecision(id) {
  decisionDetailId = String(id);
  openDecisionEditModal(id);
}

function saveDecision(id) {
  return saveDecisionEdit(id);
}

function deleteDecision(id) {
  openDecisionDeleteModal(id);
}
function cockpitFocusItems(focus, todayItems, alertItems, upcomingItems) {
  if (focus === "today") return todayItems;
  if (focus === "alerts") return alertItems;
  if (focus === "red") return [...todayItems, ...alertItems].filter(i => i.level === "red");
  if (focus === "actions") return state.actions.filter(a => !a.done).map(a => cockpitItem({ entity: "actions", id: a.id, type: "Action", title: a.title, level: a.level || a.priorityLevel || "orange", due: a.due, link: a.link, action: "action" }));
  if (focus === "managers") return cockpitManagers().map(m => cockpitItem({ entity: "managers", id: m.id, type: "Manager", title: m.name, level: m.status, due: m.nextMeeting, owner: m.role, link: m.priority }));
  if (focus === "priorities") return state.priorities.filter(p => !p.done).map(p => cockpitItem({ entity: "priorities", id: p.id, type: "Priorité", title: p.title, level: p.level, due: p.due, owner: p.owner, link: p.link, action: "priority" }));
  if (focus === "overdue") return [...todayItems, ...alertItems].filter(i => daysUntil(i.due) !== null && daysUntil(i.due) < 0);
  if (focus === "decisions") return state.decisions.filter(isPendingDecision).map(d => cockpitItem({ entity: "decisions", id: d.id, type: "Décision", title: d.title, level: d.importance || "orange", due: d.reviewDate, owner: d.owner, link: d.nextStep || d.context, detail: decisionStatusLabel(d.status) }));
  if (focus === "week") return upcomingItems;
  return [];
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

function cockpitFolders() {
  return state.folders.filter(f => {
    const stats = folderStats(f);
    const due = daysUntil(stats.nextDue || f.deadline);
    return f.status === "red" || f.priorityLevel === "red" || stats.overdueActions > 0 || (due !== null && due <= 7);
  }).sort((a, b) => levelRank(a.status === "red" ? "red" : a.priorityLevel) - levelRank(b.status === "red" ? "red" : b.priorityLevel) || dateRank(folderStats(a).nextDue || a.deadline) - dateRank(folderStats(b).nextDue || b.deadline)).slice(0, 3);
}

function cockpitAlerts() {
  const alerts = [];
  const push = (type, id, title, detail, level = "orange") => {
    if (!alerts.some(a => a.type === type && a.id === id)) alerts.push({ type, id, title, detail, level });
  };
  cockpitProjects().forEach(p => push("projects", p.id, p.name, p.status === "red" ? "Projet critique" : "Projet à sécuriser", p.status));
  state.actions.filter(a => !a.done && daysUntil(a.due) !== null && daysUntil(a.due) < 0).forEach(a => push("actions", a.id, a.title, "Action en retard", "red"));
  state.managers.filter(m => m.status === "red").forEach(m => push("managers", m.id, m.name, "Manager critique", "red"));
  cockpitDecisions().forEach(d => push("decisions", d.id, d.title, d.status === "review" ? "Décision à réexaminer" : "Décision À suivre", d.importance === "red" ? "red" : "orange"));
  state.documents.filter(d => /validation|à valider|a valider/i.test(d.status || "")).forEach(d => push("documents", d.id, d.title, "Document en attente de validation", "orange"));
  return alerts;
}

function getCockpitAgenda(range = agendaFilter) {
  const settings = getCalendarConnectionSettings();
  const todayIso = localIsoDate();
  const tomorrowIso = localIsoAddDays(1);
  const weekIso = localIsoAddDays(7);
  const normalizedRange = ["today", "tomorrow", "week", "all"].includes(range) ? range : "today";
  const inRange = item => {
    const date = String(item?.date || "");
    if (!date) return normalizedRange === "all";
    if (normalizedRange === "today") return date === todayIso;
    if (normalizedRange === "tomorrow") return date === tomorrowIso;
    if (normalizedRange === "week") return date >= todayIso && date <= weekIso;
    return true;
  };
  const manual = state.agenda.filter(inRange).map(item => ({ ...item }));
  const external = settings.showInAgenda
    ? (state.externalCalendarEvents || []).filter(inRange).map(item => ({ ...item, _external: true }))
    : [];
  return [...manual, ...external].sort(compareAgendaEvents);
}

function getProjectsAtRisk() {
  const blockedPattern = /blocage|bloqu[ée]|retard majeur|critique/i;
  const donePattern = /fait|termin[ée]|clos|ok/i;
  return state.projects.filter(project => {
    const riskText = String(project.risks || "").trim();
    const explicitRisk = project.status === "red" || project.priorityLevel === "red";
    const blocked = blockedPattern.test(`${project.next || ""} ${project.context || ""} ${riskText}`);
    const overdue = daysUntil(project.deadline) !== null && daysUntil(project.deadline) < 0;
    const overdueMilestone = ensureArray(project.milestones).some(milestone => {
      const delay = daysUntil(milestone?.date);
      return delay !== null && delay < 0 && !donePattern.test(String(milestone?.status || ""));
    });
    return explicitRisk || Boolean(riskText) || blocked || overdue || overdueMilestone;
  }).sort((a, b) => {
    const aRed = a.status === "red" || a.priorityLevel === "red" ? 0 : 1;
    const bRed = b.status === "red" || b.priorityLevel === "red" ? 0 : 1;
    return aRed - bRed || dateRank(a.deadline) - dateRank(b.deadline) || Number(a.progress || 0) - Number(b.progress || 0);
  });
}

function getActivePriorities() {
  return state.priorities
    .filter(priority => !priority.done)
    .slice()
    .sort((a, b) => levelRank(a.level) - levelRank(b.level) || dateRank(a.due) - dateRank(b.due) || createdRank(a) - createdRank(b));
}

function getTodayOperationalItems() {
  const items = [];
  const todayIso = localIsoDate();
  const push = entry => {
    if (!items.some(item => item.key === entry.key)) items.push(entry);
  };

  state.actions.filter(action => !action.done).forEach(action => {
    const delay = daysUntil(action.due);
    const level = action.level || action.priorityLevel || (/critique|urgent/i.test(`${action.title || ""} ${action.link || ""}`) ? "red" : "orange");
    if (delay !== null && delay < 0) {
      push({ key: `action:${action.id}`, entity: "actions", id: action.id, type: "Action", title: action.title, level: "red", owner: action.owner || "", due: action.due, detail: `En retard de ${Math.abs(delay)} j`, completion: "action" });
      return;
    }
    if (action.due === todayIso) {
      push({ key: `action:${action.id}`, entity: "actions", id: action.id, type: "Action", title: action.title, level, owner: action.owner || "", due: action.due, detail: "Echeance aujourd'hui", completion: "action" });
    }
  });

  getActivePriorities().forEach(priority => {
    const delay = daysUntil(priority.due);
    if (priority.level === "red" && delay !== null && delay <= 0) {
      push({ key: `priority:${priority.id}`, entity: "priorities", id: priority.id, type: "Priorite", title: priority.title, level: "red", owner: priority.owner || "", due: priority.due, detail: delay < 0 ? `Echeance depassee de ${Math.abs(delay)} j` : "Critique a traiter aujourd'hui", completion: "priority" });
    }
  });

  state.decisions.filter(isPendingDecision).forEach(decision => {
    const delay = daysUntil(decision.reviewDate);
    if (decision.status === "review" || (delay !== null && delay <= 0)) {
      push({ key: `decision:${decision.id}`, entity: "decisions", id: decision.id, type: "Decision", title: decision.title, level: decision.importance === "red" ? "red" : "orange", owner: decision.owner || "", due: decision.reviewDate, detail: decision.status === "review" ? "Arbitrage a mener" : dueLabel(decision.reviewDate), completion: "" });
    }
  });

  state.meetingPreparations.filter(prep => !["Prête", "Réalisée", "Compte rendu à finaliser", "Clôturée"].includes(prep.status)).forEach(prep => {
    const meeting = byId("agenda", prep.agendaId);
    const delay = daysUntil(meeting?.date);
    if (meeting && delay !== null && delay >= 0 && delay <= 1) {
      push({ key: `meeting:${prep.id}`, entity: "meetingPreparations", id: prep.id, type: "Preparation", title: meeting.title, level: delay === 0 ? "red" : "orange", owner: prep.organizer || "", due: meeting.date, detail: "Preparation urgente", completion: "" });
    }
  });

  return items.sort((a, b) => levelRank(a.level) - levelRank(b.level) || dateRank(a.due) - dateRank(b.due)).slice(0, 6);
}

function getAttentionItems() {
  const todayItems = getTodayOperationalItems();
  const blocked = new Set(todayItems.map(item => item.key));
  const items = [];
  const push = entry => {
    if (!blocked.has(entry.key) && !items.some(item => item.key === entry.key)) items.push(entry);
  };

  getProjectsAtRisk().forEach(project => {
    const delay = daysUntil(project.deadline);
    const reason = project.risks || (delay !== null && delay < 0 ? `Retard de ${Math.abs(delay)} j` : project.next || "Risque explicite");
    push({ key: `project:${project.id}`, entity: "projects", id: project.id, type: "Projet", title: project.name, level: project.status === "red" || project.priorityLevel === "red" ? "red" : "orange", due: project.deadline, detail: reason, completion: "" });
  });

  state.actions.filter(action => !action.done).forEach(action => {
    const delay = daysUntil(action.due);
    const severe = delay !== null && delay <= -2;
    if (!severe) return;
    push({ key: `action:${action.id}`, entity: "actions", id: action.id, type: "Action", title: action.title, level: "red", due: action.due, detail: `Retard important (${Math.abs(delay)} j)`, completion: "action" });
  });

  getActivePriorities().forEach(priority => {
    if (priority.level !== "red") return;
    push({ key: `priority:${priority.id}`, entity: "priorities", id: priority.id, type: "Priorite", title: priority.title, level: "red", due: priority.due, detail: "Priorite critique", completion: "priority" });
  });

  state.decisions.filter(isPendingDecision).forEach(decision => {
    if (decision.status !== "review") return;
    push({ key: `decision:${decision.id}`, entity: "decisions", id: decision.id, type: "Decision", title: decision.title, level: decision.importance === "red" ? "red" : "orange", due: decision.reviewDate, detail: "Decision a arbitrer", completion: "" });
  });

  state.managers.forEach(manager => {
    const delay = daysUntil(manager.nextMeeting);
    if (delay === null || delay > 3) return;
    push({ key: `manager:${manager.id}`, entity: "managers", id: manager.id, type: "Manager", title: manager.name, level: delay < 0 || manager.status === "red" ? "red" : "orange", due: manager.nextMeeting, detail: delay < 0 ? "Entretien depasse" : "Entretien proche", completion: "" });
  });

  return items.sort((a, b) => levelRank(a.level) - levelRank(b.level) || dateRank(a.due) - dateRank(b.due)).slice(0, 5);
}

function getCockpitMetrics() {
  const todayMeetings = getCockpitAgenda("today").length;
  const overdueActions = state.actions.filter(action => !action.done && daysUntil(action.due) !== null && daysUntil(action.due) < 0).length;
  const decisionsToTrack = state.decisions.filter(isPendingDecision).length;
  const riskyProjects = getProjectsAtRisk().length;
  const activePriorities = getActivePriorities().length;
  return {
    todayMeetings,
    overdueActions,
    decisionsToTrack,
    riskyProjects,
    activePriorities
  };
}

function cockpitMetricCard(label, value, detail, action) {
  return `<button class="cockpit-metric" type="button" onclick="${action}"><strong>${esc(String(value))}</strong><span>${esc(label)}</span><small>${esc(detail)}</small></button>`;
}

function openCockpitQuickCreate(type) {
  cockpitQuickCreateMode = type;
  if (type === "priority") {
    setView("priorities");
    requestAnimationFrame(() => document.getElementById("pTitle")?.focus());
    return;
  }
  if (type === "action") {
    setView("actions");
    requestAnimationFrame(() => document.getElementById("aTitle")?.focus());
    return;
  }
  if (type === "decision") {
    setView("decisions");
    requestAnimationFrame(() => document.getElementById("dTitle")?.focus());
  }
}

function closeCockpitQuickCreateIfNeeded(type) {
  if (cockpitQuickCreateMode !== type) return false;
  cockpitQuickCreateMode = "";
  setView("cockpit");
  return true;
}

function cockpitOperationalRow(item) {
  const completeButton = item.completion === "action"
    ? `<button class="secondary" type="button" onclick="completeCockpitAction('${esc(item.id)}')">Terminer</button>`
    : item.completion === "priority"
      ? `<button class="secondary" type="button" onclick="completeCockpitPriority('${esc(item.id)}')">Terminer</button>`
      : "";
  const openButton = item.entity === "actions"
    ? `openAction('${esc(item.id)}')`
    : item.entity === "decisions"
      ? `openDecision('${esc(item.id)}')`
      : item.entity === "projects"
        ? `openProject('${esc(item.id)}')`
        : item.entity === "managers"
          ? `openManager('${esc(item.id)}')`
          : item.entity === "meetingPreparations"
            ? `openMeetingPreparation('${esc(item.id)}')`
            : `setView('${esc(item.entity)}')`;
  return `<div class="item row cockpit-ops-item alert-${esc(item.level)}"><div><strong>${esc(item.type)} · ${esc(item.title)}</strong><span class="muted">${esc(levelLabel(item.level))} · ${esc(item.detail || dueLabel(item.due))}${item.owner ? " · " + esc(item.owner) : ""}</span><span class="meta">${esc(item.due ? dueLabel(item.due) : "Sans échéance")}</span></div><div class="row-actions">${completeButton}<button class="secondary" type="button" onclick="${openButton}">Ouvrir</button></div></div>`;
}

function cockpitPriorityRow(priority) {
  return `<div class="item row"><div><strong>${icons[priority.level] || "🎯"} ${esc(priority.title)}</strong><span class="muted">${esc(levelLabel(priority.level))}${priority.owner ? " · " + esc(priority.owner) : ""}${priority.due ? " · " + esc(priority.due) : ""}</span><span class="meta">Etat : Active</span></div><div class="row-actions"><button class="secondary" type="button" onclick="completeCockpitPriority('${esc(priority.id)}')">Terminer</button><button class="secondary" type="button" onclick="setView('priorities')">Ouvrir</button></div></div>`;
}

function cockpitProjectRiskRow(project) {
  const delay = daysUntil(project.deadline);
  const riskText = project.risks || (delay !== null && delay < 0 ? `Retard de ${Math.abs(delay)} j` : "Risque a suivre");
  return `<div class="item row"><div><strong>${icons[project.status] || "📁"} ${esc(project.name)}</strong><span class="muted">${esc(riskText)}</span><span class="meta">Avancement ${esc(String(Number(project.progress || 0)))}%${project.deadline ? " · Echéance " + esc(project.deadline) : ""}</span></div><div class="row-actions"><button class="secondary" type="button" onclick="openProject('${esc(project.id)}')">Ouvrir</button></div></div>`;
}

function cockpitAgendaSourceBadge(item) {
  return item._external
    ? `<span class="gc-badge" title="Importé depuis Google Calendar">Google</span>`
    : `<span class="source-badge">DEOS</span>`;
}

function cockpitAgendaLine(item) {
  const external = Boolean(item._external);
  const key = item._key || `google_${item.externalId || item.id || "event"}`;
  const enrichment = external ? getExternalEventEnrichment(key) : null;
  const confidentiality = normalizeMeetingConfidentiality(external ? enrichment.confidentiality : item.confidentiality || "normal");
  const restricted = confidentiality === "restricted" || confidentiality === "confidential";
  const allDay = external ? Boolean(item.allDay) : agendaIsAllDay(item);
  const start = agendaStartTime(item);
  const time = allDay ? "Journee entiere" : (start ? `${start}${item.endTime ? " - " + item.endTime : ""}` : "Heure a confirmer");
  const links = !external && !restricted ? agendaLinkedNames(item) : "";
  const summary = external
    ? esc(item.calendarName || "Google Calendar")
    : esc(item.type || "Rendez-vous");
  const extra = restricted ? "" : `${item.location ? " · " + esc(item.location) : ""}${links ? " · " + esc(links) : ""}`;
  const openAction = external
    ? `openExternalEventModal('${esc(key)}')`
    : `editAgenda('${esc(item.id)}')`;
  return `<div class="agenda-line cockpit-agenda-line clickable" onclick="${openAction}"><strong>${esc(item.date || "Sans date")} · ${esc(time)}</strong><span>${esc(item.title || "Rendez-vous")}${cockpitAgendaSourceBadge(item)}<small>${summary}${extra}</small>${meetingConfidentialityBadge(confidentiality)}</span><div class="row-actions"><button class="secondary" type="button" onclick="event.stopPropagation();${openAction}">Détails</button></div></div>`;
}

function renderCockpit() {
  const now = new Date();
  const week = isoWeekNumber(now);
  const metrics = getCockpitMetrics();
  const todayOperational = getTodayOperationalItems();
  const attentionItems = getAttentionItems();
  const activePriorities = getActivePriorities().slice(0, 5);
  const projectsAtRisk = getProjectsAtRisk().slice(0, 5);
  const agenda = getCockpitAgenda(agendaFilter);
  const identityLine = `${identity.siteName || identityDefaults.siteName} · ${identityName()} · ${today()} · S${week}`;

  appHtml(`
    <div class="card hero cockpit-header-card">
      <div class="cockpit-header-main">
        <div>
          <h2>Cockpit décisionnel</h2>
          <p class="muted">${esc(identityLine)}</p>
        </div>
        <div class="row-actions cockpit-header-actions">
          <button class="action" type="button" onclick="openCockpitQuickCreate('priority')">Nouvelle priorité</button>
          <button class="action" type="button" onclick="openCockpitQuickCreate('action')">Nouvelle action</button>
          <button class="action" type="button" onclick="openCockpitQuickCreate('decision')">Nouvelle décision</button>
        </div>
      </div>
    </div>

    <div class="card cockpit-metrics-row">
      ${cockpitMetricCard("Rendez-vous aujourd'hui", metrics.todayMeetings, "DEOS + Google", "setAgendaFilter('today')")}
      ${cockpitMetricCard("Actions en retard", metrics.overdueActions, "Actions non terminees", "setView('actions')")}
      ${cockpitMetricCard("Decisions a suivre", metrics.decisionsToTrack, "Statuts non appliques", "setView('decisions')")}
      ${cockpitMetricCard("Projets a risque", metrics.riskyProjects, "Risque explicite ou retard", "setView('projects')")}
      ${cockpitMetricCard("Priorites actives", metrics.activePriorities, "Priorites non terminees", "setView('priorities')")}
    </div>

    <div class="cockpit-workspace">
      <div class="card cockpit-today">
        <div class="row"><h2>A traiter aujourd'hui</h2><button class="secondary" type="button" onclick="setView('actions')">Voir toutes les actions</button></div>
        ${todayOperational.map(cockpitOperationalRow).join("") || `<div class="empty">Aucun element operationnel immediat.</div>`}
        <button class="secondary" type="button" onclick="setView('actions')">Voir les autres</button>
      </div>

      <div class="card cockpit-alerts">
        <h2>Alertes et points d'attention</h2>
        ${attentionItems.map(cockpitOperationalRow).join("") || `<div class="empty">Aucune alerte active.</div>`}
      </div>

      <div class="card cockpit-priorities">
        <h2>Priorités du moment</h2>
        ${activePriorities.map(cockpitPriorityRow).join("") || `<div class="empty">Aucune priorité active.</div>`}
        <button class="secondary" type="button" onclick="setView('priorities')">Voir toutes les priorités</button>
      </div>

      <div class="card cockpit-projects-risk">
        <h2>Projets à risque</h2>
        ${projectsAtRisk.map(cockpitProjectRiskRow).join("") || `<div class="empty">Aucun projet à risque.</div>`}
        <button class="secondary" type="button" onclick="setView('projects')">Voir tous les projets</button>
      </div>

      <div class="card cockpit-rightpanel">
        <div class="row"><h2>Agenda</h2><button class="action" type="button" onclick="openAgendaModal()">+ Nouveau rendez-vous</button></div>
        <div class="agenda-filters">
          <button class="secondary ${agendaFilter === "today" ? "active-filter" : ""}" type="button" onclick="setAgendaFilter('today')">Aujourd'hui</button>
          <button class="secondary ${agendaFilter === "tomorrow" ? "active-filter" : ""}" type="button" onclick="setAgendaFilter('tomorrow')">Demain</button>
          <button class="secondary ${agendaFilter === "week" ? "active-filter" : ""}" type="button" onclick="setAgendaFilter('week')">7 jours</button>
          <button class="secondary ${agendaFilter === "all" ? "active-filter" : ""}" type="button" onclick="setAgendaFilter('all')">Tous</button>
        </div>
        <div class="agenda-compact cockpit-agenda-compact">
          <div class="agenda-section">
            <h3>${esc(agendaFilterLabel())}</h3>
            ${agenda.map(cockpitAgendaLine).join("") || `<div class="empty compact-empty">${esc(agendaEmptyLabel())}</div>`}
          </div>
        </div>
      </div>
    </div>
    ${agendaModal()}${meetingSubjectModal()}${externalEventModal()}`);
}

function openCockpitEntity(entity, id) {
  if (entity === "managers") return openManager(id);
  if (entity === "folders") return openFolder(id);
  if (entity === "performance") return openPerformance(id);
  if (entity === "performance_imports") return renderPerformance();
  if (entity === "meetingPreparations") {
    const prep = byId("meetingPreparations", id);
    return prep ? openMeetingPreparation(prep.agendaId) : renderCockpit();
  }
  if (entity === "projects") return openProject(id);
  if (entity === "decisions") return openDecision(id);
  if (entity === "journal") return openJournal(id);
  if (entity === "documents") return setView("documents");
  if (entity === "links") return openLink(id);
  if (entity === "priorities") return setView("priorities");
  if (entity === "actions") return setView("actions");
  if (entity === "agenda") {
    agendaFilter = "all";
    return renderCockpit();
  }
  setView("cockpit");
}

function openCockpitLinked(itemKey, target) {
  const [entity, id] = itemKey.split(":");
  const source = byId(entity, id);
  if (!source) return openCockpitEntity(entity, id);
  if (target === "manager") {
    const manager = source.ownerId ? byId("managers", source.ownerId) : relatedManagerFromText(`${source.owner || ""} ${source.link || ""} ${source.title || ""} ${source.name || ""}`);
    if (manager) return openManager(manager.id);
  }
  const project = relatedProjectFromText(`${source.link || ""} ${source.title || ""} ${source.name || ""}`);
  if (project) return openProject(project.id);
  openCockpitEntity(entity, id);
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
  addActivity("? Action terminée", a.title, a.link || "", a.id);
  renderCockpit();
}

function cockpitPriorityItem(p) {
  return `<div class="item row"><div><strong>${icons[p.level] || "🎯"} ${esc(p.title)}</strong><span class="muted">${esc(p.due || "Pas d'échéance")}${p.link ? " · " + esc(p.link) : ""}${p.owner ? " · " + esc(p.owner) : ""}</span></div><div class="row-actions"><button class="secondary" onclick="completeCockpitPriority('${p.id}')">Terminer</button><button class="secondary" onclick="openLinkedFromPriority('${p.id}')">Ouvrir</button></div></div>`;
}

function cockpitActionItem(a) {
  const due = daysUntil(a.due);
  const label = due === null ? "Critique sans échéance" : due < 0 ? `En retard de ${Math.abs(due)} j` : due === 0 ? "Aujourd'hui" : `Dans ${due} j`;
  return `<div class="item row"><div><strong>${a.done ? "☑️" : "⬜"} ${esc(a.title)}</strong><span class="muted">${esc(label)}${a.link ? " · " + esc(a.link) : ""}</span></div><div class="row-actions"><button class="secondary" onclick="completeCockpitAction('${a.id}')">Terminer</button><button class="secondary" onclick="openCockpitEntity('actions','${a.id}')">Ouvrir</button></div></div>`;
}

function cockpitAlertItem(a) {
  return `<div class="item clickable alert-${esc(a.level)}" onclick="openCockpitEntity('${a.type}','${a.id}')"><strong>${a.level === "red" ? "🔴" : "🟠"} ${esc(a.title)}</strong><span class="muted">${esc(a.detail)}</span><span class="meta">${esc(a.type)}</span></div>`;
}

function cockpitProjectItem(p) {
  return `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${icons[p.status] || "📊"} ${esc(p.name)}</strong><span class="muted">${Number(p.progress || 0)}% · Prochaine étape : ${esc(p.next || "À définir")}</span><span class="meta">Échéance ${esc(p.deadline || "Non définie")} · Responsable ${esc(projectOwnerName(p) || "Non défini")}</span></div>`;
}

function cockpitDecisionItem(d) {
  return `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${d.importance === "red" ? "🔴" : "📌"} ${esc(d.title)}</strong><span class="muted">${esc(decisionStatusLabel(d.status))}${d.reviewDate ? " · Réexamen " + esc(d.reviewDate) : ""}</span></div>`;
}

function cockpitFolderItem(f) {
  const stats = folderStats(f);
  return `<div class="item clickable" onclick="openFolder('${f.id}')"><strong>${f.status === "red" || f.priorityLevel === "red" ? "🔴" : "📁"} ${esc(f.name)}</strong><span class="muted">${esc(f.category)} · ${stats.openActions} action(s) ouverte(s) · ${stats.overdueActions} retard(s)</span><span class="meta">Échéance ${esc(stats.nextDue || f.deadline || "Non définie")}</span></div>`;
}

function openActivityTarget(id) {
  const hit = entities.find(name => name !== "activity" && byId(name, id));
  if (hit) return openCockpitEntity(hit, id);
  setView("activity");
}

function activityDeletedFolderHint(a) {
  if (!a || !a.entityId) return "";
  const hasTarget = entities.some(name => name !== "activity" && byId(name, a.entityId));
  if (hasTarget) return "";
  return /dossier/i.test(String(a.type || "")) ? " · Dossier supprimé" : "";
}

function cockpitActivityItem(a) {
  return `<div class="item ${a.entityId ? "clickable" : ""}" ${a.entityId ? `onclick="openActivityTarget('${a.entityId}')"` : ""}><strong>${esc(a.type)} · ${esc(a.title)}</strong><span class="muted">${esc(a.date || "")}${a.detail ? " · " + esc(a.detail) : ""}</span><span class="meta">ID ${esc(a.id)}${a.entityId ? " ? Entité " + esc(a.entityId) : ""}${esc(activityDeletedFolderHint(a))}</span></div>`;
}

function cockpitKpi(label, value, focus, tone = "") {
  return `<button class="kpi ${tone} ${cockpitFocus === focus ? "active-kpi" : ""}" onclick="setCockpitFocus('${focus}')"><strong>${value}</strong><span>${esc(label)}</span></button>`;
}

function cockpitItemLevel(item) {
  if (item.level === "red") return "red";
  if (item.level === "green") return "green";
  return "orange";
}

function cockpitDashboardItem(item) {
  const level = cockpitItemLevel(item);
  const source = byId(item.entity, item.id);
  const project = item.entity !== "projects" ? relatedProjectFromText(`${item.link || ""} ${item.title || ""}`) : null;
  const manager = item.entity === "projects" && source?.ownerId ? byId("managers", source.ownerId) : relatedManagerFromText(`${item.owner || ""} ${item.link || ""}`);
  const canComplete = item.action === "action" || item.action === "priority";
  return `<div class="item cockpit-item alert-${level}">
    <div>
      <strong><span class="type-pill ${level}">${esc(item.type)}</span> ${esc(item.title)}</strong>
      <span class="muted">${esc(levelLabel(item.level))} · ${esc(dueLabel(item.due))}${item.time ? " · " + esc(item.time) : ""}</span>
      <span class="meta">${item.owner ? "Responsable : " + esc(item.owner) : ""}${item.owner && item.link ? " · " : ""}${item.link ? esc(item.link) : ""}</span>
    </div>
    <div class="row-actions cockpit-actions">
      ${canComplete ? `<button class="secondary" onclick="${item.action === "action" ? "completeCockpitAction" : "completeCockpitPriority"}('${esc(item.id)}')">Terminer</button>` : ""}
      ${manager ? `<button class="secondary" onclick="openManager('${esc(manager.id)}')">Manager</button>` : ""}
      ${project ? `<button class="secondary" onclick="openProject('${esc(project.id)}')">Projet</button>` : ""}
      <button class="secondary" onclick="openCockpitEntity('${esc(item.entity)}','${esc(item.id)}')">Ouvrir</button>
    </div>
  </div>`;
}

function cockpitDeadlineItem(item) {
  return `<div class="deadline-row clickable" onclick="openCockpitEntity('${esc(item.entity)}','${esc(item.id)}')"><strong>${esc(item.due || "Date à préciser")}${item.time ? " · " + esc(item.time) : ""}</strong><span>${esc(item.type)} · ${esc(item.title)}</span><small>${item.owner ? esc(item.owner) : esc(item.link || "")}</small></div>`;
}

function cockpitFocusPanel(items) {
  if (!cockpitFocus) return "";
  return `<div class="card focus-panel"><div class="row"><h2>Vue filtrée</h2><button class="secondary" onclick="setCockpitFocus('${esc(cockpitFocus)}')">Fermer</button></div>${items.map(cockpitDashboardItem).join("") || `<div class="empty">Aucun élément pour cet indicateur.</div>`}</div>`;
}

function cockpitMoreButton(count, focus) {
  return count > 0 ? `<button class="secondary cockpit-more" onclick="setCockpitFocus('${focus}')">Voir les ${count} autres</button>` : "";
}

function cockpitFavoriteLinks() {
  const favorites = state.links.filter(l => l.favorite && l.status !== "archivé").sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const visible = favorites.slice(0, 6);
  const hidden = Math.max(0, favorites.length - visible.length);
  if (!favorites.length) {
    return `<div class="favorite-strip"><span class="empty compact-empty">Aucun favori — ajoutez-en depuis Liens utiles.</span><button class="secondary quick-link" onclick="setView('links')">Voir tous les liens</button></div>`;
  }
  return `<div class="favorite-strip">${visible.map(link => `<button class="secondary quick-link" onclick="openExternalLink('${esc(link.id)}')"><span>${esc(link.icon || "🔗")}</span>${esc(link.name || "Lien")}</button>`).join("")}<button class="secondary quick-link" onclick="setView('links')">${hidden ? `Voir les ${hidden} autres` : "Voir tous les liens"}</button></div>`;
}

function futureMeetings() {
  return state.agenda.filter(a => (a.date || "") >= localIsoDate()).slice().sort(compareAgendaEvents);
}

function cockpitCreateBar() {
  return `<div class="quick-create-bar" aria-label="Créations rapides">
    <button class="secondary" onclick="setView('priorities')">+ Priorité</button>
    <button class="secondary" onclick="setView('actions')">+ Action</button>
    <button class="secondary" onclick="setView('journal')">+ Journal</button>
    <button class="secondary" onclick="setView('decisions')">+ Décision</button>
    <button class="secondary" onclick="setView('documents')">+ Document</button>
    <button class="secondary" onclick="openAgendaModal()">+ Rendez-vous</button>
    <button class="secondary" onclick="openMeetingSubjectModal()">+ Sujet réunion</button>
  </div>`;
}

function agendaItems() {
  // [DEOS STATE TRACE] At agendaItems entry
  console.log("[DEOS STATE TRACE] agendaItems state external events:", state.externalCalendarEvents.length);
  const settings = getCalendarConnectionSettings();
  const todayIso = localIsoDate();
  const tomorrowIso = localIsoAddDays(1);
  const weekIso = localIsoAddDays(7);
  const filter = a => {
    if (agendaFilter === "today") return a.date === todayIso;
    if (agendaFilter === "tomorrow") return a.date === tomorrowIso;
    if (agendaFilter === "week") return a.date >= todayIso && a.date <= weekIso;
    return true;
  };
  const manual = state.agenda.filter(filter);
  // [DEOS AGENDA TRACE] Diagnostic
  console.log("[DEOS AGENDA TRACE] manual events:", manual.length);
  console.log("[DEOS AGENDA TRACE] showInAgenda setting:", settings.showInAgenda);
  console.log("[DEOS AGENDA TRACE] external events stored:", (state.externalCalendarEvents || []).length);
  // [DEOS V5.6.5] DIAGNOSTIC: trace filter steps
  console.log("[DEOS AGENDA TRACE] agendaFilter:", agendaFilter);
  console.log("[DEOS AGENDA TRACE] today:", todayIso);
  console.log("[DEOS AGENDA TRACE] week range:", todayIso, "?", weekIso);
  
  const externalStored = state.externalCalendarEvents || [];
  console.log("[DEOS AGENDA TRACE] Step 1 - external stored total:", externalStored.length);
  
  const externalAfterFilter = externalStored.filter(filter);
  console.log("[DEOS AGENDA TRACE] Step 2 - after date filter:", externalAfterFilter.length);
  
  // [DEOS V5.6.5] DIAGNOSTIC: check for invalid dates
  const withInvalidDate = externalStored.filter(e => !e.date || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if (withInvalidDate.length > 0) {
    console.warn("[DEOS AGENDA TRACE] [WARN] Events with invalid dates:", withInvalidDate.length);
    console.log("[DEOS AGENDA TRACE] Sample invalid:", withInvalidDate.slice(0, 3));
  }
  
  const external = settings.showInAgenda
    ? externalAfterFilter.map(e => ({ ...e, _external: true }))
    : [];
  console.log("[DEOS AGENDA TRACE] Step 3 - external events mapped:", external.length);
  console.log("[DEOS AGENDA TRACE] google events after filter:", external.length);
  const merged = [...manual, ...external];
  console.log("[DEOS AGENDA TRACE] merged events before sort:", merged.length);
  const result = merged.slice().sort(compareAgendaEvents);
  console.log("[DEOS AGENDA TRACE] merged events after sort:", result.length);
  console.log("[DEOS AGENDA TRACE] merged events:", (manual.length + external.length));
  return result;
}

function agendaEmptyLabel() {
  return ({
    today: "Aucun rendez-vous aujourd'hui.",
    tomorrow: "Aucun rendez-vous demain.",
    week: "Aucun rendez-vous dans les 7 prochains jours.",
    all: "Aucun rendez-vous enregistré."
  })[agendaFilter] || "Aucun rendez-vous.";
}

function agendaTodayItems() {
  const settings = getCalendarConnectionSettings();
  const manual = state.agenda.filter(a => a.date === localIsoDate());
  const external = settings.showTodayInCockpit
    ? (state.externalCalendarEvents || []).filter(a => a.date === localIsoDate()).map(e => ({ ...e, _external: true }))
    : [];
  return [...manual, ...external].slice().sort(compareAgendaEvents);
}

function agendaUpcomingItems(limit = 4) {
  return state.agenda.filter(a => (a.date || "") > localIsoDate()).slice().sort(compareAgendaEvents).slice(0, limit);
}

function agendaFilterLabel() {
  return ({ today: "Aujourd'hui", tomorrow: "Demain", week: "7 jours", all: "Tous" })[agendaFilter] || "Aujourd'hui";
}

function setAgendaFilter(filter) {
  agendaFilter = filter;
  renderCockpit();
}

function agendaLinkedNames(a) {
  const managerIds = normalizeLinkedManagerIds(ensureArray(a?.linkedManagerIds).length ? a.linkedManagerIds : ensureArray(a?.linkedManagers));
  const managers = state.managers.filter(m => managerIds.includes(String(m.id))).map(m => m.name);
  const projects = state.projects.filter(p => (a.linkedProjects || []).includes(p.id)).map(p => p.name);
  const folders = state.folders.filter(f => (a.linkedFolders || []).includes(f.id)).map(f => f.name);
  return [...managers, ...projects, ...folders].filter(Boolean).join(" · ");
}

function deosLinkBadge(type, name) {
  const meta = {
    folder: { icon: "📁", label: "Dossier" },
    project: { icon: "📊", label: "Projet" },
    action: { icon: "✅", label: "Action" },
    decision: { icon: "📌", label: "Décision" },
    manager: { icon: "👥", label: "Manager" }
  }[type] || { icon: "🔖", label: "Objet" };
  return `<span class="deos-link-badge deos-link-badge--${type}"><span class="deos-link-badge__icon">${meta.icon}</span><span class="deos-link-badge__type">${meta.label}</span><span class="deos-link-badge__sep">·</span><span class="deos-link-badge__name">${esc(name || "Sans titre")}</span></span>`;
}

function deosLinkBadgesHtml(items) {
  if (!items.length) return `<span class="muted">Aucun objet DEOS lié.</span>`;
  return `<div class="deos-link-badge-list">${items.join("")}</div>`;
}

function agendaLinkedBadges(a) {
  const item = a || {};
  const managerIds = normalizeLinkedManagerIds(ensureArray(item.linkedManagerIds).length ? item.linkedManagerIds : ensureArray(item.linkedManagers));
  const actionIds = normalizeLinkedIdArray([...(item.linkedActionIds || []), ...(item.linkedActions || [])]);
  const decisionIds = normalizeLinkedIdArray([...(item.linkedDecisionIds || []), ...(item.linkedDecisions || [])]);
  const badges = [];
  state.folders.filter(f => ensureArray(item.linkedFolders).includes(f.id)).forEach(f => badges.push(deosLinkBadge("folder", f.name)));
  state.projects.filter(p => ensureArray(item.linkedProjects).includes(p.id)).forEach(p => badges.push(deosLinkBadge("project", p.name)));
  state.managers.filter(m => managerIds.includes(String(m.id))).forEach(m => badges.push(deosLinkBadge("manager", m.name)));
  state.actions.filter(action => actionIds.includes(String(action.id))).forEach(action => badges.push(deosLinkBadge("action", action.title)));
  state.decisions.filter(decision => decisionIds.includes(String(decision.id))).forEach(decision => badges.push(deosLinkBadge("decision", decision.title)));
  return badges.length ? `<div class="deos-link-summary">${deosLinkBadgesHtml(badges)}</div>` : "";
}

function externalEventLinkedBadges(enrichment) {
  const badges = [];
  ensureArray(enrichment.linkedFolderIds).forEach(id => {
    const item = byId("folders", id);
    if (item) badges.push(deosLinkBadge("folder", item.name));
  });
  ensureArray(enrichment.linkedProjectIds).forEach(id => {
    const item = byId("projects", id);
    if (item) badges.push(deosLinkBadge("project", item.name));
  });
  ensureArray(enrichment.linkedActionIds).forEach(id => {
    const item = byId("actions", id);
    if (item) badges.push(deosLinkBadge("action", item.title));
  });
  ensureArray(enrichment.linkedDecisionIds).forEach(id => {
    const item = byId("decisions", id);
    if (item) badges.push(deosLinkBadge("decision", item.title));
  });
  normalizeLinkedManagerIds(ensureArray(enrichment.linkedManagerIds)).forEach(id => {
    const item = byId("managers", id);
    if (item) badges.push(deosLinkBadge("manager", item.name));
  });
  return deosLinkBadgesHtml(badges);
}

function singleLinkedId(ids = []) {
  const normalized = normalizeLinkedIdArray(ids);
  return normalized.length === 1 ? normalized[0] : "";
}

function meetingSourceData(source, meetingRef) {
  if (source === "manual") {
    const meeting = byId("agenda", meetingRef);
    if (!meeting) return null;
    return {
      source,
      meetingRef: String(meeting.id),
      title: String(meeting.title || "Rendez-vous"),
      linkedManagerIds: normalizeLinkedManagerIds(ensureArray(meeting.linkedManagerIds).length ? meeting.linkedManagerIds : ensureArray(meeting.linkedManagers)),
      linkedProjectIds: normalizeLinkedIdArray(ensureArray(meeting.linkedProjects)),
      linkedFolderIds: normalizeLinkedIdArray(ensureArray(meeting.linkedFolders))
    };
  }
  if (source === "google") {
    const eventKey = String(meetingRef || "");
    const event = (state.externalCalendarEvents || []).find(e => String(e._key || "") === eventKey);
    if (!event) return null;
    const enrichment = getExternalEventEnrichment(eventKey);
    return {
      source,
      meetingRef: eventKey,
      title: String(event.title || "Rendez-vous"),
      linkedManagerIds: normalizeLinkedManagerIds(ensureArray(enrichment.linkedManagerIds)),
      linkedProjectIds: normalizeLinkedIdArray(ensureArray(enrichment.linkedProjectIds)),
      linkedFolderIds: normalizeLinkedIdArray(ensureArray(enrichment.linkedFolderIds))
    };
  }
  return null;
}

function meetingCreateStateKey(source, meetingRef) {
  return `${String(source || "")}::${String(meetingRef || "")}`;
}

function activeMeetingCreateState(source, meetingRef) {
  const key = meetingCreateStateKey(source, meetingRef);
  return meetingCreateState && meetingCreateState.key === key ? meetingCreateState : null;
}

function startCreateFromMeeting(source, meetingRef, objectType) {
  const data = meetingSourceData(source, meetingRef);
  if (!data) return;
  const activeModalPanel = document.activeElement?.closest?.(".modal-panel") || document.querySelector(".modal-panel");
  meetingCreateState = {
    key: meetingCreateStateKey(source, meetingRef),
    source,
    meetingRef: String(meetingRef),
    objectType,
    success: "",
    createdObjectType: "",
    createdObjectId: ""
  };
  renderCockpit();
  queueMeetingCreateReveal(source, meetingRef, objectType, {
    modalScrollTop: activeModalPanel ? activeModalPanel.scrollTop : null,
    windowScrollX: window.scrollX,
    windowScrollY: window.scrollY
  });
}

function cancelCreateFromMeeting(source, meetingRef) {
  if (!activeMeetingCreateState(source, meetingRef)) return;
  meetingCreateState = null;
  renderCockpit();
}

function openCreatedObjectFromMeeting(source, meetingRef) {
  const current = activeMeetingCreateState(source, meetingRef);
  if (!current || !current.createdObjectId) return;
  if (current.createdObjectType === "action") {
    openAction(current.createdObjectId);
    return;
  }
  if (current.createdObjectType === "decision") {
    openDecision(current.createdObjectId);
  }
}

function queueMeetingCreateReveal(source, meetingRef, objectType, options = {}) {
  pendingMeetingCreateReveal = {
    key: meetingCreateStateKey(source, meetingRef),
    objectType: String(objectType || ""),
    modalScrollTop: Number.isFinite(options.modalScrollTop) ? options.modalScrollTop : null,
    windowScrollX: Number.isFinite(options.windowScrollX) ? options.windowScrollX : window.scrollX,
    windowScrollY: Number.isFinite(options.windowScrollY) ? options.windowScrollY : window.scrollY
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      revealMeetingCreateForm();
    });
  });
}

function focusMeetingCreateInput(input) {
  if (!input || typeof input.focus !== "function") return;
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

function revealMeetingCreateForm() {
  const pending = pendingMeetingCreateReveal;
  if (!pending) return;
  pendingMeetingCreateReveal = null;

  const section = document.querySelector(`[data-meeting-create-key="${pending.key}"]`);
  if (!section) return;

  const modalPanel = section.closest(".modal-panel");
  if (modalPanel && pending.modalScrollTop !== null) {
    modalPanel.scrollTop = pending.modalScrollTop;
  }
  window.scrollTo(pending.windowScrollX, pending.windowScrollY);

  const form = section.querySelector(`[data-meeting-create-form="${pending.objectType}"]`) || section;
  if (form && typeof form.scrollIntoView === "function") {
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const titleInput = form?.querySelector?.("input[data-meeting-create-title]")
    || form?.querySelector?.("input, textarea, select");
  focusMeetingCreateInput(titleInput);
}

function renderMeetingCreationForm(source, meetingRef, objectType, data) {
  if (objectType === "action") {
    const suggestedOwnerId = singleLinkedId(data.linkedManagerIds);
    const suggestedOwner = suggestedOwnerId ? (byId("managers", suggestedOwnerId)?.name || "") : "";
    const suggestedProjectIds = singleLinkedId(data.linkedProjectIds) ? [singleLinkedId(data.linkedProjectIds)] : [];
    const suggestedFolderIds = singleLinkedId(data.linkedFolderIds) ? [singleLinkedId(data.linkedFolderIds)] : [];
    const suggestedManagerIds = suggestedOwnerId ? [suggestedOwnerId] : [];
    return `<div class="card" data-meeting-create-form="action"><h3>Nouvelle action</h3><p class="muted">Créée depuis le rendez-vous : ${esc(data.title)}</p><div class="form-grid"><input id="meetingCreateActionTitle" data-meeting-create-title="action" placeholder="Titre de l'action (obligatoire)"><input id="meetingCreateActionContext" value="Créée depuis le rendez-vous : ${esc(data.title)}" placeholder="Contexte"><input id="meetingCreateActionDue" type="date"><input id="meetingCreateActionOwner" value="${esc(suggestedOwner)}" placeholder="Responsable"><select id="meetingCreateActionLevel"><option value="green">Normal</option><option value="orange" selected>Important</option><option value="red">Critique</option></select></div><div class="grid three manager-links"><div><label>Managers proposés</label>${checkboxList("meetingCreateActionManagers", state.managers, suggestedManagerIds, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets proposés</label>${checkboxList("meetingCreateActionProjects", state.projects, suggestedProjectIds, p => p.name)}</div><div><label>Dossiers proposés</label>${folderSelect("meetingCreateActionFolders", suggestedFolderIds)}</div></div><div class="modal-actions"><button type="button" class="action" onclick="saveCreateFromMeeting('${esc(source)}','${esc(String(meetingRef))}','action')">Enregistrer</button><button type="button" class="secondary" onclick="cancelCreateFromMeeting('${esc(source)}','${esc(String(meetingRef))}')">Annuler</button></div></div>`;
  }
  const suggestedManagerId = singleLinkedId(data.linkedManagerIds);
  const suggestedOwner = suggestedManagerId ? (byId("managers", suggestedManagerId)?.name || "") : "";
  const suggestedProjectIds = singleLinkedId(data.linkedProjectIds) ? [singleLinkedId(data.linkedProjectIds)] : [];
  const suggestedFolderIds = singleLinkedId(data.linkedFolderIds) ? [singleLinkedId(data.linkedFolderIds)] : [];
  const suggestedManagerIds = suggestedManagerId ? [suggestedManagerId] : [];
  return `<div class="card" data-meeting-create-form="decision"><h3>Nouvelle décision</h3><p class="muted">Créée depuis le rendez-vous : ${esc(data.title)}</p><div class="form-grid"><input id="meetingCreateDecisionTitle" data-meeting-create-title="decision" placeholder="Titre de la décision (obligatoire)"><input id="meetingCreateDecisionContext" value="Créée depuis le rendez-vous : ${esc(data.title)}" placeholder="Contexte"><input id="meetingCreateDecisionDate" type="date" value="${esc(isoToday())}"><input id="meetingCreateDecisionOwner" value="${esc(suggestedOwner)}" placeholder="Responsable"><select id="meetingCreateDecisionStatus"><option value="decided" selected>Décidée</option><option value="applying">En cours d'application</option><option value="review">À réexaminer</option><option value="applied">Appliquée</option></select><select id="meetingCreateDecisionImportance"><option value="green">Normal</option><option value="orange" selected>Important</option><option value="red">Critique</option></select></div><div class="grid three manager-links"><div><label>Managers proposés</label>${checkboxList("meetingCreateDecisionManagers", state.managers, suggestedManagerIds, m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets proposés</label>${checkboxList("meetingCreateDecisionProjects", state.projects, suggestedProjectIds, p => p.name)}</div><div><label>Dossiers proposés</label>${folderSelect("meetingCreateDecisionFolders", suggestedFolderIds)}</div></div><div class="modal-actions"><button type="button" class="action" onclick="saveCreateFromMeeting('${esc(source)}','${esc(String(meetingRef))}','decision')">Enregistrer</button><button type="button" class="secondary" onclick="cancelCreateFromMeeting('${esc(source)}','${esc(String(meetingRef))}')">Annuler</button></div></div>`;
}

function renderCreateFromMeetingSection(source, meetingRef) {
  const data = meetingSourceData(source, meetingRef);
  if (!data) return "";
  const current = activeMeetingCreateState(source, meetingRef);
  const openType = current?.objectType || "";
  const success = current?.success
    ? `<div class="settings-confirm">${esc(current.success)} <button type="button" class="secondary" onclick="openCreatedObjectFromMeeting('${esc(source)}','${esc(String(meetingRef))}')">${current.createdObjectType === "action" ? "Ouvrir l'action" : "Ouvrir la décision"}</button></div>`
    : "";
  return `<div class="card settings-card" data-meeting-create-key="${esc(meetingCreateStateKey(source, meetingRef))}"><h2>Créer depuis ce rendez-vous</h2><div class="row-actions"><button type="button" class="secondary" onclick="startCreateFromMeeting('${esc(source)}','${esc(String(meetingRef))}','action')">+ Nouvelle action</button><button type="button" class="secondary" onclick="startCreateFromMeeting('${esc(source)}','${esc(String(meetingRef))}','decision')">+ Nouvelle décision</button></div>${success}${openType ? renderMeetingCreationForm(source, meetingRef, openType, data) : ""}</div>`;
}

function normalizeMeetingLinkIds(item, id, keyPrimary, keyLegacy) {
  item[keyPrimary] = normalizeLinkedIdArray([...(item[keyPrimary] || []), String(id)]);
  if (Array.isArray(item[keyLegacy])) {
    item[keyLegacy] = normalizeLinkedIdArray(item[keyLegacy]);
  }
}

function rollbackMeetingObjectCreation(snapshot) {
  if (!snapshot) return;
  if (snapshot.actions) {
    state.actions = snapshot.actions;
    try { persist("actions"); } catch {}
  }
  if (snapshot.decisions) {
    state.decisions = snapshot.decisions;
    try { persist("decisions"); } catch {}
  }
  if (snapshot.agendaMeeting && snapshot.agendaMeetingId) {
    const target = byId("agenda", snapshot.agendaMeetingId);
    if (target) Object.assign(target, snapshot.agendaMeeting);
    try { persist("agenda"); } catch {}
  }
  if (snapshot.externalEnrichments) {
    state.externalEventEnrichments = snapshot.externalEnrichments;
    try { persistExternalEvents(); } catch {}
  }
}

function createActionFromMeeting(source, meetingRef, payload) {
  const action = {
    id: newId("action"),
    title: payload.title,
    link: payload.context,
    owner: payload.owner,
    due: payload.due,
    level: payload.level,
    done: false,
    linkedManagers: payload.linkedManagers,
    linkedProjects: payload.linkedProjects,
    linkedFolders: payload.linkedFolders,
    linkedDecisions: []
  };
  const snapshot = {
    actions: state.actions.slice(),
    externalEnrichments: source === "google" ? JSON.parse(JSON.stringify(state.externalEventEnrichments || {})) : null,
    agendaMeetingId: source === "manual" ? String(meetingRef) : "",
    agendaMeeting: null
  };

  if (source === "manual") {
    const meeting = byId("agenda", meetingRef);
    if (!meeting) throw new Error("Rendez-vous introuvable.");
    snapshot.agendaMeeting = JSON.parse(JSON.stringify(meeting));
  }

  try {
    state.actions.unshift(action);
    persist("actions");

    if (source === "manual") {
      const meeting = byId("agenda", meetingRef);
      if (!meeting) throw new Error("Rendez-vous introuvable pendant la liaison.");
      normalizeMeetingLinkIds(meeting, action.id, "linkedActionIds", "linkedActions");
      persist("agenda");
    } else {
      const enrichment = getExternalEventEnrichment(String(meetingRef));
      enrichment.linkedActionIds = normalizeLinkedIdArray([...(enrichment.linkedActionIds || []), String(action.id)]);
      saveExternalEventEnrichment(String(meetingRef), enrichment);
    }

    addActivity("? Action", action.title, `Créée depuis le rendez-vous: ${payload.meetingTitle}`, action.id);
    return action;
  } catch (error) {
    rollbackMeetingObjectCreation(snapshot);
    throw new Error(`Création action annulée: ${error.message || String(error)}`);
  }
}

function createDecisionFromMeeting(source, meetingRef, payload) {
  const decision = {
    id: newId("decision"),
    title: payload.title,
    context: payload.context,
    date: payload.date,
    status: payload.status,
    importance: payload.importance,
    problem: "",
    decision: "",
    rationale: "",
    alternatives: "",
    impacts: "",
    impact: "",
    risks: "",
    owner: payload.owner,
    linkedManagers: payload.linkedManagers,
    linkedProjects: payload.linkedProjects,
    linkedActions: [],
    reviewDate: "",
    linkedDocuments: [],
    events: [],
    directorNotes: [],
    nextStep: "",
    tags: [],
    linkedFolders: payload.linkedFolders
  };
  const snapshot = {
    decisions: state.decisions.slice(),
    externalEnrichments: source === "google" ? JSON.parse(JSON.stringify(state.externalEventEnrichments || {})) : null,
    agendaMeetingId: source === "manual" ? String(meetingRef) : "",
    agendaMeeting: null
  };

  if (source === "manual") {
    const meeting = byId("agenda", meetingRef);
    if (!meeting) throw new Error("Rendez-vous introuvable.");
    snapshot.agendaMeeting = JSON.parse(JSON.stringify(meeting));
  }

  try {
    state.decisions.unshift(decision);
    persist("decisions");

    if (source === "manual") {
      const meeting = byId("agenda", meetingRef);
      if (!meeting) throw new Error("Rendez-vous introuvable pendant la liaison.");
      normalizeMeetingLinkIds(meeting, decision.id, "linkedDecisionIds", "linkedDecisions");
      persist("agenda");
    } else {
      const enrichment = getExternalEventEnrichment(String(meetingRef));
      enrichment.linkedDecisionIds = normalizeLinkedIdArray([...(enrichment.linkedDecisionIds || []), String(decision.id)]);
      saveExternalEventEnrichment(String(meetingRef), enrichment);
    }

    addActivity("📌 Décision", decision.title, `Créée depuis le rendez-vous: ${payload.meetingTitle}`, decision.id);
    return decision;
  } catch (error) {
    rollbackMeetingObjectCreation(snapshot);
    throw new Error(`Création décision annulée: ${error.message || String(error)}`);
  }
}

function saveCreateFromMeeting(source, meetingRef, objectType) {
  const data = meetingSourceData(source, meetingRef);
  if (!data) return;

  try {
    if (objectType === "action") {
      const title = document.getElementById("meetingCreateActionTitle")?.value.trim() || "";
      if (!title) {
        alert("Le titre de l'action est obligatoire.");
        return;
      }
      const created = createActionFromMeeting(source, meetingRef, {
        title,
        context: document.getElementById("meetingCreateActionContext")?.value.trim() || `Créée depuis le rendez-vous : ${data.title}`,
        due: document.getElementById("meetingCreateActionDue")?.value || "",
        owner: document.getElementById("meetingCreateActionOwner")?.value.trim() || "",
        level: document.getElementById("meetingCreateActionLevel")?.value || "orange",
        linkedManagers: normalizeLinkedManagerIds(checkedValues("meetingCreateActionManagers")),
        linkedProjects: normalizeLinkedIdArray(checkedValues("meetingCreateActionProjects")),
        linkedFolders: normalizeLinkedIdArray(checkedValues("meetingCreateActionFolders")),
        meetingTitle: data.title
      });

      meetingCreateState = {
        key: meetingCreateStateKey(source, meetingRef),
        source,
        meetingRef: String(meetingRef),
        objectType: "",
        success: `Action créée avec succès depuis le rendez-vous : ${created.title}`,
        createdObjectType: "action",
        createdObjectId: created.id
      };
      renderCockpit();
      return;
    }

    const title = document.getElementById("meetingCreateDecisionTitle")?.value.trim() || "";
    if (!title) {
      alert("Le titre de la décision est obligatoire.");
      return;
    }
    const created = createDecisionFromMeeting(source, meetingRef, {
      title,
      context: document.getElementById("meetingCreateDecisionContext")?.value.trim() || `Créée depuis le rendez-vous : ${data.title}`,
      date: document.getElementById("meetingCreateDecisionDate")?.value || isoToday(),
      status: document.getElementById("meetingCreateDecisionStatus")?.value || "decided",
      importance: document.getElementById("meetingCreateDecisionImportance")?.value || "orange",
      owner: document.getElementById("meetingCreateDecisionOwner")?.value.trim() || "",
      linkedManagers: normalizeLinkedManagerIds(checkedValues("meetingCreateDecisionManagers")),
      linkedProjects: normalizeLinkedIdArray(checkedValues("meetingCreateDecisionProjects")),
      linkedFolders: normalizeLinkedIdArray(checkedValues("meetingCreateDecisionFolders")),
      meetingTitle: data.title
    });

    meetingCreateState = {
      key: meetingCreateStateKey(source, meetingRef),
      source,
      meetingRef: String(meetingRef),
      objectType: "",
      success: `Décision créée avec succès depuis le rendez-vous : ${created.title}`,
      createdObjectType: "decision",
      createdObjectId: created.id
    };
    renderCockpit();
  } catch (error) {
    console.error(error);
    alert(error.message || "Erreur pendant la création depuis ce rendez-vous.");
  }
}

function agendaItem(a) {
  // Événement externe (Google Calendar) — lecture seule
  if (a._external) {
    const start = agendaStartTime(a);
    const time = a.allDay ? "Journée entière" : (start ? `${esc(start)}${a.endTime ? " - " + esc(a.endTime) : ""}` : "Heure à confirmer");
    const providerBadge = `<span class="gc-badge" title="Importé depuis Google Calendar">🗓️ Google</span>`;
    const enrichment = getExternalEventEnrichment(a._key || `google_${a.externalId}`);
    const confidentiality = meetingConfidentialityBadge(enrichment.confidentiality || "normal");
    return `<div class="agenda-line agenda-line-external"><strong>${time}</strong><span>${a.date !== localIsoDate() ? `<em>${esc(a.date)}</em>` : ""}${esc(a.title)}${providerBadge}<small>${esc(a.calendarName || "Google Calendar")}${a.location ? " · " + esc(a.location) : ""}</small>${confidentiality}</span><div class="row-actions"><button class="secondary" onclick="openExternalEventModal('${esc(a._key || a.externalId)}')">Détails</button></div></div>`;
  }
  // Événement manuel DEOS
  const start = agendaStartTime(a);
  const time = agendaIsAllDay(a) ? "Journée entière" : (start ? `${esc(start)}${a.endTime ? " - " + esc(a.endTime) : ""}` : "Heure à confirmer");
  const links = agendaLinkedNames(a);
  const prep = meetingPrepForAgenda(a.id);
  const status = prep?.status || "À préparer";
  const subjectCount = ensureArray(prep?.ideas).length + ensureArray(prep?.agendaTopics).length;
  const subjectBadge = subjectCount ? ` · <span class="subject-count">🧩 ${subjectCount}</span>` : "";
  const alert = daysUntil(a.date) !== null && daysUntil(a.date) >= 0 && daysUntil(a.date) <= 2 && status === "À préparer" ? `<small class="prep-alert">Réunion à préparer sous 48 h</small>` : "";
  const confidentiality = meetingConfidentialityBadge(a.confidentiality || "normal");
  return `<div class="agenda-line"><strong>${time}</strong><span>${a.date !== localIsoDate() ? `<em>${esc(a.date)}</em>` : ""}${esc(a.title)}<small>${esc(a.type || "Autre")}${a.location ? " · " + esc(a.location) : ""}${links ? " · " + esc(links) : ""} · ${esc(status)}${subjectBadge}</small>${confidentiality}${agendaLinkedBadges(a)}${alert}</span><div class="row-actions"><button class="secondary" onclick="openMeetingSubjectModal('${a.id}')">+ Sujet</button><button class="secondary" onclick="openMeetingPreparation('${a.id}')">Préparer</button><button class="secondary" onclick="editAgenda('${a.id}')">Modifier</button><button class="secondary" onclick="startReport('agenda','${a.id}')">Compte rendu</button><button class="danger" onclick="deleteAgenda('${a.id}')">Supprimer</button></div></div>`;
}

function agendaCompact() {
  const items = agendaItems();
  return `<div class="agenda-compact">
    <div class="agenda-section"><h3>${esc(agendaFilterLabel())}</h3>${items.map(agendaItem).join("") || `<div class="empty compact-empty">${esc(agendaEmptyLabel())}</div>`}</div>
  </div>`;
}

function agendaLinkedList(items) {
  return items.slice().sort(compareAgendaEvents).map(a => {
    const start = agendaStartTime(a);
    const timeLabel = agendaIsAllDay(a) ? "Journée entière" : (start ? start : "Heure à confirmer");
    return `<div class="item clickable" onclick="openMeetingPreparation('${a.id}')"><strong>${esc(a.date || "")} · ${esc(timeLabel)}${a.endTime ? " - " + esc(a.endTime) : ""}</strong><span class="muted">${esc(a.title)} · ${esc(a.type || "Autre")} · ${esc(meetingPrepForAgenda(a.id)?.status || "À préparer")}</span>${a.location ? `<span class="meta">${esc(a.location)}</span>` : ""}</div>`;
  }).join("") || `<div class="empty">Aucun rendez-vous lié.</div>`;
}

function managerAgendaList(m) {
  return renderLinkedMeetingsSection("manager", m.id);
}

function managerMeetingPreparationsList(m) {
  const linked = state.meetingPreparations.filter(p => {
    const agenda = byId("agenda", p.agendaId);
    const agendaManagerIds = normalizeLinkedManagerIds(ensureArray(agenda?.linkedManagerIds).length ? agenda.linkedManagerIds : ensureArray(agenda?.linkedManagers));
    return (p.linkedManagers || []).includes(m.id) || agendaManagerIds.includes(String(m.id));
  });
  return linked.map(p => {
    const a = byId("agenda", p.agendaId) || {};
    const start = agendaStartTime(a);
    const timeLabel = agendaIsAllDay(a) ? "Journée entière" : (start ? start : "Heure à confirmer");
    return `<div class="item clickable" onclick="openMeetingPreparation('${esc(p.agendaId)}')"><strong>${esc(a.date || "")} · ${esc(timeLabel)} · ${esc(a.title || "Réunion")}</strong><span class="muted">${esc(a.type || "Réunion")} · ${esc(p.status || "À préparer")}</span><span class="meta">${esc(p.objectiveMain || a.notes || "")}</span></div>`;
  }).join("") || `<div class="empty">Aucune préparation de réunion liée.</div>`;
}

function projectAgendaList(p) {
  return renderLinkedMeetingsSection("project", p.id);
}

function projectMeetingPreparationsList(project) {
  const linked = state.meetingPreparations.filter(p => (p.linkedProjects || []).includes(project.id) || (byId("agenda", p.agendaId)?.linkedProjects || []).includes(project.id));
  return linked.map(p => {
    const a = byId("agenda", p.agendaId) || {};
    const start = agendaStartTime(a);
    const timeLabel = agendaIsAllDay(a) ? "Journée entière" : (start ? start : "Heure à confirmer");
    return `<div class="item clickable" onclick="openMeetingPreparation('${esc(p.agendaId)}')"><strong>${esc(a.date || "")} · ${esc(timeLabel)} · ${esc(a.title || "Réunion")}</strong><span class="muted">${esc(a.type || "Réunion")} · ${esc(p.status || "À préparer")}</span><span class="meta">${esc(p.objectiveMain || a.notes || "")}</span></div>`;
  }).join("") || `<div class="empty">Aucune préparation de réunion liée.</div>`;
}

function openAgendaModal(id = "") {
  agendaEditId = id;
  agendaModalOpen = true;
  meetingCreateState = null;
  const selected = id ? byId("agenda", id) : null;
  console.log("[DEOS MANAGER DEBUG] manual open modal managers list", state.managers.map(m => ({ id: m.id, idType: typeof m.id, name: m.name })));
  console.log("[DEOS MANAGER DEBUG] manual open modal event manager ids", normalizeLinkedManagerIds(ensureArray(selected?.linkedManagerIds).length ? selected.linkedManagerIds : ensureArray(selected?.linkedManagers)));
  renderCockpit();
  toggleAgendaTimeFields();
  renderAgendaFormSelectedBadges();
}

function closeAgendaModal() {
  agendaEditId = "";
  agendaModalOpen = false;
  agendaFormError = "";
  meetingCreateState = null;
  if (restoreMeetingOriginContext()) return;
  renderCockpit();
}

function agendaForm() {
  const a = agendaEditId ? byId("agenda", agendaEditId) : null;
  const followUp = normalizeMeetingEnrichment(a || {});
  const selectedManagerIds = normalizeLinkedManagerIds(ensureArray(a?.linkedManagerIds).length ? a.linkedManagerIds : ensureArray(a?.linkedManagers));
  const dateValue = esc(a?.date || localIsoDate());
  const allDayChecked = agendaIsAllDay(a) ? "checked" : "";
  const startValue = esc(a?.startTime || a?.time || "");
  const endValue = esc(a?.endTime || "");
  return `<div class="agenda-form">${agendaFormError ? `<div class="form-error">${esc(agendaFormError)}</div>` : ""}
    <div class="form-grid">
      <input id="agDate" type="date" value="${dateValue}">
      <label class="check-row"><input id="agAllDay" type="checkbox" ${allDayChecked} onchange="toggleAgendaTimeFields()"> Journée entière</label>
      <div class="time-row"><input id="agStart" type="time" value="${startValue}"><input id="agEnd" type="time" value="${endValue}"></div>
      <input id="agTitle" value="${esc(a?.title || "")}" placeholder="Titre">
      <select id="agType"><option ${(!a || a.type === "CODIR") ? "selected" : ""}>CODIR</option><option ${a?.type === "Exploitation" ? "selected" : ""}>Exploitation</option><option ${a?.type === "RH" ? "selected" : ""}>RH</option><option ${a?.type === "Projet" ? "selected" : ""}>Projet</option><option ${a?.type === "CSE" ? "selected" : ""}>CSE</option><option ${a?.type === "Entretien manager" ? "selected" : ""}>Entretien manager</option><option ${a?.type === "Autre" ? "selected" : ""}>Autre</option></select>
      <input id="agLocation" value="${esc(a?.location || "")}" placeholder="Lieu">
      <textarea id="agNotes" class="full" placeholder="Notes">${esc(a?.notes || a?.detail || "")}</textarea>
    </div>
    <div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("agManagers", state.managers, selectedManagerIds, m => `${m.name} ? ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("agProjects", state.projects, a?.linkedProjects || [], p => p.name)}</div><div><label>Dossiers liés</label>${folderSelect("agFolders", a?.linkedFolders || [])}</div></div>
    <div class="deos-link-summary"><strong>Objets DEOS sélectionnés</strong><div id="agLinkedSummary">${deosLinkBadgesHtml([])}</div></div>
    <div class="card" style="margin:10px 0 0 0;padding:14px;border-radius:14px">
      <h3 style="margin:0 0 10px 0">Suivi du rendez-vous</h3>
      <p class="muted" style="margin:0 0 10px 0">Ces informations sont enregistrées uniquement dans DEOS.</p>
      <div class="form-grid">
        <textarea id="agPreparation" class="full" placeholder="Préparation : points à préparer, documents, questions...">${esc(followUp.preparation)}</textarea>
        <textarea id="agMeetingNotes" class="full" placeholder="Notes : éléments factuels, constats, informations importantes...">${esc(followUp.meetingNotes)}</textarea>
        <textarea id="agMeetingReport" class="full" placeholder="Compte rendu : synthèse, conclusions, éléments à partager...">${esc(followUp.meetingReport)}</textarea>
        <textarea id="agNextSteps" class="full" placeholder="Prochaines étapes : suites à donner, échéances, relances...">${esc(followUp.nextSteps)}</textarea>
        <div class="full">
          <label for="agConfidentiality">Confidentialité</label>
          <select id="agConfidentiality">
            <option value="normal" ${followUp.confidentiality === "normal" ? "selected" : ""}>Normal</option>
            <option value="restricted" ${followUp.confidentiality === "restricted" ? "selected" : ""}>Restreint</option>
            <option value="confidential" ${followUp.confidentiality === "confidential" ? "selected" : ""}>Confidentiel</option>
          </select>
        </div>
      </div>
      ${a ? meetingFollowUpSummaryHtml(followUp) : ""}
    </div>
    ${a ? renderCreateFromMeetingSection("manual", String(a.id)) : ""}
    <div class="modal-actions"><button class="action" onclick="${a ? "saveAgenda()" : "addAgenda()"}">Enregistrer</button>${a ? `<button class="secondary" onclick="openMeetingPreparation('${a.id}')">Préparer la réunion</button>` : ""}<button class="secondary" onclick="cancelAgendaEdit()">Annuler</button></div>
  </div>`;
}

function agendaFormSelectedBadgeItems() {
  const folders = state.folders.filter(f => checkedValues("agFolders").includes(f.id)).map(f => deosLinkBadge("folder", f.name));
  const projects = state.projects.filter(p => checkedValues("agProjects").includes(p.id)).map(p => deosLinkBadge("project", p.name));
  const selectedManagerIds = normalizeLinkedManagerIds(checkedValues("agManagers"));
  const managers = state.managers.filter(m => selectedManagerIds.includes(String(m.id))).map(m => deosLinkBadge("manager", m.name));
  return [...folders, ...projects, ...managers];
}

function renderAgendaFormSelectedBadges() {
  const root = document.getElementById("agLinkedSummary");
  if (!root) return;
  root.innerHTML = deosLinkBadgesHtml(agendaFormSelectedBadgeItems());
}

function onAgendaFormSelectionChange(event) {
  if (!agendaModalOpen) return;
  const checkList = event.target?.closest?.("#agManagers, #agProjects, #agFolders");
  if (checkList) renderAgendaFormSelectedBadges();
}

function agendaModal() {
  if (!agendaModalOpen) return "";
  const isEdit = Boolean(agendaEditId);
  return `<div class="modal-backdrop" onclick="closeAgendaModal()"><div class="modal-panel" onclick="event.stopPropagation()"><div class="modal-head"><h2>${isEdit ? "Modifier rendez-vous" : "Nouveau rendez-vous"}</h2><button class="icon-close" onclick="closeAgendaModal()" aria-label="Fermer">×</button></div>${agendaForm()}</div></div>`;
}

function openExternalEventModal(eventRef) {
  const event = (state.externalCalendarEvents || []).find(e => e._key === eventRef || e.externalId === eventRef);
  googleExternalEventModalId = event?._key || eventRef || "";
  meetingCreateState = null;
  const enrichment = getExternalEventEnrichment(googleExternalEventModalId);
  console.log("[DEOS MANAGER DEBUG] google open modal managers list", state.managers.map(m => ({ id: m.id, idType: typeof m.id, name: m.name })));
  console.log("[DEOS MANAGER DEBUG] google open modal linkedManagerIds before render", normalizeLinkedManagerIds(ensureArray(enrichment.linkedManagerIds)));
  renderCockpit();
}

function closeExternalEventModal() {
  googleExternalEventModalId = "";
  meetingCreateState = null;
  if (restoreMeetingOriginContext()) return;
  renderCockpit();
}

function externalEventModal() {
  if (!googleExternalEventModalId) return "";
  const ev = (state.externalCalendarEvents || []).find(e => e._key === googleExternalEventModalId);
  if (!ev) return "";
  const enrichment = getExternalEventEnrichment(googleExternalEventModalId);
  const time = ev.allDay ? "Journée entière" : `${esc(ev.startTime || "")}${ev.endTime ? " - " + esc(ev.endTime) : ""}`;
  
  // Zone Google Calendar (lecture seule)
  const googleSection = `<div style="border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:16px">
    <h3 style="margin:0 0 12px 0;color:#1e293b">🗓️ Informations Google Calendar</h3>
    <p class="muted" style="margin:0 0 12px 0;font-size:12px">Lecture seule — importé depuis Google Calendar</p>
    <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:14px">
      <span style="color:#64748b;font-weight:500">Titre</span><span style="font-weight:500">${esc(ev.title)}</span>
      <span style="color:#64748b">Date</span><span>${esc(ev.date)}</span>
      <span style="color:#64748b">Heure</span><span>${time}</span>
      ${ev.location ? `<span style="color:#64748b">Lieu</span><span>${esc(ev.location)}</span>` : ""}
      <span style="color:#64748b">Calendrier</span><span>${esc(ev.calendarName || "Google Calendar")}</span>
      <span style="color:#64748b">Statut</span><span>${esc(ev.status || "confirmé")}</span>
    </div>
    ${ev.description ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:12px;color:#475569;white-space:pre-wrap;margin-top:10px">
      <span style="color:#64748b;font-size:11px">Description Google</span><br>${esc(ev.description)}
    </div>` : ""}
  </div>`;
  
  // Zone Suivi DEOS (modifiable)
  const externalFollowUp = normalizeMeetingEnrichment(enrichment, { external: true });
  
  const deosSectionHTML = `<div>
    <h3 style="margin:0 0 12px 0;color:#1e293b">🧭 Suivi du rendez-vous</h3>
    <p class="muted" style="margin:0 0 10px 0;font-size:12px">Ces informations sont enregistrées uniquement dans DEOS et ne modifient pas Google Calendar.</p>
    
    <div style="display:grid;gap:12px">
      <!-- Sujets à traiter -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:12px;color:#64748b;font-weight:500">Sujets à traiter</label>
          <button class="icon-btn" onclick="addExternalEventSubject('${esc(googleExternalEventModalId)}')" title="Ajouter un sujet" style="padding:4px 8px;font-size:11px">+ Ajouter</button>
        </div>
        <div id="subjectsList" style="display:grid;gap:6px;max-height:120px;overflow-y:auto">
          ${enrichment.subjects && enrichment.subjects.length > 0 ? enrichment.subjects.map((s, idx) => `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px;font-size:13px;display:flex;gap:8px;align-items:center">
            <input type="checkbox" ${s.completed ? "checked" : ""} onchange="updateExternalEventSubject('${esc(googleExternalEventModalId)}', '${esc(s.id)}', '${esc(s.title)}', '', this.checked)" style="cursor:pointer">
            <span style="${s.completed ? "text-decoration:line-through;color:#94a3b8" : ""}">${esc(s.title)}</span>
            <button class="icon-btn" onclick="deleteExternalEventSubject('${esc(googleExternalEventModalId)}', '${esc(s.id)}')" style="padding:2px 6px;font-size:11px;margin-left:auto">?</button>
          </div>`).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucun sujet pour le moment</p>"}
        </div>
      </div>
      
      <!-- Préparation -->
      <div>
        <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:500">Préparation</label>
        <textarea id="enrichPreparation" placeholder="Points à préparer, documents à réunir, questions à poser..." style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;min-height:80px;font-size:13px;font-family:inherit;resize:vertical">${esc(externalFollowUp.preparation)}</textarea>
      </div>
      
      <!-- Notes -->
      <div>
        <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:500">Notes</label>
        <textarea id="enrichMeetingNotes" placeholder="Notes prises pendant le rendez-vous, constats, informations importantes..." style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;min-height:80px;font-size:13px;font-family:inherit;resize:vertical">${esc(externalFollowUp.meetingNotes)}</textarea>
      </div>
      
      <!-- Compte rendu -->
      <div>
        <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:500">Compte rendu</label>
        <textarea id="enrichMeetingReport" placeholder="Synthèse structurée, conclusions, éléments à partager..." style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;min-height:80px;font-size:13px;font-family:inherit;resize:vertical">${esc(externalFollowUp.meetingReport)}</textarea>
      </div>

      <!-- Prochaines étapes -->
      <div>
        <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:500">Prochaines étapes</label>
        <textarea id="enrichNextSteps" placeholder="Suites à donner, échéances, relances..." style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;min-height:80px;font-size:13px;font-family:inherit;resize:vertical">${esc(externalFollowUp.nextSteps)}</textarea>
      </div>

      <!-- Confidentialité -->
      <div>
        <label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:500">Confidentialité</label>
        <select id="enrichConfidentiality" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px;width:100%;font-size:14px">
          <option value="normal" ${externalFollowUp.confidentiality === "normal" ? "selected" : ""}>Normal</option>
          <option value="restricted" ${externalFollowUp.confidentiality === "restricted" ? "selected" : ""}>Restreint</option>
          <option value="confidential" ${externalFollowUp.confidentiality === "confidential" ? "selected" : ""}>Confidentiel</option>
        </select>
        ${meetingFollowUpSummaryHtml(externalFollowUp)}
      </div>
      
      <!-- Liens utiles -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:12px;color:#64748b;font-weight:500">Liens utiles</label>
          <button class="icon-btn" onclick="addExternalEventLink('${esc(googleExternalEventModalId)}')" title="Ajouter un lien" style="padding:4px 8px;font-size:11px">+ Lien</button>
        </div>
        <div id="linksList" style="display:grid;gap:6px;max-height:100px;overflow-y:auto">
          ${enrichment.links && enrichment.links.length > 0 ? enrichment.links.map(l => `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:center;overflow:hidden">
            <a href="${esc(l.url)}" target="_blank" style="color:#0284c7;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(l.url)}">${esc(l.name || l.url)}</a>
            <button class="icon-btn" onclick="deleteExternalEventLink('${esc(googleExternalEventModalId)}', '${esc(l.id)}')" style="padding:2px 6px;font-size:11px">?</button>
          </div>`).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucun lien pour le moment</p>"}
        </div>
      </div>
      
      <!-- Actions liées -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:12px;color:#64748b;font-weight:500">Actions liées</label>
        </div>
        <div id="actionsList" style="display:grid;gap:6px;max-height:100px;overflow-y:auto">
          ${enrichment.linkedActionIds && enrichment.linkedActionIds.length > 0 ? enrichment.linkedActionIds.map(actionId => {
            const action = byId("actions", actionId);
            return action ? `<div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:6px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:center;overflow:hidden">
              <a href="javascript:openActionModal('${esc(actionId)}')" style="color:#059669;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(action.title)}</a>
              <button class="icon-btn" onclick="unlinkActionFromExternalEvent('${esc(googleExternalEventModalId)}', '${esc(actionId)}')" style="padding:2px 6px;font-size:11px">?</button>
            </div>` : "";
          }).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucune action liée</p>"}
        </div>
      </div>
      
      <!-- Décisions liées -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:12px;color:#64748b;font-weight:500">Décisions liées</label>
        </div>
        <div id="decisionsList" style="display:grid;gap:6px;max-height:100px;overflow-y:auto">
          ${enrichment.linkedDecisionIds && enrichment.linkedDecisionIds.length > 0 ? enrichment.linkedDecisionIds.map(decisionId => {
            const decision = byId("decisions", decisionId);
            return decision ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:center;overflow:hidden">
              <a href="javascript:openDecisionModal('${esc(decisionId)}')" style="color:#b45309;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(decision.title)}</a>
              <button class="icon-btn" onclick="unlinkDecisionFromExternalEvent('${esc(googleExternalEventModalId)}', '${esc(decisionId)}')" style="padding:2px 6px;font-size:11px">?</button>
            </div>` : "";
          }).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucune décision liée</p>"}
        </div>
      </div>
      
      <!-- Dossiers liés (V5.8) -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-top:12px;border-top:1px solid #e2e8f0">
          <label style="font-size:12px;color:#64748b;font-weight:500">🔗 Éléments DEOS liés</label>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:12px">Reliez ce rendez-vous aux dossiers, projets, actions, décisions et managers concernés.</div>
        <div class="deos-link-summary"><strong>Objets DEOS liés</strong>${externalEventLinkedBadges(enrichment)}</div>
        
        <!-- Dossiers -->
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="font-size:12px;color:#64748b;font-weight:500">📁 Dossiers</label>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <select id="folderSelect" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;flex:1;font-size:13px">
              <option value="">Sélectionner un dossier...</option>
              ${state.folders.filter(f => !normalizeLinkedIdArray(enrichment.linkedFolderIds).includes(String(f.id))).map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}
            </select>
            <button class="icon-btn" type="button" onclick="linkObjectToExternalEvent('folder', document.getElementById('folderSelect').value)" style="padding:6px 12px;font-size:12px;white-space:nowrap">Ajouter</button>
          </div>
          <div style="display:grid;gap:6px">
            ${enrichment.linkedFolderIds && enrichment.linkedFolderIds.length > 0 ? enrichment.linkedFolderIds.map(folderId => {
              const folder = byId("folders", folderId);
              return folder ? `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:center;overflow:hidden">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(folder.name)}</span>
                <button class="icon-btn" type="button" onclick="unlinkObjectFromExternalEvent('folder', '${esc(folderId)}')" style="padding:2px 6px;font-size:14px;line-height:1">×</button>
              </div>` : "";
            }).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucun dossier lié</p>"}
          </div>
        </div>
        
        <!-- Projets -->
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="font-size:12px;color:#64748b;font-weight:500">📊 Projets</label>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <select id="projectSelect" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;flex:1;font-size:13px">
              <option value="">Sélectionner un projet...</option>
              ${state.projects.filter(p => !normalizeLinkedIdArray(enrichment.linkedProjectIds).includes(String(p.id))).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}
            </select>
            <button class="icon-btn" type="button" onclick="linkObjectToExternalEvent('project', document.getElementById('projectSelect').value)" style="padding:6px 12px;font-size:12px;white-space:nowrap">Ajouter</button>
          </div>
          <div style="display:grid;gap:6px">
            ${enrichment.linkedProjectIds && enrichment.linkedProjectIds.length > 0 ? enrichment.linkedProjectIds.map(projectId => {
              const project = byId("projects", projectId);
              return project ? `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:center;overflow:hidden">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(project.name)}</span>
                <button class="icon-btn" type="button" onclick="unlinkObjectFromExternalEvent('project', '${esc(projectId)}')" style="padding:2px 6px;font-size:14px;line-height:1">×</button>
              </div>` : "";
            }).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucun projet lié</p>"}
          </div>
        </div>
        
        <!-- Managers -->
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="font-size:12px;color:#64748b;font-weight:500">👥 Managers</label>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <select id="managerSelect" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;flex:1;font-size:13px">
              <option value="">Sélectionner un manager...</option>
              ${state.managers.filter(m => !normalizeLinkedManagerIds(ensureArray(enrichment.linkedManagerIds)).includes(String(m.id))).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}
            </select>
            <button class="icon-btn" type="button" onclick="linkObjectToExternalEvent('manager', document.getElementById('managerSelect').value)" style="padding:6px 12px;font-size:12px;white-space:nowrap">Ajouter</button>
          </div>
          <div style="display:grid;gap:6px">
            ${enrichment.linkedManagerIds && enrichment.linkedManagerIds.length > 0 ? enrichment.linkedManagerIds.map(managerId => {
              const manager = byId("managers", managerId);
              return manager ? `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px;font-size:12px;display:flex;gap:8px;align-items:center;overflow:hidden">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(manager.name)}</span>
                <button class="icon-btn" type="button" onclick="unlinkObjectFromExternalEvent('manager', '${esc(managerId)}')" style="padding:2px 6px;font-size:14px;line-height:1">×</button>
              </div>` : "";
            }).join("") : "<p style=\"color:#94a3b8;font-size:12px;margin:0\">Aucun manager lié</p>"}
          </div>
        </div>
      </div>
    </div>
  </div>`;
  
  return `<div class="modal-backdrop" onclick="closeExternalEventModal()"><div class="modal-panel" style="max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">
    <div class="modal-head" style="position:sticky;top:0;background:#fff;z-index:10;border-bottom:1px solid #e2e8f0;padding-bottom:12px">
      <h2 style="margin:0">🗓️ Rendez-vous Google Calendar</h2>
      <button class="icon-close" onclick="closeExternalEventModal()" aria-label="Fermer">×</button>
    </div>
    <div style="padding:16px;display:grid;gap:16px">
      ${googleSection}
      ${enrichment.sourceUnavailable ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px;font-size:13px;color:#991b1b">
        ℹ️ L'événement Google d'origine n'est plus disponible. Vos enrichissements locaux sont conservés.
      </div>` : ""}
      ${deosSectionHTML}
      ${renderCreateFromMeetingSection("google", String(googleExternalEventModalId))}
      <div class="modal-actions" style="position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e8f0;padding-top:12px">
        <button class="action" onclick="saveExternalEventEnrichmentFromModal('${esc(googleExternalEventModalId)}')">Enregistrer</button>
        <button class="secondary" onclick="closeExternalEventModal()">Fermer</button>
      </div>
    </div>
  </div></div>`;
}

function openMeetingSubjectModal(agendaId = "") {
  meetingSubjectModalAgendaId = agendaId;
  renderCockpit();
}

function closeMeetingSubjectModal() {
  meetingSubjectModalAgendaId = null;
  renderCockpit();
}

function meetingSubjectModal() {
  if (meetingSubjectModalAgendaId === null) return "";
  if (meetingSubjectModalAgendaId === "") {
    const meetings = futureMeetings();
    return `<div class="modal-backdrop" onclick="closeMeetingSubjectModal()"><div class="modal-panel subject-modal" onclick="event.stopPropagation()"><div class="modal-head"><h2>Ajouter un sujet de réunion</h2><button class="icon-close" onclick="closeMeetingSubjectModal()" aria-label="Fermer">×</button></div>${meetings.length ? meetingSubjectForm(meetings[0].id, true) : `<div class="empty">Aucune réunion future disponible. Créez d'abord un rendez-vous dans l'agenda.</div><button class="secondary" onclick="closeMeetingSubjectModal()">Fermer</button>`}</div></div>`;
  }
  return `<div class="modal-backdrop" onclick="closeMeetingSubjectModal()"><div class="modal-panel subject-modal" onclick="event.stopPropagation()"><div class="modal-head"><h2>Ajouter un sujet de réunion</h2><button class="icon-close" onclick="closeMeetingSubjectModal()" aria-label="Fermer">×</button></div>${meetingSubjectForm(meetingSubjectModalAgendaId, false)}</div></div>`;
}

function meetingSubjectForm(selectedAgendaId = "", showMeetingSelect = false) {
  const meetings = futureMeetings();
  const selected = byId("agenda", selectedAgendaId) || meetings[0] || {};
  return `<div class="form-grid"><textarea id="msText" class="full" placeholder="Sujet, question ou point à aborder"></textarea>${showMeetingSelect ? `<select id="msAgenda" class="full">${meetings.map(a => `<option value="${esc(a.id)}" ${selected.id === a.id ? "selected" : ""}>${esc(a.date || "")} · ${esc(agendaStartTime(a) || (agendaIsAllDay(a) ? 'Journée entière' : 'Heure à confirmer'))} · ${esc(a.title || "Réunion")}</option>`).join("")}</select>` : `<input class="full" value="${esc(`${selected.date || ""} · ${agendaStartTime(selected) || (agendaIsAllDay(selected) ? 'Journée entière' : 'Heure à confirmer')} · ${selected.title || "Réunion"}`)}" disabled>`}<select id="msCategory"><option>Sujet</option><option>Question</option><option>Information</option><option>Décision attendue</option><option>Point de vigilance</option></select><select id="msImportance"><option>normale</option><option>importante</option><option>critique</option></select></div><div class="modal-actions"><button class="action" onclick="saveMeetingSubjectQuick()">Enregistrer</button><button class="secondary" onclick="closeMeetingSubjectModal()">Annuler</button></div>`;
}

function saveMeetingSubjectQuick() {
  const agendaId = document.getElementById("msAgenda")?.value || meetingSubjectModalAgendaId;
  const text = document.getElementById("msText")?.value.trim();
  const a = byId("agenda", agendaId);
  if (!a || !text) return;
  const p = ensureMeetingPreparation(agendaId);
  p.ideas.push({ id: newId("idea"), text, createdAt: new Date().toLocaleString("fr-FR"), author: identityName(), category: document.getElementById("msCategory")?.value || "Sujet", importance: document.getElementById("msImportance")?.value || "normale", confidentiality: "partageable", status: "À traiter", conclusion: "" });
  p.status = p.status === "À préparer" ? "Préparation en cours" : p.status;
  persist("meetingPreparations");
  addActivity("🗓️ Sujet réunion", a.title, text, p.id);
  meetingSubjectModalAgendaId = null;
  renderCockpit();
}

function readAgendaForm(existing = {}) {
  agendaFormError = "";
  const title = document.getElementById("agTitle").value.trim();
  const date = document.getElementById("agDate").value || "";
  const allDay = document.getElementById("agAllDay")?.checked || false;
  const start = document.getElementById("agStart").value.trim();
  const end = document.getElementById("agEnd").value.trim();
  if (!date) {
    agendaFormError = "La date est obligatoire.";
    renderCockpit();
    return null;
  }
  if (!title) {
    agendaFormError = "Le titre est obligatoire.";
    renderCockpit();
    return null;
  }
  if (end && !start) {
    agendaFormError = "Heure de fin sans heure de début impossible.";
    renderCockpit();
    return null;
  }
  if (start && end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (Number.isFinite(sh) && Number.isFinite(eh)) {
      const smins = sh * 60 + (Number.isFinite(sm) ? sm : 0);
      const emins = eh * 60 + (Number.isFinite(em) ? em : 0);
      if (emins < smins) {
        agendaFormError = "L'heure de fin ne peut pas être antérieure à l'heure de début.";
        renderCockpit();
        return null;
      }
    }
  }
  const linkedManagerIds = normalizeLinkedManagerIds(checkedValues("agManagers"));
  const followUp = normalizeMeetingEnrichment({
    preparation: document.getElementById("agPreparation")?.value,
    meetingNotes: document.getElementById("agMeetingNotes")?.value,
    meetingReport: document.getElementById("agMeetingReport")?.value,
    nextSteps: document.getElementById("agNextSteps")?.value,
    confidentiality: document.getElementById("agConfidentiality")?.value
  });
  console.log("[DEOS MANAGER DEBUG] manual selected manager ids before save", linkedManagerIds, linkedManagerIds.map(id => typeof id));
  console.log("[DEOS MANAGER DEBUG] manual event object before save", existing);
  const data = {
    ...existing,
    date: date || localIsoDate(),
    startTime: allDay ? "" : (start || ""),
    time: allDay ? "" : (start || ""),
    endTime: allDay ? "" : (end || ""),
    title,
    type: document.getElementById("agType").value,
    location: document.getElementById("agLocation").value.trim(),
    notes: document.getElementById("agNotes").value.trim(),
    detail: document.getElementById("agNotes").value.trim(),
    allDay,
    linkedManagerIds,
    linkedManagers: linkedManagerIds,
    linkedProjects: checkedValues("agProjects"),
    linkedFolders: checkedValues("agFolders"),
    preparation: followUp.preparation,
    meetingNotes: followUp.meetingNotes,
    meetingReport: followUp.meetingReport,
    nextSteps: followUp.nextSteps,
    confidentiality: followUp.confidentiality
  };
  console.log("[DEOS MANAGER DEBUG] manual event payload to save", data);
  agendaFormError = "";
  return data;
}

function addAgenda() {
  const data = readAgendaForm({ id: newId("agenda"), createdAt: localIsoDate(), source: "manual", externalId: "", calendarId: "", syncStatus: "local", lastSyncedAt: "" });
  if (!data) return;
  state.agenda.push(data);
  console.log("[DEOS MANAGER DEBUG] manual stored new event", data);
  persist("agenda");
  ensureMeetingPreparation(data.id);
  addActivity("📅 Agenda", data.title, `${data.date} ${agendaStartTime(data)}`, data.id);
  agendaFilter = data.date === localIsoDate() ? "today" : agendaFilter;
  agendaModalOpen = false;
  agendaEditId = "";
  renderCockpit();
}

function editAgenda(id) {
  openAgendaModal(id);
}

function saveAgenda() {
  const a = byId("agenda", agendaEditId);
  if (!a) return;
  const data = readAgendaForm(a);
  if (!data) return;
  Object.assign(a, data);
  console.log("[DEOS MANAGER DEBUG] manual stored updated event", a);
  a.updatedAt = localIsoDate();
  persist("agenda");
  syncMeetingPreparationLinks(a.id);
  addActivity("📅 Agenda modifié", a.title, `${a.date} ${a.startTime}`, a.id);
  agendaEditId = "";
  agendaModalOpen = false;
  if (restoreMeetingOriginContext()) return;
  renderCockpit();
}

function cancelAgendaEdit() {
  closeAgendaModal();
}

function deleteAgenda(id) {
  const i = indexById("agenda", id);
  if (i < 0 || !confirm("Supprimer ce rendez-vous ?")) return;
  const title = state.agenda[i].title;
  state.meetingPreparations = state.meetingPreparations.filter(p => p.agendaId !== id);
  state.agenda.splice(i, 1);
  persist("agenda");
  persist("meetingPreparations");
  addActivity("🗑️ Agenda supprimé", title);
  renderCockpit();
}

const meetingPrepStatuses = ["À préparer", "Préparation en cours", "Prête", "Réalisée", "Compte rendu à finaliser", "Clôturée"];
const meetingPrepTemplates = ["CODIR", "Réunion d'exploitation", "Revue de performance", "Point RH", "Entretien Manager", "Point Projet", "Gemba", "CSE / Dialogue social", "Réunion libre"];

function meetingPrepForAgenda(agendaId) {
  return state.meetingPreparations.find(p => p.agendaId === agendaId);
}

function syncMeetingPreparationLinks(agendaId) {
  const a = byId("agenda", agendaId);
  const p = meetingPrepForAgenda(agendaId);
  if (!a || !p) return;
  const agendaManagerIds = normalizeLinkedManagerIds(ensureArray(a.linkedManagerIds).length ? a.linkedManagerIds : ensureArray(a.linkedManagers));
  p.linkedManagers = [...new Set([...(p.linkedManagers || []), ...agendaManagerIds])];
  p.linkedProjects = [...new Set([...(p.linkedProjects || []), ...(a.linkedProjects || [])])];
  p.linkedFolders = [...new Set([...(p.linkedFolders || []), ...(a.linkedFolders || [])])];
  persist("meetingPreparations");
}

function ensureMeetingPreparation(agendaId) {
  const a = byId("agenda", agendaId);
  if (!a) return null;
  const agendaManagerIds = normalizeLinkedManagerIds(ensureArray(a.linkedManagerIds).length ? a.linkedManagerIds : ensureArray(a.linkedManagers));
  let p = meetingPrepForAgenda(agendaId);
  if (!p) {
    p = normalizeMeetingPreparation({
      id: newId("meetingPreparation"),
      agendaId,
      status: "À préparer",
      template: a.type || "",
      linkedManagers: agendaManagerIds,
      linkedProjects: a.linkedProjects || [],
      linkedFolders: a.linkedFolders || []
    });
    state.meetingPreparations.unshift(p);
    persist("meetingPreparations");
    addActivity("Préparation réunion", a.title, "Créée depuis Agenda", p.id);
  } else {
    syncMeetingPreparationLinks(agendaId);
  }
  return p;
}

function prepStatusSelect(id, selected) {
  return `<select id="${id}">${meetingPrepStatuses.map(s => `<option value="${esc(s)}" ${selected === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`;
}

function prepDaysLabel(a) {
  const d = daysUntil(a.date);
  if (d === null) return "Date à préciser";
  if (d < 0) return `Réunion passée depuis ${Math.abs(d)} j`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `Dans ${d} j`;
}

function prepAgendaDuration(p, a) {
  const minutes = (p.agendaTopics || []).reduce((sum, t) => sum + Number(t.duration || 0), 0);
  let available = 0;
  if (a.startTime && a.endTime) {
    const [sh, sm] = a.startTime.split(":").map(Number);
    const [eh, em] = a.endTime.split(":").map(Number);
    available = (eh * 60 + em) - (sh * 60 + sm);
  }
  const end = a.startTime && minutes ? theoreticalEndTime(a.startTime, minutes) : "";
  const alert = available > 0 && minutes > available ? `<span class="prep-alert">Durée prévue supérieure au rendez-vous</span>` : "";
  return `<div class="prep-kpis"><span>${minutes}<small>min prévues</small></span><span>${end || "À calculer"}<small>fin théorique</small></span><span>${available || "?"}<small>min disponibles</small></span></div>${alert}`;
}

function theoreticalEndTime(start, minutes) {
  const [h, m] = String(start).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = h * 60 + m + Number(minutes || 0);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function prepLinkedNames(ids, entity, labelFn) {
  return ensureArray(ids).map(id => byId(entity, id)).filter(Boolean).map(labelFn).join(", ") || "Aucun lien";
}

function prepIdeaList(p) {
  return (p.ideas || []).map((idea, index) => {
    const status = idea.status || "À traiter";
    const conclusion = idea.conclusion ? `<span class="meta">Conclusion : ${esc(idea.conclusion)}</span>` : "";
    const linked = `${prepLinkedNames([idea.managerId], "managers", m => m.name)}${idea.projectId ? " · " + prepLinkedNames([idea.projectId], "projects", pr => pr.name) : ""}${idea.folderId ? " · " + prepLinkedNames([idea.folderId], "folders", f => f.name) : ""}`;
    return `<div class="item prep-item prep-subject ${status === "Traité" ? "subject-done" : status === "Reporté" ? "subject-postponed" : ""}"><strong>${esc(idea.text || "Sujet")}</strong><span class="muted">${esc(idea.category || "Sujet")} · ${esc(status)} · ${esc(idea.importance || "normale")} · ${esc(idea.createdAt || "")}</span><span class="meta">${esc(linked)}</span>${conclusion}<div class="row-actions"><button class="secondary" onclick="editPrepIdea('${p.id}','${idea.id}')">Modifier</button><button class="secondary" onclick="setPrepIdeaStatus('${p.id}','${idea.id}','Traité')">Traité</button><button class="secondary" onclick="setPrepIdeaStatus('${p.id}','${idea.id}','Non traité')">Non traité</button><button class="secondary" onclick="setPrepIdeaStatus('${p.id}','${idea.id}','Reporté')">Reporté</button><button class="secondary" onclick="setPrepIdeaConclusion('${p.id}','${idea.id}')">Conclusion</button><button class="secondary" onclick="transferPrepIdea('${p.id}','${idea.id}')">Transférer</button><button class="secondary" onclick="transformIdeaToTopic('${p.id}','${idea.id}')">Ordre du jour</button><button class="secondary" onclick="transformIdeaToAction('${p.id}','${idea.id}')">Action</button><button class="secondary" onclick="transformIdeaToDecision('${p.id}','${idea.id}')">Décision</button><button class="secondary" onclick="movePrepIdea('${p.id}',${index},-1)">Monter</button><button class="secondary" onclick="movePrepIdea('${p.id}',${index},1)">Descendre</button><button class="danger" onclick="deletePrepIdea('${p.id}','${idea.id}')">Supprimer</button></div></div>`;
  }).join("") || `<div class="empty">Aucun sujet collecté.</div>`;
}

function prepTopicList(p, a) {
  const rows = (p.agendaTopics || []).map((t, index) => `<div class="item prep-item"><strong>${index + 1}. ${esc(t.title || "Sujet")}</strong><span class="muted">${esc(t.type || "Information")} · ${esc(t.duration || "0")} min · Présentation : ${esc(t.presenter || "À définir")} · ${esc(t.status || "À traiter")}</span><span class="meta">${esc(t.objective || "")}${t.expectedDecision ? " · Décision attendue : " + esc(t.expectedDecision) : ""}</span><div class="row-actions"><button class="secondary" onclick="movePrepTopic('${p.id}',${index},-1)">Monter</button><button class="secondary" onclick="movePrepTopic('${p.id}',${index},1)">Descendre</button><button class="secondary" onclick="duplicatePrepTopic('${p.id}','${t.id}')">Dupliquer</button><button class="secondary" onclick="setPrepTopicStatus('${p.id}','${t.id}','Traité')">Traité</button><button class="secondary" onclick="setPrepTopicStatus('${p.id}','${t.id}','Reporté')">Reporté</button><button class="danger" onclick="deletePrepTopic('${p.id}','${t.id}')">Supprimer</button></div></div>`).join("") || `<div class="empty">Aucun sujet à l'ordre du jour.</div>`;
  return `${prepAgendaDuration(p, a)}${rows}`;
}

function prepParticipantList(p) {
  return (p.participants || []).map(part => {
    const label = part.managerId ? prepLinkedNames([part.managerId], "managers", m => `${m.name} · ${m.role || ""}`) : part.name;
    return `<div class="item prep-item"><strong>${esc(label || "Participant")}</strong><span class="muted">${esc(part.status || "Présent attendu")} · ${esc(part.role || "Rôle à préciser")}</span><span class="meta">${esc(part.topics || "Sujets à préciser")}</span><button class="danger" onclick="deletePrepParticipant('${p.id}','${part.id}')">Supprimer</button></div>`;
  }).join("") || `<div class="empty">Aucun participant préparé.</div>`;
}

function prepItemList(p) {
  return (p.prepItems || []).map(item => `<div class="item prep-item"><strong>${esc(item.title || "Élément")}</strong><span class="muted">${esc(item.status || "À faire")} · ${esc(item.priority || "normale")} · échéance ${esc(item.due || "à préciser")}</span><span class="meta">Responsable : ${esc(item.owner || "À définir")} · ${esc(item.comment || "")}</span><div class="row-actions"><button class="secondary" onclick="createActionFromPrepItem('${p.id}','${item.id}')">Créer action ${esc(identity.appName)}</button><button class="danger" onclick="deletePrepItem('${p.id}','${item.id}')">Supprimer</button></div></div>`).join("") || `<div class="empty">Aucun élément à préparer.</div>`;
}

function prepDocumentsList(p) {
  return (p.usefulDocuments || []).map(doc => `<div class="item prep-item"><strong>${esc(doc.documentId ? prepLinkedNames([doc.documentId], "documents", d => d.title) : doc.title || "Document")}</strong><span class="muted">${esc(doc.type || "Document")} · ${esc(doc.version || "")} · ${esc(doc.status || "À préparer")}</span><span class="meta">${esc(doc.date || "")}</span><div class="row-actions">${doc.documentId ? `<button class="secondary" onclick="editDocument('${doc.documentId}')">Ouvrir document</button>` : `<button class="secondary" onclick="createDocumentFromPrep('${p.id}','${doc.id}')">Créer fiche Document</button>`}<button class="danger" onclick="deletePrepDocument('${p.id}','${doc.id}')">Supprimer</button></div></div>`).join("") || `<div class="empty">Aucun document utile.</div>`;
}

function prepPerformanceList(p) {
  return ensureArray(p.linkedPerformance).map(id => byId("performance", id)).filter(Boolean).map(perf => `<div class="item clickable" onclick="openPerformance('${perf.id}')"><strong>${esc(perfPeriodLabel(perf))}</strong><span class="muted">${esc(perf.status || "Performance")}</span><span class="meta">${esc(buildPerformanceSynthesis(perf).slice(0, 180))}</span></div>`).join("") || `<div class="empty">Aucune donnée Performance liée.</div>`;
}

function prepArbitrationList(p) {
  return (p.arbitrations || []).map(item => `<div class="item prep-item"><strong>${esc(item.subject || "Arbitrage")}</strong><span class="muted">${esc(item.status || "À préparer")} · décideur : ${esc(item.decider || "À préciser")} · ${esc(item.wantedDate || "")}</span><span class="meta">${esc(item.context || "")}${item.recommendation ? " · Recommandation : " + esc(item.recommendation) : ""}</span><div class="row-actions"><button class="secondary" onclick="transformArbitrationToDecision('${p.id}','${item.id}')">Créer décision ${esc(identity.appName)}</button><button class="danger" onclick="deletePrepArbitration('${p.id}','${item.id}')">Supprimer</button></div></div>`).join("") || `<div class="empty">Aucun arbitrage préparé.</div>`;
}

function prepRunView(p) {
  const topic = (p.agendaTopics || [])[p.run.currentIndex || 0];
  return `<div class="card full-span conduct-panel"><div class="row"><h2>Conduire la réunion</h2><div class="row-actions"><button class="secondary" onclick="moveConductTopic('${p.id}',-1)">Sujet précédent</button><button class="secondary" onclick="moveConductTopic('${p.id}',1)">Sujet suivant</button><button class="action" onclick="finishMeeting('${p.id}')">Terminer la réunion</button></div></div><p><strong>Sujet en cours :</strong> ${esc(topic ? topic.title : "Aucun sujet")}</p><div class="form-grid"><textarea id="runNote" placeholder="Note prise pendant la réunion"></textarea><textarea id="runDecision" placeholder="Décision prise"></textarea><textarea id="runAction" placeholder="Action décidée"></textarea><textarea id="runPostponed" placeholder="Point reporté"></textarea></div><div class="manager-links"><label>Participants réellement présents</label>${checkboxList("runPresent", p.participants || [], p.run.presentParticipants || [], x => x.managerId ? prepLinkedNames([x.managerId], "managers", m => m.name) : x.name)}</div><div class="row-actions"><button class="secondary" onclick="addConductNote('${p.id}')">Ajouter note</button><button class="secondary" onclick="createConductAction('${p.id}')">Créer action</button><button class="secondary" onclick="createConductDecision('${p.id}')">Créer décision</button><button class="secondary" onclick="markCurrentTopic('${p.id}','Traité')">Sujet traité</button><button class="secondary" onclick="markCurrentTopic('${p.id}','Reporté')">Sujet reporté</button><button class="action" onclick="generateMeetingReport('${p.id}')">Générer le compte rendu</button></div>${prepRunHistory(p)}</div>`;
}

function prepRunHistory(p) {
  const notes = [...(p.run.notes || []), ...(p.run.decisions || []), ...(p.run.actions || []), ...(p.run.postponed || [])];
  return notes.map(n => `<div class="item"><strong>${esc(n.createdAt || "")} · ${esc(n.type || "Note")}</strong><span class="muted">${esc(n.text || "")}</span></div>`).join("") || `<div class="empty">Aucune note de conduite.</div>`;
}

function meetingPrepForm(p, a) {
  return `<div class="card full-span"><h2>Objectif de la réunion</h2><div class="form-grid"><input id="mpOrganizer" value="${esc(p.organizer || identityName())}" placeholder="Organisateur"><select id="mpTemplate">${meetingPrepTemplates.map(t => `<option value="${esc(t)}" ${p.template === t || (!p.template && a.type === t) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>${prepStatusSelect("mpStatus", p.status)}<select id="mpLevel"><option ${p.prepLevel === "à démarrer" ? "selected" : ""}>à démarrer</option><option ${p.prepLevel === "en cours" ? "selected" : ""}>en cours</option><option ${p.prepLevel === "prête" ? "selected" : ""}>prête</option></select></div><textarea id="mpObjective" placeholder="Objectif principal">${esc(p.objectiveMain || "")}</textarea><textarea id="mpResults" placeholder="Résultats attendus">${esc(p.expectedResults || "")}</textarea><textarea id="mpDecisions" placeholder="Décisions attendues">${esc(p.expectedDecisions || "")}</textarea><div class="grid two manager-links"><div><label>Managers</label>${checkboxList("mpManagers", state.managers, [...new Set([...(a.linkedManagers || []), ...(p.linkedManagers || [])])], m => `${m.name} · ${m.role || ""}`)}</div><div><label>Projets</label>${checkboxList("mpProjects", state.projects, [...new Set([...(a.linkedProjects || []), ...(p.linkedProjects || [])])], pr => pr.name)}</div><div><label>Dossiers</label>${folderSelect("mpFolders", [...new Set([...(a.linkedFolders || []), ...(p.linkedFolders || [])])])}</div><div><label>Décisions existantes</label>${checkboxList("mpDecisionsLinked", state.decisions, p.linkedDecisions || [], d => d.title)}</div><div><label>Actions existantes</label>${checkboxList("mpActionsLinked", state.actions, p.linkedActions || [], ac => ac.title)}</div><div><label>Documents existants</label>${checkboxList("mpDocumentsLinked", state.documents, p.linkedDocuments || [], d => d.title)}</div></div><button class="action" onclick="saveMeetingPreparationMain('${p.id}')">Enregistrer la préparation</button></div>`;
}

function openMeetingPreparation(agendaId) {
  agendaEditId = "";
  agendaModalOpen = false;
  const a = byId("agenda", agendaId);
  if (!a) return renderCockpit();
  const p = ensureMeetingPreparation(agendaId);
  document.getElementById("viewTitle").textContent = `Préparation · ${a.title}`;
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "cockpit"));
  appHtml(`<div class="card hero prep-hero"><button class="secondary" onclick="renderCockpit()">Retour Cockpit</button><h2>${esc(a.title)}</h2><p>${esc(a.type || "Réunion")} · ${esc(a.date || "")} · ${esc(a.startTime || "")}${a.endTime ? " - " + esc(a.endTime) : ""}${a.location ? " · " + esc(a.location) : ""}</p><span class="meta">Organisateur ${esc(p.organizer || identityName())} · Participants prévus ${ensureArray(a.linkedManagers).length + (p.participants || []).length} · ${esc(prepDaysLabel(a))} · ID ${esc(p.id)}</span><div class="row-actions"><button class="action" onclick="saveMeetingPreparationMain('${p.id}')">Modifier / Enregistrer</button><button class="secondary" onclick="startConductMeeting('${p.id}')">Démarrer la réunion</button><button class="secondary" onclick="generateMeetingReport('${p.id}')">Générer le compte rendu</button><button class="secondary" onclick="startReport('agenda','${a.id}')">Assistant compte rendu</button></div></div><div class="grid two">${meetingPrepForm(p, a)}<div class="card full-span"><h2>Idées et notes en amont</h2>${prepIdeaList(p)}<div class="prep-inline form-grid"><input id="piText" class="full" placeholder="Idée, sujet, question ou note"><select id="piCategory"><option>Idée</option><option>Sujet</option><option>Question</option><option>Information</option><option>Vigilance</option><option>Décision à préparer</option><option>Arbitrage</option><option>Note personnelle</option></select><select id="piImportance"><option>normale</option><option>importante</option><option>critique</option></select><select id="piConf"><option>partageable</option><option>note personnelle</option></select><select id="piManager"><option value="">Manager lié</option>${state.managers.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select><select id="piProject"><option value="">Projet lié</option>${state.projects.map(pr => `<option value="${esc(pr.id)}">${esc(pr.name)}</option>`).join("")}</select><select id="piFolder"><option value="">Dossier lié</option>${state.folders.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></div><button class="secondary" onclick="addPrepIdea('${p.id}')">+ Ajouter une idée</button></div><div class="card full-span"><h2>Ordre du jour</h2>${prepTopicList(p, a)}<div class="prep-inline form-grid"><input id="ptTitle" placeholder="Titre du sujet"><input id="ptObjective" placeholder="Objectif du point"><input id="ptPresenter" placeholder="Personne qui présente"><input id="ptDuration" type="number" min="0" placeholder="Durée prévue (min)"><select id="ptType"><option>Information</option><option>Échange</option><option>Décision</option><option>Arbitrage</option><option>Suivi</option></select><input id="ptExpected" placeholder="Décision attendue" class="full"><textarea id="ptNotes" placeholder="Notes de préparation" class="full"></textarea></div><button class="secondary" onclick="addPrepTopic('${p.id}')">Ajouter un sujet</button></div><div class="card"><h2>Participants</h2>${prepParticipantList(p)}<div class="prep-inline form-grid"><select id="ppManager"><option value="">Manager ${esc(identity.appName)}</option>${state.managers.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select><input id="ppName" placeholder="Participant externe"><input id="ppRole" placeholder="Rôle"><select id="ppStatus"><option>Présent attendu</option><option>Facultatif</option><option>À confirmer</option><option>Excusé</option></select><input id="ppTopics" placeholder="Sujets d'intervention" class="full"></div><button class="secondary" onclick="addPrepParticipant('${p.id}')">Ajouter participant</button></div><div class="card"><h2>Éléments à préparer</h2>${prepItemList(p)}<div class="prep-inline form-grid"><input id="peiTitle" placeholder="Titre"><input id="peiOwner" placeholder="Responsable"><input id="peiDue" type="date"><select id="peiStatus"><option>À faire</option><option>En cours</option><option>Prêt</option></select><select id="peiPriority"><option>normale</option><option>importante</option><option>critique</option></select><input id="peiComment" placeholder="Commentaire"></div><button class="secondary" onclick="addPrepItem('${p.id}')">Ajouter élément</button></div><div class="card"><h2>Documents utiles</h2>${prepDocumentsList(p)}<div class="prep-inline form-grid"><select id="pdDocument"><option value="">Document existant</option>${state.documents.map(d => `<option value="${esc(d.id)}">${esc(d.title)}</option>`).join("")}</select><input id="pdTitle" placeholder="Titre à fournir"><input id="pdType" placeholder="Type"><input id="pdVersion" placeholder="Version"><select id="pdStatus"><option>À préparer</option><option>Disponible</option><option>À mettre à jour</option><option>Validé</option></select></div><button class="secondary" onclick="addPrepDocument('${p.id}')">Ajouter document</button></div><div class="card"><h2>Données Performance</h2>${prepPerformanceList(p)}<div class="prep-inline form-grid"><select id="ppfPerformance"><option value="">Période Performance</option>${state.performance.map(perf => `<option value="${esc(perf.id)}">${esc(perfPeriodLabel(perf))}</option>`).join("")}</select><textarea id="ppfComment" placeholder="Commentaires, écarts, actions liées" class="full"></textarea></div><button class="secondary" onclick="addPrepPerformance('${p.id}')">Associer Performance</button></div><div class="card full-span"><h2>Décisions et arbitrages attendus</h2>${prepArbitrationList(p)}<div class="prep-inline form-grid"><input id="paSubject" placeholder="Sujet"><input id="paDecider" placeholder="Décideur attendu"><input id="paDate" type="date"><select id="paStatus"><option>À préparer</option><option>Prête à décider</option><option>Décidée</option><option>Reportée</option></select><textarea id="paContext" placeholder="Contexte" class="full"></textarea><textarea id="paOptions" placeholder="Options envisagées" class="full"></textarea><textarea id="paBenefits" placeholder="Avantages" class="full"></textarea><textarea id="paRisks" placeholder="Risques" class="full"></textarea><textarea id="paReco" placeholder="Recommandation du Directeur" class="full"></textarea></div><button class="secondary" onclick="addPrepArbitration('${p.id}')">Ajouter arbitrage</button></div>${prepRunView(p)}</div>`);
}

function savePrepAndOpen(p) {
  state.meetingPreparations = state.meetingPreparations.map(x => x.id === p.id ? normalizeMeetingPreparation(p) : x);
  persist("meetingPreparations");
  openMeetingPreparation(p.agendaId);
}

function prepById(id) {
  return byId("meetingPreparations", id);
}

function saveMeetingPreparationMain(id) {
  const p = prepById(id);
  if (!p) return;
  p.organizer = document.getElementById("mpOrganizer")?.value.trim() || identityName();
  p.template = document.getElementById("mpTemplate")?.value || p.template;
  p.status = document.getElementById("mpStatus")?.value || p.status;
  p.prepLevel = document.getElementById("mpLevel")?.value || p.prepLevel;
  p.objectiveMain = document.getElementById("mpObjective")?.value.trim() || "";
  p.expectedResults = document.getElementById("mpResults")?.value.trim() || "";
  p.expectedDecisions = document.getElementById("mpDecisions")?.value.trim() || "";
  p.linkedManagers = checkedValues("mpManagers");
  p.linkedProjects = checkedValues("mpProjects");
  p.linkedFolders = checkedValues("mpFolders");
  p.linkedDecisions = checkedValues("mpDecisionsLinked");
  p.linkedActions = checkedValues("mpActionsLinked");
  p.linkedDocuments = checkedValues("mpDocumentsLinked");
  persist("meetingPreparations");
  addActivity("Préparation réunion", byId("agenda", p.agendaId)?.title || "Réunion", `Statut ${p.status}`, p.id);
  openMeetingPreparation(p.agendaId);
}

function addPrepIdea(id) {
  const p = prepById(id), text = document.getElementById("piText")?.value.trim();
  if (!p || !text) return;
  p.ideas.push({ id: newId("idea"), text, createdAt: new Date().toLocaleString("fr-FR"), author: identityName(), category: document.getElementById("piCategory").value, importance: document.getElementById("piImportance").value, confidentiality: document.getElementById("piConf").value, managerId: document.getElementById("piManager").value, projectId: document.getElementById("piProject").value, folderId: document.getElementById("piFolder").value });
  p.status = p.status === "À préparer" ? "Préparation en cours" : p.status;
  addActivity("🗓️ Sujet réunion", byId("agenda", p.agendaId)?.title || "Réunion", text, p.id);
  savePrepAndOpen(p);
}

function moveArrayItem(arr, index, delta) {
  const next = index + delta;
  if (next < 0 || next >= arr.length) return;
  [arr[index], arr[next]] = [arr[next], arr[index]];
}

function movePrepIdea(id, index, delta) {
  const p = prepById(id);
  if (!p) return;
  moveArrayItem(p.ideas, index, delta);
  savePrepAndOpen(p);
}

function deletePrepIdea(id, ideaId) {
  const p = prepById(id);
  if (!p) return;
  p.ideas = p.ideas.filter(x => x.id !== ideaId);
  savePrepAndOpen(p);
}

function editPrepIdea(id, ideaId) {
  const p = prepById(id), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  const next = prompt("Modifier le sujet", idea.text || "");
  if (next === null) return;
  idea.text = next.trim() || idea.text;
  savePrepAndOpen(p);
}

function setPrepIdeaStatus(id, ideaId, status) {
  const p = prepById(id), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  idea.status = status;
  if (status === "Reporté") {
    p.run.postponed = ensureArray(p.run.postponed);
    if (!p.run.postponed.some(x => x.ideaId === ideaId)) p.run.postponed.push({ id: newId("run"), ideaId, type: "Sujet reporté", text: idea.text, createdAt: new Date().toLocaleString("fr-FR") });
  }
  savePrepAndOpen(p);
}

function setPrepIdeaConclusion(id, ideaId) {
  const p = prepById(id), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  const conclusion = prompt("Réponse ou conclusion", idea.conclusion || "");
  if (conclusion === null) return;
  idea.conclusion = conclusion.trim();
  savePrepAndOpen(p);
}

function transferPrepIdea(id, ideaId) {
  const p = prepById(id), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  const meetings = futureMeetings().filter(a => a.id !== p.agendaId);
  if (!meetings.length) return alert("Aucune autre réunion future disponible.");
  const choice = prompt(`Transférer vers quelle réunion ?\n${meetings.map((a, i) => `${i + 1}. ${a.date || ""} ${agendaStartTime(a) || "Heure à confirmer"} · ${a.title || "Réunion"}`).join("\n")}`, "1");
  const index = Number(choice) - 1;
  const target = meetings[index];
  if (!target) return;
  const targetPrep = ensureMeetingPreparation(target.id);
  targetPrep.ideas.push({ ...idea, id: newId("idea"), status: "À traiter", createdAt: new Date().toLocaleString("fr-FR"), transferredFrom: p.id });
  idea.status = "Reporté";
  idea.conclusion = idea.conclusion || `Transféré vers ${target.title}`;
  persist("meetingPreparations");
  addActivity("🔁 Sujet transféré", target.title, idea.text, targetPrep.id);
  openMeetingPreparation(p.agendaId);
}

function transformIdeaToTopic(id, ideaId) {
  const p = prepById(id), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  p.agendaTopics.push({ id: newId("topic"), title: idea.text, objective: idea.category || "", presenter: "", duration: 10, type: idea.category === "Question" ? "Échange" : "Information", folderId: idea.folderId, projectId: idea.projectId, expectedDecision: idea.category === "Décision à préparer" ? idea.text : "", prepNotes: idea.text, status: "À traiter" });
  savePrepAndOpen(p);
}

function transformIdeaToAction(id, ideaId) {
  const p = prepById(id), a = byId("agenda", p?.agendaId), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  const action = { id: newId("action"), title: idea.text, link: a?.title || "Réunion", owner: "", level: idea.importance === "critique" ? "red" : idea.importance === "importante" ? "orange" : "green", due: "", done: false, linkedManagers: idea.managerId ? [idea.managerId] : p.linkedManagers, linkedProjects: idea.projectId ? [idea.projectId] : p.linkedProjects, linkedFolders: idea.folderId ? [idea.folderId] : p.linkedFolders, linkedMeetingPreparations: [p.id] };
  state.actions.unshift(action);
  p.linkedActions = [...new Set([...(p.linkedActions || []), action.id])];
  persist("actions");
  addActivity("Action", action.title, "Créée depuis préparation réunion", action.id);
  savePrepAndOpen(p);
}

function transformIdeaToDecision(id, ideaId) {
  const p = prepById(id), a = byId("agenda", p?.agendaId), idea = p?.ideas.find(x => x.id === ideaId);
  if (!p || !idea) return;
  const decision = { id: newId("decision"), title: idea.text, date: localIsoDate(), status: "review", importance: idea.importance === "critique" ? "red" : "orange", context: `Préparation réunion ${a?.title || ""}`, problem: idea.text, decision: "", rationale: "", alternatives: "", impacts: "", risks: "", owner: p.organizer || identityName(), linkedManagers: idea.managerId ? [idea.managerId] : p.linkedManagers, linkedProjects: idea.projectId ? [idea.projectId] : p.linkedProjects, linkedActions: [], linkedDocuments: [], linkedFolders: idea.folderId ? [idea.folderId] : p.linkedFolders, linkedMeetingPreparations: [p.id], reviewDate: a?.date || "", events: [], directorNotes: [], nextStep: "Décision à préparer", tags: ["Réunion", "Préparation"] };
  state.decisions.unshift(decision);
  p.linkedDecisions = [...new Set([...(p.linkedDecisions || []), decision.id])];
  persist("decisions");
  syncDecisionBacklinks(decision);
  addActivity("Décision", decision.title, "Créée depuis préparation réunion", decision.id);
  savePrepAndOpen(p);
}

function addPrepTopic(id) {
  const p = prepById(id), title = document.getElementById("ptTitle")?.value.trim();
  if (!p || !title) return;
  p.agendaTopics.push({ id: newId("topic"), title, objective: document.getElementById("ptObjective").value.trim(), presenter: document.getElementById("ptPresenter").value.trim(), duration: Number(document.getElementById("ptDuration").value || 0), type: document.getElementById("ptType").value, expectedDecision: document.getElementById("ptExpected").value.trim(), prepNotes: document.getElementById("ptNotes").value.trim(), status: "À traiter" });
  savePrepAndOpen(p);
}

function movePrepTopic(id, index, delta) {
  const p = prepById(id);
  if (!p) return;
  moveArrayItem(p.agendaTopics, index, delta);
  savePrepAndOpen(p);
}

function duplicatePrepTopic(id, topicId) {
  const p = prepById(id), topic = p?.agendaTopics.find(x => x.id === topicId);
  if (!p || !topic) return;
  p.agendaTopics.push({ ...topic, id: newId("topic"), title: `${topic.title} (copie)` });
  savePrepAndOpen(p);
}

function deletePrepTopic(id, topicId) {
  const p = prepById(id);
  if (!p) return;
  p.agendaTopics = p.agendaTopics.filter(x => x.id !== topicId);
  savePrepAndOpen(p);
}

function setPrepTopicStatus(id, topicId, status) {
  const p = prepById(id), topic = p?.agendaTopics.find(x => x.id === topicId);
  if (!topic) return;
  topic.status = status;
  if (status === "Reporté") p.run.postponed.push({ id: newId("run"), type: "Point reporté", text: topic.title, createdAt: new Date().toLocaleString("fr-FR") });
  savePrepAndOpen(p);
}

function addPrepParticipant(id) {
  const p = prepById(id);
  const managerId = document.getElementById("ppManager").value;
  const name = document.getElementById("ppName").value.trim();
  if (!p || (!managerId && !name)) return;
  p.participants.push({ id: newId("participant"), type: managerId ? "manager" : "external", managerId, name, role: document.getElementById("ppRole").value.trim(), status: document.getElementById("ppStatus").value, topics: document.getElementById("ppTopics").value.trim() });
  if (managerId) p.linkedManagers = [...new Set([...(p.linkedManagers || []), managerId])];
  savePrepAndOpen(p);
}

function deletePrepParticipant(id, participantId) {
  const p = prepById(id);
  if (!p) return;
  p.participants = p.participants.filter(x => x.id !== participantId);
  savePrepAndOpen(p);
}

function addPrepItem(id) {
  const p = prepById(id), title = document.getElementById("peiTitle")?.value.trim();
  if (!p || !title) return;
  p.prepItems.push({ id: newId("prepitem"), title, owner: document.getElementById("peiOwner").value.trim(), due: document.getElementById("peiDue").value, status: document.getElementById("peiStatus").value, priority: document.getElementById("peiPriority").value, comment: document.getElementById("peiComment").value.trim() });
  savePrepAndOpen(p);
}

function createActionFromPrepItem(id, itemId) {
  const p = prepById(id), item = p?.prepItems.find(x => x.id === itemId), a = byId("agenda", p?.agendaId);
  if (!p || !item) return;
  const action = { id: newId("action"), title: item.title, owner: item.owner || "", due: item.due || "", level: item.priority === "critique" ? "red" : item.priority === "importante" ? "orange" : "green", link: a?.title || "Réunion", done: item.status === "Prêt", linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedFolders: p.linkedFolders, linkedDecisions: p.linkedDecisions, linkedMeetingPreparations: [p.id] };
  state.actions.unshift(action);
  p.linkedActions = [...new Set([...(p.linkedActions || []), action.id])];
  persist("actions");
  addActivity("Action", action.title, "Créée depuis élément à préparer", action.id);
  savePrepAndOpen(p);
}

function deletePrepItem(id, itemId) {
  const p = prepById(id);
  if (!p) return;
  p.prepItems = p.prepItems.filter(x => x.id !== itemId);
  savePrepAndOpen(p);
}

function addPrepDocument(id) {
  const p = prepById(id);
  if (!p) return;
  const documentId = document.getElementById("pdDocument").value;
  const title = document.getElementById("pdTitle").value.trim();
  if (!documentId && !title) return;
  p.usefulDocuments.push({ id: newId("prepdoc"), documentId, title, type: document.getElementById("pdType").value.trim(), version: document.getElementById("pdVersion").value.trim(), status: document.getElementById("pdStatus").value, date: localIsoDate() });
  if (documentId) p.linkedDocuments = [...new Set([...(p.linkedDocuments || []), documentId])];
  savePrepAndOpen(p);
}

function createDocumentFromPrep(id, prepDocId) {
  const p = prepById(id), prepDoc = p?.usefulDocuments.find(x => x.id === prepDocId), a = byId("agenda", p?.agendaId);
  if (!p || !prepDoc) return;
  const doc = { id: newId("document"), title: prepDoc.title || "Document réunion", type: prepDoc.type || "Support réunion", category: "Réunion", status: prepDoc.status || "À préparer", owner: p.organizer || identityName(), author: p.organizer || identityName(), version: prepDoc.version || "V1", date: localIsoDate(), updatedAt: localIsoDate(), summary: `Document utile pour ${a?.title || "réunion"}`, content: "", tags: ["Réunion", "Préparation"], linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedFolders: p.linkedFolders, linkedDecisions: p.linkedDecisions, linkedActions: p.linkedActions, linkedMeetingPreparations: [p.id], sourceType: "agenda", sourceId: p.agendaId };
  state.documents.unshift(doc);
  prepDoc.documentId = doc.id;
  p.linkedDocuments = [...new Set([...(p.linkedDocuments || []), doc.id])];
  persist("documents");
  addActivity("Document", doc.title, "Créé depuis préparation réunion", doc.id);
  savePrepAndOpen(p);
}

function deletePrepDocument(id, docId) {
  const p = prepById(id);
  if (!p) return;
  p.usefulDocuments = p.usefulDocuments.filter(x => x.id !== docId);
  savePrepAndOpen(p);
}

function addPrepPerformance(id) {
  const p = prepById(id), performanceId = document.getElementById("ppfPerformance").value;
  if (!p || !performanceId) return;
  p.linkedPerformance = [...new Set([...(p.linkedPerformance || []), performanceId])];
  p.performanceLinks.push({ id: newId("prepperf"), performanceId, comment: document.getElementById("ppfComment").value.trim(), createdAt: new Date().toLocaleString("fr-FR") });
  savePrepAndOpen(p);
}

function addPrepArbitration(id) {
  const p = prepById(id), subject = document.getElementById("paSubject")?.value.trim();
  if (!p || !subject) return;
  p.arbitrations.push({ id: newId("arbitration"), subject, context: document.getElementById("paContext").value.trim(), options: document.getElementById("paOptions").value.trim(), benefits: document.getElementById("paBenefits").value.trim(), risks: document.getElementById("paRisks").value.trim(), recommendation: document.getElementById("paReco").value.trim(), decider: document.getElementById("paDecider").value.trim(), wantedDate: document.getElementById("paDate").value, status: document.getElementById("paStatus").value });
  savePrepAndOpen(p);
}

function transformArbitrationToDecision(id, arbitrationId) {
  const p = prepById(id), item = p?.arbitrations.find(x => x.id === arbitrationId), a = byId("agenda", p?.agendaId);
  if (!p || !item) return;
  const decision = { id: newId("decision"), title: item.subject, date: localIsoDate(), status: item.status === "Décidée" ? "decided" : "review", importance: item.status === "Prête à décider" ? "orange" : "green", context: item.context || `Arbitrage préparé pour ${a?.title || "réunion"}`, problem: item.subject, decision: item.status === "Décidée" ? item.recommendation : "", rationale: item.recommendation || "", alternatives: item.options || "", impacts: item.benefits || "", risks: item.risks || "", owner: item.decider || p.organizer || identityName(), linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedActions: p.linkedActions, linkedDocuments: p.linkedDocuments, linkedFolders: p.linkedFolders, linkedPerformance: p.linkedPerformance, linkedMeetingPreparations: [p.id], reviewDate: item.wantedDate || a?.date || "", events: [], directorNotes: [], nextStep: "Arbitrage issu d'une préparation de réunion", tags: ["Réunion", "Arbitrage"] };
  state.decisions.unshift(decision);
  p.linkedDecisions = [...new Set([...(p.linkedDecisions || []), decision.id])];
  item.status = "Décidée";
  persist("decisions");
  syncDecisionBacklinks(decision);
  addActivity("Décision", decision.title, "Créée depuis arbitrage réunion", decision.id);
  savePrepAndOpen(p);
}

function deletePrepArbitration(id, arbitrationId) {
  const p = prepById(id);
  if (!p) return;
  p.arbitrations = p.arbitrations.filter(x => x.id !== arbitrationId);
  savePrepAndOpen(p);
}

function startConductMeeting(id) {
  const p = prepById(id);
  if (!p) return;
  p.status = "Réalisée";
  p.run.startedAt = p.run.startedAt || new Date().toLocaleString("fr-FR");
  savePrepAndOpen(p);
}

function moveConductTopic(id, delta) {
  const p = prepById(id);
  if (!p) return;
  p.run.currentIndex = Math.max(0, Math.min((p.agendaTopics || []).length - 1, Number(p.run.currentIndex || 0) + delta));
  savePrepAndOpen(p);
}

function markCurrentTopic(id, status) {
  const p = prepById(id), topic = p?.agendaTopics[p.run.currentIndex || 0];
  if (!p || !topic) return;
  topic.status = status;
  if (status === "Reporté") p.run.postponed.push({ id: newId("run"), type: "Point reporté", text: topic.title, createdAt: new Date().toLocaleString("fr-FR") });
  savePrepAndOpen(p);
}

function addConductNote(id) {
  const p = prepById(id), text = document.getElementById("runNote")?.value.trim();
  if (!p || !text) return;
  p.run.presentParticipants = checkedValues("runPresent");
  p.run.notes.push({ id: newId("run"), type: "Note", text, createdAt: new Date().toLocaleString("fr-FR") });
  savePrepAndOpen(p);
}

function createConductAction(id) {
  const p = prepById(id), text = document.getElementById("runAction")?.value.trim(), a = byId("agenda", p?.agendaId);
  if (!p || !text) return;
  const action = { id: newId("action"), title: text, link: a?.title || "Réunion", owner: "", due: "", level: "orange", done: false, linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedFolders: p.linkedFolders, linkedDecisions: p.linkedDecisions, linkedMeetingPreparations: [p.id] };
  state.actions.unshift(action);
  p.linkedActions = [...new Set([...(p.linkedActions || []), action.id])];
  p.run.actions.push({ id: newId("run"), type: "Action", text, createdAt: new Date().toLocaleString("fr-FR"), actionId: action.id });
  persist("actions");
  addActivity("Action", action.title, "Créée pendant réunion", action.id);
  savePrepAndOpen(p);
}

function createConductDecision(id) {
  const p = prepById(id), text = document.getElementById("runDecision")?.value.trim(), a = byId("agenda", p?.agendaId);
  if (!p || !text) return;
  const decision = { id: newId("decision"), title: text, date: localIsoDate(), status: "decided", importance: "orange", context: `Décision prise pendant ${a?.title || "réunion"}`, problem: "", decision: text, rationale: "", alternatives: "", impacts: "", risks: "", owner: p.organizer || identityName(), linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedActions: p.linkedActions, linkedDocuments: p.linkedDocuments, linkedFolders: p.linkedFolders, linkedPerformance: p.linkedPerformance, linkedMeetingPreparations: [p.id], reviewDate: "", events: [], directorNotes: [], nextStep: "", tags: ["Réunion"] };
  state.decisions.unshift(decision);
  p.linkedDecisions = [...new Set([...(p.linkedDecisions || []), decision.id])];
  p.run.decisions.push({ id: newId("run"), type: "Décision", text, createdAt: new Date().toLocaleString("fr-FR"), decisionId: decision.id });
  persist("decisions");
  syncDecisionBacklinks(decision);
  addActivity("Décision", decision.title, "Créée pendant réunion", decision.id);
  savePrepAndOpen(p);
}

function finishMeeting(id) {
  const p = prepById(id);
  if (!p) return;
  p.status = "Compte rendu à finaliser";
  p.run.finishedAt = new Date().toLocaleString("fr-FR");
  savePrepAndOpen(p);
}

function meetingReportContent(p) {
  const a = byId("agenda", p.agendaId) || {};
  const managers = state.managers.filter(m => (p.linkedManagers || []).includes(m.id)).map(m => `- ${m.name} (${m.role || ""})`).join("\n") || "À compléter";
  const ideas = (p.ideas || []).map((i, index) => `- ${index + 1}. ${i.text || "Sujet"} | ${i.category || "Sujet"} | ${i.status || "À traiter"}${i.conclusion ? " | Conclusion : " + i.conclusion : ""}`).join("\n") || "À compléter";
  const topics = (p.agendaTopics || []).map((t, i) => `- ${i + 1}. ${t.title} | ${t.status || "À traiter"} | ${t.prepNotes || ""}`).join("\n") || "À compléter";
  const notes = [...(p.run.notes || []), ...(p.run.decisions || []), ...(p.run.actions || []), ...(p.run.postponed || [])].map(n => `- ${n.type || "Note"} : ${n.text || ""}`).join("\n") || "À compléter";
  return `Réunion : ${a.title || ""}\nDate : ${a.date || ""} ${a.startTime || ""}${a.endTime ? " - " + a.endTime : ""}\nLieu : ${a.location || "À compléter"}\nStatut préparation : ${p.status}\n\nObjectif\n${p.objectiveMain || "À compléter"}\n\nRésultats attendus\n${p.expectedResults || "À compléter"}\n\nDécisions attendues\n${p.expectedDecisions || "À compléter"}\n\nParticipants prévus\n${managers}\n\nSujets collectés en amont\n${ideas}\n\nOrdre du jour et sujets traités\n${topics}\n\nNotes, décisions, actions et points reportés\n${notes}\n\nActions liées\n${reportActions(state.actions.filter(x => (p.linkedActions || []).includes(x.id)))}\n\nDécisions liées\n${reportDecisions(state.decisions.filter(x => (p.linkedDecisions || []).includes(x.id)))}`;
}

function generateMeetingReport(id) {
  const p = prepById(id), a = byId("agenda", p?.agendaId);
  if (!p || !a) return;
  const doc = { id: newId("document"), title: `Compte rendu - ${a.title}`, type: "Compte rendu", category: p.template || a.type || "Réunion", status: "Brouillon", owner: p.organizer || identityName(), author: p.organizer || identityName(), version: "V1", date: localIsoDate(), updatedAt: localIsoDate(), summary: p.objectiveMain || a.notes || "", content: meetingReportContent(p), tags: ["Compte rendu", "Réunion", p.template || a.type || ""].filter(Boolean), linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedFolders: p.linkedFolders, linkedDecisions: p.linkedDecisions, linkedActions: p.linkedActions, linkedPerformance: p.linkedPerformance, linkedMeetingPreparations: [p.id], sourceType: "agenda", sourceId: p.agendaId, reportTemplate: p.template || "Réunion" };
  state.documents.unshift(doc);
  p.finalReportId = doc.id;
  p.linkedDocuments = [...new Set([...(p.linkedDocuments || []), doc.id])];
  persist("documents");
  addActivity("Document", doc.title, "Compte rendu généré depuis réunion", doc.id);
  savePrepAndOpen(p);
}

function priorityItem(p) {
  const folders = state.folders.filter(f => ensureArray(p.linkedFolders).includes(f.id)).map(f => f.name).join(" · ");
  return `<div class="item row"><div><strong>${icons[p.level] || "⚑"} ${esc(p.title)}</strong><span class="muted">${esc(p.due || "Pas d'échéance")}${p.link ? " · " + esc(p.link) : ""}${p.owner ? " · " + esc(p.owner) : ""}${folders ? " · " + esc(folders) : ""}</span><span class="meta">ID ${esc(p.id)}</span></div><div class="row-actions"><button class="secondary" onclick="completePriority('${p.id}')">Terminer</button><button class="danger" onclick="deletePriority('${p.id}')">Supprimer</button></div></div>`;
}

function renderPriorities() {
  appHtml(`<div class="card hero"><h2>⚡ Priorités V5</h2><p class="muted">La priorité focalise : identifiez ici les sujets qui nécessitent votre attention immédiate.</p></div><div class="card"><h2>Nouvelle priorité</h2><div class="form-grid"><input id="pTitle" placeholder="Titre" class="full"><input id="pDue" placeholder="Échéance"><input id="pLink" placeholder="Lien"><input id="pOwner" placeholder="Responsable"><select id="pLevel"><option value="green">🟢 Normal</option><option value="orange" selected>🟠 Important</option><option value="red">🔴 Urgent</option></select><textarea id="pImpact" class="full" placeholder="Impact attendu"></textarea></div><div class="manager-links"><label>Dossiers liés</label>${folderSelect("pFolders")}</div><button class="action" onclick="addPriority()">Ajouter</button></div><div class="grid two"><div class="card"><h2>Actives</h2>${state.priorities.filter(p => !p.done).map(priorityItem).join("") || `<div class="empty">Aucune priorité active.</div>`}</div><div class="card"><h2>Terminées</h2>${state.priorities.filter(p => p.done).map(priorityItem).join("") || `<div class="empty">Aucune priorité terminée.</div>`}</div></div>`);
}

function addPriority() {
  const title = document.getElementById("pTitle").value.trim();
  if (!title) return;
  const p = { id: newId("priority"), title, due: document.getElementById("pDue").value.trim(), link: document.getElementById("pLink").value.trim(), owner: document.getElementById("pOwner").value.trim(), impact: document.getElementById("pImpact").value.trim(), level: document.getElementById("pLevel").value, done: false, linkedFolders: checkedValues("pFolders") };
  state.priorities.unshift(p);
  persist("priorities");
  addActivity("⚡ Priorité", p.title, p.due || p.link, p.id);
  if (closeCockpitQuickCreateIfNeeded("priority")) return;
  renderPriorities();
}

function completePriority(id) {
  const p = byId("priorities", id);
  if (!p) return;
  p.done = true;
  persist("priorities");
  addActivity("✅ Priorité terminée", p.title, p.link || "", p.id);
  renderPriorities();
}

function deletePriority(id) {
  const i = indexById("priorities", id);
  if (i < 0 || !confirm("Supprimer cette priorité ?")) return;
  const t = state.priorities[i].title;
  state.priorities.splice(i, 1);
  persist("priorities");
  addActivity("🗑️ Priorité supprimée", t);
  renderPriorities();
}

const folderCategories = ["Performance", "Exploitation", "Management", "RH", "Dialogue social", "Sécurité", "Maintenance", "Qualité", "Litiges", "Projet", "Autre"];

function folderStatusLabel(status) {
  return ({ green: "Maîtrisé", orange: "À suivre", red: "Critique", archived: "Archivé" })[status] || "À suivre";
}

function folderPriorityLabel(priority) {
  return ({ green: "Normal", orange: "Important", red: "Critique" })[priority] || "Important";
}

function folderSelect(id, selectedIds = []) {
  return checkboxList(id, state.folders, selectedIds, f => `${f.name} — ${f.category}`);
}

function folderText(f) {
  return `${f.name} ${f.category} ${f.description} ${f.context} ${f.objectives} ${f.expectedResults} ${f.owner} ${(f.tags || []).join(" ")}`.toLowerCase();
}

function itemLinkedToFolder(item, folder) {
  return ensureArray(item.linkedFolders).includes(folder.id);
}

function folderRelations(folder) {
  const linkedManagerIds = normalizeLinkedManagerIds(ensureArray(folder?.linkedManagers).length ? folder.linkedManagers : ensureArray(folder?.linkedManagerIds));
  const projects = state.projects.filter(p => itemLinkedToFolder(p, folder));
  const projectIds = projects.map(p => p.id);
  const managers = state.managers.filter(m => linkedManagerIds.some(id => sameId(id, m.id)) || projectIds.some(id => ensureArray(m.linkedProjects).some(link => sameId(link, id))) || projects.some(p => sameId(p.ownerId, m.id) || ensureArray(p.linkedManagers).some(link => sameId(link, m.id))));
  const ownerManager = state.managers.find(m => sameId(folder.ownerId, m.id) || (folder.owner && String(m.name || "").trim().toLowerCase() === String(folder.owner || "").trim().toLowerCase()));
  if (ownerManager && !managers.some(m => sameId(m.id, ownerManager.id))) managers.push(ownerManager);
  const managerIds = managers.map(m => m.id);
  const actions = state.actions.filter(a => itemLinkedToFolder(a, folder) || projectIds.some(id => ensureArray(a.linkedProjects).includes(id)) || projects.some(p => ensureArray(p.linkedActions).includes(a.id)));
  const priorities = state.priorities.filter(p => itemLinkedToFolder(p, folder));
  const decisions = state.decisions.filter(d => itemLinkedToFolder(d, folder) || projectIds.some(id => ensureArray(d.linkedProjects).includes(id)) || actions.some(a => ensureArray(d.linkedActions).includes(a.id)));
  const decisionIds = decisions.map(d => d.id);
  const journal = state.journal.filter(j => itemLinkedToFolder(j, folder) || projectIds.some(id => ensureArray(j.linkedProjects).includes(id)) || decisionIds.some(id => ensureArray(j.linkedDecisions).includes(id)));
  const documents = state.documents.filter(d => itemLinkedToFolder(d, folder) || projects.some(p => ensureArray(p.linkedDocuments).includes(d.id)) || decisions.some(dec => ensureArray(dec.linkedDocuments).includes(d.id)));
  const agenda = state.agenda.filter(a => itemLinkedToFolder(a, folder) || projectIds.some(id => ensureArray(a.linkedProjects).includes(id)) || managerIds.some(id => ensureArray(a.linkedManagers).includes(id)));
  const activity = state.activity.filter(a => itemLinkedToFolder(a, folder) || [folder.id, ...projectIds, ...managerIds, ...actions.map(x => x.id), ...decisions.map(x => x.id), ...documents.map(x => x.id)].includes(a.entityId));
  return { projects, managers, actions, priorities, decisions, journal, documents, agenda, activity };
}

function folderStats(folder) {
  const rel = folderRelations(folder);
  const openActions = rel.actions.filter(a => !a.done);
  const overdueActions = openActions.filter(a => daysUntil(a.due) !== null && daysUntil(a.due) < 0);
  const dates = [...rel.actions.map(a => a.due), ...rel.priorities.map(p => p.due), ...rel.projects.map(p => p.deadline), ...rel.decisions.map(d => d.reviewDate), ...rel.agenda.map(a => a.date), folder.deadline].filter(Boolean).sort((a, b) => dateRank(a) - dateRank(b));
  const futureMeetings = rel.agenda.filter(a => daysUntil(a.date) !== null && daysUntil(a.date) >= 0);
  const lastActivity = rel.activity.map(a => a.date).filter(Boolean)[0] || folder.createdAt || "";
  const total = rel.projects.length + rel.managers.length + rel.actions.length + rel.priorities.length + rel.decisions.length + rel.journal.length + rel.documents.length + rel.agenda.length;
  return { rel, total, openActions: openActions.length, doneActions: rel.actions.filter(a => a.done).length, overdueActions: overdueActions.length, nextDue: dates[0] || "", lastActivity, futureMeetings: futureMeetings.length, meetings: rel.agenda.length };
}

function folderCard(folder) {
  const stats = folderStats(folder);
  return `<div class="card folder-card clickable" onclick="openFolder('${folder.id}')"><div class="row"><div><h2>${esc(folder.name)}</h2><span class="muted">${esc(folder.category)} · ${esc(folderPriorityLabel(folder.priorityLevel))}</span></div>${badge(folder.status)}</div><p>${esc(folder.description || folder.context || "Dossier transversal " + identity.appName)}</p><div class="folder-metrics"><span>${stats.total}<small>éléments</small></span><span>${stats.openActions}<small>actions ouvertes</small></span><span>${stats.overdueActions}<small>retards</small></span></div><span class="meta">Responsable ${esc(folder.owner || "À définir")} · Échéance ${esc(stats.nextDue || "Non définie")} ? Dernière activité ${esc(stats.lastActivity || "Aucune")}</span></div>`;
}

function folderViewToggle() {
  return `<div class="segmented"><button class="secondary ${folderViewMode === "list" ? "active-filter" : ""}" onclick="setFolderViewMode('list')">Vue liste</button><button class="secondary ${folderViewMode === "graph" ? "active-filter" : ""}" onclick="setFolderViewMode('graph')">Vue graphique</button></div>`;
}

function setFolderViewMode(mode) {
  folderViewMode = mode;
  renderFolders();
}

function graphProjectFolderIds(project) {
  return ensureArray(project.linkedFolders).filter(id => byId("folders", id));
}

function folderGraphData() {
  const search = normalizeText(folderGraphSearch).trim();
  const links = [];
  state.projects.forEach(project => {
    graphProjectFolderIds(project).forEach(folderId => links.push({ id: `${folderId}--${project.id}`, folderId, projectId: project.id }));
  });
  const connectedFolderIds = new Set(links.map(link => link.folderId));
  const connectedProjectIds = new Set(links.map(link => link.projectId));
  const folderNodes = state.folders.map(folder => ({ id: folder.id, type: "folder", label: folder.name, status: folder.status, priority: folder.priorityLevel, source: folder, connected: connectedFolderIds.has(folder.id) }));
  const projectNodes = state.projects.map(project => ({ id: project.id, type: "project", label: project.name, status: project.status, priority: project.priorityLevel, progress: Number(project.progress || 0), source: project, connected: connectedProjectIds.has(project.id) }));
  const matchesFilter = node => {
    if (folderGraphFilter === "folders") return node.type === "folder";
    if (folderGraphFilter === "projects") return node.type === "project";
    if (folderGraphFilter === "red") return node.status === "red" || node.priority === "red";
    if (folderGraphFilter === "orange") return node.status === "orange" || node.priority === "orange";
    if (folderGraphFilter === "active") return node.type === "project" && node.progress < 100 && node.status !== "green";
    return true;
  };
  const matchesSearch = node => !search || normalizeText(node.label).includes(search);
  const nodes = [...folderNodes, ...projectNodes].filter(node => matchesFilter(node) && matchesSearch(node));
  const visible = new Set(nodes.map(node => node.id));
  return { nodes, links: links.filter(link => visible.has(link.folderId) && visible.has(link.projectId)) };
}

function folderGraphLayout(data) {
  const folders = data.nodes.filter(n => n.type === "folder");
  const projects = data.nodes.filter(n => n.type === "project");
  const positions = {};
  const baseY = 120;
  const stepY = 150;
  folders.forEach((node, index) => positions[node.id] = { x: 330, y: baseY + index * stepY });
  const grouped = new Map();
  data.links.forEach(link => {
    if (!grouped.has(link.folderId)) grouped.set(link.folderId, []);
    grouped.get(link.folderId).push(link.projectId);
  });
  const placedProjects = new Set();
  grouped.forEach((projectIds, folderId) => {
    const folderPos = positions[folderId] || { x: 330, y: baseY };
    const offset = (projectIds.length - 1) * 54;
    projectIds.forEach((projectId, index) => {
      if (placedProjects.has(projectId)) return;
      positions[projectId] = { x: 780, y: folderPos.y - offset + index * 108 };
      placedProjects.add(projectId);
    });
  });
  const orphanProjects = projects.filter(node => !placedProjects.has(node.id));
  const orphanStart = Math.max(baseY, folders.length ? baseY + folders.length * stepY + 30 : baseY);
  orphanProjects.forEach((node, index) => positions[node.id] = { x: 780, y: orphanStart + index * 112 });
  const maxY = Math.max(520, ...Object.values(positions).map(pos => pos.y + 80));
  return { positions, width: 1120, height: maxY };
}

function folderGraphPreview(node) {
  if (!node) return `<div class="graph-preview empty">Survolez un nœud pour afficher son aperçu compact.</div>`;
  if (node.type === "folder") {
    const stats = folderStats(node.source);
    return `<div class="graph-preview"><strong>${esc(node.label)}</strong><span>${esc(folderPriorityLabel(node.priority))} · ${esc(folderStatusLabel(node.status))}</span><span>${stats.rel.projects.length} projet(s) · ${stats.openActions} action(s) ouverte(s) · ${stats.rel.decisions.length} décision(s)</span><button class="secondary" onclick="openFolder('${node.id}')">Ouvrir le dossier</button></div>`;
  }
  return `<div class="graph-preview"><strong>${esc(node.label)}</strong><span>${esc(folderStatusLabel(node.status))} · ${Number(node.progress || 0)}%</span><span>${esc(folderPriorityLabel(node.priority))} · Échéance ${esc(node.source.deadline || "Non définie")}</span><button class="secondary" onclick="openProject('${node.id}')">Ouvrir le projet</button></div>`;
}

function renderFolderGraph() {
  const data = folderGraphData();
  const layout = folderGraphLayout(data);
  const selected = data.nodes.find(node => `${node.type}:${node.id}` === folderGraphSelected);
  const connectedIds = new Set();
  if (selected) {
    data.links.forEach(link => {
      if (selected.type === "folder" && link.folderId === selected.id) connectedIds.add(link.projectId);
      if (selected.type === "project" && link.projectId === selected.id) connectedIds.add(link.folderId);
    });
  }
  const visibleMap = new Map(data.nodes.map(node => [node.id, node]));
  const lines = data.links.map(link => {
    const a = layout.positions[link.folderId], b = layout.positions[link.projectId];
    if (!a || !b) return "";
    const active = selected && (selected.id === link.folderId || selected.id === link.projectId);
    return `<line class="graph-link ${active ? "active" : selected ? "dim" : ""}" data-folder-id="${esc(link.folderId)}" data-project-id="${esc(link.projectId)}" x1="${a.x + 118}" y1="${a.y}" x2="${b.x - 96}" y2="${b.y}" />`;
  }).join("");
  const nodes = data.nodes.map(node => {
    const pos = layout.positions[node.id] || { x: 0, y: 0 };
    const isSelected = selected?.id === node.id;
    const isDim = selected && !isSelected && !connectedIds.has(node.id);
    const onclick = node.type === "folder" ? `openFolder('${node.id}')` : `openProject('${node.id}')`;
    const badgeText = node.type === "folder" ? folderPriorityLabel(node.priority) : `${Number(node.progress || 0)}%`;
    return `<g class="graph-node ${node.type} ${isSelected ? "selected" : ""} ${isDim ? "dim" : ""}" data-node-type="${esc(node.type)}" data-node-id="${esc(node.id)}" transform="translate(${pos.x},${pos.y})" onmouseenter="previewFolderGraphNode('${node.type}','${node.id}')" onclick="${onclick}">
      <title>${esc(node.type === "folder" ? "Dossier" : "Projet")} · ${esc(node.label)}</title>
      <rect x="-108" y="-34" width="216" height="68" rx="${node.type === "folder" ? 14 : 28}"></rect>
      <text class="node-title" y="-5" text-anchor="middle">${esc(node.label.slice(0, 28))}</text>
      <text class="node-meta" y="16" text-anchor="middle">${esc(node.type === "folder" ? "Dossier" : "Projet")} · ${esc(badgeText)}</text>
    </g>`;
  }).join("");
  const viewWidth = layout.width / folderGraphZoom;
  const viewHeight = layout.height / folderGraphZoom;
  return `<div class="card folder-graph-card">
    <div class="graph-toolbar">
      <input value="${esc(folderGraphSearch)}" placeholder="Rechercher dans la carte" oninput="setFolderGraphSearch(this.value)">
      <select onchange="setFolderGraphFilter(this.value)">
        <option value="all" ${folderGraphFilter === "all" ? "selected" : ""}>Tous</option>
        <option value="folders" ${folderGraphFilter === "folders" ? "selected" : ""}>Dossiers uniquement</option>
        <option value="projects" ${folderGraphFilter === "projects" ? "selected" : ""}>Projets uniquement</option>
        <option value="red" ${folderGraphFilter === "red" ? "selected" : ""}>Critiques</option>
        <option value="orange" ${folderGraphFilter === "orange" ? "selected" : ""}>À suivre</option>
        <option value="active" ${folderGraphFilter === "active" ? "selected" : ""}>En cours</option>
      </select>
      <button class="secondary" onclick="zoomFolderGraph(1.18)">Zoom +</button>
      <button class="secondary" onclick="zoomFolderGraph(0.85)">Zoom -</button>
      <button class="secondary" onclick="resetFolderGraph()">Recentrer</button>
      <button class="secondary" onclick="selectFolderGraphNode('','')">Réinitialiser</button>
    </div>
    <div class="graph-layout">
      <svg class="folder-graph" viewBox="${folderGraphPan.x} ${folderGraphPan.y} ${viewWidth} ${viewHeight}" onwheel="folderGraphWheel(event)" onmousedown="startFolderGraphPan(event)" onmousemove="moveFolderGraphPan(event)" onmouseup="endFolderGraphPan()" onmouseleave="endFolderGraphPan()">
        <rect class="graph-bg" x="${folderGraphPan.x}" y="${folderGraphPan.y}" width="${viewWidth}" height="${viewHeight}"></rect>
        ${lines}${nodes}
      </svg>
      <aside><div class="graph-legend"><span><b class="legend-folder"></b>Dossier</span><span><b class="legend-project"></b>Projet</span><span>${data.nodes.length} nœud(s) · ${data.links.length} lien(s) réel(s)</span></div><div id="folderGraphPreview">${folderGraphPreview(selected)}</div></aside>
    </div>
  </div>`;
}

function setFolderGraphFilter(value) {
  folderGraphFilter = value;
  folderGraphSelected = "";
  renderFolders();
}

function setFolderGraphSearch(value) {
  folderGraphSearch = value;
  folderGraphSelected = "";
  renderFolders();
}

function selectFolderGraphNode(type, id) {
  folderGraphSelected = type && id ? `${type}:${id}` : "";
  renderFolders();
}

function previewFolderGraphNode(type, id) {
  const data = folderGraphData();
  const node = data.nodes.find(item => item.type === type && item.id === id);
  folderGraphSelected = node ? `${type}:${id}` : "";
  const preview = document.getElementById("folderGraphPreview");
  if (preview) preview.innerHTML = folderGraphPreview(node);
  document.querySelectorAll(".graph-node").forEach(el => {
    const isSelf = el.dataset.nodeType === type && el.dataset.nodeId === id;
    const connected = data.links.some(link => (type === "folder" && link.folderId === id && link.projectId === el.dataset.nodeId) || (type === "project" && link.projectId === id && link.folderId === el.dataset.nodeId));
    el.classList.toggle("selected", isSelf);
    el.classList.toggle("dim", Boolean(node) && !isSelf && !connected);
  });
  document.querySelectorAll(".graph-link").forEach(el => {
    const active = (type === "folder" && el.dataset.folderId === id) || (type === "project" && el.dataset.projectId === id);
    el.classList.toggle("active", active);
    el.classList.toggle("dim", Boolean(node) && !active);
  });
}

function zoomFolderGraph(ratio) {
  folderGraphZoom = Math.max(0.55, Math.min(2.4, folderGraphZoom * ratio));
  renderFolders();
}

function resetFolderGraph() {
  folderGraphZoom = 1;
  folderGraphPan = { x: 0, y: 0 };
  folderGraphSelected = "";
  renderFolders();
}

function folderGraphWheel(event) {
  event.preventDefault();
  zoomFolderGraph(event.deltaY < 0 ? 1.12 : 0.9);
}

function startFolderGraphPan(event) {
  if (event.target.closest(".graph-node")) return;
  folderGraphDrag = { x: event.clientX, y: event.clientY, panX: folderGraphPan.x, panY: folderGraphPan.y };
}

function moveFolderGraphPan(event) {
  if (!folderGraphDrag) return;
  folderGraphPan = { x: folderGraphDrag.panX - (event.clientX - folderGraphDrag.x) / folderGraphZoom, y: folderGraphDrag.panY - (event.clientY - folderGraphDrag.y) / folderGraphZoom };
  const svg = document.querySelector(".folder-graph");
  if (svg) {
    const [, , width, height] = String(svg.getAttribute("viewBox") || "0 0 1120 620").split(/\s+/).map(Number);
    svg.setAttribute("viewBox", `${folderGraphPan.x} ${folderGraphPan.y} ${width || 1120} ${height || 620}`);
  }
}

function endFolderGraphPan() {
  folderGraphDrag = null;
}

function renderFolders() {
  document.getElementById("viewTitle").textContent = "Dossiers";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "folders"));
  const notice = folderOperationNotice ? `<p class="folder-operation-notice">${esc(folderOperationNotice)}</p>` : "";
  const hero = `<div class="card hero folder-hero"><div class="row"><div><h2>Dossiers</h2><p class="muted">Regroupez ici tout ce qui concerne vos grands sujets durables.</p><p class="architecture-hint">Le dossier contient. Le projet transforme. L'action fait avancer. La décision arbitre.</p>${notice}</div><div class="row-actions">${folderViewToggle()}<button class="action" onclick="newFolder()">Nouveau dossier</button></div></div></div>`;
  folderOperationNotice = "";
  if (folderViewMode === "graph") {
    appHtml(`${hero}${renderFolderGraph()}`);
    return;
  }
  const categories = ["all", ...folderCategories];
  const filtered = state.folders.filter(f => {
    const q = folderSearch.toLowerCase().trim();
    const matchesSearch = !q || folderText(f).includes(q) || Object.values(folderRelations(f)).flat().some(item => `${item.title || item.name || ""}`.toLowerCase().includes(q));
    return matchesSearch && (folderCategoryFilter === "all" || f.category === folderCategoryFilter) && (folderStatusFilter === "all" || f.status === folderStatusFilter) && (folderPriorityFilter === "all" || f.priorityLevel === folderPriorityFilter);
  }).sort((a, b) => {
    if (folderSort === "priority") return levelRank(a.priorityLevel) - levelRank(b.priorityLevel);
    if (folderSort === "deadline") return dateRank(folderStats(a).nextDue) - dateRank(folderStats(b).nextDue);
    return String(folderStats(b).lastActivity || "").localeCompare(String(folderStats(a).lastActivity || ""));
  });
  appHtml(`${hero}<div class="card folder-toolbar"><input id="folderSearch" value="${esc(folderSearch)}" placeholder="Rechercher un dossier ou mot-clé" oninput="setFolderSearch(this.value)"><select onchange="setFolderFilter('category',this.value)">${categories.map(c => `<option value="${esc(c)}" ${folderCategoryFilter === c ? "selected" : ""}>${c === "all" ? "Toutes catégories" : esc(c)}</option>`).join("")}</select><select onchange="setFolderFilter('status',this.value)"><option value="all">Tous statuts</option><option value="green" ${folderStatusFilter === "green" ? "selected" : ""}>Maîtrisé</option><option value="orange" ${folderStatusFilter === "orange" ? "selected" : ""}>À suivre</option><option value="red" ${folderStatusFilter === "red" ? "selected" : ""}>Critique</option><option value="archived" ${folderStatusFilter === "archived" ? "selected" : ""}>Archivé</option></select><select onchange="setFolderFilter('priority',this.value)"><option value="all">Toutes priorités</option><option value="green" ${folderPriorityFilter === "green" ? "selected" : ""}>Normal</option><option value="orange" ${folderPriorityFilter === "orange" ? "selected" : ""}>Important</option><option value="red" ${folderPriorityFilter === "red" ? "selected" : ""}>Critique</option></select><select onchange="setFolderFilter('sort',this.value)"><option value="activity" ${folderSort === "activity" ? "selected" : ""}>Dernière activité</option><option value="priority" ${folderSort === "priority" ? "selected" : ""}>Priorité</option><option value="deadline" ${folderSort === "deadline" ? "selected" : ""}>Prochaine échéance</option></select></div><div class="grid two">${filtered.map(folderCard).join("") || `<div class="card empty">Aucun dossier ne correspond aux filtres.</div>`}</div>`);
}

function setFolderSearch(value) {
  folderSearch = value;
  renderFolders();
}

function setFolderFilter(type, value) {
  if (type === "category") folderCategoryFilter = value;
  if (type === "status") folderStatusFilter = value;
  if (type === "priority") folderPriorityFilter = value;
  if (type === "sort") folderSort = value;
  renderFolders();
}

function newFolder() {
  resetFolderDeletionDialog();
  document.getElementById("viewTitle").textContent = "Nouveau dossier";
  appHtml(folderForm({ id: "", name: "", category: "Performance", status: "orange", priorityLevel: "orange", owner: "", ownerId: "", linkedManagers: [], description: "", context: "", objectives: "", expectedResults: "", createdAt: isoToday(), deadline: "", tags: [], directorNotes: "" }, "create"));
}

function editFolder(id) {
  if (!folderDeletionDialog.open || !sameId(folderDeletionDialog.folderId, id)) resetFolderDeletionDialog();
  const folder = byId("folders", id);
  if (!folder) return renderFolders();
  document.getElementById("viewTitle").textContent = "Modifier " + folder.name;
  appHtml(folderForm(folder, "edit"));
}

function folderForm(folder, mode) {
  const isEdit = mode === "edit";
  const deletionPanel = isEdit ? renderFolderDeletionPanel(folder) : "";
  return `<div class="card"><h2>${mode === "create" ? "Nouveau dossier" : "Modifier dossier"}</h2><div class="form-grid"><input id="fName" value="${esc(folder.name)}" placeholder="Nom du dossier"><select id="fCategory">${folderCategories.map(c => `<option value="${esc(c)}" ${folder.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><select id="fStatus"><option value="green" ${folder.status === "green" ? "selected" : ""}>Maîtrisé</option><option value="orange" ${folder.status === "orange" ? "selected" : ""}>À suivre</option><option value="red" ${folder.status === "red" ? "selected" : ""}>Critique</option><option value="archived" ${folder.status === "archived" ? "selected" : ""}>Archivé</option></select><select id="fPriority"><option value="green" ${folder.priorityLevel === "green" ? "selected" : ""}>Normal</option><option value="orange" ${folder.priorityLevel === "orange" ? "selected" : ""}>Important</option><option value="red" ${folder.priorityLevel === "red" ? "selected" : ""}>Critique</option></select><input id="fOwner" value="${esc(folder.owner || "")}" placeholder="Responsable principal"><input id="fCreated" type="date" value="${esc(folder.createdAt || isoToday())}"><input id="fDeadline" type="date" value="${esc(folder.deadline || "")}"><input id="fTags" value="${esc((folder.tags || []).join(", "))}" placeholder="Mots-clés" class="full"></div><div class="manager-links"><label>Managers associés</label>${checkboxList("fManagers", state.managers, normalizeLinkedManagerIds(ensureArray(folder.linkedManagers).length ? folder.linkedManagers : ensureArray(folder.linkedManagerIds)), m => `${m.name} ? ${m.role || ""}`)}</div><textarea id="fDescription" placeholder="Description">${esc(folder.description || "")}</textarea><textarea id="fContext" placeholder="Contexte">${esc(folder.context || "")}</textarea><textarea id="fObjectives" placeholder="Objectifs">${esc(folder.objectives || "")}</textarea><textarea id="fExpected" placeholder="Résultats attendus">${esc(folder.expectedResults || "")}</textarea><textarea id="fNotes" placeholder="Notes du directeur">${esc(folder.directorNotes || "")}</textarea><div class="row-actions"><button class="action" onclick="${mode === "create" ? "saveNewFolder()" : `saveFolder('${folder.id}')`}">Enregistrer</button><button class="secondary" onclick="${mode === "create" ? "renderFolders()" : `openFolder('${folder.id}')`}">Annuler</button></div>${isEdit ? `<div class="folder-delete-zone"><button class="danger" type="button" onclick="openFolderDeletionDialog('${folder.id}')">Supprimer le dossier</button><p class="muted">Action destructrice limitée au dossier. Les objets liés seront conservés.</p></div>` : ""}${deletionPanel}</div>`;
}

function resetFolderDeletionDialog() {
  folderDeletionDialog = {
    open: false,
    folderId: "",
    step: 1,
    impact: null,
    confirmText: "",
    error: "",
    busy: false
  };
}

function folderDeleteImpactRows(impact) {
  const rows = [
    ["Projets", impact.projects],
    ["Actions", impact.actions],
    ["Décisions", impact.decisions],
    ["Priorités", impact.priorities],
    ["Managers", impact.managers],
    ["Rendez-vous manuels", impact.manualMeetings],
    ["Rendez-vous Google", impact.googleMeetings],
    ["Documents", impact.documents],
    ["Journal", impact.journal],
    ["Performance", impact.performance],
    ["Préparations de réunion", impact.meetingPreparations]
  ];
  return rows.map(([label, value]) => `<div class="folder-delete-impact-row"><strong>${esc(label)}</strong><span>${Number(value || 0)}</span></div>`).join("");
}

function renderFolderDeletionPanel(folder) {
  if (!folderDeletionDialog.open || !sameId(folderDeletionDialog.folderId, folder.id)) return "";
  const impact = folderDeletionDialog.impact || getFolderDeletionImpact(folder.id);
  const sentence = "Seul le Dossier sera supprimé. Les éléments liés seront conservés, mais leur liaison avec ce Dossier sera retirée.";
  const expectedPhrase = `Confirmer la suppression du dossier "${folder.name}"`;
  const hasError = folderDeletionDialog.error ? `<p class="folder-delete-error">${esc(folderDeletionDialog.error)}</p>` : "";
  if (folderDeletionDialog.step === 1) {
    return `<div class="folder-delete-panel"><h3>Étape 1 — Aperçu des conséquences</h3><p><strong>${esc(folder.name)}</strong> · ${esc(folderStatusLabel(folder.status))}</p><div class="folder-delete-impact">${folderDeleteImpactRows(impact)}</div><p class="muted">${sentence}</p>${hasError}<div class="row-actions"><button class="secondary" type="button" onclick="cancelFolderDeletion()">Annuler</button><button class="danger" type="button" onclick="goFolderDeletionStep2()">Continuer</button></div></div>`;
  }
  return `<div class="folder-delete-panel"><h3>Étape 2 — Confirmation explicite</h3><p class="muted">Saisissez exactement la phrase suivante pour confirmer.</p><p><strong>${esc(expectedPhrase)}</strong></p><input id="folderDeleteConfirmInput" value="${esc(folderDeletionDialog.confirmText || "")}" oninput="setFolderDeletionConfirmText(this.value)" placeholder="Confirmer la suppression"><p class="muted">${sentence}</p>${hasError}<div class="row-actions"><button class="secondary" type="button" onclick="cancelFolderDeletion()">Annuler</button><button class="danger" type="button" ${folderDeletionDialog.busy ? "disabled" : ""} onclick="confirmFolderDeletion('${folder.id}')">Supprimer définitivement</button></div></div>`;
}

function objectReferencesFolder(item, folderId) {
  const target = String(folderId || "");
  if (!target || !item || typeof item !== "object") return false;
  if (sameId(item.folderId, target)) return true;
  const linked = [
    ...ensureArray(item.linkedFolders),
    ...ensureArray(item.linkedFolderIds)
  ].map(x => String(x));
  return linked.some(id => sameId(id, target));
}

function getFolderDeletionImpact(folderId) {
  const target = String(folderId || "");
  if (!target) return {
    projects: 0,
    actions: 0,
    decisions: 0,
    priorities: 0,
    managers: 0,
    manualMeetings: 0,
    googleMeetings: 0,
    documents: 0,
    journal: 0,
    performance: 0,
    meetingPreparations: 0
  };
  const uniqueCount = (items, predicate) => new Set(ensureArray(items).filter(predicate).map(item => String(item.id || item._key || item.eventKey || item.externalId || ""))).size;
  const manualMeetingIds = new Set(state.agenda.filter(item => objectReferencesFolder(item, target)).map(item => String(item.id)));
  const googleMeetingIds = new Set(Object.entries(state.externalEventEnrichments || {}).filter(([, enrichment]) => objectReferencesFolder(enrichment, target)).map(([eventKey]) => String(eventKey)));
  const prepIds = new Set(state.meetingPreparations.filter(prep => {
    if (objectReferencesFolder(prep, target)) return true;
    const hasIdea = ensureArray(prep.ideas).some(idea => sameId(idea.folderId, target));
    const hasTopic = ensureArray(prep.agendaTopics).some(topic => sameId(topic.folderId, target));
    return hasIdea || hasTopic;
  }).map(prep => String(prep.id)));
  return {
    projects: uniqueCount(state.projects, item => objectReferencesFolder(item, target)),
    actions: uniqueCount(state.actions, item => objectReferencesFolder(item, target)),
    decisions: uniqueCount(state.decisions, item => objectReferencesFolder(item, target)),
    priorities: uniqueCount(state.priorities, item => objectReferencesFolder(item, target)),
    managers: uniqueCount(state.managers, item => objectReferencesFolder(item, target)),
    manualMeetings: manualMeetingIds.size,
    googleMeetings: googleMeetingIds.size,
    documents: uniqueCount(state.documents, item => objectReferencesFolder(item, target)),
    journal: uniqueCount(state.journal, item => objectReferencesFolder(item, target)),
    performance: uniqueCount(state.performance, item => objectReferencesFolder(item, target)),
    meetingPreparations: prepIds.size
  };
}

function openFolderDeletionDialog(folderId) {
  const folder = byId("folders", folderId);
  if (!folder) return renderFolders();
  folderDeletionDialog = {
    open: true,
    folderId: String(folderId),
    step: 1,
    impact: getFolderDeletionImpact(folderId),
    confirmText: "",
    error: "",
    busy: false
  };
  editFolder(folderId);
}

function cancelFolderDeletion() {
  const folderId = folderDeletionDialog.folderId;
  resetFolderDeletionDialog();
  if (folderId) return editFolder(folderId);
  renderFolders();
}

function goFolderDeletionStep2() {
  if (!folderDeletionDialog.open || !folderDeletionDialog.folderId) return;
  folderDeletionDialog.step = 2;
  folderDeletionDialog.error = "";
  editFolder(folderDeletionDialog.folderId);
}

function setFolderDeletionConfirmText(value) {
  folderDeletionDialog.confirmText = String(value || "");
}

function removeFolderReferencesFromItem(item, folderId) {
  const target = String(folderId || "");
  if (!target || !item || typeof item !== "object") return { item, changed: false };
  let changed = false;
  const next = { ...item };
  if (Object.prototype.hasOwnProperty.call(next, "linkedFolders")) {
    const before = ensureArray(next.linkedFolders);
    const after = normalizeLinkedIdArray(before.filter(id => !sameId(id, target)));
    if (before.length !== after.length || before.some((id, index) => String(id) !== String(after[index] || ""))) changed = true;
    next.linkedFolders = after;
  }
  if (Object.prototype.hasOwnProperty.call(next, "linkedFolderIds")) {
    const before = ensureArray(next.linkedFolderIds);
    const after = normalizeLinkedIdArray(before.filter(id => !sameId(id, target)));
    if (before.length !== after.length || before.some((id, index) => String(id) !== String(after[index] || ""))) changed = true;
    next.linkedFolderIds = after;
  }
  if (Object.prototype.hasOwnProperty.call(next, "folderId") && sameId(next.folderId, target)) {
    next.folderId = "";
    changed = true;
  }
  return { item: changed ? next : item, changed };
}

function sanitizeMeetingPreparationFolderLinks(prep, folderId) {
  const cleanedPrep = removeFolderReferencesFromItem(prep, folderId);
  let changed = cleanedPrep.changed;
  const next = { ...cleanedPrep.item };
  const cleanedIdeas = ensureArray(next.ideas).map(idea => {
    const cleaned = removeFolderReferencesFromItem(idea, folderId);
    if (cleaned.changed) changed = true;
    return cleaned.item;
  });
  const cleanedTopics = ensureArray(next.agendaTopics).map(topic => {
    const cleaned = removeFolderReferencesFromItem(topic, folderId);
    if (cleaned.changed) changed = true;
    return cleaned.item;
  });
  if (changed) {
    next.ideas = cleanedIdeas;
    next.agendaTopics = cleanedTopics;
  }
  return { item: changed ? next : prep, changed };
}

function persistExternalEventEnrichmentsOnly() {
  localStorage.setItem("deos_external_event_enrichments", JSON.stringify(state.externalEventEnrichments || {}));
}

function deleteFolderSafely(folderId, options = {}) {
  const target = String(folderId || "");
  const folder = byId("folders", target);
  if (!folder) throw new Error("Dossier introuvable.");
  const phrase = `Confirmer la suppression du dossier "${folder.name}"`;
  if (options.requirePhrase !== false && String(options.confirmText || "").trim() !== phrase) {
    throw new Error("Confirmation invalide. La suppression a été annulée.");
  }

  const snapshot = {
    folders: JSON.parse(JSON.stringify(state.folders)),
    projects: JSON.parse(JSON.stringify(state.projects)),
    actions: JSON.parse(JSON.stringify(state.actions)),
    decisions: JSON.parse(JSON.stringify(state.decisions)),
    priorities: JSON.parse(JSON.stringify(state.priorities)),
    managers: JSON.parse(JSON.stringify(state.managers)),
    journal: JSON.parse(JSON.stringify(state.journal)),
    documents: JSON.parse(JSON.stringify(state.documents)),
    agenda: JSON.parse(JSON.stringify(state.agenda)),
    performance: JSON.parse(JSON.stringify(state.performance)),
    meetingPreparations: JSON.parse(JSON.stringify(state.meetingPreparations)),
    externalEventEnrichments: JSON.parse(JSON.stringify(state.externalEventEnrichments || {}))
  };

  const failAt = String(options.simulateFailureAt || folderDeletionFailureMode || "");
  const changed = new Set();
  const applyCollectionCleanup = (name, sanitizer) => {
    let touched = false;
    state[name] = state[name].map(item => {
      const cleaned = sanitizer(item, target);
      if (cleaned.changed) touched = true;
      return cleaned.item;
    });
    if (touched) changed.add(name);
  };

  try {
    const folderIndex = indexById("folders", target);
    if (folderIndex < 0) throw new Error("Dossier introuvable.");
    state.folders.splice(folderIndex, 1);
    changed.add("folders");

    if (failAt === "after_folder_removal") throw new Error("Erreur simulée après suppression du dossier.");

    const simpleSanitizer = (item, id) => removeFolderReferencesFromItem(item, id);
    applyCollectionCleanup("projects", simpleSanitizer);
    applyCollectionCleanup("actions", simpleSanitizer);
    applyCollectionCleanup("decisions", simpleSanitizer);
    applyCollectionCleanup("priorities", simpleSanitizer);
    applyCollectionCleanup("managers", simpleSanitizer);
    applyCollectionCleanup("journal", simpleSanitizer);
    applyCollectionCleanup("documents", simpleSanitizer);
    applyCollectionCleanup("agenda", simpleSanitizer);
    applyCollectionCleanup("performance", simpleSanitizer);
    applyCollectionCleanup("meetingPreparations", sanitizeMeetingPreparationFolderLinks);

    let externalChanged = false;
    const nextEnrichments = {};
    Object.entries(state.externalEventEnrichments || {}).forEach(([eventKey, enrichment]) => {
      const cleaned = removeFolderReferencesFromItem(enrichment, target);
      if (cleaned.changed) externalChanged = true;
      nextEnrichments[eventKey] = cleaned.item;
    });
    if (externalChanged) {
      state.externalEventEnrichments = nextEnrichments;
      changed.add("externalEventEnrichments");
    }

    if (failAt === "after_cleanup") throw new Error("Erreur simulée après nettoyage des références.");

    changed.forEach(name => {
      if (name === "externalEventEnrichments") {
        persistExternalEventEnrichmentsOnly();
      } else {
        persist(name);
      }
    });

    if (graphSelectedNodeId && sameId(graphSelectedNodeId, graphNodeId("folder", target))) graphSelectedNodeId = "";
    graphLayoutCache = null;
    graphDataSignature = "";

    addActivity("Dossier supprimé", folder.name, "Suppression sécurisée sans cascade", folder.id);
    resetFolderDeletionDialog();
    folderOperationNotice = `Dossier supprimé : ${folder.name}. Les liaisons ont été nettoyées sans suppression en cascade.`;
    renderFolders();
    return true;
  } catch (error) {
    state.folders = snapshot.folders;
    state.projects = snapshot.projects;
    state.actions = snapshot.actions;
    state.decisions = snapshot.decisions;
    state.priorities = snapshot.priorities;
    state.managers = snapshot.managers;
    state.journal = snapshot.journal;
    state.documents = snapshot.documents;
    state.agenda = snapshot.agenda;
    state.performance = snapshot.performance;
    state.meetingPreparations = snapshot.meetingPreparations;
    state.externalEventEnrichments = snapshot.externalEventEnrichments;

    persist("folders");
    persist("projects");
    persist("actions");
    persist("decisions");
    persist("priorities");
    persist("managers");
    persist("journal");
    persist("documents");
    persist("agenda");
    persist("performance");
    persist("meetingPreparations");
    persistExternalEventEnrichmentsOnly();

    folderDeletionDialog.open = true;
    folderDeletionDialog.folderId = target;
    folderDeletionDialog.step = 2;
    folderDeletionDialog.impact = getFolderDeletionImpact(target);
    folderDeletionDialog.busy = false;
    folderDeletionDialog.error = `Échec de suppression : ${error?.message || "Erreur inconnue"}`;
    console.error("[DEOS V5.15.1] deleteFolderSafely rollback", error);
    editFolder(target);
    return false;
  }
}

function confirmFolderDeletion(folderId) {
  if (!folderDeletionDialog.open || !sameId(folderDeletionDialog.folderId, folderId)) return;
  folderDeletionDialog.busy = true;
  folderDeletionDialog.error = "";
  try {
    const ok = deleteFolderSafely(folderId, { confirmText: folderDeletionDialog.confirmText });
    if (!ok) return;
  } catch (error) {
    folderDeletionDialog.busy = false;
    folderDeletionDialog.error = `Échec de suppression : ${error?.message || "Erreur inconnue"}`;
    editFolder(folderId);
  }
}

function readFolderForm(existing = {}) {
  const { linkedManagerIds: _legacyLinkedManagerIds, ...safeExisting } = existing || {};
  const name = document.getElementById("fName").value.trim();
  if (!name) return null;
  const owner = document.getElementById("fOwner").value.trim();
  const ownerManager = state.managers.find(m => String(m.name || "").trim().toLowerCase() === owner.toLowerCase());
  return {
    ...safeExisting,
    name,
    category: document.getElementById("fCategory").value,
    status: document.getElementById("fStatus").value,
    priorityLevel: document.getElementById("fPriority").value,
    owner,
    ownerId: ownerManager?.id || safeExisting.ownerId || "",
    createdAt: document.getElementById("fCreated").value || isoToday(),
    deadline: document.getElementById("fDeadline").value,
    tags: splitTags(document.getElementById("fTags").value),
    linkedManagers: normalizeLinkedManagerIds(checkedValues("fManagers")),
    description: document.getElementById("fDescription").value.trim(),
    context: document.getElementById("fContext").value.trim(),
    objectives: document.getElementById("fObjectives").value.trim(),
    expectedResults: document.getElementById("fExpected").value.trim(),
    directorNotes: document.getElementById("fNotes").value.trim()
  };
}

function syncFolderManagersFromManager(managerId, previousFolderIds, nextFolderIds) {
  const manager = String(managerId || "");
  if (!manager) return false;
  const before = normalizeLinkedIdArray(previousFolderIds);
  const after = normalizeLinkedIdArray(nextFolderIds);
  const added = after.filter(folderId => !before.some(prevId => sameId(prevId, folderId)));
  const removed = before.filter(folderId => !after.some(nextId => sameId(nextId, folderId)));
  if (!added.length && !removed.length) return false;

  let changed = false;
  state.folders = state.folders.map(folder => {
    const folderId = String(folder.id || "");
    const shouldAdd = added.some(id => sameId(id, folderId));
    const shouldRemove = removed.some(id => sameId(id, folderId));
    if (!shouldAdd && !shouldRemove) return folder;

    const nextLinked = normalizeLinkedManagerIds(folder.linkedManagers);
    const withAdded = shouldAdd && !nextLinked.some(id => sameId(id, manager))
      ? [...nextLinked, manager]
      : nextLinked;
    const withRemoved = shouldRemove
      ? withAdded.filter(id => !sameId(id, manager))
      : withAdded;
    const normalized = normalizeLinkedManagerIds(withRemoved);

    const linkChanged = normalized.length !== nextLinked.length
      || normalized.some((id, index) => String(id) !== String(nextLinked[index] || ""));
    if (!linkChanged) return folder;
    changed = true;
    return { ...folder, linkedManagers: normalized };
  });

  return changed;
}

function managerLinkedProjectIds(managerId) {
  const target = String(managerId || "");
  if (!target) return [];
  return normalizeLinkedIdArray(state.projects.filter(project => normalizeLinkedManagerIds(ensureArray(project.linkedManagers)).some(id => sameId(id, target))).map(project => project.id));
}

function syncProjectsFromManager(managerId, previousProjectIds, nextProjectIds) {
  const manager = String(managerId || "");
  if (!manager) return false;
  const before = normalizeLinkedIdArray(previousProjectIds);
  const after = normalizeLinkedIdArray(nextProjectIds);
  const added = after.filter(projectId => !before.some(prevId => sameId(prevId, projectId)));
  const removed = before.filter(projectId => !after.some(nextId => sameId(nextId, projectId)));
  if (!added.length && !removed.length) return false;

  let changed = false;
  state.projects = state.projects.map(project => {
    const projectId = String(project.id || "");
    const shouldAdd = added.some(id => sameId(id, projectId));
    const shouldRemove = removed.some(id => sameId(id, projectId));
    if (!shouldAdd && !shouldRemove) return project;

    const currentManagers = normalizeLinkedManagerIds(ensureArray(project.linkedManagers).length ? project.linkedManagers : ensureArray(project.linkedManagerIds));
    const withAdded = shouldAdd && !currentManagers.some(id => sameId(id, manager))
      ? [...currentManagers, manager]
      : currentManagers;
    const withRemoved = shouldRemove
      ? withAdded.filter(id => !sameId(id, manager))
      : withAdded;
    const normalized = normalizeLinkedManagerIds(withRemoved);

    const linkChanged = normalized.length !== currentManagers.length
      || normalized.some((id, index) => String(id) !== String(currentManagers[index] || ""));
    if (!linkChanged) return project;
    changed = true;
    return { ...project, linkedManagers: normalized };
  });

  return changed;
}

function syncManagerFoldersFromFolder(folderId, previousManagerIds, nextManagerIds) {
  const folder = String(folderId || "");
  if (!folder) return false;
  const before = normalizeLinkedManagerIds(previousManagerIds);
  const after = normalizeLinkedManagerIds(nextManagerIds);
  const added = after.filter(managerId => !before.some(prevId => sameId(prevId, managerId)));
  const removed = before.filter(managerId => !after.some(nextId => sameId(nextId, managerId)));
  if (!added.length && !removed.length) return false;

  let changed = false;
  state.managers = state.managers.map(manager => {
    const managerId = String(manager.id || "");
    const shouldAdd = added.some(id => sameId(id, managerId));
    const shouldRemove = removed.some(id => sameId(id, managerId));
    if (!shouldAdd && !shouldRemove) return manager;

    const currentFolders = normalizeLinkedIdArray(manager.linkedFolders);
    const withAdded = shouldAdd && !currentFolders.some(id => sameId(id, folder))
      ? [...currentFolders, folder]
      : currentFolders;
    const withRemoved = shouldRemove
      ? withAdded.filter(id => !sameId(id, folder))
      : withAdded;
    const normalized = normalizeLinkedIdArray(withRemoved);

    const folderChanged = normalized.length !== currentFolders.length
      || normalized.some((id, index) => String(id) !== String(currentFolders[index] || ""));
    if (!folderChanged) return manager;
    changed = true;
    return { ...manager, linkedFolders: normalized };
  });

  return changed;
}

function saveNewFolder() {
  const folder = readFolderForm({ id: newId("folder") });
  if (!folder) return;
  state.folders.unshift(normalizeEntity("folders", folder));
  persist("folders");
  addActivity("Dossier", folder.name, folder.category, folder.id);
  resetFolderDeletionDialog();
  openFolder(folder.id);
}

function saveFolder(id) {
  const i = indexById("folders", id);
  if (i < 0) return;
  const previousManagerIds = normalizeLinkedManagerIds(state.folders[i].linkedManagers);
  const folder = readFolderForm(state.folders[i]);
  if (!folder) return;
  state.folders[i] = normalizeEntity("folders", folder);
  const nextManagerIds = normalizeLinkedManagerIds(state.folders[i].linkedManagers);
  const managerSyncChanged = syncManagerFoldersFromFolder(id, previousManagerIds, nextManagerIds);
  persist("folders");
  if (managerSyncChanged) persist("managers");
  addActivity("Dossier modifié", folder.name, folder.category, folder.id);
  resetFolderDeletionDialog();
  openFolder(id);
}

function openFolder(id, mode = "") {
  const folder = byId("folders", id);
  if (!folder) return renderFolders();
  const stats = folderStats(folder);
  const rel = stats.rel;
  document.getElementById("viewTitle").textContent = folder.name;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderFolders()">Retour Dossiers</button><h2>${esc(folder.name)}</h2><p>${esc(folder.category)} · ${esc(folderPriorityLabel(folder.priorityLevel))}</p><p class="architecture-hint">Ce dossier contient les objets liés à ce grand sujet : projets, actions, décisions, réunions, documents et journal.</p>${badge(folder.status)}<span class="meta">Responsable ${esc(folder.owner || "À définir")} · Créé le ${esc(folder.createdAt || "Non défini")} · Échéance ${esc(folder.deadline || "Non définie")} · Dernière activité ${esc(stats.lastActivity || "Aucune")}</span><div class="folder-tags">${(folder.tags || []).map(t => `<span>${esc(t)}</span>`).join("")}</div><div class="row-actions"><button class="action" onclick="editFolder('${folder.id}')">Modifier</button><button class="secondary" onclick="startReport('folders','${folder.id}')">Générer un compte rendu</button><button class="secondary" onclick="openFolder('${folder.id}','project')">+ Projet</button><button class="secondary" onclick="openFolder('${folder.id}','action')">+ Action</button><button class="secondary" onclick="openFolder('${folder.id}','decision')">+ Décision</button><button class="secondary" onclick="openFolder('${folder.id}','agenda')">+ Réunion</button><button class="secondary" onclick="openFolder('${folder.id}','journal')">+ Journal</button><button class="secondary" onclick="openFolder('${folder.id}','document')">+ Document</button></div></div><div class="grid two">${folderQuickForm(folder, mode)}<div class="card full-span"><h2>Synthèse du dossier</h2><div class="folder-summary-grid"><p><strong>Statut :</strong> ${esc(folderStatusLabel(folder.status))}</p><p><strong>Criticité :</strong> ${esc(folderPriorityLabel(folder.priorityLevel))}</p><p><strong>Responsable :</strong> ${esc(folder.owner || "À définir")}</p><p><strong>Échéance :</strong> ${esc(folder.deadline || "Non définie")}</p></div><p><strong>Périmètre :</strong> ${esc(folder.description || "À compléter")}</p><p><strong>Contexte :</strong> ${esc(folder.context || "À compléter")}</p><p><strong>Objectif :</strong> ${esc(folder.objectives || "À compléter")}</p><p><strong>Résultats attendus :</strong> ${esc(folder.expectedResults || "À compléter")}</p><p><strong>Notes du directeur :</strong> ${esc(folder.directorNotes || "À compléter")}</p></div><div class="card full-span"><h2>Vue transversale</h2><div class="folder-kpis">${folderKpi("Projets", rel.projects.length, "folder-projects")}${folderKpi("Actions ouvertes", stats.openActions, "folder-actions")}${folderKpi("En retard", stats.overdueActions, "folder-actions")}${folderKpi("Décisions", rel.decisions.length, "folder-decisions")}${folderKpi("Réunions", stats.meetings, "folder-agenda")}${folderKpi("Documents", rel.documents.length, "folder-documents")}${folderKpi("Journal", rel.journal.length, "folder-journal")}</div></div><div id="folder-projects" class="card full-span"><div class="row"><h2>Projets liés</h2><button class="secondary" onclick="openFolder('${folder.id}','project')">+ Créer un projet</button></div>${folderProjectsList(rel.projects, folder.id)}</div><div class="card"><h2>Managers concernés</h2>${folderManagersList(rel.managers, folder)}</div><div id="folder-actions" class="card"><div class="row"><h2>Actions liées</h2><button class="secondary" onclick="openFolder('${folder.id}','action')">+ Créer une action</button></div>${folderActionsList(rel.actions, folder.id)}</div><div class="card"><h2>Priorités liées</h2>${folderPrioritiesList(rel.priorities)}</div><div id="folder-decisions" class="card"><div class="row"><h2>Décisions liées</h2><button class="secondary" onclick="openFolder('${folder.id}','decision')">+ Créer une décision</button></div>${folderDecisionsList(rel.decisions, folder.id)}</div><div id="folder-journal" class="card"><div class="row"><h2>Journal</h2><button class="secondary" onclick="openFolder('${folder.id}','journal')">+ Créer une entrée</button></div>${folderJournalList(rel.journal, folder.id)}</div><div id="folder-documents" class="card"><div class="row"><h2>Documents</h2><button class="secondary" onclick="openFolder('${folder.id}','document')">+ Créer un document</button></div>${folderDocumentsList(rel.documents, folder.id)}</div><div id="folder-agenda" class="card"><div class="row"><h2>Réunions</h2><button class="secondary" onclick="openFolder('${folder.id}','agenda')">+ Créer une réunion</button></div>${folderAgendaList(rel.agenda, folder.id)}</div><div class="card full-span"><h2>Activité récente</h2>${rel.activity.slice(0, 12).map(cockpitActivityItem).join("") || `<div class="empty">Aucune activité liée.</div>`}</div></div>`);
}

function folderKpi(label, value, targetId) {
  return `<button class="folder-kpi" onclick="scrollFolderSection('${targetId}')"><strong>${value}</strong><small>${esc(label)}</small></button>`;
}

function scrollFolderSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function folderQuickForm(folder, mode) {
  if (!mode) return "";
  if (mode === "project") return `<div class="card full-span"><h2>Nouveau projet lié</h2><div class="form-grid"><input id="fprName" placeholder="Nom du projet"><input id="fprDeadline" type="date"><input id="fprOwner" value="${esc(folder.owner || "")}" placeholder="Responsable principal"><select id="fprStatus"><option value="green">Maîtrisé</option><option value="orange" selected>À suivre</option><option value="red">Critique</option></select></div><textarea id="fprObjective" placeholder="Objectif"></textarea><button class="action" onclick="saveFolderProject('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  if (mode === "action") return `<div class="card full-span"><h2>Nouvelle action liée</h2><input id="faTitle" placeholder="Titre de l'action"><input id="faDue" type="date"><input id="faOwner" placeholder="Responsable"><button class="action" onclick="saveFolderAction('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  if (mode === "priority") return `<div class="card full-span"><h2>Nouvelle priorité liée</h2><input id="fpTitle" placeholder="Titre"><input id="fpDue" type="date"><select id="fpLevel"><option value="green">Normal</option><option value="orange" selected>Important</option><option value="red">Critique</option></select><button class="action" onclick="saveFolderPriority('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  if (mode === "decision") return `<div class="card full-span"><h2>Nouvelle décision liée</h2><input id="fdTitle" placeholder="Titre"><textarea id="fdContext" placeholder="Contexte"></textarea><button class="action" onclick="saveFolderDecision('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  if (mode === "journal") return `<div class="card full-span"><h2>Nouvelle entrée Journal liée</h2><input id="fjTitle" placeholder="Titre"><textarea id="fjSummary" placeholder="Résumé"></textarea><button class="action" onclick="saveFolderJournal('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  if (mode === "document") return `<div class="card full-span"><h2>Nouveau document lié</h2><input id="fdocTitle" placeholder="Titre"><input id="fdocType" placeholder="Type"><textarea id="fdocContent" placeholder="Contenu"></textarea><button class="action" onclick="saveFolderDocument('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  if (mode === "agenda") return `<div class="card full-span"><h2>Nouveau rendez-vous lié</h2><div class="form-grid"><input id="fagDate" type="date" value="${localIsoDate()}"><label class="check-row"><input id="fagAllDay" type="checkbox" onchange="toggleFolderQuickAgendaTimeFields()"> Journée entière</label><div class="time-row"><input id="fagStart" type="time" value=""><input id="fagEnd" type="time" value=""></div><input id="fagTitle" placeholder="Titre"><select id="fagType"><option>Projet</option><option>CODIR</option><option>Exploitation</option><option>RH</option><option>CSE</option><option>Entretien manager</option><option>Autre</option></select><input id="fagLocation" placeholder="Lieu"></div><textarea id="fagNotes" placeholder="Notes"></textarea><button class="action" onclick="saveFolderAgenda('${folder.id}')">Enregistrer</button><button class="secondary" onclick="openFolder('${folder.id}')">Annuler</button></div>`;
  return "";
}

function toggleFolderQuickAgendaTimeFields() {
  const allDay = document.getElementById("fagAllDay")?.checked;
  const start = document.getElementById("fagStart");
  const end = document.getElementById("fagEnd");
  if (!start || !end) return;
  if (allDay) {
    start.disabled = true;
    end.disabled = true;
    start.classList.add("muted");
    end.classList.add("muted");
  } else {
    start.disabled = false;
    end.disabled = false;
    start.classList.remove("muted");
    end.classList.remove("muted");
  }
}

function readFolderAgendaForm(folderId) {
  const folder = byId("folders", folderId);
  if (!folder) return null;
  const title = document.getElementById("fagTitle")?.value.trim();
  const date = document.getElementById("fagDate")?.value || "";
  const allDay = document.getElementById("fagAllDay")?.checked || false;
  const start = document.getElementById("fagStart")?.value.trim();
  const end = document.getElementById("fagEnd")?.value.trim();
  const notes = document.getElementById("fagNotes")?.value.trim();
  if (!date) {
    alert("La date est obligatoire.");
    return null;
  }
  if (!title) {
    alert("Le titre est obligatoire.");
    return null;
  }
  if (end && !start) {
    alert("Heure de fin sans heure de début impossible.");
    return null;
  }
  if (start && end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (Number.isFinite(sh) && Number.isFinite(eh)) {
      const smins = sh * 60 + (Number.isFinite(sm) ? sm : 0);
      const emins = eh * 60 + (Number.isFinite(em) ? em : 0);
      if (emins < smins) {
        alert("L'heure de fin ne peut pas être antérieure à l'heure de début.");
        return null;
      }
    }
  }
  return {
    id: newId("agenda"),
    createdAt: localIsoDate(),
    updatedAt: localIsoDate(),
    source: "manual",
    externalId: "",
    calendarId: "",
    syncStatus: "local",
    lastSyncedAt: "",
    date,
    startTime: allDay ? "" : (start || ""),
    time: allDay ? "" : (start || ""),
    endTime: allDay ? "" : (end || ""),
    title,
    type: document.getElementById("fagType")?.value || "",
    location: document.getElementById("fagLocation")?.value.trim(),
    notes,
    detail: notes,
    allDay,
    linkedManagers: folder.linkedManagers || [],
    linkedProjects: [],
    linkedFolders: [folder.id]
  };
}

function saveFolderAction(folderId) {
  const folder = byId("folders", folderId);
  const title = document.getElementById("faTitle").value.trim();
  if (!folder || !title) return;
  const a = { id: newId("action"), title, link: folder.name, owner: document.getElementById("faOwner").value.trim(), due: document.getElementById("faDue").value, done: false, linkedFolders: [folder.id] };
  state.actions.unshift(a);
  persist("actions");
  addActivity("Action", a.title, folder.name, a.id);
  openFolder(folder.id);
}

function saveFolderProject(folderId) {
  const folder = byId("folders", folderId);
  const name = document.getElementById("fprName").value.trim();
  if (!folder || !name) return;
  const ownerName = document.getElementById("fprOwner").value.trim();
  const owner = state.managers.find(m => m.name === ownerName);
  const p = { id: newId("project"), name, status: document.getElementById("fprStatus").value, progress: 0, objective: document.getElementById("fprObjective").value.trim(), context: folder.context || folder.description || "", owner: ownerName, ownerId: owner?.id || "", linkedManagers: folder.linkedManagers || [], linkedFolders: [folder.id], launchDate: isoToday(), deadline: document.getElementById("fprDeadline").value, next: "", priorityLevel: folder.priorityLevel || "orange", risks: "", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [] };
  state.projects.unshift(p);
  persist("projects");
  addActivity("Projet", p.name, folder.name, p.id);
  openFolder(folder.id);
}

function saveFolderPriority(folderId) {
  const folder = byId("folders", folderId);
  const title = document.getElementById("fpTitle").value.trim();
  if (!folder || !title) return;
  const p = { id: newId("priority"), title, due: document.getElementById("fpDue").value, link: folder.name, owner: folder.owner, impact: "", level: document.getElementById("fpLevel").value, done: false, linkedFolders: [folder.id] };
  state.priorities.unshift(p);
  persist("priorities");
  addActivity("Priorité", p.title, folder.name, p.id);
  openFolder(folder.id);
}

function saveFolderDecision(folderId) {
  const folder = byId("folders", folderId);
  const title = document.getElementById("fdTitle").value.trim();
  if (!folder || !title) return;
  const d = { id: newId("decision"), title, context: document.getElementById("fdContext").value.trim(), date: today(), status: "decided", importance: folder.priorityLevel || "orange", problem: "", decision: "", rationale: "", alternatives: "", impacts: "", risks: "", owner: folder.owner, linkedManagers: folder.linkedManagers || [], linkedProjects: [], linkedActions: [], linkedDocuments: [], linkedFolders: [folder.id], reviewDate: "", events: [], directorNotes: [], nextStep: "", tags: folder.tags || [] };
  state.decisions.unshift(d);
  persist("decisions");
  addActivity("Décision", d.title, folder.name, d.id);
  openFolder(folder.id);
}

function saveFolderJournal(folderId) {
  const folder = byId("folders", folderId);
  const title = document.getElementById("fjTitle").value.trim();
  if (!folder || !title) return;
  const j = { id: newId("journal"), title, date: today(), entryType: "Note rapide", summary: document.getElementById("fjSummary").value.trim(), content: document.getElementById("fjSummary").value.trim(), facts: "", analysis: "", decisionsText: "", actionsText: "", linkedManagers: folder.linkedManagers || [], linkedProjects: [], linkedDecisions: [], linkedActions: [], linkedDocuments: [], linkedFolders: [folder.id], watchPoints: "", nextSteps: "", notes: "", events: [], tags: folder.tags || [] , mood: "", links: "" };
  state.journal.unshift(j);
  persist("journal");
  addActivity("Journal", j.title, folder.name, j.id);
  openFolder(folder.id);
}

function saveFolderDocument(folderId) {
  const folder = byId("folders", folderId);
  const title = document.getElementById("fdocTitle").value.trim();
  if (!folder || !title) return;
  const d = { id: newId("document"), title, type: document.getElementById("fdocType").value.trim(), status: "Brouillon", owner: folder.owner, updatedAt: isoToday(), tags: folder.tags || [], content: document.getElementById("fdocContent").value.trim(), linkedFolders: [folder.id] };
  state.documents.unshift(d);
  persist("documents");
  addActivity("Document", d.title, folder.name, d.id);
  openFolder(folder.id);
}

function saveFolderAgenda(folderId) {
  const folder = byId("folders", folderId);
  if (!folder) return;
  const a = readFolderAgendaForm(folderId);
  if (!a) return;
  state.agenda.push(a);
  persist("agenda");
  addActivity("Agenda", a.title, folder.name, a.id);
  openFolder(folder.id);
}

function folderEmpty(folderId, type, label) {
  return `<div class="empty">Aucun ${esc(label)} lié à ce dossier.<br><button class="secondary" onclick="openFolder('${folderId}','${type}')">+ Créer</button></div>`;
}

function folderProjectsList(items, folderId) {
  const sorted = [...items].sort((a, b) => levelRank(a.status) - levelRank(b.status) || dateRank(a.deadline) - dateRank(b.deadline));
  return sorted.map(p => `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(folderStatusLabel(p.status))} · ${Number(p.progress || 0)}% · ${esc(projectOwnerName(p) || "Responsable à définir")}</span><span class="meta">Échéance ${esc(p.deadline || "Non définie")} · ${esc(p.next || "Prochaine étape à définir")}</span></div>`).join("") || folderEmpty(folderId, "project", "projet");
}

function folderManagersList(items, folder) {
  const linkedManagerIds = normalizeLinkedManagerIds(ensureArray(folder?.linkedManagers).length ? folder.linkedManagers : ensureArray(folder?.linkedManagerIds));
  return items.map(m => `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")} · ${esc(linkedManagerIds.some(id => sameId(id, m.id)) ? "Manager associé" : "Lié par contenu")}</span>${badge(m.status)}</div>`).join("") || `<div class="empty">Aucun manager concerné.</div>`;
}

function folderActionsList(items, folderId) {
  const sorted = [...items].sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)) || (daysUntil(a.due) ?? 9999) - (daysUntil(b.due) ?? 9999) || levelRank(a.level || "orange") - levelRank(b.level || "orange"));
  return sorted.map(a => `<div class="item row"><div class="clickable" onclick="setView('actions')"><strong>${a.done ? "?" : "?"} ${esc(a.title)}</strong><span class="muted">${esc(a.priorityLevel || a.level || "À suivre")} · ${esc(a.owner || "")}</span><span class="meta">Échéance ${esc(a.due || "Non définie")}</span></div><button class="secondary" onclick="completeFolderAction('${a.id}','${folderId}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || folderEmpty(folderId, "action", "action");
}

function completeFolderAction(actionId, folderId) {
  const a = byId("actions", actionId);
  if (!a) return;
  a.done = !a.done;
  persist("actions");
  addActivity("Action modifiée", a.title, a.done ? "Terminée" : "Réouverte", a.id);
  openFolder(folderId);
}

function folderPrioritiesList(items) {
  return items.map(p => `<div class="item clickable" onclick="setView('priorities')"><strong>${esc(p.title)}</strong><span class="muted">${esc(folderPriorityLabel(p.level))} · ${p.done ? "Terminée" : "Active"}</span><span class="meta">Échéance ${esc(p.due || "Non définie")}</span></div>`).join("") || `<div class="empty">Aucune priorité liée.</div>`;
}

function folderDecisionsList(items, folderId) {
  const sorted = [...items].sort((a, b) => (a.status === "review" ? -1 : 0) - (b.status === "review" ? -1 : 0) || dateRank(b.date) - dateRank(a.date));
  return sorted.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(decisionStatusLabel(d.status))} · ${esc(folderPriorityLabel(d.importance))}</span><span class="meta">Date ${esc(d.date || "")} · Réexamen ${esc(d.reviewDate || "Non défini")}</span></div>`).join("") || folderEmpty(folderId, "decision", "décision");
}

function folderJournalList(items, folderId) {
  return [...items].sort((a, b) => dateRank(b.date) - dateRank(a.date)).map(j => `<div class="item clickable" onclick="openJournal('${j.id}')"><strong>${esc(j.title)}</strong><span class="muted">${esc(j.entryType || "")} · ${esc(j.summary || "")}</span><span class="meta">${esc(j.date || "")}</span></div>`).join("") || folderEmpty(folderId, "journal", "entrée Journal");
}

function folderDocumentsList(items, folderId) {
  return items.map(d => `<div class="item clickable" onclick="editDocument('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")} · ${esc(d.status || "")}</span><span class="meta">Version ${esc(d.version || "V1")} · ${esc(d.updatedAt || "")}</span></div>`).join("") || folderEmpty(folderId, "document", "document");
}

function folderAgendaList(items, folderId) {
  return renderLinkedMeetingsSection("folder", folderId);
}

function actionAgendaList(action) {
  return renderLinkedMeetingsSection("action", action.id);
}

function decisionAgendaList(decision) {
  return renderLinkedMeetingsSection("decision", decision.id);
}

function linkedFoldersList(item) {
  const linked = state.folders.filter(f => ensureArray(item.linkedFolders).includes(f.id));
  return linked.map(f => `<div class="item clickable" onclick="openFolder('${f.id}')"><strong>${esc(f.name)}</strong><span class="muted">${esc(f.category)} · ${esc(folderPriorityLabel(f.priorityLevel))}</span>${badge(f.status)}</div>`).join("") || `<div class="empty">Aucun dossier lié.</div>`;
}

function renderActions() {
  actionDetailId = "";
  appHtml(`<div class="card hero"><h2>Actions</h2><p class="muted">L'action fait avancer : suivez ici ce qui doit concrètement être fait, par qui et pour quand.</p></div><div class="card"><h2>Ajouter une action</h2><input id="aTitle" placeholder="Action"><input id="aLink" placeholder="Lien ou contexte"><div class="grid three manager-links"><div><label>Dossiers liés</label>${folderSelect("aFolders")}</div><div><label>Projets liés</label>${checkboxList("aProjects", state.projects, [], p => p.name)}</div><div><label>Décisions liées</label>${checkboxList("aDecisions", state.decisions, [], d => d.title)}</div></div><button class="action" onclick="addAction()">Ajouter</button></div>${state.actions.map(actionItem).join("") || `<div class="card empty">Aucune action.</div>`}`);
}

function actionItem(a) {
  const folders = state.folders.filter(f => ensureArray(a.linkedFolders).includes(f.id)).map(f => f.name).join(" · ");
  const projects = state.projects.filter(p => ensureArray(a.linkedProjects).includes(p.id));
  const decisions = state.decisions.filter(d => ensureArray(a.linkedDecisions).includes(d.id));
  return `<div class="item row"><div><strong>${a.done ? "?" : "?"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}${folders ? " · " + esc(folders) : ""}${projects.length ? " · Projet : " + esc(projects.map(p => p.name).join(" · ")) : ""}${decisions.length ? " · Décision : " + esc(decisions.map(d => d.title).join(" · ")) : ""}</span></div><div class="row-actions">${projects.map(p => `<button class="secondary" onclick="openProject('${p.id}')">Projet</button>`).join("")}${decisions.map(d => `<button class="secondary" onclick="openDecision('${d.id}')">Décision</button>`).join("")}<button class="secondary" onclick="openAction('${a.id}')">Ouvrir</button><button class="secondary" onclick="editAction('${a.id}')">Modifier</button><button class="secondary" onclick="toggleAction('${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button><button class="danger" onclick="deleteAction('${a.id}')">Supprimer</button></div></div>`;
}

function addAction() {
  const title = document.getElementById("aTitle").value.trim();
  if (!title) return;
  const a = { id: newId("action"), title, link: document.getElementById("aLink").value.trim(), done: false, linkedFolders: checkedValues("aFolders"), linkedProjects: checkedValues("aProjects"), linkedDecisions: checkedValues("aDecisions") };
  state.actions.unshift(a);
  persist("actions");
  addActivity("? Action", a.title, a.link, a.id);
  if (closeCockpitQuickCreateIfNeeded("action")) return;
  renderActions();
}

function editAction(id) {
  openActionEditModal(id);
}

function toggleAction(id) {
  const a = byId("actions", id);
  if (!a) return;
  a.done = !a.done;
  persist("actions");
  addActivity("? Action modifiée", a.title, a.done ? "Terminée" : "Réouverte", a.id);
  renderActions();
}

function deleteAction(id) {
  openActionDeleteModal(id);
}

function openAction(id) {
  const a = byId("actions", id);
  if (!a) return renderActions();
  actionDetailId = String(id);
  const linkedProjects = state.projects.filter(p => ensureArray(a.linkedProjects).includes(p.id));
  const linkedDecisions = state.decisions.filter(d => ensureArray(a.linkedDecisions).includes(d.id));
  const linkedFolders = state.folders.filter(f => ensureArray(a.linkedFolders).includes(f.id));
  const linkedDocuments = state.documents.filter(d => ensureArray(d.linkedActions).includes(a.id));
  document.getElementById("viewTitle").textContent = a.title;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderActions()">Retour Actions</button><h2>${esc(a.title)}</h2><p>${esc(a.link || "")}</p><span class="muted">${a.done ? "Terminée" : "En cours"}</span><div class="row-actions"><button class="secondary" onclick="editAction('${a.id}')">Modifier</button><button class="secondary" onclick="toggleAction('${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button><button class="danger" onclick="deleteAction('${a.id}')">Supprimer</button></div></div><div class="grid two"><div class="card"><h2>Dossiers liés</h2>${linkedFolders.map(f => `<div class="item clickable" onclick="openFolder('${f.id}')"><strong>${esc(f.name)}</strong><span class="muted">${esc(f.category || "")}</span></div>`).join("") || `<div class="empty">Aucun dossier lié.</div>`}</div><div class="card"><h2>Projets liés</h2>${linkedProjects.map(p => `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next || "")}</span></div>`).join("") || `<div class="empty">Aucun projet lié.</div>`}</div><div class="card"><h2>Décisions liées</h2>${linkedDecisions.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(decisionStatusLabel(d.status))}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`}</div><div class="card"><h2>Documents liés</h2>${linkedDocuments.map(d => `<div class="item clickable" onclick="editDocument('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`}</div><div class="card full-span"><h2>Rendez-vous liés</h2>${actionAgendaList(a)}</div></div>`);
}

function openActionModal(id) {
  openAction(id);
}

function openDecisionModal(id) {
  openDecision(id);
}

function managerMini(m) {
  return `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")}</span>${badge(m.status)}</div>`;
}

function idsFromTextarea(id) {
  return lines(id).map(x => x.split("?")[0].trim()).filter(Boolean);
}

function optionLines(items, currentIds, labelFn) {
  const selected = new Set(currentIds || []);
  return items.filter(item => selected.has(item.id)).map(item => `${item.id} ? ${labelFn(item)}`).join("\n");
}

function linkedActionsList(m) {
  const linked = state.actions.filter(a => (m.linkedActions || []).includes(a.id));
  return linked.map(a => `<div class="item row"><div><strong>${a.done ? "?" : "?"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><button class="secondary" onclick="toggleLinkedManagerAction('${m.id}','${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || `<div class="empty">Aucune action liée.</div>`;
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
  return state.projects.filter(p => projectOwnerId(p) !== m.id && normalizeLinkedManagerIds(ensureArray(p.linkedManagers)).some(id => sameId(id, m.id)));
}

function managerProjectItem(p) {
  return `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(labels[p.status] || "À suivre")} · ${Number(p.progress || 0)}% ? Échéance ${esc(p.deadline || "À préciser")}</span><span class="meta">Prochaine étape : ${esc(p.next || "À compléter")} · ID ${esc(p.id)}</span></div>`;
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
  return linked.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.date || "")} ? ${(d.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`;
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

function managerDocumentsList(m) {
  const linked = state.documents.filter(d => (d.linkedManagers || []).includes(m.id));
  return linked.map(d => `<div class="item clickable" onclick="editDocument('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")}${d.category ? " · " + esc(d.category) : ""}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`;
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
  const m = { id: newId("manager"), name, role: document.getElementById("mRole").value.trim(), status: document.getElementById("mStatus").value, note: document.getElementById("mNote").value.trim(), priority: document.getElementById("mPriority").value.trim(), lastInterview: "", nextMeeting: document.getElementById("mNext").value.trim(), objectives: [], strengths: [], watchPoints: [], actions: [], linkedActions: [], linkedDecisions: [], events: [], directorNotes: [] };
  state.managers.push(m);
  persist("managers");
  addActivity("👥 Manager", m.name, m.role, m.id);
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
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderManagers()">Retour Managers</button><h2>${esc(m.name)}</h2><p>${esc(m.role || "")}</p>${badge(m.status)}<p class="muted">${esc(m.note || "")}</p><span class="meta">ID ${esc(m.id)} ? ${responsibleCount} projet(s) sous responsabilité</span><div class="row-actions"><button class="action" onclick="editManager('${m.id}')">Modifier</button><button class="secondary" onclick="startReport('managers','${m.id}')">Générer un compte rendu</button><button class="secondary" onclick="openManager('${m.id}','note')">Ajouter une note</button><button class="secondary" onclick="openManager('${m.id}','event')">Ajouter un événement</button><button class="danger" onclick="deleteManager('${m.id}')">Supprimer</button></div></div><div class="grid two">${managerQuickForm(m, mode)}<div class="card"><h2>Priorité managériale</h2><p>${esc(m.priority || "À compléter")}</p></div><div class="card"><h2>Entretiens</h2><p><strong>Dernier :</strong> ${esc(m.lastInterview || "À compléter")}</p><p><strong>Prochaine rencontre :</strong> ${esc(m.nextMeeting || "À planifier")}</p></div><div class="card full-span"><h2>Rendez-vous liés</h2>${managerAgendaList(m)}</div><div class="card full-span"><h2>Préparations de réunion liées</h2>${managerMeetingPreparationsList(m)}</div><div class="card full-span"><h2>Projets sous ma responsabilité</h2>${managerResponsibleProjectsList(m)}</div><div class="card full-span"><h2>Autres projets associés</h2>${managerAssociatedProjectsList(m)}</div><div class="card"><h2>Dossiers liés</h2>${linkedFoldersList(m)}</div><div class="card"><h2>Objectifs en cours</h2>${listItems(m.objectives)}</div><div class="card"><h2>Points forts</h2>${listItems(m.strengths)}</div><div class="card"><h2>Points de vigilance</h2>${listItems(m.watchPoints)}</div><div class="card"><h2>Actions internes</h2>${listItems(m.actions, "? ")}</div><div class="card"><h2>Actions liées</h2>${linkedActionsList(m)}</div><div class="card"><h2>Décisions liées</h2>${linkedDecisionsList(m)}</div><div class="card"><h2>Journal lié</h2>${managerJournalList(m)}</div><div class="card"><h2>Documents liés</h2>${managerDocumentsList(m)}</div><div class="card"><h2>Notes du directeur</h2>${directorNotesList(m)}</div><div class="card full-span"><h2>Historique chronologique</h2>${managerTimeline(m)}</div></div>`);
}

function editManager(id) {
  const m = byId("managers", id);
  if (!m) return;
  document.getElementById("viewTitle").textContent = "Modifier " + m.name;
  appHtml(`<div class="card"><h2>Modifier manager</h2><div class="form-grid"><input id="emName" value="${esc(m.name)}" placeholder="Nom"><input id="emRole" value="${esc(m.role || "")}" placeholder="Fonction"><select id="emStatus"><option value="green" ${m.status === "green" ? "selected" : ""}>Maîtrisé</option><option value="orange" ${m.status === "orange" ? "selected" : ""}>À suivre</option><option value="red" ${m.status === "red" ? "selected" : ""}>Critique</option></select><input id="emPriority" value="${esc(m.priority || "")}" placeholder="Priorité managériale"><input id="emLast" value="${esc(m.lastInterview || "")}" placeholder="Date du dernier entretien"><input id="emNext" value="${esc(m.nextMeeting || "")}" placeholder="Date de la prochaine rencontre"></div><textarea id="emNote" placeholder="Note de synthèse">${esc(m.note || "")}</textarea><textarea id="emObjectives" placeholder="Objectifs en cours, un par ligne">${esc((m.objectives || []).join("\n"))}</textarea><textarea id="emStrengths" placeholder="Points forts, un par ligne">${esc((m.strengths || []).join("\n"))}</textarea><textarea id="emWatch" placeholder="Points de vigilance, un par ligne">${esc((m.watchPoints || []).join("\n"))}</textarea><textarea id="emActions" placeholder="Actions internes, une par ligne">${esc((m.actions || []).join("\n"))}</textarea><div class="grid three manager-links"><div><label>Actions liées par ID</label><textarea id="emLinkedActions" placeholder="Un ID action par ligne">${esc(optionLines(state.actions, m.linkedActions, a => a.title))}</textarea></div><div><label>Projets associés</label>${checkboxList("emProjects", state.projects, managerLinkedProjectIds(m.id), p => p.name)}</div><div><label>Décisions liées par ID</label><textarea id="emLinkedDecisions" placeholder="Un ID décision par ligne">${esc(optionLines(state.decisions, m.linkedDecisions, d => d.title))}</textarea></div><div><label>Dossiers liés</label>${folderSelect("emFolders", m.linkedFolders || [])}</div></div><button class="action" onclick="saveManager('${m.id}')">Enregistrer</button><button class="secondary" onclick="openManager('${m.id}')">Annuler</button></div>`);
}

function saveManager(id) {
  const i = indexById("managers", id);
  if (i < 0) return false;
  try {
    const previousFolderIds = normalizeLinkedIdArray(state.managers[i].linkedFolders);
    const previousProjectIds = managerLinkedProjectIds(id);
    const parseLinkedIds = fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) return [];
      return String(field.value || "").split(/\r?\n/).map(x => x.split("?")[0].trim()).filter(Boolean);
    };
    const values = {
      name: document.getElementById("emName")?.value.trim() || "",
      role: document.getElementById("emRole")?.value.trim() || "",
      status: document.getElementById("emStatus")?.value || "orange",
      note: document.getElementById("emNote")?.value.trim() || "",
      priority: document.getElementById("emPriority")?.value.trim() || "",
      lastInterview: document.getElementById("emLast")?.value.trim() || "",
      nextMeeting: document.getElementById("emNext")?.value.trim() || "",
      objectives: readManagerLines("emObjectives"),
      strengths: readManagerLines("emStrengths"),
      watchPoints: readManagerLines("emWatch"),
      actions: readManagerLines("emActions"),
      linkedActions: parseLinkedIds("emLinkedActions").filter(actionId => byId("actions", actionId)),
      linkedDecisions: parseLinkedIds("emLinkedDecisions").filter(decisionId => byId("decisions", decisionId)),
      linkedFolders: normalizeLinkedIdArray(checkedValues("emFolders"))
    };
    if (!values.name) {
      alert("Le nom du manager est obligatoire.");
      return false;
    }

    const next = { ...state.managers[i], ...values };
    delete next.linkedProjects;
    state.managers[i] = next;
    const folderSyncChanged = syncFolderManagersFromManager(id, previousFolderIds, normalizeLinkedIdArray(next.linkedFolders));
    const projectSyncChanged = syncProjectsFromManager(id, previousProjectIds, normalizeLinkedIdArray(checkedValues("emProjects")));

    if (projectSyncChanged) persist("projects");
    persist("managers");
    if (folderSyncChanged) persist("folders");
    if (a5SummaryDialog.open && a5SummaryDialog.type === "folder") {
      const openedFolderId = String(a5SummaryDialog.sourceId || "");
      const touchedFolderIds = normalizeLinkedIdArray([...previousFolderIds, ...normalizeLinkedIdArray(next.linkedFolders)]);
      if (touchedFolderIds.some(folderId => sameId(folderId, openedFolderId))) {
        a5SummaryDialog.model = buildFolderA5Summary(openedFolderId);
      }
    }
    if (a5SummaryDialog.open && a5SummaryDialog.type === "project") {
      const openedProjectId = String(a5SummaryDialog.sourceId || "");
      const touchedProjectIds = normalizeLinkedIdArray([...previousProjectIds, ...normalizeLinkedIdArray(checkedValues("emProjects"))]);
      if (touchedProjectIds.some(projectId => sameId(projectId, openedProjectId))) {
        a5SummaryDialog.model = buildProjectA5Summary(openedProjectId);
      }
    }
    addActivity("👤 Manager modifié", next.name, next.role, id);
    openManager(id);
    return true;
  } catch (error) {
    console.error(error);
    alert("Erreur lors de l'enregistrement du manager. Vérifiez les champs puis réessayez.");
    return false;
  }
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
  addActivity("📅 Événement manager", m.name, title.trim(), id);
  openManager(id);
}

function toggleLinkedManagerAction(managerId, actionId) {
  const a = byId("actions", actionId);
  const m = byId("managers", managerId);
  if (!a || !m) return;
  a.done = !a.done;
  persist("actions");
  addActivity("? Action liée modifiée", a.title, a.done ? "Terminée" : "Réouverte", managerId);
  openManager(managerId);
}

function deleteManager(id) {
  openManagerDeleteModal(id);
}

function objectReferencesManager(item, managerId) {
  const target = String(managerId || "");
  if (!target || !item || typeof item !== "object") return false;
  if (sameId(item.ownerId, target)) return true;
  if (sameId(item.managerId, target)) return true;
  const linked = [
    ...ensureArray(item.linkedManagers),
    ...ensureArray(item.linkedManagerIds)
  ].map(value => String(value));
  return linked.some(value => sameId(value, target));
}

function getManagerDeletionImpact(managerId) {
  const target = String(managerId || "");
  if (!target) {
    return {
      folders: 0,
      projects: 0,
      actions: 0,
      decisions: 0,
      meetings: 0,
      googleMeetings: 0
    };
  }
  const uniqueCount = items => new Set(ensureArray(items).filter(item => objectReferencesManager(item, target)).map(item => String(item.id || item._key || ""))).size;
  const googleMeetingCount = Object.values(state.externalEventEnrichments || {}).filter(enrichment => objectReferencesManager(enrichment, target)).length;
  return {
    folders: uniqueCount(state.folders),
    projects: uniqueCount(state.projects),
    actions: uniqueCount(state.actions),
    decisions: uniqueCount(state.decisions),
    meetings: uniqueCount(state.agenda),
    googleMeetings: googleMeetingCount
  };
}

function renderManagerDeleteModal() {
  if (!managerDeleteDialog.open) return "";
  const manager = byId("managers", managerDeleteDialog.managerId);
  if (!manager) return "";
  const impact = managerDeleteDialog.impact || getManagerDeletionImpact(manager.id);
  const errorHtml = managerDeleteDialog.error ? `<p class="folder-delete-error">${esc(managerDeleteDialog.error)}</p>` : "";
  return `<div class="modal-backdrop manager-delete-modal" onclick="closeManagerDeleteModal()"><div class="modal-panel" onclick="event.stopPropagation()"><div class="modal-head"><h2>Supprimer le manager</h2><button class="icon-close" type="button" onclick="closeManagerDeleteModal()" aria-label="Fermer">×</button></div><p>Confirmer la suppression de <strong>${esc(manager.name || "Manager")}</strong>.</p><p class="muted">Le Manager sera supprimé. Les Dossiers, Projets, Actions, Décisions et Rendez-vous liés seront conservés, mais leur liaison avec ce Manager sera retirée.</p>${errorHtml}<div class="grid two"><div class="card"><h3>Objets liés conservés</h3><p><strong>Dossiers :</strong> ${impact.folders}</p><p><strong>Projets :</strong> ${impact.projects}</p><p><strong>Actions :</strong> ${impact.actions}</p><p><strong>Décisions :</strong> ${impact.decisions}</p><p><strong>Rendez-vous DEOS :</strong> ${impact.meetings}</p><p><strong>Rendez-vous Google :</strong> ${impact.googleMeetings}</p></div><div class="card"><h3>Rappel</h3><p>${esc(manager.role || manager.priority || "Manager sans détail complémentaire")}</p></div></div><div class="modal-actions"><button class="danger" type="button" ${managerDeleteDialog.busy ? "disabled" : ""} onclick="confirmManagerDelete('${esc(manager.id)}')">Supprimer</button><button class="secondary" type="button" onclick="closeManagerDeleteModal()">Annuler</button></div></div></div>`;
}

function renderManagerModalOverlays() {
  const root = document.getElementById("app");
  if (!root) return;
  root.querySelectorAll(".manager-delete-modal").forEach(node => node.remove());
  if (managerDeleteDialog.open) root.insertAdjacentHTML("beforeend", renderManagerDeleteModal());
}

function openManagerDeleteModal(id) {
  const manager = byId("managers", id);
  if (!manager) return;
  ensureActionModalHooks();
  managerDeleteDialog = {
    open: true,
    managerId: String(id),
    error: "",
    busy: false,
    impact: getManagerDeletionImpact(id)
  };
  renderManagerModalOverlays();
}

function closeManagerDeleteModal() {
  if (!managerDeleteDialog.open) return;
  managerDeleteDialog = { open: false, managerId: "", error: "", busy: false, impact: null };
  renderManagerModalOverlays();
}

function removeManagerReferencesFromItem(item, managerId, managerName = "") {
  const target = String(managerId || "");
  if (!target || !item || typeof item !== "object") return { item, changed: false };
  let changed = false;
  const next = { ...item };
  if (Object.prototype.hasOwnProperty.call(next, "linkedManagers")) {
    const before = ensureArray(next.linkedManagers);
    const after = normalizeLinkedManagerIds(before.filter(id => !sameId(id, target)));
    if (before.length !== after.length || before.some((id, index) => String(id) !== String(after[index] || ""))) changed = true;
    next.linkedManagers = after;
  }
  if (Object.prototype.hasOwnProperty.call(next, "linkedManagerIds")) {
    const before = ensureArray(next.linkedManagerIds);
    const after = normalizeLinkedManagerIds(before.filter(id => !sameId(id, target)));
    if (before.length !== after.length || before.some((id, index) => String(id) !== String(after[index] || ""))) changed = true;
    next.linkedManagerIds = after;
  }
  if (Object.prototype.hasOwnProperty.call(next, "ownerId") && sameId(next.ownerId, target)) {
    next.ownerId = "";
    changed = true;
  }
  const normalizedManagerName = String(managerName || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(next, "owner") && normalizedManagerName && String(next.owner || "").trim().toLowerCase() === normalizedManagerName) {
    next.owner = "";
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(next, "managerId") && sameId(next.managerId, target)) {
    next.managerId = "";
    changed = true;
  }
  return { item: changed ? next : item, changed };
}

function sanitizeMeetingPreparationManagerLinks(prep, managerId, managerName) {
  const cleanedPrep = removeManagerReferencesFromItem(prep, managerId, managerName);
  let changed = cleanedPrep.changed;
  const next = { ...cleanedPrep.item };
  const cleanedIdeas = ensureArray(next.ideas).map(idea => {
    const cleaned = removeManagerReferencesFromItem(idea, managerId, managerName);
    if (cleaned.changed) changed = true;
    return cleaned.item;
  });
  const cleanedTopics = ensureArray(next.agendaTopics).map(topic => {
    const cleaned = removeManagerReferencesFromItem(topic, managerId, managerName);
    if (cleaned.changed) changed = true;
    return cleaned.item;
  });
  if (changed) {
    next.ideas = cleanedIdeas;
    next.agendaTopics = cleanedTopics;
  }
  return { item: changed ? next : prep, changed };
}

function deleteManagerSafely(managerId) {
  const target = String(managerId || "");
  const manager = byId("managers", target);
  if (!manager) throw new Error("Manager introuvable.");

  const snapshot = {
    managers: JSON.parse(JSON.stringify(state.managers)),
    folders: JSON.parse(JSON.stringify(state.folders)),
    projects: JSON.parse(JSON.stringify(state.projects)),
    actions: JSON.parse(JSON.stringify(state.actions)),
    decisions: JSON.parse(JSON.stringify(state.decisions)),
    agenda: JSON.parse(JSON.stringify(state.agenda)),
    meetingPreparations: JSON.parse(JSON.stringify(state.meetingPreparations)),
    externalEventEnrichments: JSON.parse(JSON.stringify(state.externalEventEnrichments || {}))
  };

  const changed = new Set();
  const applyCollectionCleanup = (name, sanitizer) => {
    let touched = false;
    state[name] = state[name].map(item => {
      const cleaned = sanitizer(item, target, manager.name || "");
      if (cleaned.changed) touched = true;
      return cleaned.item;
    });
    if (touched) changed.add(name);
  };

  try {
    const index = indexById("managers", target);
    if (index < 0) throw new Error("Manager introuvable.");
    state.managers.splice(index, 1);
    changed.add("managers");

    const simpleSanitizer = (item, id, name) => removeManagerReferencesFromItem(item, id, name);
    applyCollectionCleanup("folders", simpleSanitizer);
    applyCollectionCleanup("projects", simpleSanitizer);
    applyCollectionCleanup("actions", simpleSanitizer);
    applyCollectionCleanup("decisions", simpleSanitizer);
    applyCollectionCleanup("agenda", simpleSanitizer);
    applyCollectionCleanup("meetingPreparations", (item, id, name) => sanitizeMeetingPreparationManagerLinks(item, id, name));

    let externalChanged = false;
    const nextEnrichments = {};
    Object.entries(state.externalEventEnrichments || {}).forEach(([eventKey, enrichment]) => {
      const cleaned = removeManagerReferencesFromItem(enrichment, target, manager.name || "");
      if (cleaned.changed) externalChanged = true;
      nextEnrichments[eventKey] = cleaned.item;
    });
    if (externalChanged) {
      state.externalEventEnrichments = nextEnrichments;
      changed.add("externalEventEnrichments");
    }

    changed.forEach(name => {
      if (name === "externalEventEnrichments") {
        persistExternalEventEnrichmentsOnly();
      } else {
        persist(name);
      }
    });

    addActivity("🗑️ Manager supprimé", manager.name, "Suppression sécurisée sans cascade", manager.id);
    closeManagerDeleteModal();
    renderManagers();
    return true;
  } catch (error) {
    state.managers = snapshot.managers;
    state.folders = snapshot.folders;
    state.projects = snapshot.projects;
    state.actions = snapshot.actions;
    state.decisions = snapshot.decisions;
    state.agenda = snapshot.agenda;
    state.meetingPreparations = snapshot.meetingPreparations;
    state.externalEventEnrichments = snapshot.externalEventEnrichments;

    persist("managers");
    persist("folders");
    persist("projects");
    persist("actions");
    persist("decisions");
    persist("agenda");
    persist("meetingPreparations");
    persistExternalEventEnrichmentsOnly();

    managerDeleteDialog.busy = false;
    managerDeleteDialog.error = `Échec de suppression : ${error?.message || "Erreur inconnue"}`;
    renderManagerModalOverlays();
    return false;
  }
}

function confirmManagerDelete(id) {
  if (!managerDeleteDialog.open || !sameId(managerDeleteDialog.managerId, id)) return;
  managerDeleteDialog.busy = true;
  managerDeleteDialog.error = "";
  renderManagerModalOverlays();
  deleteManagerSafely(id);
}

function projectMini(p) {
  return `<div class="item clickable" onclick="openProject('${p.id}')"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.next || "")}</span>${badge(p.status)}</div>`;
}

function renderProjects() {
  document.getElementById("viewTitle").textContent = "Projets V5";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "projects"));
  appHtml(`<div class="card hero"><h2>Projets V5</h2><p class="muted">Le projet transforme : pilotez ici les changements structurés ayant un objectif et un résultat attendu.</p></div><div class="card"><h2>Ajouter un projet</h2><input id="prName" placeholder="Nom"><input id="prNext" placeholder="Prochaine étape"><div class="form-grid"><div><label>Responsable principal</label>${ownerSelect("prOwnerId")}</div><input id="prDeadline" placeholder="Échéance"><input id="prProgress" type="number" min="0" max="100" value="0"><select id="prStatus"><option value="green">Maîtrisé</option><option value="orange">À suivre</option><option value="red">Critique</option></select></div><div class="manager-links"><label>Dossiers liés</label>${folderSelect("prFolders")}</div><button class="action" onclick="addProject()">Ajouter</button></div><div class="grid two">${state.projects.map(projectCard).join("")}</div>`);
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
  const p = { id: newId("project"), name, next: document.getElementById("prNext").value.trim(), owner, ownerId, deadline: document.getElementById("prDeadline").value.trim(), progress: Number(document.getElementById("prProgress").value || 0), status: document.getElementById("prStatus").value, objective: "", linkedManagers: [], linkedFolders: checkedValues("prFolders"), launchDate: "", priorityLevel: "orange", context: "", decisions: "", actions: "", risks: "", milestones: [], linkedActions: [], linkedDecisions: [], linkedDocuments: [], events: [], directorNotes: [] };
  state.projects.push(p);
  persist("projects");
  addActivity("📊 Projet", p.name, p.next, p.id);
  renderProjects();
}

function checkboxList(id, items, selectedIds, labelFn) {
  const selected = new Set((selectedIds || []).map(x => String(x)));
  return `<div id="${id}" class="check-list">${items.map(item => `<label class="check-row"><input type="checkbox" value="${esc(String(item.id))}" ${selected.has(String(item.id)) ? "checked" : ""}> <span>${esc(cleanDisplayLabel(labelFn(item)))}</span></label>`).join("") || `<div class="empty">Aucune donnée disponible.</div>`}</div>`;
}

function checkedValues(id) {
  const root = document.getElementById(id);
  if (!root) return [];
  return [...root.querySelectorAll("input:checked")].map(x => x.value);
}

function readManagerLines(id) {
  const field = document.getElementById(id);
  if (!field) return [];
  return String(field.value || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
}

function projectManagersList(p) {
  const linked = state.managers.filter(m => (p.linkedManagers || []).includes(m.id));
  return linked.map(m => `<div class="item clickable" onclick="openManager('${m.id}')"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.role || "")}</span>${badge(m.status)}<span class="meta">ID ${esc(m.id)}</span></div>`).join("") || `<div class="empty">Aucun manager associé.</div>`;
}

function projectActionsList(p) {
  const linked = state.actions.filter(a => (p.linkedActions || []).includes(a.id) || ensureArray(a.linkedProjects).includes(p.id));
  return linked.map(a => `<div class="item row"><div><strong>${a.done ? "?" : "?"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><button class="secondary" onclick="toggleLinkedProjectAction('${p.id}','${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || `<div class="empty">Aucune action liée.</div>`;
}

function projectDecisionsList(p) {
  const linked = state.decisions.filter(d => (p.linkedDecisions || []).includes(d.id) || (d.linkedProjects || []).includes(p.id));
  return linked.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.date || "")} ? ${(d.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`;
}

function projectDocumentsList(p) {
  const linked = state.documents.filter(d => (p.linkedDocuments || []).includes(d.id) || (d.linkedProjects || []).includes(p.id));
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
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderProjects()">Retour Projets</button><h2>${esc(p.name)}</h2>${badge(p.status)}<p>${esc(p.objective || p.next || "")}</p><span class="meta">ID ${esc(p.id)}</span><div class="row-actions"><button class="action" onclick="editProject('${p.id}')">Modifier</button><button class="secondary" onclick="startReport('projects','${p.id}')">Générer un compte rendu</button><button class="secondary" onclick="openProject('${p.id}','milestone')">Ajouter un jalon</button><button class="secondary" onclick="openProject('${p.id}','note')">Ajouter une note</button><button class="secondary" onclick="openProject('${p.id}','event')">Ajouter un événement</button><button class="danger" onclick="deleteProject('${p.id}')">Supprimer</button></div></div><div class="grid two">${projectQuickForm(p, mode)}<div class="card"><h2>Avancement</h2><div class="progress"><span style="width:${Number(p.progress || 0)}%"></span></div><p>${Number(p.progress || 0)}%</p><div class="row"><input id="quickProgress" type="number" min="0" max="100" value="${Number(p.progress || 0)}"><button class="secondary" onclick="updateProjectProgress('${p.id}')">Mettre à jour</button></div></div><div class="card"><h2>Pilotage</h2><p><strong>Responsable :</strong> ${esc(projectOwnerName(p) || "À compléter")}</p><p><strong>Lancement :</strong> ${esc(p.launchDate || "À compléter")}</p><p><strong>Échéance :</strong> ${esc(p.deadline || "À préciser")}</p><p><strong>Priorité :</strong> ${icons[p.priorityLevel] || ""} ${esc(labels[p.priorityLevel] || p.priorityLevel || "À suivre")}</p></div><div class="card full-span"><h2>Rendez-vous liés</h2>${projectAgendaList(p)}</div><div class="card full-span"><h2>Préparations de réunion liées</h2>${projectMeetingPreparationsList(p)}</div><div class="card"><h2>Objectif</h2><p>${esc(p.objective || "À compléter")}</p></div><div class="card"><h2>Contexte</h2><p>${esc(p.context || "À compléter")}</p></div><div class="card"><h2>Prochaine étape</h2><p>${esc(p.next || "À compléter")}</p></div><div class="card"><h2>Risques et points de vigilance</h2><p>${esc(p.risks || "À compléter")}</p></div><div class="card"><h2>Managers associés</h2>${projectManagersList(p)}</div><div class="card"><h2>Jalons</h2>${projectMilestonesList(p)}</div><div class="card"><h2>Actions liées</h2>${projectActionsList(p)}${p.actions ? `<p class="muted">${esc(p.actions)}</p>` : ""}</div><div class="card"><h2>Décisions liées</h2>${projectDecisionsList(p)}${p.decisions ? `<p class="muted">${esc(p.decisions)}</p>` : ""}</div><div class="card"><h2>Journal lié</h2>${projectJournalList(p)}</div><div class="card"><h2>Documents liés</h2>${projectDocumentsList(p)}</div><div class="card"><h2>Dossiers liés</h2>${linkedFoldersList(p)}</div><div class="card"><h2>Notes du directeur</h2>${projectNotesList(p)}</div><div class="card full-span"><h2>Historique chronologique</h2>${projectTimeline(p)}</div></div>`);
}

function editProject(id) {
  openProjectEditModal(id);
}

function saveProject(id) {
  return saveProjectEdit(id);
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
  addActivity("🏁 Jalon projet", p.name, title, id);
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
  addActivity("📅 Événement projet", p.name, title, id);
  openProject(id);
}

function toggleLinkedProjectAction(projectId, actionId) {
  const a = byId("actions", actionId);
  const p = byId("projects", projectId);
  if (!a || !p) return;
  a.done = !a.done;
  persist("actions");
  addActivity("? Action projet modifiée", a.title, a.done ? "Terminée" : "Réouverte", projectId);
  openProject(projectId);
}

function deleteProject(id) {
  openProjectDeleteModal(id);
}

function projectEditModalBody(project) {
  const description = project.description || project.context || "";
  const expectedResults = project.expectedResults || project.actions || "";
  return `
    <div class="form-grid">
      <input id="pepName" value="${esc(project.name || "")}" placeholder="Titre du projet" class="full">
      <textarea id="pepDescription" placeholder="Description" class="full">${esc(description)}</textarea>
      <select id="pepStatus">
        <option value="green" ${project.status === "green" ? "selected" : ""}>Maîtrisé</option>
        <option value="orange" ${project.status === "orange" ? "selected" : ""}>À suivre</option>
        <option value="red" ${project.status === "red" ? "selected" : ""}>Critique</option>
      </select>
      <select id="pepPriority">
        <option value="green" ${project.priorityLevel === "green" ? "selected" : ""}>Priorité normale</option>
        <option value="orange" ${project.priorityLevel === "orange" || !project.priorityLevel ? "selected" : ""}>Priorité importante</option>
        <option value="red" ${project.priorityLevel === "red" ? "selected" : ""}>Priorité critique</option>
      </select>
      <div><label>Responsable principal</label>${ownerSelect("pepOwnerId", projectOwnerId(project))}</div>
      <input id="pepLaunch" type="date" value="${esc(project.launchDate || "")}" placeholder="Date de lancement">
      <input id="pepDeadline" type="date" value="${esc(project.deadline || "")}" placeholder="Échéance">
      <input id="pepProgress" type="number" min="0" max="100" value="${Number(project.progress || 0)}" placeholder="Avancement (%)">
      <input id="pepObjective" value="${esc(project.objective || "")}" placeholder="Objectif" class="full">
      <textarea id="pepExpectedResults" placeholder="Résultats attendus" class="full">${esc(expectedResults)}</textarea>
      <textarea id="pepRisks" placeholder="Risques et blocages" class="full">${esc(project.risks || "")}</textarea>
      <input id="pepNext" value="${esc(project.next || "")}" placeholder="Prochaines étapes" class="full">
    </div>
    <div class="grid two manager-links">
      <div><label>Dossiers liés</label>${folderSelect("pepFolders", normalizeLinkedIdArray(project.linkedFolders))}</div>
      <div><label>Actions liées</label>${checkboxList("pepActions", state.actions, normalizeLinkedIdArray(project.linkedActions), action => action.title)}</div>
      <div><label>Décisions liées</label>${checkboxList("pepDecisions", state.decisions, normalizeLinkedIdArray(project.linkedDecisions), decision => decision.title)}</div>
      <div><label>Managers associés</label>${checkboxList("pepManagers", state.managers, normalizeLinkedManagerIds(project.linkedManagers), manager => `${manager.name} · ${manager.role || ""}`)}</div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Rendez-vous liés</h3>
      ${projectAgendaList(project)}
    </div>
    <div class="modal-actions">
      <button class="action" type="button" onclick="saveProjectEdit('${esc(project.id)}')">Enregistrer</button>
      <button class="secondary" type="button" onclick="closeProjectEditModal()">Annuler</button>
    </div>
  `;
}

function renderProjectEditModal() {
  if (!projectEditDialog.open) return "";
  const project = byId("projects", projectEditDialog.projectId);
  if (!project) return "";
  const errorHtml = projectEditDialog.error ? `<p class="folder-delete-error">${esc(projectEditDialog.error)}</p>` : "";
  return `<div class="modal-backdrop project-edit-modal" onclick="closeProjectEditModal()"><div class="modal-panel" style="max-height:88vh;overflow-y:auto" onclick="event.stopPropagation()"><div class="modal-head"><h2>Modifier projet</h2><button class="icon-close" type="button" onclick="closeProjectEditModal()" aria-label="Fermer">×</button></div>${errorHtml}${projectEditModalBody(project)}</div></div>`;
}

function objectReferencesProject(item, projectId) {
  const target = String(projectId || "");
  if (!target || !item || typeof item !== "object") return false;
  if (sameId(item.projectId, target)) return true;
  const linked = [
    ...ensureArray(item.linkedProjects),
    ...ensureArray(item.linkedProjectIds)
  ].map(value => String(value));
  return linked.some(value => sameId(value, target));
}

function getProjectDeletionImpact(projectId) {
  const target = String(projectId || "");
  if (!target) {
    return {
      actions: 0,
      decisions: 0,
      managers: 0,
      meetings: 0,
      documents: 0,
      journal: 0,
      preparations: 0
    };
  }
  const uniqueCount = items => new Set(ensureArray(items).filter(item => objectReferencesProject(item, target)).map(item => String(item.id || item._key || ""))).size;
  const preparations = new Set(state.meetingPreparations.filter(prep => {
    if (objectReferencesProject(prep, target)) return true;
    const hasIdea = ensureArray(prep.ideas).some(idea => sameId(idea.projectId, target));
    const hasTopic = ensureArray(prep.agendaTopics).some(topic => sameId(topic.projectId, target));
    return hasIdea || hasTopic;
  }).map(prep => String(prep.id)));
  return {
    actions: uniqueCount(state.actions),
    decisions: uniqueCount(state.decisions),
    managers: uniqueCount(state.managers),
    meetings: uniqueCount(state.agenda),
    documents: uniqueCount(state.documents),
    journal: uniqueCount(state.journal),
    preparations: preparations.size
  };
}

function renderProjectDeleteModal() {
  if (!projectDeleteDialog.open) return "";
  const project = byId("projects", projectDeleteDialog.projectId);
  if (!project) return "";
  const impact = projectDeleteDialog.impact || getProjectDeletionImpact(project.id);
  const errorHtml = projectDeleteDialog.error ? `<p class="folder-delete-error">${esc(projectDeleteDialog.error)}</p>` : "";
  return `<div class="modal-backdrop project-delete-modal" onclick="closeProjectDeleteModal()"><div class="modal-panel" onclick="event.stopPropagation()"><div class="modal-head"><h2>Supprimer le projet</h2><button class="icon-close" type="button" onclick="closeProjectDeleteModal()" aria-label="Fermer">×</button></div><p>Confirmer la suppression du projet <strong>${esc(project.name || "Projet")}</strong>.</p><p class="muted">Seul le Projet sera supprimé. Les objets liés seront conservés, mais leur liaison avec ce Projet sera retirée.</p>${errorHtml}<div class="grid two"><div class="card"><h3>Objets liés</h3><p><strong>Actions :</strong> ${impact.actions}</p><p><strong>Décisions :</strong> ${impact.decisions}</p><p><strong>Managers :</strong> ${impact.managers}</p><p><strong>Rendez-vous :</strong> ${impact.meetings}</p><p><strong>Documents :</strong> ${impact.documents}</p><p><strong>Journal :</strong> ${impact.journal}</p><p><strong>Préparations :</strong> ${impact.preparations}</p></div><div class="card"><h3>Rappel</h3><p>${esc(project.objective || project.next || "Projet sans descriptif")}</p></div></div><div class="modal-actions"><button class="danger" type="button" ${projectDeleteDialog.busy ? "disabled" : ""} onclick="confirmProjectDelete('${esc(project.id)}')">Supprimer</button><button class="secondary" type="button" onclick="closeProjectDeleteModal()">Annuler</button></div></div></div>`;
}

function renderProjectModalOverlays() {
  const root = document.getElementById("app");
  if (!root) return;
  root.querySelectorAll(".project-edit-modal, .project-delete-modal").forEach(node => node.remove());
  if (projectEditDialog.open) root.insertAdjacentHTML("beforeend", renderProjectEditModal());
  if (projectDeleteDialog.open) root.insertAdjacentHTML("beforeend", renderProjectDeleteModal());
}

function openProjectEditModal(id) {
  const project = byId("projects", id);
  if (!project) return;
  ensureActionModalHooks();
  projectEditDialog = { open: true, projectId: String(id), error: "" };
  renderProjectModalOverlays();
}

function closeProjectEditModal() {
  if (!projectEditDialog.open) return;
  projectEditDialog = { open: false, projectId: "", error: "" };
  renderProjectModalOverlays();
}

function openProjectDeleteModal(id) {
  const project = byId("projects", id);
  if (!project) return;
  ensureActionModalHooks();
  projectDeleteDialog = {
    open: true,
    projectId: String(id),
    error: "",
    busy: false,
    impact: getProjectDeletionImpact(id)
  };
  renderProjectModalOverlays();
}

function closeProjectDeleteModal() {
  if (!projectDeleteDialog.open) return;
  projectDeleteDialog = { open: false, projectId: "", error: "", busy: false, impact: null };
  renderProjectModalOverlays();
}

function saveProjectEdit(id) {
  const i = indexById("projects", id);
  if (i < 0) return false;
  const current = state.projects[i];
  const name = document.getElementById("pepName")?.value.trim() || "";
  if (!name) {
    projectEditDialog.error = "Le titre du projet est obligatoire.";
    renderProjectModalOverlays();
    return false;
  }
  const ownerId = String(document.getElementById("pepOwnerId")?.value || "");
  const owner = byId("managers", ownerId)?.name || "";
  const next = {
    ...current,
    name,
    status: document.getElementById("pepStatus")?.value || current.status || "orange",
    priorityLevel: document.getElementById("pepPriority")?.value || current.priorityLevel || "orange",
    owner,
    ownerId,
    launchDate: document.getElementById("pepLaunch")?.value || "",
    deadline: document.getElementById("pepDeadline")?.value || "",
    progress: Math.max(0, Math.min(100, Number(document.getElementById("pepProgress")?.value || 0))),
    objective: document.getElementById("pepObjective")?.value.trim() || "",
    expectedResults: document.getElementById("pepExpectedResults")?.value.trim() || "",
    actions: document.getElementById("pepExpectedResults")?.value.trim() || "",
    risks: document.getElementById("pepRisks")?.value.trim() || "",
    next: document.getElementById("pepNext")?.value.trim() || "",
    description: document.getElementById("pepDescription")?.value.trim() || "",
    context: document.getElementById("pepDescription")?.value.trim() || "",
    linkedFolders: normalizeLinkedIdArray(checkedValues("pepFolders")),
    linkedActions: normalizeLinkedIdArray(checkedValues("pepActions")),
    linkedDecisions: normalizeLinkedIdArray(checkedValues("pepDecisions")),
    linkedManagers: normalizeLinkedManagerIds(checkedValues("pepManagers"))
  };
  state.projects[i] = normalizeEntity("projects", next);
  persist("projects");
  addActivity("📊 Projet modifié", state.projects[i].name, state.projects[i].next || "", id);
  closeProjectEditModal();
  openProject(id);
  return true;
}

function removeProjectReferencesFromItem(item, projectId) {
  const target = String(projectId || "");
  if (!target || !item || typeof item !== "object") return { item, changed: false };
  let changed = false;
  const next = { ...item };
  if (Object.prototype.hasOwnProperty.call(next, "linkedProjects")) {
    const before = ensureArray(next.linkedProjects);
    const after = normalizeLinkedIdArray(before.filter(id => !sameId(id, target)));
    if (before.length !== after.length || before.some((id, index) => String(id) !== String(after[index] || ""))) changed = true;
    next.linkedProjects = after;
  }
  if (Object.prototype.hasOwnProperty.call(next, "linkedProjectIds")) {
    const before = ensureArray(next.linkedProjectIds);
    const after = normalizeLinkedIdArray(before.filter(id => !sameId(id, target)));
    if (before.length !== after.length || before.some((id, index) => String(id) !== String(after[index] || ""))) changed = true;
    next.linkedProjectIds = after;
  }
  if (Object.prototype.hasOwnProperty.call(next, "projectId") && sameId(next.projectId, target)) {
    next.projectId = "";
    changed = true;
  }
  return { item: changed ? next : item, changed };
}

function sanitizeMeetingPreparationProjectLinks(prep, projectId) {
  const cleanedPrep = removeProjectReferencesFromItem(prep, projectId);
  let changed = cleanedPrep.changed;
  const next = { ...cleanedPrep.item };
  const cleanedIdeas = ensureArray(next.ideas).map(idea => {
    const cleaned = removeProjectReferencesFromItem(idea, projectId);
    if (cleaned.changed) changed = true;
    return cleaned.item;
  });
  const cleanedTopics = ensureArray(next.agendaTopics).map(topic => {
    const cleaned = removeProjectReferencesFromItem(topic, projectId);
    if (cleaned.changed) changed = true;
    return cleaned.item;
  });
  if (changed) {
    next.ideas = cleanedIdeas;
    next.agendaTopics = cleanedTopics;
  }
  return { item: changed ? next : prep, changed };
}

function deleteProjectSafely(projectId) {
  const target = String(projectId || "");
  const project = byId("projects", target);
  if (!project) throw new Error("Projet introuvable.");

  const snapshot = {
    projects: JSON.parse(JSON.stringify(state.projects)),
    actions: JSON.parse(JSON.stringify(state.actions)),
    decisions: JSON.parse(JSON.stringify(state.decisions)),
    managers: JSON.parse(JSON.stringify(state.managers)),
    journal: JSON.parse(JSON.stringify(state.journal)),
    documents: JSON.parse(JSON.stringify(state.documents)),
    agenda: JSON.parse(JSON.stringify(state.agenda)),
    performance: JSON.parse(JSON.stringify(state.performance)),
    meetingPreparations: JSON.parse(JSON.stringify(state.meetingPreparations)),
    externalEventEnrichments: JSON.parse(JSON.stringify(state.externalEventEnrichments || {}))
  };

  const changed = new Set();
  const applyCollectionCleanup = (name, sanitizer) => {
    let touched = false;
    state[name] = state[name].map(item => {
      const cleaned = sanitizer(item, target);
      if (cleaned.changed) touched = true;
      return cleaned.item;
    });
    if (touched) changed.add(name);
  };

  try {
    const index = indexById("projects", target);
    if (index < 0) throw new Error("Projet introuvable.");
    state.projects.splice(index, 1);
    changed.add("projects");

    const simpleSanitizer = (item, id) => removeProjectReferencesFromItem(item, id);
    applyCollectionCleanup("actions", simpleSanitizer);
    applyCollectionCleanup("decisions", simpleSanitizer);
    applyCollectionCleanup("managers", simpleSanitizer);
    applyCollectionCleanup("journal", simpleSanitizer);
    applyCollectionCleanup("documents", simpleSanitizer);
    applyCollectionCleanup("agenda", simpleSanitizer);
    applyCollectionCleanup("performance", simpleSanitizer);
    applyCollectionCleanup("meetingPreparations", sanitizeMeetingPreparationProjectLinks);

    let externalChanged = false;
    const nextEnrichments = {};
    Object.entries(state.externalEventEnrichments || {}).forEach(([eventKey, enrichment]) => {
      const cleaned = removeProjectReferencesFromItem(enrichment, target);
      if (cleaned.changed) externalChanged = true;
      nextEnrichments[eventKey] = cleaned.item;
    });
    if (externalChanged) {
      state.externalEventEnrichments = nextEnrichments;
      changed.add("externalEventEnrichments");
    }

    changed.forEach(name => {
      if (name === "externalEventEnrichments") {
        persistExternalEventEnrichmentsOnly();
      } else {
        persist(name);
      }
    });

    addActivity("🗑️ Projet supprimé", project.name, "Suppression sécurisée sans cascade", project.id);
    closeProjectDeleteModal();
    renderProjects();
    return true;
  } catch (error) {
    state.projects = snapshot.projects;
    state.actions = snapshot.actions;
    state.decisions = snapshot.decisions;
    state.managers = snapshot.managers;
    state.journal = snapshot.journal;
    state.documents = snapshot.documents;
    state.agenda = snapshot.agenda;
    state.performance = snapshot.performance;
    state.meetingPreparations = snapshot.meetingPreparations;
    state.externalEventEnrichments = snapshot.externalEventEnrichments;

    persist("projects");
    persist("actions");
    persist("decisions");
    persist("managers");
    persist("journal");
    persist("documents");
    persist("agenda");
    persist("performance");
    persist("meetingPreparations");
    persistExternalEventEnrichmentsOnly();

    projectDeleteDialog.busy = false;
    projectDeleteDialog.error = `Échec de suppression : ${error?.message || "Erreur inconnue"}`;
    renderProjectModalOverlays();
    return false;
  }
}

function confirmProjectDelete(id) {
  if (!projectDeleteDialog.open || !sameId(projectDeleteDialog.projectId, id)) return;
  projectDeleteDialog.busy = true;
  projectDeleteDialog.error = "";
  renderProjectModalOverlays();
  deleteProjectSafely(id);
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
  return linked.map(a => `<div class="item row"><div><strong>${a.done ? "?" : "?"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div><button class="secondary" onclick="toggleLinkedDecisionAction('${d.id}','${a.id}')">${a.done ? "Réouvrir" : "Terminer"}</button></div>`).join("") || `<div class="empty">Aucune action générée.</div>`;
}

function decisionDocumentsList(d) {
  const linked = state.documents.filter(doc => (d.linkedDocuments || []).includes(doc.id) || (doc.linkedDecisions || []).includes(d.id));
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
  if (mode === "action") return `<div class="card full-span"><h2>Créer une action liée</h2><input id="daTitle" placeholder="Action ? créer"><div class="grid two manager-links"><div><label>Managers concernés par l'action</label>${checkboxList("daManagers", state.managers, d.linkedManagers, m => `${m.name} ? ${m.role || ""}`)}</div><div><label>Projets concernés par l'action</label>${checkboxList("daProjects", state.projects, d.linkedProjects, p => p.name)}</div></div><button class="action" onclick="saveDecisionAction('${d.id}')">Enregistrer</button><button class="secondary" onclick="openDecision('${d.id}')">Annuler</button></div>`;
  return "";
}

function renderDecisions() {
  document.getElementById("viewTitle").textContent = "Décisions V5";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "decisions"));
  appHtml(`<div class="card hero"><h2>Décisions V5</h2><p class="muted">La décision arbitre : retrouvez ici les arbitrages pris, attendus ou à formaliser.</p></div><div class="card"><h2>Ajouter une décision</h2><input id="dTitle" placeholder="Titre"><textarea id="dContext" placeholder="Contexte"></textarea><div class="form-grid"><input id="dOwner" placeholder="Responsable du suivi"><input id="dNext" placeholder="Suite attendue"><input id="dImpact" placeholder="Impacts attendus" class="full"><input id="dTags" placeholder="Mots-clés séparés par virgule" class="full"></div><div class="grid two manager-links"><div><label>Dossiers liés</label>${folderSelect("dFolders")}</div><div><label>Projets concernés</label>${checkboxList("dProjects", state.projects, [], p => p.name)}</div></div><button class="action" onclick="addDecision()">Ajouter</button></div>${state.decisions.map(decisionCard).join("") || `<div class="card empty">Aucune décision.</div>`}`);
}

function decisionCard(d) {
  return `<div class="card clickable" onclick="openDecision('${d.id}')"><h2>${esc(d.title)}</h2><p>${esc(d.context || "")}</p><span class="muted">${esc(d.date || "")} · ${esc(decisionStatusLabel(d.status))} ? ${(d.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(d.id)}</span></div>`;
}

function addDecision() {
  const title = document.getElementById("dTitle").value.trim();
  if (!title) return;
  const d = { id: newId("decision"), title, context: document.getElementById("dContext").value.trim(), date: today(), status: "decided", importance: "orange", problem: "", decision: "", rationale: "", alternatives: "", impacts: document.getElementById("dImpact").value.trim(), risks: "", owner: document.getElementById("dOwner").value.trim(), linkedManagers: [], linkedProjects: checkedValues("dProjects"), linkedActions: [], reviewDate: "", linkedDocuments: [], events: [], directorNotes: [], nextStep: document.getElementById("dNext").value.trim(), tags: splitTags(document.getElementById("dTags").value), linkedFolders: checkedValues("dFolders") };
  state.decisions.unshift(d);
  syncDecisionBacklinks(d);
  persist("decisions");
  addActivity("📌 Décision", d.title, d.context, d.id);
  if (closeCockpitQuickCreateIfNeeded("decision")) return;
  renderDecisions();
}

function openDecision(id, mode = "") {
  const d = byId("decisions", id);
  if (!d) return renderDecisions();
  document.getElementById("viewTitle").textContent = d.title;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderDecisions()">Retour Décisions</button><h2>${esc(d.title)}</h2><p>${esc(d.context || "")}</p><span class="muted">${esc(d.date || "")} · ${esc(decisionStatusLabel(d.status))}</span><span class="meta">ID ${esc(d.id)}</span><div class="row-actions"><button class="action" onclick="editDecision('${d.id}')">Modifier</button><button class="secondary" onclick="openDecision('${d.id}','note')">Ajouter une note</button><button class="secondary" onclick="openDecision('${d.id}','event')">Ajouter un événement</button><button class="secondary" onclick="openDecision('${d.id}','action')">Créer une action liée</button><button class="danger" onclick="deleteDecision('${d.id}')">Supprimer</button></div></div><div class="grid two">${decisionQuickForm(d, mode)}<div class="card"><h2>Statut et importance</h2><p><strong>Statut :</strong> ${esc(decisionStatusLabel(d.status))}</p><p><strong>Importance :</strong> ${icons[d.importance] || ""} ${esc(labels[d.importance] || d.importance || "Important")}</p><p><strong>Réexamen :</strong> ${esc(d.reviewDate || "À préciser")}</p></div><div class="card"><h2>Responsable du suivi</h2><p>${esc(d.owner || "À compléter")}</p></div><div class="card"><h2>Problème ou besoin initial</h2><p>${esc(d.problem || "À compléter")}</p></div><div class="card"><h2>Décision prise</h2><p>${esc(d.decision || d.nextStep || "À compléter")}</p></div><div class="card"><h2>Raisons et critères</h2><p>${esc(d.rationale || "À compléter")}</p></div><div class="card"><h2>Alternatives étudiées</h2><p>${esc(d.alternatives || "À compléter")}</p></div><div class="card"><h2>Impacts attendus</h2><p>${esc(d.impacts || d.impact || "À compléter")}</p></div><div class="card"><h2>Risques et points de vigilance</h2><p>${esc(d.risks || "À compléter")}</p></div><div class="card"><h2>Managers concernés</h2>${decisionManagersList(d)}</div><div class="card"><h2>Projets concernés</h2>${decisionProjectsList(d)}</div><div class="card full-span"><h2>Rendez-vous liés</h2>${decisionAgendaList(d)}</div><div class="card"><h2>Actions générées</h2>${decisionActionsList(d)}</div><div class="card"><h2>Journal lié</h2>${decisionJournalList(d)}</div><div class="card"><h2>Documents liés</h2>${decisionDocumentsList(d)}</div><div class="card"><h2>Dossiers liés</h2>${linkedFoldersList(d)}</div><div class="card"><h2>Notes du directeur</h2>${decisionNotesList(d)}</div><div class="card"><h2>Mots-clés</h2>${listItems(d.tags)}</div><div class="card full-span"><h2>Historique chronologique</h2>${decisionTimeline(d)}</div></div>`);
}

function editDecision(id) {
  const d = byId("decisions", id);
  if (!d) return;
  document.getElementById("viewTitle").textContent = "Modifier " + d.title;
  appHtml(`<div class="card"><h2>Modifier décision</h2><input id="edTitle" value="${esc(d.title)}" placeholder="Titre"><div class="form-grid"><input id="edDate" value="${esc(d.date || "")}" placeholder="Date de décision"><select id="edStatus"><option value="decided" ${d.status === "decided" ? "selected" : ""}>Décidée</option><option value="applying" ${d.status === "applying" ? "selected" : ""}>En cours d'application</option><option value="applied" ${d.status === "applied" ? "selected" : ""}>Appliquée</option><option value="review" ${d.status === "review" ? "selected" : ""}>À réexaminer</option></select><select id="edImportance"><option value="green" ${d.importance === "green" ? "selected" : ""}>Normal</option><option value="orange" ${d.importance === "orange" ? "selected" : ""}>Important</option><option value="red" ${d.importance === "red" ? "selected" : ""}>Critique</option></select><input id="edOwner" value="${esc(d.owner || "")}" placeholder="Responsable du suivi"><input id="edReview" value="${esc(d.reviewDate || "")}" placeholder="Échéance de réexamen"><input id="edTags" value="${esc((d.tags || []).join(", "))}" placeholder="Mots-clés" class="full"></div><textarea id="edContext" placeholder="Contexte">${esc(d.context || "")}</textarea><textarea id="edProblem" placeholder="Problème ou besoin initial">${esc(d.problem || "")}</textarea><textarea id="edDecisionText" placeholder="Décision prise">${esc(d.decision || "")}</textarea><textarea id="edRationale" placeholder="Raisons et critères">${esc(d.rationale || "")}</textarea><textarea id="edAlternatives" placeholder="Alternatives étudiées">${esc(d.alternatives || "")}</textarea><textarea id="edImpacts" placeholder="Impacts attendus">${esc(d.impacts || d.impact || "")}</textarea><textarea id="edRisks" placeholder="Risques et points de vigilance">${esc(d.risks || "")}</textarea><textarea id="edNext" placeholder="Suite attendue">${esc(d.nextStep || "")}</textarea><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("edManagers", state.managers, d.linkedManagers, m => `${m.name} ? ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("edProjects", state.projects, d.linkedProjects, p => p.name)}</div><div><label>Actions générées</label>${checkboxList("edActions", state.actions, d.linkedActions, a => a.title)}</div><div><label>Documents liés</label>${checkboxList("edDocuments", state.documents, d.linkedDocuments, doc => doc.title)}</div><div><label>Dossiers liés</label>${folderSelect("edFolders", d.linkedFolders || [])}</div></div><button class="action" onclick="saveDecision('${d.id}')">Enregistrer</button><button class="secondary" onclick="openDecision('${d.id}')">Annuler</button></div>`);
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
  state.decisions[i] = { ...state.decisions[i], title: document.getElementById("edTitle").value.trim(), date: document.getElementById("edDate").value.trim(), status: document.getElementById("edStatus").value, importance: document.getElementById("edImportance").value, owner: document.getElementById("edOwner").value.trim(), reviewDate: document.getElementById("edReview").value.trim(), tags: splitTags(document.getElementById("edTags").value), context: document.getElementById("edContext").value.trim(), problem: document.getElementById("edProblem").value.trim(), decision: document.getElementById("edDecisionText").value.trim(), rationale: document.getElementById("edRationale").value.trim(), alternatives: document.getElementById("edAlternatives").value.trim(), impacts: document.getElementById("edImpacts").value.trim(), impact: document.getElementById("edImpacts").value.trim(), risks: document.getElementById("edRisks").value.trim(), nextStep: document.getElementById("edNext").value.trim(), linkedManagers: checkedValues("edManagers"), linkedProjects: checkedValues("edProjects"), linkedActions: checkedValues("edActions"), linkedDocuments: checkedValues("edDocuments"), linkedFolders: checkedValues("edFolders") };
  persist("decisions");
  syncDecisionBacklinks(state.decisions[i]);
  addActivity("📌 Décision modifiée", state.decisions[i].title, state.decisions[i].nextStep, id);
  openDecision(id);
}


function decisionEditableManagerIds(decision) {
  return normalizeLinkedManagerIds(ensureArray(decision?.linkedManagers).length ? decision.linkedManagers : ensureArray(decision?.linkedManagerIds));
}

function decisionRenderRelatedMeetings(decision) {
  const meetings = decisionRelationsForA5(decision).meetings.map(a5MeetingDisplay);
  return a5List(meetings, meeting => `<article class="a5-item"><strong>${esc(meeting.label)}</strong><p>${esc(meeting.date)} · ${esc(meeting.time)} ${meetingConfidentialityBadge(meeting.confidentiality)}</p></article>`, "Aucun rendez-vous lié.");
}

function decisionEditModalBody(decision) {
  const relations = decisionRelationsForA5(decision);
  const hasManagersField = Object.prototype.hasOwnProperty.call(decision, "linkedManagers") || Object.prototype.hasOwnProperty.call(decision, "linkedManagerIds");
  const managerIds = decisionEditableManagerIds(decision);
  const relatedManagersHtml = hasManagersField
    ? `<div><label>Managers associés</label>${checkboxList("deManagers", state.managers, managerIds, manager => `${manager.name} · ${manager.role || ""}`)}</div>`
    : `<div><label>Managers associés</label>${a5List(relations.managers, manager => `<article class="a5-item"><p>${esc(manager.name || "Manager")}${manager.role ? " · " + esc(manager.role) : ""}</p></article>`, "Aucun manager associé.")}</div>`;

  return `
    <div class="form-grid">
      <input id="deTitle" value="${esc(decision.title || "")}" placeholder="Titre ou libellé" class="full">
      <input id="deDate" type="date" value="${esc(decision.date || "")}" placeholder="Date">
      <select id="deStatus">
        <option value="decided" ${decision.status === "decided" ? "selected" : ""}>Décidée</option>
        <option value="applying" ${decision.status === "applying" ? "selected" : ""}>En cours d'application</option>
        <option value="applied" ${decision.status === "applied" ? "selected" : ""}>Appliquée</option>
        <option value="review" ${decision.status === "review" ? "selected" : ""}>À réexaminer</option>
      </select>
      <select id="deImportance">
        <option value="green" ${decision.importance === "green" ? "selected" : ""}>Normal</option>
        <option value="orange" ${decision.importance === "orange" || !decision.importance ? "selected" : ""}>Important</option>
        <option value="red" ${decision.importance === "red" ? "selected" : ""}>Critique</option>
      </select>
      <input id="deOwner" value="${esc(decision.owner || "")}" placeholder="Responsable ou décideur">
      <input id="deReview" value="${esc(decision.reviewDate || "")}" placeholder="Date de revue">
      <input id="deTags" value="${esc((decision.tags || []).join(", "))}" placeholder="Mots-clés" class="full">
    </div>
    <textarea id="deContext" placeholder="Contexte">${esc(decision.context || "")}</textarea>
    <textarea id="deProblem" placeholder="Problème à résoudre">${esc(decision.problem || "")}</textarea>
    <textarea id="deDecisionText" placeholder="Décision prise">${esc(decision.decision || decision.nextStep || "")}</textarea>
    <textarea id="deRationale" placeholder="Justification">${esc(decision.rationale || "")}</textarea>
    <textarea id="deAlternatives" placeholder="Alternatives étudiées">${esc(decision.alternatives || "")}</textarea>
    <textarea id="deImpacts" placeholder="Impacts">${esc(decision.impacts || decision.impact || "")}</textarea>
    <textarea id="deRisks" placeholder="Risques">${esc(decision.risks || "")}</textarea>
    <textarea id="deNextStep" placeholder="Prochaine étape">${esc(decision.nextStep || "")}</textarea>
    <div class="grid two manager-links">
      <div><label>Dossiers liés</label>${checkboxList("deFolders", state.folders, normalizeLinkedIdArray(decision.linkedFolders), folder => folder.name)}</div>
      <div><label>Projets liés</label>${checkboxList("deProjects", state.projects, normalizeLinkedIdArray(decision.linkedProjects), project => project.name)}</div>
      <div><label>Actions liées</label>${checkboxList("deActions", state.actions, normalizeLinkedIdArray(decision.linkedActions), action => action.title)}</div>
      <div><label>Documents liés</label>${checkboxList("deDocuments", state.documents, normalizeLinkedIdArray(decision.linkedDocuments), document => document.title)}</div>
      ${relatedManagersHtml}
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Rendez-vous liés</h3>
      ${decisionRenderRelatedMeetings(decision)}
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Notes du directeur</h3>
      ${decisionNotesList(decision)}
    </div>
    <div class="modal-actions">
      <button class="action" type="button" onclick="saveDecisionEdit('${esc(decision.id)}')">Enregistrer</button>
      <button class="secondary" type="button" onclick="closeDecisionEditModal()">Annuler</button>
    </div>
  `;
}

function renderDecisionEditModal() {
  if (!decisionEditDialog.open) return "";
  const decision = byId("decisions", decisionEditDialog.decisionId);
  if (!decision) return "";
  const errorHtml = decisionEditDialog.error ? `<p class="folder-delete-error">${esc(decisionEditDialog.error)}</p>` : "";
  return `<div class="modal-backdrop decision-edit-modal" onclick="closeDecisionEditModal()"><div class="modal-panel" style="max-height:88vh;overflow-y:auto" onclick="event.stopPropagation()"><div class="modal-head"><h2>Modifier décision</h2><button class="icon-close" type="button" onclick="closeDecisionEditModal()" aria-label="Fermer">×</button></div>${errorHtml}${decisionEditModalBody(decision)}</div></div>`;
}

function renderDecisionDeleteModal() {
  if (!decisionDeleteDialog.open) return "";
  const decision = byId("decisions", decisionDeleteDialog.decisionId);
  if (!decision) return "";
  const errorHtml = decisionDeleteDialog.error ? `<p class="folder-delete-error">${esc(decisionDeleteDialog.error)}</p>` : "";
  return `<div class="modal-backdrop decision-delete-modal" onclick="closeDecisionDeleteModal()"><div class="modal-panel" onclick="event.stopPropagation()"><div class="modal-head"><h2>Supprimer la décision</h2><button class="icon-close" type="button" onclick="closeDecisionDeleteModal()" aria-label="Fermer">×</button></div><p>Confirmer la suppression de <strong>${esc(decision.title || "Décision")}</strong>.</p><p class="muted">Aucune suppression ne sera effectuée si vous annulez.</p>${errorHtml}<div class="grid two"><div class="card"><h3>Relations</h3><p><strong>Dossiers :</strong> ${normalizeLinkedIdArray(decision.linkedFolders).length}</p><p><strong>Projets :</strong> ${normalizeLinkedIdArray(decision.linkedProjects).length}</p><p><strong>Actions :</strong> ${normalizeLinkedIdArray(decision.linkedActions).length}</p><p><strong>Documents :</strong> ${normalizeLinkedIdArray(decision.linkedDocuments).length}</p><p><strong>Managers :</strong> ${decisionEditableManagerIds(decision).length}</p></div><div class="card"><h3>Rappel</h3><p>${esc(decision.context || decision.problem || "Décision à confirmer avant suppression.")}</p></div></div><div class="modal-actions"><button class="danger" type="button" onclick="confirmDecisionDelete('${esc(decision.id)}')">Supprimer</button><button class="secondary" type="button" onclick="closeDecisionDeleteModal()">Annuler</button></div></div></div></div>`;
}

function renderDecisionModalOverlays() {
  const root = document.getElementById("app");
  if (!root) return;
  root.querySelectorAll(".decision-edit-modal, .decision-delete-modal").forEach(node => node.remove());
  if (decisionEditDialog.open) root.insertAdjacentHTML("beforeend", renderDecisionEditModal());
  if (decisionDeleteDialog.open) root.insertAdjacentHTML("beforeend", renderDecisionDeleteModal());
}

function openDecisionEditModal(id) {
  const decision = byId("decisions", id);
  if (!decision) return;
  ensureActionModalHooks();
  decisionEditDialog = { open: true, decisionId: String(id), error: "" };
  renderDecisionModalOverlays();
}

function closeDecisionEditModal() {
  if (!decisionEditDialog.open) return;
  decisionEditDialog = { open: false, decisionId: "", error: "" };
  renderDecisionModalOverlays();
}

function openDecisionDeleteModal(id) {
  const decision = byId("decisions", id);
  if (!decision) return;
  ensureActionModalHooks();
  decisionDeleteDialog = { open: true, decisionId: String(id), error: "" };
  renderDecisionModalOverlays();
}

function closeDecisionDeleteModal() {
  if (!decisionDeleteDialog.open) return;
  decisionDeleteDialog = { open: false, decisionId: "", error: "" };
  renderDecisionModalOverlays();
}

function saveDecisionEdit(id) {
  const i = indexById("decisions", id);
  if (i < 0) return false;
  const current = state.decisions[i];
  const title = document.getElementById("deTitle")?.value.trim() || "";
  if (!title) {
    decisionEditDialog.error = "Le titre de la décision est obligatoire.";
    renderDecisionModalOverlays();
    return false;
  }
  const next = {
    ...current,
    title,
    date: document.getElementById("deDate")?.value || "",
    status: document.getElementById("deStatus")?.value || "decided",
    importance: document.getElementById("deImportance")?.value || "orange",
    owner: document.getElementById("deOwner")?.value.trim() || "",
    reviewDate: document.getElementById("deReview")?.value || "",
    tags: splitTags(document.getElementById("deTags")?.value || ""),
    context: document.getElementById("deContext")?.value.trim() || "",
    problem: document.getElementById("deProblem")?.value.trim() || "",
    decision: document.getElementById("deDecisionText")?.value.trim() || "",
    rationale: document.getElementById("deRationale")?.value.trim() || "",
    alternatives: document.getElementById("deAlternatives")?.value.trim() || "",
    impacts: document.getElementById("deImpacts")?.value.trim() || "",
    impact: document.getElementById("deImpacts")?.value.trim() || "",
    risks: document.getElementById("deRisks")?.value.trim() || "",
    nextStep: document.getElementById("deNextStep")?.value.trim() || "",
    linkedFolders: normalizeLinkedIdArray(checkedValues("deFolders")),
    linkedProjects: normalizeLinkedIdArray(checkedValues("deProjects")),
    linkedActions: normalizeLinkedIdArray(checkedValues("deActions")),
    linkedDocuments: normalizeLinkedIdArray(checkedValues("deDocuments"))
  };
  const managerIds = decisionEditableManagerIds(current);
  const selectedManagers = normalizeLinkedManagerIds(checkedValues("deManagers"));
  next.linkedManagers = selectedManagers.length ? selectedManagers : managerIds;
  if (Object.prototype.hasOwnProperty.call(current, "linkedManagerIds")) next.linkedManagerIds = next.linkedManagers;
  state.decisions[i] = normalizeEntity("decisions", next);
  persist("decisions");
  syncDecisionBacklinks(state.decisions[i]);
  addActivity("📌 Décision modifiée", state.decisions[i].title, state.decisions[i].nextStep || state.decisions[i].decision || "", id);
  if (a5SummaryDialog.open && a5SummaryDialog.type === "decision" && sameId(a5SummaryDialog.sourceId, id)) {
    a5SummaryDialog.model = buildDecisionA5Summary(id);
  }
  closeDecisionEditModal();
  if (sameId(decisionDetailId, id)) {
    openDecision(id);
  } else {
    renderDecisions();
  }
  return true;
}

function confirmDecisionDelete(id) {
  const i = indexById("decisions", id);
  if (i < 0) return false;
  const title = state.decisions[i].title;
  state.decisions.splice(i, 1);
  state.managers.forEach(manager => manager.linkedDecisions = ensureArray(manager.linkedDecisions).filter(linkedId => linkedId !== id));
  state.projects.forEach(project => project.linkedDecisions = ensureArray(project.linkedDecisions).filter(linkedId => linkedId !== id));
  persist("decisions");
  persist("managers");
  persist("projects");
  addActivity("🗑️ Décision supprimée", title);
  if (a5SummaryDialog.open && a5SummaryDialog.type === "decision" && sameId(a5SummaryDialog.sourceId, id)) {
    closeA5SummaryPreview();
  }
  closeDecisionDeleteModal();
  if (sameId(decisionDetailId, id)) {
    decisionDetailId = "";
    renderDecisions();
  } else {
    renderDecisions();
  }
  return true;
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
  addActivity("📅 Événement décision", d.title, title, id);
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
  addActivity("? Action créée depuis décision", action.title, d.title, id);
  openDecision(id);
}

function toggleLinkedDecisionAction(decisionId, actionId) {
  const a = byId("actions", actionId);
  if (!a) return;
  a.done = !a.done;
  persist("actions");
  addActivity("? Action décision modifiée", a.title, a.done ? "Terminée" : "Réouverte", decisionId);
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
  addActivity("🗑️ Décision supprimée", t);
  renderDecisions();
}

const journalTypes = ["CODIR", "Gemba", "Entretien manager", "CSE", "Incident", "Note rapide", "Projet", "Autre"];

function renderJournal() {
  document.getElementById("viewTitle").textContent = "Journal";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "journal"));
  appHtml(`<div class="card hero"><h2>Journal opérationnel</h2><p class="muted">Le journal mémorise : conservez ici la mémoire chronologique des événements importants.</p></div><div class="card"><h2>Ajouter une entrée</h2><input id="jTitle" placeholder="Titre"><div class="form-grid"><input id="jDate" value="${esc(today())}" placeholder="Date"><select id="jType">${journalTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select><input id="jTags" placeholder="Mots-clés" class="full"></div><textarea id="jSummary" placeholder="Résumé"></textarea><div class="grid two manager-links"><div><label>Dossiers liés</label>${folderSelect("jFolders")}</div><div><label>Projets concernés</label>${checkboxList("jProjects", state.projects, [], p => p.name)}</div></div><button class="action" onclick="addJournal()">Ajouter</button></div>${state.journal.map(journalCard).join("") || `<div class="card empty">Aucune entrée.</div>`}`);
}

function journalCard(j) {
  return `<div class="card clickable" onclick="openJournal('${j.id}')"><h2>${esc(j.title)}</h2><p>${esc(j.summary || j.content || "")}</p><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Note rapide")} ? ${(j.tags || []).map(esc).join(", ")}</span><span class="meta">ID ${esc(j.id)}</span></div>`;
}

function addJournal() {
  const title = document.getElementById("jTitle").value.trim() || "Entrée journal";
  const j = { id: newId("journal"), title, date: document.getElementById("jDate").value.trim() || today(), entryType: document.getElementById("jType").value, summary: document.getElementById("jSummary").value.trim(), content: document.getElementById("jSummary").value.trim(), facts: "", analysis: "", decisionsText: "", actionsText: "", linkedManagers: [], linkedProjects: checkedValues("jProjects"), linkedDecisions: [], linkedActions: [], linkedDocuments: [], watchPoints: "", nextSteps: "", notes: "", events: [], tags: splitTags(document.getElementById("jTags").value), linkedFolders: checkedValues("jFolders"), mood: "", links: "" };
  state.journal.unshift(j);
  persist("journal");
  addActivity("📰 Journal", j.title, j.summary, j.id);
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
  return linked.map(a => `<div class="item"><strong>${a.done ? "?" : "?"} ${esc(a.title)}</strong><span class="muted">${esc(a.link || "")}</span><span class="meta">ID ${esc(a.id)}</span></div>`).join("") || `<div class="empty">Aucune action générée.</div>`;
}

function journalDocumentsList(j) {
  const linked = state.documents.filter(d => (j.linkedDocuments || []).includes(d.id) || (d.linkedJournal || []).includes(j.id));
  return linked.map(d => `<div class="item"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")}${d.status ? " · " + esc(d.status) : ""}</span><span class="meta">ID ${esc(d.id)}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`;
}

function journalTimeline(j) {
  const events = (j.events || []).map(e => ({ date: e.date || "", title: e.title || "Événement", detail: e.detail || "", kind: "Événement" }));
  const activities = state.activity.filter(a => a.entityId === j.id).map(a => ({ date: a.date || "", title: a.type || "Activité", detail: `${a.title || ""}${a.detail ? " · " + a.detail : ""}`, kind: "Activité" }));
  return [...events, ...activities].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(e => `<div class="item"><strong>${esc(e.date || "Sans date")} · ${esc(e.title)}</strong><span class="muted">${esc(e.kind)}${e.detail ? " · " + esc(e.detail) : ""}</span></div>`).join("") || `<div class="empty">Aucun événement.</div>`;
}

function journalQuickForm(j, mode = "") {
  if (mode === "action") return `<div class="card full-span"><h2>Ajouter une action liée</h2><input id="jaTitle" placeholder="Action ? créer"><div class="grid three manager-links"><div><label>Managers concernés</label>${checkboxList("jaManagers", state.managers, j.linkedManagers, m => `${m.name} ? ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("jaProjects", state.projects, j.linkedProjects, p => p.name)}</div><div><label>Décisions concernées</label>${checkboxList("jaDecisions", state.decisions, j.linkedDecisions, d => d.title)}</div></div><button class="action" onclick="saveJournalAction('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`;
  if (mode === "decision") return `<div class="card full-span"><h2>Ajouter une décision liée</h2><input id="jdTitle" placeholder="Titre de la décision"><textarea id="jdContext" placeholder="Contexte"></textarea><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("jdManagers", state.managers, j.linkedManagers, m => `${m.name} ? ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("jdProjects", state.projects, j.linkedProjects, p => p.name)}</div></div><button class="action" onclick="saveJournalDecision('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`;
  if (mode === "event") return `<div class="card full-span"><h2>Ajouter un événement</h2><div class="form-grid"><input id="jeTitle" placeholder="Titre de l'événement"><input id="jeDate" value="${esc(new Date().toLocaleString("fr-FR"))}" placeholder="Date"></div><textarea id="jeDetail" placeholder="Détail de l'événement"></textarea><button class="action" onclick="saveJournalEvent('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`;
  return "";
}

function openJournal(id, mode = "") {
  const j = byId("journal", id);
  if (!j) return renderJournal();
  document.getElementById("viewTitle").textContent = j.title;
  appHtml(`<div class="card hero manager-hero"><button class="secondary" onclick="renderJournal()">Retour Journal</button><h2>${esc(j.title)}</h2><p>${esc(j.summary || j.content || "")}</p><span class="muted">${esc(j.date || "")} · ${esc(j.entryType || "Note rapide")}</span><span class="meta">ID ${esc(j.id)}</span><div class="row-actions"><button class="action" onclick="editJournal('${j.id}')">Modifier</button><button class="secondary" onclick="startReport('journal','${j.id}')">Générer un compte rendu</button><button class="secondary" onclick="openJournal('${j.id}','action')">Ajouter une action liée</button><button class="secondary" onclick="openJournal('${j.id}','decision')">Ajouter une décision liée</button><button class="secondary" onclick="openJournal('${j.id}','event')">Ajouter un événement</button><button class="danger" onclick="deleteJournal('${j.id}')">Supprimer</button></div></div><div class="grid two">${journalQuickForm(j, mode)}<div class="card"><h2>Résumé</h2><p>${esc(j.summary || "À compléter")}</p></div><div class="card"><h2>Faits observés</h2><p>${esc(j.facts || "À compléter")}</p></div><div class="card"><h2>Analyse du directeur</h2><p>${esc(j.analysis || "À compléter")}</p></div><div class="card"><h2>Décisions prises</h2><p>${esc(j.decisionsText || "À compléter")}</p></div><div class="card"><h2>Actions générées</h2>${journalActionsList(j)}${j.actionsText ? `<p class="muted">${esc(j.actionsText)}</p>` : ""}</div><div class="card"><h2>Managers concernés</h2>${journalManagersList(j)}</div><div class="card"><h2>Projets concernés</h2>${journalProjectsList(j)}</div><div class="card"><h2>Décisions liées</h2>${journalDecisionsList(j)}</div><div class="card"><h2>Documents liés</h2>${journalDocumentsList(j)}</div><div class="card"><h2>Dossiers liés</h2>${linkedFoldersList(j)}</div><div class="card"><h2>Points de vigilance</h2><p>${esc(j.watchPoints || "À compléter")}</p></div><div class="card"><h2>Suites à donner</h2><p>${esc(j.nextSteps || "À compléter")}</p></div><div class="card"><h2>Notes complémentaires</h2><p>${esc(j.notes || "À compléter")}</p></div><div class="card"><h2>Mots-clés</h2>${listItems(j.tags)}</div><div class="card full-span"><h2>Historique chronologique</h2>${journalTimeline(j)}</div></div>`);
}

function editJournal(id) {
  const j = byId("journal", id);
  if (!j) return;
  document.getElementById("viewTitle").textContent = "Modifier " + j.title;
  appHtml(`<div class="card"><h2>Modifier entrée Journal</h2><input id="ejTitle" value="${esc(j.title)}" placeholder="Titre"><div class="form-grid"><input id="ejDate" value="${esc(j.date || "")}" placeholder="Date"><select id="ejType">${journalTypes.map(t => `<option value="${esc(t)}" ${j.entryType === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><input id="ejTags" value="${esc((j.tags || []).join(", "))}" placeholder="Mots-clés" class="full"></div><textarea id="ejSummary" placeholder="Résumé">${esc(j.summary || j.content || "")}</textarea><textarea id="ejFacts" placeholder="Faits observés">${esc(j.facts || "")}</textarea><textarea id="ejAnalysis" placeholder="Analyse du directeur">${esc(j.analysis || "")}</textarea><textarea id="ejDecisionsText" placeholder="Décisions prises">${esc(j.decisionsText || "")}</textarea><textarea id="ejActionsText" placeholder="Actions générées">${esc(j.actionsText || "")}</textarea><textarea id="ejWatch" placeholder="Points de vigilance">${esc(j.watchPoints || "")}</textarea><textarea id="ejNext" placeholder="Suites à donner">${esc(j.nextSteps || "")}</textarea><textarea id="ejNotes" placeholder="Notes complémentaires">${esc(j.notes || "")}</textarea><div class="grid two manager-links"><div><label>Managers concernés</label>${checkboxList("ejManagers", state.managers, j.linkedManagers, m => `${m.name} ? ${m.role || ""}`)}</div><div><label>Projets concernés</label>${checkboxList("ejProjects", state.projects, j.linkedProjects, p => p.name)}</div><div><label>Décisions liées</label>${checkboxList("ejDecisions", state.decisions, j.linkedDecisions, d => d.title)}</div><div><label>Actions liées</label>${checkboxList("ejActions", state.actions, j.linkedActions, a => a.title)}</div><div><label>Documents liés</label>${checkboxList("ejDocuments", state.documents, j.linkedDocuments, d => d.title)}</div><div><label>Dossiers liés</label>${folderSelect("ejFolders", j.linkedFolders || [])}</div></div><button class="action" onclick="saveJournal('${j.id}')">Enregistrer</button><button class="secondary" onclick="openJournal('${j.id}')">Annuler</button></div>`);
}

function saveJournal(id) {
  const i = indexById("journal", id);
  if (i < 0) return;
  state.journal[i] = { ...state.journal[i], title: document.getElementById("ejTitle").value.trim(), date: document.getElementById("ejDate").value.trim(), entryType: document.getElementById("ejType").value, summary: document.getElementById("ejSummary").value.trim(), content: document.getElementById("ejSummary").value.trim(), facts: document.getElementById("ejFacts").value.trim(), analysis: document.getElementById("ejAnalysis").value.trim(), decisionsText: document.getElementById("ejDecisionsText").value.trim(), actionsText: document.getElementById("ejActionsText").value.trim(), watchPoints: document.getElementById("ejWatch").value.trim(), nextSteps: document.getElementById("ejNext").value.trim(), notes: document.getElementById("ejNotes").value.trim(), tags: splitTags(document.getElementById("ejTags").value), linkedManagers: checkedValues("ejManagers"), linkedProjects: checkedValues("ejProjects"), linkedDecisions: checkedValues("ejDecisions"), linkedActions: checkedValues("ejActions"), linkedDocuments: checkedValues("ejDocuments"), linkedFolders: checkedValues("ejFolders") };
  persist("journal");
  addActivity("📰 Journal modifié", state.journal[i].title, state.journal[i].summary, id);
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
  addActivity("? Action créée depuis Journal", action.title, j.title, id);
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
  addActivity("📰 Décision créée depuis Journal", decision.title, j.title, id);
  openJournal(id);
}

function saveJournalEvent(id) {
  const j = byId("journal", id);
  if (!j) return;
  const title = document.getElementById("jeTitle").value.trim();
  if (!title) return;
  j.events.unshift({ id: newId("event"), date: document.getElementById("jeDate").value.trim() || new Date().toLocaleString("fr-FR"), title, detail: document.getElementById("jeDetail").value.trim() });
  persist("journal");
  addActivity("📅 Événement Journal", j.title, title, id);
  openJournal(id);
}

function deleteJournal(id) {
  const i = indexById("journal", id);
  if (i < 0 || !confirm("Supprimer cette entrée ?")) return;
  const t = state.journal[i].title;
  state.journal.splice(i, 1);
  persist("journal");
  addActivity("🗑️ Journal supprimé", t);
  renderJournal();
}

const perfMonths = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const perfJobs = ["Préparation", "Réception", "Manutention", "Chargement", "Transit"];
const perfAbsences = ["Maladie", "Accidents du travail", "Congés", "Formation", "Autres absences"];
const perfQuality = ["Casse livraison", "Non livrés", "Litiges", "Casse entrepôt", "Périmés entrepôt", "Contrôle stock", "Dons", "Total Gains & Pertes"];
let performanceEdit = false;
let performanceSelectedId = "";

function perfMetric() {
  return { historical: "", budget: "", actual: "", comment: "", causes: "", actions: "" };
}

function perfDefaultPeriod(year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
  const jobs = Object.fromEntries(perfJobs.map(job => [job, { ...perfMetric(), hoursBudgetGap: "", hoursHistoricalGap: "", status: "green", cdiProductivity: "", cddProductivity: "", ettProductivity: "", totalProductivity: "", cdiHoursShare: "", cddHoursShare: "", ettHoursShare: "", bicReference: "", supplyAverage: "" }]));
  return {
    id: newId("performance"), year: Number(year), month: Number(month), status: "Brouillon", updatedAt: isoToday(),
    activity: { historical: "", budget: "", actual: "", comment: "", highlights: "", causes: "", projection: "" },
    ipo: { total: perfMetric(), variable: perfMetric(), mixEffect: "", directProductivityGap: "", businessMixEffect: "", indirectHoursGap: "", indirectHoursCrush: "", ipoPointCost: "", analysis: "", rootCauses: "", trend: "", projection: "" },
    productivity: jobs,
    hours: { total: perfMetric(), direct: perfMetric(), indirect: { ...perfMetric(), totalShare: "" }, overtime: "", night: "", sundays: "", holidays: "", analysis: "", causes: "", levers: "" },
    absenteeism: { total: perfMetric(), details: Object.fromEntries(perfAbsences.map(k => [k, { ...perfMetric(), hours: "" }])), comment: "", causes: "", impacts: "", hrActions: "", projection: "" },
    quality: { indicators: Object.fromEntries(perfQuality.map(k => [k, perfMetric()])), highlights: "", causes: "", correctiveActions: "" },
    palletHeight: { historical: "", objective: "", budget: "", actual: "", trend: "", comment: "", causes: "", actions: "" },
    synthesis: "", linkedManagers: [], linkedProjects: [], linkedFolders: [], linkedActions: [], linkedDecisions: [], linkedJournal: [], linkedDocuments: [], importSources: [], complementaryKpis: [],
    importReady: { excel: false, cgtab: false, guidePerformance: false, ga: false, gemed: false, tbag: false }
  };
}

function normalizePerformance(item) {
  const base = perfDefaultPeriod(item.year || new Date().getFullYear(), item.month || (new Date().getMonth() + 1));
  const merged = { ...base, ...item };
  merged.activity = { ...base.activity, ...(item.activity || {}) };
  merged.ipo = { ...base.ipo, ...(item.ipo || {}), total: { ...base.ipo.total, ...(item.ipo?.total || {}) }, variable: { ...base.ipo.variable, ...(item.ipo?.variable || {}) } };
  merged.productivity = Object.fromEntries(perfJobs.map(job => [job, { ...base.productivity[job], ...(item.productivity?.[job] || {}) }]));
  merged.hours = { ...base.hours, ...(item.hours || {}), total: { ...base.hours.total, ...(item.hours?.total || {}) }, direct: { ...base.hours.direct, ...(item.hours?.direct || {}) }, indirect: { ...base.hours.indirect, ...(item.hours?.indirect || {}) } };
  merged.absenteeism = { ...base.absenteeism, ...(item.absenteeism || {}), total: { ...base.absenteeism.total, ...(item.absenteeism?.total || {}) }, details: Object.fromEntries(perfAbsences.map(k => [k, { ...base.absenteeism.details[k], ...(item.absenteeism?.details?.[k] || {}) }])) };
  merged.quality = { ...base.quality, ...(item.quality || {}), indicators: Object.fromEntries(perfQuality.map(k => [k, { ...base.quality.indicators[k], ...(item.quality?.indicators?.[k] || {}) }])) };
  merged.palletHeight = { ...base.palletHeight, ...(item.palletHeight || {}) };
  return { ...merged, linkedManagers: ensureArray(merged.linkedManagers), linkedProjects: ensureArray(merged.linkedProjects), linkedFolders: ensureArray(merged.linkedFolders), linkedActions: ensureArray(merged.linkedActions), linkedDecisions: ensureArray(merged.linkedDecisions), linkedJournal: ensureArray(merged.linkedJournal), linkedDocuments: ensureArray(merged.linkedDocuments), importSources: ensureArray(merged.importSources), complementaryKpis: ensureArray(merged.complementaryKpis) };
}

function perfNum(v) {
  const n = Number(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function perfHas(v) {
  return String(v ?? "").trim() !== "";
}

function perfGap(actual, ref) {
  if (!perfHas(actual) || !perfHas(ref)) return { value: "", pct: "" };
  const a = perfNum(actual), r = perfNum(ref), gap = a - r;
  return { value: gap, pct: r ? gap / r * 100 : "" };
}

function perfFmt(v, suffix = "") {
  if (v === "" || v === null || Number.isNaN(v)) return "À compléter";
  return `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${suffix}`;
}

function perfStatus(metric) {
  const gap = perfGap(metric.actual, metric.budget).pct;
  if (gap === "") return "green";
  const abs = Math.abs(gap);
  if (abs >= 10) return "red";
  if (abs >= 5) return "orange";
  return "green";
}

function perfPeriodLabel(p) {
  return `${perfMonths[(Number(p.month) || 1) - 1]} ${p.year}`;
}

function perfKey(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase() || "metric";
}

function perfSelected() {
  return byId("performance", performanceSelectedId) || state.performance[0] || null;
}

function renderPerformance() {
  document.getElementById("viewTitle").textContent = "Performance";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "performance"));
  if (performanceImportWizard) return renderPerformanceImportWizard();
  if (!state.performance.length) {
    appHtml(`<div class="card hero performance-hero"><div class="row"><div><h2>Performance</h2><p class="muted">Pilotage mensuel et annuel des indicateurs du site.</p></div><div class="row-actions"><button class="action" onclick="newPerformanceMonth()">Nouveau mois</button><button class="secondary" onclick="startPerformanceImport()">Importer mes données</button></div></div></div><div class="card empty">Aucune période enregistrée.</div>${performanceImportHistory()}`);
    return;
  }
  if (!performanceSelectedId || !byId("performance", performanceSelectedId)) performanceSelectedId = state.performance[0].id;
  const p = perfSelected();
  const years = [...new Set(state.performance.map(x => x.year))].sort((a, b) => b - a);
  const periods = state.performance.filter(x => Number(x.year) === Number(p.year)).sort((a, b) => a.month - b.month);
  appHtml(`<div class="card hero performance-hero"><div class="row"><div><h2>Performance</h2><p class="muted">Pilotage mensuel et annuel, saisie manuelle et calculs automatiques.</p></div><div class="row-actions"><button class="action" onclick="newPerformanceMonth()">Nouveau mois</button><button class="secondary" onclick="duplicatePerformancePrevious()">Dupliquer le mois précédent</button><button class="secondary" onclick="startPerformanceRdp('${p.id}')">Générer une synthèse RDP</button><button class="secondary" onclick="startPerformanceImport()">Importer mes données</button></div></div><div class="performance-selectors"><select onchange="selectPerformanceYear(this.value)">${years.map(y => `<option ${Number(p.year) === Number(y) ? "selected" : ""}>${y}</option>`).join("")}</select><select onchange="openPerformance(this.value)">${periods.map(m => `<option value="${m.id}" ${p.id === m.id ? "selected" : ""}>${esc(perfPeriodLabel(m))}</option>`).join("")}</select></div></div>${performanceEdit ? performanceForm(p) : performanceView(p)}`);
}

function openPerformance(id) {
  performanceSelectedId = id;
  performanceEdit = false;
  renderPerformance();
}

function selectPerformanceYear(year) {
  const period = state.performance.find(p => Number(p.year) === Number(year));
  if (period) performanceSelectedId = period.id;
  renderPerformance();
}

function newPerformanceMonth() {
  const p = perfDefaultPeriod(new Date().getFullYear(), new Date().getMonth() + 1);
  state.performance.unshift(p);
  performanceSelectedId = p.id;
  performanceEdit = true;
  persist("performance");
  renderPerformance();
}

function duplicatePerformancePrevious() {
  const current = perfSelected();
  if (!current) return newPerformanceMonth();
  const prevMonth = current.month === 1 ? 12 : current.month - 1;
  const prevYear = current.month === 1 ? current.year - 1 : current.year;
  const prev = state.performance.find(p => Number(p.month) === prevMonth && Number(p.year) === prevYear);
  if (!prev) return alert("Aucun mois précédent disponible.");
  const copy = normalizePerformance(JSON.parse(JSON.stringify(prev)));
  copy.id = current.id;
  copy.year = current.year;
  copy.month = current.month;
  copy.status = "Brouillon";
  copy.updatedAt = isoToday();
  state.performance[indexById("performance", current.id)] = copy;
  performanceSelectedId = current.id;
  performanceEdit = true;
  persist("performance");
  renderPerformance();
}

function performanceView(p) {
  const actions = state.actions.filter(a => (a.linkedPerformance || []).includes(p.id) || (p.link || "").includes(perfPeriodLabel(p)));
  const decisions = state.decisions.filter(d => (d.linkedPerformance || []).includes(p.id));
  const documents = state.documents.filter(d => (d.linkedPerformance || []).includes(p.id));
  return `<div class="card"><div class="row"><div><h2>${esc(perfPeriodLabel(p))}</h2><span class="muted">Statut : ${esc(p.status)} ? Dernière mise à jour : ${esc(p.updatedAt || "")}</span></div><div class="row-actions"><button class="action" onclick="performanceEdit=true;renderPerformance()">Modifier</button><button class="secondary" onclick="startPerformanceRdp('${p.id}')">Générer une synthèse RDP</button></div></div></div><div class="grid two"><div class="card"><h2>Activité</h2>${perfMetricBlock("Colis", p.activity)}</div><div class="card"><h2>IPO</h2>${perfMetricBlock("IPO total", p.ipo.total)}${perfMetricBlock("IPO variable", p.ipo.variable)}</div><div class="card full-span"><h2>Productivité par métier</h2>${perfProductivityTable(p)}</div><div class="card"><h2>Heures</h2>${perfMetricBlock("Heures totales", p.hours.total)}${perfMetricBlock("Heures indirectes", p.hours.indirect)}</div><div class="card"><h2>Absentéisme</h2>${perfMetricBlock("Absentéisme total", p.absenteeism.total)}</div><div class="card"><h2>Qualité et Gains & Pertes</h2>${perfQualitySummary(p)}</div><div class="card"><h2>Hauteur palette</h2>${perfPalletSummary(p)}</div><div class="card"><h2>Synthèse DE</h2><p>${esc(p.synthesis || buildPerformanceSynthesis(p))}</p></div><div class="card full-span"><h2>Historique et tendances</h2>${perfCharts()}</div><div class="card"><h2>Actions liées</h2>${actions.map(a => `<div class="item"><strong>${esc(a.title)}</strong><span class="muted">${esc(a.owner || "")} · ${esc(a.due || "")}</span></div>`).join("") || `<div class="empty">Aucune action liée.</div>`}</div><div class="card"><h2>Décisions liées</h2>${decisions.map(d => `<div class="item clickable" onclick="openDecision('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(decisionStatusLabel(d.status))}</span></div>`).join("") || `<div class="empty">Aucune décision liée.</div>`}</div><div class="card full-span"><h2>Documents et comptes rendus liés</h2>${documents.map(d => `<div class="item clickable" onclick="editDocument('${d.id}')"><strong>${esc(d.title)}</strong><span class="muted">${esc(d.type || "")} · ${esc(d.category || "")} · ${esc(d.status || "")}</span></div>`).join("") || `<div class="empty">Aucun document lié.</div>`}</div>${performanceSourceBlock(p)}<div class="card full-span">${performanceImportHistory()}</div></div>`;
}

function performanceSourceBlock(p) {
  const imports = performanceImportsForPeriod(p);
  const legacySources = imports.length ? [] : compactLegacyPerformanceSources(p);
  if (!imports.length && !legacySources.length) return "";
  return `<div class="card full-span"><h2>Sources importées</h2>${imports.map(item => performanceImportSummaryCard(item, p)).join("")}${legacySources.map(item => performanceLegacyImportSummaryCard(item)).join("")}</div>`;
}

function performanceImportsForPeriod(p) {
  const period = performancePeriodKey(p);
  return state.performance_imports.filter(item => importMatchesPeriod(item, period)).sort((a, b) => String(b.importDate || "").localeCompare(String(a.importDate || "")));
}

function performancePeriodKey(p) {
  return `${String(Number(p.month || 0)).padStart(2, "0")}/${p.year}`;
}

function importMatchesPeriod(item, period) {
  const periods = [...ensureArray(item.periods), ...String(item.period || "").split(",").map(x => x.trim()), ...ensureArray(item.indicators).map(x => x.period)].filter(Boolean);
  return periods.includes(period);
}

function performanceImportPeriodTitle(item, p) {
  const period = importMatchesPeriod(item, performancePeriodKey(p)) ? performancePeriodKey(p) : (ensureArray(item.periods)[0] || item.period || "");
  const [month, year] = String(period).split("/").map(Number);
  return month && year ? `${perfMonths[month - 1]} ${year}` : period || perfPeriodLabel(p);
}

function performanceImportSummaryCard(item, p) {
  const period = performancePeriodKey(p);
  const indicators = ensureArray(item.indicators).filter(row => !row.period || row.period === period);
  const imported = Number(item.importedCount ?? indicators.filter(row => row.selected && row.destinationPath).length);
  const detected = ensureArray(item.indicators).length;
  const conflicts = Number(item.conflictCount ?? ensureArray(item.conflicts).length);
  const expanded = expandedPerformanceImportId === item.id;
  return `<div class="item import-summary">
    <div>
      <strong>Source : ${esc(performanceImportSourceLabel(item))} — ${esc(performanceImportPeriodTitle(item, p))}</strong>
      <span class="muted">${imported} indicateur(s) importé(s) · ${detected} détecté(s) · ${conflicts} conflit(s)</span>
      <span class="meta">${esc(item.sourceFile || "")}${item.site ? " · Site " + esc(item.site) : ""}${item.importDate ? " · " + esc(item.importDate) : ""}</span>
    </div>
    <div class="row-actions"><button class="secondary" onclick="togglePerformanceImportDetail('${esc(item.id)}')">${expanded ? "Masquer le détail" : "Voir le détail"}</button></div>
    ${expanded ? performanceImportInlineDetail(indicators) : ""}
  </div>`;
}

function performanceImportInlineDetail(indicators) {
  const importedRows = indicators.filter(row => row.selected && row.destinationPath && row.action !== "keep" && row.action !== "ignore");
  const rows = importedRows.map(row => `<tr><td>${esc(row.indicator || "")}</td><td>${esc(row.destinationLabel || "KPI complémentaire — non mappé")}</td><td>${esc(row.value ?? "")}</td><td>${esc(row.period || "")}</td><td>${esc(row.confidence || "")}</td></tr>`).join("");
  return `<div class="import-detail"><table class="perf-table"><thead><tr><th>Indicateur source</th><th>Indicateur DEOS cible</th><th>Valeur importée</th><th>Période</th><th>Confiance</th></tr></thead><tbody>${rows || `<tr><td colspan="5">Aucun détail disponible.</td></tr>`}</tbody></table></div>`;
}

function performanceImportSourceLabel(item) {
  const label = item.sourceType || item.source || "Import";
  return /z\s*gemed/i.test(label) ? "Z GEMED" : label;
}

function togglePerformanceImportDetail(id) {
  expandedPerformanceImportId = expandedPerformanceImportId === id ? "" : id;
  renderPerformance();
}

function compactLegacyPerformanceSources(p) {
  const groups = new Map();
  ensureArray(p.importSources).forEach(source => {
    const key = [source.source || "Import", source.file || "", source.importDate || "", source.period || ""].join("|");
    const current = groups.get(key) || { ...source, importedCount: 0, comments: [] };
    current.importedCount += Number(source.importedCount || 1);
    if (source.comment) current.comments.push(source.comment);
    groups.set(key, current);
  });
  return [...groups.values()];
}

function performanceLegacyImportSummaryCard(item) {
  const detailRows = ensureArray(item.comments).map(comment => {
    const [source, target] = String(comment).split("->").map(x => x.trim());
    return `<tr><td>${esc(source || comment)}</td><td>${esc(target || "")}</td><td></td><td>${esc(item.period || "")}</td><td></td></tr>`;
  }).join("");
  const id = `legacy-${perfKey(`${item.source}-${item.file}-${item.importDate}-${item.period}`)}`;
  const expanded = expandedPerformanceImportId === id;
  return `<div class="item import-summary"><div><strong>Source : ${esc(item.source || "Import")} — ${esc(item.period || "")}</strong><span class="muted">${esc(item.importedCount || 0)} indicateur(s) importé(s)</span><span class="meta">${esc(item.file || "")} · ${esc(item.importDate || "")}</span></div><div class="row-actions"><button class="secondary" onclick="togglePerformanceImportDetail('${id}')">${expanded ? "Masquer le détail" : "Voir le détail"}</button></div>${expanded ? `<div class="import-detail"><table class="perf-table"><thead><tr><th>Indicateur source</th><th>Indicateur DEOS cible</th><th>Valeur importée</th><th>Période</th><th>Confiance</th></tr></thead><tbody>${detailRows || `<tr><td colspan="5">Détail non disponible.</td></tr>`}</tbody></table></div>` : ""}</div>`;
}

function perfMetricBlock(label, metric) {
  const rb = perfGap(metric.actual, metric.budget);
  const rh = perfGap(metric.actual, metric.historical);
  return `<div class="performance-metric"><strong>${esc(label)}</strong><span>Historique ${perfFmt(metric.historical)} ? Budget ${perfFmt(metric.budget)} ? Réalisé ${perfFmt(metric.actual)}</span><small>Écart budget ${perfFmt(rb.value)} (${perfFmt(rb.pct, "%")}) ? Écart historique ${perfFmt(rh.value)} (${perfFmt(rh.pct, "%")})</small></div>`;
}

function perfProductivityTable(p) {
  return `<table class="perf-table"><thead><tr><th>Métier</th><th>Historique</th><th>Budget</th><th>Réalisé</th><th>Écart budget</th><th>Écart historique</th><th>Statut</th><th></th></tr></thead><tbody>${perfJobs.map(job => {
    const m = p.productivity[job], rb = perfGap(m.actual, m.budget), rh = perfGap(m.actual, m.historical), st = perfStatus(m);
    return `<tr><td>${esc(job)}</td><td>${perfFmt(m.historical)}</td><td>${perfFmt(m.budget)}</td><td>${perfFmt(m.actual)}</td><td>${perfFmt(rb.value)}</td><td>${perfFmt(rh.value)}</td><td>${badge(st)}</td><td><button class="secondary" onclick="performanceIndicatorAction('${p.id}','Productivité ${esc(job)}')">Créer une action</button><button class="secondary" onclick="performanceIndicatorDecision('${p.id}','Productivité ${esc(job)}')">Créer une décision</button></td></tr>`;
  }).join("")}</tbody></table>`;
}

function perfQualitySummary(p) {
  return Object.entries(p.quality.indicators).map(([k, m]) => perfMetricBlock(k, m)).join("");
}

function perfPalletSummary(p) {
  const gap = perfGap(p.palletHeight.actual, p.palletHeight.objective);
  return `<div class="performance-metric"><strong>Hauteur palette</strong><span>Historique ${perfFmt(p.palletHeight.historical)} ? Objectif ${perfFmt(p.palletHeight.objective)} ? Budget ${perfFmt(p.palletHeight.budget)} ? Réalisé ${perfFmt(p.palletHeight.actual)}</span><small>Écart objectif ${perfFmt(gap.value)} ? Tendance ${esc(p.palletHeight.trend || "À compléter")}</small></div>`;
}

function performanceForm(p) {
  return `<div class="card"><h2>Modifier ${esc(perfPeriodLabel(p))}</h2><div class="form-grid"><input id="pfYear" type="number" value="${p.year}"><select id="pfMonth">${perfMonths.map((m, i) => `<option value="${i + 1}" ${Number(p.month) === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select><select id="pfStatus"><option ${p.status === "Brouillon" ? "selected" : ""}>Brouillon</option><option ${p.status === "En cours d'analyse" ? "selected" : ""}>En cours d'analyse</option><option ${p.status === "Validé" ? "selected" : ""}>Validé</option><option ${p.status === "Archivé" ? "selected" : ""}>Archivé</option></select></div>${perfMetricForm("Activité colis", "activity", p.activity, ["comment", "highlights", "causes", "projection"])}${perfIpoForm(p)}${perfJobsForm(p)}${perfHoursForm(p)}${perfAbsForm(p)}${perfQualityForm(p)}${perfPalletForm(p)}<div class="card"><h2>Synthèse DE</h2><textarea id="pfSynthesis">${esc(p.synthesis || buildPerformanceSynthesis(p))}</textarea></div><div class="grid three manager-links"><div><label>Managers liés</label>${checkboxList("pfManagers", state.managers, p.linkedManagers, m => m.name)}</div><div><label>Projets liés</label>${checkboxList("pfProjects", state.projects, p.linkedProjects, pr => pr.name)}</div><div><label>Dossiers liés</label>${folderSelect("pfFolders", p.linkedFolders)}</div></div><button class="action" onclick="savePerformance('${p.id}')">Enregistrer</button><button class="secondary" onclick="performanceEdit=false;renderPerformance()">Annuler</button></div>`;
}

function perfMetricForm(title, path, m, textFields = []) {
  return `<div class="card"><h2>${esc(title)}</h2><div class="form-grid"><input id="${path}_historical" type="number" value="${esc(m.historical)}" placeholder="Historique"><input id="${path}_budget" type="number" value="${esc(m.budget)}" placeholder="Budget"><input id="${path}_actual" type="number" value="${esc(m.actual)}" placeholder="Réalisé"></div>${textFields.map(f => `<textarea id="${path}_${f}" placeholder="${esc(f)}">${esc(m[f] || "")}</textarea>`).join("")}</div>`;
}

function perfIpoForm(p) {
  return `${perfMetricForm("IPO Total", "ipo_total", p.ipo.total, ["comment", "causes"])}${perfMetricForm("IPO Variable", "ipo_variable", p.ipo.variable, ["comment", "causes"])}<div class="card"><h2>Facteurs explicatifs IPO</h2><div class="form-grid"><input id="ipo_mixEffect" value="${esc(p.ipo.mixEffect)}" placeholder="Effet mix PC / PH"><input id="ipo_directProductivityGap" value="${esc(p.ipo.directProductivityGap)}" placeholder="Écart productivité directe"><input id="ipo_businessMixEffect" value="${esc(p.ipo.businessMixEffect)}" placeholder="Effet indicateur mix métiers"><input id="ipo_indirectHoursGap" value="${esc(p.ipo.indirectHoursGap)}" placeholder="Écart heures indirectes"><input id="ipo_indirectHoursCrush" value="${esc(p.ipo.indirectHoursCrush)}" placeholder="Écrasement heures indirectes"><input id="ipo_ipoPointCost" value="${esc(p.ipo.ipoPointCost)}" placeholder="Coût du point IPO"></div><textarea id="ipo_analysis" placeholder="Analyse">${esc(p.ipo.analysis)}</textarea><textarea id="ipo_rootCauses" placeholder="Causes racines">${esc(p.ipo.rootCauses)}</textarea><textarea id="ipo_trend" placeholder="Tendance">${esc(p.ipo.trend)}</textarea><textarea id="ipo_projection" placeholder="Projection">${esc(p.ipo.projection)}</textarea></div>`;
}

function perfJobsForm(p) {
  return `<div class="card full-span"><h2>Productivité par métier</h2>${perfJobs.map(job => { const m = p.productivity[job], key = `prod_${perfKey(job)}`; return `<h3>${esc(job)}</h3><div class="form-grid"><input id="${key}_historical" type="number" value="${esc(m.historical)}" placeholder="Historique"><input id="${key}_budget" type="number" value="${esc(m.budget)}" placeholder="Budget"><input id="${key}_actual" type="number" value="${esc(m.actual)}" placeholder="Réalisé"><input id="${key}_hoursBudgetGap" type="number" value="${esc(m.hoursBudgetGap)}" placeholder="Heures écart budget"><input id="${key}_hoursHistoricalGap" type="number" value="${esc(m.hoursHistoricalGap)}" placeholder="Heures écart historique"></div>${job === "Préparation" ? `<div class="form-grid"><input id="${key}_cdiProductivity" value="${esc(m.cdiProductivity)}" placeholder="Productivité CDI"><input id="${key}_cddProductivity" value="${esc(m.cddProductivity)}" placeholder="Productivité CDD"><input id="${key}_ettProductivity" value="${esc(m.ettProductivity)}" placeholder="Productivité ETT"><input id="${key}_totalProductivity" value="${esc(m.totalProductivity)}" placeholder="Productivité totale"><input id="${key}_cdiHoursShare" value="${esc(m.cdiHoursShare)}" placeholder="Part heures CDI"><input id="${key}_cddHoursShare" value="${esc(m.cddHoursShare)}" placeholder="Part heures CDD"><input id="${key}_ettHoursShare" value="${esc(m.ettHoursShare)}" placeholder="Part heures ETT"><input id="${key}_bicReference" value="${esc(m.bicReference)}" placeholder="Référence BIC"><input id="${key}_supplyAverage" value="${esc(m.supplyAverage)}" placeholder="Moyenne Supply"></div>` : ""}<textarea id="${key}_comment" placeholder="Commentaire">${esc(m.comment)}</textarea><textarea id="${key}_causes" placeholder="Causes">${esc(m.causes)}</textarea><textarea id="${key}_actions" placeholder="Actions engagées">${esc(m.actions)}</textarea>`; }).join("")}</div>`;
}

function perfHoursForm(p) {
  return `${perfMetricForm("Heures totales", "hours_total", p.hours.total, ["comment", "causes"])}${perfMetricForm("Heures directes", "hours_direct", p.hours.direct)}${perfMetricForm("Heures indirectes", "hours_indirect", p.hours.indirect)}<div class="card"><h2>Heures majorées</h2><div class="form-grid"><input id="hours_overtime" value="${esc(p.hours.overtime)}" placeholder="Heures supplémentaires"><input id="hours_night" value="${esc(p.hours.night)}" placeholder="Heures de nuit"><input id="hours_sundays" value="${esc(p.hours.sundays)}" placeholder="Dimanches travaillés"><input id="hours_holidays" value="${esc(p.hours.holidays)}" placeholder="Jours fériés travaillés"></div><textarea id="hours_analysis" placeholder="Analyse des heures">${esc(p.hours.analysis)}</textarea><textarea id="hours_causes" placeholder="Principales causes">${esc(p.hours.causes)}</textarea><textarea id="hours_levers" placeholder="Leviers de réduction">${esc(p.hours.levers)}</textarea></div>`;
}

function perfAbsForm(p) {
  return `${perfMetricForm("Absentéisme total", "abs_total", p.absenteeism.total, ["comment", "causes"])}<div class="card"><h2>Détail absentéisme</h2>${perfAbsences.map(k => { const m = p.absenteeism.details[k], key = `abs_${perfKey(k)}`; return `<h3>${esc(k)}</h3><div class="form-grid"><input id="${key}_historical" type="number" value="${esc(m.historical)}" placeholder="Historique"><input id="${key}_budget" type="number" value="${esc(m.budget)}" placeholder="Budget"><input id="${key}_actual" type="number" value="${esc(m.actual)}" placeholder="Réalisé"><input id="${key}_hours" type="number" value="${esc(m.hours)}" placeholder="Nombre d'heures"></div>`; }).join("")}<textarea id="abs_impacts" placeholder="Impacts opérationnels">${esc(p.absenteeism.impacts)}</textarea><textarea id="abs_hrActions" placeholder="Actions RH">${esc(p.absenteeism.hrActions)}</textarea><textarea id="abs_projection" placeholder="Projection">${esc(p.absenteeism.projection)}</textarea></div>`;
}

function perfQualityForm(p) {
  return `<div class="card"><h2>Qualité et Gains & Pertes</h2>${perfQuality.map(k => perfMetricForm(k, `qual_${perfKey(k)}`, p.quality.indicators[k], ["comment"])).join("")}<textarea id="qual_highlights" placeholder="Faits marquants">${esc(p.quality.highlights)}</textarea><textarea id="qual_causes" placeholder="Causes">${esc(p.quality.causes)}</textarea><textarea id="qual_correctiveActions" placeholder="Actions correctives">${esc(p.quality.correctiveActions)}</textarea></div>`;
}

function perfPalletForm(p) {
  return `<div class="card"><h2>Hauteur palette</h2><div class="form-grid"><input id="pal_historical" type="number" value="${esc(p.palletHeight.historical)}" placeholder="Historique"><input id="pal_objective" type="number" value="${esc(p.palletHeight.objective)}" placeholder="Objectif"><input id="pal_budget" type="number" value="${esc(p.palletHeight.budget)}" placeholder="Budget"><input id="pal_actual" type="number" value="${esc(p.palletHeight.actual)}" placeholder="Réalisé"><input id="pal_trend" value="${esc(p.palletHeight.trend)}" placeholder="Tendance"></div><textarea id="pal_comment" placeholder="Commentaire">${esc(p.palletHeight.comment)}</textarea><textarea id="pal_causes" placeholder="Causes">${esc(p.palletHeight.causes)}</textarea><textarea id="pal_actions" placeholder="Actions">${esc(p.palletHeight.actions)}</textarea></div>`;
}

function readMetric(path) {
  const g = id => document.getElementById(`${path}_${id}`)?.value.trim() || "";
  return { historical: g("historical"), budget: g("budget"), actual: g("actual"), comment: g("comment"), causes: g("causes"), actions: g("actions"), highlights: g("highlights"), projection: g("projection") };
}

function savePerformance(id) {
  const i = indexById("performance", id);
  if (i < 0) return;
  const p = state.performance[i];
  p.year = Number(document.getElementById("pfYear").value);
  p.month = Number(document.getElementById("pfMonth").value);
  p.status = document.getElementById("pfStatus").value;
  p.activity = { ...p.activity, ...readMetric("activity") };
  p.ipo.total = { ...p.ipo.total, ...readMetric("ipo_total") };
  p.ipo.variable = { ...p.ipo.variable, ...readMetric("ipo_variable") };
  ["mixEffect", "directProductivityGap", "businessMixEffect", "indirectHoursGap", "indirectHoursCrush", "ipoPointCost", "analysis", "rootCauses", "trend", "projection"].forEach(k => p.ipo[k] = document.getElementById(`ipo_${k}`)?.value.trim() || "");
  perfJobs.forEach(job => { const key = `prod_${perfKey(job)}`, m = p.productivity[job]; Object.assign(m, readMetric(key)); ["hoursBudgetGap", "hoursHistoricalGap", "cdiProductivity", "cddProductivity", "ettProductivity", "totalProductivity", "cdiHoursShare", "cddHoursShare", "ettHoursShare", "bicReference", "supplyAverage"].forEach(k => m[k] = document.getElementById(`${key}_${k}`)?.value.trim() || m[k] || ""); m.status = perfStatus(m); });
  p.hours.total = { ...p.hours.total, ...readMetric("hours_total") };
  p.hours.direct = { ...p.hours.direct, ...readMetric("hours_direct") };
  p.hours.indirect = { ...p.hours.indirect, ...readMetric("hours_indirect") };
  ["overtime", "night", "sundays", "holidays", "analysis", "causes", "levers"].forEach(k => p.hours[k] = document.getElementById(`hours_${k}`)?.value.trim() || "");
  p.absenteeism.total = { ...p.absenteeism.total, ...readMetric("abs_total") };
  perfAbsences.forEach(k => { const key = `abs_${perfKey(k)}`; p.absenteeism.details[k] = { ...p.absenteeism.details[k], ...readMetric(key), hours: document.getElementById(`${key}_hours`)?.value.trim() || "" }; });
  ["impacts", "hrActions", "projection"].forEach(k => p.absenteeism[k] = document.getElementById(`abs_${k}`)?.value.trim() || "");
  perfQuality.forEach(k => p.quality.indicators[k] = { ...p.quality.indicators[k], ...readMetric(`qual_${perfKey(k)}`) });
  ["highlights", "causes", "correctiveActions"].forEach(k => p.quality[k] = document.getElementById(`qual_${k}`)?.value.trim() || "");
  p.palletHeight = { historical: document.getElementById("pal_historical").value, objective: document.getElementById("pal_objective").value, budget: document.getElementById("pal_budget").value, actual: document.getElementById("pal_actual").value, trend: document.getElementById("pal_trend").value, comment: document.getElementById("pal_comment").value, causes: document.getElementById("pal_causes").value, actions: document.getElementById("pal_actions").value };
  p.synthesis = document.getElementById("pfSynthesis").value;
  p.linkedManagers = checkedValues("pfManagers"); p.linkedProjects = checkedValues("pfProjects"); p.linkedFolders = checkedValues("pfFolders");
  p.updatedAt = isoToday();
  state.performance[i] = normalizePerformance(p);
  persist("performance");
  addActivity("Performance", perfPeriodLabel(p), "Mise à jour", p.id);
  performanceEdit = false;
  renderPerformance();
}

function buildPerformanceSynthesis(p) {
  const metrics = [
    ["Activité", p.activity], ["IPO total", p.ipo.total], ["IPO variable", p.ipo.variable], ["Heures totales", p.hours.total], ["Absentéisme", p.absenteeism.total], ["Hauteur palette", { historical: p.palletHeight.historical, budget: p.palletHeight.objective, actual: p.palletHeight.actual }]
  ];
  const gaps = metrics.map(([label, m]) => ({ label, pct: perfGap(m.actual, m.budget).pct, comment: m.comment || m.causes || "" })).filter(x => x.pct !== "");
  const positives = gaps.filter(x => x.pct >= 0).slice(0, 3).map(x => `- ${x.label} : ${perfFmt(x.pct, "%")}`).join("\n") || "À compléter";
  const vigilance = gaps.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3).map(x => `- ${x.label} : ${perfFmt(x.pct, "%")} ${x.comment}`).join("\n") || "À compléter";
  return `Points positifs\n${positives}\n\nPoints de vigilance\n${vigilance}\n\nIndicateurs éloignés du budget\n${vigilance}\n\nActions prioritaires\n${reportActions(state.actions.filter(a => (a.linkedPerformance || []).includes(p.id)))}\n\nDécisions attendues\n${reportDecisions(state.decisions.filter(d => (d.linkedPerformance || []).includes(p.id)))}`;
}

function perfCharts() {
  const series = [["Activité", "activity"], ["IPO Total", "ipo.total"], ["IPO Variable", "ipo.variable"], ["Productivité Préparation", "productivity.Préparation"], ["Heures totales", "hours.total"], ["Heures indirectes", "hours.indirect"], ["Absentéisme", "absenteeism.total"], ["Gains & Pertes", "quality.indicators.Total Gains & Pertes"], ["Hauteur palette", "palletHeight"]];
  return `<div class="perf-charts">${series.map(([label, path]) => perfChart(label, path)).join("")}</div>`;
}

function perfPath(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function perfChart(label, path) {
  const rows = state.performance.slice().sort((a, b) => a.year - b.year || a.month - b.month).map(p => ({ p, m: perfPath(p, path) })).filter(x => x.m && (perfHas(x.m.historical) || perfHas(x.m.budget) || perfHas(x.m.actual)));
  if (rows.length < 1) return `<div class="perf-chart"><strong>${esc(label)}</strong><div class="empty">Données insuffisantes</div></div>`;
  const max = Math.max(1, ...rows.flatMap(x => [perfNum(x.m.historical), perfNum(x.m.budget), perfNum(x.m.actual)]));
  return `<div class="perf-chart"><strong>${esc(label)}</strong>${rows.map(x => `<div class="perf-bars"><span>${esc(perfMonths[x.p.month - 1].slice(0, 3))}</span><i style="height:${perfNum(x.m.historical) / max * 70}px"></i><i class="budget" style="height:${perfNum(x.m.budget) / max * 70}px"></i><i class="actual" style="height:${perfNum(x.m.actual) / max * 70}px"></i></div>`).join("")}<small>Historique ? Budget ? Réalisé</small></div>`;
}

function performanceIndicatorAction(id, label) {
  const p = byId("performance", id);
  const title = `Performance ${perfPeriodLabel(p)} - ${label}`;
  if (state.actions.some(a => a.title === title)) return;
  state.actions.unshift({ id: newId("action"), title, link: label, owner: "", level: "orange", due: "", done: false, linkedFolders: p.linkedFolders, linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedPerformance: [id] });
  persist("actions");
  addActivity("Action", title, "Créée depuis Performance", id);
  renderPerformance();
}

function performanceIndicatorDecision(id, label) {
  const p = byId("performance", id);
  const title = `Décision Performance ${perfPeriodLabel(p)} - ${label}`;
  if (state.decisions.some(d => d.title === title)) return;
  state.decisions.unshift({ id: newId("decision"), title, date: isoToday(), status: "review", importance: "orange", context: `Analyse Performance ${perfPeriodLabel(p)}`, problem: label, decision: "", rationale: "", alternatives: "", impacts: "", risks: "", owner: "", linkedManagers: p.linkedManagers, linkedProjects: p.linkedProjects, linkedActions: [], linkedDocuments: [], linkedFolders: p.linkedFolders, linkedPerformance: [id], reviewDate: "", events: [], directorNotes: [], nextStep: "", tags: ["Performance"] });
  persist("decisions");
  addActivity("Décision", title, "Créée depuis Performance", id);
  renderPerformance();
}

function startPerformanceRdp(id) {
  const p = byId("performance", id);
  if (!p) return;
  startReport("performance", id, "Revue de performance");
}

const performanceImportSources = [
  { key: "gpo", label: "GPO PDF", accept: ".pdf" },
  { key: "guide", label: "Guide performance PDF", accept: ".pdf" },
  { key: "zgemed", label: "Z GEMED Excel", accept: ".xls,.xlsx,.xlsb,.csv" },
  { key: "cgtab", label: "CGTAB", accept: ".xls,.xlsx,.csv,.txt" },
  { key: "ga", label: "GA", accept: ".xls,.xlsx,.csv,.pdf" },
  { key: "tbag", label: "T-Bag", accept: ".xls,.xlsx,.csv,.txt" },
  { key: "litiges", label: "Litiges", accept: ".xls,.xlsx,.csv,.pdf" }
];
const IMPORT_PERIOD_PENDING = "Période à confirmer";

function detectGpoPdf(file) {
  return { ...file, source: "GPO PDF", sourceType: "GPO PDF", status: "à confirmer", confidence: "moyenne", period: detectImportPeriod(file.name), message: "analyse réelle disponible après lecture locale PDF.js" };
}
function detectGuidePerformancePdf(file) { return importDetection(file, "Guide performance PDF", "extraction à développer"); }
function detectZGemedExcel(file) {
  const ext = String(file.extension || file.name || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  const binary = ext.endsWith("xlsb") || ext === "xlsb";
  const likely = /z[ _-]?gemed|gemed/.test(name) || binary;
  return {
    ...file,
    source: "Z GEMED",
    sourceType: "Z GEMED Excel",
    status: binary ? "à confirmer" : (likely ? "probablement reconnu" : "à confirmer"),
    confidence: binary || likely ? "moyenne" : "faible",
    period: detectImportPeriod(file.name),
    site: /st[-_ ]?gilles|saint[-_ ]?gilles/.test(name) ? "Saint-Gilles" : "",
    message: binary ? "Fichier Z GEMED binaire détecté. Extraction navigateur disponible après export Excel .xlsx ou CSV." : "analyse réelle disponible après lecture locale"
  };
}
function detectCgtab(file) { return importDetection(file, "CGTAB", "extraction à développer"); }
function detectGa(file) { return importDetection(file, "GA", "extraction à développer"); }
function detectTBag(file) { return importDetection(file, "T-Bag", "extraction à développer"); }
function detectLitiges(file) { return importDetection(file, "Litiges", "extraction à développer"); }

function importDetection(file, source, message) {
  return { ...file, source, status: file.typeDetected === "non reconnu" ? "non reconnu" : "à confirmer", period: detectImportPeriod(file.name), message };
}

function detectImportType(name = "") {
  const n = name.toLowerCase();
  if (n.includes("gpo") && n.endsWith(".pdf")) return "GPO PDF";
  if ((n.includes("guide") || n.includes("performance")) && n.endsWith(".pdf")) return "Guide performance PDF";
  if (n.includes("z") && n.includes("gemed")) return "Z GEMED Excel";
  if (n.includes("cgtab")) return "CGTAB";
  if (/\bga\b|ga[_ -]/i.test(name)) return "GA";
  if (n.includes("t-bag") || n.includes("tbag")) return "T-Bag";
  if (n.includes("litige")) return "Litiges";
  if (n.endsWith(".pdf")) return "PDF non reconnu";
  if (/\.(xls|xlsx|xlsm|xlsb|csv)$/i.test(name)) return "Excel non reconnu";
  return "non reconnu";
}

function detectImportPeriod(name = "") {
  const month = name.match(/(20\d{2})[-_ ]?(0[1-9]|1[0-2])/);
  if (month) return `${month[2]}/${month[1]}`;
  const fr = name.match(/(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)[-_ ]?(20\d{2})/i);
  return fr ? `${fr[1]} ${fr[2]}` : "";
}

function detectPerformanceImportFile(file) {
  const base = { id: newId("file"), name: file.name || "Fichier", size: file.size || 0, extension: (String(file.name || "").split(".").pop() || "").toLowerCase(), typeDetected: detectImportType(file.name || "") };
  if (base.typeDetected === "GPO PDF") return detectGpoPdf(base);
  if (base.typeDetected === "Guide performance PDF") return detectGuidePerformancePdf(base);
  if (base.typeDetected === "Z GEMED Excel") return detectZGemedExcel(base);
  if (base.typeDetected === "CGTAB") return detectCgtab(base);
  if (base.typeDetected === "GA") return detectGa(base);
  if (base.typeDetected === "T-Bag") return detectTBag(base);
  if (base.typeDetected === "Litiges") return detectLitiges(base);
  return importDetection(base, "Source à confirmer", "extraction à développer");
}

function sourceKeyForLabel(label = "") {
  const found = performanceImportSources.find(s => s.label === label);
  return found ? found.key : "manual";
}

function startPerformanceImport() {
  performanceImportWizard = { id: newId("perfimport"), step: 1, files: [], preview: [], comments: "", validatedBy: identityName(), status: "brouillon", selectedPeriods: [], errors: [] };
  renderPerformance();
}

function cancelPerformanceImport() {
  performanceImportWizard = null;
  renderPerformance();
}

function performanceImportSteps() {
  return ["Fichiers", "Sources", "Aperçu", "Validation"].map((label, i) => `<span class="${performanceImportWizard.step === i + 1 ? "active-step" : ""}">${i + 1}. ${label}</span>`).join("");
}

function renderPerformanceImportWizard() {
  appHtml(`<div class="card hero report-hero"><button class="secondary" onclick="cancelPerformanceImport()">Retour Performance</button><h2>Importer mes données</h2><p class="muted">Import local préparé pour GPO PDF, Z GEMED et les autres sources Performance.</p><div class="report-steps">${performanceImportSteps()}</div></div>${performanceImportBody()}`);
}

function performanceImportBody() {
  if (performanceImportWizard.step === 1) return performanceImportStepFiles();
  if (performanceImportWizard.step === 2) return performanceImportStepSources();
  if (performanceImportWizard.step === 3) return performanceImportStepPreview();
  return performanceImportStepValidate();
}

function performanceImportStepFiles() {
  return `<div class="card"><h2>Sélection des fichiers</h2><div class="grid two">${performanceImportSources.map(s => `<div class="item"><strong>${esc(s.label)}</strong><input type="file" accept="${esc(s.accept)}" onchange="addPerformanceImportFiles('${s.key}',this.files)"><span class="muted">${s.key === "zgemed" ? "Analyse réelle CSV/XLSX locale. XLSB reconnu avec message de conversion." : s.key === "gpo" ? "Analyse réelle PDF locale via PDF.js." : "Extraction réelle à développer."}</span></div>`).join("")}</div>${performanceImportFilesList()}<div class="row-actions"><button class="secondary" onclick="cancelPerformanceImport()">Annuler</button><button class="action" onclick="setPerformanceImportStep(2)">Suivant</button></div></div>`;
}

function performanceImportFilesList() {
  return `<div class="card"><h2>Fichiers sélectionnés</h2>${performanceImportWizard.files.map(f => `<div class="item"><strong>${esc(f.name)}</strong><span class="muted">${esc(f.typeDetected)} · ${esc(f.source)} · ${esc(f.period || f.periods?.join(", ") || "Période à confirmer")} · Confiance ${esc(f.confidence || "moyenne")}</span><span class="meta">${esc(f.status)} · ${esc(f.message || "")}</span></div>`).join("") || `<div class="empty">Aucun fichier ajouté.</div>`}${performanceImportWizard.errors.map(e => `<div class="item alert-red"><strong>${esc(e.title)}</strong><span class="muted">${esc(e.detail)}</span></div>`).join("")}</div>`;
}

async function addPerformanceImportFiles(sourceKey, fileList) {
  const source = performanceImportSources.find(s => s.key === sourceKey);
  for (const file of [...fileList]) {
    const detected = await analyzePerformanceImportFile(file, sourceKey);
    detected.source = source?.label || detected.source;
    performanceImportWizard.files.push(detected);
  }
  buildPerformanceImportPreview();
  renderPerformanceImportWizard();
}

function addFakePerformanceImportFile() {
  const source = performanceImportSources.find(s => s.key === document.getElementById("piFakeSource").value);
  const name = document.getElementById("piFakeName").value.trim() || "fichier_test.pdf";
  const detected = detectPerformanceImportFile({ name, size: 0 });
  detected.source = source?.label || detected.source;
  performanceImportWizard.files.push(detected);
  buildPerformanceImportPreview();
  renderPerformanceImportWizard();
}

function setPerformanceImportStep(step) {
  if (step >= 3) buildPerformanceImportPreview();
  performanceImportWizard.step = step;
  renderPerformanceImportWizard();
}

function performanceImportStepSources() {
  return `<div class="card"><h2>Identification de la source</h2>${performanceImportWizard.files.map(file => `<div class="item"><strong>${esc(file.name)}</strong><span class="muted">Type détecté : ${esc(file.typeDetected)} · Source supposée : ${esc(file.source)} · Statut : ${esc(file.status || "à confirmer")} · Confiance ${esc(file.confidence || "moyenne")}</span><span class="meta">Site détecté : ${esc(file.site || "à confirmer")} · Périodes : ${esc(ensureArray(file.periods).join(", ") || file.period || "à confirmer")} · Onglets : ${esc(ensureArray(file.sheets).join(", ") || "non disponible")}</span>${ensureArray(file.periods).length ? `<div class="manager-links">${file.periods.map(p => `<label><input type="checkbox" checked onchange="toggleImportPeriod('${esc(file.id)}','${esc(p)}',this.checked)"> ${esc(p)}</label>`).join("")}</div>` : ""}${file.message ? `<span class="meta">${esc(file.message)}</span>` : ""}</div>`).join("") || `<div class="empty">Aucun fichier à identifier.</div>`}<div class="row-actions"><button class="secondary" onclick="setPerformanceImportStep(1)">Retour</button><button class="secondary" onclick="cancelPerformanceImport()">Annuler</button><button class="action" onclick="setPerformanceImportStep(3)">Créer l'aperçu</button></div></div>`;
}

function buildPerformanceImportPreview() {
  performanceImportWizard.preview = performanceImportWizard.files.flatMap(file => {
    const rawRows = performanceImportRawIndicators(file);
    const rows = normalizePerformanceImportIndicators(rawRows, file);
    file.detectedIndicators = rows;
    const selected = ensureArray(file.selectedPeriods || file.periods).filter(Boolean);
    const filtered = selected.length ? rows.filter(row => !row.period || row.period === IMPORT_PERIOD_PENDING || selected.includes(row.period)) : rows;
    return filtered.map(row => decoratePerformancePreviewRow(row, file));
  });
}

function performanceImportStepPreview() {
  const periodSelector = performanceImportPeriodSelector();
  const rows = performanceImportWizard.preview.map(row => `<tr class="import-${esc(row.tone)}"><td><input type="checkbox" ${row.selected ? "checked" : ""} onchange="toggleImportPreviewRow('${row.id}',this.checked)" ${row.status === "Non mappée" ? "disabled" : ""}></td><td>${esc(row.period || "à confirmer")}</td><td>${esc(row.indicator)}</td><td>${esc(row.value)}</td><td>${esc(row.unit || "")}</td><td>${esc(row.pageSource || row.sourceRef || "")}</td><td>${esc(row.destinationLabel)}</td><td>${esc(row.currentValue || "")}</td><td>${esc(row.confidence)}</td><td>${esc(row.status)}${row.status === "Conflit" || row.status === "Différente" ? `<select onchange="setImportPreviewAction('${row.id}',this.value)"><option value="keep" ${row.action === "keep" ? "selected" : ""}>Conserver DEOS</option><option value="use" ${row.action === "use" ? "selected" : ""}>Utiliser source</option><option value="ignore" ${row.action === "ignore" ? "selected" : ""}>Ignorer</option></select>` : ""}</td></tr>`).join("");
  const emptyDiagnostic = performanceImportEmptyDiagnostic();
  return `<div class="card"><h2>Aperçu avant import</h2><p class="muted">Aucune donnée Performance existante ne sera écrasée silencieusement. En cas de différence, le choix est explicite ligne par ligne.</p>${periodSelector}<table class="perf-table import-preview-table"><thead><tr><th></th><th>Période</th><th>Indicateur source</th><th>Valeur détectée</th><th>Unité</th><th>Page source</th><th>Destination DEOS</th><th>Valeur DEOS</th><th>Confiance</th><th>Statut</th></tr></thead><tbody>${rows || `<tr><td colspan="10">${emptyDiagnostic}</td></tr>`}</tbody></table><div class="row-actions"><button class="secondary" onclick="setPerformanceImportStep(2)">Retour</button><button class="secondary" onclick="cancelPerformanceImport()">Annuler</button><button class="action" onclick="setPerformanceImportStep(4)">Valider l'aperçu</button></div></div>`;
}

function performanceImportRawIndicators(file) {
  return ensureArray(file.detectedIndicators || file.indicators || file.kpis || file.kpi || file.metrics || file.rows);
}

function firstImportValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

function normalizeImportNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  const parsed = parseZGemedNumber(value);
  return parsed !== "" ? parsed : String(value ?? "").trim();
}

function normalizePerformanceImportIndicators(rows, file) {
  return ensureArray(rows).map(raw => {
    const indicator = firstImportValue(raw, ["indicator", "label", "name", "title", "kpi", "sourceIndicator", "indicateur"]);
    const rawValue = firstImportValue(raw, ["value", "currentValue", "actual", "real", "reel", "detectedValue", "valeur"]);
    if (!indicator || rawValue === "") return null;
    const destinationPath = firstImportValue(raw, ["destinationPath", "path", "targetPath", "deosPath"]);
    const destinationLabel = firstImportValue(raw, ["destinationLabel", "destination", "target", "deosIndicator"]) || (destinationPath ? indicator : "KPI complémentaire — non mappé");
    return {
      ...raw,
      id: raw.id || newId("preview"),
      period: normalizeImportPeriod(raw.period || raw.date || file.period || ensureArray(file.periods)[0]) || IMPORT_PERIOD_PENDING,
      indicator: String(indicator).trim(),
      value: normalizeImportNumericValue(rawValue),
      budget: normalizeImportNumericValue(firstImportValue(raw, ["budget", "target", "objective", "objectif"])),
      historical: normalizeImportNumericValue(firstImportValue(raw, ["historical", "histo", "history"])),
      objective: normalizeImportNumericValue(firstImportValue(raw, ["objective", "target", "objectif"])),
      unit: firstImportValue(raw, ["unit", "unite"]) || "",
      source: raw.source || file.source || file.sourceType || "Import",
      sourceType: raw.sourceType || file.sourceType || file.source || "",
      pageSource: raw.pageSource || raw.sourcePage || raw.page || raw.sourceRef || "",
      sourceRef: raw.sourceRef || raw.pageSource || raw.sourcePage || raw.page || "",
      destinationPath,
      destinationLabel,
      destinationField: raw.destinationField || "",
      confidence: raw.confidence || file.confidence || "moyenne",
      selected: raw.selected !== undefined ? Boolean(raw.selected) : Boolean(destinationPath),
      action: raw.action || "use"
    };
  }).filter(row => row && row.indicator && row.value !== null && row.value !== undefined && String(row.value).trim() !== "");
}


function performanceImportPeriodSelector() {
  const needsPeriod = performanceImportWizard.preview.some(row => row.period === IMPORT_PERIOD_PENDING || !row.period);
  if (!needsPeriod) return "";
  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
  const months = ["01 - Janvier", "02 - Février", "03 - Mars", "04 - Avril", "05 - Mai", "06 - Juin", "07 - Juillet", "08 - Août", "09 - Septembre", "10 - Octobre", "11 - Novembre", "12 - Décembre"];
  const selectedMonth = performanceImportWizard.manualMonth || "06";
  const selectedYear = performanceImportWizard.manualYear || String(new Date().getFullYear());
  return `<div class="item alert-orange"><strong>Période à confirmer</strong><span class="muted">Les KPI restent visibles. Sélectionner le mois et l'année avant validation si la période n'a pas été détectée automatiquement.</span><div class="row-actions"><select id="piManualMonth" onchange="setPendingImportPeriod()">${months.map(m => `<option value="${m.slice(0, 2)}" ${m.startsWith(selectedMonth) ? "selected" : ""}>${m}</option>`).join("")}</select><select id="piManualYear" onchange="setPendingImportPeriod()">${years.map(y => `<option value="${y}" ${String(y) === String(selectedYear) ? "selected" : ""}>${y}</option>`).join("")}</select><button class="secondary" onclick="setPendingImportPeriod()">Appliquer la période</button></div></div>`;
}

function performanceImportEmptyDiagnostic() {
  const extracted = performanceImportWizard.files.reduce((sum, file) => sum + performanceImportRawIndicators(file).length, 0);
  const normalized = performanceImportWizard.files.reduce((sum, file) => sum + normalizePerformanceImportIndicators(performanceImportRawIndicators(file), file).length, 0);
  const selected = performanceImportWizard.files.map(file => ensureArray(file.selectedPeriods || file.periods).join(", ") || "aucune").join(" · ");
  return extracted ? `${extracted} KPI extrait(s), ${normalized} KPI normalisé(s), 0 transmis à l'aperçu. Périodes sélectionnées : ${esc(selected)}.` : "Aucun indicateur exploitable détecté.";
}

function setPendingImportPeriod() {
  const month = document.getElementById("piManualMonth")?.value || "06";
  const year = document.getElementById("piManualYear")?.value || String(new Date().getFullYear());
  const period = `${month}/${year}`;
  performanceImportWizard.manualMonth = month;
  performanceImportWizard.manualYear = year;
  performanceImportWizard.files.forEach(file => {
    file.detectedIndicators = ensureArray(file.detectedIndicators).map(row => (!row.period || row.period === IMPORT_PERIOD_PENDING) ? { ...row, period } : row);
    file.period = file.period && file.period !== IMPORT_PERIOD_PENDING ? file.period : period;
    file.periods = ensureArray(file.periods).map(p => p === IMPORT_PERIOD_PENDING ? period : p);
    if (!file.periods.length) file.periods = [period];
    file.selectedPeriods = ensureArray(file.selectedPeriods).map(p => p === IMPORT_PERIOD_PENDING ? period : p);
    if (!file.selectedPeriods.length) file.selectedPeriods = [period];
  });
  buildPerformanceImportPreview();
  renderPerformanceImportWizard();
}

function setImportPreviewAction(id, action) {
  const row = performanceImportWizard.preview.find(x => x.id === id);
  if (row) {
    row.action = action;
    row.selected = action === "use";
    renderPerformanceImportWizard();
  }
}

function performanceImportStepValidate() {
  const selected = performanceImportWizard.preview.filter(x => x.selected && x.destinationPath);
  const conflicts = performanceImportWizard.preview.filter(x => x.status === "Conflit" || x.status === "Différente");
  return `<div class="card"><h2>Validation</h2><p>La validation alimente réellement Performance uniquement avec les lignes cochées. Les lignes en conflit restent conservées côté DEOS sauf choix « Utiliser source ».</p><div class="form-grid"><input id="piValidatedBy" value="${esc(performanceImportWizard.validatedBy || identityName())}" placeholder="Utilisateur ayant validé"><select id="piStatus"><option value="validé">validé</option><option value="brouillon">brouillon</option><option value="rejeté">rejeté</option></select><textarea id="piComments" class="full" placeholder="Commentaires">${esc(performanceImportWizard.comments || "")}</textarea></div><div class="item"><strong>${selected.length} indicateur(s) importable(s)</strong><span class="muted">${conflicts.length} conflit(s) ou différence(s) · ${performanceImportWizard.files.length} fichier(s) source(s)</span></div><div class="row-actions"><button class="secondary" onclick="setPerformanceImportStep(3)">Retour</button><button class="secondary" onclick="cancelPerformanceImport()">Annuler</button><button class="action" onclick="validatePerformanceImport()">Valider l'import</button></div></div>`;
}

function validatePerformanceImport() {
  const first = performanceImportWizard.files[0] || {};
  const selectedRows = performanceImportWizard.preview.filter(row => row.selected && row.destinationPath && row.action !== "keep" && row.action !== "ignore");
  const importDate = new Date().toLocaleString("fr-FR");
  const imported = applyPerformanceImportRows(selectedRows, first, importDate);
  const payload = normalizeEntity("performance_imports", {
    id: performanceImportWizard.id,
    importDate,
    sourceFile: performanceImportWizard.files.map(f => f.name).join(", "),
    sourceType: first.source || first.typeDetected || "Source à confirmer",
    period: [...new Set(performanceImportWizard.preview.map(x => x.period).filter(Boolean))].join(", "),
    site: first.site || "",
    indicators: performanceImportWizard.preview,
    status: document.getElementById("piStatus").value,
    validatedBy: document.getElementById("piValidatedBy").value.trim(),
    comments: document.getElementById("piComments").value.trim(),
    files: performanceImportWizard.files,
    preview: performanceImportWizard.preview,
    conflicts: performanceImportWizard.preview.filter(x => x.status === "Conflit" || x.status === "Différente"),
    importedCount: imported.importedCount,
    ignoredCount: performanceImportWizard.preview.length - imported.importedCount,
    conflictCount: performanceImportWizard.preview.filter(x => x.status === "Conflit" || x.status === "Différente").length,
    periods: imported.periods
  });
  state.performance_imports.unshift(payload);
  persist("performance");
  persist("performance_imports");
  addActivity("Performance", "Import de données", `${payload.status} · ${payload.sourceFile}`, payload.id);
  performanceImportWizard = null;
  renderPerformance();
}

function performanceImportHistory() {
  const rows = state.performance_imports.map(item => `<tr class="clickable" onclick="openPerformanceImportDetail('${esc(item.id)}')"><td>${esc(item.importDate || "")}</td><td>${esc(item.sourceFile || "")}</td><td>${esc(item.sourceType || "")}</td><td>${esc(item.site || "")}</td><td>${esc(item.period || "à confirmer")}</td><td>${ensureArray(item.indicators).length}</td><td>${esc(item.importedCount ?? "")}</td><td>${esc(item.conflictCount ?? ensureArray(item.conflicts).length)}</td><td>${esc(item.status || "brouillon")}</td></tr>`).join("");
  return `<h2>Historique des imports</h2><table class="perf-table"><thead><tr><th>Date</th><th>Fichier</th><th>Source</th><th>Site</th><th>Période</th><th>Détectés</th><th>Importés</th><th>Conflits</th><th>Statut</th></tr></thead><tbody>${rows || `<tr><td colspan="9">Aucun import enregistré.</td></tr>`}</tbody></table>`;
}

function openPerformanceImportDetail(id) {
  const item = byId("performance_imports", id);
  if (!item) return renderPerformance();
  const rows = ensureArray(item.indicators).slice(0, 80).map(row => `<tr><td>${esc(row.period || "")}</td><td>${esc(row.indicator || "")}</td><td>${esc(row.value || "")}</td><td>${esc(row.destinationLabel || row.destination || "KPI complémentaire")}</td><td>${esc(row.confidence || "")}</td><td>${esc(row.status || "")}</td></tr>`).join("");
  appHtml(`<div class="card hero report-hero"><button class="secondary" onclick="renderPerformance()">Retour Performance</button><h2>Détail import Performance</h2><p>${esc(item.sourceType || "")} · ${esc(item.sourceFile || "")} · ${esc(item.importDate || "")}</p><span class="meta">Site ${esc(item.site || "à confirmer")} · Période(s) ${esc(item.period || "")} · Validé par ${esc(item.validatedBy || "")}</span></div><div class="card"><h2>Indicateurs détectés</h2><table class="perf-table"><thead><tr><th>Période</th><th>Indicateur</th><th>Valeur</th><th>Destination</th><th>Confiance</th><th>Statut</th></tr></thead><tbody>${rows || `<tr><td colspan="6">Aucun détail disponible.</td></tr>`}</tbody></table></div>`);
}

async function analyzePerformanceImportFile(file, sourceKey) {
  const detected = detectPerformanceImportFile(file);
  detected.selectedPeriods = ensureArray(detected.periods).length ? ensureArray(detected.periods) : (detected.period ? [detected.period] : []);
  const shouldAnalyzeGpo = sourceKey === "gpo" || (sourceKey === "guide" && (detected.extension || "").toLowerCase() === "pdf");
  if (shouldAnalyzeGpo) {
    try {
      return await analyzeGpoPdfFile(file, detected);
    } catch (error) {
      performanceImportWizard.errors.push({ title: "Analyse GPO PDF impossible", detail: error.message || String(error) });
      return { ...detected, status: "non reconnu", confidence: "faible", message: error.message || "PDF non exploitable" };
    }
  }
  if (sourceKey !== "zgemed") return detected;
  try {
    return await analyzeZGemedFile(file, detected);
  } catch (error) {
    performanceImportWizard.errors.push({ title: "Analyse Z GEMED impossible", detail: error.message || String(error) });
    return { ...detected, status: "non reconnu", confidence: "faible", message: error.message || "fichier non exploitable" };
  }
}

async function analyzeGpoPdfFile(file, detected) {
  if ((detected.extension || "").toLowerCase() !== "pdf") return { ...detected, status: "non reconnu", confidence: "faible", message: "Format non supporté pour GPO PDF." };
  const pages = await readPdfPages(file);
  const allText = pages.map(p => p.text).join("\n");
  const markers = ["Entrepôt SAINT GILLES", "Région SUD EST", "Passage IPO total", "Passage IPO Variable", "Mensu IPO", "Performance mensuelle", "Evolution HEURES", "Absentéisme", "Heures majorées", "Gains & Pertes", "HAUTEUR PALETTE"];
  const hitCount = markers.filter(m => normalizeText(allText).includes(normalizeText(m))).length;
  const detectedPeriod = detectGpoPeriod(allText, file.name);
  const period = detectedPeriod || IMPORT_PERIOD_PENDING;
  const site = /saint\s+gilles|st\s+gilles/i.test(allText) ? "Saint-Gilles" : "";
  const saintGillesStart = pages.findIndex(p => /Entrepôt\s+SAINT\s+GILLES|Entrepot\s+SAINT\s+GILLES/i.test(p.text));
  const scopedPages = saintGillesStart >= 0 ? pages.slice(saintGillesStart) : pages.filter(p => /ST\s+GILLES|SAINT\s+GILLES/i.test(p.text));
  const indicators = extractGpoIndicators(scopedPages.length ? scopedPages : pages, period);
  return {
    ...detected,
    source: "GPO PDF",
    sourceType: "GPO PDF",
    status: hitCount >= 7 ? "reconnu" : hitCount >= 3 ? "probablement reconnu" : "non reconnu",
    confidence: hitCount >= 7 ? "élevée" : hitCount >= 3 ? "moyenne" : "faible",
    site,
    period,
    periods: [period],
    selectedPeriods: [period],
    sheets: pages.map(p => `page ${p.page}`).slice(0, 5),
    detectedIndicators: indicators,
    message: `${indicators.length} KPI GPO extrait(s) depuis ${pages.length} page(s).`
  };
}

async function readPdfPages(file) {
  if (!window.pdfjsLib) {
    const pdfjs = await import("./libs/pdf.min.mjs");
    window.pdfjsLib = pdfjs;
    pdfjs.GlobalWorkerOptions.workerSrc = "./libs/pdf.worker.min.mjs";
  }
  const bytes = await readFileArrayBuffer(file);
  const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str || "").join(" ");
    pages.push({ page: pageNo, text });
  }
  return pages;
}

function detectGpoPeriod(text, fileName = "") {
  const source = `${text}\n${fileName}`;
  const numeric = source.match(/\b(0?[1-9]|1[0-2])\s*[\/.-]\s*(20\d{2})\b/);
  if (numeric) return `${String(Number(numeric[1])).padStart(2, "0")}/${numeric[2]}`;
  const hit = source.match(/\b(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*(20\d{2})\b/i);
  if (!hit) {
    const fromName = detectImportPeriod(fileName);
    return normalizeImportPeriod(fromName);
  }
  const idx = ["janvier", "février", "fevrier", "mars", "avril", "mai", "juin", "juillet", "août", "aout", "septembre", "octobre", "novembre", "décembre", "decembre"].findIndex(m => normalizeText(m) === normalizeText(hit[1]));
  const monthMap = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  const month = monthMap[normalizeText(hit[1])] || (idx + 1);
  return `${String(month).padStart(2, "0")}/${hit[2]}`;
}

function normalizeImportPeriod(period = "") {
  if (!period) return "";
  const numeric = String(period).match(/^(0?[1-9]|1[0-2])\/(20\d{2})$/);
  if (numeric) return `${String(Number(numeric[1])).padStart(2, "0")}/${numeric[2]}`;
  const fr = String(period).match(/(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*(20\d{2})/i);
  if (!fr) return period;
  const monthMap = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  return `${String(monthMap[normalizeText(fr[1])] || 0).padStart(2, "0")}/${fr[2]}`;
}

function extractGpoIndicators(pages, period) {
  const rows = [];
  const pushMetric = (page, indicator, path, label, values, confidence = "moyenne", unit = "") => {
    if (!values || values.actual === "") return;
    rows.push({ id: newId("preview"), period, indicator, value: values.actual, budget: values.budget ?? "", historical: values.historical ?? "", objective: values.objective ?? "", unit, source: "GPO PDF", sourceType: "GPO PDF", pageSource: `page ${page.page}`, sourceRef: `PDF page ${page.page}`, destinationPath: path, destinationLabel: label, confidence, status: "", selected: Boolean(path), action: "use" });
  };
  pages.forEach(page => {
    const text = page.text;
    if (/Passage IPO total/i.test(text)) pushMetric(page, "IPO Total", "ipo.total", "IPO total", extractGpoIpoValues(text), "élevée");
    if (/Passage IPO Variable/i.test(text)) pushMetric(page, "IPO Variable", "ipo.variable", "IPO variable", extractGpoIpoValues(text), "élevée");
    if (/Performance mensuelle/i.test(text)) {
      pushMetric(page, "Productivité Préparation", "productivity.Préparation", "Productivité Préparation", extractGpoTripleAround(text, "PRÉPARATION|PREPARATION", { preferDecimal: true }), "moyenne");
      pushMetric(page, "Productivité Réception", "productivity.Réception", "Productivité Réception", extractGpoTripleAround(text, "RÉCEPTION|RECEPTION", { preferDecimal: true }), "moyenne");
      pushMetric(page, "Productivité Manutention", "productivity.Manutention", "Productivité Manutention", extractGpoTripleAround(text, "MANUTENTION", { preferDecimal: true }), "moyenne");
      pushMetric(page, "Productivité Chargement", "productivity.Chargement", "Productivité Chargement", extractGpoTripleAround(text, "CHARGEMENT", { preferDecimal: true }), "moyenne");
    }
    if (/Evolution HEURES/i.test(text)) {
      const hoursValues = extractGpoHoursValues(text);
      pushMetric(page, "Heures totales", "hours.total", "Heures totales", hoursValues.total, "moyenne", "h");
      pushMetric(page, "Heures indirectes totales", "hours.indirect", "Heures indirectes", hoursValues.indirect, "moyenne", "h");
      const pct = extractGpoIndirectPercent(text);
      if (pct !== "") rows.push({ id: newId("preview"), period, indicator: "% heures indirectes totales", value: pct, unit: "%", source: "GPO PDF", sourceType: "GPO PDF", pageSource: `page ${page.page}`, sourceRef: `PDF page ${page.page}`, destinationPath: "hours.indirect", destinationLabel: "Heures indirectes", destinationField: "totalShare", confidence: "faible", selected: true, action: "use" });
    }
    if (/TAUX\s+D.?ABSENCE|Absentéisme|Absenteisme/i.test(text)) pushMetric(page, "Absentéisme total", "absenteeism.total", "Absentéisme total", extractGpoAbsTotal(text), "moyenne", "%");
    if (/Heures majorées|Heures majorees/i.test(text)) {
      const major = extractGpoMajorHours(text);
      ["night", "overtime", "sundays"].forEach(key => {
        if (major[key] !== "") rows.push({ id: newId("preview"), period, indicator: ({ night: "Heures de nuit cumul", overtime: "Heures supplémentaires cumul", sundays: "Dimanches / fériés cumul" })[key], value: major[key], unit: "h", source: "GPO PDF", sourceType: "GPO PDF", pageSource: `page ${page.page}`, sourceRef: `PDF page ${page.page}`, destinationPath: "hours", destinationLabel: ({ night: "Heures de nuit", overtime: "Heures supplémentaires", sundays: "Dimanches / fériés" })[key], destinationField: key, confidence: "moyenne", selected: true, action: "use" });
      });
    }
    if (/Gains\s*&\s*Pertes|G&P/i.test(text)) pushMetric(page, "Total Gains & Pertes", "quality.indicators.Total Gains & Pertes", "Total Gains & Pertes", extractGpoGpValues(text), "moyenne", "k€");
    if (/HAUTEUR PALETTE|Hauteur Palette/i.test(text)) pushMetric(page, "Hauteur Palette", "palletHeight", "Hauteur palette", extractGpoPalletValues(text), "faible");
  });
  return dedupeImportRows(rows);
}

function gpoNumbers(text) {
  const tokens = [...String(text || "").matchAll(/[+-]?\s?\d+(?:[,.]\d+)?/g)].map(m => m[0]);
  const values = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const next = tokens[i + 1] || "";
    const currentDigits = current.replace(/[^\d]/g, "");
    const nextDigits = next.replace(/[^\d]/g, "");
    const isDecimal = /[,.]\d+/.test(current);
    if (!isDecimal && currentDigits.length <= 3 && nextDigits.length === 3 && !/[,.]\d+/.test(next)) {
      values.push(parseZGemedNumber(`${current}${nextDigits}`));
      i += 1;
    } else {
      values.push(parseZGemedNumber(current));
    }
  }
  return values;
}

function extractGpoIpoValues(text) {
  const h = matchNumberAfter(text, /IPO\s*HISTO/i);
  const b = matchNumberBefore(text, /IPO\s*BUDGET/i);
  const r = matchNumberAfter(text, /IPO\s*R[ÉE]ALIS[ÉE]/i);
  return { historical: h, budget: b, actual: r };
}

function extractGpoTripleNear(text, labelPattern) {
  const re = new RegExp(`(${labelPattern})([\\s\\S]{0,160})`, "i");
  const after = (text.match(re) || [])[2] || "";
  const nums = gpoNumbers(after).filter(v => v !== "");
  return { historical: nums[0] ?? "", budget: nums[1] ?? "", actual: nums[2] ?? "" };
}

function extractGpoTripleAround(text, labelPattern, options = {}) {
  const re = new RegExp(labelPattern, "i");
  const source = String(text);
  const matches = [...source.matchAll(new RegExp(labelPattern, "ig"))];
  const candidates = matches.length ? matches : [];
  const match = candidates.find(item => {
    if (!options.preferDecimal) return true;
    const beforeNums = gpoNumbers(source.slice(Math.max(0, item.index - 90), item.index)).filter(v => v !== "");
    const nums = beforeNums.slice(-3);
    return nums.length >= 3 && nums.every(v => Math.abs(Number(v)) < 1000) && nums.filter(v => !Number.isInteger(Number(v))).length >= 2;
  }) || candidates[0];
  if (!match) return { historical: "", budget: "", actual: "" };
  const before = source.slice(Math.max(0, match.index - 90), match.index);
  const after = source.slice(match.index + match[0].length, match.index + match[0].length + 90);
  const beforeNums = gpoNumbers(before).filter(v => v !== "");
  if (beforeNums.length >= 3) {
    const nums = beforeNums.slice(-3);
    return { historical: nums[0], budget: nums[1], actual: nums[2] };
  }
  const afterNums = gpoNumbers(after).filter(v => v !== "");
  return { historical: afterNums[0] ?? "", budget: afterNums[1] ?? "", actual: afterNums[2] ?? "" };
}

function extractGpoHoursValues(text) {
  const idx = String(text).search(/HEURES\s+TOTALES/i);
  if (idx < 0) return { total: { historical: "", budget: "", actual: "" }, indirect: { historical: "", budget: "", actual: "" } };
  const segment = String(text).slice(Math.max(0, idx - 240), idx);
  const nums = [...segment.matchAll(/[+-]?\s?\d{1,3}\s\d{3}/g)].map(match => parseZGemedNumber(match[0])).filter(v => v !== "").slice(-9);
  const groups = nums.length >= 9 ? [nums.slice(0, 3), nums.slice(3, 6), nums.slice(6, 9)] : [];
  const toValues = values => ({ historical: values?.[0] ?? "", budget: values?.[1] ?? "", actual: values?.[2] ?? "" });
  return { total: toValues(groups[0]), indirect: toValues(groups[1]) };
}

function extractGpoTripleAfter(text, labelPattern) {
  const re = new RegExp(`${labelPattern}([\\s\\S]{0,260})HISTO\\s+BUD\\s+REEL([\\s\\S]{0,160})`, "i");
  const target = (text.match(re) || [])[2] || (text.match(new RegExp(`${labelPattern}([\\s\\S]{0,260})`, "i")) || [])[1] || "";
  const nums = gpoNumbers(target).filter(v => v !== "");
  return { historical: nums[0] ?? "", budget: nums[1] ?? "", actual: nums[2] ?? "" };
}

function extractGpoAbsTotal(text) {
  const segment = (text.match(/TAUX\s+D.?ABSENCE([\s\S]{0,220})HISTO\s+BUDGET\s+REEL/i) || [])[1] || text;
  const nums = gpoNumbers(segment).filter(v => v !== "");
  return { historical: nums[0] ?? "", budget: nums[1] ?? "", actual: nums[2] ?? "" };
}

function extractGpoGpValues(text) {
  const h = matchNumberAfter(text, /G&P\s*H/i);
  const b = matchNumberAfter(text, /G&P\s*B/i);
  const r = matchNumberAfter(text, /G&P\s*R/i);
  return { historical: h, budget: b, actual: r };
}

function extractGpoPalletValues(text) {
  const objective = matchNumberAfter(text, /Objectif annuel/i);
  const idx = text.search(/HISTO\s+BUD\s+REEL/i);
  const segment = idx >= 0 ? text.slice(Math.max(0, idx - 160), idx) : text;
  const nums = gpoNumbers(segment).filter(v => v !== "").slice(-3);
  return { historical: nums[0] ?? "", budget: nums[1] ?? "", actual: nums[2] ?? "", objective };
}

function extractGpoIndirectPercent(text) {
  const segment = (text.match(/% HEURES\s+INDIRECTES\s+TOTALES([\s\S]{0,220})Cumul/i) || [])[1] || "";
  const nums = gpoNumbers(segment).filter(v => v !== "");
  return nums.length ? nums[nums.length - 1] : "";
}

function extractGpoMajorHours(text) {
  const blocks = [...String(text).matchAll(/Cumul\s+à\s+date\s+([+-]?\s?\d+(?:\s\d{3})?)\s+([+-]?\s?\d+(?:\s\d{3})?)/gi)];
  const actual = index => blocks[index] ? parseZGemedNumber(blocks[index][2]) : "";
  return { night: actual(0), overtime: actual(1), sundays: actual(2) };
}

function matchNumberAfter(text, regex) {
  const idx = String(text).search(regex);
  if (idx < 0) return "";
  const nums = gpoNumbers(String(text).slice(idx, idx + 120)).filter(v => v !== "");
  return nums[0] ?? "";
}

function matchNumberBefore(text, regex) {
  const match = regex.exec(String(text));
  if (!match) return "";
  const nums = gpoNumbers(String(text).slice(Math.max(0, match.index - 70), match.index)).filter(v => v !== "");
  return nums[nums.length - 1] ?? "";
}

function matchNumberAround(text, regex) {
  const match = regex.exec(String(text));
  if (!match) return "";
  const before = gpoNumbers(String(text).slice(Math.max(0, match.index - 50), match.index)).filter(v => v !== "");
  if (before.length) return before[before.length - 1];
  const after = gpoNumbers(String(text).slice(match.index, match.index + 120)).filter(v => v !== "");
  return after[0] ?? "";
}

function dedupeImportRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.period}|${row.destinationPath}|${row.destinationField || "actual"}|${row.indicator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function analyzeZGemedFile(file, detected) {
  const ext = (detected.extension || "").toLowerCase();
  if (ext === "xlsb" || String(file.name || "").toLowerCase().endsWith(".xlsb")) {
    return { ...detected, typeDetected: "Z GEMED Excel binaire", status: "probablement reconnu", confidence: "moyenne", source: "Z GEMED", message: "Format .xlsb reconnu, mais extraction navigateur sans backend non disponible. Exporter le fichier en .xlsx ou CSV depuis Excel pour importer les valeurs." };
  }
  if (ext === "csv") return analyzeZGemedRows(parseCsvText(await readFileText(file)), detected, "CSV");
  if (ext === "xlsx" || ext === "xlsm") return analyzeZGemedRows(await readXlsxRows(file), detected, "Excel");
  return { ...detected, status: "non reconnu", confidence: "faible", message: "Format non supporté pour l'extraction locale. Utiliser .xlsx ou .csv." };
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("fichier corrompu ou illisible"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file, "windows-1252");
  });
}

function readFileArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("fichier Excel corrompu ou illisible"));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

function parseCsvText(text) {
  const delimiter = text.includes(";") ? ";" : ",";
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const out = [];
    let cur = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i], next = line[i + 1];
      if (ch === '"' && quoted && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === delimiter && !quoted) { out.push(cur); cur = ""; continue; }
      out.push ? null : null;
      cur += ch;
    }
    out.push(cur);
    return out;
  });
}

async function readXlsxRows(file) {
  if (!window.JSZip) throw new Error("bibliothèque Excel indisponible");
  const zip = await JSZip.loadAsync(await readFileArrayBuffer(file));
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  if (!workbookXml) throw new Error("format Excel non reconnu");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  const shared = await readXlsxSharedStrings(zip);
  const sheets = readXlsxSheets(workbookXml, relsXml || "");
  const parsedSheets = [];
  for (const sheet of sheets) {
    const path = `xl/${sheet.target.replace(/^\/?xl\//, "")}`;
    const xml = await zip.file(path)?.async("text");
    if (!xml) continue;
    parsedSheets.push({ name: sheet.name, rows: parseXlsxSheetRows(xml, shared) });
  }
  const main = parsedSheets.find(s => /z|gemed|st|gilles|restit|med/i.test(s.name) || zgemedRowsScore(s.rows) >= 4) || parsedSheets[0] || { name: "Feuille 1", rows: [] };
  const analyzed = main.rows;
  analyzed.sheets = parsedSheets.map(s => s.name);
  return analyzed;
}

function readXlsxSheets(workbookXml, relsXml) {
  const rels = {};
  [...relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)].forEach(m => rels[m[1]] = m[2]);
  return [...workbookXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g)].map(m => ({ name: xmlDecode(m[1]), target: rels[m[2]] || "" }));
}

async function readXlsxSharedStrings(zip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  return [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map(m => xmlDecode([...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
}

function parseXlsxSheetRows(xml, shared) {
  const rows = [];
  [...xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].forEach(rowMatch => {
    const row = [];
    [...rowMatch[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].forEach(cell => {
      const attrs = cell[1], body = cell[2], ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1] || "";
      const col = xlsxColIndex(ref);
      const type = (attrs.match(/t="([^"]+)"/) || [])[1] || "";
      const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || body.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || "";
      row[col] = type === "s" ? (shared[Number(raw)] || "") : xmlDecode(raw);
    });
    rows.push(row.map(v => v ?? ""));
  });
  return rows;
}

function xlsxColIndex(col) {
  return col.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

function xmlDecode(text) {
  const div = document.createElement("textarea");
  div.innerHTML = String(text || "");
  return div.value;
}

function zgemedRowsScore(rows) {
  const text = rows.slice(0, 30).flat().join(" ").toLowerCase();
  return ["mois", "site", "reel", "budget", "histo", "numero", "hybride"].filter(x => text.includes(x)).length;
}

function analyzeZGemedRows(rows, detected, sourceFormat) {
  const sheets = rows.sheets || [sourceFormat];
  const site = detectZGemedSite(rows) || detected.site || "";
  const periods = detectZGemedPeriods(rows, detected.name);
  const headerIndex = rows.findIndex(r => normalizeText(r.join(" ")).includes("numero") && normalizeText(r.join(" ")).includes("reel") && normalizeText(r.join(" ")).includes("budget"));
  if (headerIndex < 0) return { ...detected, status: "non reconnu", confidence: "faible", source: "Z GEMED", sheets, site, periods, selectedPeriods: periods, detectedIndicators: [], message: "Aucun en-tête Z GEMED exploitable détecté." };
  const detectedIndicators = extractZGemedIndicators(rows, headerIndex, periods[0] || detected.period || "", sourceFormat);
  const score = zgemedRowsScore(rows);
  return { ...detected, typeDetected: "Z GEMED Excel", source: "Z GEMED", status: score >= 5 ? "reconnu" : "probablement reconnu", confidence: score >= 5 ? "élevée" : "moyenne", site, periods, selectedPeriods: periods, sheets, detectedIndicators, message: `${detectedIndicators.length} indicateur(s) extrait(s) réellement depuis ${sourceFormat}.` };
}

function normalizeText(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[?‚Š…]/g, " ").toLowerCase();
}

function cleanDisplayLabel(value) {
  return String(value ?? "")
    .replace(/\s*\?\s*/g, " — ")
    .replace(/\s*[·-]\s*(mana|mgr|proj|dec|act|pri|meet|jour|doc|fol|folder|agenda|agen|event|note|mile|link|file|preview|perf|perfimport|activity)-[a-z0-9_-]+/gi, "")
    .replace(/\s*(mana|mgr|proj|dec|act|pri|meet|jour|doc|fol|folder|agenda|agen|event|note|mile|link|file|preview|perf|perfimport|activity)-[a-z0-9_-]+/gi, "")
    .replace(/\s+—\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function managerDisplayLabel(manager) {
  return cleanDisplayLabel([manager.name, manager.role].filter(Boolean).join(" — "));
}

function detectZGemedSite(rows) {
  for (const row of rows.slice(0, 20)) {
    if (normalizeText(row[0]) === "site" && row[1]) return /gilles/i.test(row[1]) ? "Saint-Gilles" : String(row[1]).trim();
    if (normalizeText(row.join(" ")).includes("saint gilles") || normalizeText(row.join(" ")).includes("st gilles")) return "Saint-Gilles";
  }
  return "";
}

function detectZGemedPeriods(rows, fileName = "") {
  const periods = new Set();
  rows.slice(0, 30).forEach(row => row.forEach(cell => {
    const mm = String(cell || "").match(/MM[-_ ]?(\d{1,2})/i);
    if (mm) periods.add(zgemedPeriodLabel(Number(mm[1]), detectImportYear(fileName)));
  }));
  const fromName = detectImportPeriod(fileName);
  if (fromName) periods.add(fromName);
  return [...periods].filter(Boolean);
}

function detectImportYear(name = "") {
  const y = String(name).match(/20\d{2}/);
  return y ? Number(y[0]) : new Date().getFullYear();
}

function zgemedPeriodLabel(month, year) {
  return month >= 1 && month <= 12 ? `${String(month).padStart(2, "0")}/${year || new Date().getFullYear()}` : "";
}

function extractZGemedIndicators(rows, headerIndex, period, sourceFormat) {
  const out = [];
  let inCumul = false;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const code = String(row[0] || "").trim();
    const label = String(row[1] || "").trim();
    if (normalizeText(code) === "mois" || normalizeText(label) === "cumul") inCumul = true;
    if (!/^\d+$/.test(code) || !label || inCumul) continue;
    const actual = parseZGemedNumber(row[2]);
    const budget = parseZGemedNumber(row[3]);
    const historical = parseZGemedNumber(row[4]);
    if (actual === "" && budget === "" && historical === "") continue;
    const mapping = mapZGemedIndicator(label);
    out.push({ id: newId("preview"), period, indicator: label, code, value: actual, budget, historical, unit: zgemedUnit(label), source: "Z GEMED", sourceRef: `${sourceFormat} ligne ${i + 1}`, destinationPath: mapping.path, destinationLabel: mapping.label, confidence: mapping.confidence, status: "", selected: Boolean(mapping.path), action: "use" });
  }
  return out;
}

function parseZGemedNumber(value) {
  const clean = String(value ?? "").replace(/[?\u00a0 ]/g, "").replace(",", ".").replace(/[^0-9.+-]/g, "");
  if (!clean || clean === "-" || clean === "+") return "";
  const n = Number(clean);
  return Number.isFinite(n) ? n : "";
}

function zgemedUnit(label) {
  return /cout|ebit|resultat|redevance|demarque|roulage|transport|direction|informatique|immobilier|finance|ressources/i.test(label) ? "k€" : "u.";
}

function mapZGemedIndicator(label) {
  const n = normalizeText(label);
  const map = [
    [/colis totaux prepares/, "activity", "Activité colis", "élevée"],
    [/preparation$/, "productivity.Préparation", "Productivité Préparation", "moyenne"],
    [/reception$/, "productivity.Réception", "Productivité Réception", "moyenne"],
    [/manutention$/, "productivity.Manutention", "Productivité Manutention", "moyenne"],
    [/chargement$/, "productivity.Chargement", "Productivité Chargement", "moyenne"],
    [/eut transportes transit/, "productivity.Transit", "Productivité Transit", "moyenne"],
    [/couts exploitation.*logistique.*transport/, "ipo.total", "IPO total", "moyenne"],
    [/couts variables exploitation/, "ipo.variable", "IPO variable", "moyenne"],
    [/couts demarque/, "quality.indicators.Total Gains & Pertes", "Total Gains & Pertes", "moyenne"],
    [/demarque marchandises/, "quality.indicators.Périmés entrepôt", "Périmés entrepôt", "faible"],
    [/litiges/, "quality.indicators.Litiges", "Litiges", "moyenne"]
  ];
  const hit = map.find(([regex]) => regex.test(n));
  return hit ? { path: hit[1], label: hit[2], confidence: hit[3] } : { path: "", label: "KPI complémentaire — non mappé", confidence: "faible" };
}

function decoratePerformancePreviewRow(row) {
  const field = row.destinationField || "actual";
  const current = row.destinationPath ? getPerformanceCurrentValue(row.period, row.destinationPath, field) : "";
  const hasCurrent = current !== "";
  const same = hasCurrent && Number(current) === Number(row.value);
  const status = !row.destinationPath ? "Non mappée" : !hasCurrent ? "Nouvelle donnée" : same ? "Identique" : (row.confidence === "faible" ? "Conflit" : "Différente");
  const tone = status === "Non mappée" ? "gray" : status === "Conflit" ? "red" : status === "Différente" || row.confidence === "moyenne" ? "orange" : "green";
  return { ...row, currentValue: current, status, tone, selected: row.destinationPath && (!hasCurrent || same), action: hasCurrent && !same ? "keep" : row.action || "use" };
}

function getPerformanceByPeriod(period) {
  const [month, year] = String(period || "").split("/").map(Number);
  return state.performance.find(p => Number(p.month) === month && Number(p.year) === year);
}

function getPerformanceCurrentValue(period, path, key = "actual") {
  const perf = getPerformanceByPeriod(period);
  const target = perf ? perfPath(perf, path) : null;
  return target && target[key] !== undefined ? target[key] : "";
}

function toggleImportPeriod(fileId, period, checked) {
  const file = performanceImportWizard.files.find(f => f.id === fileId);
  if (!file) return;
  const set = new Set(ensureArray(file.selectedPeriods));
  checked ? set.add(period) : set.delete(period);
  file.selectedPeriods = [...set];
  buildPerformanceImportPreview();
}

function toggleImportPreviewRow(id, checked) {
  const row = performanceImportWizard.preview.find(x => x.id === id);
  if (row) row.selected = checked;
}

function applyPerformanceImportRows(rows, file, importDate) {
  const periods = new Set();
  let importedCount = 0;
  rows.forEach(row => {
    const [month, year] = String(row.period || "").split("/").map(Number);
    if (!month || !year) return;
    let perf = state.performance.find(p => Number(p.month) === month && Number(p.year) === year);
    if (!perf) {
      perf = perfDefaultPeriod(year, month);
      state.performance.unshift(perf);
    }
    applyImportedValueToPerformance(perf, row);
    perf.status = "En cours d'analyse";
    perf.updatedAt = isoToday();
    perf.synthesis = buildPerformanceSynthesis(perf);
    const sourceLabel = row.source || file.source || "Import";
    perf.importReady = { ...(perf.importReady || {}), gemed: Boolean(perf.importReady?.gemed || /z\s*gemed/i.test(sourceLabel)), gpo: Boolean(perf.importReady?.gpo || /gpo/i.test(sourceLabel)) };
    perf.importSources = ensureArray(perf.importSources);
    perf.importSources.unshift({ source: sourceLabel, file: file.name || "", importDate, period: row.period, importedCount: 1, comment: `${row.indicator} -> ${row.destinationLabel}` });
    if (!row.destinationPath) perf.complementaryKpis = [...ensureArray(perf.complementaryKpis), row];
    periods.add(row.period);
    importedCount++;
  });
  state.performance = state.performance.map(normalizePerformance).sort((a, b) => b.year - a.year || b.month - a.month);
  return { importedCount, periods: [...periods] };
}

function applyImportedValueToPerformance(perf, row) {
  const target = perfPath(perf, row.destinationPath);
  if (!target) return;
  const field = row.destinationField || "actual";
  target[field] = row.value;
  if (!row.destinationField) {
    target.budget = row.budget ?? target.budget;
    target.historical = row.historical ?? target.historical;
  }
  if (row.destinationPath === "palletHeight" && row.objective !== undefined && row.objective !== "") target.objective = row.objective;
  target.comment = `${target.comment ? target.comment + "\n" : ""}Source : ${row.source || "Import"} · ${row.sourceRef || ""}`.trim();
  if (row.destinationPath.startsWith("productivity.")) target.status = perfStatus(target);
}

const reportTemplates = ["CODIR", "Réunion d'exploitation", "Gemba", "Entretien Manager", "Point Projet", "Réunion RH", "CSE / Dialogue social", "Incident ou événement", "Revue de performance", "Compte rendu libre"];

function reportEntityLabel(type) {
  return ({ journal: "entrée Journal", agenda: "rendez-vous", folders: "dossier", projects: "projet", managers: "manager", documents: "document", performance: "performance", free: "création libre" })[type] || "source";
}

function reportSourceTitle(type, id) {
  const item = state[type] ? byId(type, id) : null;
  if (type === "performance" && item) return perfPeriodLabel(item);
  return item ? (item.title || item.name || item.type || item.id) : "Création libre";
}

function sourceTypePeriod(source) {
  return source?.year && source?.month ? perfPeriodLabel(source) : "À compléter";
}

function reportDefaultTemplate(type, item = {}) {
  if (type === "managers") return "Entretien Manager";
  if (type === "projects") return "Point Projet";
  if (type === "agenda" && /codir/i.test(`${item.type || ""} ${item.title || ""}`)) return "CODIR";
  if (type === "journal" && /gemba/i.test(`${item.entryType || ""} ${item.title || ""}`)) return "Gemba";
  if (type === "folders" && /performance|productivité/i.test(`${item.category || ""} ${item.name || ""}`)) return "Revue de performance";
  return "Compte rendu libre";
}

function reportSourceOptions(type, selectedId = "") {
  if (type === "free") return `<option value="">Création libre</option>`;
  const items = state[type] || [];
  return items.map(item => `<option value="${esc(item.id)}" ${selectedId === item.id ? "selected" : ""}>${esc(type === "performance" ? perfPeriodLabel(item) : (item.title || item.name || item.type || item.id))}</option>`).join("") || `<option value="">Aucune donnée disponible</option>`;
}

function reportAddMany(target, items) {
  const seen = new Set(target.map(x => x.id));
  items.filter(Boolean).forEach(item => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      target.push(item);
    }
  });
}

function reportContextFromSource(sourceType, sourceId) {
  const source = state[sourceType] ? (byId(sourceType, sourceId) || {}) : {};
  const ctx = { sourceType, sourceId, source, meetingPreparation: null, managers: [], projects: [], folders: [], decisions: [], actions: [], documents: [], journal: [], agenda: [] };
  if (sourceType === "managers") {
    reportAddMany(ctx.managers, [source]);
    reportAddMany(ctx.projects, state.projects.filter(p => (p.linkedManagers || []).includes(source.id) || projectOwnerId(p) === source.id));
    reportAddMany(ctx.decisions, state.decisions.filter(d => (d.linkedManagers || []).includes(source.id) || (source.linkedDecisions || []).includes(d.id)));
    reportAddMany(ctx.actions, state.actions.filter(a => (source.linkedActions || []).includes(a.id)));
    reportAddMany(ctx.journal, state.journal.filter(j => (j.linkedManagers || []).includes(source.id)));
    reportAddMany(ctx.documents, state.documents.filter(d => (d.linkedManagers || []).includes(source.id)));
    reportAddMany(ctx.folders, state.folders.filter(f => (f.linkedManagers || []).includes(source.id) || (source.linkedFolders || []).includes(f.id)));
    reportAddMany(ctx.agenda, state.agenda.filter(a => (a.linkedManagers || []).includes(source.id)));
  }
  if (sourceType === "projects") {
    reportAddMany(ctx.projects, [source]);
    reportAddMany(ctx.managers, state.managers.filter(m => (source.linkedManagers || []).includes(m.id) || source.ownerId === m.id));
    reportAddMany(ctx.decisions, state.decisions.filter(d => (d.linkedProjects || []).includes(source.id) || (source.linkedDecisions || []).includes(d.id)));
    reportAddMany(ctx.actions, state.actions.filter(a => (source.linkedActions || []).includes(a.id)));
    reportAddMany(ctx.documents, state.documents.filter(d => (source.linkedDocuments || []).includes(d.id) || (d.linkedProjects || []).includes(source.id)));
    reportAddMany(ctx.journal, state.journal.filter(j => (j.linkedProjects || []).includes(source.id)));
    reportAddMany(ctx.folders, state.folders.filter(f => (source.linkedFolders || []).includes(f.id) || itemLinkedToFolder(source, f)));
    reportAddMany(ctx.agenda, state.agenda.filter(a => (a.linkedProjects || []).includes(source.id)));
  }
  if (sourceType === "folders") {
    const rel = folderRelations(source);
    reportAddMany(ctx.folders, [source]);
    reportAddMany(ctx.managers, rel.managers);
    reportAddMany(ctx.projects, rel.projects);
    reportAddMany(ctx.actions, rel.actions);
    reportAddMany(ctx.decisions, rel.decisions);
    reportAddMany(ctx.documents, rel.documents);
    reportAddMany(ctx.journal, rel.journal);
    reportAddMany(ctx.agenda, rel.agenda);
  }
  if (sourceType === "journal") {
    reportAddMany(ctx.journal, [source]);
    reportAddMany(ctx.managers, state.managers.filter(m => (source.linkedManagers || []).includes(m.id)));
    reportAddMany(ctx.projects, state.projects.filter(p => (source.linkedProjects || []).includes(p.id)));
    reportAddMany(ctx.decisions, state.decisions.filter(d => (source.linkedDecisions || []).includes(d.id)));
    reportAddMany(ctx.actions, state.actions.filter(a => (source.linkedActions || []).includes(a.id)));
    reportAddMany(ctx.documents, state.documents.filter(d => (source.linkedDocuments || []).includes(d.id) || (d.linkedJournal || []).includes(source.id)));
    reportAddMany(ctx.folders, state.folders.filter(f => (source.linkedFolders || []).includes(f.id) || itemLinkedToFolder(source, f)));
  }
  if (sourceType === "agenda") {
    const prep = meetingPrepForAgenda(source.id);
    ctx.meetingPreparation = prep || null;
    reportAddMany(ctx.agenda, [source]);
    reportAddMany(ctx.managers, state.managers.filter(m => (source.linkedManagers || []).includes(m.id)));
    reportAddMany(ctx.projects, state.projects.filter(p => (source.linkedProjects || []).includes(p.id)));
    reportAddMany(ctx.folders, state.folders.filter(f => (source.linkedFolders || []).includes(f.id)));
    if (prep) {
      reportAddMany(ctx.managers, state.managers.filter(m => (prep.linkedManagers || []).includes(m.id)));
      reportAddMany(ctx.projects, state.projects.filter(p => (prep.linkedProjects || []).includes(p.id)));
      reportAddMany(ctx.folders, state.folders.filter(f => (prep.linkedFolders || []).includes(f.id)));
      reportAddMany(ctx.actions, state.actions.filter(a => (prep.linkedActions || []).includes(a.id)));
      reportAddMany(ctx.decisions, state.decisions.filter(d => (prep.linkedDecisions || []).includes(d.id)));
      reportAddMany(ctx.documents, state.documents.filter(d => (prep.linkedDocuments || []).includes(d.id)));
    }
  }
  if (sourceType === "documents") {
    reportAddMany(ctx.documents, [source]);
    reportAddMany(ctx.managers, state.managers.filter(m => (source.linkedManagers || []).includes(m.id)));
    reportAddMany(ctx.projects, state.projects.filter(p => (source.linkedProjects || []).includes(p.id)));
    reportAddMany(ctx.folders, state.folders.filter(f => (source.linkedFolders || []).includes(f.id)));
    reportAddMany(ctx.decisions, state.decisions.filter(d => (source.linkedDecisions || []).includes(d.id)));
    reportAddMany(ctx.actions, state.actions.filter(a => (source.linkedActions || []).includes(a.id)));
    reportAddMany(ctx.journal, state.journal.filter(j => (source.linkedJournal || []).includes(j.id)));
  }
  if (sourceType === "performance") {
    reportAddMany(ctx.managers, state.managers.filter(m => (source.linkedManagers || []).includes(m.id)));
    reportAddMany(ctx.projects, state.projects.filter(p => (source.linkedProjects || []).includes(p.id)));
    reportAddMany(ctx.folders, state.folders.filter(f => (source.linkedFolders || []).includes(f.id)));
    reportAddMany(ctx.actions, state.actions.filter(a => (source.linkedActions || []).includes(a.id) || (a.linkedPerformance || []).includes(source.id)));
    reportAddMany(ctx.decisions, state.decisions.filter(d => (source.linkedDecisions || []).includes(d.id) || (d.linkedPerformance || []).includes(source.id)));
    reportAddMany(ctx.documents, state.documents.filter(d => (source.linkedDocuments || []).includes(d.id) || (d.linkedPerformance || []).includes(source.id)));
    reportAddMany(ctx.journal, state.journal.filter(j => (source.linkedJournal || []).includes(j.id)));
  }
  return ctx;
}

function reportItems(items, fn) {
  return items.length ? items.map(fn).join("\n") : "À compléter";
}

function reportActions(actions) {
  return reportItems(actions, a => `- ${a.title || "Action"} | Responsable : ${a.owner || "À compléter"} | Priorité : ${a.level || a.priorityLevel || "À compléter"} | Échéance : ${a.due || "À compléter"} | Statut : ${a.done ? "Terminée" : "Ouverte"}`);
}

function reportDecisions(decisions) {
  return reportItems(decisions, d => `- ${d.decision || d.title} | Contexte : ${d.context || "À compléter"} | Responsable : ${d.owner || "À compléter"} | Échéance : ${d.reviewDate || "À compléter"}`);
}

function reportBuildTitle(template, ctx) {
  const source = ctx.source || {};
  if (template === "CODIR") return `Compte rendu CODIR - ${source.date || isoToday()}`;
  if (template === "Entretien Manager") return `Entretien - ${ctx.managers[0]?.name || source.name || "Manager"} - ${source.date || isoToday()}`;
  if (template === "Point Projet") return `Point projet - ${ctx.projects[0]?.name || source.name || "Projet"} - ${source.date || isoToday()}`;
  return `${template} - ${reportSourceTitle(ctx.sourceType, ctx.sourceId)} - ${source.date || isoToday()}`;
}

function reportBuildSections(template, ctx) {
  const source = ctx.source || {};
  const manager = ctx.managers[0] || {};
  const project = ctx.projects[0] || {};
  const participants = reportItems(ctx.managers, m => `- ${m.name} (${m.role || "fonction à compléter"})`);
  const projects = reportItems(ctx.projects, p => `- ${p.name} (${labels[p.status] || p.status || "statut à compléter"})`);
  const folders = reportItems(ctx.folders, f => `- ${f.name} (${f.category || "catégorie à compléter"})`);
  const documents = reportItems(ctx.documents, d => `- ${d.title} (${d.type || "document"})`);
  const actions = reportActions(ctx.actions);
  const decisions = reportDecisions(ctx.decisions);
  const prep = ctx.meetingPreparation;
  if (ctx.sourceType === "agenda" && prep) {
    const topics = reportItems(prep.agendaTopics || [], (t, i) => `- ${i + 1}. ${t.title || "Sujet"} | ${t.type || "Information"} | ${t.duration || 0} min | ${t.status || "À traiter"} | ${t.prepNotes || ""}`);
    const ideas = reportItems(prep.ideas || [], i => `- ${i.category || "Sujet"} : ${i.text || ""} | Statut : ${i.status || "À traiter"}${i.conclusion ? " | Conclusion : " + i.conclusion : ""}`);
    const prepItems = reportItems(prep.prepItems || [], i => `- ${i.title || "Élément"} | ${i.status || "À faire"} | Responsable : ${i.owner || "À compléter"} | Échéance : ${i.due || "À compléter"}`);
    const arbitrations = reportItems(prep.arbitrations || [], a => `- ${a.subject || "Arbitrage"} | Statut : ${a.status || "À préparer"} | Recommandation : ${a.recommendation || "À compléter"}`);
    const runNotes = reportItems([...(prep.run?.notes || []), ...(prep.run?.decisions || []), ...(prep.run?.actions || []), ...(prep.run?.postponed || [])], n => `- ${n.type || "Note"} : ${n.text || ""}`);
    const performance = reportItems(state.performance.filter(p => (prep.linkedPerformance || []).includes(p.id)), p => `- ${perfPeriodLabel(p)} | ${buildPerformanceSynthesis(p).slice(0, 240)}`);
    return [
      { title: "Informations", body: `Date : ${source.date || isoToday()}\nHoraires : ${source.startTime || source.time || "À compléter"}${source.endTime ? " - " + source.endTime : ""}\nLieu : ${source.location || "À compléter"}\nType : ${source.type || prep.template || "Réunion"}\nOrganisateur : ${prep.organizer || identityName()}\nStatut préparation : ${prep.status || "À préparer"}\nParticipants :\n${participants}` },
      { title: "Objectif et attendus", body: `Objectif principal : ${prep.objectiveMain || "À compléter"}\nRésultats attendus : ${prep.expectedResults || "À compléter"}\nDécisions attendues : ${prep.expectedDecisions || "À compléter"}\nNiveau de préparation : ${prep.prepLevel || "à démarrer"}` },
      { title: "Ordre du jour", body: topics },
      { title: "Sujets collectés en amont", body: ideas },
      { title: "Éléments à préparer", body: prepItems },
      { title: "Décisions et arbitrages attendus", body: arbitrations },
      { title: "Notes de conduite", body: runNotes },
      { title: "Performance et documents", body: `Performance liée :\n${performance}\nDocuments :\n${documents}` },
      { title: "Décisions", body: decisions },
      { title: "Actions", body: actions }
    ];
  }
  if (template === "CODIR") return [
    { title: "Informations", body: `Date : ${source.date || isoToday()}\nHoraires : ${source.startTime || source.time || "À compléter"}${source.endTime ? " - " + source.endTime : ""}\nLieu : ${source.location || "À compléter"}\nParticipants :\n${participants}\nAbsents ou excusés : À compléter` },
    { title: "Ordre du jour", body: `Sujets prévus : ${source.notes || source.summary || "À compléter"}\nDossiers abordés :\n${folders}\nProjets abordés :\n${projects}` },
    { title: "Synthèse", body: `Faits marquants : ${source.facts || source.summary || "À compléter"}\nActivité : À compléter\nPerformance : À compléter\nRH : À compléter\nSécurité : À compléter\nQualité : À compléter\nMaintenance : À compléter\nDialogue social : À compléter\nAutres sujets : À compléter` },
    { title: "Décisions", body: decisions }, { title: "Actions", body: actions }, { title: "Points de vigilance", body: "À compléter" }, { title: "Prochaine réunion", body: "Date : À compléter\nSujets à préparer : À compléter" }
  ];
  if (template === "Entretien Manager") return [
    { title: "Informations", body: `Manager : ${manager.name || "À compléter"}\nFonction : ${manager.role || "À compléter"}\nDate : ${source.date || isoToday()}\nContexte : ${source.summary || manager.note || "À compléter"}` },
    { title: "Faits abordés", body: source.facts || source.content || "À compléter" },
    { title: "Résultats et réalisations", body: reportItems(manager.objectives || [], x => `- ${x}`) },
    { title: "Points forts", body: reportItems(manager.strengths || [], x => `- ${x}`) },
    { title: "Difficultés et vigilance", body: reportItems(manager.watchPoints || [], x => `- ${x}`) },
    { title: "Actions convenues", body: actions },
    { title: "Prochain point", body: `Date : ${manager.nextMeeting || "À compléter"}\nSynthèse du directeur : ${manager.note || "À compléter"}` }
  ];
  if (template === "Point Projet") return [
    { title: "Projet", body: `Projet : ${project.name || "À compléter"}\nObjectif : ${project.objective || "À compléter"}\nResponsable : ${projectOwnerName(project) || project.owner || "À compléter"}\nManagers associés :\n${participants}\nStatut : ${labels[project.status] || project.status || "À compléter"}\nAvancement : ${Number(project.progress || 0)}%` },
    { title: "Réalisations et jalons", body: `Réalisations depuis le dernier point : À compléter\nJalons atteints :\n${reportItems(project.milestones || [], m => `- ${m.title} (${m.date || "date à compléter"} - ${m.status || "statut à compléter"})`)}` },
    { title: "Difficultés et risques", body: project.risks || "À compléter" },
    { title: "Décisions", body: decisions },
    { title: "Actions", body: actions },
    { title: "Prochaine étape", body: `Prochaine étape : ${project.next || "À compléter"}\nDate du prochain point : À compléter` }
  ];
  if (template === "Gemba") return [
    { title: "Observation", body: `Date : ${source.date || isoToday()}\nSecteur observé : ${source.location || source.title || "À compléter"}\nParticipants :\n${participants}\nActivité observée : ${source.summary || "À compléter"}` },
    { title: "Constats", body: `Faits constatés : ${source.facts || "À compléter"}\nBonnes pratiques : À compléter\nÉcarts observés : À compléter\nRisques identifiés : ${source.watchPoints || "À compléter"}\nÉchanges avec les équipes : À compléter` },
    { title: "Actions", body: actions },
    { title: "Documents et synthèse", body: `Documents liés :\n${documents}\nSynthèse : ${source.analysis || source.notes || "À compléter"}` }
  ];
  if (template === "CSE / Dialogue social") return [
    { title: "Informations", body: `Date : ${source.date || isoToday()}\nInstance ou réunion : ${source.title || source.type || "CSE / Dialogue social"}\nParticipants :\n${participants}` },
    { title: "Sujets et échanges", body: `Sujets abordés : ${source.summary || source.notes || "À compléter"}\nDemandes formulées : À compléter\nÉléments communiqués par la Direction : À compléter\nÉchanges : À compléter` },
    { title: "Engagements, décisions et actions", body: `Engagements pris : À compléter\nDécisions :\n${decisions}\nActions :\n${actions}` },
    { title: "Suites", body: `Points restant à traiter : À compléter\nDocuments liés :\n${documents}` }
  ];
  if (template === "Revue de performance") return [
    { title: "Période et activité", body: `Période analysée : ${sourceTypePeriod(source)}\nActivité : ${source.activity ? `Colis réalisés ${perfFmt(source.activity.actual)} / budget ${perfFmt(source.activity.budget)}` : (source.summary || source.description || source.context || "À compléter")}` },
    { title: "Indicateurs disponibles", body: source.activity ? `Performance / IPO : total ${perfFmt(source.ipo.total.actual)} / budget ${perfFmt(source.ipo.total.budget)}\nProductivité Préparation : ${perfFmt(source.productivity["Préparation"].actual)} / budget ${perfFmt(source.productivity["Préparation"].budget)}\nHeures directes : ${perfFmt(source.hours.direct.actual)}\nHeures indirectes : ${perfFmt(source.hours.indirect.actual)}\nAbsentéisme : ${perfFmt(source.absenteeism.total.actual)}\nQualité / Gains & Pertes : ${perfFmt(source.quality.indicators["Total Gains & Pertes"].actual)}\nHauteur palette : ${perfFmt(source.palletHeight.actual)}` : "Performance / IPO : À compléter\nProductivité : À compléter\nHeures directes : À compléter\nHeures indirectes : À compléter\nAbsentéisme : À compléter\nQualité : À compléter\nSécurité : À compléter" },
    { title: "Analyse", body: source.activity ? `Faits marquants : ${source.activity.highlights || source.quality.highlights || "À compléter"}\nCauses des écarts : ${source.activity.causes || source.ipo.rootCauses || source.quality.causes || "À compléter"}\nPoints positifs et vigilance :\n${source.synthesis || buildPerformanceSynthesis(source)}` : `Faits marquants : ${source.facts || source.objectives || "À compléter"}\nCauses des écarts : À compléter\nPoints positifs : À compléter\nPoints de vigilance : ${source.risks || source.watchPoints || "À compléter"}` },
    { title: "Décisions et plan d'action", body: `Décisions :\n${decisions}\nPlan d'action :\n${actions}\nProjection : À compléter` }
  ];
  return [
    { title: "Informations", body: `Date : ${source.date || isoToday()}\nSource : ${reportEntityLabel(ctx.sourceType)} - ${reportSourceTitle(ctx.sourceType, ctx.sourceId)}` },
    { title: "Synthèse", body: source.summary || source.description || source.context || source.note || source.content || "À compléter" },
    { title: "Éléments liés", body: `Managers :\n${participants}\nProjets :\n${projects}\nDossiers :\n${folders}\nDocuments :\n${documents}` },
    { title: "Décisions", body: decisions },
    { title: "Actions", body: actions }
  ];
}

function reportRefreshSections() {
  const ctx = reportContextFromSource(reportWizard.sourceType, reportWizard.sourceId);
  reportWizard.context = ctx;
  reportWizard.title = reportBuildTitle(reportWizard.template, ctx);
  reportWizard.sections = reportBuildSections(reportWizard.template, ctx).map(s => ({ id: newId("section"), ...s }));
  reportWizard.selectedManagers = ctx.managers.map(x => x.id);
  reportWizard.selectedProjects = ctx.projects.map(x => x.id);
  reportWizard.selectedFolders = ctx.folders.map(x => x.id);
  reportWizard.selectedDecisions = ctx.decisions.map(x => x.id);
  reportWizard.selectedActions = ctx.actions.map(x => x.id);
  reportWizard.selectedDocuments = ctx.documents.map(x => x.id);
  reportWizard.selectedJournal = ctx.journal.map(x => x.id);
}

function startReport(sourceType = "free", sourceId = "", template = "") {
  const source = state[sourceType] ? byId(sourceType, sourceId) : {};
  reportWizard = { step: 1, sourceType, sourceId, template: template || reportDefaultTemplate(sourceType, source), title: "", status: "Brouillon", author: identityName(), sections: [] };
  reportRefreshSections();
  renderReportWizard();
}

function reportReadCurrent() {
  if (!reportWizard) return;
  const template = document.getElementById("rwTemplate");
  const sourceType = document.getElementById("rwSourceType");
  const sourceId = document.getElementById("rwSourceId");
  if (template) reportWizard.template = template.value;
  if (sourceType) reportWizard.sourceType = sourceType.value;
  if (sourceId) reportWizard.sourceId = sourceId.value;
  const title = document.getElementById("rwTitle");
  if (title) reportWizard.title = title.value.trim();
  const status = document.getElementById("rwStatus");
  if (status) reportWizard.status = status.value;
  const author = document.getElementById("rwAuthor");
  if (author) reportWizard.author = author.value.trim();
  const sections = document.querySelectorAll("[data-report-section]");
  if (sections.length) reportWizard.sections = [...sections].map(section => ({ id: section.dataset.reportSection, title: section.querySelector(".report-section-title").value.trim() || "Section", body: section.querySelector(".report-section-body").value }));
  ["Managers", "Projects", "Folders", "Decisions", "Actions", "Documents", "Journal"].forEach(key => {
    if (document.getElementById(`rw${key}`)) reportWizard[`selected${key}`] = checkedValues(`rw${key}`);
  });
}

function setReportStep(step) {
  reportReadCurrent();
  reportWizard.step = step;
  renderReportWizard();
}

function updateReportSource() {
  reportReadCurrent();
  reportRefreshSections();
  renderReportWizard();
}

function renderReportWizard() {
  if (!reportWizard) return renderDocuments();
  document.getElementById("viewTitle").textContent = "Générer un compte rendu";
  const steps = ["Type", "Source", "Liens", "Aperçu", "Validation"].map((label, i) => `<span class="${reportWizard.step === i + 1 ? "active-step" : ""}">${i + 1}. ${label}</span>`).join("");
  appHtml(`<div class="card hero report-hero"><button class="secondary" onclick="cancelReportWizard()">Retour Documents</button><h2>Générer un compte rendu</h2><p class="muted">Assistant structuré basé uniquement sur les données enregistrées dans ${esc(identity.appName)}.</p><div class="report-steps">${steps}</div></div>${reportWizardBody()}`);
}

function reportWizardBody() {
  if (reportWizard.step === 1) return `<div class="card"><h2>Type de compte rendu</h2><select id="rwTemplate">${reportTemplates.map(t => `<option value="${esc(t)}" ${reportWizard.template === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><div class="row-actions"><button class="action" onclick="setReportStep(2)">Suivant</button><button class="secondary" onclick="cancelReportWizard()">Annuler</button></div></div>`;
  if (reportWizard.step === 2) return `<div class="card"><h2>Source</h2><div class="form-grid"><select id="rwSourceType" onchange="updateReportSource()"><option value="journal" ${reportWizard.sourceType === "journal" ? "selected" : ""}>Entrée Journal</option><option value="agenda" ${reportWizard.sourceType === "agenda" ? "selected" : ""}>Rendez-vous</option><option value="folders" ${reportWizard.sourceType === "folders" ? "selected" : ""}>Dossier</option><option value="projects" ${reportWizard.sourceType === "projects" ? "selected" : ""}>Projet</option><option value="managers" ${reportWizard.sourceType === "managers" ? "selected" : ""}>Manager</option><option value="performance" ${reportWizard.sourceType === "performance" ? "selected" : ""}>Performance</option><option value="free" ${reportWizard.sourceType === "free" ? "selected" : ""}>Création libre</option></select><select id="rwSourceId" onchange="updateReportSource()">${reportSourceOptions(reportWizard.sourceType, reportWizard.sourceId)}</select></div><div class="row-actions"><button class="secondary" onclick="setReportStep(1)">Retour</button><button class="action" onclick="setReportStep(3)">Suivant</button></div></div>`;
  if (reportWizard.step === 3) return reportLinksStep();
  if (reportWizard.step === 4) return reportPreviewStep();
  return reportValidationStep();
}

function reportLinksStep() {
  const sel = key => reportWizard[`selected${key}`] || [];
  return `<div class="card"><h2>Éléments liés à intégrer</h2><div class="grid two manager-links"><div><label>Managers</label>${checkboxList("rwManagers", state.managers, sel("Managers"), m => `${m.name} - ${m.role || ""}`)}</div><div><label>Projets</label>${checkboxList("rwProjects", state.projects, sel("Projects"), p => p.name)}</div><div><label>Dossiers</label>${checkboxList("rwFolders", state.folders, sel("Folders"), f => `${f.name} - ${f.category}`)}</div><div><label>Décisions</label>${checkboxList("rwDecisions", state.decisions, sel("Decisions"), d => d.title)}</div><div><label>Actions</label>${checkboxList("rwActions", state.actions, sel("Actions"), a => a.title)}</div><div><label>Documents</label>${checkboxList("rwDocuments", state.documents, sel("Documents"), d => d.title)}</div><div><label>Événements du Journal</label>${checkboxList("rwJournal", state.journal, sel("Journal"), j => `${j.title} - ${j.date || ""}`)}</div></div><div class="row-actions"><button class="secondary" onclick="setReportStep(2)">Retour</button><button class="action" onclick="setReportStep(4)">Générer l'aperçu</button></div></div>`;
}

function reportPreviewText() {
  reportReadCurrent();
  return `${reportWizard.title}\n\n${reportWizard.sections.map(s => `${s.title}\n${s.body}`).join("\n\n")}\n\n${identitySignature()}`;
}

function reportPreviewStep() {
  const sections = reportWizard.sections.map((s, i) => `<div class="report-section" data-report-section="${esc(s.id)}"><div class="row"><input class="report-section-title" value="${esc(s.title)}"><div class="row-actions"><button class="secondary" onclick="moveReportSection(${i},-1)">?</button><button class="secondary" onclick="moveReportSection(${i},1)">?</button><button class="danger" onclick="deleteReportSection('${s.id}')">Supprimer</button></div></div><textarea class="report-section-body">${esc(s.body)}</textarea></div>`).join("");
  return `<div class="card"><h2>Aperçu complet</h2><div class="form-grid"><input id="rwTitle" class="full" value="${esc(reportWizard.title)}"><input id="rwAuthor" value="${esc(reportWizard.author || identityName())}" placeholder="Auteur"><select id="rwStatus"><option ${reportWizard.status === "Brouillon" ? "selected" : ""}>Brouillon</option><option ${reportWizard.status === "Validé" ? "selected" : ""}>Validé</option></select></div>${sections}<div class="row-actions"><button class="secondary" onclick="addReportSection()">Ajouter une section</button><button class="secondary" onclick="copyReportText()">Copier le compte rendu</button><button class="secondary" onclick="printReportText()">Imprimer</button></div><div class="card report-transform"><h2>Transformer une ligne</h2><textarea id="rwLine" placeholder="Coller ou saisir une ligne du compte rendu"></textarea><div class="form-grid"><input id="rwLineOwner" placeholder="Responsable proposé"><input id="rwLineDue" type="date"><select id="rwLinePriority"><option value="green">Normal</option><option value="orange" selected>Important</option><option value="red">Critique</option></select></div><button class="secondary" onclick="createReportAction()">Créer une action ${esc(identity.appName)}</button><button class="secondary" onclick="createReportDecision()">Créer une décision ${esc(identity.appName)}</button></div><div class="row-actions"><button class="secondary" onclick="setReportStep(3)">Retour</button><button class="action" onclick="setReportStep(5)">Continuer</button></div></div>`;
}

function reportValidationStep() {
  return `<div class="card"><h2>Validation</h2><pre class="report-preview">${esc(reportPreviewText())}</pre><div class="row-actions"><button class="secondary" onclick="setReportStep(4)">Retour</button><button class="secondary" onclick="saveGeneratedReport('Brouillon')">Enregistrer comme brouillon</button><button class="action" onclick="saveGeneratedReport('Validé')">Valider le compte rendu</button><button class="secondary" onclick="copyReportText()">Copier le compte rendu</button><button class="secondary" onclick="printReportText()">Imprimer</button></div></div>`;
}

function addReportSection() {
  reportReadCurrent();
  reportWizard.sections.push({ id: newId("section"), title: "Nouvelle section", body: "À compléter" });
  renderReportWizard();
}

function deleteReportSection(id) {
  reportReadCurrent();
  reportWizard.sections = reportWizard.sections.filter(s => s.id !== id);
  renderReportWizard();
}

function moveReportSection(index, delta) {
  reportReadCurrent();
  const next = index + delta;
  if (next >= 0 && next < reportWizard.sections.length) [reportWizard.sections[index], reportWizard.sections[next]] = [reportWizard.sections[next], reportWizard.sections[index]];
  renderReportWizard();
}

function reportLinkedIds(key) {
  reportReadCurrent();
  return reportWizard[`selected${key}`] || [];
}

function generatedReportPayload(status) {
  reportReadCurrent();
  const content = reportPreviewText();
  return { id: newId("document"), title: reportWizard.title, type: "Compte rendu", category: reportWizard.template, date: isoToday(), owner: reportWizard.author || identityName(), author: reportWizard.author || identityName(), version: "V1", status, summary: reportWizard.sections[0]?.body?.slice(0, 220) || "", content, tags: [reportWizard.template, "Compte rendu", identity.appName], linkedManagers: reportLinkedIds("Managers"), linkedProjects: reportLinkedIds("Projects"), linkedFolders: reportLinkedIds("Folders"), linkedDecisions: reportLinkedIds("Decisions"), linkedActions: reportLinkedIds("Actions"), linkedJournal: reportLinkedIds("Journal"), linkedPerformance: reportWizard.sourceType === "performance" ? [reportWizard.sourceId] : [], sourceType: reportWizard.sourceType, sourceId: reportWizard.sourceId, reportTemplate: reportWizard.template, updatedAt: isoToday() };
}

function saveGeneratedReport(status = "Brouillon") {
  const doc = generatedReportPayload(status);
  state.documents.unshift(doc);
  persist("documents");
  addActivity("Document", doc.title, `Compte rendu ${status}`, doc.id);
  reportWizard = null;
  renderDocuments();
}

function cancelReportWizard() {
  reportWizard = null;
  renderDocuments();
}

function copyReportText() {
  const text = reportPreviewText();
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  alert("Compte rendu copié.");
}

function printReportText() {
  const text = reportPreviewText();
  const win = window.open("", "_blank");
  if (!win) return window.print();
  win.document.write(`<html><head><title>Compte rendu ${esc(identity.appName)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;padding:32px}h1{font-size:24px}pre{white-space:pre-wrap;font-family:inherit}footer{margin-top:32px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px}</style></head><body><h1>${esc(reportWizard.title || "Compte rendu " + identity.appName)}</h1><pre>${esc(text)}</pre><footer>${esc(identitySignature())}</footer><script>window.print()</script></body></html>`);
  win.document.close();
}

function createReportAction() {
  reportReadCurrent();
  const text = document.getElementById("rwLine")?.value.trim();
  if (!text || state.actions.some(a => a.title === text)) return;
  const action = { id: newId("action"), title: text, owner: document.getElementById("rwLineOwner").value.trim(), due: document.getElementById("rwLineDue").value, level: document.getElementById("rwLinePriority").value, done: false, link: reportWizard.title, linkedFolders: reportLinkedIds("Folders"), linkedManagers: reportLinkedIds("Managers"), linkedProjects: reportLinkedIds("Projects"), linkedDecisions: reportLinkedIds("Decisions") };
  state.actions.unshift(action);
  persist("actions");
  addActivity("Action", action.title, "Créée depuis compte rendu", action.id);
  reportWizard.selectedActions = [...new Set([...(reportWizard.selectedActions || []), action.id])];
  renderReportWizard();
}

function createReportDecision() {
  reportReadCurrent();
  const text = document.getElementById("rwLine")?.value.trim();
  if (!text || state.decisions.some(d => d.title === text || d.decision === text)) return;
  const decision = { id: newId("decision"), title: text, date: isoToday(), status: "decided", importance: document.getElementById("rwLinePriority").value, context: `Issue du compte rendu ${reportWizard.title}`, problem: "", decision: text, rationale: "", alternatives: "", impacts: "", risks: "", owner: document.getElementById("rwLineOwner").value.trim(), linkedManagers: reportLinkedIds("Managers"), linkedProjects: reportLinkedIds("Projects"), linkedActions: [], linkedDocuments: [], linkedFolders: reportLinkedIds("Folders"), reviewDate: document.getElementById("rwLineDue").value, events: [], directorNotes: [], nextStep: "", tags: ["Compte rendu"] };
  state.decisions.unshift(decision);
  persist("decisions");
  addActivity("Décision", decision.title, "Créée depuis compte rendu", decision.id);
  reportWizard.selectedDecisions = [...new Set([...(reportWizard.selectedDecisions || []), decision.id])];
  renderReportWizard();
}

function renderDocuments() {
  document.getElementById("viewTitle").textContent = "Documents";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "documents"));
  appHtml(`<div class="card hero"><div class="row"><div><h2>Documents</h2><p class="muted">Le document conserve : centralisez ici les pièces et supports utiles à votre pilotage.</p></div><button class="action" onclick="startReport('free')">Générer un compte rendu</button></div></div><div class="card"><h2>Ajouter un document</h2><input id="docTitle" placeholder="Titre"><div class="form-grid"><input id="docType" placeholder="Type"><input id="docOwner" placeholder="Responsable"><input id="docStatus" placeholder="Statut" value="Brouillon"><input id="docTags" placeholder="Tags"></div><textarea id="docContent" placeholder="Contenu ou structure"></textarea><div class="grid two manager-links"><div><label>Dossiers liés</label>${folderSelect("docFolders")}</div><div><label>Projets liés</label>${checkboxList("docProjects", state.projects, [], p => p.name)}</div></div><button class="action" onclick="addDocument()">Ajouter</button></div><div class="grid two">${state.documents.map(documentCard).join("") || `<div class="card empty">Aucun document.</div>`}</div>`);
}

function documentCard(d) {
  return `<div class="card"><h2>${esc(d.title)}</h2><span class="muted">${esc(d.type || "")}${d.category ? " · " + esc(d.category) : ""}${d.status ? " · " + esc(d.status) : ""}${d.owner ? " · " + esc(d.owner) : ""}</span><p>${esc(d.summary || d.content || "")}</p><span class="meta">ID ${esc(d.id)} ? MAJ ${esc(d.updatedAt || "")}</span><br><button class="secondary" onclick="editDocument('${d.id}')">Modifier</button><button class="secondary" onclick="startReport('documents','${d.id}')">Générer un compte rendu</button><button class="danger" onclick="deleteDocument('${d.id}')">Supprimer</button></div>`;
}

function addDocument() {
  const title = document.getElementById("docTitle").value.trim();
  if (!title) return;
  const d = { id: newId("document"), title, type: document.getElementById("docType").value.trim(), owner: document.getElementById("docOwner").value.trim(), status: document.getElementById("docStatus").value.trim(), tags: splitTags(document.getElementById("docTags").value), content: document.getElementById("docContent").value.trim(), linkedFolders: checkedValues("docFolders"), linkedManagers: [], linkedProjects: checkedValues("docProjects"), linkedDecisions: [], linkedJournal: [], linkedActions: [], updatedAt: isoToday() };
  state.documents.unshift(d);
  persist("documents");
  addActivity("📄 Document", d.title, d.type, d.id);
  renderDocuments();
}

function editDocument(id) {
  const d = byId("documents", id);
  if (!d) return;
  appHtml(`<div class="card"><h2>Modifier document</h2><input id="edocTitle" value="${esc(d.title)}"><div class="form-grid"><input id="edocType" value="${esc(d.type || "")}" placeholder="Type"><input id="edocOwner" value="${esc(d.owner || "")}" placeholder="Responsable"><input id="edocStatus" value="${esc(d.status || "")}" placeholder="Statut"><input id="edocTags" value="${esc((d.tags || []).join(", "))}" placeholder="Tags"></div><textarea id="edocContent">${esc(d.content || "")}</textarea><div class="grid two manager-links"><div><label>Dossiers liés</label>${folderSelect("edocFolders", d.linkedFolders || [])}</div><div><label>Projets liés</label>${checkboxList("edocProjects", state.projects, d.linkedProjects || [], p => p.name)}</div></div><button class="action" onclick="saveDocument('${d.id}')">Enregistrer</button><button class="secondary" onclick="renderDocuments()">Annuler</button></div>`);
}

function saveDocument(id) {
  const i = indexById("documents", id);
  if (i < 0) return;
  state.documents[i] = { ...state.documents[i], title: document.getElementById("edocTitle").value.trim(), type: document.getElementById("edocType").value.trim(), owner: document.getElementById("edocOwner").value.trim(), status: document.getElementById("edocStatus").value.trim(), tags: splitTags(document.getElementById("edocTags").value), content: document.getElementById("edocContent").value.trim(), linkedFolders: checkedValues("edocFolders"), linkedProjects: checkedValues("edocProjects"), updatedAt: isoToday() };
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
  addActivity("🗑️ Document supprimé", t);
  renderDocuments();
}

const linkCategories = ["Pilotage", "Performance", "RH", "Communication", "Documents", "Sécurité", "Gestion de crise", "Outils Carrefour", "Exploitation", "Social", "Outils", "Tableau de bord", "Autre"];
const linkStatuses = ["actif", "à vérifier", "archivé"];

function linkUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(javascript|data|vbscript|blob):/i.test(url)) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^mailto:/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "";
  return `https://${url}`;
}

function linkDomain(value) {
  const url = linkUrl(value);
  if (!url) return "";
  try {
    if (url.startsWith("mailto:")) return url.replace(/^mailto:/i, "");
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function linkCategoryOptions() {
  return [...new Set([...linkCategories, ...state.links.map(l => l.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
}

function linkCategoryIcon(category = "") {
  const text = category.toLowerCase();
  if (/pilotage|tableau|dashboard/.test(text)) return "📊";
  if (/performance|kpi/.test(text)) return "📈";
  if (/\brh\b|social/.test(text)) return "👥";
  if (/communication|mail/.test(text)) return "✉️";
  if (/document|drive/.test(text)) return "📄";
  if (/sécurité|securite|crise/.test(text)) return "🛡️";
  if (/carrefour|outil|exploitation/.test(text)) return "🧭";
  return "🔗";
}

function linkFilteredItems() {
  const q = linkSearch.toLowerCase().trim();
  return state.links.filter(link => {
    if (linkCategoryFilter !== "all" && link.category !== linkCategoryFilter) return false;
    if (linkFavoriteFilter && !link.favorite) return false;
    if (!q) return true;
    return `${link.name} ${link.category} ${link.description} ${link.url} ${linkDomain(link.url)}`.toLowerCase().includes(q);
  }).sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || Number(a.order || 0) - Number(b.order || 0) || String(a.name || "").localeCompare(String(b.name || "")));
}

function linkStatusBadge(status) {
  const cls = status === "actif" ? "green" : status === "archivé" ? "red" : "orange";
  return `<span class="badge ${cls}">${esc(status || "actif")}</span>`;
}

function linkForm(link = {}) {
  const isEdit = Boolean(link.id);
  const icon = link.icon || suggestLinkIcon(`${link.name || ""} ${link.url || ""} ${link.category || ""}`);
  return `<div class="card link-form"><h2>${isEdit ? "Modifier le lien" : "Nouveau lien"}</h2><div class="form-grid"><input id="lnName" value="${esc(link.name || "")}" placeholder="Nom du lien" oninput="suggestLinkIconField()"><input id="lnUrl" value="${esc(link.url || "")}" placeholder="URL, ex. intranet.carrefour.fr" oninput="suggestLinkIconField()"><input id="lnCategory" list="linkCategoryOptions" value="${esc(link.category || "Autre")}" placeholder="Catégorie"><datalist id="linkCategoryOptions">${linkCategoryOptions().map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist><select id="lnStatus">${linkStatuses.map(s => `<option value="${esc(s)}" ${link.status === s || (!link.status && s === "actif") ? "selected" : ""}>${esc(s)}</option>`).join("")}</select><input id="lnIcon" value="${esc(icon)}" placeholder="Icône ou emoji" aria-label="Icône ou emoji"><label class="check-row link-fav-row"><input id="lnFavorite" type="checkbox" ${link.favorite ? "checked" : ""}> <span>Favori</span></label><textarea id="lnDescription" class="full" placeholder="Description courte">${esc(link.description || "")}</textarea></div><p class="muted">Les URL sans protocole sont enregistrées en https://. Les protocoles dangereux sont refusés.</p><div class="row-actions"><button class="action" onclick="${isEdit ? `saveLink('${link.id}')` : "addLink()"}">Enregistrer</button><button class="secondary" onclick="cancelLinkEdit()">Annuler</button></div></div>`;
}

function linkCard(link) {
  const url = linkUrl(link.url);
  const domain = linkDomain(link.url);
  const disabled = !url;
  return `<div class="card link-card link-tile ${link.status === "archivé" ? "link-archived" : ""}"><button class="link-tile-main" onclick="${disabled ? "" : `openExternalLink('${esc(link.id)}')`}" aria-label="Ouvrir ${esc(link.name || "lien")}"><span class="link-icon" aria-hidden="true">${esc(link.icon || suggestLinkIcon(`${link.name} ${link.url}`))}</span><span class="link-tile-text"><strong>${esc(link.name || "Lien")}</strong><small>${esc(link.category || "Autre")}${domain ? " · " + esc(domain) : ""}</small></span></button><p>${esc(link.description || "Ressource professionnelle")}</p><div class="link-tile-footer"><div>${linkStatusBadge(link.status)}${link.favorite ? `<span class="badge orange">? Favori</span>` : ""}</div><button class="icon-button ${link.favorite ? "is-favorite" : ""}" onclick="toggleLinkFavorite('${esc(link.id)}')" title="${link.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}" aria-label="${link.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}">${link.favorite ? "?" : "?"}</button></div><div class="link-actions"><a class="action link-action" href="${esc(url || "#")}" target="_blank" rel="noopener noreferrer" aria-disabled="${disabled}">Ouvrir</a><button class="secondary" onclick="editLink('${esc(link.id)}')">Modifier</button><button class="secondary" onclick="archiveLink('${esc(link.id)}')">${link.status === "archivé" ? "Réactiver" : "Archiver"}</button><button class="secondary" onclick="moveLink('${esc(link.id)}',-1)">Monter</button><button class="secondary" onclick="moveLink('${esc(link.id)}',1)">Descendre</button><button class="danger" onclick="deleteLink('${esc(link.id)}')">Supprimer</button></div></div>`;
}

function renderLinks() {
  document.getElementById("viewTitle").textContent = "Liens utiles";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "links"));
  const favorites = state.links.filter(l => l.favorite && l.status !== "archivé").sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const items = linkFilteredItems();
  const categories = ["all", ...linkCategoryOptions()];
  const activeCategories = categories.filter(c => c === "all" || state.links.some(l => l.category === c));
  const grouped = activeCategories.filter(c => c !== "all").map(c => ({ category: c, count: state.links.filter(l => l.category === c).length }));
  appHtml(`<div class="card hero links-hero"><div class="row"><div><h2>🔗 Liens utiles</h2><p class="muted">Lanceur visuel des ressources professionnelles du quotidien.</p></div><button class="action" onclick="newLink()">+ Nouveau lien</button></div></div>${linkEditId !== "" ? linkForm(linkEditId ? byId("links", linkEditId) : {}) : ""}<div class="links-layout"><aside class="card link-categories"><button class="secondary ${linkCategoryFilter === "all" && !linkFavoriteFilter ? "active-filter" : ""}" onclick="setLinkCategoryFilter('all')">Tous les liens</button><button class="secondary ${linkFavoriteFilter ? "active-filter" : ""}" onclick="toggleLinkFavoriteFilter()">⭐ Favoris</button>${grouped.map(g => `<button class="secondary ${linkCategoryFilter === g.category ? "active-filter" : ""}" onclick="setLinkCategoryFilter('${esc(g.category)}')"><span>${linkCategoryIcon(g.category)}</span>${esc(g.category)} <small>${g.count}</small></button>`).join("")}</aside><section><div class="card link-toolbar"><input value="${esc(linkSearch)}" placeholder="Rechercher un lien, une catégorie ou un domaine" oninput="setLinkSearch(this.value)"><select onchange="setLinkCategoryFilter(this.value)">${categories.map(c => `<option value="${esc(c)}" ${linkCategoryFilter === c ? "selected" : ""}>${c === "all" ? "Toutes catégories" : esc(c)}</option>`).join("")}</select><button class="secondary ${linkFavoriteFilter ? "active-filter" : ""}" onclick="toggleLinkFavoriteFilter()">Favoris</button></div><div class="card links-favorites"><div class="row"><h2>Favoris</h2><span class="muted">${favorites.length} lien(s)</span></div><div class="links-grid links-grid-compact">${favorites.map(linkCard).join("") || `<div class="empty">Aucun favori — ajoutez-en avec l'étoile sur une tuile.</div>`}</div></div><div class="card links-results-head"><div><h2>Catalogue</h2><p class="muted">${items.length} ressource(s) affichée(s)</p></div></div><div id="linkResults" class="links-grid">${items.map(linkCard).join("") || `<div class="card empty">Aucun lien ne correspond aux filtres.<br><button class="secondary" onclick="newLink()">+ Ajouter mon premier lien</button></div>`}</div></section></div>`);
}

function newLink() {
  linkEditId = null;
  renderLinks();
}

function editLink(id) {
  linkEditId = id;
  renderLinks();
}

function cancelLinkEdit() {
  linkEditId = "";
  renderLinks();
}

function readLinkForm(existing = {}) {
  const name = document.getElementById("lnName").value.trim();
  const url = document.getElementById("lnUrl").value.trim();
  if (!name || !url) return null;
  const normalizedUrl = linkUrl(url);
  if (!normalizedUrl) {
    alert("URL non valide ou protocole non autorisé. Utilisez https:// ou http:// pour un outil interne.");
    return null;
  }
  const category = document.getElementById("lnCategory").value.trim() || "Autre";
  return { ...existing, name, url: normalizedUrl, category, description: document.getElementById("lnDescription").value.trim(), status: document.getElementById("lnStatus").value, favorite: document.getElementById("lnFavorite").checked, icon: document.getElementById("lnIcon").value.trim() || suggestLinkIcon(`${name} ${url} ${category}`), updatedAt: isoToday() };
}

function addLink() {
  const link = readLinkForm({ id: newId("link"), order: Date.now(), createdAt: isoToday() });
  if (!link) return;
  state.links.push(normalizeEntity("links", link));
  persist("links");
  addActivity("🔗 Lien utile", link.name, link.url, link.id);
  linkEditId = "";
  renderLinks();
}

function saveLink(id) {
  const i = indexById("links", id);
  if (i < 0) return;
  const link = readLinkForm(state.links[i]);
  if (!link) return;
  state.links[i] = normalizeEntity("links", link);
  persist("links");
  addActivity("🔗 Lien modifié", state.links[i].name, state.links[i].url, id);
  linkEditId = "";
  renderLinks();
}

function deleteLink(id) {
  const i = indexById("links", id);
  if (i < 0 || !confirm("Supprimer ce lien ?")) return;
  const title = state.links[i].name;
  state.links.splice(i, 1);
  persist("links");
  addActivity("🗑️ Lien supprimé", title);
  renderLinks();
}

function archiveLink(id) {
  const link = byId("links", id);
  if (!link) return;
  link.status = link.status === "archivé" ? "actif" : "archivé";
  persist("links");
  addActivity("🗄️ Lien archivé", link.name, link.status, id);
  renderLinks();
}

function toggleLinkFavorite(id) {
  const link = byId("links", id);
  if (!link) return;
  link.favorite = !link.favorite;
  persist("links");
  addActivity("⭐ Favori", link.name, link.favorite ? "Ajouté aux favoris" : "Retiré des favoris", id);
  renderLinks();
}

function moveLink(id, delta) {
  const ordered = state.links.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const index = ordered.findIndex(l => l.id === id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= ordered.length) return;
  [ordered[index].order, ordered[next].order] = [ordered[next].order, ordered[index].order];
  persist("links");
  renderLinks();
}

function setLinkCategoryFilter(value) {
  linkCategoryFilter = value;
  linkFavoriteFilter = false;
  renderLinks();
}

function toggleLinkFavoriteFilter() {
  linkFavoriteFilter = !linkFavoriteFilter;
  renderLinks();
}

function setLinkSearch(value) {
  linkSearch = value;
  const root = document.getElementById("linkResults");
  if (!root) return renderLinks();
  const items = linkFilteredItems();
  root.innerHTML = items.map(linkCard).join("") || `<div class="card empty">Aucun lien ne correspond aux filtres.</div>`;
}

function suggestLinkIconField() {
  const input = document.getElementById("lnIcon");
  if (!input) return;
  input.value = suggestLinkIcon(`${document.getElementById("lnName")?.value || ""} ${document.getElementById("lnUrl")?.value || ""}`);
}

function openExternalLink(id) {
  const link = byId("links", id);
  if (!link || !link.url) return;
  window.open(linkUrl(link.url), "_blank", "noopener,noreferrer");
}

function openLink(id) {
  linkEditId = "";
  linkCategoryFilter = "all";
  linkFavoriteFilter = false;
  const link = byId("links", id);
  linkSearch = link ? link.name : "";
  renderLinks();
}

function getDefaultCalendarConnectionSettings() {
  return {
    provider: "none",
    accountEmail: "",
    googleClientId: "",       // Client ID OAuth public Google Cloud Console
    calendarName: "",
    googleCalendarId: "",     // ID Google du calendrier sélectionné
    googleCalendarName: "",   // Nom affiché du calendrier sélectionné
    syncDirection: "import",
    showInAgenda: true,
    showTodayInCockpit: true,
    maskPrivateEvents: false,
    syncFrequency: "manual",
    connectionStatus: "not_configured",
    lastSyncAt: null,
    nextSyncAt: null
  };
}

function ensureSettings(raw = {}) {
  return state.settings = {
    ...raw,
    calendarConnection: {
      ...getDefaultCalendarConnectionSettings(),
      ...(raw.calendarConnection || {})
    }
  };
}

function getCalendarConnectionSettings() {
  return (state.settings && state.settings.calendarConnection) ? state.settings.calendarConnection : getDefaultCalendarConnectionSettings();
}

function persistSettings() {
  localStorage.setItem("deos_settings", JSON.stringify(state.settings));
}

function settingsCalendarConnectionCard() {
  const settings = getCalendarConnectionSettings();
  const status = settings.connectionStatus || (settings.provider === "google" ? "connection_required" : "not_configured");
  const visibleStatus = status === "connected" ? "connection_required" : status;
  const statusClass = visibleStatus === "connection_required" ? "orange" : "red";
  const statusLabel = {
    not_configured: "Non configuré",
    connection_required: "Connexion requise",
    connection_error: "Erreur de connexion"
  }[visibleStatus] || "Non configuré";
  return `<div class="card settings-card settings-calendar-card"><div class="settings-card-heading"><h2>Agenda et connexions externes</h2><p class="muted">Configurez le calendrier professionnel qui pourra être synchronisé avec DEOS.</p><div class="settings-info-box">Aucun accès à votre compte Google n’est réalisé dans cette version.</div></div><div class="settings-card-grid"><section class="settings-card-block"><h3>Connexion</h3><div class="settings-card-control"><label for="ccProvider">Fournisseur de calendrier</label><select id="ccProvider"><option value="none"${settings.provider !== "google" ? " selected" : ""}>Aucun</option><option value="google"${settings.provider === "google" ? " selected" : ""}>Google Calendar</option></select></div><div class="settings-card-control"><label for="ccAccountEmail">Adresse e-mail du compte professionnel</label><input id="ccAccountEmail" type="email" value="${esc(settings.accountEmail)}" placeholder="adresse@exemple.com"></div><div class="settings-card-control"><label for="ccCalendarName">Nom du calendrier à synchroniser</label><input id="ccCalendarName" value="${esc(settings.calendarName)}" placeholder="Par exemple : Agenda pro"></div></section><section class="settings-card-block"><h3>Synchronisation</h3><div class="settings-card-grid-2col"><div class="settings-card-control"><label for="ccSyncDirection">Sens de synchronisation</label><select id="ccSyncDirection"><option value="import"${settings.syncDirection === "import" ? " selected" : ""}>Importer uniquement vers DEOS</option><option value="two-way"${settings.syncDirection === "two-way" ? " selected" : ""}>Synchronisation bidirectionnelle</option></select></div><div class="settings-card-control"><label for="ccSyncFrequency">Fréquence de synchronisation</label><select id="ccSyncFrequency"><option value="manual"${settings.syncFrequency === "manual" ? " selected" : ""}>Synchronisation manuelle</option><option value="hourly"${settings.syncFrequency === "hourly" ? " selected" : ""}>Toutes les heures</option><option value="daily"${settings.syncFrequency === "daily" ? " selected" : ""}>Quotidien</option></select></div></div><p class="muted settings-help-text">Cette option sera utilisée lorsque la synchronisation automatique sera activée.</p></section><section class="settings-card-block"><h3>Affichage dans DEOS</h3><div class="settings-card-check"><label><input id="ccShowInAgenda" type="checkbox"${settings.showInAgenda ? " checked" : ""}><span>Afficher les événements externes dans la page Agenda</span></label></div><div class="settings-card-check"><label><input id="ccShowTodayInCockpit" type="checkbox"${settings.showTodayInCockpit ? " checked" : ""}><span>Afficher les rendez-vous du jour dans le Cockpit</span></label></div><div class="settings-card-check"><label><input id="ccMaskPrivateEvents" type="checkbox"${settings.maskPrivateEvents ? " checked" : ""}><span>Importer les événements privés en masquant leur contenu</span></label></div></section><section class="settings-card-block settings-calendar-status"><h3>État et informations</h3><div class="settings-calendar-badge-row"><div><strong>État de la connexion</strong></div><div><span class="badge ${statusClass}">${esc(statusLabel)}</span></div></div><div class="settings-calendar-summary"><div class="settings-calendar-summary-item"><strong>Dernière synchronisation</strong><span>${esc(settings.lastSyncAt || "Jamais")}</span></div><div class="settings-calendar-summary-item"><strong>Prochain contrôle</strong><span>${esc(settings.nextSyncAt || "Non planifié")}</span></div></div></section></div><div class="row-actions settings-calendar-buttons"><button class="action" onclick="saveCalendarConnectionSettings()">Enregistrer la configuration</button><div class="settings-calendar-actions-right"><button class="secondary" onclick="prepareGoogleCalendarConnection()">Préparer la connexion Google</button><button class="secondary" onclick="resetCalendarConnectionSettings()">Réinitialiser</button></div></div><p class="muted settings-calendar-note">Ces réglages sont stockés localement. La synchronisation réelle sera déployée plus tard.</p></div>`;
}

// Ancienne version de settingsCalendarConnectionCard() supprimée (remplacée par version V5.6 ligne ~5891)

// Ancienne version de readCalendarConnectionSettingsForm() supprimée (remplacée par version V5.6 ligne ~6023)

function saveCalendarConnectionSettings() {
  console.log("[DEOS SYNC TRACE] saveCalendarConnectionSettings called");
  state.settings.calendarConnection = readCalendarConnectionSettingsForm();
  console.log("[DEOS SYNC TRACE] Saved settings - googleCalendarId:", state.settings.calendarConnection.googleCalendarId || "(empty)");
  console.log("[DEOS SYNC TRACE] Saved settings - syncFrequency:", state.settings.calendarConnection.syncFrequency);
  persistSettings();
  // V5.6 — Redémarrer auto-sync si configuration changée
  const newSettings = getCalendarConnectionSettings();
  if (googleConnectionStatus === "connected" && newSettings.googleCalendarId) {
    restartGoogleCalendarAutoSync();
  }
  renderSettings("Configuration Agenda enregistrée.");
}

function resetCalendarConnectionSettings() {
  if (!confirm("Réinitialiser uniquement les réglages Agenda et connexions externes ? Les rendez-vous et autres données DEOS resteront inchangés.")) return;
  state.settings.calendarConnection = getDefaultCalendarConnectionSettings();
  persistSettings();
  renderSettings("Réglages Agenda réinitialisés.");
}

function prepareGoogleCalendarConnection() {
  alert("La connexion sécurisée à Google Calendar sera activée dans une prochaine version. Votre configuration est enregistrée, mais aucun accès à votre compte Google n’a encore été accordé.");
}

function settingsPreviewHtml(data = identity) {
  const logo = data.logoType === "image" && data.logoImage
    ? `<span class="settings-logo settings-logo-image" style="background-image:url('${esc(data.logoImage)}')"></span>`
    : `<span class="settings-logo">${esc(data.logoText || data.appName?.slice(0, 1) || "D")}</span>`;
  const org = data.organizationName ? `<span>${esc(data.organizationName)}</span>` : "";
  return `<div class="settings-preview">${logo}<div><strong>${esc(data.appName || "DEOS")}</strong><span>${esc(data.siteName || "")}</span>${org}<small>${esc(data.directorName || "")}${data.directorRole ? " · " + esc(data.directorRole) : ""}</small></div></div>`;
}

function renderSettings(message = "") {
  document.getElementById("viewTitle").textContent = "Paramètres";
  document.querySelectorAll(".nav").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "settings"));
  const statusMessage = message || restoreSuccessMessage;
  restoreSuccessMessage = "";
  appHtml(`<div class="card hero settings-hero"><h2>⚙️ Paramètres généraux</h2><p class="muted">Personnalisez uniquement l'identité de l'application. Les données métier restent intactes.</p></div><div class="grid two"><div class="card settings-card"><h2>Identité</h2><div class="form-grid"><input id="setAppName" value="${esc(identity.appName)}" placeholder="Nom de l'application" oninput="updateSettingsPreview()"><input id="setAppVersion" value="${esc(identity.appVersion)}" placeholder="Version" oninput="updateSettingsPreview()"><input id="setSiteName" value="${esc(identity.siteName)}" placeholder="Nom du site" oninput="updateSettingsPreview()"><input id="setDirectorName" value="${esc(identity.directorName)}" placeholder="Nom du directeur" oninput="updateSettingsPreview()"><input id="setDirectorRole" value="${esc(identity.directorRole)}" placeholder="Fonction" oninput="updateSettingsPreview()"><input id="setOrganizationName" value="${esc(identity.organizationName)}" placeholder="Organisation / entreprise" oninput="updateSettingsPreview()"><select id="setLogoType" onchange="updateSettingsPreview()"><option value="monogram" ${identity.logoType !== "image" ? "selected" : ""}>Monogramme</option><option value="image" ${identity.logoType === "image" ? "selected" : ""}>Image</option></select><input id="setLogoText" value="${esc(identity.logoText)}" placeholder="Lettre ou initiales" oninput="updateSettingsPreview()"><input id="setLogoImage" class="full" value="${esc(identity.logoImage)}" placeholder="URL d'image optionnelle" oninput="updateSettingsPreview()"></div><div class="row-actions"><button class="action" onclick="saveSettings()">Enregistrer les paramètres</button><button class="secondary" onclick="resetIdentitySettings()">Rétablir les valeurs actuelles</button></div>${statusMessage ? `<p class="settings-confirm">${esc(statusMessage)}</p>` : ""}</div><div class="card settings-card"><h2>Aperçu</h2><div id="settingsPreview">${settingsPreviewHtml(identity)}</div><p class="muted">Cet aperçu correspond aux zones d'identité : barre latérale, titre, Brief du jour, signatures de comptes rendus et valeurs par défaut des créations futures.</p></div></div>${settingsCalendarConnectionCard()}<div class="card settings-card"><h2>Sauvegarde et restauration</h2><p class="muted">Les données DEOS sont enregistrées dans ce navigateur. Exportez régulièrement une sauvegarde afin de pouvoir les restaurer sur cet appareil ou sur un autre ordinateur.</p><div class="row-actions"><button id="backupExportBtn" class="action" onclick="exportBackup()">Exporter toutes les données</button><button id="backupImportBtn" class="secondary" onclick="triggerBackupImport()">Importer une sauvegarde</button><input id="backupFileInput" type="file" accept=".json,application/json" style="display:none" onchange="onBackupFileInputChange(event)"></div><div class="form-grid"><div class="item"><strong>Date dernière exportation</strong><span class="muted">${esc(getBackupMetadata().lastExport)}</span></div><div class="item"><strong>Date dernière restauration</strong><span class="muted">${esc(getBackupMetadata().lastRestore)}</span></div><div class="item"><strong>Catégories métier actuellement présentes</strong><span class="muted">${esc(String(currentLocalStorageCategoryCount()))}</span></div></div>${backupPreviewOpen ? renderBackupPreviewCard({ date: backupPreviewPayload.date, categoryCount: backupPreviewSummary.categoryCount, counts: backupPreviewSummary.counts }) : ""}${backupPreviewOpen ? `<div class="row-actions"><button class="action" onclick="confirmRestoreBackup()">Confirmer la restauration</button><button class="secondary" onclick="closeBackupPreview()">Annuler</button></div>` : ""}</div><div class="card settings-card"><h2>Ce qui n'est pas modifié</h2><p class="muted">Les dossiers, projets, managers, décisions, actions, documents, journal, KPI, imports, liens utiles et historiques ne sont pas modifiés par ces paramètres.</p></div>`);
}

function readSettingsForm() {
  return normalizeIdentity({
    ...identity,
    appName: document.getElementById("setAppName")?.value,
    appVersion: document.getElementById("setAppVersion")?.value,
    siteName: document.getElementById("setSiteName")?.value,
    directorName: document.getElementById("setDirectorName")?.value,
    directorRole: document.getElementById("setDirectorRole")?.value,
    organizationName: document.getElementById("setOrganizationName")?.value,
    logoType: document.getElementById("setLogoType")?.value,
    logoText: document.getElementById("setLogoText")?.value,
    logoImage: document.getElementById("setLogoImage")?.value,
    updatedAt: isoToday()
  });
}

function updateSettingsPreview() {
  const preview = document.getElementById("settingsPreview");
  if (preview) preview.innerHTML = settingsPreviewHtml(readSettingsForm());
}

function saveSettings() {
  identity = readSettingsForm();
  persistIdentity();
  applyIdentity();
  renderSettings("Paramètres enregistrés.");
}

function resetIdentitySettings() {
  if (!confirm("Rétablir uniquement les paramètres d'identité actuels ? Les données métier ne seront pas modifiées.")) return;
  identity = normalizeIdentity(identityDefaults);
  persistIdentity();
  applyIdentity();
  renderSettings("Valeurs actuelles rétablies.");
}

function activityItem(a) {
  return `<div class="item"><strong>${esc(a.type)} · ${esc(a.title)}</strong><span class="muted">${esc(a.date || "")}${a.detail ? " · " + esc(a.detail) : ""}</span><span class="meta">ID ${esc(a.id)}${a.entityId ? " ? Entité " + esc(a.entityId) : ""}${esc(activityDeletedFolderHint(a))}</span></div>`;
}

function renderActivity() {
  appHtml(`<div class="card hero"><h2>Agenda / Réunions</h2><p class="muted">Trace chronologique des créations, modifications et suppressions.</p></div>${state.activity.map(activityItem).join("") || `<div class="card empty">Aucune activité.</div>`}`);
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
    const folders = state.folders.filter(f => ensureArray(item.linkedFolders).includes(f.id) || itemLinkedToFolder(item, f)).map(f => `${f.name} ${f.category} ${(f.tags || []).join(" ")}`).join(" ");
    return `${managers} ${owner} ${projects} ${actions} ${decisions} ${documents} ${folders}`;
  };
  const results = entities.flatMap(name => state[name].map(item => {
    const agenda = name === "meetingPreparations" ? byId("agenda", item.agendaId) : null;
    const performanceImportTitle = name === "performance_imports" ? `Import Performance · ${item.sourceFile || item.sourceType || item.id}` : "";
    return {
      entity: name,
      id: item.id,
      title: agenda ? `Préparation · ${agenda.title}` : performanceImportTitle || item.title || item.name || item.type || item.id,
      text: `${JSON.stringify(item)} ${agenda ? JSON.stringify(agenda) : ""} ${relationText(item)}`
    };
  })).filter(x => `${x.title} ${x.text}`.toLowerCase().includes(q));
  document.getElementById("viewTitle").textContent = "Recherche";
  appHtml(`<div class="card"><h2>${results.length} résultat(s)</h2>${results.map(r => `<div class="item clickable" onclick="openCockpitEntity('${esc(r.entity)}','${esc(r.id)}')"><strong>${esc(r.title)}</strong><span class="muted">${esc(r.entity)} · ID ${esc(r.id)}</span></div>`).join("") || `<div class="empty">Aucun résultat.</div>`}</div>`);
}

function listItems(items, prefix = "") {
  return (items || []).map(x => `<div class="item">${prefix}${esc(x)}</div>`).join("") || `<div class="empty">À compléter</div>`;
}

// -------------------------------------------------------------------------------
// DEOS V5.5 — Google Calendar Integration (OAuth 2.0, lecture seule)
// -------------------------------------------------------------------------------
// Bibliothèque : Google Identity Services (https://accounts.google.com/gsi/client)
// Méthode OAuth : initTokenClient (Token Request / Implicit-like Grant)
//   ? Aucun client secret requis côté navigateur
//   ? Aucun redirect URI nécessaire
// Scopes demandés (2 scopes combinés) :
//   1. https://www.googleapis.com/auth/calendar.readonly — lecture seule aux événements
//   2. https://www.googleapis.com/auth/calendar.calendarlist.readonly — lecture seule à la liste des calendriers
// Stockage du token : sessionStorage uniquement (deos_gc_token)
//   ? Jamais localStorage, jamais hardcodé dans le code source
//   ? Token effacé à la fermeture du navigateur
// Client ID : configuré par l'utilisateur dans Paramètres > Agenda
//   ? Valeur publique, stockée dans deos_settings (localStorage)
//   ? JAMAIS de Client Secret dans DEOS
// Configuration Google Cloud Console requise :
//   1. Créer un projet Google Cloud
//   2. Activer Google Calendar API
//   3. Créer un identifiant OAuth — Type : Application Web
//   4. Ajouter aux origines JavaScript autorisées :
//      http://127.0.0.1:5500  (développement local VS Code Live Server)
//      http://localhost:5500  (développement local alternatif)
//      https://[votre-domaine]  (production GitHub Pages)
//   5. NE PAS configurer d'URI de redirection (non requis avec initTokenClient)
// -------------------------------------------------------------------------------

function getGoogleOAuthClientId() {
  return (getCalendarConnectionSettings().googleClientId || "").trim();
}

function setGoogleAccessToken(token) {
  googleAccessToken = token || null;
  if (token) {
    sessionStorage.setItem("deos_gc_token", token);
  } else {
    sessionStorage.removeItem("deos_gc_token");
    sessionStorage.removeItem("deos_gc_email");
    googleConnectedEmail = "";
  }
}

function getGoogleAccessToken() {
  if (googleAccessToken) return googleAccessToken;
  const stored = sessionStorage.getItem("deos_gc_token");
  if (stored) {
    googleAccessToken = stored;
    return stored;
  }
  return null;
}

function updateGoogleConnectionStatus(status, email) {
  googleConnectionStatus = status;
  if (email !== undefined) googleConnectedEmail = email;
  if (state.settings && state.settings.calendarConnection) {
    state.settings.calendarConnection.connectionStatus = status;
  }
}

async function fetchGoogleUserInfo() {
  const token = getGoogleAccessToken();
  if (!token) return;
  try {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      googleConnectedEmail = data.email || "";
      if (googleConnectedEmail) sessionStorage.setItem("deos_gc_email", googleConnectedEmail);
    }
  } catch (e) {
    console.error("[DEOS] fetchGoogleUserInfo:", e);
  }
}

function connectGoogleCalendar() {
  const clientId = getGoogleOAuthClientId();
  if (!clientId) {
    renderSettings("Veuillez d'abord saisir et enregistrer votre Client ID Google OAuth dans le champ ci-dessus.");
    return;
  }
  if (typeof google === "undefined" || !google?.accounts?.oauth2) {
    renderSettings("La bibliotheque Google Identity Services n'est pas disponible. Verifiez votre connexion internet et rechargez la page.");
    return;
  }
  updateGoogleConnectionStatus("connecting");
  renderSettings("Connexion Google en cours...");
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("[DEOS] Google OAuth error:", tokenResponse.error, tokenResponse.error_description);
        setGoogleAccessToken(null);
        updateGoogleConnectionStatus("connection_error");
        renderSettings("Erreur Google : " + (tokenResponse.error_description || tokenResponse.error));
        return;
      }
      setGoogleAccessToken(tokenResponse.access_token);
      updateGoogleConnectionStatus("connected");
      await fetchGoogleUserInfo();
      await fetchGoogleCalendars();
      state.settings.calendarConnection.provider = "google";
      persistSettings();
      // V5.6 — Redémarrer auto-sync si configurée
      const settings = getCalendarConnectionSettings();
      if (settings.googleCalendarId && settings.syncFrequency !== "manual") {
        googleLastSyncAt = null;
        googleNextSyncAt = null;
        scheduleNextGoogleSync();
        restartGoogleCalendarAutoSync();
      }
      renderSettings("Connexion Google réussie !");
    }
  });
  tokenClient.requestAccessToken({ prompt: "" });
}

function disconnectGoogleCalendar() {
  if (!confirm("Déconnecter Google Calendar ? Les événements déjà importés seront supprimés de DEOS.")) return;
  // V5.6 — Arrêter auto-sync
  stopGoogleCalendarAutoSync();
  const token = getGoogleAccessToken();
  if (token && typeof google !== "undefined" && google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(token, () => {}); } catch (e) { /* ignore */ }
  }
  setGoogleAccessToken(null);
  googleConnectedEmail = "";
  googleAvailableCalendars = [];
  googleLastSyncAt = null;
  googleNextSyncAt = null;
  updateGoogleConnectionStatus("not_configured");
  state.externalCalendarEvents = [];
  localStorage.removeItem("deos_external_events");
  if (state.settings && state.settings.calendarConnection) {
    state.settings.calendarConnection.googleCalendarId = "";
    state.settings.calendarConnection.googleCalendarName = "";
    state.settings.calendarConnection.connectionStatus = "not_configured";
    state.settings.calendarConnection.lastSyncAt = null;
  }
  persistSettings();
  renderSettings("Déconnecté de Google Calendar. Données externes supprimées.");
}

async function fetchGoogleCalendars() {
  const token = getGoogleAccessToken();
  if (!token) { updateGoogleConnectionStatus("connection_required"); return []; }
  try {
    const resp = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (resp.status === 401) {
      handleGoogleTokenExpired();
      return [];
    }
    if (!resp.ok) {
      console.error("[DEOS] fetchGoogleCalendars HTTP", resp.status);
      updateGoogleConnectionStatus("connection_error");
      return [];
    }
    const data = await resp.json();
    googleAvailableCalendars = (data.items || []).map(c => ({
      id: c.id,
      name: c.summary || c.id,
      primary: c.primary || false,
      accessRole: c.accessRole
    }));
    return googleAvailableCalendars;
  } catch (e) {
    console.error("[DEOS] fetchGoogleCalendars:", e);
    updateGoogleConnectionStatus("connection_error");
    return [];
  }
}

async function renderGoogleCalendarsList() {
  renderSettings("Chargement des calendriers...");
  try {
    const result = await fetchGoogleCalendars();
    if (result && result.length > 0) {
      renderSettings(`${result.length} calendrier(s) charge(s). Selectionnez celui a synchroniser.`);
    } else if (googleConnectionStatus === "session_expired") {
      renderSettings("Session Google expiree. Cliquez sur Reconnecter Google Calendar.");
    } else if (googleConnectionStatus === "connection_error") {
      renderSettings("Erreur lors du chargement des calendriers. Consultez la console pour details.");
    } else {
      renderSettings("Aucun calendrier accessible avec votre compte Google.");
    }
  } catch (e) {
    console.error("[DEOS] Erreur inattendue lors du chargement des calendriers:", e);
    renderSettings("Erreur inattendue. Consultez la console.");
  }
}

function isGoogleEventPrivate(gcEvent) {
  return gcEvent.visibility === "private" || gcEvent.visibility === "confidential";
}

function normalizeGoogleCalendarEvent(gcEvent, calendarId, calendarName) {
  const allDay = !gcEvent.start?.dateTime;
  const startRaw = gcEvent.start?.dateTime || gcEvent.start?.date || "";
  const endRaw = gcEvent.end?.dateTime || gcEvent.end?.date || "";
  const priv = isGoogleEventPrivate(gcEvent);
  const settings = getCalendarConnectionSettings();
  if (priv && !settings.maskPrivateEvents) return null;
  const title = priv && settings.maskPrivateEvents ? "Prive" : (gcEvent.summary || "Sans titre");
  const description = priv && settings.maskPrivateEvents ? "" : (gcEvent.description || "");
  // [DEOS AGENDA TRACE] Generate deduplication key
  const deduplicationKey = `google_${gcEvent.id}`;
  
  // [DEOS V5.6.5] DIAGNOSTIC: date conversion
  let localDate;
  if (allDay) {
    // For all-day events, start.date is already in YYYY-MM-DD format
    localDate = startRaw;
  } else {
    // For timed events, convert ISO string to local date
    try {
      const dateObj = new Date(startRaw);
      localDate = dateObj.toISOString().slice(0, 10);  // ISO format date, which is UTC
      // Better: use local timezone conversion
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      localDate = `${year}-${month}-${day}`;
    } catch (e) {
      localDate = startRaw.slice(0, 10);
    }
  }
  
  return {
    _key: deduplicationKey,           // Clé de déduplication pour reconciliation
    _calendarId: calendarId,          // ID du calendrier source (pour filtres)
    _external: true,                  // Marqueur d'événement externe
    externalId: gcEvent.id,
    provider: "google",
    id: `gc_${gcEvent.id}`,
    title,
    date: localDate,
    startTime: allDay ? "" : startRaw.slice(11, 16),
    endTime: allDay ? "" : endRaw.slice(11, 16),
    allDay,
    location: gcEvent.location || "",
    description,
    status: gcEvent.status || "confirmed",
    isPrivate: priv,
    calendarId,
    calendarName,
    importedAt: new Date().toISOString()
  };
}

async function fetchGoogleCalendarEvents() {
  const token = getGoogleAccessToken();
  if (!token) { updateGoogleConnectionStatus("connection_required"); return []; }
  const settings = getCalendarConnectionSettings();
  const calendarId = settings.googleCalendarId;
  if (!calendarId) { console.warn("[DEOS] Aucun calendrier selectionne."); return []; }
  const now = new Date();
  const past = new Date(now); past.setDate(past.getDate() - GOOGLE_SYNC_PAST_DAYS);
  const future = new Date(now); future.setDate(future.getDate() + GOOGLE_SYNC_FUTURE_DAYS);
  const params = new URLSearchParams({
    timeMin: past.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500"
  });
  try {
    const resp = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );
    if (resp.status === 401) {
      setGoogleAccessToken(null);
      updateGoogleConnectionStatus("session_expired");
      return [];
    }
    if (!resp.ok) {
      console.error("[DEOS] fetchGoogleCalendarEvents HTTP", resp.status);
      updateGoogleConnectionStatus("connection_error");
      return [];
    }
    const data = await resp.json();
    const items = (data.items || []).filter(e => e.status !== "cancelled");
    // [DEOS V5.6.5] DIAGNOSTIC: raw events sample
    if (items.length > 0) {
      const sample = items.slice(0, 20).map(e => ({
        externalId: e.id,
        summary: e.summary,
        'start.dateTime': e.start?.dateTime,
        'start.date': e.start?.date,
        'end.dateTime': e.end?.dateTime,
        'end.date': e.end?.date,
        status: e.status
      }));
      console.log("[DEOS GOOGLE RAW SAMPLE] fetched items:", items.length);
      console.table(sample);
    }
    return items;
  } catch (e) {
    console.error("[DEOS] fetchGoogleCalendarEvents:", e);
    updateGoogleConnectionStatus("connection_error");
    return [];
  }
}

async function syncGoogleCalendarNow() {
  console.log("[DEOS SYNC TRACE] syncGoogleCalendarNow entered");
  console.log("[DEOS SYNC TRACE] lock state - googleSyncInProgress:", googleSyncInProgress);
  if (googleSyncInProgress) {
    console.warn("[DEOS SYNC TRACE] ? EXIT: Sync already in progress");
    return;
  }
  const token = getGoogleAccessToken();
  console.log("[DEOS SYNC TRACE] token present:", !!token);
  if (!token) {
    console.warn("[DEOS SYNC TRACE] ? EXIT: No token");
    renderSettings("Session Google expirée, reconnectez-vous pour continuer.");
    return;
  }
  const settings = getCalendarConnectionSettings();
  console.log("[DEOS SYNC TRACE] calendarId present:", !!settings.googleCalendarId);
  console.log("[DEOS SYNC TRACE] calendarId value:", settings.googleCalendarId || "(empty)");
  if (!settings.googleCalendarId) {
    console.warn("[DEOS SYNC TRACE] ? EXIT: No calendar selected");
    renderSettings("Veuillez sélectionner un calendrier dans la liste avant de synchroniser.");
    return;
  }
  console.log("[DEOS SYNC TRACE] ? All pre-checks passed, proceeding with sync");
  googleSyncInProgress = true;
  renderSettings("Synchronisation en cours...");
  try {
    const beforeKeys = Object.keys(state.externalEventEnrichments || {});
    const beforeManagers = beforeKeys.map(k => ({ key: k, linkedManagerIds: normalizeLinkedManagerIds(ensureArray(state.externalEventEnrichments[k]?.linkedManagerIds || [])) }));
    console.log("[DEOS MANAGER DEBUG] google sync before enrichments", beforeManagers);
    console.log("[DEOS SYNC TRACE] Fetching events from Google Calendar...");
    const rawEvents = await fetchGoogleCalendarEvents();
    console.log("[DEOS SYNC TRACE] Fetched", rawEvents.length, "raw events");
    // Vérifier si le token a expiré durant la récupération
    if (googleConnectionStatus === "session_expired") {
      googleSyncInProgress = false;
      console.error("[DEOS SYNC TRACE] ? Token expired during fetch");
      handleGoogleTokenExpired();
      return;
    }
    if (googleConnectionStatus === "connection_error") {
      googleSyncInProgress = false;
      console.error("[DEOS SYNC TRACE] ? Network error during fetch");
      renderSettings("Erreur réseau lors de la synchronisation. Vérifiez votre connexion.");
      return;
    }
    const calId = settings.googleCalendarId;
    const calName = settings.googleCalendarName || "";
    const newEvents = rawEvents.map(e => normalizeGoogleCalendarEvent(e, calId, calName)).filter(Boolean);
    console.log("[DEOS SYNC TRACE] Normalized", newEvents.length, "events");
    // [DEOS V5.6.5] DIAGNOSTIC: normalized events sample
    if (newEvents.length > 0) {
      const sample = newEvents.slice(0, 20).map(e => ({
        externalId: e.externalId,
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: e.allDay,
        _key: e._key,
        _calendarId: e._calendarId,
        _external: e._external
      }));
      console.log("[DEOS GOOGLE NORMALIZED SAMPLE] normalized events:", newEvents.length);
      console.table(sample);
    }
    // [DEOS V5.6.5] DIAGNOSTIC: date types analysis
    const timedEvents = rawEvents.filter(e => !!e.start?.dateTime);
    const allDayEvents = rawEvents.filter(e => !!e.start?.date && !e.start?.dateTime);
    console.log("[DEOS DATE ANALYSIS] timed events:", timedEvents.length);
    console.log("[DEOS DATE ANALYSIS] all-day events:", allDayEvents.length);
    if (timedEvents.length > 0) {
      const timedSample = timedEvents.slice(0, 5).map(e => ({
        id: e.id,
        summary: e.summary,
        'start.dateTime': e.start?.dateTime,
        'end.dateTime': e.end?.dateTime
      }));
      console.log("[DEOS DATE ANALYSIS] Timed events sample (first 5):");
      console.table(timedSample);
    }
    if (allDayEvents.length > 0) {
      const allDaySample = allDayEvents.slice(0, 5).map(e => ({
        id: e.id,
        summary: e.summary,
        'start.date': e.start?.date,
        'end.date': e.end?.date
      }));
      console.log("[DEOS DATE ANALYSIS] All-day events sample (first 5):");
      console.table(allDaySample);
    }
    // Log sample event structure
    if (newEvents.length > 0) {
      console.log("[DEOS AGENDA TRACE] Sample normalized event keys:", Object.keys(newEvents[0]));
      console.log("[DEOS AGENDA TRACE] Sample event _key:", newEvents[0]._key);
      console.log("[DEOS AGENDA TRACE] Sample event _calendarId:", newEvents[0]._calendarId);
      console.log("[DEOS AGENDA TRACE] Sample event date:", newEvents[0].date);
      console.log("[DEOS AGENDA TRACE] Sample event title:", newEvents[0].title);
    }
    // V5.6 — Réconciliation : ajouter/mettre à jour/supprimer
    const reconciliation = reconcileGoogleCalendarEvents(newEvents);
    console.log("[DEOS SYNC TRACE] Reconciliation complete: +", reconciliation.added, "~", reconciliation.updated, "-", reconciliation.removed);
    // [DEOS STATE TRACE] After reconciliation
    console.log("[DEOS STATE TRACE] after reconciliation:", state.externalCalendarEvents.length);
    // [DEOS V5.6.5] DIAGNOSTIC: storage statistics
    if (state.externalCalendarEvents.length > 0) {
      const dates = state.externalCalendarEvents.map(e => e.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const today = localIsoDate();
      const weekEnd = localIsoAddDays(7);
      const nextSevenDays = state.externalCalendarEvents.filter(e => e.date >= today && e.date <= weekEnd).length;
      const firstFive = state.externalCalendarEvents.slice(0, 5).map(e => ({
        date: e.date,
        title: e.title,
        _key: e._key
      }));
      console.log("[DEOS GOOGLE STORED] total:", state.externalCalendarEvents.length);
      console.log("[DEOS GOOGLE STORED] min date:", minDate);
      console.log("[DEOS GOOGLE STORED] max date:", maxDate);
      console.log("[DEOS GOOGLE STORED] today:", today);
      console.log("[DEOS GOOGLE STORED] next 7 days:", nextSevenDays);
      console.log("[DEOS GOOGLE STORED] first 5 events:");
      console.table(firstFive);
    }
    // [DEOS V5.6.5] DIAGNOSTIC: deduplication check
    const allKeys = state.externalCalendarEvents.map(e => e._key);
    const uniqueKeys = new Set(allKeys);
    const duplicateCount = allKeys.length - uniqueKeys.size;
    console.log("[DEOS DEDUP CHECK] total events:", state.externalCalendarEvents.length);
    console.log("[DEOS DEDUP CHECK] unique keys:", uniqueKeys.size);
    console.log("[DEOS DEDUP CHECK] duplicate keys:", duplicateCount);
    // [DEOS V5.6.5] DIAGNOSTIC: [DEOS AGENDA TRACE] After reconciliation
    console.log("[DEOS AGENDA TRACE] External events after reconciliation:", state.externalCalendarEvents.length);
    // Nettoyer les événements hors fenêtre de synchronisation (optionnel)
    removeMissingGoogleEventsInWindow();
    // Mettre à jour l'état de synchronisation
    googleLastSyncAt = Date.now();
    scheduleNextGoogleSync();
    state.settings.calendarConnection.lastSyncAt = googleLastSyncAt;
    state.settings.calendarConnection.lastSyncAtIso = new Date(googleLastSyncAt).toISOString();
    updateGoogleConnectionStatus("connected");
    persistSettings();
    persistExternalEvents();
    const afterKeys = Object.keys(state.externalEventEnrichments || {});
    const afterManagers = afterKeys.map(k => ({ key: k, linkedManagerIds: normalizeLinkedManagerIds(ensureArray(state.externalEventEnrichments[k]?.linkedManagerIds || [])) }));
    console.log("[DEOS MANAGER DEBUG] google sync after enrichments", afterManagers);
    // [DEOS STATE TRACE] After persistence
    console.log("[DEOS STATE TRACE] after persistence:", state.externalCalendarEvents.length);
    googleSyncInProgress = false;
    const msg = `Synchronisation réussie : ${reconciliation.added} ajoutés, ${reconciliation.updated} mis à jour, ${reconciliation.removed} supprimés.`;
    console.log("[DEOS SYNC TRACE] ? Sync completed successfully");
    console.log("[DEOS SYNC TRACE] Message:", msg);
    // [DEOS STATE TRACE] Before renderSettings
    console.log("[DEOS STATE TRACE] before renderSettings:", state.externalCalendarEvents.length);
    renderSettings(msg);
    updateGoogleSyncUi();
  } catch (e) {
    console.error("[DEOS SYNC TRACE] ? Sync failed with exception:", e);
    googleSyncInProgress = false;
    renderSettings("Erreur inattendue lors de la synchronisation. Consultez la console pour plus de détails.");
  }
}

// Fonction intermédiaire pour coordonner le clic du bouton "Synchroniser maintenant"
// Appelle saveCalendarConnectionSettings() puis syncGoogleCalendarNow() avec timing approprié
function onClickSyncGoogleNow() {
  console.log("[DEOS SYNC TRACE] Button onclick handler fired");
  saveCalendarConnectionSettings();
  // Appeler syncGoogleCalendarNow() après une micro-pause pour laisser renderSettings() se terminer
  setTimeout(() => {
    console.log("[DEOS SYNC TRACE] setTimeout callback - now calling syncGoogleCalendarNow()");
    syncGoogleCalendarNow().catch(e => console.error("[DEOS SYNC TRACE] Unhandled promise rejection:", e));
  }, 100);
}

function persistExternalEvents() {
  localStorage.setItem("deos_external_events", JSON.stringify(state.externalCalendarEvents || []));
  localStorage.setItem("deos_external_event_enrichments", JSON.stringify(state.externalEventEnrichments || {}));
}

function googleConnectionStatusLabel() {
  return ({
    not_configured: "Non configure",
    client_id_missing: "Client ID manquant",
    connection_required: "Connexion requise",
    connecting: "Connexion en cours...",
    connected: "Connecte",
    connection_error: "Erreur de connexion",
    session_expired: "Session expiree"
  })[googleConnectionStatus] || "Non configure";
}

function googleConnectionStatusClass() {
  if (googleConnectionStatus === "connected") return "green";
  if (googleConnectionStatus === "connecting") return "orange";
  if (["connection_error", "session_expired"].includes(googleConnectionStatus)) return "red";
  return "orange";
}

// -- Redefinition de settingsCalendarConnectionCard() pour V5.5 ---------------
function settingsCalendarConnectionCard() {
  const s = getCalendarConnectionSettings();
  const connected = googleConnectionStatus === "connected";
  const statusClass = googleConnectionStatusClass();
  const statusLabel = googleConnectionStatusLabel();
  // V5.6 — Utiliser updateGoogleSyncUi() pour l'état de sync
  const syncUi = updateGoogleSyncUi();
  const externalCount = (state.externalCalendarEvents || []).length;  // Total de tous les événements externes stockés

  // Liste des calendriers disponibles (apres authentification)
  const calendarOptions = googleAvailableCalendars.length > 0
    ? googleAvailableCalendars.map(c =>
        `<option value="${esc(c.id)}"${s.googleCalendarId === c.id ? " selected" : ""}>${esc(c.name)}${c.primary ? " (principal)" : ""}</option>`
      ).join("")
    : (s.googleCalendarId
        ? `<option value="${esc(s.googleCalendarId)}" selected>${esc(s.googleCalendarName || s.googleCalendarId)}</option>`
        : `<option value="">-- Connectez-vous d'abord --</option>`);

  return `<div class="card settings-card settings-calendar-card">
    <div class="settings-card-heading">
      <h2>Agenda et connexions externes</h2>
      <p class="muted">Connectez votre Google Calendar pour importer vos evenements dans DEOS.</p>
      <div class="settings-info-box">
        <strong>Configuration requise :</strong> Un Client ID Google OAuth est necessaire.
        Creez un projet dans <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>,
        activez l'API Google Calendar, puis creez un identifiant OAuth de type <em>Application Web</em>.
        Ajoutez <code>http://127.0.0.1:5500</code> dans les origines JavaScript autorisees.
        Ne partagez jamais de Client Secret dans DEOS.
      </div>
    </div>
    <div class="settings-card-grid">
      <section class="settings-card-block">
        <h3>Configuration Google OAuth</h3>
        <div class="settings-card-control">
          <label for="ccGoogleClientId">Google OAuth Client ID</label>
          <input id="ccGoogleClientId" value="${esc(s.googleClientId || "")}" placeholder="xxxxxxxxxx.apps.googleusercontent.com" style="font-family:monospace;font-size:13px">
          <small class="muted">Visible dans Google Cloud Console > Identifiants. Ne jamais saisir le Client Secret.</small>
        </div>
        <div class="settings-card-control" style="margin-top:12px">
          <label>Statut de connexion</label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px">
            <span class="badge ${statusClass}">${esc(statusLabel)}</span>
            ${connected && googleConnectedEmail ? `<span style="color:#475569;font-size:13px">Compte : ${esc(googleConnectedEmail)}</span>` : ""}
          </div>
        </div>
        <div class="row-actions" style="margin-top:12px">
          ${!connected
            ? `<button class="action" onclick="saveCalendarConnectionSettings();connectGoogleCalendar()">Connecter Google Calendar</button>`
            : `<button class="secondary" onclick="renderGoogleCalendarsList()">Actualiser les calendriers</button><button class="danger" onclick="disconnectGoogleCalendar()">Deconnecter Google</button>`
          }
        </div>
      </section>
      <section class="settings-card-block">
        <h3>Calendrier a synchroniser</h3>
        <div class="settings-card-control">
          <label for="ccGoogleCalendarId">Calendrier Google</label>
          <select id="ccGoogleCalendarId" ${!connected && googleAvailableCalendars.length === 0 ? "disabled" : ""}>
            ${calendarOptions}
          </select>
          <small class="muted">Selectionnez votre calendrier professionnel apres connexion.</small>
        </div>
        <div class="settings-card-control" style="margin-top:10px">
          <label for="ccSyncFrequency">Frequence de synchronisation</label>
          <select id="ccSyncFrequency">
            <option value="manual"${s.syncFrequency === "manual" ? " selected" : ""}>Synchronisation manuelle</option>
            <option value="15min"${s.syncFrequency === "15min" ? " selected" : ""}>Toutes les 15 minutes</option>
            <option value="hourly"${s.syncFrequency === "hourly" ? " selected" : ""}>Toutes les heures</option>
            <option value="daily"${s.syncFrequency === "daily" ? " selected" : ""}>Une fois par jour</option>
          </select>
        </div>
      </section>
      <section class="settings-card-block">
        <h3>Affichage dans DEOS</h3>
        <div class="settings-card-check">
          <label><input id="ccShowInAgenda" type="checkbox" ${s.showInAgenda ? "checked" : ""}> Afficher les evenements externes dans la page Agenda</label>
        </div>
        <div class="settings-card-check">
          <label><input id="ccShowTodayInCockpit" type="checkbox" ${s.showTodayInCockpit ? "checked" : ""}> Afficher les rendez-vous du jour dans le Cockpit</label>
        </div>
        <div class="settings-card-check">
          <label><input id="ccMaskPrivateEvents" type="checkbox" ${s.maskPrivateEvents ? "checked" : ""}> Importer les evenements prives en masquant leur contenu</label>
        </div>
      </section>
      <section class="settings-card-block">
        <h3>Etat et synchronisation</h3>
        <div class="settings-calendar-summary">
          <div class="settings-calendar-summary-item"><strong>Derniere synchro</strong><span>${esc(syncUi.lastSync)}</span></div>
          <div class="settings-calendar-summary-item"><strong>Prochaine synchro</strong><span>${esc(syncUi.nextSync)}</span></div>
          <div class="settings-calendar-summary-item"><strong>Evenements importes</strong><span>${externalCount}</span></div>
          <div class="settings-calendar-summary-item"><strong>Calendrier selectionne</strong><span>${esc(s.googleCalendarName || s.googleCalendarId || "--")}</span></div>
          <div class="settings-calendar-summary-item"><strong>Frequence active</strong><span>${esc(s.syncFrequency === "manual" ? "Manuelle" : s.syncFrequency)}</span></div>
          <div class="settings-calendar-summary-item"><strong>Fournisseur</strong><span>${esc(s.provider === "google" ? "Google Calendar" : "Aucun")}</span></div>
        </div>
        ${connected
          ? `<div style="margin-top:14px"><button class="action" onclick="onClickSyncGoogleNow()" ${googleSyncInProgress ? "disabled" : ""}>Synchroniser maintenant</button></div>`
          : ""
        }
      </section>
    </div>
    <div class="row-actions settings-calendar-buttons">
      <button class="action" onclick="saveCalendarConnectionSettings()">Enregistrer la configuration</button>
      <div class="settings-calendar-actions-right">
        <button class="secondary" onclick="resetCalendarConnectionSettings()">Reinitialiser</button>
      </div>
    </div>
  </div>`;
}

// -- Redefinition de readCalendarConnectionSettingsForm() pour V5.5 ----------
function readCalendarConnectionSettingsForm() {
  const googleClientId = document.getElementById("ccGoogleClientId")?.value.trim() || "";
  const calendarSelect = document.getElementById("ccGoogleCalendarId");
  const googleCalendarId = calendarSelect?.value || "";
  const googleCalendarName = calendarSelect?.options[calendarSelect?.selectedIndex]?.text || "";
  const syncFrequency = document.getElementById("ccSyncFrequency")?.value || "manual";
  // [DEOS SYNC TRACE] Diagnostic
  console.log("[DEOS SYNC TRACE] Form read - calendarSelect element exists:", !!calendarSelect);
  console.log("[DEOS SYNC TRACE] Form read - googleCalendarId value:", googleCalendarId || "(empty)");
  console.log("[DEOS SYNC TRACE] Form read - syncFrequency value:", syncFrequency);
  const showInAgenda = document.getElementById("ccShowInAgenda")?.checked ?? true;
  const showTodayInCockpit = document.getElementById("ccShowTodayInCockpit")?.checked ?? true;
  const maskPrivateEvents = document.getElementById("ccMaskPrivateEvents")?.checked ?? false;
  const current = getCalendarConnectionSettings();
  return {
    ...getDefaultCalendarConnectionSettings(),
    ...current,
    provider: googleClientId ? "google" : current.provider,
    googleClientId,
    googleCalendarId: googleCalendarId || current.googleCalendarId,
    googleCalendarName: googleCalendarName || current.googleCalendarName,
    syncFrequency,
    showInAgenda,
    showTodayInCockpit,
    maskPrivateEvents,
    connectionStatus: googleConnectionStatus
  };
}

// -- prepareGoogleCalendarConnection() remplace l'ancienne version ------------
function prepareGoogleCalendarConnection() {
  connectGoogleCalendar();
}

// -------------------------------------------------------------------------------
// DEOS V5.6 — Synchronisation Automatique et Gestion de l'Expiration du Token
// -------------------------------------------------------------------------------

function getGoogleSyncIntervalMs() {
  const settings = getCalendarConnectionSettings();
  const freq = settings.syncFrequency || "manual";
  return GOOGLE_SYNC_INTERVALS[freq] || null;
}

function shouldRunGoogleSyncNow() {
  const settings = getCalendarConnectionSettings();
  if (googleConnectionStatus !== "connected" || !settings.googleCalendarId) return false;
  if (!googleLastSyncAt) return true;
  const interval = getGoogleSyncIntervalMs();
  if (!interval) return false;
  const now = Date.now();
  return now - googleLastSyncAt >= interval;
}

function scheduleNextGoogleSync() {
  const interval = getGoogleSyncIntervalMs();
  if (!interval) {
    googleNextSyncAt = null;
    return;
  }
  const now = googleLastSyncAt || Date.now();
  googleNextSyncAt = now + interval;
}

function handleGoogleTokenExpired() {
  console.error("[DEOS Google Calendar] Token expiré. Session terminée.");
  setGoogleAccessToken(null);
  updateGoogleConnectionStatus("session_expired");
  stopGoogleCalendarAutoSync();
  renderSettings("Votre session Google a expiré. Reconnectez-vous pour reprendre la synchronisation.");
}

function startGoogleCalendarAutoSync() {
  if (googleSyncTimerId !== null) return;
  const interval = getGoogleSyncIntervalMs();
  if (!interval) return;
  googleSyncTimerId = setInterval(async () => {
    if (googleConnectionStatus === "connected" && !googleSyncInProgress) {
      await syncGoogleCalendarNow();
    }
  }, interval);
  console.log("[DEOS Google Calendar] Auto-sync démarré, intervalle: " + interval + "ms");
}

function stopGoogleCalendarAutoSync() {
  if (googleSyncTimerId !== null) {
    clearInterval(googleSyncTimerId);
    googleSyncTimerId = null;
    console.log("[DEOS Google Calendar] Auto-sync arrêté");
  }
}

function restartGoogleCalendarAutoSync() {
  stopGoogleCalendarAutoSync();
  startGoogleCalendarAutoSync();
}

function reconcileGoogleCalendarEvents(freshEvents) {
  const now = Date.now();
  let added = 0, updated = 0, removed = 0;
  console.log("[DEOS AGENDA TRACE] Reconciliation - freshEvents:", freshEvents.length);
  // V5.7 — IMPORTANT: Ne jamais écraser state.externalEventEnrichments
  // Les enrichissements restent attachés grâce à la clé stable (_key)
  
  // [DEOS V5.6.5] DIAGNOSTIC: verify _key structure
  const keyIssues = [];
  for (let i = 0; i < Math.min(5, freshEvents.length); i++) {
    const e = freshEvents[i];
    if (!e._key) keyIssues.push(`Event ${i}: _key is missing`);
    if (!e._calendarId) keyIssues.push(`Event ${i}: _calendarId is missing`);
    if (e._key?.startsWith('undefined')) keyIssues.push(`Event ${i}: _key contains "undefined"`);
  }
  if (keyIssues.length > 0) {
    console.error("[DEOS DEDUP CHECK] KEY ISSUES:", keyIssues);
  }
  // Log first event to debug structure
  if (freshEvents.length > 0) {
    console.log("[DEOS AGENDA TRACE] First freshEvent _key:", freshEvents[0]._key);
    console.log("[DEOS AGENDA TRACE] First freshEvent _calendarId:", freshEvents[0]._calendarId);
  }
  const fresIds = new Set(freshEvents.map(e => e._key));
  console.log("[DEOS AGENDA TRACE] Fresh IDs count:", fresIds.size);
  console.log("[DEOS DEDUP CHECK] fresh unique keys:", fresIds.size);
  // [DEOS V5.6.5] Check for undefined keys
  if (fresIds.has(undefined)) console.error("[DEOS DEDUP CHECK] [WARN] Fresh events contain undefined _key!");
  const oldIds = state.externalCalendarEvents
    .filter(e => e._calendarId === getCalendarConnectionSettings().googleCalendarId)
    .map(e => e._key);
  console.log("[DEOS AGENDA TRACE] Old events count:", oldIds.length);
  console.log("[DEOS DEDUP CHECK] old events total:", state.externalCalendarEvents.length);
  for (const oldId of oldIds) {
    if (!fresIds.has(oldId)) {
      const idx = state.externalCalendarEvents.findIndex(e => e._key === oldId);
      if (idx >= 0) {
        // V5.7 — Marquer l'enrichissement comme source indisponible
        if (state.externalEventEnrichments[oldId]) {
          state.externalEventEnrichments[oldId].sourceUnavailable = true;
        }
        state.externalCalendarEvents.splice(idx, 1);
        removed++;
      }
    }
  }
  for (const fresh of freshEvents) {
    const idx = state.externalCalendarEvents.findIndex(e => e._key === fresh._key);
    if (idx >= 0) {
      const old = state.externalCalendarEvents[idx];
      if (old.title !== fresh.title || old.startTime !== fresh.startTime || old.date !== fresh.date || old.description !== fresh.description) {
        state.externalCalendarEvents[idx] = fresh;
        updated++;
      }
    } else {
      state.externalCalendarEvents.push(fresh);
      added++;
    }
  }
  console.log(`[DEOS Google Calendar] Réconciliation: ${added} ajoutés, ${updated} mis à jour, ${removed} supprimés`);
  console.log("[DEOS AGENDA TRACE] Total external events after reconciliation:", state.externalCalendarEvents.length);
  return { added, updated, removed };
}

function removeMissingGoogleEventsInWindow() {
  const settings = getCalendarConnectionSettings();
  const calendarId = settings.googleCalendarId;
  if (!calendarId) return;
  const now = new Date();
  const past = new Date(now); past.setDate(past.getDate() - GOOGLE_SYNC_PAST_DAYS);
  const future = new Date(now); future.setDate(future.getDate() + GOOGLE_SYNC_FUTURE_DAYS);
  const pastIso = localIsoDate(past);
  const futureIso = localIsoDate(future);
  console.log("[DEOS STATE TRACE] removeMissingGoogleEventsInWindow: before filter:", state.externalCalendarEvents.length);
  console.log("[DEOS STATE TRACE] window range:", pastIso, "?", futureIso);
  state.externalCalendarEvents = state.externalCalendarEvents.filter(e => {
    if (e._calendarId !== calendarId) return true; // Garder les événements d'autres calendriers
    const eDate = String(e.date || "").substring(0, 10);
    // GARDER les événements DANS la fenêtre de sync, SUPPRIMER les événements OUTSIDE
    const keep = eDate >= pastIso && eDate <= futureIso;
    if (!keep) {
      console.log("[DEOS STATE TRACE] Removing event outside window:", e.title, "date:", e.date);
    }
    return keep;
  });
  console.log("[DEOS STATE TRACE] removeMissingGoogleEventsInWindow: after filter:", state.externalCalendarEvents.length);
}

function updateGoogleSyncUi() {
  const settings = getCalendarConnectionSettings();
  const freq = settings.syncFrequency || "manual";
  const lastSync = googleLastSyncAt ? new Date(googleLastSyncAt).toLocaleString("fr-FR") : "Jamais";
  const nextSync = googleNextSyncAt ? new Date(googleNextSyncAt).toLocaleString("fr-FR") : (freq === "manual" ? "Manuelle" : "Non planifiée");
  const eventCount = state.externalCalendarEvents.filter(e => e._calendarId === settings.googleCalendarId).length;
  return { lastSync, nextSync, eventCount };
}

init();

















// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// V5.7 â€” ENRICHISSEMENT LOCAL DES Ã‰VÃ‰NEMENTS GOOGLE CALENDAR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Initialise la structure d'enrichissements si elle n'existe pas
 * S'exÃ©cute au dÃ©marrage pour garantir une structure cohÃ©rente
 */
function ensureExternalEventEnrichments() {
  if (!state.externalEventEnrichments) {
    state.externalEventEnrichments = {};
  }
  state.externalEventEnrichments = Object.fromEntries(
    Object.entries(state.externalEventEnrichments).map(([eventKey, enrichment]) => [
      eventKey,
      normalizeMeetingEnrichment({ eventKey, ...enrichment }, { external: true })
    ])
  );
  console.log("[DEOS V5.7] ensureExternalEventEnrichments: structure initialized with", Object.keys(state.externalEventEnrichments).length, "enrichments");
}

/**
 * Obtient ou crÃ©e un enrichissement pour un Ã©vÃ©nement externe
 * @param {string} eventKey - ClÃ© stable de l'Ã©vÃ©nement (google_<externalId>)
 * @returns {object} Enrichissement (existant ou nouvellement crÃ©Ã©)
 */
function getExternalEventEnrichment(eventKey) {
  if (!state.externalEventEnrichments[eventKey] && String(eventKey || "").startsWith("google_")) {
    const legacyKey = String(eventKey).slice(7);
    if (state.externalEventEnrichments[legacyKey]) {
      state.externalEventEnrichments[eventKey] = state.externalEventEnrichments[legacyKey];
      delete state.externalEventEnrichments[legacyKey];
    }
  }
  if (!state.externalEventEnrichments[eventKey]) {
    state.externalEventEnrichments[eventKey] = normalizeMeetingEnrichment({
      eventKey: eventKey,
      subjects: [],
      preparation: "",
      meetingNotes: "",
      meetingReport: "",
      nextSteps: "",
      confidentiality: "normal",
      linkedActionIds: [],
      linkedDecisionIds: [],
      linkedDocumentIds: [],
      linkedFolderIds: [],
      linkedProjectIds: [],
      linkedManagerIds: [],
      links: [],
      preparationStatus: "not_started",
      sourceUnavailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { external: true });
    console.log("[DEOS V5.8] getExternalEventEnrichment: created new enrichment for", eventKey);
  } else {
    state.externalEventEnrichments[eventKey] = normalizeMeetingEnrichment({ eventKey, ...state.externalEventEnrichments[eventKey] }, { external: true });
  }
  return state.externalEventEnrichments[eventKey];
}

/**
 * Sauvegarde un enrichissement dans l'Ã©tat global
 * @param {string} eventKey - ClÃ© stable de l'Ã©vÃ©nement
 * @param {object} enrichment - DonnÃ©es d'enrichissement
 */
function saveExternalEventEnrichment(eventKey, enrichment) {
  const normalized = normalizeMeetingEnrichment({ eventKey, ...enrichment }, { external: true });
  normalized.updatedAt = new Date().toISOString();
  state.externalEventEnrichments[eventKey] = normalized;
  persistExternalEvents();
  console.log("[DEOS V5.7] saveExternalEventEnrichment: saved for", eventKey);
}

/**
 * Sauvegarde les donnÃ©es de la modale d'enrichissement
 * AppelÃ©e par le bouton "Enregistrer" de la modale
 */
function saveExternalEventEnrichmentFromModal(eventKey) {
  if (!eventKey) return false;
  const enrichment = getExternalEventEnrichment(eventKey);
  try {
    // Lire les champs de la modale et conserver les enrichissements V5.11 existants.
    enrichment.preparation = document.getElementById("enrichPreparation")?.value || "";
    enrichment.meetingNotes = document.getElementById("enrichMeetingNotes")?.value || "";
    enrichment.meetingReport = document.getElementById("enrichMeetingReport")?.value || "";
    enrichment.nextSteps = document.getElementById("enrichNextSteps")?.value || "";
    enrichment.confidentiality = normalizeMeetingConfidentiality(document.getElementById("enrichConfidentiality")?.value || "normal");
    enrichment.linkedManagerIds = normalizeLinkedManagerIds(ensureArray(enrichment.linkedManagerIds));

    saveExternalEventEnrichment(eventKey, enrichment);

    const ev = (state.externalCalendarEvents || []).find(e => e._key === eventKey);
    if (ev) {
      addActivity("Enrichissement rendez-vous", ev.title, "Informations mises à jour", ev._key);
    }

    // Fermer uniquement après succès ; closeExternalEventModal gère aussi le retour contexte V5.12.
    closeExternalEventModal();
    return true;
  } catch (error) {
    console.error(error);
    alert("Erreur lors de l'enregistrement de l'enrichissement. Vérifiez les champs puis réessayez.");
    return false;
  }
}

/**
 * Ajoute un sujet Ã  traiter pour un Ã©vÃ©nement externe
 */
function addExternalEventSubject(eventKey) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const subjectText = prompt("Ajouter un sujet Ã  traiter:");
  
  if (subjectText && subjectText.trim()) {
    const newSubject = {
      id: newId("subject"),
      title: subjectText.trim(),
      notes: "",
      completed: false,
      order: (enrichment.subjects || []).length
    };
    
    if (!enrichment.subjects) enrichment.subjects = [];
    enrichment.subjects.push(newSubject);
    saveExternalEventEnrichment(eventKey, enrichment);
    renderCockpit();
  }
}

/**
 * Met Ã  jour un sujet existant
 */
function updateExternalEventSubject(eventKey, subjectId, title, notes, completed) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const subject = (enrichment.subjects || []).find(s => s.id === subjectId);
  
  if (subject) {
    if (title !== undefined) subject.title = title;
    if (notes !== undefined) subject.notes = notes;
    if (completed !== undefined) subject.completed = !!completed;
    saveExternalEventEnrichment(eventKey, enrichment);
    renderCockpit();
  }
}

/**
 * Supprime un sujet
 */
function deleteExternalEventSubject(eventKey, subjectId) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const idx = (enrichment.subjects || []).findIndex(s => s.id === subjectId);
  
  if (idx >= 0) {
    enrichment.subjects.splice(idx, 1);
    saveExternalEventEnrichment(eventKey, enrichment);
    renderCockpit();
  }
}

/**
 * Ajoute un lien utile
 */
function addExternalEventLink(eventKey) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const linkName = prompt("Nom du lien:");
  
  if (linkName && linkName.trim()) {
    const linkUrl = prompt("URL du lien:");
    
    if (linkUrl && linkUrl.trim()) {
      const newLink = {
        id: newId("link"),
        name: linkName.trim(),
        url: linkUrl.trim(),
        createdAt: new Date().toISOString()
      };
      
      if (!enrichment.links) enrichment.links = [];
      enrichment.links.push(newLink);
      saveExternalEventEnrichment(eventKey, enrichment);
      renderCockpit();
    }
  }
}

/**
 * Supprime un lien
 */
function deleteExternalEventLink(eventKey, linkId) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const idx = (enrichment.links || []).findIndex(l => l.id === linkId);
  
  if (idx >= 0) {
    enrichment.links.splice(idx, 1);
    saveExternalEventEnrichment(eventKey, enrichment);
    renderCockpit();
  }
}

/**
 * Lie une action existante Ã  un Ã©vÃ©nement externe
 */
function linkActionToExternalEvent(eventKey, actionId) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const action = byId("actions", actionId);
  
  if (!action) return;
  if (!enrichment.linkedActionIds) enrichment.linkedActionIds = [];
  
  // Ã‰viter les doublons
  if (enrichment.linkedActionIds.includes(actionId)) return;
  
  enrichment.linkedActionIds.push(actionId);
  saveExternalEventEnrichment(eventKey, enrichment);
  console.log("[DEOS V5.7] Action", actionId, "linked to external event", eventKey);
}

/**
 * DÃ©tache une action d'un Ã©vÃ©nement externe (sans supprimer l'action)
 */
function unlinkActionFromExternalEvent(eventKey, actionId) {
  const enrichment = getExternalEventEnrichment(eventKey);
  if (!enrichment.linkedActionIds) enrichment.linkedActionIds = [];
  
  const idx = enrichment.linkedActionIds.indexOf(actionId);
  if (idx >= 0) {
    enrichment.linkedActionIds.splice(idx, 1);
    saveExternalEventEnrichment(eventKey, enrichment);
    renderCockpit();
  }
}

/**
 * CrÃ©e une nouvelle action DEOS liÃ©e Ã  un Ã©vÃ©nement externe
 */
function createActionFromExternalEvent(eventKey, eventTitle) {
  const ev = (state.externalCalendarEvents || []).find(e => e._key === eventKey);
  if (!ev) return;
  
  const actionTitle = prompt("Titre de la nouvelle action:", `Ã€ propos de: ${eventTitle}`);
  if (!actionTitle || !actionTitle.trim()) return;

  try {
    createActionFromMeeting("google", eventKey, {
      title: actionTitle.trim(),
      context: `Créée depuis le rendez-vous : ${eventTitle}`,
      due: "",
      owner: "",
      level: "orange",
      linkedManagers: [],
      linkedProjects: [],
      linkedFolders: [],
      meetingTitle: eventTitle
    });
    renderCockpit();
  } catch (error) {
    console.error(error);
    alert(error.message || "Erreur pendant la création de l'action.");
  }
}

/**
 * Lie une dÃ©cision existante Ã  un Ã©vÃ©nement externe
 */
function linkDecisionToExternalEvent(eventKey, decisionId) {
  const enrichment = getExternalEventEnrichment(eventKey);
  const decision = byId("decisions", decisionId);
  
  if (!decision) return;
  if (!enrichment.linkedDecisionIds) enrichment.linkedDecisionIds = [];
  
  // Ã‰viter les doublons
  if (enrichment.linkedDecisionIds.includes(decisionId)) return;
  
  enrichment.linkedDecisionIds.push(decisionId);
  saveExternalEventEnrichment(eventKey, enrichment);
  console.log("[DEOS V5.7] Decision", decisionId, "linked to external event", eventKey);
}

/**
 * DÃ©tache une dÃ©cision d'un Ã©vÃ©nement externe (sans supprimer la dÃ©cision)
 */
function unlinkDecisionFromExternalEvent(eventKey, decisionId) {
  const enrichment = getExternalEventEnrichment(eventKey);
  if (!enrichment.linkedDecisionIds) enrichment.linkedDecisionIds = [];
  
  const idx = enrichment.linkedDecisionIds.indexOf(decisionId);
  if (idx >= 0) {
    enrichment.linkedDecisionIds.splice(idx, 1);
    saveExternalEventEnrichment(eventKey, enrichment);
    renderCockpit();
  }
}

/**
 * CrÃ©e une nouvelle dÃ©cision DEOS liÃ©e Ã  un Ã©vÃ©nement externe
 */

/**
 * V5.8 - Link an object (folder, project, or manager) to an external event
 */
function linkObjectToExternalEvent(objectType, objectId) {
  console.log("[DEOS V5.8 INLINE] add requested");
  console.log("[DEOS V5.8 INLINE] type:", objectType);
  console.log("[DEOS V5.8 INLINE] object id present:", !!objectId);
  
  if (!objectId || !objectType) {
    console.log("[DEOS V5.8 INLINE] No object selected, aborting");
    return;
  }
  
  const eventKey = googleExternalEventModalId;
  console.log("[DEOS V5.8 INLINE] event key present:", !!eventKey);
  
  if (!eventKey) {
    console.error("[DEOS V5.8 INLINE] No external event modal open");
    return;
  }
  
  const enrichment = getExternalEventEnrichment(eventKey);
  
  let arrayName = ""; let collectionName = "";
  
  switch(objectType) {
    case "folder": arrayName = "linkedFolderIds"; collectionName = "folders"; break;
    case "project": arrayName = "linkedProjectIds"; collectionName = "projects"; break;
    case "manager": arrayName = "linkedManagerIds"; collectionName = "managers"; break;
    default: console.error("[DEOS V5.8 INLINE] Unknown object type:", objectType); return;
  }
  
  if (!Array.isArray(enrichment[arrayName])) enrichment[arrayName] = [];
  const normalizedObjectId = String(objectId);

  const obj = byId(collectionName, normalizedObjectId);
  if (!obj) { console.error("[DEOS V5.8 INLINE] Object not found:", objectType, objectId); return; }

  const normalizedIds = normalizeLinkedIdArray(enrichment[arrayName]);
  if (normalizedIds.includes(normalizedObjectId)) { console.log("[DEOS V5.8 INLINE] Object already linked, skipping duplicate"); return; }

  console.log("[DEOS MANAGER DEBUG] google selected id before link", { objectType, objectId: normalizedObjectId, type: typeof normalizedObjectId });
  console.log("[DEOS V5.8 INLINE] link count before:", normalizedIds.length);
  enrichment[arrayName] = [...normalizedIds, normalizedObjectId];
  console.log("[DEOS V5.8 INLINE] link count after:", enrichment[arrayName].length);
  if (objectType === "manager") {
    console.log("[DEOS MANAGER DEBUG] google linkedManagerIds after link", enrichment[arrayName]);
  }
  
  enrichment.updatedAt = new Date().toISOString();
  saveExternalEventEnrichment(eventKey, enrichment);
  console.log("[DEOS V5.8 INLINE] persistence completed");
  
  rerenderCurrentExternalEventDetails();
  
  const selectId = objectType + "Select";
  const select = document.getElementById(selectId);
  if (select) select.value = "";
}

/**
 * V5.8 - Unlink an object from an external event
 */
function unlinkObjectFromExternalEvent(objectType, objectId) {
  const eventKey = googleExternalEventModalId;
  if (!eventKey) return;
  
  const enrichment = getExternalEventEnrichment(eventKey);
  
  let arrayName = "";
  switch(objectType) {
    case "folder": arrayName = "linkedFolderIds"; break;
    case "project": arrayName = "linkedProjectIds"; break;
    case "manager": arrayName = "linkedManagerIds"; break;
    default: return;
  }
  
  if (!Array.isArray(enrichment[arrayName])) enrichment[arrayName] = [];
  const normalizedObjectId = String(objectId);
  const before = normalizeLinkedIdArray(enrichment[arrayName]);
  const after = before.filter(id => !sameId(id, normalizedObjectId));
  if (after.length !== before.length) {
    enrichment[arrayName] = after;
    if (objectType === "manager") {
      console.log("[DEOS MANAGER DEBUG] google linkedManagerIds after unlink", enrichment[arrayName]);
    }
    enrichment.updatedAt = new Date().toISOString();
    saveExternalEventEnrichment(eventKey, enrichment);
    console.log("[DEOS V5.8 INLINE] local rerender completed");
    rerenderCurrentExternalEventDetails();
  }
}

/**
 * V5.8 - Rerender only the current external event modal without closing
 */
function rerenderCurrentExternalEventDetails() {
  if (!googleExternalEventModalId) return;
  
  const backdrop = document.querySelector(".modal-backdrop");
  if (!backdrop) return;
  
  const newModalHtml = externalEventModal();
  backdrop.outerHTML = newModalHtml;
  
  console.log("[DEOS V5.8 INLINE] modal rerendered successfully");
}
function createDecisionFromExternalEvent(eventKey, eventTitle) {
  const ev = (state.externalCalendarEvents || []).find(e => e._key === eventKey);
  if (!ev) return;
  
  const decisionTitle = prompt("Titre de la nouvelle dÃ©cision:", `Ã€ propos de: ${eventTitle}`);
  if (!decisionTitle || !decisionTitle.trim()) return;

  try {
    createDecisionFromMeeting("google", eventKey, {
      title: decisionTitle.trim(),
      context: `Créée depuis le rendez-vous : ${eventTitle}`,
      date: isoToday(),
      status: "decided",
      importance: "orange",
      owner: identityName(),
      linkedManagers: [],
      linkedProjects: [],
      linkedFolders: [],
      meetingTitle: eventTitle
    });
    renderCockpit();
  } catch (error) {
    console.error(error);
    alert(error.message || "Erreur pendant la création de la décision.");
  }
}

/**
 * Marque un Ã©vÃ©nement comme source indisponible
 * AppelÃ©e automatiquement lors d'une sync si l'Ã©vÃ©nement Google est supprimÃ©
 */
function markExternalEventSourceMissing(eventKey, missing = true) {
  const enrichment = getExternalEventEnrichment(eventKey);
  enrichment.sourceUnavailable = !!missing;
  saveExternalEventEnrichment(eventKey, enrichment);
  console.log("[DEOS V5.7] Event", eventKey, "marked as source unavailable:", missing);
}

function editDecision(id) {
  decisionDetailId = String(id);
  openDecisionEditModal(id);
}

function saveDecision(id) {
  return saveDecisionEdit(id);
}

function deleteDecision(id) {
  openDecisionDeleteModal(id);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



