/* ================================================================
   mitø · beats.js — beats player, subida, filtros, galería, crop, mini player
   ================================================================ */

(function() {

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
    card.className = "beat-row";
    const bars = generateBars(beat, index);
    const inspsArr = beat.inspiraciones ? beat.inspiraciones.split(",").map(s=>s.trim()).filter(Boolean) : [];

    const allTags = [
      ...(beat.inspiraciones||"").split(",").map(s=>s.trim()).filter(Boolean).map(i=>`<span class="beat-tag">${esc(i)}</span>`),
      beat.genre ? `<span class="beat-tag">${esc(beat.genre)}</span>` : "",
      beat.tono  ? `<span class="beat-tag">${esc(beat.tono)}</span>`  : "",
    ].filter(Boolean).join("");

    card.innerHTML = `
      <div class="beat-num-col">
        <span class="beat-row-num">${String(index+1).padStart(2,"0")}</span>
        <button class="play-btn-inline"><i class="fa-solid fa-play"></i></button>
      </div>
      <div class="beat-cover-col">
        ${beat.cover_url
          ? `<img src="${beat.cover_url}" class="beat-row-cover-sm" alt="">`
          : `<div class="beat-row-cover-ph-sm"><i class="fa-solid fa-music"></i></div>`}
      </div>
      <div class="beat-row-main">
        <div class="beat-row-title">${esc(beat.title)}</div>
        <div class="beat-row-genre">${esc(beat.genre||"")}</div>
      </div>
      <div class="beat-row-time">—</div>
      <div class="beat-row-bpm">${beat.bpm||"—"}</div>
      <div class="beat-row-tags-col">${allTags}</div>
      <div class="beat-row-actions">
        ${beat.privado ? `<span class="beat-priv-tag"><i class="fa-solid fa-lock"></i></span>` : ""}
        ${admin ? `<button class="delete-btn"><i class="fa-solid fa-trash"></i></button>` : ""}
      </div>
      <div class="beat-viz-row" id="vizrow-${beat.id||index}" style="display:none">
        <canvas class="viz-canvas" id="viz-${beat.id||index}"></canvas>
        <div class="player-meta"><span class="time-cur">0:00</span> / <span class="time-tot">—</span></div>
      </div>`;

    card.addEventListener("click", e => {
      if (e.target.closest(".beat-num-col,.beat-row-actions")) return;
      abrirBeatDetalle(beat);
    });

    const playBtn = card.querySelector(".play-btn-inline");
    const canvas  = card.querySelector(".viz-canvas"); /* in viz-row */
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
        // Also update the time column
        const timeCol = card.querySelector(".beat-row-time");
        if (timeCol) timeCol.textContent = fmt(audio.duration);
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
          const apb = activeCard.querySelector(".play-btn-inline");
          if (apb) apb.innerHTML = `<i class="fa-solid fa-play"></i>`;
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
        const vr2 = document.getElementById("vizrow-" + (beat.id||index));
        if (vr2) vr2.style.display = "none";
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
        // Show viz row
        const vr = document.getElementById("vizrow-" + (beat.id||index));
        if (vr) vr.style.display = "flex";
        activeAudio = a; activeCard = card;
        cancelAnimationFrame(vizRaf);
        drawFreq();
        window.sfx?.play();
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
    cont.innerHTML = "";
    if (!data.length) { cont.innerHTML = `<p class="loading-msg no-spin">no hay beats que coincidan.</p>`; return; }
    // Header row
    const hdr = document.createElement("div");
    hdr.className = "beats-header";
    hdr.innerHTML = `<span>#</span><span></span><span>título</span><span>tiempo</span><span>bpm</span><span>tags</span><span></span>`;
    cont.appendChild(hdr);
    data.forEach((beat,i) => cont.appendChild(crearCard(beat,i,admin)));
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
        const icon = document.getElementById("mp-icon-wrap");
        if (tog)  tog.innerHTML  = '<i class="fa-solid fa-pause"></i>';
        if (icon) icon.innerHTML = '<i class="fa-solid fa-pause"></i>';
        // Actualiza el slider de volumen
        const slider = document.querySelector(".mp-slider");
        if (slider) slider.value = 0.05;
      }).catch(() => {
        // Navegador bloqueó el autoplay — espera primer gesto
        ambientPlaying = false;
        const tog  = document.getElementById("mp-toggle");
        const icon = document.getElementById("mp-icon-wrap");
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
      const _mpw = document.getElementById("mp-icon-wrap"); if(_mpw) _mpw.innerHTML = '<i class="fa-solid fa-music"></i>';
    } else {
      ambientAudio.play().catch(()=>{}); ambientPlaying = true;
      document.getElementById("mp-toggle").innerHTML = '<i class="fa-solid fa-pause"></i>';
      const _mpw2 = document.getElementById("mp-icon-wrap"); if(_mpw2) _mpw2.innerHTML = '<i class="fa-solid fa-pause"></i>';
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

})();
