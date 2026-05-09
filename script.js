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

  let galeriaTipo = 'foto';
  window.setGaleriaTipo = function(tipo) {
    galeriaTipo = tipo;
    document.getElementById("galeria-tipo-foto").classList.toggle("active", tipo === "foto");
    document.getElementById("galeria-tipo-video").classList.toggle("active", tipo === "video");
    document.getElementById("galeria-foto-input").style.display = tipo === "foto" ? "block" : "none";
    document.getElementById("galeria-video-input").style.display = tipo === "video" ? "block" : "none";
  };

  // ── ZONA PRIVADA PANELS ──────────────────────
  window.switchPrivado = function(id, btn) {
    document.querySelectorAll(".privado-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".privado-nav-btn").forEach(b => b.classList.remove("active"));
    const panel = document.getElementById("panel-" + id);
    if (panel) panel.classList.add("active");
    if (btn) btn.classList.add("active");
    // Load data for specific panels
    if (id === "accesos")         cargarAccesos();
    if (id === "solicitudes-priv") cargarSolicitudesAdmin();
    if (id === "todos-beats")      cargarBeats("admin-list", null);
    if (id === "letras-priv")      cargarLetrasAdmin();
    if (id === "galeria-admin")    cargarGaleriaAdmin();
  };
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
  // Storage con fallback para Brave y navegadores estrictos
  function setStorage(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {
      try { sessionStorage.setItem(key, val); } catch(e2) {}
    }
  }
  function getStorage(key) {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key); } catch(e) {
      try { return sessionStorage.getItem(key); } catch(e2) { return null; }
    }
  }

  function aplicarTema(tema, acento, fondo) {
    document.body.classList.toggle("tema-claro", tema === "claro");
    if (acento) {
      document.documentElement.style.setProperty("--accent", acento);
      document.documentElement.style.setProperty("--cursor-color", acento);
      setStorage("mitø-acento", acento);
    }
    if (fondo) {
      document.documentElement.style.setProperty("--bg", fondo);
      setStorage("mitø-fondo", fondo);
    }
    setStorage("mitø-tema", tema || "oscuro");
  }

  // ── SESIÓN LOCAL ─────────────────────────────
  const SESS_KEY = "mito_sesion";

  function guardarSesionLocal(usuario) {
    try {
      setStorage(SESS_KEY, JSON.stringify({ ...usuario, _ts: Date.now() }));
      // También guarda tema en localStorage para carga inmediata
      if (usuario.tema)         setStorage("mitø-tema", usuario.tema);
      if (usuario.color_acento) setStorage("mitø-acento", usuario.color_acento);
      if (usuario.color_fondo)  setStorage("mitø-fondo", usuario.color_fondo);
    } catch(e) {}
  }

  function leerSesionLocal() {
    try {
      const raw = getStorage(SESS_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data._ts > 30 * 24 * 60 * 60 * 1000) {
        try { localStorage.removeItem(SESS_KEY); } catch(e) { try { sessionStorage.removeItem(SESS_KEY); } catch(e2) {} } return null;
      }
      return data;
    } catch(e) { return null; }
  }

  function borrarSesionLocal() {
    try { localStorage.removeItem(SESS_KEY); } catch(e) {} try { sessionStorage.removeItem(SESS_KEY); } catch(e) {}
  }

  // Aplica colores INMEDIATAMENTE — con fallback para Brave
  (function() {
    function get(key) {
      try { return localStorage.getItem(key) || sessionStorage.getItem(key); } catch(e) {
        try { return sessionStorage.getItem(key); } catch(e2) { return null; }
      }
    }
    const tema   = get("mitø-tema") || "oscuro";
    const acento = get("mitø-acento");
    const fondo  = get("mitø-fondo");
    document.body.classList.toggle("tema-claro", tema === "claro");
    if (acento) {
      document.documentElement.style.setProperty("--accent", acento);
      document.documentElement.style.setProperty("--cursor-color", acento);
    }
    if (fondo) document.documentElement.style.setProperty("--bg", fondo);
  })();

  window.toggleTheme = function() {
    const claro = document.body.classList.contains("tema-claro");
    const nuevoTema = claro ? "oscuro" : "claro";
    const acento = currentUser?.color_acento || localStorage.getItem("mitø-acento");
    const fondo  = currentUser?.color_fondo  || localStorage.getItem("mitø-fondo");
    aplicarTema(nuevoTema, acento, fondo);
    if (currentUser) {
      currentUser.tema = nuevoTema;
      guardarSesionLocal(currentUser);
      db.from("usuarios").update({ tema: nuevoTema }).eq("id", currentUser.id).catch(()=>{});
    }
  };

  // ── INIT SESIÓN ───────────────────────────────
  async function initSession() {
    const saved = leerSesionLocal();
    if (!saved) { updateNavUser(); return; }

    // Aplica tema guardado en sesión
    if (saved.color_acento) document.documentElement.style.setProperty("--accent", saved.color_acento);
    if (saved.color_fondo)  document.documentElement.style.setProperty("--bg", saved.color_fondo);

    // Verifica que el usuario sigue en BD
    try {
      const { data } = await db.from("usuarios").select("*").eq("id", saved.id).single();
      if (data) {
        currentUser = data; currentPerfil = data;
        guardarSesionLocal(data); // refresca timestamp
        if (data.color_acento) document.documentElement.style.setProperty("--accent", data.color_acento);
        if (data.color_fondo)  document.documentElement.style.setProperty("--bg", data.color_fondo);
        tieneAccesoPrivado = data.rol === "banda" || data.rol === "admin";
      } else {
        borrarSesionLocal();
      }
    } catch(e) {
      // Sin conexión — usa datos guardados igualmente
      currentUser = saved; currentPerfil = saved;
      tieneAccesoPrivado = saved.rol === "banda" || saved.rol === "admin";
    }
    updateNavUser();
    updateNavPrivado();
  }
  initSession();

  // Supabase Auth reemplazado por sistema propio
  // onAuthStateChange ya no se usa

  function updateNavUser() {
    const sideBtn = document.getElementById("side-auth-btn");
    const mobBtn  = document.getElementById("mob-auth-btn");
    if (currentUser) {
      const name = esc(currentUser.display_name || currentUser.username || "perfil");
      if (sideBtn) { sideBtn.innerHTML = `<i class="fa-solid fa-user"></i><span class="btn-label">${name}</span>`; sideBtn.onclick = () => go("perfil"); sideBtn.className = "side-auth-btn"; }
      if (mobBtn)  { mobBtn.innerHTML = `<i class="fa-solid fa-user"></i><span>yo</span>`; mobBtn.onclick = () => go("perfil", mobBtn); }
    } else {
      if (sideBtn) { sideBtn.innerHTML = `<i class="fa-solid fa-user"></i><span class="btn-label">entrar</span>`; sideBtn.onclick = () => go("auth"); }
      if (mobBtn)  { mobBtn.innerHTML = `<i class="fa-solid fa-user"></i><span>yo</span>`; mobBtn.onclick = () => go("auth", mobBtn); }
    }
  }

  async function comprobarAccesoPrivado() {
    if (!currentUser) { tieneAccesoPrivado = false; return; }
    tieneAccesoPrivado = currentUser.rol === "banda" || currentUser.rol === "admin";
    updateNavPrivado();
  }

  function updateNavPrivado() {
    const lockBtn  = document.getElementById("side-lock-btn");
    const mobPriv  = document.getElementById("mob-priv-btn");
    if (tieneAccesoPrivado) {
      if (lockBtn) {
        lockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i><span class="btn-label">privado</span>`;
        lockBtn.onclick = () => go("privado");
        lockBtn.style.color = "#6bffb8";
      }
      if (mobPriv) {
        mobPriv.innerHTML = `<i class="fa-solid fa-lock-open"></i><span>privado</span>`;
        mobPriv.onclick = () => go("privado", mobPriv);
        mobPriv.style.color = "var(--accent)";
      }
    } else {
      if (lockBtn) {
        lockBtn.innerHTML = `<i class="fa-solid fa-lock"></i><span class="btn-label">privado</span>`;
        lockBtn.onclick = () => openLogin("privado");
        lockBtn.style.color = "";
      }
      if (mobPriv) {
        mobPriv.innerHTML = `<i class="fa-solid fa-lock"></i><span>privado</span>`;
        mobPriv.onclick = () => openLogin("privado");
        mobPriv.style.color = "";
      }
    }
  }

  // ── NAV ──────────────────────────────────────
  // Orden de páginas para animación de dirección
  const PAGE_ORDER = ["home","beats","galeria","banda","foro","letras","about","soporte","auth","perfil","privado"];
  let currentPage = "home";

  function go(id, btnEl, closeMenu) {
    if (id === currentPage) return;
    const oldIdx = PAGE_ORDER.indexOf(currentPage);
    const newIdx = PAGE_ORDER.indexOf(id);
    const dir    = newIdx >= oldIdx ? "slide-from-right" : "slide-from-left";

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) {
      target.classList.remove("slide-from-right","slide-from-left","slide-from-bottom");
      target.classList.add(dir);
      // Force reflow
      void target.offsetWidth;
      target.classList.add("active");
    }

    // Update side nav
    document.querySelectorAll(".side-btn, .mob-nav-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");

    currentPage = id;

    if (id==="beats")   cargarBeats("beats-list", false);
    if (id==="home")    cargarBeats("home-beats", false, 3);
    if (id==="privado") { cargarBeats("admin-list", null); cargarSolicitudesAdmin(); cargarAccesos(); cargarAmbientTracks(); }
    if (id==="galeria") cargarGaleria();
    if (id==="banda")   { cargarBanda(); renderSolicitudForm(); }
    if (id==="foro")    renderForo();
    if (id==="perfil")  renderPerfil();
    if (id==="letras")  cargarLetras();
    if (id==="privado") { cargarBeats("admin-list", null); cargarSolicitudesAdmin(); cargarAccesos(); cargarNotificaciones(); }
  }
  window.go = go;
  window.toggleMenu = function() {}; // no-op, kept for compatibility

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
    const btn      = document.querySelector("#auth-register .btn-primary");

    if (!email || !email.includes("@")) { msg.textContent="pon un email válido"; msg.className="auth-msg error"; return; }
    if (!username) { msg.textContent="pon un nombre de usuario"; msg.className="auth-msg error"; return; }
    if (pass.length < 6) { msg.textContent="la contraseña debe tener al menos 6 caracteres"; msg.className="auth-msg error"; return; }

    msg.textContent = "creando cuenta..."; msg.className = "auth-msg";
    if (btn) btn.disabled = true;

    try {
      // Comprueba si ya existe antes de insertar
      const { data: existe } = await db.from("usuarios")
        .select("id").or(`email.eq.${email},username.eq.${username}`).limit(1);

      if (existe && existe.length > 0) {
        msg.textContent = "ese email o usuario ya existe";
        msg.className = "auth-msg error"; window.sfx?.error();
        if (btn) btn.disabled = false;
        return;
      }

      const passHash = await sha256(pass);

      const { data, error } = await db.from("usuarios").insert([{
        email, username,
        password_hash: passHash,
        display_name: username,
        rol: "fan"
      }]).select().single();

      if (error) {
        msg.textContent = error.code === "23505"
          ? "ese email o usuario ya existe"
          : "error: " + error.message;
        msg.className = "auth-msg error"; window.sfx?.error();
      } else {
        currentUser = data; currentPerfil = data;
        guardarSesionLocal(data);
        tieneAccesoPrivado = false;
        updateNavUser(); updateNavPrivado();
        msg.textContent = "¡cuenta creada! 🎉";
        msg.className = "auth-msg success"; window.sfx?.success();
        setTimeout(() => go("home"), 800);
      }
    } catch(e) {
      console.error(e);
      msg.textContent = "error de conexión — inténtalo de nuevo";
      msg.className = "auth-msg error"; window.sfx?.error();
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ── CROP ─────────────────────────────────────
  let cropImg = null, cropScale = 1;
  let cropX=0, cropY=0, cropW=0, cropH=0;
  let cropDragging=false, cropStartX=0, cropStartY=0, cropMode="move";

  function abrirCrop(target) {
    cropTarget = target;
    const isSquare = target === "cover" || target === "avatar" || target === "letra-cover";
    const hint = document.getElementById("crop-hint");
    if (hint) hint.textContent = isSquare ? "arrastra para mover · recorte 1:1" : "arrastra para seleccionar el área · recorte libre";
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
        const maxW = Math.min(420, window.innerWidth - 48);
        const maxH = Math.min(420, window.innerHeight * 0.55);
        cropScale = Math.min(maxW / img.width, maxH / img.height, 1);
        canvas.width  = img.width  * cropScale;
        canvas.height = img.height * cropScale;
        container.style.width  = canvas.width  + "px";
        container.style.height = canvas.height + "px";
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (isSquare) {
          // 1:1 centered
          const s = Math.min(canvas.width, canvas.height) * 0.82;
          cropW = s; cropH = s;
          cropX = (canvas.width  - s) / 2;
          cropY = (canvas.height - s) / 2;
        } else {
          // Free — start with full image
          cropX = 0; cropY = 0;
          cropW = canvas.width; cropH = canvas.height;
        }
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
    sel.style.width  = cropW + "px";
    sel.style.height = cropH + "px";
  }

  const canvas = document.getElementById("crop-canvas");
  const cropCanvas = document.getElementById("crop-canvas");
  const isSquareCrop = () => cropTarget === "cover" || cropTarget === "avatar";

  cropCanvas.addEventListener("mousedown", e => {
    cropDragging = true;
    const r = cropCanvas.getBoundingClientRect();
    cropStartX = e.clientX - r.left;
    cropStartY = e.clientY - r.top;
    if (!isSquareCrop()) { cropX = cropStartX; cropY = cropStartY; cropW = 0; cropH = 0; }
  });
  cropCanvas.addEventListener("touchstart", e => {
    cropDragging = true;
    const r = cropCanvas.getBoundingClientRect();
    const t = e.touches[0];
    cropStartX = t.clientX - r.left;
    cropStartY = t.clientY - r.top;
    if (!isSquareCrop()) { cropX = cropStartX; cropY = cropStartY; cropW = 0; cropH = 0; }
  }, { passive: true });

  function onCropMove(clientX, clientY) {
    if (!cropDragging || !cropCanvas) return;
    const r = cropCanvas.getBoundingClientRect();
    const mx = clientX - r.left;
    const my = clientY - r.top;
    if (isSquareCrop()) {
      // Move existing square selection
      cropX = Math.max(0, Math.min(mx - cropW/2, cropCanvas.width  - cropW));
      cropY = Math.max(0, Math.min(my - cropH/2, cropCanvas.height - cropH));
    } else {
      // Draw free selection
      cropX = Math.min(cropStartX, mx);
      cropY = Math.min(cropStartY, my);
      cropW = Math.abs(mx - cropStartX);
      cropH = Math.abs(my - cropStartY);
      cropX = Math.max(0, cropX);
      cropY = Math.max(0, cropY);
      cropW = Math.min(cropW, cropCanvas.width  - cropX);
      cropH = Math.min(cropH, cropCanvas.height - cropY);
    }
    renderCropSelection();
  }
  document.addEventListener("mousemove",  e => { if(cropDragging) onCropMove(e.clientX, e.clientY); });
  document.addEventListener("touchmove",  e => { if(cropDragging) onCropMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener("mouseup",    () => cropDragging = false);
  document.addEventListener("touchend",   () => cropDragging = false);

  window.confirmarCrop = function() {
    const out = document.createElement("canvas");
    const isSquare = cropTarget === "cover" || cropTarget === "avatar";
    const realX = cropX / cropScale;
    const realY = cropY / cropScale;
    const realW = cropW / cropScale;
    const realH = cropH / cropScale;
    out.width  = isSquare ? 400 : Math.round(realW);
    out.height = isSquare ? 400 : Math.round(realH);
    const ctx = out.getContext("2d");
    ctx.drawImage(cropImg, realX, realY, realW, realH, 0, 0, out.width, out.height);
    out.toBlob(blob => {
      if (!blob) return;
      if (cropTarget === "cover") {
        coverBlob = blob;
        document.getElementById("cover-name-label").textContent = "✓ cover lista";
      } else if (cropTarget === "galeria") {
        galeriaBlob = blob;
        document.getElementById("galeria-file-label").textContent = "✓ foto lista";
      } else if (cropTarget === "avatar") {
        cropBlob = blob;
        document.getElementById("avatar-label").textContent = "✓ avatar listo";
      } else if (cropTarget === "letra-cover") {
        window._letraCoverBlob = blob;
        document.getElementById("letra-cover-label").textContent = "✓ portada lista";
        // Crear un input file virtual para el upload
        document.getElementById("letra-cover-file") || (() => {
          const inp = document.createElement("input");
          inp.type = "file"; inp.id = "letra-cover-file"; inp.style.display = "none";
          document.body.appendChild(inp);
        })();
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
    const cont     = document.getElementById("beat-detail-content");
    const inspsArr = beat.inspiraciones ? beat.inspiraciones.split(",").map(s=>s.trim()).filter(Boolean) : [];

    cont.innerHTML = `
      <button class="beat-detail-close" onclick="cerrarBeatOverlay()">
        <i class="fa-solid fa-arrow-left"></i> volver
      </button>
      <div class="beat-detail-card">
        <div class="beat-detail-cover-wrap">
          ${beat.cover_url
            ? `<img src="${beat.cover_url}" class="beat-detail-cover" alt="">`
            : `<div class="beat-detail-cover-placeholder"><i class="fa-solid fa-music"></i></div>`}
        </div>
        <div class="beat-detail-meta">
          <div class="beat-detail-title">${esc(beat.title)}</div>
          <div class="beat-detail-artist">mitø</div>
          <div class="beat-detail-tags" style="margin-top:10px">
            ${beat.genre ? `<span class="beat-meta-tag">${esc(beat.genre)}</span>` : ""}
            ${beat.bpm   ? `<span class="beat-meta-tag bpm">${beat.bpm} bpm</span>` : ""}
            ${beat.tono  ? `<span class="beat-meta-tag">${esc(beat.tono)}</span>` : ""}
            <span class="beat-meta-tag" id="detail-plays-${beat.id}"><i class="fa-solid fa-play" style="font-size:8px"></i> —</span>
          </div>
          ${inspsArr.length ? `
          <div class="beat-detail-insps" style="margin-top:10px">
            <span class="beat-detail-insps-label">inspirado en</span>
            ${inspsArr.map(i=>`<span class="beat-insp-tag-big">${esc(i)}</span>`).join("")}
          </div>` : ""}
        </div>
      </div>

      <div class="beat-detail-player">
        <canvas class="viz-canvas" id="detail-canvas" style="width:100%;height:64px;border-radius:8px;cursor:pointer"></canvas>
        <div class="player-meta" style="margin-top:6px">
          <span id="detail-cur">0:00</span>
          <span id="detail-tot">—</span>
        </div>
        <div class="beat-detail-controls">
          <button class="play-btn" id="detail-play-btn" style="width:48px;height:48px;font-size:16px">
            <i class="fa-solid fa-play"></i>
          </button>
        </div>
      </div>`;

    // Init canvas visualizer
    const canvas  = document.getElementById("detail-canvas");
    const playBtn = document.getElementById("detail-play-btn");
    const timeCur = document.getElementById("detail-cur");
    const timeTot = document.getElementById("detail-tot");
    let audio = null, playing = false;
    let dAudioCtx = null, dAnalyser = null, dSource = null, dRaf = null;

    function getAccent() { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c8f0a0"; }

    function drawDetailStatic(prog01 = 0) {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight || 64;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const accent = getAccent();
      let bars;
      try { bars = beat.waveform ? (typeof beat.waveform==="string"?JSON.parse(beat.waveform):beat.waveform) : null; } catch(e) { bars=null; }
      if (!bars) {
        let s = ((beat.id||0)*1664525+1013904223)&0xffffffff;
        bars = Array.from({length:80},()=>{ s=(s*1664525+1013904223)&0xffffffff; return 15+((s>>>0)/0xffffffff)*68; });
      }
      const progX = prog01 * W;
      ctx.clearRect(0,0,W,H);
      bars.forEach((h,i) => {
        const x  = (i/bars.length)*W;
        const bw = Math.max((W/bars.length)-1,1);
        const bh = Math.max((h/100)*H,2);
        ctx.fillStyle = x < progX ? accent : "rgba(255,255,255,0.13)";
        ctx.beginPath(); ctx.roundRect(x,H-bh,bw,bh,2); ctx.fill();
      });
    }

    function drawDetailFreq() {
      if (!dAnalyser || !canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const buf = new Uint8Array(dAnalyser.frequencyBinCount);
      dAnalyser.getByteFrequencyData(buf);
      ctx.clearRect(0,0,W,H);
      const accent = getAccent();
      const n = 80, slice = Math.floor(buf.length/n);
      const progX = audio?.duration ? (audio.currentTime/audio.duration)*W : 0;
      for (let i=0;i<n;i++) {
        let s=0; for(let j=0;j<slice;j++) s+=buf[i*slice+j];
        const avg=s/slice, x=(i/n)*W, bw=Math.max((W/n)-1,1), bh=Math.max((avg/255)*H,2);
        ctx.fillStyle = x<progX ? accent : `rgba(255,255,255,${0.08+(avg/255)*0.3})`;
        ctx.beginPath(); ctx.roundRect(x,H-bh,bw,bh,2); ctx.fill();
      }
      if (audio) {
        timeCur.textContent = fmt(audio.currentTime);
        if (audio.duration) timeTot.textContent = fmt(audio.duration);
      }
      dRaf = requestAnimationFrame(drawDetailFreq);
    }

    function getDetailAudio() {
      if (audio) return audio;
      audio = new Audio(beat.audio_url);
      audio.crossOrigin = "anonymous";
      audio.addEventListener("loadedmetadata", () => timeTot.textContent = fmt(audio.duration));
      audio.addEventListener("timeupdate", () => { if(!playing && audio.duration) drawDetailStatic(audio.currentTime/audio.duration); timeCur.textContent=fmt(audio.currentTime); });
      audio.addEventListener("ended", () => { playing=false; playBtn.innerHTML=`<i class="fa-solid fa-play"></i>`; cancelAnimationFrame(dRaf); drawDetailStatic(0); timeCur.textContent="0:00"; });
      return audio;
    }

    playBtn.addEventListener("click", () => {
      const a = getDetailAudio();
      // Stop card players
      if (activeAudio && activeAudio!==a) { activeAudio.pause(); activeCard?.classList.remove("is-playing"); activeCard?.querySelector(".play-btn")&&(activeCard.querySelector(".play-btn").innerHTML=`<i class="fa-solid fa-play"></i>`); activeCard?._stopViz?.(); }
      if (playing) {
        a.pause(); playing=false; playBtn.innerHTML=`<i class="fa-solid fa-play"></i>`;
        cancelAnimationFrame(dRaf); drawDetailStatic(a.duration?a.currentTime/a.duration:0);
        activeAudio=null; window.sfx?.pause();
      } else {
        if (!dAudioCtx) {
          try { dAudioCtx=new(window.AudioContext||window.webkitAudioContext)(); dAnalyser=dAudioCtx.createAnalyser(); dAnalyser.fftSize=512; dSource=dAudioCtx.createMediaElementSource(a); dSource.connect(dAnalyser); dAnalyser.connect(dAudioCtx.destination); } catch(e){}
        }
        if (dAudioCtx?.state==="suspended") dAudioCtx.resume();
        if (ambientPlaying) { ambientAudio.pause(); }
        a.play().catch(()=>{}); playing=true;
        playBtn.innerHTML=`<i class="fa-solid fa-pause"></i>`;
        activeAudio=a; activeCard=null;
        cancelAnimationFrame(dRaf); drawDetailFreq();
        window.sfx?.play();
      }
    });

    // Seek on canvas click
    canvas.addEventListener("click", e => {
      const a = getDetailAudio(); if (!a.duration) return;
      const r = canvas.getBoundingClientRect();
      const p = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      a.currentTime = p*a.duration; timeCur.textContent=fmt(a.currentTime);
      if (!playing) drawDetailStatic(p);
    });

    requestAnimationFrame(() => { canvas.width=canvas.offsetWidth; canvas.height=64; drawDetailStatic(0); });
    document.getElementById("beat-overlay").classList.add("visible");
    // Carga reproducciones
    db.from("reproducciones").select("id", { count: "exact" }).eq("beat_id", beat.id)
      .then(({ count }) => {
        const el = document.getElementById(`detail-plays-${beat.id}`);
        if (el) el.innerHTML = `<i class="fa-solid fa-play" style="font-size:8px"></i> ${count || 0} plays`;
      });
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
          ${beat.bpm  ? `<span class="beat-meta-tag bpm">${beat.bpm} bpm</span>` : ""}
          ${beat.tono ? `<span class="beat-meta-tag">${esc(beat.tono)}</span>` : ""}
        </div>
        ${inspsArr.length ? `<div class="beat-insps">${inspsArr.map(i=>`<span class="beat-insp-tag">${esc(i)}</span>`).join("")}</div>` : ""}
      </div>
      ${beat.privado ? `<span class="beat-priv-tag"><i class="fa-solid fa-lock"></i></span>` : ""}
      <div class="custom-player">
        <button class="play-btn"><i class="fa-solid fa-play"></i></button>
        <div class="player-right">
          <canvas class="viz-canvas" id="viz-${beat.id||index}"></canvas>
          <div class="player-meta"><span class="time-cur">0:00</span><span class="time-tot">—</span></div>
        </div>
      </div>
      ${admin ? `<button class="delete-btn" title="borrar"><i class="fa-solid fa-trash"></i></button>` : ""}`;

    card.addEventListener("click", e => {
      if (e.target.closest(".custom-player,.delete-btn")) return;
      abrirBeatDetalle(beat);
    });

    const playBtn = card.querySelector(".play-btn");
    const canvas  = card.querySelector(".viz-canvas");
    const timeCur = card.querySelector(".time-cur");
    const timeTot = card.querySelector(".time-tot");
    let audio = null, isPlaying = false;
    let audioCtx = null, analyser = null, source = null, vizRaf = null;

    function getAccent() {
      return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c8f0a0";
    }

    function drawStatic(progress01 = 0) {
      if (!canvas || canvas.offsetWidth === 0) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const accent = getAccent();
      let bars;
      try {
        bars = beat.waveform
          ? (typeof beat.waveform === "string" ? JSON.parse(beat.waveform) : beat.waveform)
          : null;
      } catch(e) { bars = null; }
      if (!bars) {
        let s = ((beat.id || index) * 1664525 + 1013904223) & 0xffffffff;
        bars = Array.from({length: 55}, () => {
          s = (s * 1664525 + 1013904223) & 0xffffffff;
          return 15 + ((s >>> 0) / 0xffffffff) * 68;
        });
      }
      ctx.clearRect(0, 0, W, H);
      const progX = progress01 * W;
      bars.forEach((h, i) => {
        const x  = (i / bars.length) * W;
        const bw = Math.max((W / bars.length) - 1.5, 1);
        const bh = Math.max((h / 100) * H, 2);
        ctx.fillStyle = x < progX ? accent : "rgba(255,255,255,0.13)";
        ctx.beginPath();
        ctx.roundRect(x, H - bh, bw, bh, 2);
        ctx.fill();
      });
    }

    function drawFreq() {
      if (!analyser || !canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const bufLen = analyser.frequencyBinCount;
      const dataArr = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(dataArr);
      ctx.clearRect(0, 0, W, H);
      const accent = getAccent();
      const numBars = 55;
      const slice   = Math.floor(bufLen / numBars);
      const progX   = audio?.duration ? (audio.currentTime / audio.duration) * W : 0;
      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        for (let j = 0; j < slice; j++) sum += dataArr[i * slice + j];
        const avg = sum / slice;
        const x   = (i / numBars) * W;
        const bw  = Math.max((W / numBars) - 1.5, 1);
        const bh  = Math.max((avg / 255) * H, 2);
        ctx.fillStyle = x < progX ? accent : `rgba(255,255,255,${0.1 + (avg/255)*0.25})`;
        ctx.beginPath();
        ctx.roundRect(x, H - bh, bw, bh, 2);
        ctx.fill();
      }
      if (audio) {
        timeCur.textContent = fmt(audio.currentTime);
        if (audio.duration && timeTot.textContent === "—") timeTot.textContent = fmt(audio.duration);
      }
      vizRaf = requestAnimationFrame(drawFreq);
    }

    function initAudioCtx() {
      if (audioCtx) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser  = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source    = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch(e) { console.warn("AudioCtx:", e); }
    }

    function getAudio() {
      if (audio) return audio;
      audio = new Audio(beat.audio_url);
      audio.crossOrigin = "anonymous";
      audio.addEventListener("loadedmetadata", () => {
        timeTot.textContent = fmt(audio.duration);
      });
      audio.addEventListener("timeupdate", () => {
        if (audio.duration) drawStatic(audio.currentTime / audio.duration);
      });
      audio.addEventListener("ended", () => {
        isPlaying = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        card.classList.remove("is-playing");
        cancelAnimationFrame(vizRaf);
        drawStatic(0);
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
          activeCard._stopViz?.();
        }
      }
    }

    card._stopViz = () => {
      cancelAnimationFrame(vizRaf);
      if (audio) drawStatic(audio.duration ? audio.currentTime / audio.duration : 0);
    };

    playBtn.addEventListener("click", e => {
      e.stopPropagation();
      const a = getAudio();
      if (isPlaying) {
        a.pause(); isPlaying = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        card.classList.remove("is-playing");
        cancelAnimationFrame(vizRaf);
        drawStatic(a.duration ? a.currentTime / a.duration : 0);
        activeAudio = null; activeCard = null; window.sfx?.pause();
        // Reanuda música de fondo
        if (ambientTracks.length && !ambientPlaying) {
          ambientAudio.play().catch(()=>{}); ambientPlaying = true;
          const mpToggle = document.getElementById("mp-toggle");
          const mpIcon   = document.getElementById("mp-play-btn");
          if (mpToggle) mpToggle.innerHTML = '<i class="fa-solid fa-pause"></i>';
          if (mpIcon)   mpIcon.innerHTML   = '<i class="fa-solid fa-pause"></i>';
        }
      } else {
        stopOthers();
        if (ambientPlaying) { ambientAudio.pause(); }
        initAudioCtx();
        if (audioCtx?.state === "suspended") audioCtx.resume();
        a.play().catch(()=>{});
        isPlaying = true;
        playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
        card.classList.add("is-playing");
        activeAudio = a; activeCard = card;
        cancelAnimationFrame(vizRaf);
        drawFreq();
        window.sfx?.play();
        // Registra reproducción
        db.from("reproducciones").insert([{ beat_id: beat.id }]).catch(()=>{});
      }
    });

    // Seek al hacer click en el canvas
    canvas.addEventListener("click", e => {
      e.stopPropagation();
      const a = getAudio();
      if (!a.duration) { a.load(); return; }
      const rect = canvas.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      a.currentTime = pct * a.duration;
      timeCur.textContent = fmt(a.currentTime);
      if (!isPlaying) drawStatic(pct);
    });

    // Init static on mount
    requestAnimationFrame(() => drawStatic(0));

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
        const esVideo = foto.tipo === "video";
        const item = document.createElement("div");
        item.className = "galeria-item" + (esVideo ? " video-item" : "");
        if (esVideo) {
          item.innerHTML = `<video src="${foto.url}" muted preload="metadata" loading="lazy"></video><div class="galeria-video-icon"><i class="fa-solid fa-play"></i></div><div class="galeria-item-overlay">${foto.caption?`<p class="galeria-caption">${esc(foto.caption)}</p>`:""}</div>`;
          item.addEventListener("click", () => {
            const lb = document.getElementById("lightbox");
            const lbImg = document.getElementById("lightbox-img");
            const lbVid = document.getElementById("lightbox-video");
            lbImg.style.display = "none"; lbVid.style.display = "block";
            lbVid.src = foto.url; lbVid.play();
            document.getElementById("lightbox-caption").textContent = foto.caption || "";
            lb.classList.add("visible");
          });
        } else {
          item.innerHTML = `<img src="${foto.url}" alt="${esc(foto.caption||"")}" loading="lazy"><div class="galeria-item-overlay">${foto.caption?`<p class="galeria-caption">${esc(foto.caption)}</p>`:""}</div>`;
          item.addEventListener("click", () => {
            const lb = document.getElementById("lightbox");
            const lbImg = document.getElementById("lightbox-img");
            const lbVid = document.getElementById("lightbox-video");
            lbImg.style.display = "block"; lbVid.style.display = "none"; lbVid.pause();
            lbImg.src = foto.url;
            document.getElementById("lightbox-caption").textContent = foto.caption || "";
            lb.classList.add("visible");
          });
        }
        grid.appendChild(item);
      });
    } catch(err){grid.innerHTML=`<p class="loading-msg no-spin">⚠️ ${err.message==="TIMEOUT"?"Sin conexión":"Error al cargar"}</p>`;}
  }

  function cerrarLightbox() {
    document.getElementById("lightbox").classList.remove("visible");
    const vid = document.getElementById("lightbox-video");
    if (vid) { vid.pause(); vid.src = ""; }
  }
  window.cerrarLightbox = cerrarLightbox;

  window.subirGaleria = async function() {
    const caption = document.getElementById("galeria-caption").value.trim();
    const tipo    = typeof galeriaTipo !== "undefined" ? galeriaTipo : "foto";

    if (tipo === "foto" && !galeriaBlob) { alert("elige y recorta una foto primero"); return; }
    if (tipo === "video" && !document.getElementById("galeria-video")?.files[0]) { alert("elige un vídeo primero"); return; }

    const btns = document.querySelectorAll("#privado .upload-box .btn-primary");
    const btn  = btns[1] || btns[0];
    if (btn) { btn.textContent = "subiendo..."; btn.disabled = true; }

    try {
      if (tipo === "foto") {
        const fileName = `${Date.now()}-galeria.jpg`;
        const { error: upErr } = await db.storage.from("galeria").upload(fileName, galeriaBlob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from("galeria").getPublicUrl(fileName);
        await db.from("galeria").insert([{ url: urlData.publicUrl, caption, tipo: "foto" }]);
        document.getElementById("galeria-file-label").textContent = "elige una foto (recorte libre)";
        galeriaBlob = null;
      } else {
        const videoFile = document.getElementById("galeria-video").files[0];
        const cleanName = videoFile.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
        const fileName = `${Date.now()}-${cleanName}`;
        const { error: upErr } = await db.storage.from("videos").upload(fileName, videoFile);
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from("videos").getPublicUrl(fileName);
        await db.from("galeria").insert([{ url: urlData.publicUrl, caption, tipo: "video", video_url: urlData.publicUrl }]);
        document.getElementById("galeria-video").value = "";
        document.getElementById("galeria-video-label").textContent = "elige un vídeo";
      }
      document.getElementById("galeria-caption").value = "";
      if (btn) { btn.textContent = "¡subido! 🔥"; window.sfx?.upload(); setTimeout(() => { btn.textContent = "subir"; btn.disabled = false; }, 2000); }
    } catch(err) {
      alert("error: " + err.message);
      if (btn) { btn.textContent = "subir"; btn.disabled = false; }
    }
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
        card.style.cursor="pointer";
        card.innerHTML=`
          ${m.avatar_url?`<img src="${m.avatar_url}" class="banda-avatar" alt="">`: `<div class="banda-avatar-placeholder">${ini}</div>`}
          <div class="banda-name">${esc(m.display_name||m.username)}</div>
          ${m.instrumento?`<div class="banda-rol">${esc(m.instrumento)}</div>`:""}
          ${m.bio?`<p class="banda-bio">${esc(m.bio)}</p>`:""}
        `;
        card.addEventListener("click", () => abrirPerfilMiembro(m));
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
    const cont = document.getElementById("solicitudes-admin");
    if (!cont) return;
    cont.innerHTML = `<p class="loading-msg">cargando</p>`;
    const { data } = await db.from("solicitudes").select("*").order("created_at", { ascending: false });
    if (!data?.length) { cont.innerHTML = `<p class="loading-msg no-spin">no hay solicitudes aún.</p>`; return; }
    cont.innerHTML = "";
    data.forEach(s => {
      const card = document.createElement("div");
      card.className = "solicitud-card-full";
      card.id = `solicitud-${s.id}`;
      card.innerHTML = `
        <div class="solicitud-card-header" onclick="toggleSolicitud(${s.id})">
          <div class="solicitud-card-info">
            <h4>${esc(s.nombre)} <span style="font-weight:300;color:var(--text-dim)">·</span> ${esc(s.instrumento)}</h4>
            <p>${formatFecha(s.created_at)}</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="solicitud-estado ${s.estado}">${s.estado}</span>
            <i class="fa-solid fa-chevron-down" style="font-size:10px;color:var(--text-dim);transition:transform 0.2s" id="chev-${s.id}"></i>
          </div>
        </div>
        <div class="solicitud-card-body" id="sol-body-${s.id}" style="display:none">
          ${s.redes ? `<p style="font-size:11px;color:var(--accent);margin-bottom:8px">🔗 ${esc(s.redes)}</p>` : ""}
          ${s.experiencia ? `<div class="solicitud-section"><span class="solicitud-section-label">experiencia</span><p>${esc(s.experiencia)}</p></div>` : ""}
          ${s.mensaje ? `<div class="solicitud-section"><span class="solicitud-section-label">mensaje</span><p style="font-style:italic">"${esc(s.mensaje)}"</p></div>` : ""}
          <div class="solicitud-section">
            <span class="solicitud-section-label">respuesta</span>
            <textarea id="resp-${s.id}" class="field textarea" rows="2" placeholder="escribe una respuesta (opcional)...">${esc(s.respuesta||"")}</textarea>
          </div>
          <div class="solicitud-actions">
            <button class="btn-primary" style="background:#6bffb8;font-size:10px" onclick="cambiarEstadoSolicitud(${s.id},'aceptado')">
              <i class="fa-solid fa-check"></i> aceptar
            </button>
            <button class="btn-secondary" style="font-size:10px" onclick="cambiarEstadoSolicitud(${s.id},'rechazado')">
              <i class="fa-solid fa-xmark"></i> rechazar
            </button>
            <button class="btn-secondary" style="font-size:10px" onclick="cambiarEstadoSolicitud(${s.id},'pendiente')">
              pendiente
            </button>
          </div>
          <p class="auth-msg" id="sol-msg-${s.id}"></p>
        </div>`;
      cont.appendChild(card);
    });
  }

  window.toggleSolicitud = function(id) {
    const body = document.getElementById(`sol-body-${id}`);
    const chev = document.getElementById(`chev-${id}`);
    if (!body) return;
    const open = body.style.display === "block";
    body.style.display = open ? "none" : "block";
    if (chev) chev.style.transform = open ? "rotate(0deg)" : "rotate(180deg)";
  };

  window.cambiarEstadoSolicitud = async function(id, estado) {
    const respuesta = document.getElementById(`resp-${id}`)?.value.trim();
    const msg       = document.getElementById(`sol-msg-${id}`);
    if (msg) { msg.textContent = "guardando..."; msg.className = "auth-msg"; }

    const { data: solData } = await db.from("solicitudes").select("*,usuarios(id)").eq("id", id).single();

    const { error } = await db.from("solicitudes")
      .update({ estado, respuesta: respuesta || null })
      .eq("id", id);

    if (error) {
      if (msg) { msg.textContent = "error: " + error.message; msg.className = "auth-msg error"; }
    } else {
      // Notifica al usuario que mandó la solicitud
      if (solData?.user_id) {
        const textos = {
          aceptado:  "🎉 tu solicitud de banda ha sido aceptada",
          rechazado: "tu solicitud de banda no ha sido aceptada esta vez",
          pendiente: "tu solicitud de banda está siendo revisada"
        };
        const mensajeExtra = respuesta ? ` — "${respuesta}"` : "";
        await db.from("notificaciones").insert([{
          usuario_id: solData.user_id,
          tipo:       estado === "aceptado" ? "solicitud_ok" : "solicitud",
          mensaje:    (textos[estado] || "tu solicitud ha sido actualizada") + mensajeExtra
        }]);
      }

      if (msg) { msg.textContent = "✓ guardado"; msg.className = "auth-msg success"; }
      const card  = document.getElementById(`solicitud-${id}`);
      const badge = card?.querySelector(".solicitud-estado");
      if (badge) { badge.className = `solicitud-estado ${estado}`; badge.textContent = estado; }
      window.sfx?.success();
    }
  };

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
        .select("*, usuarios(display_name, username, avatar_url), comentarios(id)")
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
          <h2>foro</h2>
          ${newBtn}
        </div>
        <div class="cat-pills">${catsHtml}</div>
        <div class="feed-list">${postsHtml}</div>`;

      // Carga likes en segundo plano
      if (posts?.length) {
        posts.forEach(async p => {
          const { count, userLiked } = await getLikes("post", p.id);
          const btn = document.getElementById(`like-post-${p.id}`);
          if (btn) {
            btn.querySelector(".like-count").textContent = count;
            if (userLiked) btn.classList.add("liked");
          }
        });
      }

    } catch(err) {
      cont.innerHTML = `<p class="loading-msg no-spin">⚠️ ${err.message==="TIMEOUT"?"Sin conexión":"Error al cargar"}</p>`;
    }
  }

  function crearPostCard(p) {
    const autor = p.usuarios?.display_name || p.usuarios?.username || "Anónimo";
    const ini   = autor[0].toUpperCase();
    const avatar = p.usuarios?.avatar_url
      ? `<img src="${p.usuarios?.avatar_url}" class="feed-avatar" alt="">`
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
            <button class="feed-action like-btn" id="like-post-${p.id}" onclick="toggleLike('post',${p.id},this)">
              <i class="fa-regular fa-heart"></i> <span class="like-count">0</span>
            </button>
            <button class="feed-action" onclick="toggleComentarios(${p.id})">
              <i class="fa-regular fa-comment"></i> ${numComs}
            </button>
            ${currentUser?.id === p.autor_id || currentUser?.rol === "admin" ? `<button class="feed-action" onclick="eliminarPost(${p.id},this)" style="margin-left:auto;color:var(--text-dim)"><i class="fa-solid fa-trash" style="font-size:10px"></i></button>` : ""}
          </div>
          <div class="feed-comentarios" id="feed-coms-${p.id}" style="display:none"></div>
        </div>
      </div>`;
  }

  window.filtrarCategoria = function(id) { foroCategoria = id; renderForo(); };


  window.enviarComentarioFeed = async function(postId, ta, btn, msgEl) {
    const texto = ta.value.trim();
    if (!texto) return;
    if (!currentUser) { msgEl.textContent = "inicia sesión primero"; return; }
    btn.disabled = true;
    btn.textContent = "enviando...";

    const { error } = await db.from("comentarios").insert([{
      post_id: parseInt(postId),
      autor_id: currentUser.id,
      contenido: texto
    }]);

    if (error) {
      msgEl.textContent = "error: " + error.message;
      msgEl.className = "auth-msg error";
      btn.disabled = false;
      btn.innerHTML = "<i class='fa-solid fa-paper-plane'></i> comentar";
    } else {
      window.sfx?.success();
      // Notify post author
      db.from("posts").select("autor_id").eq("id", postId).single().then(({ data }) => {
        if (data?.autor_id && data.autor_id !== currentUser.id) {
          db.from("notificaciones").insert([{
            usuario_id: data.autor_id,
            tipo: "comentario",
            mensaje: (currentUser.display_name || currentUser.username) + " comentó en tu post"
          }]);
        }
      });
      // Reload
      const cont = document.getElementById("feed-coms-" + postId);
      if (cont) { cont.dataset.open = "0"; cont.style.display = "none"; }
      await window.toggleComentarios(postId);
    }
  };
  window.toggleComentarios = async function(postId) {
    const cont = document.getElementById(`feed-coms-${postId}`);
    if (cont.style.display === "block") { cont.style.display = "none"; return; }
    cont.style.display = "block";
    cont.innerHTML = `<p class="loading-msg" style="padding:8px 0;font-size:10px">Cargando...</p>`;
    const { data: coms } = await db.from("comentarios")
      .select("*, usuarios(display_name, username)")
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
    if (!contenido) { msg.textContent="escribe algo"; msg.className="auth-msg error"; return; }
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
        titulo: titulo||"sin título", contenido, autor_id: currentUser.id,
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
          <input type="text" id="edit-display" placeholder="nombre visible" class="field" value="${esc(p.display_name||"")}">
          <input type="text" id="edit-instrumento" placeholder="instrumento / rol" class="field" value="${esc(p.instrumento||"")}">
          <textarea id="edit-bio" placeholder="bio" class="field textarea" rows="3">${esc(p.bio||"")}</textarea>
          <div style="font-size:9px;letter-spacing:2px;color:var(--text-dim);margin-top:4px">redes sociales</div>
          <input type="text" id="edit-instagram" placeholder="instagram (@usuario)" class="field" value="${esc(p.redes_instagram||"")}">
          <input type="text" id="edit-spotify" placeholder="spotify (url completa)" class="field" value="${esc(p.redes_spotify||"")}">
          <input type="text" id="edit-youtube" placeholder="youtube (url completa)" class="field" value="${esc(p.redes_youtube||"")}">
          <input type="text" id="edit-tiktok" placeholder="tiktok (@usuario)" class="field" value="${esc(p.redes_tiktok||"")}">
          <input type="text" id="edit-soundcloud" placeholder="soundcloud (url)" class="field" value="${esc(p.redes_soundcloud||"")}">
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
    const acento = document.getElementById("custom-acento")?.value;
    const fondo  = document.getElementById("custom-fondo")?.value;
    if (!acento) return;
    const tema = document.body.classList.contains("tema-claro") ? "claro" : "oscuro";
    aplicarTema(tema, acento, fondo);
    document.documentElement.style.setProperty("--cursor-color", acento);
    // Always save to localStorage even without account
    setStorage("mitø-acento", acento);
    if (fondo) setStorage("mitø-fondo", fondo);
    if (currentUser) {
      currentUser.color_acento = acento;
      currentUser.color_fondo  = fondo || currentUser.color_fondo;
      guardarSesionLocal(currentUser);
      db.from("usuarios").update({ color_acento: acento, color_fondo: fondo }).eq("id", currentUser.id).catch(()=>{});
    }
  };

  window.guardarPerfil = async function() {
    const msg=document.getElementById("perfil-msg"); msg.textContent="Guardando..."; msg.className="auth-msg";
    const updates={
      display_name: document.getElementById("edit-display").value.trim(),
      instrumento:  document.getElementById("edit-instrumento").value.trim(),
      bio:          document.getElementById("edit-bio").value.trim(),
      redes_instagram:  document.getElementById("edit-instagram")?.value.trim()||null,
      redes_spotify:    document.getElementById("edit-spotify")?.value.trim()||null,
      redes_youtube:    document.getElementById("edit-youtube")?.value.trim()||null,
      redes_tiktok:     document.getElementById("edit-tiktok")?.value.trim()||null,
      redes_soundcloud: document.getElementById("edit-soundcloud")?.value.trim()||null,
    };
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
    const { data: perfil } = await db.from("usuarios")
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
    const { error } = await db.from("usuarios").update({ rol: "banda" }).eq("id", perfil.id);
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else {
      msg.textContent = "✓ Miembro añadido a la banda";
      msg.className = "auth-msg success";
      document.getElementById("banda-email").value = "";
      setTimeout(() => { msg.textContent = ""; }, 3000);
    }
  };

  window.doLogout = function() {
    borrarSesionLocal();
    currentUser = null;
    currentPerfil = null;
    tieneAccesoPrivado = false;
    updateNavUser();
    updateNavPrivado();
    go("home");
  };


  // ── MINI PLAYER / AMBIENT TRACKS ─────────────
  let ambientTracks = [];
  let ambientIndex  = 0;
  let ambientAudio  = new Audio();
  let ambientPlaying = false;

  async function cargarAmbientTracks() {
    if (ambientTracks.length) return; // ya cargado, no reiniciar
    const { data } = await db.from("ambient_tracks").select("*").order("orden").order("id");
    if (!data?.length) return;
    ambientTracks = data;
    initMiniPlayer();
  }

  function initMiniPlayer() {
    if (!ambientTracks.length) return;
    const player = document.getElementById("mini-player");
    if (player) player.style.display = "flex";
    cargarTrack(0, true); // true = autoplay
  }

  function cargarTrack(idx, autoplay = false) {
    ambientIndex = idx;
    const track = ambientTracks[idx];
    if (!track) return;
    ambientAudio.src = track.audio_url;
    ambientAudio.volume = 0.05; // 5% de volumen inicial
    ambientAudio.loop = false;
    const titleEl = document.getElementById("mp-title");
    if (titleEl) titleEl.textContent = track.titulo;
    ambientAudio.onended = () => mpNext();

    if (autoplay) {
      // Intenta reproducir — si el navegador lo bloquea, espera al primer click
      ambientAudio.play().then(() => {
        ambientPlaying = true;
        const tog  = document.getElementById("mp-toggle");
        const icon = document.getElementById("mp-play-btn");
        if (tog)  tog.innerHTML  = '<i class="fa-solid fa-pause"></i>';
        if (icon) icon.innerHTML = '<i class="fa-solid fa-pause"></i>';
        // Actualiza el slider de volumen
        const slider = document.querySelector(".mp-slider");
        if (slider) slider.value = 0.05;
      }).catch(() => {
        // Navegador bloqueó el autoplay — espera primer gesto
        ambientPlaying = false;
        const tog  = document.getElementById("mp-toggle");
        const icon = document.getElementById("mp-play-btn");
        if (tog)  tog.innerHTML  = '<i class="fa-solid fa-play"></i>';
        if (icon) icon.innerHTML = '<i class="fa-solid fa-music"></i>';
        // Al primer click del usuario, arranca
        document.addEventListener("click", function startAmbient() {
          if (!ambientPlaying && ambientTracks.length) {
            ambientAudio.play().then(() => {
              ambientPlaying = true;
              if (tog)  tog.innerHTML  = '<i class="fa-solid fa-pause"></i>';
              if (icon) icon.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }).catch(()=>{});
          }
          document.removeEventListener("click", startAmbient);
        }, { once: true });
      });
    } else if (ambientPlaying) {
      ambientAudio.play().catch(()=>{});
    }
  }

  window.mpToggle = function() {
    if (ambientPlaying) {
      ambientAudio.pause(); ambientPlaying = false;
      document.getElementById("mp-toggle").innerHTML = '<i class="fa-solid fa-play"></i>';
      document.getElementById("mp-play-btn").innerHTML = '<i class="fa-solid fa-music"></i>';
    } else {
      ambientAudio.play().catch(()=>{}); ambientPlaying = true;
      document.getElementById("mp-toggle").innerHTML = '<i class="fa-solid fa-pause"></i>';
      document.getElementById("mp-play-btn").innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
  };

  window.mpVolume = function(val) {
    ambientAudio.volume = parseFloat(val);
    const icon = document.getElementById("mp-vol-icon");
    if (!icon) return;
    if (val == 0) icon.className = "fa-solid fa-volume-xmark";
    else if (val < 0.4) icon.className = "fa-solid fa-volume-low";
    else icon.className = "fa-solid fa-volume-high";
  };


  window.mpNext = function() {
    const next = (ambientIndex + 1) % ambientTracks.length;
    cargarTrack(next);
    if (ambientPlaying) ambientAudio.play().catch(()=>{});
  };

  window.mpPrev = function() {
    const prev = (ambientIndex - 1 + ambientTracks.length) % ambientTracks.length;
    cargarTrack(prev);
    if (ambientPlaying) ambientAudio.play().catch(()=>{});
  };

  window.subirAmbient = async function() {
    const titulo = document.getElementById("ambient-title").value.trim();
    const file   = document.getElementById("ambient-file").files[0];
    if (!titulo || !file) { alert("pon un título y elige un audio"); return; }
    const cleanName = file.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
    const fileName = `ambient-${Date.now()}-${cleanName}`;
    const { error: upErr } = await db.storage.from("beats").upload(fileName, file);
    if (upErr) { alert("error: " + upErr.message); return; }
    const { data: urlData } = db.storage.from("beats").getPublicUrl(fileName);
    await db.from("ambient_tracks").insert([{ titulo, audio_url: urlData.publicUrl }]);
    document.getElementById("ambient-title").value = "";
    document.getElementById("ambient-file").value = "";
    document.getElementById("ambient-file-label").textContent = "elige un audio";
    alert("¡canción de fondo añadida!");
    cargarAmbientTracks();
  };


  // ── PARALLAX ─────────────────────────────────
  let mouseX = 0.5, mouseY = 0.5;
  let targetX = 0.5, targetY = 0.5;

  document.addEventListener("mousemove", (e) => {
    targetX = e.clientX / window.innerWidth;
    targetY = e.clientY / window.innerHeight;
  }, { passive: true });

  function tickParallax() {
    mouseX += (targetX - mouseX) * 0.035;
    mouseY += (targetY - mouseY) * 0.035;

    const onHome = document.getElementById("home")?.classList.contains("active");

    if (onHome) {
      // Hero: movimiento más notorio como antes
      const img = document.getElementById("hero-img");
      if (img) {
        const dx = (mouseX - 0.5) * -14;
        const dy = (mouseY - 0.5) * -8;
        img.style.transform = `scale(1.06) translate(${dx}px, ${dy}px)`;
      }
      // En home el bg no se mueve — la imagen ya da el efecto
    } else {
      // En el resto de páginas: solo el gradiente de fondo, muy sutil
      const bg = document.querySelector(".bg-gradient");
      if (bg) {
        const bx  = (50 + (mouseX - 0.5) * 12).toFixed(2);
        const by  = (20 + (mouseY - 0.5) * 8).toFixed(2);
        const bx2 = (100 - bx).toFixed(2);
        const by2 = (100 - by).toFixed(2);
        bg.style.background = `
          radial-gradient(ellipse 55% 40% at ${bx}% ${by}%, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 65%),
          radial-gradient(ellipse 35% 25% at ${bx2}% ${by2}%, color-mix(in srgb, var(--accent) 3%, transparent) 0%, transparent 55%)
        `;
      }
    }

    requestAnimationFrame(tickParallax);
  }
  requestAnimationFrame(tickParallax);


  // ── LIKES ────────────────────────────────────

  async function toggleLike(tipo, id, btn) {
    if (!currentUser) { go("auth"); return; }
    const col     = tipo === "post" ? "post_id" : "beat_id";
    const { data: existing } = await db.from("likes")
      .select("id").eq("usuario_id", currentUser.id).eq(col, id).limit(1);

    if (existing?.length) {
      await db.from("likes").delete().eq("id", existing[0].id);
      btn.classList.remove("liked");
      const cnt = btn.querySelector(".like-count");
      if (cnt) cnt.textContent = Math.max(0, parseInt(cnt.textContent||0) - 1);
    } else {
      await db.from("likes").insert([{ usuario_id: currentUser.id, [col]: id }]);
      btn.classList.add("liked");
      const cnt = btn.querySelector(".like-count");
      if (cnt) cnt.textContent = parseInt(cnt.textContent||0) + 1;
      // Notificación si es post
      if (tipo === "post") crearNotificacion(currentUser.id, "like", `${currentUser.display_name||currentUser.username} le dio like a tu post`);
    }
    window.sfx?.click();
  }
  window.toggleLike = toggleLike;

  async function getLikes(tipo, id) {
    const col = tipo === "post" ? "post_id" : "beat_id";
    const { data } = await db.from("likes").select("usuario_id").eq(col, id);
    const count    = data?.length || 0;
    const userLiked = currentUser ? data?.some(l => l.usuario_id === currentUser.id) : false;
    return { count, userLiked };
  }

  // ── NOTIFICACIONES ────────────────────────────

  async function crearNotificacion(userId, tipo, mensaje, url) {
    if (!userId || userId === currentUser?.id) return;
    await db.from("notificaciones").insert([{ usuario_id: userId, tipo, mensaje, url: url||null }]);
  }

  async function cargarNotificaciones() {
    if (!currentUser) return;
    const { data } = await db.from("notificaciones")
      .select("*").eq("usuario_id", currentUser.id)
      .order("created_at", { ascending: false }).limit(20);

    const badge = document.getElementById("notif-badge");
    const list  = document.getElementById("notif-list");
    const noLeidas = data?.filter(n => !n.leida).length || 0;

    if (badge) badge.style.display = noLeidas > 0 ? "block" : "none";
    if (!list) return;

    if (!data?.length) {
      list.innerHTML = `<p style="padding:16px;font-size:11px;color:var(--text-dim);text-align:center">sin notificaciones</p>`;
      return;
    }

    list.innerHTML = data.map(n => `
      <div style="padding:12px 16px;border-bottom:1px solid var(--card-b);display:flex;gap:10px;align-items:flex-start;background:${n.leida?"transparent":"color-mix(in srgb,var(--accent) 4%,transparent)"}">
        <i class="fa-solid ${n.tipo==="like"?"fa-heart":n.tipo==="comentario"?"fa-comment":"fa-bell"}" style="color:var(--accent);font-size:12px;margin-top:2px;flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <p style="font-size:11px;color:var(--text);line-height:1.5">${esc(n.mensaje)}</p>
          <p style="font-size:9px;color:var(--text-dim);margin-top:3px">${formatFecha(n.created_at)}</p>
        </div>
      </div>`).join("");
  }

  window.toggleNotificaciones = function() {
    const panel = document.getElementById("notif-panel");
    if (!panel) return;
    const visible = panel.style.display === "block";
    panel.style.display = visible ? "none" : "block";
    if (!visible) cargarNotificaciones();
    // Close on outside click
    if (!visible) {
      setTimeout(() => {
        document.addEventListener("click", function closeNotif(e) {
          if (!panel.contains(e.target) && e.target.id !== "notif-btn") {
            panel.style.display = "none";
            document.removeEventListener("click", closeNotif);
          }
        });
      }, 100);
    }
  };
  window.toggleNotificaciones = window.toggleNotificaciones;

  window.marcarTodasLeidas = async function() {
    if (!currentUser) return;
    await db.from("notificaciones").update({ leida: true }).eq("usuario_id", currentUser.id);
    cargarNotificaciones();
  };

  // ── LETRAS ────────────────────────────────────

  async function cargarLetras() {
    const cont = document.getElementById("letras-list");
    if (!cont) return;
    cont.innerHTML = `<p class="loading-msg">cargando</p>`;
    const { data, error } = await db.from("letras").select("*").order("created_at", { ascending: false });
    if (error || !data?.length) {
      cont.innerHTML = `<p class="loading-msg no-spin">aún no hay letras publicadas.</p>`; return;
    }
    cont.innerHTML = "";
    cont.className = "letras-grid";
    data.forEach(l => {
      const card = document.createElement("div");
      card.className = "letra-cover-card";
      card.onclick = () => abrirLetra(l.id);
      card.innerHTML = `
        <div class="letra-cover-img">
          ${l.cover_url
            ? `<img src="${l.cover_url}" alt="${esc(l.titulo)}">`
            : `<div class="letra-cover-placeholder"><i class="fa-solid fa-music"></i></div>`}
        </div>
        <div class="letra-cover-info">
          <div class="letra-cover-title">${esc(l.titulo)}</div>
          <div class="letra-cover-artist">${esc(l.artista || "mitø")}</div>
        </div>`;
      cont.appendChild(card);
    });
  }

  async function cargarLetrasAdmin() {
    const cont = document.getElementById("letras-admin-list");
    if (!cont) return;
    const { data } = await db.from("letras").select("*").order("created_at", { ascending: false });
    if (!data?.length) { cont.innerHTML = `<p class="loading-msg no-spin">no hay letras aún.</p>`; return; }
    cont.innerHTML = "";
    data.forEach(l => {
      const card = document.createElement("div");
      card.className = "solicitud-card";
      card.innerHTML = `
        <div class="solicitud-card-info" style="display:flex;align-items:center;gap:10px">
          ${l.cover_url ? `<img src="${l.cover_url}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0">` : ""}
          <div>
            <h4>${esc(l.titulo)}</h4>
            <p style="margin-top:2px">${esc(l.artista||"mitø")} ${l.enlace?`· <a href="${esc(l.enlace)}" target="_blank" style="color:var(--accent);text-decoration:none">escuchar</a>`:"" }</p>
          </div>
        </div>
        <button class="delete-btn" style="opacity:1" onclick="borrarLetra(${l.id},this)">
          <i class="fa-solid fa-trash"></i>
        </button>`;
      cont.appendChild(card);
    });
  }

  window.subirLetra = async function() {
    const titulo  = document.getElementById("letra-titulo")?.value.trim();
    const letra   = document.getElementById("letra-texto")?.value.trim();
    const enlace  = document.getElementById("letra-enlace")?.value.trim();
    const artista = document.getElementById("letra-artista")?.value.trim() || "mitø";
    const coverFile = window._letraCoverBlob || document.getElementById("letra-cover-file")?.files[0];
    const msg     = document.getElementById("letra-msg");
    if (!titulo || !letra) { if(msg){msg.textContent="rellena título y letra";msg.className="auth-msg error";} return; }
    if (msg) { msg.textContent="publicando..."; msg.className="auth-msg"; }

    try {
      let cover_url = null;
      if (coverFile) {
        const isBlob = coverFile instanceof Blob && !(coverFile instanceof File);
        const cleanName = isBlob ? `portada-${Date.now()}.jpg` : coverFile.name.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
        const fileName  = isBlob ? cleanName : `letra-cover-${Date.now()}-${cleanName}`;
        const { error: upErr } = await db.storage.from("covers").upload(fileName, coverFile);
        if (upErr) throw upErr;
        const { data: ud } = db.storage.from("covers").getPublicUrl(fileName);
        cover_url = ud.publicUrl;
      }

      const { error } = await db.from("letras").insert([{ titulo, letra, enlace: enlace||null, artista, cover_url }]);
      if (error) throw error;

      ["letra-titulo","letra-texto","letra-enlace","letra-artista","letra-cover-file"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
      document.getElementById("letra-cover-label").textContent = "portada 1:1 — click para recortar";
      window._letraCoverBlob = null;
      if (msg) { msg.textContent = "¡publicada!"; msg.className = "auth-msg success"; }
      window.sfx?.success();
      cargarLetrasAdmin();
    } catch(err) {
      if (msg) { msg.textContent = "error: " + err.message; msg.className = "auth-msg error"; }
    }
  };

  window.borrarLetra = async function(id, btn) {
    if (!confirm("¿borrar esta letra?")) return;
    btn.disabled = true;
    await db.from("letras").delete().eq("id", id);
    btn.closest(".solicitud-card").remove();
  };

  window.abrirLetra = async function(id) {
    const overlay = document.getElementById("letra-overlay");
    const cont    = document.getElementById("letra-content");
    if (!overlay || !cont) return;
    cont.innerHTML = `<p class="loading-msg">cargando</p>`;
    overlay.style.opacity       = "1";
    overlay.style.pointerEvents = "all";
    const { data } = await db.from("letras").select("*").eq("id", id).single();
    if (!data) { cont.innerHTML = `<p class="loading-msg no-spin">no encontrada</p>`; return; }

    // Formatea letra verso a verso
    const versos = data.letra.split("\n").map(v =>
      v.trim() === ""
        ? `<div class="verso-espaciado"></div>`
        : `<div class="verso">${esc(v)}</div>`
    ).join("");

    cont.innerHTML = `
      <button onclick="cerrarLetraOverlay()" class="letra-back-btn">
        <i class="fa-solid fa-arrow-left"></i> volver
      </button>
      <div class="letra-detalle">
        <div class="letra-detalle-izq">
          <div class="letra-detalle-titulo">${esc(data.titulo)}</div>
          <div class="letra-detalle-artista">${esc(data.artista || "mitø")}</div>
          ${data.enlace ? `<a href="${esc(data.enlace)}" target="_blank" class="letra-escuchar">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> escuchar
          </a>` : ""}
          <div class="letra-versos">${versos}</div>
        </div>
        <div class="letra-detalle-der">
          ${data.cover_url
            ? `<img src="${data.cover_url}" class="letra-detalle-cover" alt="">`
            : `<div class="letra-detalle-cover-placeholder"><i class="fa-solid fa-music"></i></div>`}
        </div>
      </div>`;
  };

  window.cerrarLetraOverlay = function(e) {
    if (!e || e.target === document.getElementById("letra-overlay")) {
      const overlay = document.getElementById("letra-overlay");
      if (overlay) { overlay.style.opacity="0"; overlay.style.pointerEvents="none"; }
    }
  };


  // ── GESTIÓN GALERÍA ──────────────────────────

  async function cargarGaleriaAdmin() {
    const cont = document.getElementById("galeria-admin-list");
    if (!cont) return;
    cont.innerHTML = `<p class="loading-msg">cargando</p>`;
    const { data } = await db.from("galeria").select("*").order("id", { ascending: false });
    if (!data?.length) { cont.innerHTML = `<p class="loading-msg no-spin">no hay fotos aún.</p>`; return; }
    cont.innerHTML = "";
    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "galeria-admin-card";
      const esVideo = item.tipo === "video";
      card.innerHTML = `
        <div class="galeria-admin-thumb">
          ${esVideo
            ? `<video src="${item.url}" style="width:100%;height:100%;object-fit:cover"></video>`
            : `<img src="${item.url}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`}
        </div>
        <div class="galeria-admin-info">
          <input type="text" class="field" value="${esc(item.caption||"")}"
            id="caption-${item.id}" placeholder="descripción..." style="font-size:11px;padding:7px 10px">
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn-secondary" style="flex:1;font-size:10px" onclick="editarCaption(${item.id})">
              <i class="fa-solid fa-save"></i> guardar
            </button>
            <button class="delete-btn" style="opacity:1;width:32px;height:32px" onclick="eliminarGaleria(${item.id},this)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
      cont.appendChild(card);
    });
  }

  window.editarCaption = async function(id) {
    const val = document.getElementById(`caption-${id}`)?.value.trim();
    const { error } = await db.from("galeria").update({ caption: val }).eq("id", id);
    if (!error) window.sfx?.success();
    else alert("error: " + error.message);
  };

  window.eliminarGaleria = async function(id, btn) {
    if (!confirm("¿eliminar esta foto/vídeo?")) return;
    btn.disabled = true;
    const { error } = await db.from("galeria").delete().eq("id", id);
    if (error) { alert("error: " + error.message); btn.disabled = false; return; }
    btn.closest(".galeria-admin-card").style.opacity = "0";
    btn.closest(".galeria-admin-card").style.transform = "scale(0.9)";
    setTimeout(() => btn.closest(".galeria-admin-card").remove(), 300);
    window.sfx?.delete();
  };

  // ── GESTIÓN FORO ─────────────────────────────

  window.eliminarPost = async function(id, btn) {
    if (!confirm("¿eliminar este post?")) return;
    btn.disabled = true;
    const { error } = await db.from("posts").delete().eq("id", id);
    if (error) { alert("error: " + error.message); btn.disabled = false; return; }
    const card = document.getElementById(`feed-card-${id}`);
    if (card) { card.style.opacity = "0"; card.style.transform = "translateY(-8px)"; setTimeout(() => card.remove(), 300); }
    window.sfx?.delete();
  };

  // ── REALTIME ─────────────────────────────────
  function initRealtime() {
    // Galería — actualiza automáticamente
    db.channel("galeria-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "galeria" }, () => {
        if (currentPage === "galeria") cargarGaleria();
      })
      .subscribe();

    // Beats — actualiza home y beats
    db.channel("beats-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "beats" }, () => {
        if (currentPage === "beats") cargarBeats("beats-list", false);
        if (currentPage === "home")  cargarBeats("home-beats", false, 3);
      })
      .subscribe();

    // Posts — actualiza foro
    db.channel("posts-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        if (currentPage === "foro") renderForo();
      })
      .subscribe();

    // Notificaciones propias — badge en tiempo real
    if (currentUser) {
      db.channel(`notif-${currentUser.id}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "notificaciones",
          filter: `usuario_id=eq.${currentUser.id}`
        }, () => {
          const badge = document.getElementById("notif-badge");
          if (badge) badge.style.display = "block";
        })
        .subscribe();
    }
  }

  // ── PERFIL MIEMBRO ────────────────────────────
  window.abrirPerfilMiembro = function(m) {
    const overlay  = document.getElementById("miembro-overlay");
    const cont     = document.getElementById("miembro-content");
    if (!overlay || !cont) return;
    const ini = (m.display_name||m.username||"?")[0].toUpperCase();
    const redes = [
      m.redes_instagram && `<a href="https://instagram.com/${m.redes_instagram.replace('@','')}" target="_blank" class="miembro-red"><i class="fa-brands fa-instagram"></i> @${esc(m.redes_instagram.replace('@',''))}</a>`,
      m.redes_spotify   && `<a href="${m.redes_spotify}" target="_blank" class="miembro-red"><i class="fa-brands fa-spotify"></i> spotify</a>`,
      m.redes_youtube   && `<a href="${m.redes_youtube}" target="_blank" class="miembro-red"><i class="fa-brands fa-youtube"></i> youtube</a>`,
      m.redes_tiktok    && `<a href="https://tiktok.com/@${m.redes_tiktok.replace('@','')}" target="_blank" class="miembro-red"><i class="fa-brands fa-tiktok"></i> @${esc(m.redes_tiktok.replace('@',''))}</a>`,
      m.redes_soundcloud && `<a href="${m.redes_soundcloud}" target="_blank" class="miembro-red"><i class="fa-brands fa-soundcloud"></i> soundcloud</a>`,
    ].filter(Boolean).join("");

    cont.innerHTML = `
      <button onclick="cerrarMiembro()" class="letra-back-btn" style="margin-bottom:24px">
        <i class="fa-solid fa-arrow-left"></i> volver
      </button>
      <div class="miembro-detalle">
        <div class="miembro-avatar-wrap">
          ${m.avatar_url
            ? `<img src="${m.avatar_url}" class="miembro-avatar-big" alt="">`
            : `<div class="miembro-avatar-big-placeholder">${ini}</div>`}
        </div>
        <div class="miembro-info">
          <div class="miembro-nombre">${esc(m.display_name||m.username)}</div>
          ${m.instrumento ? `<div class="miembro-rol">${esc(m.instrumento)}</div>` : ""}
          ${m.bio ? `<p class="miembro-bio">${esc(m.bio)}</p>` : ""}
          ${redes ? `<div class="miembro-redes">${redes}</div>` : ""}
          ${currentUser && m.id !== currentUser.id ? `
            <button class="btn-primary" style="margin-top:16px" onclick="abrirDM('${m.id}','${esc(m.display_name||m.username)}')">
              <i class="fa-solid fa-paper-plane"></i> enviar mensaje
            </button>` : ""}
        </div>
      </div>`;

    overlay.style.opacity = "1";
    overlay.style.pointerEvents = "all";
  };

  window.cerrarMiembro = function() {
    const ov = document.getElementById("miembro-overlay");
    if (ov) { ov.style.opacity = "0"; ov.style.pointerEvents = "none"; }
  };

  // ── DMs ──────────────────────────────────────
  let dmParaId   = null;
  let dmParaNombre = "";

  window.abrirDM = async function(paraId, paraNombre) {
    dmParaId     = paraId;
    dmParaNombre = paraNombre;
    const overlay = document.getElementById("dm-overlay");
    const title   = document.getElementById("dm-title");
    const cont    = document.getElementById("dm-messages");
    if (!overlay) return;
    if (title) title.textContent = paraNombre;
    overlay.style.opacity = "1";
    overlay.style.pointerEvents = "all";
    await cargarDMs(paraId);
  };

  async function cargarDMs(paraId) {
    const cont = document.getElementById("dm-messages");
    if (!cont || !currentUser) return;
    cont.innerHTML = `<p class="loading-msg" style="font-size:10px">cargando</p>`;
    const { data } = await db.from("mensajes")
      .select("*")
      .or(`and(de_id.eq.${currentUser.id},para_id.eq.${paraId}),and(de_id.eq.${paraId},para_id.eq.${currentUser.id})`)
      .order("created_at");

    if (!data?.length) {
      cont.innerHTML = `<p style="text-align:center;font-size:11px;color:var(--text-dim);padding:20px 0">sin mensajes aún. ¡sé el primero!</p>`;
      return;
    }
    cont.innerHTML = data.map(m => {
      const mio = m.de_id === currentUser.id;
      return `<div class="dm-msg ${mio ? "dm-mio" : "dm-suyo"}">
        <div class="dm-bubble">${esc(m.contenido)}</div>
        <div class="dm-time">${formatFecha(m.created_at)}</div>
      </div>`;
    }).join("");
    cont.scrollTop = cont.scrollHeight;

    // Marca como leídos
    db.from("mensajes").update({ leido: true })
      .eq("para_id", currentUser.id).eq("de_id", paraId).catch(()=>{});
  }

  window.enviarDM = async function() {
    const input = document.getElementById("dm-input");
    const texto = input?.value.trim();
    if (!texto || !dmParaId || !currentUser) return;
    input.value = "";
    await db.from("mensajes").insert([{
      de_id:    currentUser.id,
      para_id:  dmParaId,
      contenido: texto
    }]);
    // Notifica al destinatario
    await db.from("notificaciones").insert([{
      usuario_id: dmParaId,
      tipo:       "mensaje",
      mensaje:    `nuevo mensaje de ${esc(currentUser.display_name||currentUser.username)}`
    }]);
    await cargarDMs(dmParaId);
    window.sfx?.success();
  };

  window.cerrarDM = function(e) {
    if (!e || e.target === document.getElementById("dm-overlay")) {
      document.getElementById("dm-overlay")?.classList.remove("visible");
    }
  };

  // DMs en tiempo real
  function initDMRealtime() {
    if (!currentUser) return;
    db.channel(`dm-${currentUser.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "mensajes",
        filter: `para_id=eq.${currentUser.id}`
      }, (payload) => {
        // Si el DM overlay está abierto con ese remitente, recarga
        if (document.getElementById("dm-overlay")?.classList.contains("visible") &&
            payload.new.de_id === dmParaId) {
          cargarDMs(dmParaId);
        }
        // Badge de notif
        const badge = document.getElementById("notif-badge");
        if (badge) badge.style.display = "block";
      })
      .subscribe();
  }

  // ── USUARIOS ACTIVOS ─────────────────────────
  let onlineChannel = null;

  function initPresencia() {
    if (!db || onlineChannel) return;
    const userId = currentUser?.id || ("anon-" + Math.random().toString(36).slice(2,8));
    onlineChannel = db.channel("online-users", {
      config: { presence: { key: userId } }
    });
    onlineChannel
      .on("presence", { event: "sync" }, () => {
        const state = onlineChannel.presenceState();
        const count = Object.keys(state).length;
        const el = document.getElementById("online-count");
        if (el) el.textContent = count + " en línea";
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await onlineChannel.track({ online_at: new Date().toISOString() });
        }
      });
  }
  // ── INIT ─────────────────────────────────────
  go("home");
  setTimeout(() => { if(!ambientTracks.length) cargarAmbientTracks(); }, 800);
  setTimeout(() => { initRealtime(); initDMRealtime(); initPresencia(); }, 1500);

});
