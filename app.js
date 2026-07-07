const DEOS_VERSION = "V2.0";

const state = {
  managers: [],
  projects: [],
  decisions: [],
  actions: [],
  journal: [],
  documents: []
};

const labels = {
  green: "Maîtrisé",
  orange: "À suivre",
  red: "Critique"
};

async function load(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadSaved(key, fallback) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
}

function badge(status) {
  return `<span class="badge ${status}">${labels[status] || "À suivre"}</span>`;
}

function appHtml(html) {
  document.getElementById("app").innerHTML = html;
}

function lines(id) {
  return document.getElementById(id).value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

function escapeAttr(value = "") {
  return String(value).replace(/"/g, "&quot;");
}

function listOrEmpty(items, prefix = "") {
  return (items || [])
    .map(item => `<div class="item">${prefix}${item}</div>`)
    .join("") || "<p>À compléter</p>";
}
function renderFolders() {
  const favoriteProjects = state.projects.slice(0, 6);
  const favoriteManagers = state.managers.slice(0, 6);

  appHtml(`
    <div class="card hero">
      <h2>Mes dossiers</h2>
      <p class="muted">Accès rapide aux sujets, personnes et dossiers que tu pilotes au quotidien.</p>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>📦 Dossiers exploitation</h2>
        ${favoriteProjects.map((project) => `
          <div class="item clickable" onclick="openProject(${state.projects.indexOf(project)})">
            <strong>${project.name}</strong>
            <span class="muted">${project.next || "Aucune prochaine étape"}</span>
            ${badge(project.status)}
          </div>
        `).join("") || "<p>Aucun projet.</p>"}
      </div>

      <div class="card">
        <h2>👥 Dossiers managers</h2>
        ${favoriteManagers.map((manager) => `
          <div class="item clickable" onclick="openManager(${state.managers.indexOf(manager)})">
            <strong>${manager.name}</strong>
            <span class="muted">${manager.role}</span>
            ${badge(manager.status)}
          </div>
        `).join("") || "<p>Aucun manager.</p>"}
      </div>

      <div class="card">
        <h2>⚖️ Dialogue social</h2>
        <div class="item"><strong>CSE</strong><span class="muted">Questions, réponses, décisions, échéances</span></div>
        <div class="item"><strong>Courriers OS</strong><span class="muted">Réponses, historique, points sensibles</span></div>
        <div class="item"><strong>Inspection / CNIL</strong><span class="muted">Documents et décisions à sécuriser</span></div>
      </div>

      <div class="card">
        <h2>📖 Mémoire</h2>
        <div class="item clickable" onclick="setView('journal')"><strong>Journal</strong><span class="muted">Faits marquants et traces quotidiennes</span></div>
        <div class="item clickable" onclick="setView('decisions')"><strong>Décisions</strong><span class="muted">Pourquoi, quand, avec qui</span></div>
        <div class="item clickable" onclick="setView('documents')"><strong>Documents</strong><span class="muted">Modèles, courriers, comptes rendus</span></div>
      </div>
    </div>
  `);
}
async function init() {
  state.managers = loadSaved("deos_managers", await load("data/managers.json"));
  state.projects = loadSaved("deos_projects", await load("data/projects.json"));
  state.decisions = loadSaved("deos_decisions", await load("data/decisions.json"));
  state.actions = loadSaved("deos_actions", await load("data/actions.json"));
  state.journal = loadSaved("deos_journal", []);
  state.documents = loadSaved("deos_documents", defaultDocuments());

  document.getElementById("today").textContent =
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());

  document.querySelectorAll(".nav").forEach(button => {
    button.onclick = () => setView(button.dataset.view);
  });

  document.getElementById("searchInput").oninput = event => runSearch(event.target.value);

  setView("cockpit");
}

function setView(view) {
  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    cockpit: "Cockpit décisionnel",
    folders: "Mes dossiers"
    actions: "Actions",
    managers: "Managers",
    projects: "Projets",
    decisions: "Mémoire décisionnelle",
    journal: "Journal du Directeur",
    documents: "Documents"
  };

  document.getElementById("viewTitle").textContent = titles[view] || "DEOS";

  const views = {
    cockpit: renderCockpit,
    folders: renderFolders,
    actions: renderActions,
    managers: renderManagers,
    projects: renderProjects,
    decisions: renderDecisions,
    journal: renderJournal,
    documents: renderDocuments
  };

  if (views[view]) views[view]();
}

