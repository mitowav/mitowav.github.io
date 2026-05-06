// =============================================
//   mitø — SCRIPT.JS
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  /* ===== SUPABASE ===== */
  const SUPABASE_URL = "https://dchmegrnghagvjpqvlbg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaG1lZ3JuZ2hhZ3ZqcHF2bGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTI2MDksImV4cCI6MjA5MzU4ODYwOX0.CeiSFDLEBBqGXfBE_mKcXzjlutkjeh0DkQyGgbl82PU";

  let db = null;
  try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
  catch(e) { console.warn("Supabase error:", e.message); }

  const CLAVE_SECRETA = "1234";
  let esPrivado = false;
  let loginDestino = "privado";

  // Player global — solo uno activo a la vez
  let activePlayer = null;

  // ─── NAVEGACIÓN ──────────────────────────────

  function go(id, btnEl, closeMenu) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
    if (btnEl) {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btnEl.classList.add("active");
    }
    if (closeMenu) toggleMenu(true);
    if (id === "beats")   cargarBeats("beats-list", false);
    if (id === "home")    cargarBeats("home-beats", false, 3);
    if (id === "privado") cargarBeats("admin-list", true);
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
    if (input === CLAVE_SECRETA) { cerrarLogin(); go(loginDestino); }
    else {
      errorEl.textContent = "Clave incorrecta ✕";
      document.getElementById("clave-input").value = "";
      document.getElementById("clave-input").focus();
    }
  }

  window.openLogin = openLogin;
  window.cerrarLogin = cerrarLogin;
  window.cerrarLoginOverlay = cerrarLoginOverlay;
  window.comprobarClave = comprobarClave;

  // ─── VISIBILIDAD ─────────────────────────────

  window.setVisibilidad = function(privado) {
    esPrivado = privado;
    document.getElementById("vis-publico").classList.toggle("active", !privado);
    document.getElementById("vis-privado").classList.toggle("active", privado);
  };

  window.updateFileName = function(input) {
    document.getElementById("file-name-label").textContent =
      input.files?.[0]?.name || "Elige un archivo de audio";
  };

  // ─── SUBIR BEAT ──────────────────────────────

  window.subirBeat = async function() {
    if (!db) { alert("Supabase no configurado"); return; }
    const title = document.getElementById("beat-title").value.trim();
    const genre = document.getElementById("beat-genre").value.trim();
    const file  = document.getElementById("audio-file").files[0];
    const btn   = document.querySelector(".upload-form .btn-primary");
    if (!file) { alert("Selecciona un archivo de audio"); return; }

    btn.textContent = "Subiendo..."; btn.disabled = true;

    try {
      const cleanName = file.name.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}-${cleanName}`;

      const { error: uploadError } = await db.storage.from("beats").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = db.storage.from("beats").getPublicUrl(fileName);

      const { error: dbError } = await db.from("beats").insert([{
        title: title || "Sin título", genre: genre || "—",
        audio_url: urlData.publicUrl, privado: esPrivado
      }]);
      if (dbError) throw dbError;

      ["beat-title","beat-genre","audio-file"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("file-name-label").textContent = "Elige un archivo de audio";
      btn.textContent = "¡Subido! 🔥";
      setTimeout(() => { btn.textContent = "Subir beat 🔥"; btn.disabled = false; }, 2000);
      cargarBeats("admin-list", true);

    } catch(err) {
      console.error("Error al subir:", err);
      alert("Error: " + (err.message || "revisa la consola"));
      btn.textContent = "Subir beat 🔥"; btn.disabled = false;
    }
  };

  // ─── PLAYER PERSONALIZADO CON WAVEFORM ───────

  function crearPlayer(beat, index) {
    const wrap = document.createElement("div");
    wrap.className = "beat-card";
    wrap.dataset.id = beat.id;

    // Generar barras de waveform falsas (aleatorias pero seed por id para que sean consistentes)
    const bars = generarBars(beat.id || index);

    wrap.innerHTML = `
      <span class="beat-num">${String(index + 1).padStart(2, "0")}</span>
      <div class="beat-info">
        <h3>${escapeHtml(beat.title)}</h3>
        <p>${escapeHtml(beat.genre)}</p>
      </div>
      ${beat.privado ? `<span class="beat-priv-tag"><i class="fa-solid fa-lock"></i> PRIV</span>` : ""}
      <div class="custom-player" data-src="${beat.audio_url}">
        <button class="play-btn" title="Play/Pause">
          <i class="fa-solid fa-play"></i>
        </button>
        <div class="player-right">
          <div class="waveform-wrap">
            <div class="waveform">${bars}</div>
            <div class="waveform-progress" style="width:0%">
              <div class="waveform waveform-filled">${bars}</div>
            </div>
            <div class="waveform-cursor"></div>
          </div>
          <div class="player-meta">
            <span class="time-current">0:00</span>
            <span class="time-total">—</span>
          </div>
        </div>
      </div>
    `;

    // Inicializa el player
    initPlayer(wrap);
    return wrap;
  }

  function generarBars(seed) {
    let s = typeof seed === "number" ? seed : 42;
    function rand() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    }
    let html = "";
    for (let i = 0; i < 60; i++) {
      const h = 18 + Math.floor(rand() * 52); // entre 18 y 70%
      html += `<span style="height:${h}%"></span>`;
    }
    return html;
  }

  function initPlayer(card) {
    const playerEl  = card.querySelector(".custom-player");
    const playBtn   = card.querySelector(".play-btn");
    const waveWrap  = card.querySelector(".waveform-wrap");
    const progress  = card.querySelector(".waveform-progress");
    const cursor    = card.querySelector(".waveform-cursor");
    const timeCur   = card.querySelector(".time-current");
    const timeTotal = card.querySelector(".time-total");
    const src       = playerEl.dataset.src;

    let audio = null;
    let playing = false;

    function getAudio() {
      if (!audio) {
        audio = new Audio(src);
        audio.addEventListener("loadedmetadata", () => {
          timeTotal.textContent = formatTime(audio.duration);
        });
        audio.addEventListener("timeupdate", () => {
          if (!audio.duration) return;
          const pct = (audio.currentTime / audio.duration) * 100;
          progress.style.width = pct + "%";
          cursor.style.left = pct + "%";
          timeCur.textContent = formatTime(audio.currentTime);
        });
        audio.addEventListener("ended", () => {
          playing = false;
          playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
          card.classList.remove("is-playing");
          progress.style.width = "0%";
          cursor.style.left = "0%";
          timeCur.textContent = "0:00";
        });
      }
      return audio;
    }

    playBtn.addEventListener("click", () => {
      const a = getAudio();
      // Pausa cualquier otro player activo
      if (activePlayer && activePlayer !== audio) {
        activePlayer.pause();
        document.querySelectorAll(".beat-card.is-playing").forEach(c => {
          c.classList.remove("is-playing");
          c.querySelector(".play-btn").innerHTML = `<i class="fa-solid fa-play"></i>`;
        });
      }
      if (playing) {
        a.pause(); playing = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        card.classList.remove("is-playing");
        activePlayer = null;
      } else {
        a.play(); playing = true;
        playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
        card.classList.add("is-playing");
        activePlayer = a;
      }
    });

    // Click en waveform para seek
    waveWrap.addEventListener("click", (e) => {
      const a = getAudio();
      if (!a.duration) return;
      const rect = waveWrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      a.currentTime = pct * a.duration;
      progress.style.width = (pct * 100) + "%";
      cursor.style.left = (pct * 100) + "%";
    });
  }

  function formatTime(s) {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // ─── CARGAR BEATS ────────────────────────────

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
        cont.innerHTML = `<p class="loading-msg">${soloPrivados ? "No hay beats privados aún." : "No hay beats públicos aún. 🎧"}</p>`;
        return;
      }

      cont.innerHTML = "";
      data.forEach((beat, i) => cont.appendChild(crearPlayer(beat, i)));

    } catch(err) {
      console.error("Error al cargar beats:", err);
      cont.innerHTML = `<p class="loading-msg">Error al cargar.</p>`;
    }
  }

  // ─── HELPERS ────────────────────────────────

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;")
              .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ─── INIT ────────────────────────────────────
  go("home");

});
