/* ================================================================
   mitø · admin.js — zona privada, banda, solicitudes, galería admin, DMs
   ================================================================ */

(function() {

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
          ${m.avatar_url?`<img src="${m.avatar_url}" class="banda-avatar" alt="">`: `<div class="banda-avatar-ph">${ini}</div>`}
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
      <div style="max-width:580px">
        <div class="perf-header">
          ${p.avatar_url?`<img src="${p.avatar_url}" class="perf-avatar" alt="">`:`<div class="perf-avatar-ph">${ini}</div>`}
          <div class="perfil-info">
            <div class="perf-name">${esc(p.display_name||p.username)}</div>
            <div class="perf-rol">${esc(p.rol)}${p.instrumento?" · "+esc(p.instrumento):""}</div>
            ${p.bio?`<p style="font-size:12px;color:var(--text-dim);margin-top:8px;line-height:1.6">${esc(p.bio)}</p>`:""}
          </div>
        </div>
        <div class="card">
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
        <div class="card" style="margin-top:0">
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
      <button onclick="cerrarMiembro()" class="back-btn" style="margin-bottom:24px">
        <i class="fa-solid fa-arrow-left"></i> volver
      </button>
      <div class="miembro-layout">
        <div>
          ${m.avatar_url
            ? `<img src="${m.avatar_url}" class="miembro-av-big" alt="">`
            : `<div class="miembro-av-ph">${ini}</div>`}
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

})();