function renderCockpit() {
  const openActions = state.actions.filter(a => !a.done);
  const redProjects = state.projects.filter(p => p.status === "red");
  const managersToFollow = state.managers.filter(m => m.status !== "green");
  const recentDecisions = state.decisions.slice(0, 3);

  appHtml(`
    <div class="card hero">
      <h2>Bonjour Ludovic</h2>
      <p class="muted">Brief du jour · DEOS ${DEOS_VERSION}</p>

      <div class="grid three">
        <div class="kpi"><span>🔴 Urgences</span><b>${redProjects.length}</b></div>
        <div class="kpi"><span>🟠 Actions ouvertes</span><b>${openActions.length}</b></div>
        <div class="kpi"><span>👥 Managers à voir</span><b>${managersToFollow.length}</b></div>
      </div>
    </div>

    <div class="card">
  <h2>Agenda du jour</h2>
  <div class="item"><strong>09:00</strong><span class="muted">Point exploitation / REX</span></div>
  <div class="item"><strong>11:00</strong><span class="muted">Point RH</span></div>
  <div class="item"><strong>14:00</strong><span class="muted">Projet productivité</span></div>
  <div class="item"><strong>16:30</strong><span class="muted">Journal de décision</span></div>
</div>
    <div class="grid two">
      <div class="card">
        <h2>Mes priorités</h2>
        <div class="item">□ CODIR / exploitation</div>
        <div class="item">□ Productivité</div>
        <div class="item">□ Température chocolat</div>
        <div class="item">□ Entretien Hadrien</div>
      </div>

      <div class="card">
        <h2>Managers à suivre</h2>
        ${managersToFollow.map(managerMiniCard).join("") || "<p>Aucun manager à suivre.</p>"}
      </div>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Projets critiques</h2>
        ${redProjects.map(projectMiniCard).join("") || "<p>Aucun projet critique.</p>"}
      </div>

      <div class="card">
        <h2>Actions ouvertes</h2>
        ${openActions.slice(0, 6).map(actionCard).join("") || "<p>Aucune action ouverte.</p>"}
      </div>
    </div>

    <div class="card">
      <h2>Décisions récentes</h2>
      ${recentDecisions.map(decisionCard).join("") || "<p>Aucune décision récente.</p>"}
    </div>
  `);
}

/* ACTIONS */
function renderActions() {
  appHtml(`
    <div class="card">
      <h2>Ajouter une action</h2>
      <input id="actionTitle" placeholder="Action">
      <input id="actionLink" placeholder="Lien : projet, manager, décision...">
      <button class="action" onclick="addAction()">Ajouter</button>
    </div>

    ${state.actions.map((action, index) => actionCard(action, index)).join("") || "<div class='card'>Aucune action.</div>"}
  `);
}

function actionCard(action, index) {
  const realIndex = index ?? state.actions.indexOf(action);

  return `
    <div class="item row clickable" onclick="toggleAction(${realIndex})">
      <div>
        <strong>${action.title}</strong>
        <span class="muted">${action.link || ""}</span>
      </div>
      <span>${action.done ? "✅" : "⬜"}</span>
    </div>
  `;
}

function toggleAction(index) {
  state.actions[index].done = !state.actions[index].done;
  save("deos_actions", state.actions);
  setView("actions");
}

function addAction() {
  const title = document.getElementById("actionTitle").value.trim();
  const link = document.getElementById("actionLink").value.trim();

  if (!title) return;

  state.actions.unshift({
    title,
    link,
    done: false
  });

  save("deos_actions", state.actions);
  renderActions();
}

/* MANAGERS */
function renderManagers() {
  appHtml(`
    <div class="card">
      <h2>Ajouter un manager</h2>
      <input id="managerName" placeholder="Nom">
      <input id="managerRole" placeholder="Poste">

      <select id="managerStatus">
        <option value="green">Maîtrisé</option>
        <option value="orange">À suivre</option>
        <option value="red">Critique</option>
      </select>

      <button class="action" onclick="addManager()">Ajouter</button>
    </div>

    <div class="grid two">
      ${state.managers.map(managerFullCard).join("")}
    </div>
  `);
}

function managerMiniCard(manager) {
  return `
    <div class="item clickable" onclick="openManager(${state.managers.indexOf(manager)})">
      <strong>${manager.name}</strong>
      <span class="muted">${manager.role}</span>
      ${badge(manager.status)}
    </div>
  `;
}

function managerFullCard(manager, index) {
  return `
    <div class="card clickable" onclick="openManager(${index})">
      <h2>${manager.name}</h2>
      <p>${manager.role}</p>
      ${badge(manager.status)}
      <p class="muted">${manager.note || ""}</p>
    </div>
  `;
}

