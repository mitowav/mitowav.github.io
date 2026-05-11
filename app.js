/* ================================================================
   mitø · app.js — núcleo: navegación, tema, helpers, init, realtime
   ================================================================ */

const SUPABASE_URL = "https://dchmegrnghagvjpqvlbg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaG1lZ3JuZ2hhZ3ZqcHF2bGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTI2MDksImV4cCI6MjA5MzU4ODYwOX0.CeiSFDLEBBqGXfBE_mKcXzjlutkjeh0DkQyGgbl82PU";

// ── GLOBALS ───────────────────────────────────────────────────
var db                = null;
var currentUser       = null;
var tieneAccesoPrivado = false;
var activeAudio       = null;
var activeCard        = null;
var currentPage       = "home";
var foroCategoria     = null;
var ambientTracks     = [];
var ambientIndex      = 0;
var ambientAudio      = new Audio();
var ambientPlaying    = false;
var beatPrivado       = false;
var beatsFull         = [];
var inspsList         = [];
var insps             = [];
var esPrivado         = false;
var galeriaTipo       = "foto";
var coverBlob         = null;
var galeriaBlob       = null;
var cropBlob          = null;
var currentPerfil     = null;
var dmParaId          = null;
var dmParaNombre      = "";
var onlineChannel     = null;
var cropTarget        = null;
var cropImg           = null;
var cropScale         = 1;
var cropX = 0, cropY = 0;
var cropW = 0, cropH = 0;
var cropDragging = false;
var cropStartX = 0, cropStartY = 0;

// ── INIT SUPABASE ─────────────────────────────────────────────
try {
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) { console.error("Supabase init error:", e); }

// ── HELPERS ───────────────────────────────────────────────────
window.esc = function(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
};
window.fmt = function(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
};
window.formatFecha = function(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day:"numeric", month:"short", year:"numeric" });
};
window.withTimeout = function(p, ms) {
  return Promise.race([p, new Promise((_,r) => setTimeout(() => r(new Error("TIMEOUT")), ms))]);
};

// ── STORAGE (con fallback para Brave) ─────────────────────────
window.setCookie = function(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Strict";
};
window.getCookie = function(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
};
window.setStorage = function(key, val) {
  try { localStorage.setItem(key, val); } catch(e) {
    try { sessionStorage.setItem(key, val); } catch(e2) {}
  }
  try { setCookie("ls_" + key, val, 30); } catch(e) {}
};
window.getStorage = function(key) {
  try {
    const val = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (val !== null && val !== undefined) return val;
  } catch(e) {}
  return getCookie("ls_" + key) || null;
};

// ── TEMA ──────────────────────────────────────────────────────
(function() {
  const tema   = getStorage("mitø-tema") || "oscuro";
  const acento = getStorage("mitø-acento");
  const fondo  = getStorage("mitø-fondo");
  document.body.classList.toggle("tema-claro", tema === "claro");
  if (acento) {
    document.documentElement.style.setProperty("--accent", acento);
    document.documentElement.style.setProperty("--cursor-color", acento);
  }
  if (fondo && tema !== "claro") {
    document.documentElement.style.setProperty("--bg", fondo);
  }
})();

window.aplicarTema = function(tema, acento, fondo) {
  document.body.classList.toggle("tema-claro", tema === "claro");
  if (acento) {
    document.documentElement.style.setProperty("--accent", acento);
    document.documentElement.style.setProperty("--cursor-color", acento);
    setStorage("mitø-acento", acento);
  }
  if (fondo && tema !== "claro") {
    document.documentElement.style.setProperty("--bg", fondo);
    setStorage("mitø-fondo", fondo);
  } else if (tema === "claro") {
    document.documentElement.style.removeProperty("--bg");
  }
  setStorage("mitø-tema", tema || "oscuro");
};

window.toggleTheme = function() {
  const claro     = document.body.classList.contains("tema-claro");
  const nuevoTema = claro ? "oscuro" : "claro";
  const acento    = currentUser?.color_acento || getStorage("mitø-acento");
  const fondo     = currentUser?.color_fondo  || getStorage("mitø-fondo");
  aplicarTema(nuevoTema, acento, fondo);
  if (currentUser) {
    currentUser.tema = nuevoTema;
    guardarSesionLocal(currentUser);
    db.from("usuarios").update({ tema: nuevoTema }).eq("id", currentUser.id).catch(()=>{});
  }
};

