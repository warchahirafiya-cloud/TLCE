const API = "/api/tlce/control-plane";
const byId = (id) => document.getElementById(id);
let csrfToken = "";

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const error = new Error(`TLCE API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function show(id) {
  for (const section of ["signed-out", "signed-in", "error"]) byId(section).hidden = section !== id;
}

function setConnection(label, state) {
  const node = byId("connection");
  node.textContent = label;
  node.dataset.state = state;
}

function renderModules(modules) {
  const tbody = byId("module-rows");
  tbody.replaceChildren();
  if (!Array.isArray(modules) || modules.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "لا توجد وحدات ضمن نطاق صلاحيتك.";
    row.append(cell);
    tbody.append(row);
    return;
  }
  for (const module of modules) {
    const row = document.createElement("tr");
    for (const value of [module.displayName, module.moduleId, module.version, module.state]) {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "—");
      row.append(cell);
    }
    tbody.append(row);
  }
}

async function loadConsole() {
  show("error");
  setConnection("جارٍ التحقق…", "pending");
  try {
    const session = await request(`${API}/session`);
    if (!session?.authenticated || !session.operator) {
      csrfToken = "";
      show("signed-out");
      setConnection("غير مسجّل", "offline");
      return;
    }
    csrfToken = typeof session.csrfToken === "string" ? session.csrfToken : "";
    byId("operator-name").textContent = session.operator.displayName || "مشغّل TLCE";
    const roles = Array.isArray(session.operator.roles) ? session.operator.roles : [];
    byId("operator-roles").textContent = roles.join(" · ") || "لا توجد أدوار معروضة";
    const [overview, modules] = await Promise.all([
      request(`${API}/overview`),
      request(`${API}/modules`),
    ]);
    byId("registered").textContent = String(overview.registeredModules ?? 0);
    byId("ready").textContent = String(overview.readyModules ?? 0);
    byId("degraded").textContent = String(overview.degradedModules ?? 0);
    byId("failed").textContent = String(overview.failedModules ?? 0);
    renderModules(modules.modules);
    show("signed-in");
    setConnection("اتصال موثّق", "online");
  } catch (error) {
    if (error.status === 401) {
      csrfToken = "";
      show("signed-out");
      setConnection("غير مسجّل", "offline");
      return;
    }
    byId("error-message").textContent = "خدمة هوية TLCE أو واجهة التحكم غير متاحة حالياً. لم يتم تجاوز الحماية أو استخدام بيانات تجريبية.";
    show("error");
    setConnection("الخدمة غير متاحة", "offline");
  }
}

byId("logout").addEventListener("click", async () => {
  if (!csrfToken) return;
  try {
    await request("/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
  } finally {
    csrfToken = "";
    await loadConsole();
  }
});
byId("retry").addEventListener("click", loadConsole);
loadConsole();