function addManager() {
  const name = document.getElementById("managerName").value.trim();
  const role = document.getElementById("managerRole").value.trim();
  const status = document.getElementById("managerStatus").value;

  if (!name || !role) return;

  state.managers.push({
    name,
    role,
    status,
    note: "",
    strengths: [],
    watchPoints: [],
    actions: []
  });

  save("deos_managers", state.managers);
  renderManagers();
}

function openManager(index) {
  const manager = state.managers[index];

  document.getElementById("viewTitle").textContent = manager.name;

  appHtml(`
    <div class="card hero">
      <h2>${manager.name}</h2>
      <p>${manager.role}</p>
      ${badge(manager.status)}
      <p class="muted">${manager.note || ""}</p>

      <button class="action" onclick="editManager(${index})">✏️ Modifier la fiche</button>
      <button class="danger" onclick="deleteManager(${index})">Supprimer</button>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Priorité</h2>
        <p>${manager.priority || "À compléter"}</p>
      </div>

      <div class="card">
        <h2>Prochain entretien</h2>
        <p>${manager.nextMeeting || "À planifier"}</p>
      </div>

      <div class="card">
        <h2>Forces</h2>
        ${listOrEmpty(manager.strengths)}
      </div>

      <div class="card">
        <h2>Points de vigilance</h2>
        ${listOrEmpty(manager.watchPoints)}
      </div>

      <div class="card">
        <h2>Actions</h2>
        ${listOrEmpty(manager.actions, "⬜ ")}
      </div>

      <div class="card">
        <h2>Historique</h2>
        <div class="item">Fiche créée dans DEOS</div>
      </div>
    </div>
  `);
}

function editManager(index) {
  const manager = state.managers[index];

  document.getElementById("viewTitle").textContent = "Modifier " + manager.name;

  appHtml(`
    <div class="card">
      <h2>Modifier la fiche manager</h2>

      <input id="editName" value="${escapeAttr(manager.name)}" placeholder="Nom">
      <input id="editRole" value="${escapeAttr(manager.role)}" placeholder="Poste">
      <input id="editPriority" value="${escapeAttr(manager.priority || "")}" placeholder="Priorité">
      <input id="editNextMeeting" value="${escapeAttr(manager.nextMeeting || "")}" placeholder="Prochain entretien">

      <select id="editStatus">
        <option value="green" ${manager.status === "green" ? "selected" : ""}>Maîtrisé</option>
        <option value="orange" ${manager.status === "orange" ? "selected" : ""}>À suivre</option>
        <option value="red" ${manager.status === "red" ? "selected" : ""}>Critique</option>
      </select>

      <textarea id="editNote" placeholder="Note">${manager.note || ""}</textarea>
      <textarea id="editStrengths" placeholder="Forces, une par ligne">${(manager.strengths || []).join("\n")}</textarea>
      <textarea id="editWatchPoints" placeholder="Points de vigilance, un par ligne">${(manager.watchPoints || []).join("\n")}</textarea>
      <textarea id="editActions" placeholder="Actions, une par ligne">${(manager.actions || []).join("\n")}</textarea>

      <button class="action" onclick="saveManager(${index})">Enregistrer</button>
      <button class="danger" onclick="openManager(${index})">Annuler</button>
    </div>
  `);
}

function saveManager(index) {
  state.managers[index] = {
    ...state.managers[index],
    name: document.getElementById("editName").value.trim(),
    role: document.getElementById("editRole").value.trim(),
    priority: document.getElementById("editPriority").value.trim(),
    nextMeeting: document.getElementById("editNextMeeting").value.trim(),
    status: document.getElementById("editStatus").value,
    note: document.getElementById("editNote").value.trim(),
    strengths: lines("editStrengths"),
    watchPoints: lines("editWatchPoints"),
    actions: lines("editActions")
  };

  save("deos_managers", state.managers);
  openManager(index);
}

function deleteManager(index) {
  if (!confirm("Supprimer ce manager ?")) return;

  state.managers.splice(index, 1);
  save("deos_managers", state.managers);
  renderManagers();
}
/* PROJECTS */
function renderProjects() {
  appHtml(`
    <div class="card">
      <h2>Ajouter un projet</h2>
      <input id="projectName" placeholder="Nom du projet">
      <input id="projectNext" placeholder="Prochaine étape">
      <input id="projectProgress" type="number" min="0" max="100" value="0" placeholder="Avancement">

      <select id="projectStatus">
        <option value="green">Maîtrisé</option>
        <option value="orange">À suivre</option>
        <option value="red">Critique</option>
      </select>

      <button class="action" onclick="addProject()">Ajouter</button>
    </div>

    <div class="grid two">
      ${state.projects.map(projectFullCard).join("")}
    </div>
  `);
}

