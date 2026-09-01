const $ = (selector) => document.querySelector(selector);

function setResult(type, message) {
  $("#result").className = `result ${type}`;
  $("#result").textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  let payload = {};
  try { payload = await response.json(); } catch (_) { /* respuesta sin JSON */ }
  if (!response.ok) {
    const detail = payload.detail;
    const message = typeof detail === "object" ? detail.message : detail;
    throw new Error(message || "No se pudo completar la operación");
  }
  return payload;
}

async function refresh() {
  try {
    const stats = await api("/api/stats");
    $("#total").textContent = stats.total;
    $("#found").textContent = stats.found;
    $("#pending").textContent = stats.pending;
    $("#duplicates").textContent = stats.duplicates;
    $("#unknown").textContent = stats.unknown;
    $("#percent").textContent = `${stats.percent}%`;
    $("#filename").textContent = stats.filename || "Sin inventario cargado";
    $("#progressBar").style.width = `${stats.percent}%`;
    $("#connectionStatus").textContent = "Aplicación local activa";

    const data = await api("/api/items?limit=500");
    $("#itemsBody").innerHTML = data.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td class="${item.found ? "status-found" : "status-pending"}">${item.found ? "Encontrado" : "Pendiente"}</td>
        <td>${escapeHtml(item.scanner_name || "—")}</td>
        <td>${item.scan_count}</td>
      </tr>`).join("") || '<tr><td colspan="4">No hay inventario cargado.</td></tr>';
  } catch (error) {
    $("#connectionStatus").textContent = "Sin conexión";
    setResult("error", error.message);
  }
}

$("#uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = $("#inventoryFile").files[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  form.append("inventory_column", $("#inventoryColumn").value.trim());
  setResult("neutral", "Cargando inventario maestro…");
  try {
    const data = await api("/api/inventory/import", { method: "POST", body: form });
    setResult("found", `Inventario cargado: ${data.total} activos. Ahora cargá el Excel del celular.`);
    await refresh();
  } catch (error) { setResult("error", error.message); }
});

$("#scanFilesForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...$("#scanFiles").files];
  if (!files.length) return;
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("code_column", $("#scanCodeColumn").value.trim());
  setResult("neutral", `Comparando ${files.length} archivo(s)…`);
  try {
    const data = await api("/api/scans/import", { method: "POST", body: form });
    setResult("found", `Comparación terminada: ${data.imported_events} lecturas, ${data.found_events} nuevos encontrados, ${data.repeated_events} repetidos y ${data.unknown_events} desconocidos.`);
    await refresh();
  } catch (error) { setResult("error", error.message); }
});

$("#demoButton").addEventListener("click", async () => {
  try {
    await api("/api/demo", { method: "POST" });
    setResult("found", "Inventario demo cargado. Sus códigos son 000101, 000102 y 000103.");
    await refresh();
  } catch (error) { setResult("error", error.message); }
});

$("#refreshButton").addEventListener("click", refresh);
refresh();
setInterval(refresh, 5000);