// ── NAVEGACIÓN ────────────────────────────────────────────────
const PAGE_ORDER = ["home","beats","lanzamientos","galeria","banda","foro","letras","about","soporte","auth","perfil","privado"];

window.go = function(id, btnEl, closeMenu) {
  if (id === currentPage && id !== "privado") return;
  const oldIdx = PAGE_ORDER.indexOf(currentPage);
  const newIdx = PAGE_ORDER.indexOf(id);
  const dir    = newIdx >= oldIdx ? "slide-r" : "slide-l";

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) {
    target.classList.remove("slide-r","slide-l","slide-u");
    target.classList.add(dir);
    void target.offsetWidth;
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-link, .mob-btn, .p-nav-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  if (closeMenu) { const m = document.getElementById("mob-menu"); if (m) m.style.display = "none"; }

  currentPage = id;

  if (id === "home")          { cargarBeats("home-beats", false, 3); }
  if (id === "beats")         { cargarBeats("beats-list", false); }
  if (id === "lanzamientos")  { cargarLanzamientos(); }
  if (id === "galeria")       { cargarGaleria(); }
  if (id === "banda")         { cargarBanda(); renderSolicitudForm(); }
  if (id === "foro")          { renderForo(); }
  if (id === "letras")        { cargarLetras(); }
  if (id === "perfil")        { renderPerfil(); }
  if (id === "privado") {
    cargarBeats("admin-list", null);
    cargarSolicitudesAdmin();
    cargarAccesos();
    cargarNotificaciones();
  }
};

window.toggleMobMenu = function() {
  const m = document.getElementById("mob-menu");
  if (m) m.style.display = m.style.display === "block" ? "none" : "block";
};
window.toggleMenu = window.toggleMobMenu;

// ── LOGIN PRIVADO ─────────────────────────────────────────────
window.openLogin = function(destino) {
  document.getElementById("login-overlay").classList.add("visible");
  document.getElementById("clave-input").value = "";
  document.getElementById("error-msg").textContent = "";
  window._loginDestino = destino;
};
window.cerrarLogin = function() {
  document.getElementById("login-overlay").classList.remove("visible");
};
window.cerrarLoginOverlay = function(e) {
  if (e.target === document.getElementById("login-overlay")) cerrarLogin();
};
window.comprobarClave = async function() {
  const CLAVE_SECRETA = "1234";
  const val = document.getElementById("clave-input").value.trim();
  const msg = document.getElementById("error-msg");
  let ok = (val === CLAVE_SECRETA);
  if (!ok && currentUser?.email) {
    const { data } = await db.from("accesos_privados").select("email").eq("email", currentUser.email).limit(1);
    ok = !!(data?.length);
  }
  if (ok) {
    tieneAccesoPrivado = true;
    updateNavPrivado();
    cerrarLogin();
    go(window._loginDestino || "privado");
  } else {
    msg.textContent = "clave incorrecta";
    window.sfx?.error();
  }
};