function projectMiniCard(project) {
  return `
    <div class="item clickable" onclick="openProject(${state.projects.indexOf(project)})">
      <strong>${project.name}</strong>
      <span class="muted">${project.next || ""}</span>
      ${badge(project.status)}
    </div>
  `;
}

function projectFullCard(project, index) {
  return `
    <div class="card clickable" onclick="openProject(${index})">
      <h2>${project.name}</h2>
      ${badge(project.status)}
      <p>${project.next || ""}</p>
      <div class="progress">
        <span style="width:${project.progress || 0}%"></span>
      </div>
      <span class="muted">${project.progress || 0}%</span>
    </div>
  `;
}

function addProject() {
  const name = document.getElementById("projectName").value.trim();
  const next = document.getElementById("projectNext").value.trim();
  const progress = Number(document.getElementById("projectProgress").value);
  const status = document.getElementById("projectStatus").value;

  if (!name) return;

  state.projects.push({
    name,
    next,
    progress,
    status,
    decisions: "",
    actions: ""
  });

  save("deos_projects", state.projects);
  renderProjects();
}

function openProject(index) {
  const project = state.projects[index];

  document.getElementById("viewTitle").textContent = project.name;

  appHtml(`
    <div class="card hero">
      <h2>${project.name}</h2>
      ${badge(project.status)}
      <p>${project.next || ""}</p>

      <button class="action" onclick="editProject(${index})">✏️ Modifier le projet</button>
      <button class="danger" onclick="deleteProject(${index})">Supprimer</button>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Avancement</h2>
        <div class="progress">
          <span style="width:${project.progress || 0}%"></span>
        </div>
        <p>${project.progress || 0}%</p>
      </div>

      <div class="card">
        <h2>Prochaine étape</h2>
        <p>${project.next || "À compléter"}</p>
      </div>

      <div class="card">
        <h2>Décisions liées</h2>
        <p>${project.decisions || "À connecter"}</p>
      </div>

      <div class="card">
        <h2>Actions liées</h2>
        <p>${project.actions || "À connecter"}</p>
      </div>
    </div>
  `);
}

function editProject(index) {
  const project = state.projects[index];

  document.getElementById("viewTitle").textContent = "Modifier " + project.name;

  appHtml(`
    <div class="card">
      <h2>Modifier le projet</h2>

      <input id="editProjectName" value="${escapeAttr(project.name)}" placeholder="Nom du projet">
      <input id="editProjectNext" value="${escapeAttr(project.next || "")}" placeholder="Prochaine étape">
      <input id="editProjectProgress" type="number" min="0" max="100" value="${project.progress || 0}" placeholder="Avancement">

      <select id="editProjectStatus">
        <option value="green" ${project.status === "green" ? "selected" : ""}>Maîtrisé</option>
        <option value="orange" ${project.status === "orange" ? "selected" : ""}>À suivre</option>
        <option value="red" ${project.status === "red" ? "selected" : ""}>Critique</option>
      </select>

      <textarea id="editProjectDecisions" placeholder="Décisions liées">${project.decisions || ""}</textarea>
      <textarea id="editProjectActions" placeholder="Actions liées">${project.actions || ""}</textarea>

      <button class="action" onclick="saveProject(${index})">Enregistrer</button>
      <button class="danger" onclick="openProject(${index})">Annuler</button>
    </div>
  `);
}

function saveProject(index) {
  state.projects[index] = {
    ...state.projects[index],
    name: document.getElementById("editProjectName").value.trim(),
    next: document.getElementById("editProjectNext").value.trim(),
    progress: Number(document.getElementById("editProjectProgress").value),
    status: document.getElementById("editProjectStatus").value,
    decisions: document.getElementById("editProjectDecisions").value.trim(),
    actions: document.getElementById("editProjectActions").value.trim()
  };

  save("deos_projects", state.projects);
  openProject(index);
}

function deleteProject(index) {
  if (!confirm("Supprimer ce projet ?")) return;

  state.projects.splice(index, 1);
  save("deos_projects", state.projects);
  renderProjects();
}

