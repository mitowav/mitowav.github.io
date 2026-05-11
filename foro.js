/* ================================================================
   mitø · foro.js — foro, comentarios, likes, notificaciones, letras
   ================================================================ */



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
        <h2 class="feed-title">foro</h2>
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
      <div>${avatar}</div>
      <div class="feed-body">
        <div class="feed-meta">
          <span class="feed-autor">${esc(autor)}</span>
          <span class="feed-fecha">${formatFecha(p.created_at)}</span>
          ${p.titulo && p.titulo !== "sin título" ? `<span class="feed-titulo-post">${esc(p.titulo)}</span>` : ""}
        </div>
        <div class="feed-text">${esc(p.contenido)}</div>
        ${imgHtml}
        <div class="feed-actions">
          <button class="feed-action like-btn" id="like-post-${p.id}" onclick="toggleLike('post',${p.id},this)">
            <i class="fa-regular fa-heart"></i> <span class="like-count">0</span>
          </button>
          <button class="feed-action" onclick="toggleComentarios(${p.id})">
            <i class="fa-regular fa-comment"></i> ${numComs}
          </button>
          ${currentUser?.id === p.autor_id || currentUser?.rol === "admin" ? `<button class="feed-action" onclick="eliminarPost(${p.id},this)" style="margin-left:auto"><i class="fa-solid fa-trash" style="font-size:10px"></i></button>` : ""}
        </div>
        <div class="feed-coms" id="feed-coms-${p.id}"></div>
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
    if (cont) { cont.classList.remove("open"); }
    await window.toggleComentarios(postId);
  }
};
window.toggleComentarios = async function(postId) {
  const cont = document.getElementById("feed-coms-" + postId);
  if (!cont) return;

  if (cont.classList.contains("open")) {
    cont.classList.remove("open");
    cont.innerHTML = "";
    return;
  }
  cont.classList.add("open");
  cont.innerHTML = "<p class='com-empty'>cargando...</p>";

  try {
    const { data: coms } = await db.from("comentarios")
      .select("*, usuarios(display_name, username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at");

    cont.innerHTML = "";

    // Render Twitter/TikTok style comments
    if (coms && coms.length > 0) {
      coms.forEach(c => {
        const ca  = (c.usuarios && (c.usuarios.display_name || c.usuarios.username)) || "anónimo";
        const av  = c.usuarios?.avatar_url;
        const ini = ca[0].toUpperCase();

        const row = document.createElement("div");
        row.className = "com-row";

        const avEl = document.createElement("div");
        avEl.className = "com-avatar";
        if (av) {
          avEl.innerHTML = `<img src="${av}" style="width:100%;height:100%;object-fit:cover">`;
        } else {
          avEl.textContent = ini;
        }

        const body = document.createElement("div");
        body.className = "com-body";

        const meta = document.createElement("div");
        meta.className = "com-meta";
        meta.innerHTML = `<span class="com-autor">${esc(ca)}</span><span class="com-fecha">${formatFecha(c.created_at)}</span>`;

        const texto = document.createElement("div");
        texto.className = "com-texto";
        texto.textContent = c.contenido;

        // Reply button
        const replyBtn = document.createElement("button");
        replyBtn.className = "com-reply-btn";
        replyBtn.innerHTML = `<i class="fa-solid fa-reply"></i> responder`;
        replyBtn.addEventListener("click", function() {
          // Insert reply form after this comment
          const existing = row.querySelector(".reply-form");
          if (existing) { existing.remove(); return; }
          const rf = crearComForm(postId, "@" + ca + " ");
          row.appendChild(rf);
          rf.querySelector("textarea").focus();
        });

        body.appendChild(meta);
        body.appendChild(texto);
        body.appendChild(replyBtn);
if (currentUser && (currentUser.id === c.autor_id || currentUser.rol === "admin")) {
  const delBtn = document.createElement("button");
  delBtn.className = "com-delete-btn";
  delBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
  delBtn.addEventListener("click", async function(e) {
    e.stopPropagation();
    if (!confirm("¿borrar comentario?")) return;
    await db.from("comentarios").delete().eq("id", c.id);
    row.style.opacity = "0";
    row.style.transition = "opacity 0.2s";
    setTimeout(() => { row.remove(); actualizarContadorComentarios(postId); }, 200);
    window.sfx?.delete();
  });
  body.appendChild(delBtn);
}
        row.appendChild(avEl);
        row.appendChild(body);
        cont.appendChild(row);
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "com-empty";
      empty.textContent = "sé el primero en comentar.";
      cont.appendChild(empty);
    }

    // Main comment form
    if (currentUser) {
      const mainForm = crearComForm(postId, "");
      cont.appendChild(mainForm);
    } else {
      const p = document.createElement("p");
      p.className = "com-empty";
      p.style.marginTop = "10px";
      const s = document.createElement("span");
      s.textContent = "inicia sesión";
      s.style.cssText = "color:var(--accent);cursor:pointer";
      s.onclick = () => go("auth");
      p.appendChild(s);
      p.appendChild(document.createTextNode(" para comentar"));
      cont.appendChild(p);
    }

  } catch(e) {
    cont.innerHTML = "<p class='com-empty'>error al cargar</p>";
    console.error(e);
  }
};

function crearComForm(postId, prefill) {
  const form = document.createElement("div");
  form.className = "com-form reply-form";

  const av = currentUser?.avatar_url;
  const ini = (currentUser?.display_name || currentUser?.username || "?")[0].toUpperCase();
  const avEl = document.createElement("div");
  avEl.className = "com-avatar";
  if (av) avEl.innerHTML = `<img src="${av}" style="width:100%;height:100%;object-fit:cover">`;
  else avEl.textContent = ini;

  const right = document.createElement("div");
  right.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:8px";

  const ta = document.createElement("textarea");
  ta.className = "com-input";
  ta.placeholder = "escribe un comentario...";
  ta.rows = 1;
  ta.value = prefill;
  ta.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.style.cssText = "font-size:10px;padding:7px 16px";
  btn.textContent = "publicar";

  const msgEl = document.createElement("p");
  msgEl.className = "auth-msg";

  btn.addEventListener("click", function() {
    window.enviarComentarioFeed(postId, ta, btn, msgEl);
  });
  ta.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); btn.click(); }
  });

  actions.appendChild(msgEl);
  actions.appendChild(btn);
  right.appendChild(ta);
  right.appendChild(actions);
  form.appendChild(avEl);
  form.appendChild(right);
  return form;
}

// toggleComentarios OK

window.enviarComentario = async function(postId) {
  const el  = document.getElementById(`com-${postId}`);
  const msg = document.getElementById(`com-msg-${postId}`);
  const texto = el?.value.trim();
  if (!texto) return;
  if (!currentUser) { if(msg){msg.textContent="Inicia sesión primero";msg.className="auth-msg error";} return; }
  if (msg) { msg.textContent="Enviando..."; msg.className="auth-msg"; }
  const { error } = await db.from("comentarios").insert([{ post_id: postId, autor_id: currentUser.id, contenido: texto }]);
  if (error) { if(msg){msg.textContent="Error: "+error.message;msg.className="auth-msg error";} }
  else { window.sfx?.success(); const c=document.getElementById('feed-coms-'+postId); if(c){c.classList.remove('open');c.innerHTML='';} await window.toggleComentarios(postId); }
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

