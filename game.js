(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const field = document.getElementById('playfield');
  const $ = (id) => document.getElementById(id);

  const ui = {
    score: $('score'),
    timer: $('timer'),
    misses: $('misses'),
    bar: $('timerBar'),
    best: $('bestScore'),
    overlay: $('overlay'),
    title: $('overlayTitle'),
    copy: $('overlayCopy'),
    kicker: $('overlayKicker'),
    icon: $('overlayIcon'),
    start: $('startBtn'),
    startText: $('startBtnText'),
    pause: $('pauseBtn'),
    restart: $('restartBtn'),
    sound: $('soundBtn'),
    soundIcon: $('soundIcon'),
    combo: $('comboPop'),
    hint: $('fieldHint'),
    tip: $('tipText')
  };

  const FRUITS = [
    { emoji: '🍉', color: '#ff5c6d', r: 26, points: 10, name: 'Watermelon' },
    { emoji: '🍊', color: '#ff9f38', r: 23, points: 10, name: 'Orange' },
    { emoji: '🍋', color: '#f7d736', r: 22, points: 10, name: 'Lemon' },
    { emoji: '🍐', color: '#aed943', r: 23, points: 12, name: 'Pear' },
    { emoji: '🍎', color: '#f04e54', r: 24, points: 10, name: 'Apple' },
    { emoji: '🥝', color: '#7ebc44', r: 22, points: 12, name: 'Kiwi' },
    { emoji: '🍇', color: '#9d7bec', r: 23, points: 15, name: 'Grapes' },
    { emoji: '🍓', color: '#fa5f7f', r: 21, points: 15, name: 'Strawberry' },
    { emoji: '🍍', color: '#f3c437', r: 26, points: 20, name: 'Pineapple' },
    { emoji: '🥥', color: '#d4b28c', r: 24, points: 15, name: 'Coconut' }
  ];

  const GRAVITY = 430; // px / s^2

  const state = {
    running: false,
    paused: false,
    over: false,
    score: 0,
    time: 60,
    misses: 0,
    best: 0,
    isNewBest: false,
    fruits: [],
    pendingSpawns: [],
    halves: [],
    particles: [],
    floaters: [],
    trail: [],
    currentStrokeId: 0,
    lastSpawn: 0,
    spawnEvery: 820,
    lastFrame: 0,
    elapsed: 0,
    combo: 0,
    lastSlice: 0,
    sound: true,
    audio: null,
    masterGain: null,
    pointerDown: false,
    lastPoint: null,
    comboTimer: null,
    animFrameId: null
  };

  // ---------------- High Score & Sound Storage ----------------
  try {
    const savedBest = localStorage.getItem('fruitFrenzyBest');
    state.best = savedBest !== null ? Math.max(0, Number(savedBest) || 0) : 0;
  } catch (_) {
    state.best = 0;
  }
  ui.best.textContent = state.best;

  try {
    const savedSound = localStorage.getItem('fruitFrenzySound');
    if (savedSound !== null) {
      state.sound = savedSound === 'true';
    }
  } catch (_) {
    state.sound = true;
  }

  function updateSoundButton() {
    ui.soundIcon.textContent = state.sound ? '🔊' : '🔇';
    ui.sound.setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
    ui.sound.setAttribute('title', state.sound ? 'Mute sound' : 'Unmute sound');
    if (state.masterGain && state.audio) {
      try {
        state.masterGain.gain.setValueAtTime(state.sound ? 1 : 0, state.audio.currentTime);
      } catch (_) {}
    }
  }
  updateSoundButton();

  // ---------------- Canvas Sizing ----------------
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    const rect = field.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resize());
    ro.observe(field);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  // ---------------- Audio Engine ----------------
  function initAudio() {
    if (!state.audio) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          state.audio = new AudioCtx();
          state.masterGain = state.audio.createGain();
          state.masterGain.gain.setValueAtTime(state.sound ? 1 : 0, state.audio.currentTime);
          state.masterGain.connect(state.audio.destination);
        }
      } catch (_) {
        state.audio = null;
      }
    }
    if (state.audio && state.audio.state === 'suspended') {
      state.audio.resume().catch(() => {});
    }
    return state.audio;
  }

  function playTone(freq, duration = 0.08, type = 'sine', volume = 0.05, targetFreq = null) {
    if (!state.sound) return;
    const ac = initAudio();
    if (!ac || !state.masterGain) return;
    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      if (targetFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, targetFreq), now + duration);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(state.masterGain);
      osc.start(now);
      osc.stop(now + duration);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };
    } catch (_) {}
  }

  function playSliceSound(comboCount) {
    if (!state.sound) return;
    const baseFreq = 780 + Math.min(comboCount, 8) * 75;
    playTone(baseFreq, 0.07, 'triangle', 0.06, baseFreq * 0.35);
  }

  function playComboSound(comboCount) {
    if (!state.sound || comboCount < 2) return;
    const ac = initAudio();
    if (!ac || !state.masterGain) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      const pitchIndex = Math.min(comboCount - 2, notes.length - 1);
      const noteFreq = notes[pitchIndex];
      const now = ac.currentTime + 0.03;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(noteFreq, now);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(state.masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };
    } catch (_) {}
  }

  function playMissSound() {
    playTone(180, 0.14, 'sawtooth', 0.035, 55);
  }

  function playStartSound() {
    playTone(440, 0.09, 'sine', 0.05);
    setTimeout(() => playTone(880, 0.14, 'sine', 0.06), 90);
  }

  function playGameOverSound(isNewBest) {
    if (!state.sound) return;
    if (isNewBest) {
      const fanfare = [523.25, 659.25, 783.99, 1046.5];
      fanfare.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.18, 'triangle', 0.06), i * 110);
      });
    } else {
      const sad = [440, 370, 311];
      sad.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.18, 'sine', 0.04), i * 130);
      });
    }
  }

  // ---------------- Math & Utility ----------------
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const scaleX = width / (r.width || 1);
    const scaleY = height / (r.height || 1);
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY
    };
  }

  // ---------------- HUD & UI ----------------
  function updateHud() {
    ui.score.textContent = String(state.score).padStart(3, '0');
    ui.timer.textContent = Math.ceil(state.time);
    ui.misses.innerHTML = `${state.misses}<span class="miss-limit"> / 3</span>`;
    const pct = clamp((state.time / 60) * 100, 0, 100);
    ui.bar.style.width = `${pct}%`;
    ui.bar.style.background = state.time < 15 ? '#ff765f' : '#b8d94f';
    ui.best.textContent = state.best;
  }

  function showOverlay(mode) {
    ui.overlay.classList.remove('hidden');
    if (mode === 'ready') {
      ui.icon.textContent = '🍉';
      ui.kicker.textContent = 'YOUR 60-SECOND CHALLENGE';
      ui.title.innerHTML = 'Ready to<br><em>go bananas?</em>';
      ui.copy.textContent = 'Swipe through the fruit. Build combos. Keep your eyes peeled for missed slices.';
      ui.startText.textContent = "LET'S PLAY";
      ui.start.disabled = false;
    } else if (mode === 'paused') {
      ui.icon.textContent = '⏸';
      ui.kicker.textContent = 'TAKE A BREATHER';
      ui.title.innerHTML = 'Game on<br><em>pause.</em>';
      ui.copy.textContent = 'Catch your breath. Your fruit will wait right here.';
      ui.startText.textContent = 'RESUME GAME';
      ui.start.disabled = false;
    } else {
      // Game over
      if (state.isNewBest && state.score > 0) {
        ui.icon.textContent = '🏆';
        ui.kicker.textContent = 'NEW PERSONAL BEST!';
        ui.title.innerHTML = 'Sensational<br><em>slicing!</em>';
        ui.copy.textContent = `Incredible run! You set a new personal record with ${state.score} points!`;
      } else if (state.misses >= 3) {
        ui.icon.textContent = '💫';
        ui.kicker.textContent = 'THREE MISSES!';
        ui.title.innerHTML = 'Round<br><em>over.</em>';
        ui.copy.textContent = `You scored ${state.score} points (Best: ${state.best}). Missed 3 fruits — sharpen your blade and try again!`;
      } else {
        ui.icon.textContent = '⏱';
        ui.kicker.textContent = "TIME'S UP!";
        ui.title.innerHTML = 'Great<br><em>effort.</em>';
        ui.copy.textContent = `Time expired! You scored ${state.score} points. Personal best is ${state.best}. Fancy another round?`;
      }
      ui.startText.textContent = 'PLAY AGAIN';
      ui.start.disabled = false;
    }
  }

  // ---------------- Spawning & Physics ----------------
  function spawnFruit() {
    if (width <= 0 || height <= 0) return;
    const f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const r = f.r * rand(0.92, 1.15);

    // Spawn below bottom border
    const y = height + r + 20;
    const x = rand(r + 20, width - r - 20);

    // Target apex in the upper third to middle of the playfield
    const targetY = rand(height * 0.16, height * 0.44);
    const riseDist = Math.max(80, y - targetY);

    // Ballistic kinematics: vy0 = -sqrt(2 * g * h)
    const vy = -Math.sqrt(2 * GRAVITY * riseDist);

    // Angle horizontal velocity toward the center
    let vx;
    if (x < width * 0.42) {
      vx = rand(35, 110);
    } else if (x > width * 0.58) {
      vx = rand(-110, -35);
    } else {
      vx = rand(-50, 50);
    }

    state.fruits.push({
      x,
      y,
      vx,
      vy,
      r,
      emoji: f.emoji,
      color: f.color,
      points: f.points,
      rot: rand(-0.4, 0.4),
      spin: rand(-2.5, 2.5),
      sliced: false,
      age: 0
    });
  }

  // ---------------- Visual Effects: Halves, Particles, Floaters ----------------
  function burst(x, y, color) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(65, 240);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: rand(0.35, 0.7),
        max: 0.7,
        size: rand(2.5, 5),
        color,
        angle: rand(0, Math.PI * 2)
      });
    }
  }

  function spawnFruitHalves(f, cutAngle) {
    // Normal vector perpendicular to the cut direction
    const nx = -Math.sin(cutAngle);
    const ny = Math.cos(cutAngle);
    const sepSpeed = 135;

    // Half 1
    state.halves.push({
      emoji: f.emoji,
      color: f.color,
      r: f.r,
      x: f.x,
      y: f.y,
      vx: f.vx + nx * sepSpeed,
      vy: f.vy + ny * sepSpeed - 30,
      rot: f.rot,
      spin: f.spin - 3.2,
      side: -1,
      cutAngle,
      life: 0.8,
      max: 0.8
    });

    // Half 2
    state.halves.push({
      emoji: f.emoji,
      color: f.color,
      r: f.r,
      x: f.x,
      y: f.y,
      vx: f.vx - nx * sepSpeed,
      vy: f.vy - ny * sepSpeed - 30,
      rot: f.rot,
      spin: f.spin + 3.2,
      side: 1,
      cutAngle,
      life: 0.8,
      max: 0.8
    });
  }

  function addFloater(x, y, text, color = '#ffffff') {
    state.floaters.push({
      x,
      y,
      text,
      color,
      life: 0.75,
      max: 0.75
    });
  }

  // ---------------- Slicing & Combo ----------------
  function sliceFruit(f, hitX = f.x, hitY = f.y, cutAngle = 0) {
    if (f.sliced) return;
    f.sliced = true;

    const now = performance.now();
    state.combo = now - state.lastSlice < 950 ? state.combo + 1 : 1;
    state.lastSlice = now;

    const comboBonus = state.combo >= 2 ? Math.min((state.combo - 1) * 5, 35) : 0;
    const pointsAwarded = f.points + comboBonus;
    state.score += pointsAwarded;

    // Audio
    playSliceSound(state.combo);
    if (state.combo >= 2) {
      playComboSound(state.combo);
    }

    // Visuals
    burst(hitX, hitY, f.color);
    spawnFruitHalves(f, cutAngle);

    const label = state.combo >= 2 ? `+${pointsAwarded} (${state.combo}×)` : `+${pointsAwarded}`;
    addFloater(hitX, hitY - 10, label, state.combo >= 2 ? '#d7f36a' : '#ffffff');

    if (state.combo >= 2) {
      ui.combo.textContent = `${state.combo}× COMBO  +${comboBonus}`;
      ui.combo.classList.add('show');
      if (state.comboTimer) clearTimeout(state.comboTimer);
      state.comboTimer = setTimeout(() => {
        ui.combo.classList.remove('show');
        state.comboTimer = null;
      }, 550);
    }

    updateHud();
  }

  function testSwipeCollision(a, b) {
    if (!state.running) return;
    const cutAngle = Math.atan2(b.y - a.y, b.x - a.x);
    for (const f of state.fruits) {
      if (!f.sliced) {
        const d = distToSegment(f.x, f.y, a.x, a.y, b.x, b.y);
        if (d < f.r + 14) {
          sliceFruit(f, f.x, f.y, cutAngle);
        }
      }
    }
  }

  // ---------------- Input Handlers ----------------
  function handlePointerDown(e) {
    if (!state.running) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

    state.pointerDown = true;
    state.currentStrokeId++;
    try {
      field.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const p = pointFromEvent(e);
    state.lastPoint = p;
    state.trail.push({
      x: p.x,
      y: p.y,
      life: 0.18,
      maxLife: 0.18,
      strokeId: state.currentStrokeId
    });

    // Tap-to-slice directly under the tap point
    for (const f of state.fruits) {
      if (!f.sliced && Math.hypot(f.x - p.x, f.y - p.y) < f.r + 14) {
        sliceFruit(f, p.x, p.y, -Math.PI / 4);
      }
    }

    if (e.cancelable) e.preventDefault();
  }

  function handlePointerMove(e) {
    if (!state.pointerDown || !state.running) return;
    const p = pointFromEvent(e);

    if (state.lastPoint) {
      const dist = Math.hypot(p.x - state.lastPoint.x, p.y - state.lastPoint.y);
      if (dist >= 2) {
        state.trail.push({
          x: p.x,
          y: p.y,
          life: 0.18,
          maxLife: 0.18,
          strokeId: state.currentStrokeId
        });
        testSwipeCollision(state.lastPoint, p);
        state.lastPoint = p;
      }
    } else {
      state.lastPoint = p;
    }

    if (e.cancelable) e.preventDefault();
  }

  function handlePointerEnd() {
    state.pointerDown = false;
    state.lastPoint = null;
  }

  field.addEventListener('pointerdown', handlePointerDown);
  field.addEventListener('pointermove', handlePointerMove);
  field.addEventListener('pointerup', handlePointerEnd);
  field.addEventListener('pointercancel', handlePointerEnd);
  field.addEventListener('lostpointercapture', handlePointerEnd);
  window.addEventListener('pointerup', handlePointerEnd);
  window.addEventListener('pointercancel', handlePointerEnd);
  field.addEventListener('contextmenu', (e) => e.preventDefault());

  // Prevent touch gesture scrolling inside game playfield
  field.addEventListener(
    'touchmove',
    (e) => {
      if (state.pointerDown && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );

  // ---------------- Game Lifecycle ----------------
  function reset() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    if (state.comboTimer) {
      clearTimeout(state.comboTimer);
      state.comboTimer = null;
    }

    state.running = false;
    state.paused = false;
    state.over = false;
    state.isNewBest = false;
    state.score = 0;
    state.time = 60;
    state.misses = 0;
    state.fruits = [];
    state.pendingSpawns = [];
    state.halves = [];
    state.particles = [];
    state.floaters = [];
    state.trail = [];
    state.elapsed = 0;
    state.lastSpawn = 0;
    state.spawnEvery = 820;
    state.combo = 0;
    state.lastSlice = 0;
    state.pointerDown = false;
    state.lastPoint = null;

    ui.combo.classList.remove('show');
    ui.pause.disabled = true;
    ui.pause.innerHTML = '<span>Ⅱ</span> PAUSE';
    ui.hint.style.opacity = '1';
    ui.tip.textContent = "Slice fruit for points. Three misses and it's game over!";

    updateHud();
    showOverlay('ready');
    draw();
  }

  function start() {
    initAudio();

    if (state.paused) {
      // Resume
      state.paused = false;
      state.running = true;
      state.lastFrame = performance.now();
      ui.overlay.classList.add('hidden');
      ui.pause.disabled = false;
      ui.pause.innerHTML = '<span>Ⅱ</span> PAUSE';
      ui.hint.style.opacity = '0';
      ui.tip.textContent = 'Keep slicing! Consecutive hits build your combo.';
      if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
      state.animFrameId = requestAnimationFrame(loop);
      return;
    }

    // New game or play again
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    if (state.comboTimer) {
      clearTimeout(state.comboTimer);
      state.comboTimer = null;
    }

    state.score = 0;
    state.time = 60;
    state.misses = 0;
    state.fruits = [];
    state.pendingSpawns = [];
    state.halves = [];
    state.particles = [];
    state.floaters = [];
    state.trail = [];
    state.elapsed = 0;
    state.lastSpawn = 0;
    state.spawnEvery = 820;
    state.combo = 0;
    state.lastSlice = 0;
    state.pointerDown = false;
    state.lastPoint = null;
    state.isNewBest = false;

    state.running = true;
    state.paused = false;
    state.over = false;
    state.lastFrame = performance.now();

    ui.combo.classList.remove('show');
    ui.overlay.classList.add('hidden');
    ui.pause.disabled = false;
    ui.pause.innerHTML = '<span>Ⅱ</span> PAUSE';
    ui.hint.style.opacity = '0';
    ui.tip.textContent = 'Keep slicing! Consecutive hits build your combo.';

    updateHud();
    playStartSound();

    state.animFrameId = requestAnimationFrame(loop);
  }

  function pause() {
    if (!state.running || state.paused) return;
    state.running = false;
    state.paused = true;
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    state.pointerDown = false;
    state.lastPoint = null;
    ui.pause.innerHTML = '<span>▶</span> RESUME';
    showOverlay('paused');
  }

  function endGame() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    state.running = false;
    state.paused = false;
    state.over = true;
    state.pointerDown = false;
    state.lastPoint = null;

    ui.pause.disabled = true;
    ui.pause.innerHTML = '<span>Ⅱ</span> PAUSE';

    state.isNewBest = state.score > state.best;
    if (state.isNewBest) {
      state.best = state.score;
      try {
        localStorage.setItem('fruitFrenzyBest', String(state.best));
      } catch (_) {}
    }

    updateHud();
    showOverlay('over');
    playGameOverSound(state.isNewBest);
  }

  // ---------------- UI Button Listeners ----------------
  ui.start.addEventListener('click', () => {
    if (state.paused) {
      start();
    } else {
      start();
    }
  });

  ui.pause.addEventListener('click', () => {
    if (state.running) {
      pause();
    } else if (state.paused) {
      start();
    }
  });

  ui.restart.addEventListener('click', reset);

  ui.sound.addEventListener('click', () => {
    initAudio();
    state.sound = !state.sound;
    try {
      localStorage.setItem('fruitFrenzySound', String(state.sound));
    } catch (_) {}
    updateSoundButton();
    if (state.sound) {
      playTone(660, 0.08, 'sine', 0.06);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      // Don't trigger if an interactive UI button is currently focused to avoid duplicate triggers
      if (document.activeElement === ui.start || document.activeElement === ui.pause || document.activeElement === ui.restart || document.activeElement === ui.sound) {
        return;
      }
      e.preventDefault();
      if (state.running) {
        pause();
      } else if (state.paused) {
        start();
      } else if (state.over || (!state.running && !state.paused)) {
        start();
      }
    }
  });

  // ---------------- Update & Render Loop ----------------
  function update(dt) {
    state.time = Math.max(0, state.time - dt);
    state.elapsed += dt;

    // Difficulty curve: gradually spawn faster down to 440ms
    state.spawnEvery = Math.max(440, 820 - state.elapsed * 4.5);
    state.lastSpawn += dt * 1000;

    if (state.lastSpawn >= state.spawnEvery) {
      spawnFruit();
      state.lastSpawn = 0;

      // Wave spawn chance: multi-fruit launches as game progresses
      const waveChance = clamp(0.18 + state.elapsed * 0.005, 0.18, 0.52);
      if (Math.random() < waveChance) {
        state.pendingSpawns.push(0.11);
      }
      if (state.elapsed > 25 && Math.random() < 0.22) {
        state.pendingSpawns.push(0.22);
      }
    }

    // Process queued wave spawns
    for (let i = state.pendingSpawns.length - 1; i >= 0; i--) {
      state.pendingSpawns[i] -= dt;
      if (state.pendingSpawns[i] <= 0) {
        spawnFruit();
        state.pendingSpawns.splice(i, 1);
      }
    }

    // Active fruits update
    for (let i = state.fruits.length - 1; i >= 0; i--) {
      const f = state.fruits[i];
      f.age += dt;
      f.vy += GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;

      // Fall below playfield
      if (f.y > height + f.r + 30) {
        if (!f.sliced && f.age > 0.45) {
          state.misses++;
          updateHud();
          playMissSound();
          if (state.misses >= 3) {
            endGame();
            return;
          }
        }
        state.fruits.splice(i, 1);
      } else if (f.sliced) {
        // Clean up sliced original fruits
        state.fruits.splice(i, 1);
      }
    }

    // Sliced fruit halves
    for (let i = state.halves.length - 1; i >= 0; i--) {
      const h = state.halves[i];
      h.life -= dt;
      h.vy += (GRAVITY + 90) * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      if (h.life <= 0 || h.y > height + 50) {
        state.halves.splice(i, 1);
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      p.vy += (GRAVITY + 40) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }

    // Floating text popups
    for (let i = state.floaters.length - 1; i >= 0; i--) {
      const fl = state.floaters[i];
      fl.life -= dt;
      fl.y -= 38 * dt;
      if (fl.life <= 0) {
        state.floaters.splice(i, 1);
      }
    }

    // Slicing trail
    for (let i = state.trail.length - 1; i >= 0; i--) {
      state.trail[i].life -= dt;
      if (state.trail[i].life <= 0) {
        state.trail.splice(i, 1);
      }
    }

    updateHud();

    if (state.time <= 0) {
      endGame();
    }
  }

  function draw() {
    if (width <= 0 || height <= 0) return;
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Active Fruits
    for (const f of state.fruits) {
      if (f.sliced) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);

      // Radial glow
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;

      ctx.font = `${Math.round(f.r * 2.15)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.emoji, 0, 1);
      ctx.restore();
    }

    // 2. Draw Sliced Halves
    for (const h of state.halves) {
      ctx.save();
      const alpha = clamp(h.life / h.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);

      ctx.beginPath();
      const sz = h.r * 1.8;
      if (h.side === -1) {
        // Left half
        ctx.rect(-sz, -sz, sz, sz * 2);
      } else {
        // Right half
        ctx.rect(0, -sz, sz, sz * 2);
      }
      ctx.clip();

      ctx.font = `${Math.round(h.r * 2.15)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.emoji, 0, 1);
      ctx.restore();
    }

    // 3. Draw Particles (Juice Splatters)
    for (const p of state.particles) {
      ctx.save();
      const alpha = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      const w = p.size * 2;
      const h = p.size;
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-p.size, -p.size / 2, w, h, 2);
      } else {
        ctx.rect(-p.size, -p.size / 2, w, h);
      }
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Blade Slicing Trail
    if (state.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < state.trail.length; i++) {
        const a = state.trail[i - 1];
        const b = state.trail[i];

        // Do not connect points from different strokes (prevents cross-screen laser line)
        if (a.strokeId !== b.strokeId) continue;

        const lifeFactor = clamp(Math.min(a.life, b.life) / 0.18, 0, 1);
        ctx.globalAlpha = lifeFactor * 0.9;
        ctx.strokeStyle = '#e2ff89';
        ctx.lineWidth = Math.max(1.5, 2 + 7 * (i / state.trail.length));
        ctx.shadowColor = '#d7f36a';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Draw Floating Text Popups
    for (const fl of state.floaters) {
      ctx.save();
      const alpha = clamp(fl.life / fl.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fl.color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 6;
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.restore();
    }
  }

  function loop(now) {
    if (!state.running) return;
    const dt = Math.min((now - state.lastFrame) / 1000, 0.035);
    state.lastFrame = now;

    update(dt);
    draw();

    if (state.running) {
      state.animFrameId = requestAnimationFrame(loop);
    }
  }

  // Initial setup
  reset();
})();