/* DECISIONS */
function renderDecisions() {
  appHtml(`
    <div class="card">
      <h2>Ajouter une décision</h2>
      <input id="decisionTitle" placeholder="Titre de la décision">
      <textarea id="decisionContext" placeholder="Contexte / justification"></textarea>
      <input id="decisionTags" placeholder="Tags : Projet, manager, CSE...">
      <button class="action" onclick="addDecision()">Ajouter</button>
    </div>

    ${state.decisions.map(decisionCard).join("") || "<div class='card'>Aucune décision.</div>"}
  `);
}

function decisionCard(decision, index) {
  return `
    <div class="card clickable" onclick="openDecision(${index})">
      <h2>${decision.title}</h2>
      <p>${decision.context || ""}</p>
      <span class="muted">${decision.date || ""} · ${(decision.tags || []).join(", ")}</span>
    </div>
  `;
}

function addDecision() {
  const title = document.getElementById("decisionTitle").value.trim();
  const context = document.getElementById("decisionContext").value.trim();
  const tags = document.getElementById("decisionTags").value
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  if (!title) return;

  state.decisions.unshift({
    title,
    context,
    tags,
    date: new Date().toLocaleDateString("fr-FR")
  });

  save("deos_decisions", state.decisions);
  renderDecisions();
}

function openDecision(index) {
  const decision = state.decisions[index];

  document.getElementById("viewTitle").textContent = decision.title;

  appHtml(`
    <div class="card hero">
      <h2>${decision.title}</h2>
      <p>${decision.context || ""}</p>
      <span class="muted">${decision.date || ""} · ${(decision.tags || []).join(", ")}</span>
      <br><br>
      <button class="action" onclick="editDecision(${index})">✏️ Modifier la décision</button>
      <button class="danger" onclick="deleteDecision(${index})">Supprimer</button>
    </div>
  `);
}

function editDecision(index) {
  const decision = state.decisions[index];

  document.getElementById("viewTitle").textContent = "Modifier décision";

  appHtml(`
    <div class="card">
      <h2>Modifier la décision</h2>
      <input id="editDecisionTitle" value="${escapeAttr(decision.title)}" placeholder="Titre">
      <textarea id="editDecisionContext" placeholder="Contexte">${decision.context || ""}</textarea>
      <input id="editDecisionTags" value="${(decision.tags || []).join(", ")}" placeholder="Tags">

      <button class="action" onclick="saveDecision(${index})">Enregistrer</button>
      <button class="danger" onclick="openDecision(${index})">Annuler</button>
    </div>
  `);
}

function saveDecision(index) {
  state.decisions[index] = {
    ...state.decisions[index],
    title: document.getElementById("editDecisionTitle").value.trim(),
    context: document.getElementById("editDecisionContext").value.trim(),
    tags: document.getElementById("editDecisionTags").value
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)
  };

  save("deos_decisions", state.decisions);
  openDecision(index);
}

function deleteDecision(index) {
  if (!confirm("Supprimer cette décision ?")) return;

  state.decisions.splice(index, 1);
  save("deos_decisions", state.decisions);
  renderDecisions();
}

/* JOURNAL */
function renderJournal() {
  appHtml(`
    <div class="card hero">
      <h2>Journal du Directeur</h2>
      <p class="muted">Trace les faits marquants, décisions, échanges et points de vigilance.</p>
    </div>

    <div class="card">
      <h2>Ajouter une entrée</h2>
      <input id="journalTitle" placeholder="Titre : CODIR, point RH, incident...">
      <textarea id="journalContent" placeholder="Compte-rendu / faits marquants"></textarea>
      <input id="journalTags" placeholder="Tags : manager, projet, décision...">
      <button class="action" onclick="addJournal()">Ajouter</button>
    </div>

    ${state.journal.map(journalCard).join("") || "<div class='card'>Aucune entrée.</div>"}
  `);
}

function journalCard(entry, index) {
  return `
    <div class="card clickable" onclick="openJournal(${index})">
      <h2>${entry.title}</h2>
      <p>${entry.content || ""}</p>
      <span class="muted">${entry.date || ""} · ${(entry.tags || []).join(", ")}</span>
    </div>
  `;
}

function addJournal() {
  const title = document.getElementById("journalTitle").value.trim();
  const content = document.getElementById("journalContent").value.trim();
  const tags = document.getElementById("journalTags").value
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  if (!title && !content) return;

  state.journal.unshift({
    title: title || "Entrée journal",
    content,
    tags,
    date: new Date().toLocaleDateString("fr-FR")
  });

  save("deos_journal", state.journal);
  renderJournal();
}

