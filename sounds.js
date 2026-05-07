// =============================================
//   mitø — SOUNDS & ANIMATIONS
// =============================================

(function() {

  // ── AUDIO CONTEXT ────────────────────────────
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // ── GENERADOR DE SONIDOS ──────────────────────

  function playTone({ freq = 440, freq2 = null, type = "sine", gain = 0.08, attack = 0.005, decay = 0.08, duration = 0.12 } = {}) {
    try {
      const c = getCtx();
      const now = c.currentTime;

      const osc = c.createOscillator();
      const gainNode = c.createGain();
      const filter = c.createBiquadFilter();

      filter.type = "lowpass";
      filter.frequency.value = 3000;

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(c.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, now + duration);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gain, now + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch(e) {}
  }

  function playNoise({ gain = 0.04, duration = 0.06, freq = 800 } = {}) {
    try {
      const c = getCtx();
      const now = c.currentTime;
      const bufferSize = c.sampleRate * duration;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const source = c.createBufferSource();
      source.buffer = buffer;

      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = 1.5;

      const gainNode = c.createGain();
      gainNode.gain.setValueAtTime(gain, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(c.destination);
      source.start(now);
    } catch(e) {}
  }

  // ── SONIDOS ESPECÍFICOS ───────────────────────

  const sounds = {
    // Hover suave — tick cristalino
    hover() {
      playTone({ freq: 1200, freq2: 1400, type: "sine", gain: 0.04, attack: 0.003, decay: 0.04, duration: 0.06 });
    },

    // Click satisfactorio — doble pulso
    click() {
      playTone({ freq: 800, freq2: 600, type: "triangle", gain: 0.1, attack: 0.002, decay: 0.06, duration: 0.08 });
      setTimeout(() => playTone({ freq: 1000, type: "sine", gain: 0.06, attack: 0.001, decay: 0.04, duration: 0.05 }), 40);
    },

    // Navegación — swoosh suave
    nav() {
      playTone({ freq: 300, freq2: 600, type: "sine", gain: 0.07, attack: 0.01, decay: 0.12, duration: 0.18 });
      playNoise({ gain: 0.025, duration: 0.08, freq: 2000 });
    },

    // Play beat — pulso grave satisfactorio
    play() {
      playTone({ freq: 120, freq2: 80, type: "triangle", gain: 0.15, attack: 0.005, decay: 0.15, duration: 0.2 });
      setTimeout(() => playTone({ freq: 400, type: "sine", gain: 0.06, attack: 0.003, decay: 0.08, duration: 0.1 }), 30);
    },

    // Pause
    pause() {
      playTone({ freq: 500, freq2: 300, type: "triangle", gain: 0.08, attack: 0.003, decay: 0.1, duration: 0.14 });
    },

    // Éxito — acorde ascendente
    success() {
      [0, 60, 120].forEach((delay, i) => {
        const freqs = [523, 659, 784];
        setTimeout(() => playTone({ freq: freqs[i], type: "sine", gain: 0.08, attack: 0.005, decay: 0.2, duration: 0.3 }), delay);
      });
    },

    // Error — tono descendente
    error() {
      playTone({ freq: 400, freq2: 200, type: "sawtooth", gain: 0.06, attack: 0.003, decay: 0.15, duration: 0.2 });
    },

    // Upload / subida
    upload() {
      [0, 80, 160].forEach((delay, i) => {
        const freqs = [400, 600, 900];
        setTimeout(() => playTone({ freq: freqs[i], type: "sine", gain: 0.07, attack: 0.005, decay: 0.1, duration: 0.15 }), delay);
      });
    },

    // Login / acceso
    login() {
      playTone({ freq: 440, freq2: 880, type: "sine", gain: 0.09, attack: 0.01, decay: 0.2, duration: 0.3 });
      setTimeout(() => playTone({ freq: 660, type: "sine", gain: 0.05, attack: 0.005, decay: 0.15, duration: 0.2 }), 150);
    },

    // Borrar
    delete() {
      playNoise({ gain: 0.06, duration: 0.08, freq: 300 });
      playTone({ freq: 200, freq2: 100, type: "triangle", gain: 0.08, attack: 0.003, decay: 0.12, duration: 0.16 });
    }
  };

  window.sfx = sounds;

  // ── HOVER EN BOTONES ──────────────────────────

  let lastHover = 0;
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("button, .nav-btn, .corner, .beat-card, .categoria-card, .post-card, .galeria-item, .banda-card, .nav-logo, .link-btn, .vis-btn, .auth-tab");
    if (!el) return;
    const now = Date.now();
    if (now - lastHover < 60) return; // evita spam
    lastHover = now;
    // No hover en play-btn ni delete (tienen su propio sonido)
    if (el.classList.contains("play-btn") || el.classList.contains("delete-btn")) return;
    sounds.hover();
  }, { passive: true });

  // ── CLICK EN BOTONES ──────────────────────────

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, .nav-btn, .nav-logo, .link-btn, .vis-btn, .auth-tab, .categoria-card");
    if (!el) return;
    if (el.classList.contains("play-btn")) return; // tiene su propio sonido
    if (el.classList.contains("delete-btn")) { sounds.delete(); return; }
    sounds.click();
  }, { passive: true });

  // ── ANIMACIONES DE PÁGINA ─────────────────────

  // Intercepta go() para añadir sonido de nav
  const _originalGo = window.go;
  if (_originalGo) {
    window.go = function(id, btnEl, closeMenu) {
      sounds.nav();
      _originalGo(id, btnEl, closeMenu);
    };
  } else {
    // go() aún no está definido, lo envolvemos cuando esté listo
    document.addEventListener("DOMContentLoaded", () => {
      const orig = window.go;
      if (orig) {
        window.go = function(id, btnEl, closeMenu) {
          sounds.nav(); orig(id, btnEl, closeMenu);
        };
      }
    });
  }

  // ── ANIMACIÓN PARTÍCULAS EN HOME ──────────────

  function crearParticulas() {
    const home = document.getElementById("home");
    if (!home) return;
    const canvas = document.createElement("canvas");
    canvas.id = "particles-canvas";
    canvas.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;opacity:0.35;";
    home.querySelector(".hero-img-wrap")?.after(canvas) || home.prepend(canvas);

    const resize = () => { canvas.width = home.offsetWidth; canvas.height = home.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const ctx2 = canvas.getContext("2d");
    const particles = Array.from({length: 40}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.6 + 0.2,
      life: Math.random()
    }));

    function tick() {
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life += 0.003;
        if (p.y < -5 || p.life > 1) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 5;
          p.life = 0;
          p.alpha = Math.random() * 0.5 + 0.2;
        }
        const a = p.alpha * Math.sin(p.life * Math.PI);
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2.fillStyle = `rgba(240, 192, 64, ${a})`;
        ctx2.fill();
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ── CURSOR PERSONALIZADO ──────────────────────

  function initCursor() {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    cursor.style.cssText = `
      position: fixed; pointer-events: none; z-index: 99999;
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(240, 192, 64, 0.9);
      transform: translate(-50%, -50%);
      transition: transform 0.1s, width 0.2s, height 0.2s, opacity 0.2s;
      mix-blend-mode: screen;
      box-shadow: 0 0 10px rgba(240,192,64,0.6);
    `;
    const ring = document.createElement("div");
    ring.id = "cursor-ring";
    ring.style.cssText = `
      position: fixed; pointer-events: none; z-index: 99998;
      width: 28px; height: 28px; border-radius: 50%;
      border: 1px solid rgba(240, 192, 64, 0.35);
      transform: translate(-50%, -50%);
      transition: left 0.12s ease-out, top 0.12s ease-out, width 0.2s, height 0.2s, opacity 0.2s;
    `;
    document.body.append(cursor, ring);

    let mx = 0, my = 0;
    document.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      cursor.style.left = mx + "px"; cursor.style.top = my + "px";
      ring.style.left = mx + "px"; ring.style.top = my + "px";
    }, { passive: true });

    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("button, a, .beat-card, .galeria-item, .post-card, .categoria-card, .nav-logo, [onclick]");
      if (el) {
        cursor.style.width = "12px"; cursor.style.height = "12px";
        ring.style.width = "40px"; ring.style.height = "40px";
        ring.style.borderColor = "rgba(240,192,64,0.6)";
      }
    }, { passive: true });

    document.addEventListener("mouseout", (e) => {
      const el = e.target.closest("button, a, .beat-card, .galeria-item, .post-card, .categoria-card, .nav-logo, [onclick]");
      if (el) {
        cursor.style.width = "8px"; cursor.style.height = "8px";
        ring.style.width = "28px"; ring.style.height = "28px";
        ring.style.borderColor = "rgba(240,192,64,0.35)";
      }
    }, { passive: true });

    document.addEventListener("mousedown", () => {
      cursor.style.transform = "translate(-50%, -50%) scale(0.7)";
      ring.style.transform = "translate(-50%, -50%) scale(0.85)";
    }, { passive: true });
    document.addEventListener("mouseup", () => {
      cursor.style.transform = "translate(-50%, -50%) scale(1)";
      ring.style.transform = "translate(-50%, -50%) scale(1)";
    }, { passive: true });

    // Oculta en móvil
    if ("ontouchstart" in window) {
      cursor.style.display = "none"; ring.style.display = "none";
    }
  }

  // ── ANIMACIÓN ENTRADA CARDS ───────────────────

  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    // Observa cards nuevas añadidas al DOM
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const cards = [node, ...node.querySelectorAll(".beat-card, .galeria-item, .banda-card, .post-card, .solicitud-card")];
        cards.forEach((card, i) => {
          if (!card.classList) return;
          if (!["beat-card","galeria-item","banda-card","post-card","solicitud-card"].some(c => card.classList.contains(c))) return;
          card.style.opacity = "0";
          card.style.transform = "translateY(16px)";
          card.style.transition = `opacity 0.4s ease ${i * 0.06}s, transform 0.4s ease ${i * 0.06}s`;
          observer.observe(card);
        });
      }));
    });

    mutationObserver.observe(document.getElementById("app"), { childList: true, subtree: true });
  }

  // ── GLITCH EN EL LOGO ─────────────────────────

  function initLogoGlitch() {
    const logo = document.querySelector(".nav-logo");
    if (!logo) return;
    const original = logo.innerHTML;

    function glitch() {
      const chars = "MIT0MITØMIT∅";
      logo.style.textShadow = `${Math.random()*4-2}px 0 rgba(240,192,64,0.8), ${Math.random()*-4}px 0 rgba(100,50,200,0.6)`;
      logo.style.letterSpacing = (Math.random() * 4) + "px";
      setTimeout(() => {
        logo.style.textShadow = "";
        logo.style.letterSpacing = "2px";
      }, 80);
    }

    logo.addEventListener("mouseenter", () => {
      glitch();
      setTimeout(glitch, 100);
      setTimeout(glitch, 180);
    });

    // Glitch aleatorio cada 8-15 segundos
    setInterval(() => {
      if (Math.random() > 0.4) glitch();
    }, 8000 + Math.random() * 7000);
  }

  // ── RIPPLE EN BOTONES ─────────────────────────

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-primary, .vis-btn, .nav-btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.style.cssText = `
      position:absolute; border-radius:50%;
      background:rgba(255,255,255,0.25);
      width:4px; height:4px;
      left:${e.clientX - rect.left - 2}px;
      top:${e.clientY - rect.top - 2}px;
      transform:scale(0); pointer-events:none;
      animation:rippleAnim 0.5s ease-out forwards;
    `;
    if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }, { passive: true });

  // CSS del ripple
  const style = document.createElement("style");
  style.textContent = `
    @keyframes rippleAnim {
      to { transform: scale(60); opacity: 0; }
    }
    * { cursor: none !important; }
    @media (hover: none) { * { cursor: auto !important; } }
  `;
  document.head.appendChild(style);

  // ── INIT ─────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    initCursor();
    initScrollAnimations();
    initLogoGlitch();
    setTimeout(crearParticulas, 100);

    // Conecta sonidos a play buttons (delegación)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".play-btn");
      if (!btn) return;
      const card = btn.closest(".beat-card");
      if (card?.classList.contains("is-playing")) sounds.pause();
      else sounds.play();
    }, { passive: true });
  });

})();
