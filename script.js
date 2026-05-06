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

  /* ===== CLAVE DE ACCESO PRIVADO =====
     Cambia "1234" por la clave que quieras
  ===== */
  const CLAVE_SECRETA = "1234";

  // ─── PÁGINAS ──────────────────────────────────────

  function go(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
    if (id === "music") cargarBeats("beats-list");
    if (id === "secret") cargarBeats("admin-list");
  }

  window.go = go;

  // ─── LOGIN ──────────────────────────────────────

  function openLogin() {
    document.getElementById("login-overlay").classList.add("visible");
    document.getElementById("clave-input").focus();
    document.getElementById("error-msg").textContent = "";
  }

  function cerrarLogin() {
    document.getElementById("login-overlay").classList.remove("visible");
    document.getElementById("clave-input").value = "";
    document.getElementById("error-msg").textContent = "";
  }

  function cerrarLoginOverlay(e) {
    if (e.target === document.getElementById("login-overlay")) {
      cerrarLogin();
    }
  }

  function comprobarClave() {
    const input = document.getElementById("clave-input").value;
    const errorEl = document.getElementById("error-msg");

    if (input === CLAVE_SECRETA) {
      cerrarLogin();
      go("secret");
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

  // ─── NOMBRE DE ARCHIVO ──────────────────────────

  window.updateFileName = function(input) {
    const label = document.getElementById("file-name-label");
    if (input.files && input.files[0]) {
      label.textContent = input.files[0].name;
    }
  };

  // ─── SUBIR BEAT ──────────────────────────────────

  window.subirBeat = async function () {
    if (!db) { alert("Supabase no está configurado"); return; }

    const title = document.getElementById("beat-title").value.trim();
    const genre = document.getElementById("beat-genre").value.trim();
    const file  = document.getElementById("audio-file").files[0];
    const btn   = document.querySelector(".upload-card .btn-gold");

    if (!file) {
      alert("Selecciona un archivo de audio primero");
      return;
    }

    btn.textContent = "Subiendo...";
    btn.disabled = true;

    try {
      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}-${cleanName}`;

      const { error: uploadError } = await db.storage
        .from("beats")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = db.storage
        .from("beats")
        .getPublicUrl(fileName);

      const { error: dbError } = await db.from("beats").insert([{
        title: title || "Sin título",
        genre: genre || "—",
        audio_url: urlData.publicUrl
      }]);

      if (dbError) throw dbError;

      document.getElementById("beat-title").value = "";
      document.getElementById("beat-genre").value = "";
      document.getElementById("audio-file").value = "";
      document.getElementById("file-name-label").textContent = "Elige un archivo de audio";

      btn.textContent = "¡Subido! 🔥";
      setTimeout(() => {
        btn.textContent = "Subir beat 🔥";
        btn.disabled = false;
      }, 2000);

      cargarBeats("admin-list");

    } catch (err) {
      console.error("Error al subir beat:", err);
      alert("Error al subir: " + (err.message || "revisa la consola"));
      btn.textContent = "Subir beat 🔥";
      btn.disabled = false;
    }
  };

  // ─── CARGAR BEATS ──────────────────────────────────

  async function cargarBeats(containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return;

    if (!db) {
      cont.innerHTML = `<p class="loading-msg">Supabase no configurado.</p>`;
      return;
    }

    cont.innerHTML = `<p class="loading-msg">Cargando...</p>`;

    try {
      const { data, error } = await db
        .from("beats")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        cont.innerHTML = `<p class="loading-msg">Aún no hay beats. ¡Sube el primero! 🎧</p>`;
        return;
      }

      cont.innerHTML = "";
      data.forEach(beat => {
        const card = document.createElement("div");
        card.className = "beat-card";
        card.innerHTML = `
          <h3>${escapeHtml(beat.title)}</h3>
          <p>${escapeHtml(beat.genre)}</p>
          <audio controls src="${beat.audio_url}" preload="none"></audio>
        `;
        cont.appendChild(card);
      });

    } catch (err) {
      console.error("Error al cargar beats:", err);
      cont.innerHTML = `<p class="loading-msg">Error al cargar beats.</p>`;
    }
  }

  // ─── HELPERS ──────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── INIT ──────────────────────────────────────

  go("home");

});