function openJournal(index) {
  const entry = state.journal[index];

  document.getElementById("viewTitle").textContent = entry.title;

  appHtml(`
    <div class="card hero">
      <h2>${entry.title}</h2>
      <p>${entry.content || ""}</p>
      <span class="muted">${entry.date || ""} · ${(entry.tags || []).join(", ")}</span>
      <br><br>
      <button class="danger" onclick="deleteJournal(${index})">Supprimer</button>
    </div>
  `);
}

function deleteJournal(index) {
  if (!confirm("Supprimer cette entrée ?")) return;

  state.journal.splice(index, 1);
  save("deos_journal", state.journal);
  renderJournal();
}

/* DOCUMENTS */
function renderDocuments() {
  appHtml(`
    <div class="card hero">
      <h2>Documents & modèles</h2>
      <p class="muted">Modèles prêts à utiliser pour mails, courriers, CODIR, CSE et notes internes.</p>
    </div>

    <div class="card">
      <h2>Créer un document</h2>
      <input id="documentTitle" placeholder="Titre du document">
      <select id="documentType">
        <option>Mail professionnel</option>
        <option>Compte rendu CODIR</option>
        <option>Courrier disciplinaire</option>
        <option>CSE</option>
        <option>Note incident</option>
        <option>Gemba DE</option>
      </select>
      <textarea id="documentContent" placeholder="Contenu / modèle"></textarea>
      <button class="action" onclick="addDocument()">Ajouter</button>
    </div>

    <div class="grid two">
      ${state.documents.map(documentCard).join("") || "<div class='card'>Aucun document.</div>"}
    </div>
  `);
}

function defaultDocuments() {
  return [
    { title: "Compte rendu CODIR", type: "Management", content: "Faits marquants · décisions · actions · alertes" },
    { title: "Courrier disciplinaire", type: "RH / Social", content: "Faits · règlement · analyse · sanction" },
    { title: "CSE", type: "Dialogue social", content: "Questions · réponses · décisions · points à sécuriser" },
    { title: "Mail professionnel", type: "Communication", content: "Objet clair · contexte · demande · échéance" }
  ];
}

function documentCard(doc, index) {
  return `
    <div class="card clickable" onclick="openDocument(${index})">
      <h2>${doc.title}</h2>
      <span class="muted">${doc.type || ""}</span>
      <p>${doc.content || ""}</p>
    </div>
  `;
}

function addDocument() {
  const title = document.getElementById("documentTitle").value.trim();
  const type = document.getElementById("documentType").value;
  const content = document.getElementById("documentContent").value.trim();

  if (!title) return;

  state.documents.unshift({ title, type, content });

  save("deos_documents", state.documents);
  renderDocuments();
}

function openDocument(index) {
  const doc = state.documents[index];

  document.getElementById("viewTitle").textContent = doc.title;

  appHtml(`
    <div class="card hero">
      <h2>${doc.title}</h2>
      <span class="muted">${doc.type || ""}</span>
      <p>${doc.content || ""}</p>
      <button class="danger" onclick="deleteDocument(${index})">Supprimer</button>
    </div>
  `);
}

function deleteDocument(index) {
  if (!confirm("Supprimer ce document ?")) return;

  state.documents.splice(index, 1);
  save("deos_documents", state.documents);
  renderDocuments();
}

/* SEARCH */
function runSearch(query) {
  const q = query.toLowerCase().trim();

  if (!q) {
    setView("cockpit");
    return;
  }

  const results = [
    ...state.managers.map(item => ({ type: "Manager", title: item.name, text: item.role })),
    ...state.projects.map(item => ({ type: "Projet", title: item.name, text: item.next })),
    ...state.decisions.map(item => ({ type: "Décision", title: item.title, text: item.context })),
    ...state.actions.map(item => ({ type: "Action", title: item.title, text: item.link })),
    ...state.journal.map(item => ({ type: "Journal", title: item.title, text: item.content })),
    ...state.documents.map(item => ({ type: "Document", title: item.title, text: item.content }))
  ].filter(item => `${item.title} ${item.text}`.toLowerCase().includes(q));

  document.getElementById("viewTitle").textContent = "Recherche";

  appHtml(`
    <div class="card">
      <h2>${results.length} résultat(s)</h2>
      ${results.map(result => `
        <div class="item">
          <strong>${result.title}</strong>
          <span class="muted">${result.type} · ${result.text || ""}</span>
        </div>
      `).join("")}
    </div>
  `);
}

init();