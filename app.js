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
    return await response.json();
  } catch {
    return [];
  }
}

function badge(status) {
  return `<span class="badge ${status}">${labels[status] || "À suivre"}</span>`;
}

async function init() {
  state.managers = await load("data/managers.json");
  state.projects = await load("data/projects.json");
  state.decisions = await load("data/decisions.json");
  state.actions = await load("data/actions.json");

  today.textContent = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  document.querySelectorAll(".nav").forEach((button) => {
    button.onclick = () => setView(button.dataset.view);
  });

  searchInput.oninput = (event) => runSearch(event.target.value);

  setView("cockpit");
}

function setView(view) {
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  cconst titles = {
  cockpit: "Cockpit décisionnel",
  actions: "Actions",
  managers: "Managers",
  projects: "Projets",
  decisions: "Mémoire décisionnelle",
  journal: "Journal du Directeur",
  documents: "Documents"
};

  viewTitle.textContent = titles[view];
  window[`render_${view}`]();
}
function render_cockpit() {
  const lastDecision = state.decisions[0];
  const openActions = state.actions.filter((action) => !action.done);
  const redProjects = state.projects.filter((project) => project.status === "red");
  const managersToFollow = state.managers.filter((manager) => manager.status !== "green");

  app.innerHTML = `
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
        ${managersToFollow.map(managerMiniCard).join("") || "<p>Aucun manager critique.</p>"}
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
  app.innerHTML = state.actions.map(actionCard).join("") || "<div class='card'>Aucune action.</div>";
}

function render_managers() {
  app.innerHTML = `
    <div class="grid two">
      ${state.managers.map(managerFullCard).join("")}
    </div>
  `;
}

function render_projects() {
  app.innerHTML = `
    <div class="grid two">
      ${state.projects.map(projectFullCard).join("")}
    </div>
  `;
}

function render_decisions() {
  app.innerHTML = state.decisions.map(decisionCard).join("") || "<div class='card'>Aucune décision.</div>";
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

function managerFullCard(manager) {
  return `
    <div class="card">
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

function projectFullCard(project) {
  return `
    <div class="card">
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
    ...state.managers.map((item) => ({
      type: "Manager",
      title: item.name,
      text: item.role
    })),
    ...state.projects.map((item) => ({
      type: "Projet",
      title: item.name,
      text: item.next
    })),
    ...state.decisions.map((item) => ({
      type: "Décision",
      title: item.title,
      text: item.context
    })),
    ...state.actions.map((item) => ({
      type: "Action",
      title: item.title,
      text: item.link
    }))
  ].filter((item) => `${item.title} ${item.text}`.toLowerCase().includes(q));

  viewTitle.textContent = "Recherche";

  app.innerHTML = `
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
function render_journal() {
  app.innerHTML = `
    <div class="card hero">
      <h2>Journal du Directeur</h2>
      <p class="muted">Trace les faits marquants, décisions, échanges et points de vigilance.</p>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Entrée du jour</h2>
        <div class="item">
          <strong>Faits marquants</strong>
          <span class="muted">À compléter</span>
        </div>
        <div class="item">
          <strong>Décisions prises</strong>
          <span class="muted">À compléter</span>
        </div>
        <div class="item">
          <strong>Personnes rencontrées</strong>
          <span class="muted">À compléter</span>
        </div>
        <div class="item">
          <strong>Actions à suivre</strong>
          <span class="muted">À compléter</span>
        </div>
      </div>

      <div class="card">
        <h2>Dernières traces</h2>
        <div class="item">
          <strong>Lancement DEOS</strong>
          <span class="muted">Création du cockpit décisionnel et de la mémoire des décisions.</span>
        </div>
        <div class="item">
          <strong>Organisation GitHub</strong>
          <span class="muted">Mise en place du dépôt, GitHub Pages et github.dev.</span>
        </div>
      </div>
    </div>
  `;
}

function render_documents() {
  app.innerHTML = `
    <div class="card hero">
      <h2>Documents & modèles</h2>
      <p class="muted">Modèles prêts à utiliser pour les mails, courriers, CODIR, CSE et notes internes.</p>
    </div>

    <div class="grid two">
      <div class="card">
        <h2>Management</h2>
        <div class="item"><strong>Compte rendu CODIR</strong><span class="muted">Faits marquants · décisions · actions · alertes</span></div>
        <div class="item"><strong>Entretien manager</strong><span class="muted">Contexte · objectifs · points forts · vigilance</span></div>
        <div class="item"><strong>Journal managérial</strong><span class="muted">Suivi des échanges et décisions</span></div>
      </div>

      <div class="card">
        <h2>RH / Social</h2>
        <div class="item"><strong>Courrier disciplinaire</strong><span class="muted">Faits · règlement · analyse · sanction</span></div>
        <div class="item"><strong>Réponse OS</strong><span class="muted">Factuel · ferme · ouvert</span></div>
        <div class="item"><strong>CSE</strong><span class="muted">Questions · réponses · décisions · points à sécuriser</span></div>
      </div>

      <div class="card">
        <h2>Exploitation</h2>
        <div class="item"><strong>Note incident</strong><span class="muted">Contexte · causes · actions · REX</span></div>
        <div class="item"><strong>Gemba DE</strong><span class="muted">Observation terrain · décision · suivi</span></div>
        <div class="item"><strong>Litiges</strong><span class="muted">Analyse · montant · cause · action corrective</span></div>
      </div>

      <div class="card">
        <h2>Communication</h2>
        <div class="item"><strong>Mail professionnel</strong><span class="muted">Objet clair · contexte · demande · échéance</span></div>
        <div class="item"><strong>Note direction</strong><span class="muted">Message court, cadré et diffusable</span></div>
        <div class="item"><strong>Compte rendu visite</strong><span class="muted">Synthèse · décisions · suites</span></div>
      </div>
    </div>
  `;
}
init();