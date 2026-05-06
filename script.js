// =============================================
//   mitø — SCRIPT.JS (clean rewrite)
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  const SUPABASE_URL = "https://dchmegrnghagvjpqvlbg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaG1lZ3JuZ2hhZ3ZqcHF2bGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTI2MDksImV4cCI6MjA5MzU4ODYwOX0.CeiSFDLEBBqGXfBE_mKcXzjlutkjeh0DkQyGgbl82PU";
  const CLAVE_SECRETA = "1234"; // ← cámbiala

  let db = null;
  try { db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
  catch(e) { console.warn("Supabase:", e.message); }

  let esPrivado = false;
  let loginDestino = "privado";
  let activeAudio = null;
  let activeCard = null;

  // ── NAV ──────────────────────────────────────

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

  function toggleMenu(forceClose) {
    const m = document.getElementById("mobile-menu");
    if (forceClose) { m.classList.remove("open"); return; }
    m.classList.toggle("open");
  }
  window.toggleMenu = toggleMenu;

  // ── LOGIN ─────────────────────────────────────

  function openLogin(destino) {
    loginDestino = destino || "privado";
    document.getElementById("login-overlay").classList.add("visible");
    document.getElementById("error-msg").textContent = "";
    document.getElementById("clave-input").value = "";
    setTimeout(() => document.getElementById("clave-input").focus(), 120);
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
    const v = document.getElementById("clave-input").value;
    if (v === CLAVE_SECRETA) { cerrarLogin(); go(loginDestino); }
    else {
      document.getElementById("error-msg").textContent = "Clave incorrecta ✕";
      document.getElementById("clave-input").value = "";
      document.getElementById("clave-input").focus();
    }
  }
  window.openLogin = openLogin;
  window.cerrarLogin = cerrarLogin;
  window.cerrarLoginOverlay = cerrarLoginOverlay;
  window.comprobarClave = comprobarClave;

  // ── VISIBILIDAD ───────────────────────────────

  window.setVisibilidad = function(priv) {
    esPrivado = priv;
    document.getElementById("vis-publico").classList.toggle("active", !priv);
    document.getElementById("vis-privado").classList.toggle("active", priv);
  };
  window.updateFileName = function(input) {
    document.getElementById("file-name-label").textContent =
      input.files?.[0]?.name || "Elige un archivo de audio";
  };

  // ── SUBIR BEAT ────────────────────────────────

  window.subirBeat = async function() {
    if (!db) { alert("Supabase no configurado"); return; }
    const title = document.getElementById("beat-title").value.trim();
    const genre = document.getElementById("beat-genre").value.trim();
    const file  = document.getElementById("audio-file").files[0];
    const btn   = document.querySelector(".upload-form .btn-primary");
    if (!file) { alert("Selecciona un archivo de audio"); return; }

    btn.textContent = "Analizando audio..."; btn.disabled = true;

    try {
      // 1. Analizar la forma de onda ANTES de subir
      const waveformData = await analizarWaveform(file);

      btn.textContent = "Subiendo...";

      // 2. Limpiar nombre y subir al storage
      const cleanName = file.name.normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
      const fileName = `${Date.now()}-${cleanName}`;

      const { error: upErr } = await db.storage.from("beats").upload(fileName, file);
      if (upErr) throw upErr;

      const { data: urlData } = db.storage.from("beats").getPublicUrl(fileName);

      // 3. Guardar en tabla con waveform
      const { error: dbErr } = await db.from("beats").insert([{
        title: title || "Sin título", genre: genre || "—",
        audio_url: urlData.publicUrl, privado: esPrivado,
        waveform: JSON.stringify(waveformData)
      }]);
      if (dbErr) throw dbErr;

      ["beat-title","beat-genre","audio-file"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("file-name-label").textContent = "Elige un archivo de audio";
      btn.textContent = "¡Subido! 🔥";
      setTimeout(() => { btn.textContent = "Subir beat 🔥"; btn.disabled = false; }, 2000);
      cargarBeats("admin-list", true);
    } catch(err) {
      console.error(err);
      alert("Error: " + (err.message || "revisa la consola"));
      btn.textContent = "Subir beat 🔥"; btn.disabled = false;
    }
  };

  // ── ANALIZAR WAVEFORM REAL ────────────────────
  // Lee el MP3, lo decodifica con Web Audio API y
  // extrae 55 valores de amplitud normalizados (0-100)

  async function analizarWaveform(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const arrayBuffer = e.target.result;
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

          // Usa el canal izquierdo (o el único si es mono)
          const rawData = audioBuffer.getChannelData(0);
          const samples = 55;
          const blockSize = Math.floor(rawData.length / samples);
          const peaks = [];

          for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
              sum += Math.abs(rawData[i * blockSize + j]);
            }
            peaks.push(sum / blockSize);
          }

          // Normaliza entre 15 y 95 para que no queden barras demasiado pequeñas
          const max = Math.max(...peaks);
          const normalized = peaks.map(v => Math.round(15 + (v / max) * 80));

          audioCtx.close();
          resolve(normalized);
        } catch(err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // ── WAVEFORM GENERATOR ────────────────────────
  // Si el beat tiene datos reales los usa; si no, genera aleatorios

  function generateBars(beat, index) {
    // Intenta usar waveform real guardada en Supabase
    if (beat && beat.waveform) {
      try {
        const data = typeof beat.waveform === "string"
          ? JSON.parse(beat.waveform)
          : beat.waveform;
        if (Array.isArray(data) && data.length > 0) {
          return data.map(h => `<span style="height:${h}%"></span>`).join("");
        }
      } catch(e) { /* fallback a aleatorio */ }
    }

    // Fallback: aleatorio consistente por seed
    let s = ((beat && beat.id) ? beat.id : (index * 7 + 13)) % 99999 + 1;
    function rand() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return ((s >>> 0) / 0xffffffff);
    }
    let html = "";
    for (let i = 0; i < 55; i++) {
      html += `<span style="height:${Math.round(15 + rand() * 68)}%"></span>`;
    }
    return html;
  }

  // ── CREAR CARD CON PLAYER ─────────────────────

  function crearCard(beat, index, admin) {
    const card = document.createElement("div");
    card.className = "beat-card";

    const bars = generateBars(beat, index);

    card.innerHTML = `
      <span class="beat-num">${String(index + 1).padStart(2, "0")}</span>
      <div class="beat-info">
        <h3>${esc(beat.title)}</h3>
        <p>${esc(beat.genre)}</p>
      </div>
      ${beat.privado ? `<span class="beat-priv-tag"><i class="fa-solid fa-lock"></i> PRIV</span>` : ""}
      <div class="custom-player">
        <button class="play-btn"><i class="fa-solid fa-play"></i></button>
        <div class="player-right">
          <div class="waveform-wrap">
            <div class="waveform">${bars}</div>
            <div class="waveform-progress">
              <div class="waveform-filled">${bars}</div>
            </div>
            <div class="waveform-cursor"></div>
          </div>
          <div class="player-meta">
            <span class="time-cur">0:00</span>
            <span class="time-tot">—</span>
          </div>
        </div>
      </div>
      ${admin ? `<button class="delete-btn" title="Borrar beat"><i class="fa-solid fa-trash"></i></button>` : ""}
    `;

    // Ajusta ancho del waveform-filled una vez en el DOM
    requestAnimationFrame(() => {
      const wrap = card.querySelector(".waveform-wrap");
      const filled = card.querySelector(".waveform-filled");
      if (wrap && filled) filled.style.width = wrap.offsetWidth + "px";
    });

    // Botón borrar
    if (admin) {
      const delBtn = card.querySelector(".delete-btn");
      delBtn.addEventListener("click", async () => {
        if (!confirm(`¿Borrar "${beat.title}"?`)) return;
        delBtn.disabled = true;
        delBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        try {
          // Borra de la tabla
          const { error } = await db.from("beats").delete().eq("id", beat.id);
          if (error) throw error;
          // Anima la tarjeta antes de quitarla
          card.style.transition = "opacity 0.3s, transform 0.3s";
          card.style.opacity = "0";
          card.style.transform = "translateX(20px)";
          setTimeout(() => card.remove(), 310);
        } catch(err) {
          console.error(err);
          alert("Error al borrar: " + (err.message || "revisa la consola"));
          delBtn.disabled = false;
          delBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
        }
      });
    }

    // Init player
    const playBtn   = card.querySelector(".play-btn");
    const waveWrap  = card.querySelector(".waveform-wrap");
    const prog      = card.querySelector(".waveform-progress");
    const cursor    = card.querySelector(".waveform-cursor");
    const timeCur   = card.querySelector(".time-cur");
    const timeTot   = card.querySelector(".time-tot");

    let audio = null;
    let isPlaying = false;

    function getAudio() {
      if (audio) return audio;
      audio = new Audio(beat.audio_url);
      audio.addEventListener("loadedmetadata", () => {
        timeTot.textContent = fmt(audio.duration);
      });
      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        prog.style.width = pct + "%";
        cursor.style.left = pct + "%";
        timeCur.textContent = fmt(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        isPlaying = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        card.classList.remove("is-playing");
        prog.style.width = "0%";
        cursor.style.left = "0%";
        timeCur.textContent = "0:00";
        activeAudio = null; activeCard = null;
      });
      return audio;
    }

    function stopOthers() {
      if (activeAudio && activeAudio !== audio) {
        activeAudio.pause();
        if (activeCard) {
          activeCard.classList.remove("is-playing");
          activeCard.querySelector(".play-btn").innerHTML = `<i class="fa-solid fa-play"></i>`;
          activeCard.querySelector(".waveform-progress").style.width = "0%";
          activeCard.querySelector(".waveform-cursor").style.left = "0%";
          activeCard.querySelector(".time-cur").textContent = "0:00";
        }
      }
    }

    playBtn.addEventListener("click", () => {
      const a = getAudio();
      if (isPlaying) {
        a.pause(); isPlaying = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        card.classList.remove("is-playing");
        activeAudio = null; activeCard = null;
      } else {
        stopOthers();
        a.play(); isPlaying = true;
        playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
        card.classList.add("is-playing");
        activeAudio = a; activeCard = card;
      }
    });

    waveWrap.addEventListener("click", (e) => {
      const a = getAudio();
      if (!a.duration) return;
      const rect = waveWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      a.currentTime = pct * a.duration;
      prog.style.width = (pct * 100) + "%";
      cursor.style.left = (pct * 100) + "%";
    });

    return card;
  }

  // ── CARGAR BEATS ─────────────────────────────

  async function cargarBeats(containerId, soloPrivados, limite) {
    const cont = document.getElementById(containerId);
    if (!cont || !db) return;
    cont.innerHTML = `<p class="loading-msg">Cargando...</p>`;
    try {
      let q = db.from("beats").select("*")
        .eq("privado", soloPrivados)
        .order("id", { ascending: false });
      if (limite) q = q.limit(limite);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) {
        cont.innerHTML = `<p class="loading-msg">${soloPrivados ? "No hay beats privados aún." : "No hay beats públicos aún. 🎧"}</p>`;
        return;
      }
      cont.innerHTML = "";
      data.forEach((beat, i) => cont.appendChild(crearCard(beat, i, soloPrivados)));
    } catch(err) {
      console.error(err);
      cont.innerHTML = `<p class="loading-msg">Error al cargar.</p>`;
    }
  }

  // ── HELPERS ──────────────────────────────────

  function fmt(s) {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  }
  function esc(s) {
    return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── INIT ─────────────────────────────────────
  go("home");
});
