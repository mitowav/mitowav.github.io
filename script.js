
// =============================================
//   mitø — SCRIPT.JS
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  /* ===== SUPABASE ===== */
  const SUPABASE_URL = "https://dchmegrnghagvjpqvlbg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaG1lZ3JuZ2hhZ3ZqcHF2bGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTI2MDksImV4cCI6MjA5MzU4ODYwOX0.CeiSFDLEBBqGXfBE_mKcXzjlutkjeh0DkQyGgbl82PU";

  let db = null;
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch(e) {
    console.warn("Supabase error:", e.message);
  }

  /* ===== CONFIG ===== */
  const CLAVE_SECRETA = "1234"; // ← cámbiala!

  // Estado: si el beat a subir es privado o no
  let esPrivado = false;

  // Página destino tras login
  let loginDestino = "privado";

  // ─── NAVEGACIÓN ──────────────────────────────

  function go(id, btnEl, closeMenu) {
    // Actualiza página activa
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");

    // Actualiza nav button activo
    if (btnEl) {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btnEl.classList.add("active");
    }

    // Cierra menú móvil si toca
    if (closeMenu) toggleMenu(true);

    // Carga datos según página
    if (id === "beats")   cargarBeats("beats-list", false);
    if (id === "home")    cargarBeats("home-beats", false, 3);
    if (id === "privado") {
      cargarBeats("admin-list", true);
    }
  }

  window.go = go;

  // ─── MENÚ MÓVIL ──────────────────────────────

  function toggleMenu(forceClose) {
    const m = document.getElementById("mobile-menu");
    if (forceClose) { m.classList.remove("open"); return; }
    m.classList.toggle("open");
  }

  window.toggleMenu = toggleMenu;

  // ─── LOGIN ──────────────────────────────────

  function openLogin(destino) {
    loginDestino = destino || "privado";
    document.getElementById("login-overlay").classList.add("visible");
    setTimeout(() => document.getElementById("clave-input").focus(), 100);
    document.getElementById("error-msg").textContent = "";
    document.getElementById("clave-input").value = "";
  }

  function cerrarLogin() {
    document.getElementById("login-overlay").classList.remove("visible");
    document.getElementById("clave-input").value = "";
    document.getElementById("error-msg").textContent = "";
  }

  function cerrarLoginOverlay(e) {
    if (e.target === document.getElementById("login-overlay")) cerrarLogin();
  }

  function comprobarClave() {
    const input = document.getElementById("clave-input").value;
    const errorEl = document.getElementById("error-msg");
    if (input === CLAVE_SECRETA) {
      cerrarLogin();
      go(loginDestino);
    } else {
      errorEl.textContent = "Clave incorrecta ✕";
      document.getElementById("clave-input").value = "";
      document.getElementById("clave-input").focus();
    }
  }

  window.openLogin = openLogin;
  window.cerrarLogin = cerrarLogin;
  window.cerrarLoginOverlay = cerrarLoginOverlay;
  window.comprobarClave = comprobarClave;

  // ─── VISIBILIDAD DEL BEAT ─────────────────────

  window.setVisibilidad = function(privado) {
    esPrivado = privado;
    document.getElementById("vis-publico").classList.toggle("active", !privado);
    document.getElementById("vis-privado").classList.toggle("active", privado);
  };

  // ─── NOMBRE DE ARCHIVO ────────────────────────

  window.updateFileName = function(input) {
    const label = document.getElementById("file-name-label");
    label.textContent = input.files?.[0]?.name || "Elige un archivo de audio";
  };

  // ─── SUBIR BEAT ──────────────────────────────

  window.subirBeat = async function() {
    if (!db) { alert("Supabase no configurado"); return; }

    const title = document.getElementById("beat-title").value.trim();
    const genre = document.getElementById("beat-genre").value.trim();
    const file  = document.getElementById("audio-file").files[0];
    const btn   = document.querySelector(".upload-form .btn-primary");

    if (!file) { alert("Selecciona un archivo de audio"); return; }

    btn.textContent = "Subiendo...";
    btn.disabled = true;

    try {
      // Limpia el nombre del archivo
      const cleanName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}-${cleanName}`;

      // 1. Subir audio al storage
      const { error: uploadError } = await db.storage
        .from("beats").upload(fileName, file);
      if (uploadError) throw uploadError;

      // 2. URL pública
      const { data: urlData } = db.storage
        .from("beats").getPublicUrl(fileName);

      // 3. Guardar en tabla con campo privado
      const { error: dbError } = await db.from("beats").insert([{
        title: title || "Sin título",
        genre: genre || "—",
        audio_url: urlData.publicUrl,
        privado: esPrivado
      }]);
      if (dbError) throw dbError;

      // Reset form
      document.getElementById("beat-title").value = "";
      document.getElementById("beat-genre").value = "";
      document.getElementById("audio-file").value = "";
      document.getElementById("file-name-label").textContent = "Elige un archivo de audio";

      btn.textContent = "¡Subido! 🔥";
      setTimeout(() => { btn.textContent = "Subir beat 🔥"; btn.disabled = false; }, 2000);

      // Recarga la lista privada
      cargarBeats("admin-list", true);

    } catch(err) {
      console.error("Error al subir:", err);
      alert("Error: " + (err.message || "revisa la consola"));
      btn.textContent = "Subir beat 🔥";
      btn.disabled = false;
    }
  };

  // ─── CARGAR BEATS ────────────────────────────
  // soloPrivados: true → solo privados | false → solo públicos
  // limite: número máximo de beats a mostrar (opcional)

  async function cargarBeats(containerId, soloPrivados, limite) {
    const cont = document.getElementById(containerId);
    if (!cont || !db) return;

    cont.innerHTML = `<p class="loading-msg">Cargando...</p>`;

    try {
      let query = db.from("beats").select("*")
        .eq("privado", soloPrivados)
        .order("id", { ascending: false });

      if (limite) query = query.limit(limite);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        cont.innerHTML = `<p class="loading-msg">${soloPrivados ? "No hay beats privados aún." : "No hay beats públicos aún."}</p>`;
        return;
      }

      cont.innerHTML = "";
      data.forEach((beat, i) => {
        const card = document.createElement("div");
        card.className = "beat-card";
        card.innerHTML = `
          <span class="beat-num">${String(i + 1).padStart(2, "0")}</span>
          <div class="beat-info">
            <h3>${escapeHtml(beat.title)}</h3>
            <p>${escapeHtml(beat.genre)}</p>
          </div>
          ${beat.privado ? `<span class="beat-priv-tag"><i class="fa-solid fa-lock"></i> PRIVADO</span>` : ""}
          <div class="beat-audio">
            <audio controls src="${beat.audio_url}" preload="none"></audio>
          </div>
        `;
        cont.appendChild(card);
      });

    } catch(err) {
      console.error("Error al cargar beats:", err);
      cont.innerHTML = `<p class="loading-msg">Error al cargar.</p>`;
    }
  }

  // ─── HELPERS ────────────────────────────────

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ─── INIT ────────────────────────────────────

  go("home");

});
