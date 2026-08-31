const $ = (selector) => document.querySelector(selector);
const result = $("#result");
let mediaStream = null;
let scanning = false;
let lastDetection = 0;

function setResult(type, message) {
  result.className = `result ${type}`;
  result.textContent = message;
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
    $("#percent").textContent = `${stats.percent}%`;
    $("#filename").textContent = stats.filename || "Sin archivo cargado";
    $("#progressBar").style.width = `${stats.percent}%`;
    $("#connectionStatus").textContent = "Servidor local activo";

    const data = await api("/api/items?limit=100");
    $("#itemsBody").innerHTML = data.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td class="${item.found ? "status-found" : "status-pending"}">${item.found ? "Encontrado" : "Pendiente"}</td>
        <td>${escapeHtml(item.scanner_name || "—")}</td>
      </tr>`).join("") || '<tr><td colspan="3">No hay inventario cargado.</td></tr>';
  } catch (error) {
    $("#connectionStatus").textContent = "Sin conexión";
    setResult("error", error.message);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

async function submitCode(code) {
  const scannerName = $("#scannerName").value.trim() || "Sin identificar";
  localStorage.setItem("inventoryScannerName", scannerName);
  try {
    const data = await api("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, scanner_name: scannerName })
    });
    const messages = {
      found: `✓ ${data.code}: equipo encontrado`,
      repeated: `⚠ ${data.code}: ya había sido inventariado`,
      unknown: `✕ ${data.code}: no existe en el Excel`
    };
    setResult(data.status, messages[data.status]);
    if (navigator.vibrate) navigator.vibrate(data.status === "found" ? 120 : [80, 80, 80]);
    $("#code").value = "";
    await refresh();
  } catch (error) {
    setResult("error", error.message);
  }
}

$("#scanForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitCode($("#code").value.trim());
});

$("#uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData();
  const file = $("#inventoryFile").files[0];
  if (!file) return;
  form.append("file", file);
  form.append("inventory_column", $("#inventoryColumn").value.trim());
  setResult("neutral", "Cargando Excel…");
  try {
    const data = await api("/api/inventory/import", { method: "POST", body: form });
    const duplicateText = data.duplicates_in_file.length
      ? ` Se omitieron ${data.duplicates_in_file.length} duplicados del archivo.` : "";
    setResult("found", `Se cargaron ${data.total} activos.${duplicateText}`);
    await refresh();
  } catch (error) {
    setResult("error", error.message);
  }
});

$("#demoButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/demo", { method: "POST" });
    setResult("found", `Demo lista. Probá: ${data.codes.join(", ")}`);
    await refresh();
  } catch (error) { setResult("error", error.message); }
});

$("#refreshButton").addEventListener("click", refresh);

async function startCamera() {
  if (!window.isSecureContext) {
    setResult("error", "La cámara requiere HTTPS cuando se abre desde otro dispositivo. Podés probar ingresando el número manualmente.");
    return;
  }
  if (!("BarcodeDetector" in window)) {
    setResult("error", "Este navegador no ofrece detección automática. Usá el ingreso manual por ahora.");
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false
    });
    const video = $("#camera");
    video.srcObject = mediaStream;
    await video.play();
    $("#cameraArea").classList.remove("hidden");
    $("#stopCameraButton").classList.remove("hidden");
    $("#cameraButton").classList.add("hidden");
    scanning = true;
    setResult("neutral", "Apuntá la cámara al código de barras…");
    detectLoop(new BarcodeDetector());
  } catch (error) {
    setResult("error", `No se pudo abrir la cámara: ${error.message}`);
  }
}

async function detectLoop(detector) {
  if (!scanning) return;
  const now = Date.now();
  if (now - lastDetection > 250 && $("#camera").readyState >= 2) {
    lastDetection = now;
    try {
      const codes = await detector.detect($("#camera"));
      if (codes.length) {
        stopCamera();
        await submitCode(codes[0].rawValue);
        return;
      }
    } catch (_) { /* continuar intentando */ }
  }
  requestAnimationFrame(() => detectLoop(detector));
}

function stopCamera() {
  scanning = false;
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  $("#cameraArea").classList.add("hidden");
  $("#stopCameraButton").classList.add("hidden");
  $("#cameraButton").classList.remove("hidden");
}

$("#cameraButton").addEventListener("click", startCamera);
$("#stopCameraButton").addEventListener("click", stopCamera);
$("#scannerName").value = localStorage.getItem("inventoryScannerName") || "";
refresh();
setInterval(refresh, 5000);

