const state = {
  managers: [],
  projects: [],
  decisions: [],
  actions: []
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
function saveLocal() {
  localStorage.setItem("deos_managers", JSON.stringify(state.managers));
}

function loadLocalManagers() {
  const saved = localStorage.getItem("deos_managers");
  if (saved) state.managers = JSON.parse(saved);
}

function badge(status) {
  return `<span class="badge ${status}">${labels[status] || "À suivre"}</span>`;
}

async function init() {
  state.managers = await load("data/managers.json");
  loadLocalManagers();
  state.projects = await load("data/projects.json");
  const savedProjects = localStorage.getItem("deos_projects");
if (savedProjects) state.projects = JSON.parse(savedProjects);
  state.decisions = await load("data/decisions.json");
  state.actions = await load("data/actions.json");

  document.getElementById("today").textContent = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  document.querySelectorAll(".nav").forEach((button) => {
    button.onclick = () => setView(button.dataset.view);
  });

  document.getElementById("searchInput").oninput = (event) => runSearch(event.target.value);

  setView("cockpit");
}

function setView(view) {
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    cockpit: "Cockpit décisionnel",
    actions: "Actions",
    managers: "Managers",
    projects: "Projets",
    decisions: "Mémoire décisionnelle",
    journal: "Journal du Directeur",
    documents: "Documents"
  };

  document.getElementById("viewTitle").textContent = titles[view] || "DEOS";

  const renderer = window[`render_${view}`];
  if (typeof renderer === "function") renderer();
}

function render_cockpit() {
  const lastDecision = state.decisions[0];
  const openActions = state.actions.filter((a) => !a.done);
  const redProjects = state.projects.filter((p) => p.status === "red");
  const managersToFollow = state.managers.filter((m) => m.status !== "green");

  document.getElementById("app").innerHTML = `
    <div class="card hero">
      <h2>Décision à sécuriser</h2>
      <h3>${lastDecision?.title || "Aucune décision enregistrée"}</h3>
      <p>${lastDecision?.context || ""}</p>
      <span class="muted">${lastDecision?.date || ""}</span>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Actions ouvertes</h2>
        ${openActions.map(actionCard).join("") || "<p>Aucune action ouverte.</p>"}
      </div>

      <div class="card">
        <h2>Projets rouges</h2>
        ${redProjects.map(projectMiniCard).join("") || "<p>Aucun projet rouge.</p>"}
      </div>
    </div>

    <div class="grid three">
      <div class="card">
        <h2>Managers à suivre</h2>
        ${managersToFollow.map(managerMiniCard).join("") || "<p>Aucun manager à suivre.</p>"}
      </div>

      <div class="card">
        <h2>KPI</h2>
        <div class="kpi"><span>Productivité</span><b>À alimenter</b></div>
        <div class="kpi"><span>Litiges</span><b>À alimenter</b></div>
        <div class="kpi"><span>GA</span><b>À alimenter</b></div>
      </div>

      <div class="card">
        <h2>Mémoire</h2>
        <p>Recherche globale active sur managers, projets, décisions et actions.</p>
      </div>
    </div>
  `;
}

function render_actions() {
  document.getElementById("app").innerHTML =
    state.actions.map(actionCard).join("") || "<div class='card'>Aucune action.</div>";
}

function render_managers() {
  document.getElementById("app").innerHTML = `
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
      ${state.managers.map((manager, index) => managerFullCard(manager, index)).join("")}
    </div>
  `;
}

function render_projects() {
  document.getElementById("app").innerHTML = `
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
      ${state.projects.map((project, index) => projectFullCard(project, index)).join("")}
    </div>
  `;
}

function render_journal() {
  document.getElementById("app").innerHTML = `
    <div class="card hero">
      <h2>Journal du Directeur</h2>
      <p class="muted">Trace les faits marquants, décisions, échanges et points de vigilance.</p>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Entrée du jour</h2>
        <div class="item"><strong>Faits marquants</strong><span class="muted">À compléter</span></div>
        <div class="item"><strong>Décisions prises</strong><span class="muted">À compléter</span></div>
        <div class="item"><strong>Personnes rencontrées</strong><span class="muted">À compléter</span></div>
        <div class="item"><strong>Actions à suivre</strong><span class="muted">À compléter</span></div>
      </div>

      <div class="card">
        <h2>Dernières traces</h2>
        <div class="item"><strong>Lancement DEOS</strong><span class="muted">Création du cockpit décisionnel.</span></div>
        <div class="item"><strong>Organisation GitHub</strong><span class="muted">Mise en place du dépôt et de GitHub Pages.</span></div>
      </div>
    </div>
  `;
}

function render_documents() {
  document.getElementById("app").innerHTML = `
    <div class="card hero">
      <h2>Documents & modèles</h2>
      <p class="muted">Modèles prêts à utiliser pour les mails, courriers, CODIR, CSE et notes internes.</p>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Management</h2>
        <div class="item"><strong>Compte rendu CODIR</strong><span class="muted">Faits marquants · décisions · actions · alertes</span></div>
        <div class="item"><strong>Entretien manager</strong><span class="muted">Contexte · objectifs · points forts · vigilance</span></div>
      </div>

      <div class="card">
        <h2>RH / Social</h2>
        <div class="item"><strong>Courrier disciplinaire</strong><span class="muted">Faits · règlement · analyse · sanction</span></div>
        <div class="item"><strong>CSE</strong><span class="muted">Questions · réponses · décisions · points à sécuriser</span></div>
      </div>

      <div class="card">
        <h2>Exploitation</h2>
        <div class="item"><strong>Note incident</strong><span class="muted">Contexte · causes · actions · REX</span></div>
        <div class="item"><strong>Gemba DE</strong><span class="muted">Observation terrain · décision · suivi</span></div>
      </div>

      <div class="card">
        <h2>Communication</h2>
        <div class="item"><strong>Mail professionnel</strong><span class="muted">Objet clair · contexte · demande · échéance</span></div>
        <div class="item"><strong>Note direction</strong><span class="muted">Message court, cadré et diffusable</span></div>
      </div>
    </div>
  `;
}

