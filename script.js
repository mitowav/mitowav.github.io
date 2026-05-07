// =============================================
//   mitø — SCRIPT.JS
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  const SUPABASE_URL = "https://dchmegrnghagvjpqvlbg.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaG1lZ3JuZ2hhZ3ZqcHF2bGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTI2MDksImV4cCI6MjA5MzU4ODYwOX0.CeiSFDLEBBqGXfBE_mKcXzjlutkjeh0DkQyGgbl82PU";
  const CLAVE_SECRETA = "1234";

  let db = null;
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
  }
  catch(e) { console.warn("Supabase:", e.message); }

  let currentUser = null;
  let currentPerfil = null;
  let esPrivado = false;
  let loginDestino = "privado";
  let activeAudio = null;
  let activeCard = null;
  let foroCategoria = null;
  let foroPost = null;
  let tieneAccesoPrivado = false;

  // ── AUTH STATE ────────────────────────────────

  // Recupera sesión existente al cargar
  db.auth.getSession().then(async ({ data: { session } }) => {
    currentUser = session?.user || null;
    if (currentUser) {
      const { data } = await db.from("perfiles").select("*").eq("id", currentUser.id).single();
      currentPerfil = data;
      await comprobarAccesoPrivado();
    }
    updateNavUser();
  });

  db.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      const { data } = await db.from("perfiles").select("*").eq("id", currentUser.id).single();
      currentPerfil = data;
      await comprobarAccesoPrivado();
    } else {
      currentPerfil = null;
      tieneAccesoPrivado = false;
    }
    updateNavUser();
  });

  async function comprobarAccesoPrivado() {
    if (!currentUser) { tieneAccesoPrivado = false; return; }
    const email = currentUser.email;
    const { data } = await db.from("accesos_privados").select("id").eq("email", email).single();
    tieneAccesoPrivado = !!data;
    // Si tiene acceso, actualiza su rol a 'banda' automáticamente
    if (tieneAccesoPrivado && currentPerfil?.rol === "fan") {
      await db.from("perfiles").update({ rol: "banda" }).eq("id", currentUser.id);
      currentPerfil.rol = "banda";
    }
    updateNavPrivado();
  }

  function updateNavPrivado() {
    // Muestra/oculta el botón PRIVADO según acceso
    const lockBtn = document.querySelector(".lock-btn");
    if (!lockBtn) return;
    if (tieneAccesoPrivado) {
      lockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> PRIVADO`;
      lockBtn.onclick = () => go("privado");
      lockBtn.style.borderColor = "rgba(107,255,184,0.4)";
      lockBtn.style.color = "#6bffb8";
    } else {
      lockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> PRIVADO`;
      lockBtn.onclick = () => openLogin("privado");
      lockBtn.style.borderColor = "";
      lockBtn.style.color = "";
    }
  }

  function updateNavUser() {
    const btn = document.getElementById("btn-auth");
    const mobileBtn = document.getElementById("mobile-auth-btn");
    if (currentUser && currentPerfil) {
      btn.innerHTML = `<i class="fa-solid fa-user"></i> ${esc(currentPerfil.display_name || currentPerfil.username)}`;
      btn.className = "nav-auth-btn logged";
      btn.onclick = () => go("perfil");
      if (mobileBtn) {
        mobileBtn.innerHTML = `<i class="fa-solid fa-user"></i> ${esc(currentPerfil.display_name || currentPerfil.username)}`;
        mobileBtn.onclick = () => go("perfil", null, true);
      }
    } else {
      btn.innerHTML = `<i class="fa-solid fa-user"></i> ENTRAR`;
      btn.className = "nav-auth-btn";
      btn.onclick = () => go("auth");
      if (mobileBtn) {
        mobileBtn.innerHTML = `<i class="fa-solid fa-user"></i> ENTRAR`;
        mobileBtn.onclick = () => go("auth", null, true);
      }
    }
  }

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
    if (id === "privado") { cargarBeats("admin-list", null); cargarSolicitudesAdmin(); cargarAccesos(); }
    if (id === "galeria") cargarGaleria();
    if (id === "banda")   { cargarBanda(); renderSolicitudForm(); }
    if (id === "foro")    renderForo();
    if (id === "perfil")  renderPerfil();
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
    // Si el usuario está logueado y tiene acceso, entra directo
    if (tieneAccesoPrivado && destino === "privado") {
      go("privado"); return;
    }
    loginDestino = destino || "privado";
    document.getElementById("login-overlay").classList.add("visible");
    document.getElementById("error-msg").textContent = "";
    document.getElementById("clave-input").value = "";
    setTimeout(() => document.getElementById("clave-input").focus(), 120);
  }
  function cerrarLogin() {
    document.getElementById("login-overlay").classList.remove("visible");
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

  // ── AUTH PÚBLICO ──────────────────────────────

  function switchAuthTab(tab, el) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    el.classList.add("active");
    document.getElementById("auth-login").classList.toggle("hidden", tab !== "login");
    document.getElementById("auth-register").classList.toggle("hidden", tab !== "register");
  }
  window.switchAuthTab = switchAuthTab;

  window.doLogin = async function() {
    const email = document.getElementById("login-email").value.trim();
    const pass  = document.getElementById("login-password").value;
    const msg   = document.getElementById("login-msg");
    msg.textContent = "Entrando..."; msg.className = "auth-msg";
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else { msg.textContent = "¡Bienvenido!"; msg.className = "auth-msg success"; window.sfx?.login(); setTimeout(() => go("home"), 800); }
  };

  window.doRegister = async function() {
    const email    = document.getElementById("reg-email").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const pass     = document.getElementById("reg-password").value;
    const msg      = document.getElementById("reg-msg");
    if (!username) { msg.textContent = "Pon un nombre de usuario"; msg.className = "auth-msg error"; return; }
    if (pass.length < 6) { msg.textContent = "La contraseña debe tener al menos 6 caracteres"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Creando cuenta..."; msg.className = "auth-msg";
    const { error } = await db.auth.signUp({
      email, password: pass,
      options: { data: { username }, emailRedirectTo: null }
    });
    if (error) {
      msg.textContent = "Error: " + error.message; msg.className = "auth-msg error";
    } else {
      // Guarda el email para usarlo en la verificación
      window._regEmail = email;
      // Muestra el paso 2 — OTP
      document.getElementById("reg-step-1").style.display = "none";
      document.getElementById("reg-step-2").style.display = "flex";
      msg.textContent = "📧 Código enviado a " + email; msg.className = "auth-msg success";
      setTimeout(() => document.getElementById("reg-otp").focus(), 100);
    }
  };

  window.volverRegStep1 = function() {
    document.getElementById("reg-step-1").style.display = "flex";
    document.getElementById("reg-step-2").style.display = "none";
    document.getElementById("reg-msg").textContent = "";
    document.getElementById("reg-otp").value = "";
  };

  window.verificarOTP = async function() {
    const otp  = document.getElementById("reg-otp").value.trim();
    const msg  = document.getElementById("reg-msg");
    const email = window._regEmail;
    if (!otp || otp.length < 6) { msg.textContent = "Introduce el código de 6 dígitos"; msg.className = "auth-msg error"; return; }
    if (!email) { msg.textContent = "Error: vuelve a registrarte"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Verificando..."; msg.className = "auth-msg";
    const { error } = await db.auth.verifyOtp({ email, token: otp, type: "signup" });
    if (error) {
      msg.textContent = "Código incorrecto o caducado"; msg.className = "auth-msg error";
    } else {
      msg.textContent = "¡Cuenta verificada! 🎉"; msg.className = "auth-msg success"; window.sfx?.success();
      setTimeout(() => go("home"), 1000);
    }
  };

  // ── PERFIL ────────────────────────────────────

  async function renderPerfil() {
    const cont = document.getElementById("perfil-content");
    if (!currentUser) {
      cont.innerHTML = `<div class="solicitud-login">
        <p>Inicia sesión para ver tu perfil</p>
        <br><button class="btn-primary" onclick="go('auth')">Entrar</button>
      </div>`;
      return;
    }
    const p = currentPerfil;
    const inicial = (p.display_name || p.username || "?")[0].toUpperCase();
    cont.innerHTML = `
      <div class="perfil-wrap">
        <div class="perfil-header">
          ${p.avatar_url
            ? `<img src="${p.avatar_url}" class="perfil-avatar-big" alt="">`
            : `<div class="perfil-avatar-placeholder">${inicial}</div>`}
          <div class="perfil-info">
            <div class="perfil-name">${esc(p.display_name || p.username)}</div>
            <div class="perfil-rol">${esc(p.rol)} ${p.instrumento ? "· " + esc(p.instrumento) : ""}</div>
            ${p.bio ? `<p style="font-size:12px;color:var(--text-dim);margin-top:8px;line-height:1.6">${esc(p.bio)}</p>` : ""}
          </div>
        </div>
        <div class="perfil-edit-box">
          <h3>EDITAR PERFIL</h3>
          <input type="text" id="edit-display" placeholder="Nombre visible" class="field" value="${esc(p.display_name || "")}">
          <input type="text" id="edit-instrumento" placeholder="Instrumento / rol" class="field" value="${esc(p.instrumento || "")}">
          <textarea id="edit-bio" placeholder="Bio" class="field textarea" rows="3">${esc(p.bio || "")}</textarea>
          <label class="file-label">
            <i class="fa-solid fa-image"></i>
            <span id="avatar-label">Cambiar foto de perfil</span>
            <input type="file" accept="image/*" onchange="updateAvatarLabel(this)" id="avatar-file">
          </label>
          <button class="btn-primary full" onclick="guardarPerfil()">Guardar cambios</button>
          <p class="auth-msg" id="perfil-msg"></p>
        </div>
        <button class="perfil-logout" onclick="doLogout()"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</button>
      </div>`;
  }

  window.updateAvatarLabel = function(input) {
    document.getElementById("avatar-label").textContent = input.files?.[0]?.name || "Cambiar foto de perfil";
  };

  window.guardarPerfil = async function() {
    const msg = document.getElementById("perfil-msg");
    msg.textContent = "Guardando..."; msg.className = "auth-msg";
    const updates = {
      display_name: document.getElementById("edit-display").value.trim(),
      instrumento:  document.getElementById("edit-instrumento").value.trim(),
      bio:          document.getElementById("edit-bio").value.trim(),
    };
    const avatarFile = document.getElementById("avatar-file").files[0];
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const fileName = `${currentUser.id}.${ext}`;
      await db.storage.from("avatars").upload(fileName, avatarFile, { upsert: true });
      const { data } = db.storage.from("avatars").getPublicUrl(fileName);
      updates.avatar_url = data.publicUrl + "?t=" + Date.now();
    }
    const { error } = await db.from("perfiles").update(updates).eq("id", currentUser.id);
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else {
      const { data } = await db.from("perfiles").select("*").eq("id", currentUser.id).single();
      currentPerfil = data;
      msg.textContent = "¡Guardado!"; msg.className = "auth-msg success"; window.sfx?.success();
      updateNavUser();
      setTimeout(() => renderPerfil(), 600);
    }
  };

  window.doLogout = async function() {
    await db.auth.signOut();
    currentUser = null; currentPerfil = null;
    updateNavUser();
    go("home");
  };

  // ── GALERÍA ───────────────────────────────────

  async function cargarGaleria() {
    const grid = document.getElementById("galeria-grid");
    grid.innerHTML = `<p class="loading-msg">Cargando galería...</p>`;
    const { data, error } = await db.from("galeria").select("*").order("id", { ascending: false });
    if (error || !data?.length) {
      grid.innerHTML = `<p class="loading-msg">La galería está vacía.</p>`; return;
    }
    grid.innerHTML = "";
    data.forEach(foto => {
      const item = document.createElement("div");
      item.className = "galeria-item";
      item.innerHTML = `
        <img src="${foto.url}" alt="${esc(foto.caption || "")}" loading="lazy">
        <div class="galeria-item-overlay">
          ${foto.caption ? `<p class="galeria-caption">${esc(foto.caption)}</p>` : ""}
        </div>`;
      item.addEventListener("click", () => abrirLightbox(foto.url, foto.caption));
      grid.appendChild(item);
    });
  }

  function abrirLightbox(url, caption) {
    document.getElementById("lightbox-img").src = url;
    document.getElementById("lightbox-caption").textContent = caption || "";
    document.getElementById("lightbox").classList.add("visible");
  }
  function cerrarLightbox() { document.getElementById("lightbox").classList.remove("visible"); }
  window.cerrarLightbox = cerrarLightbox;

  window.updateGaleriaLabel = function(input) {
    document.getElementById("galeria-file-label").textContent = input.files?.[0]?.name || "Elige una foto";
  };

  window.subirFotoGaleria = async function() {
    const file    = document.getElementById("galeria-file").files[0];
    const caption = document.getElementById("galeria-caption").value.trim();
    if (!file) { alert("Elige una foto"); return; }
    const btn = document.querySelector("#privado .upload-box:nth-child(2) .btn-primary");
    btn.textContent = "Subiendo..."; btn.disabled = true;
    try {
      const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
      const fileName = `${Date.now()}-${cleanName}`;
      const { error: upErr } = await db.storage.from("galeria").upload(fileName, file);
      if (upErr) throw upErr;
      const { data: urlData } = db.storage.from("galeria").getPublicUrl(fileName);
      await db.from("galeria").insert([{ url: urlData.publicUrl, caption }]);
      document.getElementById("galeria-file").value = "";
      document.getElementById("galeria-caption").value = "";
      document.getElementById("galeria-file-label").textContent = "Elige una foto";
      btn.textContent = "¡Subida! 🔥";
      setTimeout(() => { btn.textContent = "Subir foto"; btn.disabled = false; }, 2000);
    } catch(err) {
      alert("Error: " + err.message); btn.textContent = "Subir foto"; btn.disabled = false;
    }
  };

  // ── BANDA ─────────────────────────────────────

  async function cargarBanda() {
    const grid = document.getElementById("banda-grid");
    grid.innerHTML = `<p class="loading-msg">Cargando...</p>`;
    const { data } = await db.from("perfiles").select("*").eq("rol", "banda").order("created_at");
    if (!data?.length) { grid.innerHTML = `<p class="loading-msg">La banda se está formando... 🎸</p>`; return; }
    grid.innerHTML = "";
    data.forEach(m => {
      const inicial = (m.display_name || m.username || "?")[0].toUpperCase();
      const card = document.createElement("div");
      card.className = "banda-card";
      card.innerHTML = `
        ${m.avatar_url
          ? `<img src="${m.avatar_url}" class="banda-avatar" alt="">`
          : `<div class="banda-avatar-placeholder">${inicial}</div>`}
        <div class="banda-name">${esc(m.display_name || m.username)}</div>
        ${m.instrumento ? `<div class="banda-rol">${esc(m.instrumento)}</div>` : ""}
        ${m.bio ? `<p class="banda-bio">${esc(m.bio)}</p>` : ""}`;
      grid.appendChild(card);
    });
  }

  async function renderSolicitudForm() {
    const cont = document.getElementById("solicitud-content");
    if (!currentUser) {
      cont.innerHTML = `<div class="solicitud-login">
        <p>Inicia sesión para enviar una solicitud</p>
        <br><button class="btn-primary" onclick="go('auth')">Entrar</button>
      </div>`; return;
    }
    // Ver si ya tiene solicitud
    const { data } = await db.from("solicitudes").select("*").eq("user_id", currentUser.id).single();
    if (data) {
      cont.innerHTML = `<div class="solicitud-enviada">
        <div class="check">✅</div>
        <p>Tu solicitud está <strong>${data.estado}</strong>.<br>Te avisaremos pronto.</p>
      </div>`; return;
    }
    cont.innerHTML = `
      <div class="solicitud-form">
        <input type="text" id="sol-nombre" placeholder="Tu nombre" class="field" value="${esc(currentPerfil?.display_name || "")}">
        <input type="text" id="sol-instrumento" placeholder="Instrumento / rol (ej: Guitarra, Producción...)" class="field">
        <input type="text" id="sol-redes" placeholder="Tu Instagram u otras redes" class="field">
        <textarea id="sol-experiencia" placeholder="¿Qué experiencia tienes?" class="field textarea" rows="3"></textarea>
        <textarea id="sol-mensaje" placeholder="¿Por qué quieres unirte?" class="field textarea" rows="3"></textarea>
        <button class="btn-primary" onclick="enviarSolicitud()">Enviar solicitud</button>
        <p class="auth-msg" id="sol-msg"></p>
      </div>`;
  }

  window.enviarSolicitud = async function() {
    const nombre      = document.getElementById("sol-nombre").value.trim();
    const instrumento = document.getElementById("sol-instrumento").value.trim();
    const experiencia = document.getElementById("sol-experiencia").value.trim();
    const mensaje     = document.getElementById("sol-mensaje").value.trim();
    const redes       = document.getElementById("sol-redes").value.trim();
    const msg         = document.getElementById("sol-msg");
    if (!nombre || !instrumento) { msg.textContent = "Rellena nombre e instrumento"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Enviando..."; msg.className = "auth-msg";
    const { error } = await db.from("solicitudes").insert([{
      user_id: currentUser.id, nombre, instrumento, experiencia, mensaje, redes
    }]);
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else { renderSolicitudForm(); }
  };

  // ── ACCESOS PRIVADOS ─────────────────────────

  async function cargarAccesos() {
    const cont = document.getElementById("accesos-list");
    if (!cont) return;
    cont.innerHTML = `<p class="loading-msg">Cargando...</p>`;
    const { data } = await db.from("accesos_privados").select("*").order("created_at", { ascending: false });
    if (!data?.length) { cont.innerHTML = `<p class="loading-msg">No hay accesos configurados.</p>`; return; }
    cont.innerHTML = "";
    data.forEach(a => {
      const card = document.createElement("div");
      card.className = "solicitud-card";
      card.innerHTML = `
        <div class="solicitud-card-info">
          <h4>${esc(a.email)}</h4>
          <p>Añadido el ${formatFecha(a.created_at)}</p>
        </div>
        <button class="delete-btn" style="opacity:1" title="Eliminar acceso" onclick="eliminarAcceso(${a.id}, '${esc(a.email)}', this)">
          <i class="fa-solid fa-trash"></i>
        </button>`;
      cont.appendChild(card);
    });
  }

  window.añadirAcceso = async function() {
    const email = document.getElementById("nuevo-acceso-email").value.trim().toLowerCase();
    const msg   = document.getElementById("acceso-msg");
    if (!email || !email.includes("@")) { msg.textContent = "Pon un email válido"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Añadiendo..."; msg.className = "auth-msg";
    const { error } = await db.from("accesos_privados").insert([{ email }]);
    if (error) {
      msg.textContent = error.code === "23505" ? "Ese email ya tiene acceso" : "Error: " + error.message;
      msg.className = "auth-msg error";
    } else {
      document.getElementById("nuevo-acceso-email").value = "";
      msg.textContent = "✓ Acceso añadido";
      msg.className = "auth-msg success";
      setTimeout(() => { msg.textContent = ""; }, 2000);
      cargarAccesos();
    }
  };

  window.eliminarAcceso = async function(id, email, btn) {
    if (!confirm(`¿Quitar acceso a ${email}?`)) return;
    btn.disabled = true;
    const { error } = await db.from("accesos_privados").delete().eq("id", id);
    if (error) { alert("Error: " + error.message); btn.disabled = false; return; }
    btn.closest(".solicitud-card").remove();
  };

  async function cargarSolicitudesAdmin() {
    const cont = document.getElementById("solicitudes-admin");
    cont.innerHTML = `<p class="loading-msg">Cargando...</p>`;
    const { data } = await db.from("solicitudes").select("*").order("created_at", { ascending: false });
    if (!data?.length) { cont.innerHTML = `<p class="loading-msg">No hay solicitudes aún.</p>`; return; }
    cont.innerHTML = "";
    data.forEach(s => {
      const card = document.createElement("div");
      card.className = "solicitud-card";
      card.innerHTML = `
        <div class="solicitud-card-info">
          <h4>${esc(s.nombre)} — ${esc(s.instrumento)}</h4>
          <p>${s.redes ? "🔗 " + esc(s.redes) + " · " : ""}${s.experiencia ? esc(s.experiencia.substring(0,80)) + "..." : ""}</p>
          <p style="margin-top:4px;font-style:italic">"${esc((s.mensaje||"").substring(0,100))}${(s.mensaje||"").length > 100 ? "..." : ""}"</p>
        </div>
        <span class="solicitud-estado ${s.estado}">${s.estado}</span>`;
      cont.appendChild(card);
    });
  }

  // ── FORO ──────────────────────────────────────

  async function renderForo() {
    const cont = document.getElementById("foro-content");
    if (foroPost) { await renderPostDetalle(foroPost); return; }

    const { data: cats } = await db.from("categorias").select("*").order("orden");
    const { data: posts } = await db.from("posts").select("*, perfiles(display_name, username), comentarios(id)")
      .eq(foroCategoria ? "categoria_id" : "id", foroCategoria || (cats?.[0]?.id || 0))
      .order("created_at", { ascending: false });

    let catsHtml = (cats || []).map(c => `
      <div class="categoria-card ${foroCategoria === c.id ? "active" : ""}" onclick="filtrarCategoria(${c.id})">
        <i class="fa-solid ${c.icono || "fa-comments"}"></i>
        <h4>${esc(c.nombre)}</h4>
        <p>${esc(c.descripcion || "")}</p>
      </div>`).join("");

    let postsHtml = "";
    if (!posts?.length) {
      postsHtml = `<p class="loading-msg">No hay posts en esta categoría aún. ¡Sé el primero!</p>`;
    } else {
      postsHtml = posts.map(p => {
        const autor = p.perfiles?.display_name || p.perfiles?.username || "Anónimo";
        const numComentarios = p.comentarios?.length || 0;
        return `<div class="post-card" onclick="abrirPost(${p.id})">
          <div class="post-card-icon">${autor[0].toUpperCase()}</div>
          <div class="post-card-body">
            <h4>${esc(p.titulo)}</h4>
            <p class="post-card-meta">por ${esc(autor)} · ${formatFecha(p.created_at)}</p>
          </div>
          <div class="post-card-comments"><i class="fa-regular fa-comment"></i> ${numComentarios}</div>
        </div>`;
      }).join("");
    }

    const newPostBtn = currentUser
      ? `<button class="btn-primary" onclick="abrirNuevoPost()"><i class="fa-solid fa-plus"></i> NUEVO POST</button>`
      : `<button class="btn-primary" onclick="go('auth')"><i class="fa-solid fa-user"></i> ENTRAR PARA POSTEAR</button>`;

    cont.innerHTML = `
      <div class="foro-header">
        <h2>FORO</h2>
        ${newPostBtn}
      </div>
      <div class="categorias-grid">${catsHtml}</div>
      <div class="posts-list">${postsHtml}</div>`;

    // Cargar categorías si no hay filtro
    if (!foroCategoria && cats?.length) {
      foroCategoria = cats[0].id;
      renderForo();
    }
  }

  window.filtrarCategoria = function(id) {
    foroCategoria = id; foroPost = null; renderForo();
  };

  window.abrirPost = function(id) {
    foroPost = id; renderForo();
  };

  async function renderPostDetalle(postId) {
    const cont = document.getElementById("foro-content");
    cont.innerHTML = `<p class="loading-msg">Cargando post...</p>`;
    const { data: post } = await db.from("posts")
      .select("*, perfiles(display_name, username)")
      .eq("id", postId).single();
    const { data: comentarios } = await db.from("comentarios")
      .select("*, perfiles(display_name, username)")
      .eq("post_id", postId).order("created_at");

    const autor = post.perfiles?.display_name || post.perfiles?.username || "Anónimo";
    const comsHtml = (comentarios || []).map(c => {
      const ca = c.perfiles?.display_name || c.perfiles?.username || "Anónimo";
      return `<div class="comentario-card">
        <div class="comentario-autor">${esc(ca)} · ${formatFecha(c.created_at)}</div>
        <div class="comentario-texto">${esc(c.contenido)}</div>
      </div>`;
    }).join("") || `<p class="loading-msg" style="padding:16px 0">Aún no hay comentarios.</p>`;

    const comentarHtml = currentUser
      ? `<div class="comentar-form">
          <textarea id="nuevo-comentario" placeholder="Tu comentario..." class="field textarea" rows="3"></textarea>
          <button class="btn-primary" onclick="enviarComentario(${postId})">Comentar</button>
          <p class="auth-msg" id="com-msg"></p>
        </div>`
      : `<p style="font-size:11px;color:var(--text-dim);letter-spacing:1px;margin-top:12px"><a onclick="go('auth')" style="color:var(--gold);cursor:pointer">Inicia sesión</a> para comentar</p>`;

    cont.innerHTML = `
      <div class="post-detail">
        <button class="back-foro" onclick="volverForo()">← Volver al foro</button>
        <div class="post-detail-header">
          <h2>${esc(post.titulo)}</h2>
          <p class="post-detail-meta">por ${esc(autor)} · ${formatFecha(post.created_at)}</p>
        </div>
        <div class="post-detail-body">${esc(post.contenido)}</div>
        <div class="comentarios-section">
          <h3>COMENTARIOS</h3>
          ${comsHtml}
          ${comentarHtml}
        </div>
      </div>`;
  }

  window.volverForo = function() { foroPost = null; renderForo(); };

  window.enviarComentario = async function(postId) {
    const texto = document.getElementById("nuevo-comentario").value.trim();
    const msg   = document.getElementById("com-msg");
    if (!texto) return;
    if (!currentUser) { msg.textContent = "Inicia sesión primero"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Enviando..."; msg.className = "auth-msg";
    const { error } = await db.from("comentarios").insert([{
      post_id: postId, autor_id: currentUser.id, contenido: texto
    }]);
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else { renderPostDetalle(postId); }
  };

  function abrirNuevoPost() {
    cargarCategoriasSelect();
    document.getElementById("post-overlay").classList.add("visible");
  }
  window.abrirNuevoPost = abrirNuevoPost;

  function cerrarPostOverlay(e) {
    if (!e || e.target === document.getElementById("post-overlay")) {
      document.getElementById("post-overlay").classList.remove("visible");
    }
  }
  window.cerrarPostOverlay = cerrarPostOverlay;

  async function cargarCategoriasSelect() {
    const sel = document.getElementById("post-categoria");
    const { data } = await db.from("categorias").select("*").order("orden");
    sel.innerHTML = (data || []).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
  }

  window.crearPost = async function() {
    const titulo     = document.getElementById("post-titulo").value.trim();
    const contenido  = document.getElementById("post-contenido").value.trim();
    const categoriaId = document.getElementById("post-categoria").value;
    const msg        = document.getElementById("post-msg");
    if (!titulo || !contenido) { msg.textContent = "Rellena título y contenido"; msg.className = "auth-msg error"; return; }
    msg.textContent = "Publicando..."; msg.className = "auth-msg";
    const { error } = await db.from("posts").insert([{
      titulo, contenido, autor_id: currentUser.id, categoria_id: categoriaId
    }]);
    if (error) { msg.textContent = "Error: " + error.message; msg.className = "auth-msg error"; }
    else {
      cerrarPostOverlay();
      document.getElementById("post-titulo").value = "";
      document.getElementById("post-contenido").value = "";
      renderForo();
    }
  };

  // ── VISIBILIDAD & BEATS ───────────────────────

  window.setVisibilidad = function(priv) {
    esPrivado = priv;
    document.getElementById("vis-publico").classList.toggle("active", !priv);
    document.getElementById("vis-privado").classList.toggle("active", priv);
  };
  window.updateFileName = function(input) {
    document.getElementById("file-name-label").textContent = input.files?.[0]?.name || "Elige un archivo de audio";
  };
  window.updateCoverName = function(input) {
    document.getElementById("cover-name-label").textContent = input.files?.[0]?.name || "Cover / imagen (opcional)";
  };

  window.subirBeat = async function() {
    if (!db) { alert("Supabase no configurado"); return; }
    const title  = document.getElementById("beat-title").value.trim();
    const genre  = document.getElementById("beat-genre").value.trim();
    const bpm    = document.getElementById("beat-bpm").value;
    const tono   = document.getElementById("beat-tono").value.trim();
    const file   = document.getElementById("audio-file").files[0];
    const cover  = document.getElementById("cover-file").files[0];
    const btn    = document.querySelector(".upload-form .btn-primary");
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
      if (cover) {
        const cleanCover = cover.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
        const coverName = `cover-${Date.now()}-${cleanCover}`;
        await db.storage.from("covers").upload(coverName, cover);
        const { data: coverUrlData } = db.storage.from("covers").getPublicUrl(coverName);
        cover_url = coverUrlData.publicUrl;
      }

      const { error: dbErr } = await db.from("beats").insert([{
        title: title || "Sin título", genre: genre || "—",
        audio_url: urlData.publicUrl, privado: esPrivado,
        waveform: JSON.stringify(waveformData),
        bpm: bpm ? parseInt(bpm) : null,
        tono: tono || null,
        cover_url
      }]);
      if (dbErr) throw dbErr;

      ["beat-title","beat-genre","beat-bpm","beat-tono","audio-file","cover-file"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
      document.getElementById("file-name-label").textContent = "Elige un archivo de audio";
      document.getElementById("cover-name-label").textContent = "Cover / imagen (opcional)";
      btn.textContent = "¡Subido! 🔥"; window.sfx?.upload();
      setTimeout(() => { btn.textContent = "Subir beat 🔥"; btn.disabled = false; }, 2000);
      cargarBeats("admin-list", null);
    } catch(err) {
      console.error(err); alert("Error: " + (err.message || "revisa la consola"));
      btn.textContent = "Subir beat 🔥"; btn.disabled = false;
    }
  };

  async function analizarWaveform(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioCtx.decodeAudioData(e.target.result);
          const rawData = audioBuffer.getChannelData(0);
          const samples = 55;
          const blockSize = Math.floor(rawData.length / samples);
          const peaks = [];
          for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) sum += Math.abs(rawData[i * blockSize + j]);
            peaks.push(sum / blockSize);
          }
          const max = Math.max(...peaks);
          resolve(peaks.map(v => Math.round(15 + (v / max) * 80)));
          audioCtx.close();
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // ── PLAYER ────────────────────────────────────

  function generateBars(beat, index) {
    if (beat?.waveform) {
      try {
        const data = typeof beat.waveform === "string" ? JSON.parse(beat.waveform) : beat.waveform;
        if (Array.isArray(data) && data.length > 0)
          return data.map(h => `<span style="height:${h}%"></span>`).join("");
      } catch(e) {}
    }
    let s = ((beat?.id) ? beat.id : (index * 7 + 13)) % 99999 + 1;
    function rand() { s = (s * 1664525 + 1013904223) & 0xffffffff; return ((s >>> 0) / 0xffffffff); }
    return Array.from({length: 55}, () => `<span style="height:${Math.round(15 + rand() * 68)}%"></span>`).join("");
  }

  function crearCard(beat, index, admin) {
    const card = document.createElement("div");
    card.className = "beat-card";
    const bars = generateBars(beat, index);

    const metaTags = [
      beat.bpm  ? `<span class="beat-meta-tag">${beat.bpm} BPM</span>` : "",
      beat.tono ? `<span class="beat-meta-tag">${esc(beat.tono)}</span>` : "",
    ].join("");

    card.innerHTML = `
      <span class="beat-num">${String(index + 1).padStart(2, "0")}</span>
      ${beat.cover_url
        ? `<img src="${beat.cover_url}" class="beat-cover" alt="">`
        : `<div class="beat-cover-placeholder"><i class="fa-solid fa-music"></i></div>`}
      <div class="beat-info">
        <h3>${esc(beat.title)}</h3>
        <p>${esc(beat.genre)}</p>
        <div class="beat-meta-tags">${metaTags}</div>
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
      ${admin ? `<button class="delete-btn" title="Borrar"><i class="fa-solid fa-trash"></i></button>` : ""}`;

    requestAnimationFrame(() => {
      const wrap   = card.querySelector(".waveform-wrap");
      const filled = card.querySelector(".waveform-filled");
      if (wrap && filled) filled.style.width = wrap.offsetWidth + "px";
    });

    const playBtn  = card.querySelector(".play-btn");
    const waveWrap = card.querySelector(".waveform-wrap");
    const prog     = card.querySelector(".waveform-progress");
    const cursor   = card.querySelector(".waveform-cursor");
    const timeCur  = card.querySelector(".time-cur");
    const timeTot  = card.querySelector(".time-tot");
    let audio = null; let isPlaying = false;

    function getAudio() {
      if (audio) return audio;
      audio = new Audio(beat.audio_url);
      audio.addEventListener("loadedmetadata", () => { timeTot.textContent = fmt(audio.duration); });
      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        prog.style.width = pct + "%"; cursor.style.left = pct + "%";
        timeCur.textContent = fmt(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        isPlaying = false; playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        card.classList.remove("is-playing"); prog.style.width = "0%";
        cursor.style.left = "0%"; timeCur.textContent = "0:00";
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
      if (isPlaying) { a.pause(); isPlaying = false; playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`; card.classList.remove("is-playing"); activeAudio = null; activeCard = null; }
      else { stopOthers(); a.play(); isPlaying = true; playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`; card.classList.add("is-playing"); activeAudio = a; activeCard = card; }
    });

    waveWrap.addEventListener("click", (e) => {
      const a = getAudio(); if (!a.duration) return;
      const rect = waveWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      a.currentTime = pct * a.duration;
      prog.style.width = (pct * 100) + "%"; cursor.style.left = (pct * 100) + "%";
    });

    if (admin) {
      const delBtn = card.querySelector(".delete-btn");
      delBtn.addEventListener("click", async () => {
        if (!confirm(`¿Borrar "${beat.title}"?`)) return;
        delBtn.disabled = true; delBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        window.sfx?.delete(); const { error } = await db.from("beats").delete().eq("id", beat.id);
        if (error) { alert("Error: " + error.message); delBtn.disabled = false; delBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`; return; }
        card.style.transition = "opacity 0.3s, transform 0.3s";
        card.style.opacity = "0"; card.style.transform = "translateX(20px)";
        setTimeout(() => card.remove(), 310);
      });
    }
    return card;
  }

  async function cargarBeats(containerId, soloPrivados, limite) {
    const cont = document.getElementById(containerId);
    if (!cont || !db) return;
    cont.innerHTML = `<p class="loading-msg">Cargando...</p>`;
    const admin = soloPrivados === null;
    try {
      let q = db.from("beats").select("*").order("id", { ascending: false });
      if (soloPrivados !== null) q = q.eq("privado", soloPrivados);
      if (limite) q = q.limit(limite);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) { cont.innerHTML = `<p class="loading-msg">No hay beats aún. 🎧</p>`; return; }
      cont.innerHTML = "";
      data.forEach((beat, i) => cont.appendChild(crearCard(beat, i, admin)));
    } catch(err) { console.error(err); cont.innerHTML = `<p class="loading-msg">Error al cargar.</p>`; }
  }

  // ── HELPERS ──────────────────────────────────

  function fmt(s) { if (!s || isNaN(s)) return "0:00"; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; }
  function esc(s) { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function formatFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }

  // ── INIT ─────────────────────────────────────
  go("home");
});
