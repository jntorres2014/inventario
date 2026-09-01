(function () {
  const $ = (selector) => document.querySelector(selector);
  const DB_NAME = "inventario-mobile";
  const STORE_NAME = "scans";
  let database;
  let records = [];
  let stream;
  let scanning = false;
  let detector;
  let lastValue = "";
  let lastTime = 0;
  let installPrompt;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      request.onsuccess = () => { database = request.result; resolve(); };
      request.onerror = () => reject(request.error);
    });
  }

  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const loadRecords = () => transaction("readonly", (store) => store.getAll());
  const saveRecord = (record) => transaction("readwrite", (store) => store.add(record));
  const clearRecords = () => transaction("readwrite", (store) => store.clear());

  function cleanCode(value) { return String(value || "").trim(); }
  function setResult(type, text) { $("#result").className = `result ${type}`; $("#result").textContent = text; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

  function render() {
    const unique = new Set(records.map((record) => record.code));
    const repeats = records.filter((record) => record.repeated).length;
    $("#uniqueCount").textContent = unique.size;
    $("#scanCount").textContent = records.length;
    $("#repeatCount").textContent = repeats;
    $("#exportButton").disabled = records.length === 0;
    $("#clearButton").disabled = records.length === 0;
    const latest = [...records].reverse().slice(0, 30);
    $("#records").innerHTML = latest.length ? latest.map((record) => `
      <li><strong>${escapeHtml(record.code)}</strong><span class="${record.repeated ? "repeat" : ""}">${record.repeated ? "Repetido" : new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></li>
    `).join("") : '<li class="empty">Las lecturas aparecerán acá.</li>';
  }

  async function addCode(rawCode) {
    const code = cleanCode(rawCode);
    if (!code) return;
    const operator = $("#operator").value.trim();
    const sector = $("#sector").value.trim();
    localStorage.setItem("inventoryOperator", operator);
    localStorage.setItem("inventorySector", sector);
    const repeated = records.some((record) => record.code === code);
    const record = { code, timestamp: new Date().toISOString(), operator, sector, repeated };
    record.id = await saveRecord(record);
    records.push(record);
    setResult(repeated ? "repeated" : "found", repeated ? `⚠ ${code}: código repetido` : `✓ ${code}: registrado`);
    if (navigator.vibrate) navigator.vibrate(repeated ? [80, 60, 80] : 100);
    render();
  }

  async function startCamera() {
    if (!window.isSecureContext) { setResult("error", "La cámara requiere HTTPS. Instalá la aplicación desde la dirección segura de Ubuntu."); return; }
    if (!("BarcodeDetector" in window)) { setResult("error", "Este navegador no permite la lectura automática. Usá Chrome actualizado o el ingreso manual."); return; }
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      detector = new BarcodeDetector({ formats });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      $("#camera").srcObject = stream;
      await $("#camera").play();
      $("#cameraArea").classList.remove("hidden");
      $("#startCamera").classList.add("hidden");
      $("#stopCamera").classList.remove("hidden");
      scanning = true;
      setResult("neutral", "Apuntá al código de barras.");
      scanLoop();
    } catch (error) { setResult("error", `No se pudo abrir la cámara: ${error.message}`); }
  }

  async function scanLoop() {
    if (!scanning) return;
    try {
      const found = await detector.detect($("#camera"));
      if (found.length) {
        const value = cleanCode(found[0].rawValue);
        const now = Date.now();
        if (value && (value !== lastValue || now - lastTime > 2500)) {
          lastValue = value;
          lastTime = now;
          await addCode(value);
        }
      }
    } catch (_) { /* se reintenta en el siguiente cuadro */ }
    setTimeout(scanLoop, 180);
  }

  function stopCamera() {
    scanning = false;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = undefined;
    $("#cameraArea").classList.add("hidden");
    $("#startCamera").classList.remove("hidden");
    $("#stopCamera").classList.add("hidden");
  }

  function downloadExcel() {
    const blob = window.exportInventoryXlsx(records);
    const sector = ($("#sector").value.trim() || "sector").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `escaneo_${sector}_${date}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setResult("found", `Excel generado con ${records.length} lecturas.`);
  }

  async function initialize() {
    await openDatabase();
    records = await loadRecords();
    $("#operator").value = localStorage.getItem("inventoryOperator") || "";
    $("#sector").value = localStorage.getItem("inventorySector") || "";
    render();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/mobile/sw.js");
    window.addEventListener("online", () => { $("#offlineBadge").textContent = "Con conexión"; });
    window.addEventListener("offline", () => { $("#offlineBadge").textContent = "Listo offline"; });
  }

  $("#manualForm").addEventListener("submit", async (event) => { event.preventDefault(); await addCode($("#manualCode").value); $("#manualCode").value = ""; $("#manualCode").focus(); });
  $("#startCamera").addEventListener("click", startCamera);
  $("#stopCamera").addEventListener("click", stopCamera);
  $("#exportButton").addEventListener("click", downloadExcel);
  $("#clearButton").addEventListener("click", async () => { if (!confirm("¿Vaciar todas las lecturas? Descargá el Excel antes si querés conservarlas.")) return; await clearRecords(); records = []; setResult("neutral", "Jornada vaciada."); render(); });
  $("#operator").addEventListener("change", (event) => localStorage.setItem("inventoryOperator", event.target.value));
  $("#sector").addEventListener("change", (event) => localStorage.setItem("inventorySector", event.target.value));
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; $("#installButton").classList.remove("hidden"); });
  $("#installButton").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = undefined; $("#installButton").classList.add("hidden"); });
  initialize().catch((error) => setResult("error", `No se pudo iniciar: ${error.message}`));
})();