// ── SWITCH PRIVADO ────────────────────────────────────────────
window.switchPrivado = function(id, btn) {
  document.querySelectorAll(".p-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".p-nav-btn").forEach(b => b.classList.remove("active"));
  const panel = document.getElementById("panel-" + id);
  if (panel) panel.classList.add("active");
  if (btn) btn.classList.add("active");
  if (id === "accesos")           cargarAccesos();
  if (id === "solicitudes")       cargarSolicitudesAdmin();
  if (id === "todos-beats")       cargarBeats("admin-list", null);
  if (id === "letras-priv")       cargarLetrasAdmin();
  if (id === "galeria-edit")      cargarGaleriaAdmin();
  if (id === "lanzamientos-priv") cargarLanzamientosAdmin();
};

// ── GALERIA TIPO ──────────────────────────────────────────────
window.setGaleriaTipo = function(tipo) {
  galeriaTipo = tipo;
  document.getElementById("galeria-tipo-foto")?.classList.toggle("active", tipo === "foto");
  document.getElementById("galeria-tipo-video")?.classList.toggle("active", tipo === "video");
  document.getElementById("galeria-foto-input").style.display  = tipo === "foto"  ? "" : "none";
  document.getElementById("galeria-video-input").style.display = tipo === "video" ? "" : "none";
};

// ── PARALLAX ──────────────────────────────────────────────────
let mouseX = 0.5, mouseY = 0.5, targetX = 0.5, targetY = 0.5;
document.addEventListener("mousemove", (e) => {
  targetX = e.clientX / window.innerWidth;
  targetY = e.clientY / window.innerHeight;
}, { passive: true });

function tickParallax() {
  mouseX += (targetX - mouseX) * 0.035;
  mouseY += (targetY - mouseY) * 0.035;
  const onHome = document.getElementById("home")?.classList.contains("active");
  if (onHome) {
    const img = document.getElementById("hero-img");
    if (img) img.style.transform = `scale(1.06) translate(${(mouseX-0.5)*-22}px,${(mouseY-0.5)*-14}px)`;
  } else {
    const bg = document.querySelector(".bg-gradient");
    if (bg) {
      const bx=(50+(mouseX-0.5)*12).toFixed(2), by=(20+(mouseY-0.5)*8).toFixed(2);
      bg.style.background = `
        radial-gradient(ellipse 55% 40% at ${bx}% ${by}%,color-mix(in srgb,var(--accent) 6%,transparent) 0%,transparent 65%),
        radial-gradient(ellipse 35% 25% at ${100-bx}% ${100-by}%,color-mix(in srgb,var(--accent) 3%,transparent) 0%,transparent 55%)`;
    }
  }
  requestAnimationFrame(tickParallax);
}
requestAnimationFrame(tickParallax);

// ── REALTIME ──────────────────────────────────────────────────
window.initRealtime = function() {
  db.channel("galeria-rt").on("postgres_changes",
    { event:"INSERT", schema:"public", table:"galeria" },
    () => { if (currentPage === "galeria") cargarGaleria(); }
  ).subscribe();

  db.channel("beats-rt").on("postgres_changes",
    { event:"INSERT", schema:"public", table:"beats" },
    () => {
      if (currentPage === "beats") cargarBeats("beats-list", false);
      if (currentPage === "home")  cargarBeats("home-beats", false, 3);
    }
  ).subscribe();

  db.channel("posts-rt").on("postgres_changes",
    { event:"*", schema:"public", table:"posts" },
    () => { if (currentPage === "foro") mostrarIndicadorNuevoPost(); }
  ).subscribe();

  db.channel("coms-rt").on("postgres_changes",
    { event:"*", schema:"public", table:"comentarios" },
    (payload) => {
      if (currentPage !== "foro") return;
      const postId = payload.new?.post_id || payload.old?.post_id;
      if (!postId) return;
      // Actualizar contador en el feed card
      actualizarContadorComentarios(postId);
      // Si la sección está abierta, recargar comentarios
      const cont = document.getElementById("feed-coms-" + postId);
      if (cont?.classList.contains("open")) recargarComentarios(postId, cont);
    }
  ).subscribe();

  // Reproducciones en tiempo real
  db.channel("plays-rt").on("postgres_changes",
    { event:"INSERT", schema:"public", table:"reproducciones" },
    (payload) => {
      const beatId = payload.new?.beat_id;
      if (!beatId) return;
      actualizarPlays(beatId);
    }
  ).subscribe();

  if (currentUser) {
    db.channel(`notif-rt-${currentUser.id}`).on("postgres_changes",
      { event:"INSERT", schema:"public", table:"notificaciones",
        filter:`usuario_id=eq.${currentUser.id}` },
      () => {
        const badge = document.getElementById("notif-badge");
        if (badge) badge.style.display = "block";
        cargarNotificaciones();
      }
    ).subscribe();
  }
};

window.initPresencia = function() {
  if (!db || onlineChannel) return;
  const userId = currentUser?.id || ("anon-" + Math.random().toString(36).slice(2,8));
  onlineChannel = db.channel("online-users", { config: { presence: { key: userId } } });
  onlineChannel
    .on("presence", { event:"sync" }, () => {
      const count = Object.keys(onlineChannel.presenceState()).length;
      const el = document.getElementById("online-count");
      if (el) { el.textContent = count; el.closest("#online-dot") && (el.closest("#online-dot").style.display = "flex"); }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await onlineChannel.track({ at: new Date().toISOString() });
    });
};

// ── HELPERS FORO ──────────────────────────────────────────────

window.mostrarIndicadorNuevoPost = function() {
  if (document.getElementById("new-posts-bar")) return;
  const bar = document.createElement("div");
  bar.id = "new-posts-bar";
  bar.innerHTML = `<i class="fa-solid fa-arrow-up"></i> hay posts nuevos`;
  bar.style.cssText = `
    position:fixed;top:calc(var(--nav-h) + 12px);left:50%;transform:translateX(-50%);
    z-index:400;background:var(--accent);color:#0a0b09;
    padding:9px 22px;border-radius:100px;font-size:12px;font-weight:600;
    cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap;
    box-shadow:0 4px 20px color-mix(in srgb,var(--accent) 35%,transparent);
    animation:slideDown 0.3s ease;
  `;
  bar.onclick = () => { bar.remove(); renderForo(); };
  document.body.appendChild(bar);
  setTimeout(() => bar?.remove(), 8000);
};

async function recargarComentarios(postId, cont) {
  if (!cont) return;
  cont.classList.remove("open");
  cont.innerHTML = "";
  await window.toggleComentarios(parseInt(postId));
}

// Actualiza el contador de comentarios en el feed card sin recargar todo
async function actualizarContadorComentarios(postId) {
  try {
    const { count } = await db.from("comentarios")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    const btn = document.querySelector(`#feed-card-${postId} .feed-action[onclick*="toggleComentarios"]`);
    if (!btn) return;
    const oldN = parseInt(btn.textContent.match(/\d+/)?.[0] || "0");
    const newN = count || 0;
    if (oldN !== newN) {
      btn.innerHTML = `<i class="fa-regular fa-comment"></i> <span class="com-count-num">${newN}</span>`;
      const numEl = btn.querySelector(".com-count-num");
      if (numEl) animarNumero(numEl);
    }
  } catch(e) {}
}

// Actualiza el contador de plays de un beat visible
async function actualizarPlays(beatId) {
  try {
    // En el detalle overlay si está abierto
    const detailEl = document.getElementById(`detail-plays-${beatId}`);
    if (detailEl) {
      const { count } = await db.from("reproducciones")
        .select("id", { count: "exact", head: true }).eq("beat_id", beatId);
      detailEl.innerHTML = `<i class="fa-solid fa-play" style="font-size:8px"></i> ${count || 0} plays`;
    }
  } catch(e) {}
}

// Animación tipo YouTube al cambiar número
window.animarNumero = function(el) {
  if (!el) return;
  el.classList.remove("num-pop");
  void el.offsetWidth;
  el.classList.add("num-pop");
};

window.animarLike = function(el) {
  if (!el) return;
  el.classList.remove("like-pop");
  void el.offsetWidth;
  el.classList.add("like-pop");
};

// ── LANZAMIENTOS ──────────────────────────────────────────────
window.cargarLanzamientos = async function() {
  const grid = document.getElementById("lanz-grid");
  if (!grid) return;
  grid.innerHTML = `<p class="loading-msg">cargando discografía</p>`;
 
  try {
    const ARTIST_ID = "1871334573";
    const url = `https://itunes.apple.com/lookup?id=${ARTIST_ID}&entity=album&limit=50&country=ES`;
    const res  = await fetch(url);
    const json = await res.json();
 
    const releases = (json.results || [])
      .filter(r => r.wrapperType === "collection" || r.collectionType)
      .sort((a, b) => new Date(b.releaseDate||0) - new Date(a.releaseDate||0));
 
    if (!releases.length) {
      grid.innerHTML = `<p class="loading-msg no-spin" style="grid-column:1/-1">aún no hay lanzamientos.</p>`;
      return;
    }
 
    grid.innerHTML = "";
    releases.forEach(album => {
      const year   = album.releaseDate ? new Date(album.releaseDate).getFullYear() : "";
      const tipo   = album.collectionType === "Album" ? "Álbum" : "Single";
      const cover  = (album.artworkUrl100 || "").replace("100x100bb", "600x600bb");
      const titulo = album.collectionName || "—";
      const appleLink    = album.collectionViewUrl || "#";
      const spotifySearch = `https://open.spotify.com/search/${encodeURIComponent(titulo + " mitø")}`;
      const youtubeSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(titulo + " mitø")}`;
 
      const card = document.createElement("div");
      card.className = "lanz-card";
      card.innerHTML = `
        <div class="lanz-cover">
          ${cover
            ? `<img src="${esc(cover)}" alt="${esc(titulo)}" loading="lazy">`
            : `<div class="lanz-cover-ph"><i class="fa-solid fa-record-vinyl"></i></div>`}
          <div class="lanz-hover-overlay">
            <i class="fa-solid fa-play lanz-play-icon"></i>
          </div>
        </div>
        <div class="lanz-info">
          <div class="lanz-titulo">${esc(titulo)}</div>
          <div class="lanz-meta">
            <span class="lanz-tipo">${tipo}</span>
            ${year ? `<span class="lanz-fecha">${year}</span>` : ""}
          </div>
        </div>`;
 
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        abrirLanzamientoModal(titulo, cover, appleLink, spotifySearch, youtubeSearch);
      });
      grid.appendChild(card);
    });
 
  } catch(e) {
    console.warn("iTunes error:", e);
    grid.innerHTML = `<p class="loading-msg no-spin">error al cargar — <button class="link-btn" onclick="cargarLanzamientos()">reintentar</button></p>`;
  }
};
 
window.abrirLanzamientoModal = function(titulo, cover, appleLink, spotifyLink, youtubeLink) {
  // Elimina modal anterior si existe
  document.getElementById("lanz-modal")?.remove();
 
  const modal = document.createElement("div");
  modal.id = "lanz-modal";
  modal.style.cssText = `
    position:fixed;inset:0;z-index:8500;
    background:rgba(0,0,0,0.85);backdrop-filter:blur(20px);
    display:flex;justify-content:center;align-items:center;padding:20px;
    animation:fadeIn 0.2s ease;
  `;
  modal.innerHTML = `
    <div style="
      background:var(--bg2);border:1px solid var(--border);border-radius:24px;
      padding:28px;max-width:340px;width:100%;display:flex;flex-direction:column;
      gap:20px;position:relative;
    ">
      <button onclick="document.getElementById('lanz-modal').remove()" style="
        position:absolute;top:14px;right:16px;background:none;border:none;
        color:var(--text-dim);font-size:16px;cursor:pointer;
      ">✕</button>
 
      <div style="display:flex;gap:16px;align-items:center">
        ${cover ? `<img src="${esc(cover)}" style="width:72px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0">` : ""}
        <div>
          <div style="font-family:'Instrument Serif',serif;font-style:italic;font-size:18px;color:var(--text);line-height:1.2">${esc(titulo)}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:4px;font-family:'JetBrains Mono',monospace">mitø</div>
        </div>
      </div>
 
      <div style="display:flex;flex-direction:column;gap:8px">
        <a href="${esc(spotifyLink)}" target="_blank" style="
          display:flex;align-items:center;gap:12px;padding:13px 18px;
          background:#1DB954;color:#fff;border-radius:12px;
          text-decoration:none;font-size:13px;font-weight:600;transition:opacity 0.2s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          <i class="fa-brands fa-spotify" style="font-size:18px"></i>
          escuchar en Spotify
        </a>
        <a href="${esc(youtubeLink)}" target="_blank" style="
          display:flex;align-items:center;gap:12px;padding:13px 18px;
          background:#FF0000;color:#fff;border-radius:12px;
          text-decoration:none;font-size:13px;font-weight:600;transition:opacity 0.2s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          <i class="fa-brands fa-youtube" style="font-size:18px"></i>
          buscar en YouTube
        </a>
        <a href="${esc(appleLink)}" target="_blank" style="
          display:flex;align-items:center;gap:12px;padding:13px 18px;
          background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:12px;
          text-decoration:none;font-size:13px;font-weight:500;transition:all 0.2s;
        " onmouseover="this.style.background='var(--surface-h)'" onmouseout="this.style.background='var(--surface)'">
          <i class="fa-brands fa-apple" style="font-size:18px"></i>
          Apple Music
        </a>
      </div>
    </div>`;
 
  // Cierra al click fuera
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
 
  document.body.appendChild(modal);
  window.sfx?.click();
};

window.borrarLanzamiento = async function(id, btn) {
  if (!confirm("¿borrar este lanzamiento?")) return;
  btn.disabled = true;
  await db.from("lanzamientos").delete().eq("id", id);
  btn.closest(".solicitud-card").remove();
};

// ── POLLING ───────────────────────────────────────────────────
var _foroLatestId  = 0;
var _notifLatestId = 0;

function initPolling() {
  // Nuevos posts cada 5s
  setInterval(async () => {
    if (currentPage !== "foro" || !db) return;
    try {
      const { data } = await db.from("posts").select("id").order("id",{ascending:false}).limit(1);
      const id = data?.[0]?.id || 0;
      if (_foroLatestId === 0) { _foroLatestId = id; return; }
      if (id > _foroLatestId)  { _foroLatestId = id; mostrarIndicadorNuevoPost(); }
    } catch(e) {}
  }, 5000);

  // Comentarios abiertos cada 5s
  setInterval(async () => {
    if (currentPage !== "foro" || !db) return;
    try {
      const openSections = document.querySelectorAll(".feed-coms.open");
      for (const cont of openSections) {
        const postId = cont.id.replace("feed-coms-","");
        const { data } = await db.from("comentarios")
          .select("id").eq("post_id", parseInt(postId))
          .order("id",{ascending:false}).limit(1);
        const latestId = data?.[0]?.id || 0;
        const stored   = parseInt(cont.dataset.latestComId || "0");
        if (stored === 0) { cont.dataset.latestComId = latestId; continue; }
        if (latestId > stored) {
          cont.dataset.latestComId = latestId;
          actualizarContadorComentarios(parseInt(postId));
          await recargarComentarios(postId, cont);
        }
      }
    } catch(e) {}
  }, 5000);

  // Likes cada 8s
  setInterval(async () => {
    if (currentPage !== "foro" || !db) return;
    try {
      const btns = document.querySelectorAll(".like-btn[id^='like-post-']");
      if (!btns.length) return;
      const ids = Array.from(btns).map(b => parseInt(b.id.replace("like-post-","")));
      const { data } = await db.from("likes").select("post_id").in("post_id", ids);
      if (!data) return;
      ids.forEach(id => {
        const btn = document.getElementById(`like-post-${id}`);
        const cnt = btn?.querySelector(".like-count");
        if (!cnt) return;
        const count    = data.filter(l => l.post_id === id).length;
        const oldCount = parseInt(cnt.textContent || "0");
        if (count !== oldCount) {
          cnt.textContent = count;
          if (count > oldCount) animarLike(cnt);
        }
      });
    } catch(e) {}
  }, 8000);

  // Notificaciones cada 8s
  if (currentUser) {
    setInterval(async () => {
      if (!db || !currentUser) return;
      try {
        const { data } = await db.from("notificaciones")
          .select("id").eq("usuario_id", currentUser.id)
          .order("id",{ascending:false}).limit(1);
        const id = data?.[0]?.id || 0;
        if (_notifLatestId === 0) { _notifLatestId = id; return; }
        if (id > _notifLatestId) {
          _notifLatestId = id;
          const badge = document.getElementById("notif-badge");
          if (badge) badge.style.display = "block";
        }
      } catch(e) {}
    }, 8000);
  }
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async function() {
  await initSession();
  cargarBeats("home-beats", false, 3);
  const homeBtn = document.querySelector('.nav-link[onclick*="home"]');
  if (homeBtn) homeBtn.classList.add("active");
  setTimeout(() => { if (!ambientTracks.length) cargarAmbientTracks(); }, 800);
  setTimeout(() => { initRealtime(); initDMRealtime(); initPresencia(); initPolling(); }, 1500);
});
