// =============================================
//   mitø — SCRIPT.JS
// =============================================
document.addEventListener("DOMContentLoaded", () => {

  const SUPABASE_URL = "https://dchmegrnghagvjpqvlbg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaG1lZ3JuZ2hhZ3ZqcHF2bGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTI2MDksImV4cCI6MjA5MzU4ODYwOX0.CeiSFDLEBBqGXfBE_mKcXzjlutkjeh0DkQyGgbl82PU";
  const CLAVE_SECRETA = "1234";

  let db = null;
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch(e) { console.warn("Supabase:", e.message); }

  let currentUser = null, currentPerfil = null;
  let esPrivado = false, loginDestino = "privado";
  let activeAudio = null, activeCard = null;
  let foroCategoria = null, foroPost = null;
  let tieneAccesoPrivado = false;
  let insps = []; // inspiraciones actuales del form
  let cropTarget = null; // 'cover' | 'galeria' | 'avatar'
  let cropBlob = null, galeriaBlob = null, coverBlob = null;


  // ── SHA256 para passwords ────────────────────
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // ── HELPERS ──────────────────────────────────
  function esc(s) { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function fmt(s) { if(!s||isNaN(s)) return "0:00"; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; }
  function formatFecha(iso) { if(!iso) return ""; const d=new Date(iso); return d.toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"}); }
  function withTimeout(p, ms) {
    return Promise.race([
      p,
      new Promise((_,r) => setTimeout(() => r(new Error("TIMEOUT")), ms))
    ]);
  }

  // ── TEMA ─────────────────────────────────────
  function aplicarTema(tema, acento, fondo) {
    document.body.classList.toggle("tema-claro", tema === "claro");
    if (acento) document.documentElement.style.setProperty("--accent", acento);
    if (fondo)  document.documentElement.style.setProperty("--bg", fondo);
    localStorage.setItem("mitø-tema", tema || "oscuro");
    if (acento) localStorage.setItem("mitø-acento", acento);
    if (fondo)  localStorage.setItem("mitø-fondo", fondo);
  }

  // Carga tema guardado localmente al inicio
  aplicarTema(
    localStorage.getItem("mitø-tema") || "oscuro",
    localStorage.getItem("mitø-acento"),
    localStorage.getItem("mitø-fondo")
  );

  window.toggleTheme = function() {
    const claro = document.body.classList.contains("tema-claro");
    const nuevoTema = claro ? "oscuro" : "claro";
    aplicarTema(nuevoTema, null, null);
    if (currentUser) if(currentUser) db.from("usuarios").update({tema:nuevoTema}).eq("id",currentUser.id).then(()=>{if(currentUser){currentUser.tema=nuevoTema;guardarSesionLocal(currentUser);}});
  };



  // ── AUTH STATE ────────────────────────────────
  // Recupera sesión guardada en localStorage
  async function initSession() {
    try {
      const { data: { session } } = await db.auth.getSession();
      currentUser = session?.user || null;
      if (currentUser) {
        const { data } = await db.from("perfiles").select("*").eq("id", currentUser.id).single();
        currentPerfil = data;
        if (data?.tema || data?.color_acento || data?.color_fondo)
          aplicarTema(data.tema||"oscuro", data.color_acento, data.color_fondo);
        await comprobarAccesoPrivado();
      }
    } catch(e) { console.warn("Error recuperando sesión:", e); }
    updateNavUser();
  }
  initSession();

  // Supabase Auth reemplazado por sistema propio
  // onAuthStateChange ya no se usa

  function updateNavUser() {
    const btn  = document.getElementById("btn-auth");
    const mBtn = document.getElementById("mobile-auth-btn");
    if (!btn) return;
    if (currentUser) {
      const name = esc(currentUser.display_name || currentUser.username || currentUser.email);
      btn.innerHTML = `<i class="fa-solid fa-user"></i> ${name}`;
      btn.className = "nav-auth-btn logged"; btn.onclick = () => go("perfil");
      if (mBtn) { mBtn.innerHTML = `<i class="fa-solid fa-user"></i> ${name}`; mBtn.onclick = () => go("perfil",null,true); }
    } else {
      btn.innerHTML = `<i class="fa-solid fa-user"></i> ENTRAR`;
      btn.className = "nav-auth-btn"; btn.onclick = () => go("auth");
      if (mBtn) { mBtn.innerHTML = `<i class="fa-solid fa-user"></i> ENTRAR`; mBtn.onclick = () => go("auth",null,true); }
    }
  }

  async function comprobarAccesoPrivado() {
    if (!currentUser) { tieneAccesoPrivado = false; return; }
    tieneAccesoPrivado = currentUser.rol === "banda" || currentUser.rol === "admin";
    updateNavPrivado();
  }

  function updateNavPrivado() {
    const lockBtn = document.querySelector(".lock-btn");
    if (!lockBtn) return;
    if (tieneAccesoPrivado) {
      lockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> PRIVADO`;
      lockBtn.onclick = () => go("privado");
      lockBtn.style.cssText = "border-color:rgba(107,255,184,0.4)!important;color:#6bffb8!important";
    } else {
      lockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> PRIVADO`;
      lockBtn.onclick = () => openLogin("privado");
      lockBtn.style.cssText = "";
    }
  }

  // ── NAV ──────────────────────────────────────
  function go(id, btnEl, closeMenu) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
    if (btnEl) { document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active")); btnEl.classList.add("active"); }
    if (closeMenu) toggleMenu(true);
    if (id==="beats")   cargarBeats("beats-list", false);
    if (id==="home")    cargarBeats("home-beats", false, 3);
    if (id==="privado") { cargarBeats("admin-list", null); cargarSolicitudesAdmin(); cargarAccesos(); }
    if (id==="galeria") cargarGaleria();
    if (id==="banda")   { cargarBanda(); renderSolicitudForm(); }
    if (id==="foro")    renderForo();
    if (id==="perfil")  renderPerfil();
  }
  window.go = go;

  function toggleMenu(forceClose) {
    const m = document.getElementById("mobile-menu");
    if (forceClose) { m.classList.remove("open"); return; }
    m.classList.toggle("open");
  }
  window.toggleMenu = toggleMenu;

  // ── LOGIN PRIVADO ─────────────────────────────
  function openLogin(destino) {
    if (tieneAccesoPrivado && destino==="privado") { go("privado"); return; }
    loginDestino = destino || "privado";
    document.getElementById("login-overlay").classList.add("visible");
    document.getElementById("error-msg").textContent = "";
    document.getElementById("clave-input").value = "";
    setTimeout(() => document.getElementById("clave-input").focus(), 120);
  }
  function cerrarLogin() { document.getElementById("login-overlay").classList.remove("visible"); }
  function cerrarLoginOverlay(e) { if (e.target===document.getElementById("login-overlay")) cerrarLogin(); }
  function comprobarClave() {
    const v = document.getElementById("clave-input").value;
    if (v===CLAVE_SECRETA) { cerrarLogin(); go(loginDestino); }
    else { document.getElementById("error-msg").textContent = "Clave incorrecta ✕"; document.getElementById("clave-input").value = ""; document.getElementById("clave-input").focus(); }
  }
  window.openLogin = openLogin; window.cerrarLogin = cerrarLogin;
  window.cerrarLoginOverlay = cerrarLoginOverlay; window.comprobarClave = comprobarClave;

  // ── AUTH PÚBLICO ──────────────────────────────
  function switchAuthTab(tab, el) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active")); el.classList.add("active");
    document.getElementById("auth-login").classList.toggle("hidden", tab!=="login");
    document.getElementById("auth-register").classList.toggle("hidden", tab!=="register");
    document.getElementById("auth-reset").style.display = "none";
    if (tab==="login") document.getElementById("auth-login").classList.remove("hidden");
  }
  window.switchAuthTab = switchAuthTab;

  window.doLogin = async function() {
    const identifier = document.getElementById("login-email").value.trim();
    const pass       = document.getElementById("login-password").value;
    const msg        = document.getElementById("login-msg");
    const btn        = document.querySelector("#auth-login .btn-primary");

    if (!identifier || !pass) { msg.textContent="Rellena usuario/email y contraseña"; msg.className="auth-msg error"; return; }

    msg.textContent = "Entrando..."; msg.className = "auth-msg";
    if (btn) btn.disabled = true;

    try {
      const passHash = await sha256(pass);

      // Busca por email o username
      let query = db.from("usuarios").select("*");
      if (identifier.includes("@")) {
        query = query.eq("email", identifier.toLowerCase());
      } else {
        query = query.eq("username", identifier.toLowerCase());
      }
      const { data: usuarios } = await query.limit(1);
      const usuario = usuarios?.[0];

      if (!usuario || usuario.password_hash !== passHash) {
        msg.textContent = "Usuario o contraseña incorrectos";
        msg.className = "auth-msg error"; window.sfx?.error();
        return;
      }

      // Login correcto
      currentUser   = usuario;
      currentPerfil = usuario;
      guardarSesionLocal(usuario);
      tieneAccesoPrivado = usuario.rol === "banda" || usuario.rol === "admin";
      updateNavUser();
      updateNavPrivado();
      if (usuario.tema)         aplicarTema(usuario.tema, usuario.color_acento, usuario.color_fondo);
      if (usuario.color_acento) document.documentElement.style.setProperty("--accent", usuario.color_acento);

      msg.textContent = "¡Bienvenido! 👋"; msg.className = "auth-msg success";
      window.sfx?.login();
      setTimeout(() => go("home"), 800);

    } catch(e) {
      console.error(e);
      msg.textContent = "Error de conexión — inténtalo de nuevo";
      msg.className = "auth-msg error"; window.sfx?.error();
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  function abrirOlvidePass() { document.getElementById("auth-login").style.display="none"; document.getElementById("auth-reset").style.display="flex"; const v=document.getElementById("login-email").value; if(v.includes("@")) document.getElementById("reset-email").value=v; }
  function cerrarReset() { document.getElementById("auth-reset").style.display="none"; document.getElementById("auth-login").style.display="flex"; }
  window.abrirOlvidePass=abrirOlvidePass; window.cerrarReset=cerrarReset;

  window.doReset = async function() {
    const email=document.getElementById("reset-email").value.trim(); const msg=document.getElementById("reset-msg");
    if (!email||!email.includes("@")) { msg.textContent="Introduce un email válido"; msg.className="auth-msg error"; return; }
    msg.textContent="Enviando..."; msg.className="auth-msg";
    try {
      const r = await withTimeout(db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname}),5000);
      if (r.error) { msg.textContent="Error: "+r.error.message; msg.className="auth-msg error"; window.sfx?.error(); }
      else { msg.textContent="📧 Enlace enviado — revisa tu email"; msg.className="auth-msg success"; window.sfx?.success(); }
    } catch(e) { msg.textContent=e.message==="TIMEOUT"?"Sin respuesta":"Error al enviar"; msg.className="auth-msg error"; window.sfx?.error(); }
  };

  window.doRegister = async function() {
    const email    = document.getElementById("reg-email").value.trim().toLowerCase();
    const username = document.getElementById("reg-username").value.trim().toLowerCase();
    const pass     = document.getElementById("reg-password").value;
    const msg      = document.getElementById("reg-msg");
    const btn      = document.querySelector("#reg-step-1 .btn-primary");

    if (!email||!email.includes("@")) { msg.textContent="Pon un email válido"; msg.className="auth-msg error"; return; }
    if (!username) { msg.textContent="Pon un nombre de usuario"; msg.className="auth-msg error"; return; }
    if (pass.length<6) { msg.textContent="La contraseña debe tener al menos 6 caracteres"; msg.className="auth-msg error"; return; }

    msg.textContent="Creando cuenta..."; msg.className="auth-msg";
    if (btn) btn.disabled = true;

    try {
      const passHash = await sha256(pass);

      const { data, error } = await db.from("usuarios").insert([{
        email, username, password_hash: passHash,
        display_name: username, rol: "fan"
      }]).select().single();

      if (error) {
        const m = {
          '23505': "Ese email o usuario ya existe"
        };
        msg.textContent = m[error.code] || "Error: " + error.message;
        msg.className = "auth-msg error"; window.sfx?.error();
      } else {
        // Login automático tras registro
        currentUser = data; currentPerfil = data;
        guardarSesionLocal(data);
        tieneAccesoPrivado = false;
        updateNavUser(); updateNavPrivado();
        msg.textContent = "¡Cuenta creada! 🎉"; msg.className = "auth-msg success";
        window.sfx?.success();
        setTimeout(() => go("home"), 800);
      }
    } catch(e) {
      msg.textContent = "Error de conexión — inténtalo de nuevo";
      msg.className = "auth-msg error"; window.sfx?.error();
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ── CROP ─────────────────────────────────────
  let cropImg = null, cropScale = 1;
  let cropX=0, cropY=0, cropSize=0, cropDragging=false, cropStartX=0, cropStartY=0;

  function abrirCrop(target) {
    cropTarget = target;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        cropImg = img;
        const canvas = document.getElementById("crop-canvas");
        const container = document.querySelector(".crop-container");
        const maxW = Math.min(400, window.innerWidth - 48);
        const maxH = Math.min(400, window.innerHeight * 0.6);
        cropScale = Math.min(maxW / img.width, maxH / img.height, 1);
        canvas.width  = img.width  * cropScale;
        canvas.height = img.height * cropScale;
        container.style.width  = canvas.width  + "px";
        container.style.height = canvas.height + "px";
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Selección inicial centrada
        cropSize = Math.min(canvas.width, canvas.height) * 0.8;
        cropX = (canvas.width  - cropSize) / 2;
        cropY = (canvas.height - cropSize) / 2;
        renderCropSelection();
        document.getElementById("crop-overlay").classList.add("visible");
      };
      img.src = url;
    };
    input.click();
  }
  window.abrirCrop = abrirCrop;

  function renderCropSelection() {
    const sel = document.getElementById("crop-selection");
    sel.style.display = "block";
    sel.style.left   = cropX + "px";
    sel.style.top    = cropY + "px";
    sel.style.width  = cropSize + "px";
    sel.style.height = cropSize + "px";
  }

  const canvas = document.getElementById("crop-canvas");
  canvas.addEventListener("mousedown", e => {
    cropDragging = true;
    const r = canvas.getBoundingClientRect();
    cropStartX = e.clientX - r.left - cropX;
    cropStartY = e.clientY - r.top  - cropY;
  });
  canvas.addEventListener("touchstart", e => {
    cropDragging = true;
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    cropStartX = t.clientX - r.left - cropX;
    cropStartY = t.clientY - r.top  - cropY;
  }, { passive: true });

  function onCropMove(clientX, clientY) {
    if (!cropDragging) return;
    const r = canvas.getBoundingClientRect();
    cropX = Math.max(0, Math.min(clientX - r.left - cropStartX, canvas.width  - cropSize));
    cropY = Math.max(0, Math.min(clientY - r.top  - cropStartY, canvas.height - cropSize));
    renderCropSelection();
  }
  document.addEventListener("mousemove",  e => onCropMove(e.clientX, e.clientY));
  document.addEventListener("touchmove",  e => onCropMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  document.addEventListener("mouseup",    () => cropDragging = false);
  document.addEventListener("touchend",   () => cropDragging = false);

  window.confirmarCrop = function() {
    const out = document.createElement("canvas");
    const realX = cropX / cropScale, realY = cropY / cropScale, realSize = cropSize / cropScale;
    out.width = out.height = 400;
    const ctx = out.getContext("2d");
    ctx.drawImage(cropImg, realX, realY, realSize, realSize, 0, 0, 400, 400);
    out.toBlob(blob => {
      if (!blob) return;
      if (cropTarget === "cover") {
        coverBlob = blob;
        document.getElementById("cover-name-label").textContent = "✓ Cover recortada lista";
      } else if (cropTarget === "galeria") {
        galeriaBlob = blob;
        document.getElementById("galeria-file-label").textContent = "✓ Foto recortada lista";
      } else if (cropTarget === "avatar") {
        cropBlob = blob;
        document.getElementById("avatar-label").textContent = "✓ Foto recortada lista";
      }
      cerrarCrop();
    }, "image/jpeg", 0.92);
  };

  window.cerrarCrop = function() {
    document.getElementById("crop-overlay").classList.remove("visible");
    document.getElementById("crop-selection").style.display = "none";
    cropImg = null;
  };

  // ── BEAT DETAIL ───────────────────────────────
  function abrirBeatDetalle(beat) {
    const cont = document.getElementById("beat-detail-content");
    const bars  = generateBars(beat, 0);
    const inspsArr = beat.inspiraciones ? beat.inspiraciones.split(",").map(s=>s.trim()).filter(Boolean) : [];
    const inspsHtml = inspsArr.length
      ? `<div class="beat-detail-insps">
           <span class="beat-detail-insps-label">Inspiraciones</span>
           ${inspsArr.map(i=>`<span class="beat-insp-tag-big">${esc(i)}</span>`).join("")}
         </div>` : "";

    cont.innerHTML = `
      <button class="beat-detail-close" onclick="cerrarBeatOverlay()">✕</button>
      <div class="beat-detail-top">
        ${beat.cover_url
          ? `<img src="${beat.cover_url}" class="beat-detail-cover" alt="">`
          : `<div class="beat-detail-cover-placeholder"><i class="fa-solid fa-music"></i></div>`}
        <div class="beat-detail-info">
          <div class="beat-detail-title">${esc(beat.title)}</div>
          <div class="beat-detail-artist">mitø</div>
          <div class="beat-detail-tags">
            ${beat.genre ? `<span class="beat-meta-tag">${esc(beat.genre)}</span>` : ""}
            ${beat.bpm   ? `<span class="beat-meta-tag bpm"><i class="fa-solid fa-drum"></i> ${beat.bpm} BPM</span>` : ""}
            ${beat.tono  ? `<span class="beat-meta-tag"><i class="fa-solid fa-music"></i> ${esc(beat.tono)}</span>` : ""}
          </div>
          ${inspsHtml}
        </div>
      </div>
      <div class="beat-detail-waveform">
        <div class="custom-player">
          <button class="play-btn" id="detail-play-btn"><i class="fa-solid fa-play"></i></button>
          <div class="player-right">
            <div class="waveform-wrap" id="detail-wave-wrap">
              <div class="waveform">${bars}</div>
              <div class="waveform-progress" id="detail-prog">
                <div class="waveform-filled">${bars}</div>
              </div>
              <div class="waveform-cursor" id="detail-cursor"></div>
            </div>
            <div class="player-meta">
              <span id="detail-cur">0:00</span>
              <span id="detail-tot">—</span>
            </div>
          </div>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      const wrap = document.getElementById("detail-wave-wrap");
      const filled = cont.querySelector(".waveform-filled");
      if (wrap && filled) filled.style.width = wrap.offsetWidth + "px";
    });

    // Init player en detalle
    const playBtn = document.getElementById("detail-play-btn");
    const prog    = document.getElementById("detail-prog");
    const cursor  = document.getElementById("detail-cursor");
    const wrap    = document.getElementById("detail-wave-wrap");
    const timeCur = document.getElementById("detail-cur");
    const timeTot = document.getElementById("detail-tot");
    let audio = null, playing = false;

    function getA() {
      if (audio) return audio;
      audio = new Audio(beat.audio_url);
      audio.addEventListener("loadedmetadata", () => timeTot.textContent = fmt(audio.duration));
      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const p = (audio.currentTime / audio.duration) * 100;
        prog.style.width = p+"%"; cursor.style.left = p+"%"; timeCur.textContent = fmt(audio.currentTime);
      });
      audio.addEventListener("ended", () => { playing=false; playBtn.innerHTML=`<i class="fa-solid fa-play"></i>`; prog.style.width="0%"; cursor.style.left="0%"; timeCur.textContent="0:00"; });
      return audio;
    }

    playBtn.addEventListener("click", () => {
      const a = getA();
      if (activeAudio && activeAudio !== a) { activeAudio.pause(); if(activeCard){activeCard.classList.remove("is-playing"); activeCard.querySelector(".play-btn").innerHTML=`<i class="fa-solid fa-play"></i>`;} }
      if (playing) { a.pause(); playing=false; playBtn.innerHTML=`<i class="fa-solid fa-play"></i>`; activeAudio=null; }
      else { a.play(); playing=true; playBtn.innerHTML=`<i class="fa-solid fa-pause"></i>`; activeAudio=a; activeCard=null; window.sfx?.play(); }
    });

    wrap.addEventListener("click", e => {
      const a = getA(); if (!a.duration) return;
      const r = wrap.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientX-r.left)/r.width));
      a.currentTime = p * a.duration; prog.style.width=(p*100)+"%"; cursor.style.left=(p*100)+"%";
    });

    document.getElementById("beat-overlay").classList.add("visible");
  }

  window.cerrarBeatOverlay = function(e) {
    if (!e || e.target===document.getElementById("beat-overlay")) {
      document.getElementById("beat-overlay").classList.remove("visible");
      // Para el audio del detalle si estaba sonando
      if (activeAudio) { activeAudio.pause(); activeAudio=null; }
    }
  };

  // ── BEATS ────────────────────────────────────
  window.setVisibilidad = function(priv) {
    esPrivado = priv;
    document.getElementById("vis-publico").classList.toggle("active", !priv);
    document.getElementById("vis-privado").classList.toggle("active", priv);
  };
  window.updateFileName = function(input) { document.getElementById("file-name-label").textContent = input.files?.[0]?.name||"Elige un archivo de audio"; };

  // Inspiraciones
  window.añadirInsp = function() {
    const input = document.getElementById("insp-input");
    const val = input.value.trim().replace(/,/g,"");
    if (!val || insps.includes(val)) { input.value=""; return; }
    insps.push(val); input.value=""; renderInsps();
  };

  function renderInsps() {
    const cont = document.getElementById("insps-tags");
    cont.innerHTML = insps.map((t,i) =>
      `<span class="insp-tag-remove" onclick="quitarInsp(${i})">${esc(t)} <span>✕</span></span>`
    ).join("");
  }
  window.quitarInsp = function(i) { insps.splice(i,1); renderInsps(); };

  window.subirBeat = async function() {
    if (!db) { alert("Supabase no configurado"); return; }
    const title = document.getElementById("beat-title").value.trim();
    const genre = document.getElementById("beat-genre").value.trim();
    const bpm   = document.getElementById("beat-bpm").value;
    const tono  = document.getElementById("beat-tono").value.trim();
    const file  = document.getElementById("audio-file").files[0];
    const btn   = document.querySelector(".upload-form .btn-primary");
    if (!file) { alert("Selecciona un archivo de audio"); return; }

    btn.textContent = "Analizando audio..."; btn.disabled = true;
    try {
      const waveformData = await analizarWaveform(file);
      btn.textContent = "Subiendo...";

      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
      const fileName = `${Date.now()}-${cleanName}`;
      const { error: upErr } = await db.storage.from("beats").upload(fileName, file);
      if (upErr) throw upErr;
      const { data: urlData } = db.storage.from("beats").getPublicUrl(fileName);

      let cover_url = null;
      if (coverBlob) {
        const coverName = `cover-${Date.now()}.jpg`;
        await db.storage.from("covers").upload(coverName, coverBlob, { contentType: "image/jpeg" });
        const { data: cd } = db.storage.from("covers").getPublicUrl(coverName);
        cover_url = cd.publicUrl;
      }

      const { error: dbErr } = await db.from("beats").insert([{
        title: title||"Sin título", genre: genre||"—",
        audio_url: urlData.publicUrl, privado: esPrivado,
        waveform: JSON.stringify(waveformData),
        bpm: bpm ? parseInt(bpm) : null,
        tono: tono||null, cover_url,
        inspiraciones: insps.length ? insps.join(",") : null
      }]);
      if (dbErr) throw dbErr;

      ["beat-title","beat-genre","beat-bpm","beat-tono","audio-file"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
      document.getElementById("file-name-label").textContent = "Elige un archivo de audio";
      document.getElementById("cover-name-label").textContent = "Cover / imagen (click para recortar)";
      coverBlob = null; insps = []; renderInsps();
      btn.textContent = "¡Subido! 🔥"; window.sfx?.upload();
      setTimeout(() => { btn.textContent="Subir beat 🔥"; btn.disabled=false; }, 2000);
      cargarBeats("admin-list", null);
    } catch(err) {
      console.error(err); alert("Error: "+(err.message||"revisa la consola"));
      btn.textContent="Subir beat 🔥"; btn.disabled=false;
    }
  };

  async function analizarWaveform(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const ctx2 = new (window.AudioContext||window.webkitAudioContext)();
          const buf  = await ctx2.decodeAudioData(e.target.result);
          const raw  = buf.getChannelData(0);
          const N    = 55, block = Math.floor(raw.length/N), peaks = [];
          for (let i=0;i<N;i++) { let s=0; for(let j=0;j<block;j++) s+=Math.abs(raw[i*block+j]); peaks.push(s/block); }
          const max = Math.max(...peaks);
          resolve(peaks.map(v=>Math.round(15+(v/max)*80)));
          ctx2.close();
        } catch(e2) { reject(e2); }
      };
      reader.onerror = reject; reader.readAsArrayBuffer(file);
    });
  }

  function generateBars(beat, index) {
    if (beat?.waveform) {
      try { const d=typeof beat.waveform==="string"?JSON.parse(beat.waveform):beat.waveform; if(Array.isArray(d)&&d.length>0) return d.map(h=>`<span style="height:${h}%"></span>`).join(""); } catch(e) {}
    }
    let s=((beat?.id)?beat.id:(index*7+13))%99999+1;
    function rand(){s=(s*1664525+1013904223)&0xffffffff;return((s>>>0)/0xffffffff);}
    return Array.from({length:55},()=>`<span style="height:${Math.round(15+rand()*68)}%"></span>`).join("");
  }

  function crearCard(beat, index, admin) {
    const card = document.createElement("div");
    card.className = "beat-card";
    const bars = generateBars(beat, index);
    const inspsArr = beat.inspiraciones ? beat.inspiraciones.split(",").map(s=>s.trim()).filter(Boolean) : [];

    card.innerHTML = `
      <span class="beat-num">${String(index+1).padStart(2,"0")}</span>
      ${beat.cover_url
        ? `<img src="${beat.cover_url}" class="beat-cover" alt="">`
        : `<div class="beat-cover-placeholder"><i class="fa-solid fa-music"></i></div>`}
      <div class="beat-info">
        <h3>${esc(beat.title)}</h3>
        <div class="beat-info-genre">${esc(beat.genre)}</div>
        <div class="beat-meta-tags">
          ${beat.bpm  ? `<span class="beat-meta-tag bpm">${beat.bpm} BPM</span>` : ""}
          ${beat.tono ? `<span class="beat-meta-tag">${esc(beat.tono)}</span>` : ""}
        </div>
        ${inspsArr.length ? `<div class="beat-insps">${inspsArr.map(i=>`<span class="beat-insp-tag">${esc(i)}</span>`).join("")}</div>` : ""}
      </div>
      ${beat.privado ? `<span class="beat-priv-tag"><i class="fa-solid fa-lock"></i></span>` : ""}
      <div class="custom-player">
        <button class="play-btn"><i class="fa-solid fa-play"></i></button>
        <div class="player-right">
          <div class="waveform-wrap">
            <div class="waveform">${bars}</div>
            <div class="waveform-progress"><div class="waveform-filled">${bars}</div></div>
            <div class="waveform-cursor"></div>
          </div>
          <div class="player-meta"><span class="time-cur">0:00</span><span class="time-tot">—</span></div>
        </div>
      </div>
      ${admin ? `<button class="delete-btn" title="Borrar"><i class="fa-solid fa-trash"></i></button>` : ""}`;

    requestAnimationFrame(() => {
      const w=card.querySelector(".waveform-wrap"), f=card.querySelector(".waveform-filled");
      if(w&&f) f.style.width=w.offsetWidth+"px";
    });

    // Click en la card para abrir detalle (no en player ni delete)
    card.addEventListener("click", e => {
      if (e.target.closest(".custom-player,.delete-btn")) return;
      abrirBeatDetalle(beat);
    });

    const playBtn=card.querySelector(".play-btn"), waveWrap=card.querySelector(".waveform-wrap");
    const prog=card.querySelector(".waveform-progress"), cursor=card.querySelector(".waveform-cursor");
    const timeCur=card.querySelector(".time-cur"), timeTot=card.querySelector(".time-tot");
    let audio=null, isPlaying=false;

    function getAudio() {
      if(audio) return audio;
      audio=new Audio(beat.audio_url);
      audio.addEventListener("loadedmetadata",()=>timeTot.textContent=fmt(audio.duration));
      audio.addEventListener("timeupdate",()=>{if(!audio.duration)return;const p=(audio.currentTime/audio.duration)*100;prog.style.width=p+"%";cursor.style.left=p+"%";timeCur.textContent=fmt(audio.currentTime);});
      audio.addEventListener("ended",()=>{isPlaying=false;playBtn.innerHTML=`<i class="fa-solid fa-play"></i>`;card.classList.remove("is-playing");prog.style.width="0%";cursor.style.left="0%";timeCur.textContent="0:00";activeAudio=null;activeCard=null;});
      return audio;
    }
    function stopOthers(){if(activeAudio&&activeAudio!==audio){activeAudio.pause();if(activeCard){activeCard.classList.remove("is-playing");activeCard.querySelector(".play-btn").innerHTML=`<i class="fa-solid fa-play"></i>`;activeCard.querySelector(".waveform-progress").style.width="0%";activeCard.querySelector(".waveform-cursor").style.left="0%";activeCard.querySelector(".time-cur").textContent="0:00";}}}
    playBtn.addEventListener("click",e=>{e.stopPropagation();const a=getAudio();if(isPlaying){a.pause();isPlaying=false;playBtn.innerHTML=`<i class="fa-solid fa-play"></i>`;card.classList.remove("is-playing");activeAudio=null;activeCard=null;window.sfx?.pause();}else{stopOthers();a.play();isPlaying=true;playBtn.innerHTML=`<i class="fa-solid fa-pause"></i>`;card.classList.add("is-playing");activeAudio=a;activeCard=card;window.sfx?.play();}});
    waveWrap.addEventListener("click",e=>{e.stopPropagation();const a=getAudio();if(!a.duration)return;const r=waveWrap.getBoundingClientRect();const p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));a.currentTime=p*a.duration;prog.style.width=(p*100)+"%";cursor.style.left=(p*100)+"%";});

    if(admin){
      const delBtn=card.querySelector(".delete-btn");
      delBtn.addEventListener("click",async e=>{e.stopPropagation();if(!confirm(`¿Borrar "${beat.title}"?`))return;delBtn.disabled=true;delBtn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i>`;const{error}=await db.from("beats").delete().eq("id",beat.id);if(error){alert("Error: "+error.message);delBtn.disabled=false;delBtn.innerHTML=`<i class="fa-solid fa-trash"></i>`;return;}window.sfx?.delete();card.style.transition="opacity 0.3s,transform 0.3s";card.style.opacity="0";card.style.transform="translateX(20px)";setTimeout(()=>card.remove(),310);});
    }
    return card;
  }

  let todosLosBeats = []; // cache para filtrar sin re-fetch

  async function cargarBeats(containerId, soloPrivados, limite) {
    const cont=document.getElementById(containerId); if(!cont||!db)return;
    cont.innerHTML=`<p class="loading-msg">Cargando</p>`;
    const admin=soloPrivados===null;
    try {
      let q=db.from("beats").select("*").order("id",{ascending:false});
      if(soloPrivados!==null) q=q.eq("privado",soloPrivados);
      if(limite) q=q.limit(limite);
      const{data,error}=await withTimeout(q,5000);
      if(error) throw error;
      if(!data?.length){cont.innerHTML=`<p class="loading-msg no-spin">Aún no hay beats aquí. 🎧</p>`;return;}
      // Guarda en cache si es la lista pública principal
      if(containerId==="beats-list") todosLosBeats = data;
      renderBeats(cont, data, admin);
    } catch(err){console.error(err);cont.innerHTML=`<p class="loading-msg no-spin">⚠️ ${err.message==="TIMEOUT"?"Sin conexión — revisa tu wifi":"Error al cargar"}</p>`;}
  }

  function renderBeats(cont, data, admin) {
    cont.innerHTML="";
    if (!data.length) { cont.innerHTML=`<p class="loading-msg no-spin">No hay beats que coincidan con los filtros.</p>`; return; }
    data.forEach((beat,i)=>cont.appendChild(crearCard(beat,i,admin)));
  }

  window.filtrarBeats = function() {
    const cont = document.getElementById("beats-list");
    if (!cont || !todosLosBeats.length) return;
    const nombre   = document.getElementById("filter-nombre")?.value.trim().toLowerCase() || "";
    const bpmMin   = parseInt(document.getElementById("filter-bpm-min")?.value) || 0;
    const bpmMax   = parseInt(document.getElementById("filter-bpm-max")?.value) || 9999;
    const tono     = document.getElementById("filter-tono")?.value.toLowerCase() || "";
    const genero   = document.getElementById("filter-genero")?.value.trim().toLowerCase() || "";

    const filtrados = todosLosBeats.filter(b => {
      if (nombre && !b.title?.toLowerCase().includes(nombre)) return false;
      if (bpmMin > 0 && (!b.bpm || b.bpm < bpmMin)) return false;
      if (bpmMax < 9999 && (!b.bpm || b.bpm > bpmMax)) return false;
      if (tono && (!b.tono || !b.tono.toLowerCase().includes(tono))) return false;
      if (genero && (!b.genre || !b.genre.toLowerCase().includes(genero))) return false;
      return true;
    });

    const resEl = document.getElementById("filter-results");
    if (resEl) {
      const hayFiltro = nombre||bpmMin||bpmMax<9999||tono||genero;
      resEl.textContent = hayFiltro ? `${filtrados.length} beat${filtrados.length!==1?"s":""} encontrado${filtrados.length!==1?"s":""}` : "";
    }

    renderBeats(cont, filtrados, false);
  };

  window.resetFiltros = function() {
    ["filter-nombre","filter-bpm-min","filter-bpm-max","filter-genero"].forEach(id => {
      const el = document.getElementById(id); if(el) el.value="";
    });
    const sel = document.getElementById("filter-tono"); if(sel) sel.value="";
    document.getElementById("filter-results").textContent="";
    renderBeats(document.getElementById("beats-list"), todosLosBeats, false);
  };

  // ── GALERÍA ───────────────────────────────────
  async function cargarGaleria() {
    const grid=document.getElementById("galeria-grid"); grid.innerHTML=`<p class="loading-msg">Cargando</p>`;
    try {
      const{data,error}=await withTimeout(db.from("galeria").select("*").order("id",{ascending:false}),5000);
      if(error) throw error;
      if(!data?.length){grid.innerHTML=`<p class="loading-msg no-spin">La galería está vacía por ahora.</p>`;return;}
      grid.innerHTML="";
      data.forEach(foto=>{
        const item=document.createElement("div"); item.className="galeria-item";
        item.innerHTML=`<img src="${foto.url}" alt="${esc(foto.caption||"")}" loading="lazy"><div class="galeria-item-overlay">${foto.caption?`<p class="galeria-caption">${esc(foto.caption)}</p>`:""}</div>`;
        item.addEventListener("click",()=>{document.getElementById("lightbox-img").src=foto.url;document.getElementById("lightbox-caption").textContent=foto.caption||"";document.getElementById("lightbox").classList.add("visible");});
        grid.appendChild(item);
      });
    } catch(err){grid.innerHTML=`<p class="loading-msg no-spin">⚠️ ${err.message==="TIMEOUT"?"Sin conexión":"Error al cargar"}</p>`;}
  }

  function cerrarLightbox(){document.getElementById("lightbox").classList.remove("visible");}
  window.cerrarLightbox=cerrarLightbox;

  window.subirFotoGaleria = async function() {
    if (!galeriaBlob) { alert("Elige y recorta una foto primero"); return; }
    const caption=document.getElementById("galeria-caption").value.trim();
    const btn=document.querySelector("#privado .upload-box:nth-child(2) .btn-primary");
    btn.textContent="Subiendo..."; btn.disabled=true;
    try {
      const fileName=`${Date.now()}-galeria.jpg`;
      const{error:upErr}=await db.storage.from("galeria").upload(fileName,galeriaBlob,{contentType:"image/jpeg"});
      if(upErr) throw upErr;
      const{data:urlData}=db.storage.from("galeria").getPublicUrl(fileName);
      await db.from("galeria").insert([{url:urlData.publicUrl,caption}]);
      document.getElementById("galeria-caption").value="";
      document.getElementById("galeria-file-label").textContent="Elige una foto (click para recortar)";
      galeriaBlob=null; btn.textContent="¡Subida! 🔥"; window.sfx?.upload();
      setTimeout(()=>{btn.textContent="Subir foto";btn.disabled=false;},2000);
    } catch(err){alert("Error: "+err.message);btn.textContent="Subir foto";btn.disabled=false;}
  };

  // ── BANDA ─────────────────────────────────────
  async function cargarBanda() {
    const grid=document.getElementById("banda-grid"); grid.innerHTML=`<p class="loading-msg">Cargando</p>`;
    try {
      const{data,error}=await withTimeout(db.from("usuarios").select("*").in("rol",["banda","admin"]).order("created_at"),5000);
      if(error) throw error;
      if(!data?.length){grid.innerHTML=`<p class="loading-msg no-spin">La banda se está formando... 🎸</p>`;return;}
      grid.innerHTML="";
      data.forEach(m=>{
        const ini=(m.display_name||m.username||"?")[0].toUpperCase();
        const card=document.createElement("div"); card.className="banda-card";
        card.innerHTML=`${m.avatar_url?`<img src="${m.avatar_url}" class="banda-avatar" alt="">`: `<div class="banda-avatar-placeholder">${ini}</div>`}<div class="banda-name">${esc(m.display_name||m.username)}</div>${m.instrumento?`<div class="banda-rol">${esc(m.instrumento)}</div>`:""} ${m.bio?`<p class="banda-bio">${esc(m.bio)}</p>`:""}`;
        grid.appendChild(card);
      });
    } catch(err){grid.innerHTML=`<p class="loading-msg no-spin">⚠️ ${err.message==="TIMEOUT"?"Sin conexión":"Error al cargar"}</p>`;}
  }

  async function renderSolicitudForm() {
    const cont=document.getElementById("solicitud-content");
    if(!currentUser){cont.innerHTML=`<div class="solicitud-login"><p>Inicia sesión para enviar una solicitud</p><br><button class="btn-primary" onclick="go('auth')">Entrar</button></div>`;return;}
    const{data:solData}=await db.from("solicitudes").select("*").eq("user_id",currentUser.id).limit(1); const data=solData?.[0]||null;
    if(data){cont.innerHTML=`<div class="solicitud-enviada"><div style="font-size:32px;margin-bottom:10px">✅</div><p>Tu solicitud está <strong>${data.estado}</strong>.<br>Te avisaremos pronto.</p></div>`;return;}
    cont.innerHTML=`<div class="solicitud-form"><input type="text" id="sol-nombre" placeholder="Tu nombre" class="field" value="${esc(currentUser?.display_name||currentUser?.username||"")}"><input type="text" id="sol-instrumento" placeholder="Instrumento / rol" class="field"><input type="text" id="sol-redes" placeholder="Tu Instagram u otras redes" class="field"><textarea id="sol-experiencia" placeholder="¿Qué experiencia tienes?" class="field textarea" rows="3"></textarea><textarea id="sol-mensaje" placeholder="¿Por qué quieres unirte?" class="field textarea" rows="3"></textarea><button class="btn-primary" onclick="enviarSolicitud()">Enviar solicitud</button><p class="auth-msg" id="sol-msg"></p></div>`;
  }

  window.enviarSolicitud = async function() {
    const nombre=document.getElementById("sol-nombre").value.trim();
    const instrumento=document.getElementById("sol-instrumento").value.trim();
    const experiencia=document.getElementById("sol-experiencia").value.trim();
    const mensaje=document.getElementById("sol-mensaje").value.trim();
    const redes=document.getElementById("sol-redes").value.trim();
    const msg=document.getElementById("sol-msg");
    if(!nombre||!instrumento){msg.textContent="Rellena nombre e instrumento";msg.className="auth-msg error";return;}
    msg.textContent="Enviando...";msg.className="auth-msg";
    const{error}=await db.from("solicitudes").insert([{user_id:currentUser.id,nombre,instrumento,experiencia,mensaje,redes}]);
    if(error){msg.textContent="Error: "+error.message;msg.className="auth-msg error";}
    else{window.sfx?.success();renderSolicitudForm();}
  };

  async function cargarSolicitudesAdmin() {
    const cont=document.getElementById("solicitudes-admin"); if(!cont)return;
    cont.innerHTML=`<p class="loading-msg">Cargando</p>`;
    const{data}=await db.from("solicitudes").select("*").order("created_at",{ascending:false});
    if(!data?.length){cont.innerHTML=`<p class="loading-msg no-spin">No hay solicitudes aún.</p>`;return;}
    cont.innerHTML="";
    data.forEach(s=>{
      const card=document.createElement("div");card.className="solicitud-card";
      card.innerHTML=`<div class="solicitud-card-info"><h4>${esc(s.nombre)} — ${esc(s.instrumento)}</h4><p>${s.redes?"🔗 "+esc(s.redes)+" · ":""} ${s.experiencia?esc(s.experiencia.substring(0,80))+"...":""}</p><p style="margin-top:4px;font-style:italic">"${esc((s.mensaje||"").substring(0,100))}${(s.mensaje||"").length>100?"...":""}"</p></div><span class="solicitud-estado ${s.estado}">${s.estado}</span>`;
      cont.appendChild(card);
    });
  }

  async function cargarAccesos() {
    const cont=document.getElementById("accesos-list"); if(!cont)return;
    cont.innerHTML=`<p class="loading-msg">Cargando</p>`;
    const{data}=await db.from("accesos_privados").select("*").order("created_at",{ascending:false});
    if(!data?.length){cont.innerHTML=`<p class="loading-msg no-spin">No hay accesos configurados.</p>`;return;}
    cont.innerHTML="";
    data.forEach(a=>{
      const card=document.createElement("div");card.className="solicitud-card";
      card.innerHTML=`<div class="solicitud-card-info"><h4>${esc(a.email)}</h4><p>Añadido el ${formatFecha(a.created_at)}</p></div><button class="delete-btn" style="opacity:1" onclick="eliminarAcceso(${a.id},'${esc(a.email)}',this)"><i class="fa-solid fa-trash"></i></button>`;
      cont.appendChild(card);
    });
  }

  window.añadirAcceso = async function() {
    const email=document.getElementById("nuevo-acceso-email").value.trim().toLowerCase();
    const msg=document.getElementById("acceso-msg");
    if(!email||!email.includes("@")){msg.textContent="Pon un email válido";msg.className="auth-msg error";return;}
    msg.textContent="Añadiendo...";msg.className="auth-msg";
    const{error}=await db.from("accesos_privados").insert([{email}]);
    if(error){msg.textContent=error.code==="23505"?"Ese email ya tiene acceso":"Error: "+error.message;msg.className="auth-msg error";}
    else{document.getElementById("nuevo-acceso-email").value="";msg.textContent="✓ Acceso añadido";msg.className="auth-msg success";setTimeout(()=>{msg.textContent="";},2000);cargarAccesos();}
  };

  window.eliminarAcceso = async function(id,email,btn) {
    if(!confirm(`¿Quitar acceso a ${email}?`))return;btn.disabled=true;
    const{error}=await db.from("accesos_privados").delete().eq("id",id);
    if(error){alert("Error: "+error.message);btn.disabled=false;return;}
    btn.closest(".solicitud-card").remove();
  };

  // ── FORO ──────────────────────────────────────
  async function renderForo() {
    const cont = document.getElementById("foro-content");
    cont.innerHTML = `<p class="loading-msg">Cargando</p>`;

    try {
      const { data: cats } = await db.from("categorias").select("*").order("orden");
      if (!foroCategoria && cats?.length) foroCategoria = cats[0].id;

      let q = db.from("posts")
        .select("*, perfiles(display_name, username, avatar_url), comentarios(id)")
        .order("created_at", { ascending: false });
      if (foroCategoria !== "todos") q = q.eq("categoria_id", foroCategoria);

      const { data: posts } = await withTimeout(q, 10000);

      const catsHtml = [
        `<div class="cat-pill ${foroCategoria==="todos"?"active":""}" onclick="filtrarCategoria('todos')">Todo</div>`,
        ...(cats||[]).map(c => `<div class="cat-pill ${foroCategoria===c.id?"active":""}" onclick="filtrarCategoria(${c.id})">${esc(c.nombre)}</div>`)
      ].join("");

      const newBtn = currentUser
        ? `<button class="btn-primary" onclick="abrirNuevoPost()"><i class="fa-solid fa-plus"></i> PUBLICAR</button>`
        : `<button class="btn-secondary" onclick="go('auth')"><i class="fa-solid fa-user"></i> Entrar</button>`;

      const postsHtml = !posts?.length
        ? `<p class="loading-msg no-spin">Aún no hay publicaciones. ¡Sé el primero!</p>`
        : posts.map(p => crearPostCard(p)).join("");

      cont.innerHTML = `
        <div class="feed-header">
          <h2>FORO</h2>
          ${newBtn}
        </div>
        <div class="cat-pills">${catsHtml}</div>
        <div class="feed-list">${postsHtml}</div>`;

    } catch(err) {
      cont.innerHTML = `<p class="loading-msg no-spin">⚠️ ${err.message==="TIMEOUT"?"Sin conexión":"Error al cargar"}</p>`;
    }
  }

  function crearPostCard(p) {
    const autor = p.perfiles?.display_name || p.perfiles?.username || "Anónimo";
    const ini   = autor[0].toUpperCase();
    const avatar = p.usuarios?.avatar_url
      ? `<img src="${p.perfiles.avatar_url}" class="feed-avatar" alt="">`
      : `<div class="feed-avatar-placeholder">${ini}</div>`;
    const imgHtml = p.imagen_url
      ? `<img src="${p.imagen_url}" class="feed-img" alt="" onclick="event.stopPropagation();abrirImgFeed('${p.imagen_url}')">`
      : "";
    const numComs = p.comentarios?.length || 0;

    return `
      <div class="feed-card" id="feed-card-${p.id}">
        <div class="feed-card-left">${avatar}</div>
        <div class="feed-card-body">
          <div class="feed-card-meta">
            <span class="feed-autor">${esc(autor)}</span>
            <span class="feed-fecha">${formatFecha(p.created_at)}</span>
            ${p.titulo ? `<span class="feed-titulo">${esc(p.titulo)}</span>` : ""}
          </div>
          <div class="feed-card-text">${esc(p.contenido)}</div>
          ${imgHtml}
          <div class="feed-card-actions">
            <button class="feed-action" onclick="toggleComentarios(${p.id})">
              <i class="fa-regular fa-comment"></i> ${numComs}
            </button>
          </div>
          <div class="feed-comentarios" id="feed-coms-${p.id}" style="display:none"></div>
        </div>
      </div>`;
  }

  window.filtrarCategoria = function(id) { foroCategoria = id; renderForo(); };

  window.toggleComentarios = async function(postId) {
    const cont = document.getElementById(`feed-coms-${postId}`);
    if (cont.style.display === "block") { cont.style.display = "none"; return; }
    cont.style.display = "block";
    cont.innerHTML = `<p class="loading-msg" style="padding:8px 0;font-size:10px">Cargando...</p>`;
    const { data: coms } = await db.from("comentarios")
      .select("*, perfiles(display_name, username)")
      .eq("post_id", postId).order("created_at");

    const comsHtml = (coms||[]).map(c => {
      const ca = c.usuarios?.display_name||c.usuarios?.username||"Anónimo";
      return `<div class="comentario-card"><div class="comentario-autor">${esc(ca)} · ${formatFecha(c.created_at)}</div><div class="comentario-texto">${esc(c.contenido)}</div></div>`;
    }).join("") || `<p style="font-size:11px;color:var(--text-dim);padding:8px 0;letter-spacing:1px">Aún no hay comentarios.</p>`;

    const comentarHtml = currentUser
      ? `<div class="comentar-form" style="margin-top:8px">
           <textarea id="com-${postId}" placeholder="Comenta..." class="field textarea" rows="2"></textarea>
           <button class="btn-secondary" style="margin-top:6px" onclick="enviarComentario(${postId})">Comentar</button>
           <p class="auth-msg" id="com-msg-${postId}"></p>
         </div>`
      : `<p style="font-size:11px;color:var(--text-dim);letter-spacing:1px;margin-top:8px"><a onclick="go('auth')" style="color:var(--accent);cursor:pointer">Inicia sesión</a> para comentar</p>`;

    cont.innerHTML = comsHtml + comentarHtml;
  };

  window.enviarComentario = async function(postId) {
    const el  = document.getElementById(`com-${postId}`);
    const msg = document.getElementById(`com-msg-${postId}`);
    const texto = el?.value.trim();
    if (!texto) return;
    if (!currentUser) { if(msg){msg.textContent="Inicia sesión primero";msg.className="auth-msg error";} return; }
    if (msg) { msg.textContent="Enviando..."; msg.className="auth-msg"; }
    const { error } = await db.from("comentarios").insert([{ post_id: postId, autor_id: currentUser.id, contenido: texto }]);
    if (error) { if(msg){msg.textContent="Error: "+error.message;msg.className="auth-msg error";} }
    else { window.sfx?.success(); await toggleComentarios(postId); toggleComentarios(postId); }
  };

  window.abrirImgFeed = function(url) {
    document.getElementById("lightbox-img").src = url;
    document.getElementById("lightbox-caption").textContent = "";
    document.getElementById("lightbox").classList.add("visible");
  };

  window.enviarComentario = async function(postId) {
    const texto=document.getElementById("nuevo-comentario").value.trim(); const msg=document.getElementById("com-msg");
    if(!texto)return; if(!currentUser){msg.textContent="Inicia sesión primero";msg.className="auth-msg error";return;}
    msg.textContent="Enviando...";msg.className="auth-msg";
    const{error}=await db.from("comentarios").insert([{post_id:postId,autor_id:currentUser.id,contenido:texto}]);
    if(error){msg.textContent="Error: "+error.message;msg.className="auth-msg error";}
    else{window.sfx?.success();renderPostDetalle(postId);}
  };

  window.previewPostImg = function(input) {
    const preview = document.getElementById("post-img-preview");
    preview.innerHTML = "";
    if (!input.files?.[0]) return;
    const url = URL.createObjectURL(input.files[0]);
    preview.innerHTML = `<img src="${url}" style="max-height:160px;border-radius:8px;border:1px solid var(--card-b);object-fit:cover">`;
  };

  window.abrirNuevoPost = async function() {
    const sel=document.getElementById("post-categoria");
    const{data}=await db.from("categorias").select("*").order("orden");
    sel.innerHTML=(data||[]).map(c=>`<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
    document.getElementById("post-overlay").classList.add("visible");
  };
  function cerrarPostOverlay(e){if(!e||e.target===document.getElementById("post-overlay"))document.getElementById("post-overlay").classList.remove("visible");}
  window.cerrarPostOverlay=cerrarPostOverlay;

  window.crearPost = async function() {
    const titulo     = document.getElementById("post-titulo").value.trim();
    const contenido  = document.getElementById("post-contenido").value.trim();
    const categoriaId= document.getElementById("post-categoria").value;
    const imgFile    = document.getElementById("post-img-file")?.files[0];
    const msg        = document.getElementById("post-msg");
    if (!contenido) { msg.textContent="Escribe algo"; msg.className="auth-msg error"; return; }
    msg.textContent = "Publicando..."; msg.className = "auth-msg";
    try {
      let imagen_url = null;
      if (imgFile) {
        const cleanName = imgFile.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
        const fileName = `${Date.now()}-${cleanName}`;
        const { error: upErr } = await db.storage.from("posts").upload(fileName, imgFile);
        if (upErr) throw upErr;
        const { data: ud } = db.storage.from("posts").getPublicUrl(fileName);
        imagen_url = ud.publicUrl;
      }
      const { error } = await db.from("posts").insert([{
        titulo: titulo||null, contenido, autor_id: currentUser.id,
        categoria_id: categoriaId, imagen_url
      }]);
      if (error) throw error;
      cerrarPostOverlay();
      document.getElementById("post-titulo").value = "";
      document.getElementById("post-contenido").value = "";
      if (document.getElementById("post-img-file")) document.getElementById("post-img-file").value = "";
      document.getElementById("post-img-preview").innerHTML = "";
      window.sfx?.success(); renderForo();
    } catch(err) { msg.textContent = "Error: "+err.message; msg.className = "auth-msg error"; }
  };

  // ── PERFIL ────────────────────────────────────
  const COLORES_PRESET = [
    {label:"Lima",   acento:"#e8ff47", fondo:"#0d0d0d"},
    {label:"Cyan",   acento:"#00e5ff", fondo:"#070d10"},
    {label:"Rosa",   acento:"#ff6eb4", fondo:"#100810"},
    {label:"Naranja",acento:"#ff8c42", fondo:"#100a06"},
    {label:"Verde",  acento:"#39ff14", fondo:"#051005"},
    {label:"Morado", acento:"#c77dff", fondo:"#0a0510"},
    {label:"Rojo",   acento:"#ff4444", fondo:"#100505"},
    {label:"Blanco", acento:"#f0f0f0", fondo:"#0d0d0d"},
  ];

  async function renderPerfil() {
    const cont=document.getElementById("perfil-content");
    if(!currentUser){cont.innerHTML=`<div class="solicitud-login"><p>Inicia sesión para ver tu perfil</p><br><button class="btn-primary" onclick="go('auth')">Entrar</button></div>`;return;}
    const p=currentPerfil; const ini=(p.display_name||p.username||"?")[0].toUpperCase();
    const presetsHtml=COLORES_PRESET.map((c,i)=>`<div class="color-preset" style="background:${c.acento}" title="${c.label}" onclick="aplicarPreset(${i})"></div>`).join("");
    cont.innerHTML=`
      <div class="perfil-wrap">
        <div class="perfil-header">
          ${p.avatar_url?`<img src="${p.avatar_url}" class="perfil-avatar-big" alt="">`:`<div class="perfil-avatar-placeholder">${ini}</div>`}
          <div class="perfil-info">
            <div class="perfil-name">${esc(p.display_name||p.username)}</div>
            <div class="perfil-rol">${esc(p.rol)}${p.instrumento?" · "+esc(p.instrumento):""}</div>
            ${p.bio?`<p style="font-size:12px;color:var(--text-dim);margin-top:8px;line-height:1.6">${esc(p.bio)}</p>`:""}
          </div>
        </div>
        <div class="perfil-edit-box">
          <h3>EDITAR PERFIL</h3>
          <input type="text" id="edit-display" placeholder="Nombre visible" class="field" value="${esc(p.display_name||"")}">
          <input type="text" id="edit-instrumento" placeholder="Instrumento / rol" class="field" value="${esc(p.instrumento||"")}">
          <textarea id="edit-bio" placeholder="Bio" class="field textarea" rows="3">${esc(p.bio||"")}</textarea>
          <label class="file-label" onclick="abrirCrop('avatar')">
            <i class="fa-solid fa-image"></i>
            <span id="avatar-label">Cambiar foto de perfil (click para recortar)</span>
          </label>
          <button class="btn-primary full" onclick="guardarPerfil()">Guardar cambios</button>
          <p class="auth-msg" id="perfil-msg"></p>
        </div>
        <div class="color-picker-section">
          <h3>PERSONALIZAR COLORES</h3>
          <p style="font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-bottom:4px">Presets</p>
          <div class="color-presets">${presetsHtml}</div>
          <div class="color-row" style="margin-top:10px">
            <label>Color acento</label>
            <input type="color" class="color-input" id="custom-acento" value="${p.color_acento||"#e8ff47"}" oninput="previewColor('acento',this.value)">
            <label>Fondo</label>
            <input type="color" class="color-input" id="custom-fondo" value="${p.color_fondo||"#0d0d0d"}" oninput="previewColor('fondo',this.value)">
            <button class="btn-secondary" onclick="guardarColoresCustom()">Aplicar</button>
          </div>
          <p style="font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-top:6px">Los colores se guardan en tu cuenta.</p>
        </div>
        <button class="perfil-logout" onclick="doLogout()"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</button>
      </div>`;
  }

  window.aplicarPreset = function(i) {
    const c=COLORES_PRESET[i];
    aplicarTema(document.body.classList.contains("tema-claro")?"claro":"oscuro", c.acento, c.fondo);
    if(currentUser) db.from("usuarios").update({color_acento:c.acento,color_fondo:c.fondo}).eq("id",currentUser.id).then(()=>{if(currentUser){currentUser.color_acento=c.acento;currentUser.color_fondo=c.fondo;guardarSesionLocal(currentUser);}});
    document.querySelectorAll(".color-preset").forEach((el,j)=>el.classList.toggle("active",j===i));
  };

  window.previewColor = function(tipo, val) {
    if (tipo==="acento") document.documentElement.style.setProperty("--accent", val);
    else document.documentElement.style.setProperty("--bg", val);
  };

  window.guardarColoresCustom = function() {
    const acento=document.getElementById("custom-acento").value;
    const fondo=document.getElementById("custom-fondo").value;
    aplicarTema(document.body.classList.contains("tema-claro")?"claro":"oscuro", acento, fondo);
    if(currentUser) db.from("usuarios").update({color_acento:acento,color_fondo:fondo}).eq("id",currentUser.id);
  };

  window.guardarPerfil = async function() {
    const msg=document.getElementById("perfil-msg"); msg.textContent="Guardando..."; msg.className="auth-msg";
    const updates={display_name:document.getElementById("edit-display").value.trim(),instrumento:document.getElementById("edit-instrumento").value.trim(),bio:document.getElementById("edit-bio").value.trim()};
    if(cropBlob){
      const fileName=`${currentUser.id}-avatar.jpg`;
      await db.storage.from("avatars").upload(fileName,cropBlob,{upsert:true,contentType:"image/jpeg"});
      const{data:ud}=db.storage.from("avatars").getPublicUrl(fileName);
      updates.avatar_url=ud.publicUrl+"?t="+Date.now(); cropBlob=null;
    }
    const{error}=await db.from("usuarios").update(updates).eq("id",currentUser.id);
    if(error){msg.textContent="Error: "+error.message;msg.className="auth-msg error";}
    else{const{data}=await db.from("usuarios").select("*").eq("id",currentUser.id).single();currentPerfil=data;currentUser=data;guardarSesionLocal(data);msg.textContent="¡Guardado!";msg.className="auth-msg success";window.sfx?.success();updateNavUser();setTimeout(()=>renderPerfil(),600);}
  };

  window.añadirMiembroBanda = async function() {
    const email = document.getElementById("banda-email").value.trim().toLowerCase();
    const msg   = document.getElementById("banda-msg");
    if (!email || !email.includes("@")) { msg.textContent = "Pon un email válido"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Buscando usuario..."; msg.className = "auth-msg";
    // Busca el perfil por email en auth (via perfiles si tiene email guardado, o por accesos)
    const { data: perfil } = await db.from("perfiles")
      .select("id, username, rol")
      .eq("id", (await db.from("accesos_privados").select("id").eq("email", email).single())?.data?.id || "")
      .single();
    if (!perfil) {
      // Intenta añadir a accesos y marcar rol si existe
      const { error: accErr } = await db.from("accesos_privados").upsert([{ email }], { onConflict: "email" });
      if (accErr) { msg.textContent = "Error: " + accErr.message; msg.className = "auth-msg error"; return; }
      msg.textContent = "✓ Email añadido a accesos. Cuando inicie sesión aparecerá en la banda automáticamente.";
      msg.className = "auth-msg success";
      document.getElementById("banda-email").value = "";
      cargarAccesos();
      return;
    }
    // Si ya tiene perfil, cambia su rol a banda
    const { error } = await db.from("perfiles").update({ rol: "banda" }).eq("id", perfil.id);
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else {
      msg.textContent = "✓ Miembro añadido a la banda";
      msg.className = "auth-msg success";
      document.getElementById("banda-email").value = "";
      setTimeout(() => { msg.textContent = ""; }, 3000);
    }
  };

  window.doLogout = function() {
    if (!confirm("¿Cerrar sesión?")) return;
    borrarSesionLocal();
    currentUser = null;
    currentPerfil = null;
    tieneAccesoPrivado = false;
    updateNavUser();
    const lockBtn = document.querySelector(".lock-btn");
    if (lockBtn) {
      lockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> PRIVADO`;
      lockBtn.onclick = () => openLogin("privado");
      lockBtn.style.cssText = "";
    }
    go("home");
  };

  // ── INIT ─────────────────────────────────────
  go("home");

});