function actionCard(action) {
  return `
    <div class="item row">
      <div>
        <strong>${action.title}</strong>
        <span class="muted">${action.link || ""}</span>
      </div>
      <span>${action.done ? "✅" : "⬜"}</span>
    </div>
  `;
}

function managerMiniCard(manager) {
  return `
    <div class="item">
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

function projectMiniCard(project) {
  return `
    <div class="item">
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

function decisionCard(decision) {
  return `
    <div class="card">
      <h2>${decision.title}</h2>
      <p>${decision.context || ""}</p>
      <span class="muted">${decision.date || ""} · ${(decision.tags || []).join(", ")}</span>
    </div>
  `;
}

function runSearch(query) {
  const q = query.toLowerCase().trim();

  if (!q) {
    setView("cockpit");
    return;
  }

  const results = [
    ...state.managers.map((item) => ({ type: "Manager", title: item.name, text: item.role })),
    ...state.projects.map((item) => ({ type: "Projet", title: item.name, text: item.next })),
    ...state.decisions.map((item) => ({ type: "Décision", title: item.title, text: item.context })),
    ...state.actions.map((item) => ({ type: "Action", title: item.title, text: item.link }))
  ].filter((item) => `${item.title} ${item.text}`.toLowerCase().includes(q));

  document.getElementById("viewTitle").textContent = "Recherche";

  document.getElementById("app").innerHTML = `
    <div class="card">
      <h2>${results.length} résultat(s)</h2>
      ${results.map((result) => `
        <div class="item">
          <strong>${result.title}</strong>
          <span class="muted">${result.type} · ${result.text || ""}</span>
        </div>
      `).join("")}
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
    note: ""
  });

  saveLocal();
  render_managers();
}

function deleteManager(index) {
  state.managers.splice(index, 1);
  saveLocal();
  render_managers();
}
function openManager(index) {
  const manager = state.managers[index];

  document.getElementById("viewTitle").textContent = manager.name;

  document.getElementById("app").innerHTML = `
    <div class="card hero">
      <h2>${manager.name}</h2>
      <p>${manager.role}</p>
      ${badge(manager.status)}
      <p class="muted">${manager.note || ""}</p>
      <button class="action" onclick="editManager(${index})">✏️ Modifier la fiche</button>
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
        ${(manager.strengths || []).map(item => `<div class="item">${item}</div>`).join("") || "<p>À compléter</p>"}
      </div>

      <div class="card">
        <h2>Points de vigilance</h2>
        ${(manager.watchPoints || []).map(item => `<div class="item">${item}</div>`).join("") || "<p>À compléter</p>"}
      </div>

      <div class="card">
        <h2>Actions</h2>
        ${(manager.actions || []).map(item => `<div class="item">⬜ ${item}</div>`).join("") || "<p>Aucune action</p>"}
      </div>

      <div class="card">
        <h2>Historique</h2>
        <div class="item">Fiche créée dans DEOS</div>
      </div>
    </div>
  `;
}

function editManager(index) {
  const manager = state.managers[index];

  document.getElementById("viewTitle").textContent = "Modifier " + manager.name;

  document.getElementById("app").innerHTML = `
    <div class="card">
      <h2>Modifier la fiche manager</h2>

      <input id="editName" value="${manager.name || ""}" placeholder="Nom">
      <input id="editRole" value="${manager.role || ""}" placeholder="Poste">
      <input id="editPriority" value="${manager.priority || ""}" placeholder="Priorité">
      <input id="editNextMeeting" value="${manager.nextMeeting || ""}" placeholder="Prochain entretien">

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
  `;
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
    strengths: document.getElementById("editStrengths").value.split("\n").map(x => x.trim()).filter(Boolean),
    watchPoints: document.getElementById("editWatchPoints").value.split("\n").map(x => x.trim()).filter(Boolean),
    actions: document.getElementById("editActions").value.split("\n").map(x => x.trim()).filter(Boolean)
  };

  saveLocal();
  openManager(index);
}
function openProject(index) {
  const project = state.projects[index];

  document.getElementById("viewTitle").textContent = project.name;

  document.getElementById("app").innerHTML = `
    <div class="card hero">
      <h2>${project.name}</h2>
      ${badge(project.status)}
      <p>${project.next || ""}</p>
      <button class="action" onclick="editProject(${index})">✏️ Modifier le projet</button>
      <button class="danger" onclick="deleteProject(${index})">Supprimer le projet</button>
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
  `;
}
function editProject(index) {
  const project = state.projects[index];

  document.getElementById("viewTitle").textContent = "Modifier " + project.name;

  document.getElementById("app").innerHTML = `
    <div class="card">
      <h2>Modifier le projet</h2>

      <input id="editProjectName" value="${project.name || ""}" placeholder="Nom du projet">
      <input id="editProjectNext" value="${project.next || ""}" placeholder="Prochaine étape">
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
  `;
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

  localStorage.setItem("deos_projects", JSON.stringify(state.projects));
  openProject(index);
}
function saveProjectsLocal() {
  localStorage.setItem("deos_projects", JSON.stringify(state.projects));
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

  saveProjectsLocal();
  render_projects();
}

function deleteProject(index) {
  if (!confirm("Supprimer ce projet ?")) return;

  state.projects.splice(index, 1);
  saveProjectsLocal();
  render_projects();
}
init();
