/* ================================================================
   mitø · auth.js — sesión, login, registro, perfil, colores
   ================================================================ */

(function() {

  const SESS_KEY = "mito_sesion";

  // ── SHA256 ────────────────────────────────────────────────────
  window.sha256 = async function(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("");
  };

  // ── SESIÓN LOCAL ──────────────────────────────────────────────
  window.guardarSesionLocal = function(usuario) {
    try {
      setStorage(SESS_KEY, JSON.stringify({ ...usuario, _ts: Date.now() }));
      if (usuario.tema)         setStorage("mitø-tema",   usuario.tema);
      if (usuario.color_acento) setStorage("mitø-acento", usuario.color_acento);
      if (usuario.color_fondo)  setStorage("mitø-fondo",  usuario.color_fondo);
    } catch(e) {}
  };

  window.leerSesionLocal = function() {
    try {
      const raw = getStorage(SESS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const MAX = 30 * 24 * 60 * 60 * 1000; // 30 días
      if (Date.now() - (parsed._ts || 0) > MAX) {
        try { localStorage.removeItem(SESS_KEY); } catch(e) {}
        return null;
      }
      return parsed;
    } catch(e) { return null; }
  };

  window.borrarSesionLocal = function() {
    try { localStorage.removeItem(SESS_KEY); } catch(e) {}
    try { sessionStorage.removeItem(SESS_KEY); } catch(e) {}
  };

  // ── INIT SESIÓN ───────────────────────────────────────────────
  window.initSession = async function() {
    const local = leerSesionLocal();
    if (!local?.id) return;
    try {
      const { data: usuario } = await db.from("usuarios").select("*").eq("id", local.id).single();
      if (!usuario) return;
      currentUser = usuario;
      guardarSesionLocal(usuario);
      aplicarTema(usuario.tema || "oscuro", usuario.color_acento, usuario.color_fondo);
      updateNavUser();
      await comprobarAccesoPrivado();
    } catch(e) {
      console.warn("Session restore error:", e);
    }
  };

  window.comprobarAccesoPrivado = async function() {
    if (!currentUser) return;
    if (["banda","admin"].includes(currentUser.rol)) {
      tieneAccesoPrivado = true;
      updateNavPrivado();
      return;
    }
    const { data } = await db.from("accesos_privados").select("email").eq("email", currentUser.email).limit(1);
    if (data?.length) { tieneAccesoPrivado = true; updateNavPrivado(); }
  };

  window.updateNavUser = function() {
    const btn    = document.getElementById("btn-auth");
    const mobBtn = document.getElementById("mob-auth-btn");
    if (currentUser) {
      const name = esc(currentUser.display_name || currentUser.username || "perfil");
      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-user"></i> ${name}`;
        btn.className = "nav-auth-btn logged";
        btn.onclick = () => go("perfil");
      }
      if (mobBtn) {
        mobBtn.innerHTML = `<i class="fa-solid fa-user"></i><span>${name}</span>`;
        mobBtn.onclick = () => go("perfil", mobBtn);
      }
    } else {
      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-user"></i> entrar`;
        btn.className = "nav-auth-btn";
        btn.onclick = () => go("auth");
      }
      if (mobBtn) {
        mobBtn.innerHTML = `<i class="fa-solid fa-user"></i><span>yo</span>`;
        mobBtn.onclick = () => go("auth", mobBtn);
      }
    }
  };

  window.updateNavPrivado = function() {
    const btn = document.getElementById("nav-lock-btn");
    if (!btn) return;
    if (tieneAccesoPrivado) {
      btn.innerHTML = `<i class="fa-solid fa-lock-open"></i>`;
      btn.onclick = () => go("privado");
      btn.style.color = "#6bffb8";
      btn.style.borderColor = "rgba(107,255,184,0.4)";
    } else {
      btn.innerHTML = `<i class="fa-solid fa-lock"></i>`;
      btn.onclick = () => openLogin("privado");
      btn.style.color = "";
      btn.style.borderColor = "";
    }
  };

  // ── AUTH TABS ─────────────────────────────────────────────────
  window.switchAuthTab = function(tab, el) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    if (el) el.classList.add("active");
    document.getElementById("auth-login").classList.toggle("hidden", tab !== "login");
    document.getElementById("auth-register").classList.toggle("hidden", tab !== "register");
    document.getElementById("auth-reset").style.display = "none";
    document.getElementById("auth-login").style.display = tab === "login" ? "flex" : "none";
    document.getElementById("auth-register").style.display = tab === "register" ? "flex" : "none";
  };

  window.abrirOlvidePass = function() {
    document.getElementById("auth-login").style.display = "none";
    document.getElementById("auth-reset").style.display = "flex";
    const email = document.getElementById("login-email").value;
    if (email.includes("@")) document.getElementById("reset-email").value = email;
  };
  window.cerrarReset = function() {
    document.getElementById("auth-reset").style.display = "none";
    document.getElementById("auth-login").style.display = "flex";
  };

  // ── LOGIN ─────────────────────────────────────────────────────
  window.doLogin = async function() {
    const val  = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    const msg  = document.getElementById("login-msg");
    if (!val || !pass) { msg.textContent = "rellena todos los campos"; msg.className = "auth-msg error"; return; }
    msg.textContent = "entrando..."; msg.className = "auth-msg";
    try {
      const hash = await sha256(pass);
      const isEmail = val.includes("@");
      const query = isEmail
        ? db.from("usuarios").select("*").eq("email", val).eq("password_hash", hash).limit(1)
        : db.from("usuarios").select("*").eq("username", val).eq("password_hash", hash).limit(1);
      const { data, error } = await withTimeout(query, 8000);
      if (error) throw error;
      if (!data?.length) {
        msg.textContent = "credenciales incorrectas"; msg.className = "auth-msg error";
        window.sfx?.error(); return;
      }
      currentUser = data[0];
      guardarSesionLocal(currentUser);
      aplicarTema(currentUser.tema || "oscuro", currentUser.color_acento, currentUser.color_fondo);
      updateNavUser();
      await comprobarAccesoPrivado();
      window.sfx?.login();
      msg.textContent = "¡bienvenido!"; msg.className = "auth-msg success";
      setTimeout(() => go("home"), 800);
    } catch(e) {
      msg.textContent = e.message === "TIMEOUT" ? "sin respuesta — intenta de nuevo" : "error al entrar";
      msg.className = "auth-msg error"; window.sfx?.error();
    }
  };

  // ── REGISTRO ──────────────────────────────────────────────────
  window.doRegister = async function() {
    const email    = document.getElementById("reg-email").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const pass     = document.getElementById("reg-password").value;
    const msg      = document.getElementById("reg-msg");
    if (!email || !username || !pass) { msg.textContent = "rellena todos los campos"; msg.className = "auth-msg error"; return; }
    if (pass.length < 6) { msg.textContent = "contraseña demasiado corta"; msg.className = "auth-msg error"; return; }
    msg.textContent = "creando cuenta..."; msg.className = "auth-msg";
    try {
      const hash = await sha256(pass);
      const { data: existing } = await db.from("usuarios").select("id").or(`email.eq.${email},username.eq.${username}`).limit(1);
      if (existing?.length) { msg.textContent = "email o usuario ya en uso"; msg.className = "auth-msg error"; return; }
      const { data, error } = await db.from("usuarios").insert([{
        email, username, password_hash: hash, display_name: username, rol: "fan"
      }]).select().single();
      if (error) throw error;
      currentUser = data;
      guardarSesionLocal(currentUser);
      updateNavUser();
      window.sfx?.success();
      msg.textContent = "¡cuenta creada!"; msg.className = "auth-msg success";
      setTimeout(() => go("home"), 800);
    } catch(e) {
      msg.textContent = "error al crear cuenta"; msg.className = "auth-msg error"; window.sfx?.error();
    }
  };

  // ── RESET PASSWORD ────────────────────────────────────────────
  window.doReset = async function() {
    const email = document.getElementById("reset-email").value.trim();
    const msg   = document.getElementById("reset-msg");
    if (!email) { msg.textContent = "introduce tu email"; msg.className = "auth-msg error"; return; }
    msg.textContent = "enviando..."; msg.className = "auth-msg";
    try {
      const r = await withTimeout(db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      }), 5000);
      if (r.error) { msg.textContent = "error: " + r.error.message; msg.className = "auth-msg error"; }
      else { msg.textContent = "📧 enlace enviado — revisa tu email"; msg.className = "auth-msg success"; }
    } catch(e) {
      msg.textContent = e.message === "TIMEOUT" ? "sin respuesta" : "error al enviar";
      msg.className = "auth-msg error";
    }
  };

  // ── LOGOUT ────────────────────────────────────────────────────
  window.doLogout = function() {
    currentUser = null; tieneAccesoPrivado = false;
    borrarSesionLocal();
    updateNavUser(); updateNavPrivado();
    go("home");
    window.sfx?.click();
  };

  // ── COLORES PRESET ────────────────────────────────────────────
  window.COLORES_PRESET = [
    {label:"Lima",      acento:"#c8f0a0", fondo:"#0a0b09"},
    {label:"Cyan",      acento:"#00e5ff", fondo:"#060d10"},
    {label:"Rosa",      acento:"#ff6eb4", fondo:"#100810"},
    {label:"Naranja",   acento:"#ff8c42", fondo:"#100a06"},
    {label:"Verde",     acento:"#39ff14", fondo:"#04100a"},
    {label:"Morado",    acento:"#c77dff", fondo:"#0a0510"},
    {label:"Rojo",      acento:"#ff4444", fondo:"#100505"},
    {label:"Blanco",    acento:"#f0f0f0", fondo:"#0d0d0d"},
    {label:"Dorado",    acento:"#f5c842", fondo:"#0d0a04"},
    {label:"Coral",     acento:"#ff7b6b", fondo:"#100806"},
    {label:"Lavanda",   acento:"#b8a9f0", fondo:"#09080f"},
    {label:"Turquesa",  acento:"#40e0d0", fondo:"#060f0e"},
    {label:"Melocotón", acento:"#ffb347", fondo:"#0f0c06"},
    {label:"Azul",      acento:"#4d9fff", fondo:"#06080f"},
    {label:"Menta",     acento:"#98ffb3", fondo:"#060f09"},
    {label:"Plata",     acento:"#c0c0c0", fondo:"#0a0a0a"},
  ];

  window.aplicarPreset = function(i) {
    const c    = COLORES_PRESET[i];
    const tema = document.body.classList.contains("tema-claro") ? "claro" : "oscuro";
    aplicarTema(tema, c.acento, c.fondo);
    document.querySelectorAll(".color-preset").forEach((el,j) => el.classList.toggle("active", j===i));
    setStorage("mitø-acento", c.acento);
    setStorage("mitø-fondo", c.fondo);
    if (currentUser) {
      currentUser.color_acento = c.acento;
      currentUser.color_fondo  = c.fondo;
      guardarSesionLocal(currentUser);
      db.from("usuarios").update({ color_acento: c.acento, color_fondo: c.fondo }).eq("id", currentUser.id).catch(()=>{});
    }
  };

  window.guardarColoresCustom = function() {
    const acento = document.getElementById("custom-acento")?.value;
    const fondo  = document.getElementById("custom-fondo")?.value;
    if (!acento) return;
    const tema = document.body.classList.contains("tema-claro") ? "claro" : "oscuro";
    aplicarTema(tema, acento, fondo);
    if (currentUser) {
      currentUser.color_acento = acento;
      currentUser.color_fondo  = fondo || currentUser.color_fondo;
      guardarSesionLocal(currentUser);
      db.from("usuarios").update({ color_acento: acento, color_fondo: fondo }).eq("id", currentUser.id).catch(()=>{});
    }
  };

  // ── PERFIL ────────────────────────────────────────────────────
  window.renderPerfil = async function() {
    const cont = document.getElementById("perfil-content");
    if (!cont) return;
    if (!currentUser) {
      cont.innerHTML = `<div style="text-align:center;padding:60px 0">
        <p style="color:var(--text-dim);margin-bottom:16px">necesitas iniciar sesión</p>
        <button class="btn-primary" onclick="go('auth')">entrar</button>
      </div>`;
      return;
    }
    const p   = currentUser;
    const ini = (p.display_name || p.username || "?")[0].toUpperCase();
    const presetsHtml = COLORES_PRESET.map((c,i) =>
      `<div class="color-preset" style="background:${c.acento}" title="${c.label}" onclick="aplicarPreset(${i})"></div>`
    ).join("");
    cont.innerHTML = `
      <div class="perf-header">
        ${p.avatar_url
          ? `<img src="${p.avatar_url}" class="perf-avatar" alt="">`
          : `<div class="perf-avatar-ph">${ini}</div>`}
        <div>
          <div class="perf-name">${esc(p.display_name||p.username)}</div>
          <div class="perf-rol">${p.rol} · ${esc(p.email)}</div>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">editar perfil</h3>
        <div class="upload-form">
          <input type="text" id="edit-display" placeholder="nombre visible" class="field" value="${esc(p.display_name||"")}">
          <input type="text" id="edit-instrumento" placeholder="instrumento / rol" class="field" value="${esc(p.instrumento||"")}">
          <textarea id="edit-bio" placeholder="bio" class="field" rows="3" style="resize:vertical">${esc(p.bio||"")}</textarea>
          <div style="font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-top:4px">redes sociales</div>
          <input type="text" id="edit-instagram" placeholder="instagram (@usuario)" class="field" value="${esc(p.redes_instagram||"")}">
          <input type="text" id="edit-spotify" placeholder="spotify (url)" class="field" value="${esc(p.redes_spotify||"")}">
          <input type="text" id="edit-youtube" placeholder="youtube (url)" class="field" value="${esc(p.redes_youtube||"")}">
          <input type="text" id="edit-tiktok" placeholder="tiktok (@usuario)" class="field" value="${esc(p.redes_tiktok||"")}">
          <label class="file-label" onclick="abrirCrop('avatar')">
            <i class="fa-solid fa-image"></i>
            <span id="avatar-label">cambiar foto de perfil</span>
          </label>
          <button class="btn-primary" onclick="guardarPerfil()">guardar cambios</button>
          <p class="auth-msg" id="perfil-msg"></p>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">color del acento</h3>
        <p style="font-size:11px;color:var(--text-dim);margin-bottom:12px">se guarda en tu cuenta automáticamente</p>
        <div class="color-presets">${presetsHtml}</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">
          <label style="font-size:10px;color:var(--text-dim)">acento</label>
          <input type="color" class="color-input" id="custom-acento" value="${p.color_acento||"#c8f0a0"}" oninput="previewColor('acento',this.value)">
          <label style="font-size:10px;color:var(--text-dim)">fondo</label>
          <input type="color" class="color-input" id="custom-fondo" value="${p.color_fondo||"#0a0b09"}" oninput="previewColor('fondo',this.value)">
          <button class="btn-secondary" onclick="guardarColoresCustom()">aplicar</button>
        </div>
      </div>
      <button class="logout-btn" onclick="doLogout()"><i class="fa-solid fa-right-from-bracket"></i> cerrar sesión</button>`;
  };

  window.previewColor = function(tipo, val) {
    if (tipo === "acento") {
      document.documentElement.style.setProperty("--accent", val);
      document.documentElement.style.setProperty("--cursor-color", val);
    }
    if (tipo === "fondo") document.documentElement.style.setProperty("--bg", val);
  };

  window.guardarPerfil = async function() {
    if (!currentUser) return;
    const msg = document.getElementById("perfil-msg");
    msg.textContent = "guardando..."; msg.className = "auth-msg";
    const updates = {
      display_name:     document.getElementById("edit-display")?.value.trim(),
      instrumento:      document.getElementById("edit-instrumento")?.value.trim(),
      bio:              document.getElementById("edit-bio")?.value.trim(),
      redes_instagram:  document.getElementById("edit-instagram")?.value.trim() || null,
      redes_spotify:    document.getElementById("edit-spotify")?.value.trim()   || null,
      redes_youtube:    document.getElementById("edit-youtube")?.value.trim()   || null,
      redes_tiktok:     document.getElementById("edit-tiktok")?.value.trim()    || null,
    };
    // Upload avatar if cropped
    if (cropBlob) {
      const fn = `avatar-${currentUser.id}-${Date.now()}.jpg`;
      const { error: upErr } = await db.storage.from("avatars").upload(fn, cropBlob, { contentType:"image/jpeg", upsert:true });
      if (!upErr) {
        const { data: ud } = db.storage.from("avatars").getPublicUrl(fn);
        updates.avatar_url = ud.publicUrl;
        cropBlob = null;
      }
    }
    const { error } = await db.from("usuarios").update(updates).eq("id", currentUser.id);
    if (error) {
      msg.textContent = "error: " + error.message; msg.className = "auth-msg error";
    } else {
      Object.assign(currentUser, updates);
      guardarSesionLocal(currentUser);
      updateNavUser();
      msg.textContent = "¡guardado!"; msg.className = "auth-msg success";
      window.sfx?.success();
      setTimeout(() => renderPerfil(), 600);
    }
  };

})();
