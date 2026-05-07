// =============================================
//   mitø — SOUNDS & ANIMATIONS
// =============================================

(function() {

  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // ── GENERADOR BASE ────────────────────────────

  function tone({ freq = 440, freq2 = null, type = "sine", gain = 0.04,
                  attack = 0.004, decay = 0.08, duration = 0.1 } = {}) {
    try {
      const c = getCtx(); const now = c.currentTime;
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
      const c = getCtx(); const now = c.currentTime;
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

    // Tecla — mecánico agudo estilo Opera GX
    key() {
      try {
        const c = getCtx(); const now = c.currentTime;

        // Capa 1: impacto agudo (el "click" del switch)
        const buf1 = c.createBuffer(1, Math.floor(c.sampleRate * 0.012), c.sampleRate);
        const d1 = buf1.getChannelData(0);
        for (let i = 0; i < d1.length; i++) d1[i] = (Math.random()*2-1) * Math.pow(1 - i/d1.length, 3);
        const src1 = c.createBufferSource(); src1.buffer = buf1;
        const f1 = c.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = 4000;
        const g1 = c.createGain(); g1.gain.setValueAtTime(0.18, now); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
        src1.connect(f1); f1.connect(g1); g1.connect(c.destination); src1.start(now);

        // Capa 2: tono medio (resonancia de la carcasa)
        const osc = c.createOscillator(); const g2 = c.createGain();
        osc.type = "square"; osc.frequency.setValueAtTime(3200, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.018);
        g2.gain.setValueAtTime(0.06, now); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
        const f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 2500; f2.Q.value = 1.2;
        osc.connect(f2); f2.connect(g2); g2.connect(c.destination); osc.start(now); osc.stop(now + 0.025);

        // Capa 3: rebote grave muy sutil (el "thock")
        const osc2 = c.createOscillator(); const g3 = c.createGain();
        osc2.type = "triangle"; osc2.frequency.setValueAtTime(220, now + 0.005); osc2.frequency.exponentialRampToValueAtTime(80, now + 0.035);
        g3.gain.setValueAtTime(0, now); g3.gain.linearRampToValueAtTime(0.045, now + 0.006);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc2.connect(g3); g3.connect(c.destination); osc2.start(now + 0.004); osc2.stop(now + 0.045);

      } catch(e) {}
    },

    // Tecla especial — más grave y con más cuerpo
    keySpecial() {
      try {
        const c = getCtx(); const now = c.currentTime;

        // Impacto
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.018), c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2.5);
        const src = c.createBufferSource(); src.buffer = buf;
        const f1 = c.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = 2500;
        const g1 = c.createGain(); g1.gain.setValueAtTime(0.22, now); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
        src.connect(f1); f1.connect(g1); g1.connect(c.destination); src.start(now);

        // Tono más grave
        const osc = c.createOscillator(); const g2 = c.createGain();
        osc.type = "square"; osc.frequency.setValueAtTime(1800, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
        g2.gain.setValueAtTime(0.08, now); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = 1800;
        osc.connect(f2); f2.connect(g2); g2.connect(c.destination); osc.start(now); osc.stop(now + 0.04);

        // Thock más pronunciado
        const osc2 = c.createOscillator(); const g3 = c.createGain();
        osc2.type = "triangle"; osc2.frequency.setValueAtTime(160, now + 0.006); osc2.frequency.exponentialRampToValueAtTime(55, now + 0.055);
        g3.gain.setValueAtTime(0, now); g3.gain.linearRampToValueAtTime(0.07, now + 0.008);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc2.connect(g3); g3.connect(c.destination); osc2.start(now + 0.005); osc2.stop(now + 0.065);

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
      // Pequeña variación de pitch para que no suene robótico
      try {
        const c = getCtx(); const now = c.currentTime;
        const pitchVar = (Math.random() - 0.5) * 600;
        const gainVar  = 0.85 + Math.random() * 0.3;

        const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.011), c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 3);
        const src = c.createBufferSource(); src.buffer = buf;
        const f1 = c.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = 3800 + pitchVar;
        const g1 = c.createGain(); g1.gain.setValueAtTime(0.16 * gainVar, now); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.011);
        src.connect(f1); f1.connect(g1); g1.connect(c.destination); src.start(now);

        const osc = c.createOscillator(); const g2 = c.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(3000 + pitchVar, now);
        osc.frequency.exponentialRampToValueAtTime(700 + pitchVar * 0.3, now + 0.016);
        g2.gain.setValueAtTime(0.055 * gainVar, now); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        const f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 2400; f2.Q.value = 1;
        osc.connect(f2); f2.connect(g2); g2.connect(c.destination); osc.start(now); osc.stop(now + 0.022);

        const osc2 = c.createOscillator(); const g3 = c.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(200 + Math.random()*40, now + 0.004);
        osc2.frequency.exponentialRampToValueAtTime(70, now + 0.032);
        g3.gain.setValueAtTime(0, now); g3.gain.linearRampToValueAtTime(0.038 * gainVar, now + 0.005);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc2.connect(g3); g3.connect(c.destination); osc2.start(now + 0.003); osc2.stop(now + 0.038);
      } catch(e2) {}
    }
  }, { passive: true });

  document.addEventListener("keyup", (e) => {
    teclasCuerpo.delete(e.code);
  }, { passive: true });

  // ── CURSOR ────────────────────────────────────

  function initCursor() {
    if ("ontouchstart" in window) return;
    const dot = document.createElement("div");
    dot.id = "custom-cursor";
    dot.style.cssText = `position:fixed;pointer-events:none;z-index:99999;
      width:6px;height:6px;border-radius:50%;
      background:rgba(240,192,64,0.9);
      transform:translate(-50%,-50%);
      transition:width 0.15s,height 0.15s,opacity 0.2s;
      mix-blend-mode:screen;box-shadow:0 0 8px rgba(240,192,64,0.5);`;
    const ring = document.createElement("div");
    ring.id = "cursor-ring";
    ring.style.cssText = `position:fixed;pointer-events:none;z-index:99998;
      width:24px;height:24px;border-radius:50%;
      border:1px solid rgba(240,192,64,0.3);
      transform:translate(-50%,-50%);
      transition:left 0.1s ease-out,top 0.1s ease-out,width 0.18s,height 0.18s,border-color 0.18s;`;
    document.body.append(dot, ring);

    document.addEventListener("mousemove", (e) => {
      dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px";
      ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
    }, { passive: true });

    document.addEventListener("mouseover", (e) => {
      if (e.target.closest("button,a,.beat-card,.galeria-item,.post-card,.categoria-card,.nav-logo,[onclick]")) {
        dot.style.width = "10px"; dot.style.height = "10px";
        ring.style.width = "36px"; ring.style.height = "36px";
        ring.style.borderColor = "rgba(240,192,64,0.55)";
      }
    }, { passive: true });

    document.addEventListener("mouseout", (e) => {
      if (e.target.closest("button,a,.beat-card,.galeria-item,.post-card,.categoria-card,.nav-logo,[onclick]")) {
        dot.style.width = "6px"; dot.style.height = "6px";
        ring.style.width = "24px"; ring.style.height = "24px";
        ring.style.borderColor = "rgba(240,192,64,0.3)";
      }
    }, { passive: true });

    document.addEventListener("mousedown", () => { dot.style.transform = "translate(-50%,-50%) scale(0.6)"; }, { passive: true });
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
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType!==1) return;
        const cls = ["beat-card","galeria-item","banda-card","post-card","solicitud-card"];
        [node,...node.querySelectorAll(cls.map(c=>"."+c).join(","))].forEach((card,i) => {
          if (!card.classList || !cls.some(c=>card.classList.contains(c))) return;
          card.style.cssText += ";opacity:0;transform:translateY(14px);transition:opacity 0.38s ease "+((i*0.055).toFixed(2))+"s,transform 0.38s ease "+((i*0.055).toFixed(2))+"s";
          observer.observe(card);
        });
      }));
    }).observe(document.getElementById("app")||document.body, { childList:true, subtree:true });
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
  style.textContent = `
    @keyframes rippleAnim { to { transform:scale(55); opacity:0; } }
    @media (hover:hover) { * { cursor:none !important; } }
  `;
  document.head.appendChild(style);

  // ── INIT ─────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    initCursor();
    initCardAnimations();
    initGlitch();
    setTimeout(initParticles, 150);
  });

})();
