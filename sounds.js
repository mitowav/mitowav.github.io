// =============================================
//   mitø — SOUNDS & ANIMATIONS
// =============================================

(function() {

  let ctx = null;
  let userInteracted = false;

  // Chrome no permite AudioContext hasta que el usuario interactúa
  // Esperamos al primer click/touch para crearlo
  function unlockAudio() {
    if (userInteracted) return;
    userInteracted = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  document.addEventListener("click",     unlockAudio, { once: false, passive: true });
  document.addEventListener("touchstart", unlockAudio, { once: false, passive: true });
  document.addEventListener("keydown",    unlockAudio, { once: false, passive: true });

  function getCtx() {
    if (!userInteracted) return null; // aún no hay gesto — ignoramos
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // ── GENERADOR BASE ────────────────────────────

  function tone({ freq = 440, freq2 = null, type = "sine", gain = 0.04,
                  attack = 0.004, decay = 0.08, duration = 0.1 } = {}) {
    try {
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const g   = c.createGain();
      const f   = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 2400; f.Q.value = 0.5;
      osc.connect(f); f.connect(g); g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, now + duration * 0.8);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
      osc.start(now); osc.stop(now + duration + 0.05);
    } catch(e) {}
  }

  function noise({ gain = 0.02, duration = 0.04, freq = 1000, q = 2 } = {}) {
    try {
      const c = getCtx(); if (!c) return;
      const now = c.currentTime;
      const size = Math.floor(c.sampleRate * duration);
      const buf  = c.createBuffer(1, size, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(now);
    } catch(e) {}
  }

  // ── SONIDOS — MÁS SUTILES ────────────────────

  const sounds = {

    // Hover — casi imperceptible, solo un toque de aire
    hover() {
      tone({ freq: 900, freq2: 1000, type: "sine", gain: 0.018, attack: 0.003, decay: 0.035, duration: 0.05 });
    },

    // Click — mecánico suave, como un switch low-profile
    click() {
      noise({ gain: 0.025, duration: 0.018, freq: 1800, q: 3 });
      tone({ freq: 600, freq2: 400, type: "triangle", gain: 0.035, attack: 0.001, decay: 0.04, duration: 0.055 });
    },

    // Tecla — click seco y corto, nada de laser
    key() {
      try {
        const c = getCtx(); if (!c) return;
        const now = c.currentTime;
        // Solo ruido muy corto filtrado — como un teclado de membrana bueno
        const size = Math.floor(c.sampleRate * 0.008);
        const buf  = c.createBuffer(1, size, c.sampleRate);
        const d    = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = (Math.random()*2-1) * (1 - i/size);
        const src = c.createBufferSource(); src.buffer = buf;
        const f1  = c.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 1200; f1.Q.value = 0.8;
        const f2  = c.createBiquadFilter(); f2.type = "highshelf"; f2.frequency.value = 3000; f2.gain.value = 6;
        const g   = c.createGain(); g.gain.setValueAtTime(0.09, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
        src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(c.destination);
        src.start(now);
      } catch(e) {}
    },

    // Tecla especial (enter, backspace) — igual pero ligeramente más fuerte
    keySpecial() {
      try {
        const c = getCtx(); if (!c) return;
        const now = c.currentTime;
        const size = Math.floor(c.sampleRate * 0.012);
        const buf  = c.createBuffer(1, size, c.sampleRate);
        const d    = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = (Math.random()*2-1) * (1 - i/size);
        const src = c.createBufferSource(); src.buffer = buf;
        const f1  = c.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 900; f1.Q.value = 0.7;
        const f2  = c.createBiquadFilter(); f2.type = "highshelf"; f2.frequency.value = 2500; f2.gain.value = 5;
        const g   = c.createGain(); g.gain.setValueAtTime(0.13, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
        src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(c.destination);
        src.start(now);
      } catch(e) {}
    },

    // Nav — transición sutil, casi inaudible
    nav() {
      tone({ freq: 350, freq2: 500, type: "sine", gain: 0.03, attack: 0.008, decay: 0.09, duration: 0.12 });
    },

    // Play
    play() {
      tone({ freq: 100, freq2: 75, type: "triangle", gain: 0.08, attack: 0.004, decay: 0.1, duration: 0.14 });
      setTimeout(() => tone({ freq: 320, type: "sine", gain: 0.03, attack: 0.002, decay: 0.06, duration: 0.08 }), 25);
    },

    // Pause
    pause() {
      tone({ freq: 380, freq2: 260, type: "triangle", gain: 0.05, attack: 0.002, decay: 0.07, duration: 0.1 });
    },

    // Éxito — suave y corto
    success() {
      [0, 70, 130].forEach((delay, i) => {
        const freqs = [440, 554, 659];
        setTimeout(() => tone({ freq: freqs[i], type: "sine", gain: 0.045, attack: 0.004, decay: 0.14, duration: 0.2 }), delay);
      });
    },

    // Error
    error() {
      tone({ freq: 280, freq2: 180, type: "triangle", gain: 0.04, attack: 0.002, decay: 0.1, duration: 0.14 });
    },

    // Upload
    upload() {
      [0, 70, 140].forEach((delay, i) => {
        setTimeout(() => tone({ freq: [350, 500, 700][i], type: "sine", gain: 0.04, attack: 0.004, decay: 0.08, duration: 0.12 }), delay);
      });
    },

    // Login
    login() {
      tone({ freq: 370, freq2: 740, type: "sine", gain: 0.05, attack: 0.008, decay: 0.15, duration: 0.22 });
      setTimeout(() => tone({ freq: 555, type: "sine", gain: 0.03, attack: 0.004, decay: 0.1, duration: 0.15 }), 120);
    },

    // Borrar
    delete() {
      noise({ gain: 0.035, duration: 0.05, freq: 250, q: 1.5 });
      tone({ freq: 160, freq2: 90, type: "triangle", gain: 0.05, attack: 0.002, decay: 0.08, duration: 0.12 });
    }
  };

  window.sfx = sounds;

  // ── HOVER ─────────────────────────────────────

  let lastHover = 0;
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("button, .nav-btn, .beat-card, .categoria-card, .post-card, .galeria-item, .banda-card, .nav-logo, .link-btn, .vis-btn, .auth-tab");
    if (!el || el.classList.contains("play-btn") || el.classList.contains("delete-btn")) return;
    const now = Date.now();
    if (now - lastHover < 80) return;
    lastHover = now;
    sounds.hover();
  }, { passive: true });

  // ── CLICK ─────────────────────────────────────

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, .nav-btn, .nav-logo, .link-btn, .vis-btn, .auth-tab, .categoria-card");
    if (!el) return;
    if (el.classList.contains("play-btn")) return;
    if (el.classList.contains("delete-btn")) { sounds.delete(); return; }
    sounds.click();
  }, { passive: true });

  // ── TECLADO ESTILO OPERA GX ───────────────────

  const teclasCuerpo = new Set();

  document.addEventListener("keydown", (e) => {
    // Solo en inputs y textareas
    const active = document.activeElement;
    const esInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (!esInput) return;

    // Evita repetición si la tecla se mantiene pulsada
    if (teclasCuerpo.has(e.code)) return;
    teclasCuerpo.add(e.code);

    if (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete" || e.key === "Tab") {
      sounds.keySpecial();
    } else if (e.key.length === 1 || e.key === " ") {
      sounds.key();
    }
  }, { passive: true });

  document.addEventListener("keyup", (e) => {
    teclasCuerpo.delete(e.code);
  }, { passive: true });

  // ── CURSOR ────────────────────────────────────

  function initCursor() {
    if ("ontouchstart" in window) return;
    const dot  = document.getElementById("mito-cursor");
    const ring = document.getElementById("mito-cursor-ring");
    if (!dot || !ring) return;

    let mx = 0, my = 0;
    document.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left  = mx + "px"; dot.style.top  = my + "px";
      ring.style.left = mx + "px"; ring.style.top = my + "px";
    }, { passive: true });

    document.addEventListener("mouseover", (e) => {
      if (e.target.closest("button,a,.beat-card,.galeria-item,.post-card,.categoria-card,.side-logo,.side-btn,[onclick]")) {
        document.body.classList.add("cursor-hover");
      }
    }, { passive: true });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest("button,a,.beat-card,.galeria-item,.post-card,.categoria-card,.side-logo,.side-btn,[onclick]")) {
        document.body.classList.remove("cursor-hover");
      }
    }, { passive: true });
    document.addEventListener("mousedown", () => { dot.style.transform = "translate(-50%,-50%) scale(0.5)"; }, { passive: true });
    document.addEventListener("mouseup",   () => { dot.style.transform = "translate(-50%,-50%) scale(1)"; },   { passive: true });
  }

  // ── RIPPLE ────────────────────────────────────

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-primary, .vis-btn, .nav-btn, .auth-tab");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement("span");
    r.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.18);
      width:4px;height:4px;pointer-events:none;
      left:${e.clientX-rect.left-2}px;top:${e.clientY-rect.top-2}px;
      transform:scale(0);animation:rippleAnim 0.45s ease-out forwards;`;
    if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(r);
    setTimeout(() => r.remove(), 460);
  }, { passive: true });

  // ── PARTÍCULAS ────────────────────────────────

  function initParticles() {
    const hero = document.getElementById("home");
    if (!hero) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;opacity:0.3;";
    hero.querySelector(".hero-img-wrap")?.insertAdjacentElement("afterend", canvas);
    const resize = () => { canvas.width = hero.offsetWidth; canvas.height = hero.offsetHeight; };
    resize(); window.addEventListener("resize", resize, { passive: true });
    const c2 = canvas.getContext("2d");
    const pts = Array.from({length:35}, () => ({
      x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      r: Math.random()*1.2+0.3, vx:(Math.random()-0.5)*0.25,
      vy:-Math.random()*0.35-0.08, life:Math.random()
    }));
    function tick() {
      c2.clearRect(0,0,canvas.width,canvas.height);
      pts.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.life+=0.0025;
        if (p.y<-4||p.life>1) { p.x=Math.random()*canvas.width; p.y=canvas.height+4; p.life=0; }
        const a = 0.5 * Math.sin(p.life*Math.PI);
        c2.beginPath(); c2.arc(p.x,p.y,p.r,0,Math.PI*2);
        c2.fillStyle=`rgba(240,192,64,${a})`; c2.fill();
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ── GLITCH LOGO ───────────────────────────────

  function initGlitch() {
    const logo = document.querySelector(".nav-logo");
    if (!logo) return;
    function glitch() {
      logo.style.textShadow = `${(Math.random()*3-1.5).toFixed(1)}px 0 rgba(240,192,64,0.7),${(Math.random()*-3).toFixed(1)}px 0 rgba(80,40,160,0.5)`;
      logo.style.letterSpacing = (Math.random()*3+1)+"px";
      setTimeout(() => { logo.style.textShadow=""; logo.style.letterSpacing="2px"; }, 70);
    }
    logo.addEventListener("mouseenter", () => { glitch(); setTimeout(glitch,90); setTimeout(glitch,170); });
    setInterval(() => { if(Math.random()>0.5) glitch(); }, 9000+Math.random()*6000);
  }

  // ── ANIMACIÓN CARDS ───────────────────────────

  function initCardAnimations() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.style.opacity="1"; e.target.style.transform="translateY(0)"; observer.unobserve(e.target); }
      });
    }, { threshold: 0.08 });

    new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          try {
            if (!node || node.nodeType !== 1 || !node.classList) return;
            const cls = ["beat-card","galeria-item","banda-card","post-card","solicitud-card","feed-card"];
            const targets = [];
            if (cls.some(c => node.classList.contains(c))) targets.push(node);
            try { targets.push(...node.querySelectorAll(cls.map(c=>"."+c).join(","))); } catch(e) {}
            targets.forEach((card, i) => {
              if (!card || !card.classList) return;
              card.style.opacity = "0";
              card.style.transform = "translateY(14px)";
              card.style.transition = `opacity 0.38s ease ${(i*0.055).toFixed(2)}s, transform 0.38s ease ${(i*0.055).toFixed(2)}s`;
              observer.observe(card);
            });
          } catch(e) {}
        });
      });
    }).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  }

  // ── PLAY BUTTON SOUND ─────────────────────────

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".play-btn");
    if (!btn) return;
    const card = btn.closest(".beat-card");
    card?.classList.contains("is-playing") ? sounds.pause() : sounds.play();
  }, { passive: true });

  // ── CSS GLOBAL ────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `@keyframes rippleAnim { to { transform:scale(55); opacity:0; } }`;
  document.head.appendChild(style);

  // ── INIT ─────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    initCursor();
    initCardAnimations();
    initGlitch();
    setTimeout(initParticles, 150);
  });

})();
