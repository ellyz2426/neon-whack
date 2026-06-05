import {
  World, PanelUI, PanelDocument, UIKitDocument, Follower, FollowBehavior, ScreenSpace,
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry, PlaneGeometry,
  ConeGeometry, TorusGeometry, RingGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Quaternion, Euler,
  Fog, AmbientLight, PointLight, DirectionalLight, SpotLight,
  BufferGeometry, Float32BufferAttribute,
  EdgesGeometry, LineSegments, Line,
  AdditiveBlending, DoubleSide, FrontSide,
  InputComponent,
} from '@iwsdk/core';

// ─── Types & Constants ───────────────────────────────────────────

type GameState = 'title' | 'modeselect' | 'countdown' | 'playing' | 'pattern_show' |
  'pattern_input' | 'gameover' | 'pause' | 'achievements' | 'settings' | 'help' |
  'stats' | 'shop' | 'tutorial' | 'tournament_transition' | 'modifiers';

type GameMode = 'classic' | 'survival' | 'timeattack' | 'zen' | 'speed' | 'pattern' |
  'daily' | 'frenzy' | 'tournament';

interface TargetTypeDef {
  name: string; color: string; emissive: string; points: number;
  stayTime: number; hitsNeeded: number; edgeColor: string;
  isBomb?: boolean; isGhost?: boolean;
}

const TARGET_TYPES: TargetTypeDef[] = [
  { name: 'NORMAL', color: '#00ccff', emissive: '#004466', points: 100, stayTime: 2.0, hitsNeeded: 1, edgeColor: '#00eeff' },
  { name: 'BONUS', color: '#ffcc00', emissive: '#664400', points: 300, stayTime: 1.5, hitsNeeded: 1, edgeColor: '#ffee44' },
  { name: 'SPEED', color: '#44ff44', emissive: '#004400', points: 200, stayTime: 0.8, hitsNeeded: 1, edgeColor: '#66ff66' },
  { name: 'TANK', color: '#aa44ff', emissive: '#330066', points: 500, stayTime: 3.0, hitsNeeded: 2, edgeColor: '#cc66ff' },
  { name: 'BOMB', color: '#ff2200', emissive: '#660000', points: -200, stayTime: 2.5, hitsNeeded: 1, edgeColor: '#ff4433', isBomb: true },
  { name: 'GHOST', color: '#ffffff', emissive: '#333333', points: 400, stayTime: 1.0, hitsNeeded: 1, edgeColor: '#cccccc', isGhost: true },
  { name: 'KING', color: '#ffd700', emissive: '#886600', points: 1000, stayTime: 0.5, hitsNeeded: 1, edgeColor: '#ffee88' },
  { name: 'MYSTERY', color: '#ff44ff', emissive: '#440044', points: 0, stayTime: 1.5, hitsNeeded: 1, edgeColor: '#ff88ff' },
];

interface HoleDef { x: number; z: number; }

interface ActiveTarget {
  holeIdx: number; typeIdx: number; mesh: Mesh; cap: Mesh; glow: Mesh; edges: LineSegments;
  timeLeft: number; hitsLeft: number; rising: boolean; riseT: number;
  sinking: boolean; sinkT: number; alive: boolean; ghostPhase: number;
}

interface PowerUpState {
  type: 'timeslow' | 'sizeup' | 'scorex2' | 'magnet' | 'freeze';
  name: string; timeLeft: number;
}

interface Theme {
  name: string; ground: string; grid: string; accent: string;
  fog: string; sky: string; glow: string;
}

const THEMES: Theme[] = [
  { name: 'NEON GRID', ground: '#0a0a15', grid: '#ff4400', accent: '#ff6600', fog: '#0a0005', sky: '#050010', glow: '#ff3300' },
  { name: 'CRIMSON FORGE', ground: '#1a0808', grid: '#ff2200', accent: '#ff3300', fog: '#100005', sky: '#080002', glow: '#ff0000' },
  { name: 'CYAN CIRCUIT', ground: '#081118', grid: '#00aacc', accent: '#00ddff', fog: '#000510', sky: '#000208', glow: '#00aaff' },
  { name: 'GOLD NEXUS', ground: '#181408', grid: '#ccaa00', accent: '#ffcc00', fog: '#0a0800', sky: '#080500', glow: '#ffaa00' },
  { name: 'VOID MATRIX', ground: '#0a000a', grid: '#8800cc', accent: '#aa44ff', fog: '#050008', sky: '#020005', glow: '#9900ff' },
];

interface MalletSkin {
  name: string; color: string; emissive: string; unlockLevel: number; icon: string;
}

const MALLET_SKINS: MalletSkin[] = [
  { name: 'STANDARD', color: '#ff4400', emissive: '#661100', unlockLevel: 0, icon: '🔨' },
  { name: 'NEON BLUE', color: '#0088ff', emissive: '#003366', unlockLevel: 5, icon: '🔵' },
  { name: 'EMERALD', color: '#00ff44', emissive: '#006622', unlockLevel: 10, icon: '💚' },
  { name: 'GOLDEN', color: '#ffcc00', emissive: '#664400', unlockLevel: 18, icon: '⭐' },
  { name: 'VOID', color: '#aa00ff', emissive: '#440066', unlockLevel: 25, icon: '🟣' },
  { name: 'PLASMA', color: '#ff00aa', emissive: '#660044', unlockLevel: 32, icon: '💖' },
  { name: 'DIAMOND', color: '#88eeff', emissive: '#226688', unlockLevel: 40, icon: '💎' },
  { name: 'INFERNO', color: '#ff3300', emissive: '#881100', unlockLevel: 50, icon: '🔥' },
];

interface Achievement {
  id: string; name: string; desc: string; icon: string;
  check: () => boolean;
}

interface SaveData {
  xp: number; level: number; malletIdx: number; themeIdx: number;
  sfxVol: number; musicVol: number;
  totalGames: number; totalWhacks: number; totalMisses: number;
  bestCombo: number; totalTimePlayed: number;
  highScores: Record<string, number>;
  achievements: string[];
  tutorialDone: boolean;
  totalBombsHit: number; totalKingsHit: number; totalGhostsHit: number;
  totalMysteryHit: number; totalPowerUps: number; totalDailies: number;
  tournamentBest: number;
  bestStreak: number; perfectRounds: number;
  totalModifierGames: number;
}

// ─── Challenge Modifiers ────────────────────────────────────

interface Modifier {
  id: string; name: string; desc: string; icon: string;
  scoreMultiplier: number;
}

const MODIFIERS: Modifier[] = [
  { id: 'hardmode', name: 'HARD MODE', desc: 'Targets stay 40% less time', icon: '💀', scoreMultiplier: 1.5 },
  { id: 'tinyTargets', name: 'TINY TARGETS', desc: 'Targets are 60% smaller', icon: '🔬', scoreMultiplier: 1.75 },
  { id: 'nopower', name: 'NO POWER-UPS', desc: 'Power-ups disabled', icon: '🚫', scoreMultiplier: 1.25 },
  { id: 'bombRush', name: 'BOMB RUSH', desc: '3× more bombs spawn', icon: '💣', scoreMultiplier: 1.5 },
  { id: 'ghostMode', name: 'GHOST MODE', desc: 'All targets flicker like ghosts', icon: '👻', scoreMultiplier: 1.5 },
  { id: 'speedDemon', name: 'SPEED DEMON', desc: '2× spawn rate', icon: '⚡', scoreMultiplier: 1.25 },
];

// ─── Audio Engine ────────────────────────────────────────────────

class AudioEngine {
  private ctx: AudioContext | null = null;
  sfxVol = 1.0; musicVol = 0.8;
  private musicGain: GainNode | null = null;
  private musicPlaying = false;
  private arpInterval: ReturnType<typeof setInterval> | null = null;
  private kickInterval: ReturnType<typeof setInterval> | null = null;
  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  playWhack(pitch = 1.0) {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.4 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(200 * pitch, now);
    o.frequency.exponentialRampToValueAtTime(80 * pitch, now + 0.1);
    o.connect(g); o.start(now); o.stop(now + 0.15);
    const ng = c.createGain(); ng.gain.setValueAtTime(0.15 * this.sfxVol, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08); ng.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * 2;
    const ns = c.createBufferSource(); ns.buffer = buf; ns.connect(ng); ns.start(now); ns.stop(now + 0.08);
  }

  playPopUp() {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.2 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    o.connect(g); o.start(now); o.stop(now + 0.12);
  }

  playMiss() {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.25 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    o.connect(g); o.start(now); o.stop(now + 0.3);
  }

  playBomb() {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.35 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, now); o.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    o.connect(g); o.start(now); o.stop(now + 0.4);
    const ng = c.createGain(); ng.gain.setValueAtTime(0.2 * this.sfxVol, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25); ng.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
    const d2 = buf.getChannelData(0);
    for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() - 0.5) * 2;
    const ns = c.createBufferSource(); ns.buffer = buf; ns.connect(ng); ns.start(now); ns.stop(now + 0.25);
  }

  playCombo(level: number) {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.2 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'sine';
    const freq = 400 + Math.min(level, 10) * 60;
    o.frequency.setValueAtTime(freq, now); o.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.15);
    o.connect(g); o.start(now); o.stop(now + 0.2);
  }

  playAchievement() {
    const c = this.getCtx(), now = c.currentTime;
    [0, 0.1, 0.2].forEach((t, i) => {
      const g = c.createGain(); g.gain.setValueAtTime(0.2 * this.sfxVol, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.2); g.connect(c.destination);
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime([523, 659, 784][i], now + t);
      o.connect(g); o.start(now + t); o.stop(now + t + 0.2);
    });
  }

  playPowerUp() {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.25 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(900, now + 0.25);
    o.connect(g); o.start(now); o.stop(now + 0.3);
  }

  playCountdown() {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.3 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'square';
    o.frequency.value = 440; o.connect(g); o.start(now); o.stop(now + 0.15);
  }

  playGo() {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.35 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'square';
    o.frequency.value = 880; o.connect(g); o.start(now); o.stop(now + 0.3);
  }

  playPatternNote(idx: number) {
    const c = this.getCtx(), now = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.3 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25); g.connect(c.destination);
    const notes = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784];
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.value = notes[idx % notes.length]; o.connect(g); o.start(now); o.stop(now + 0.25);
  }

  playLevelUp() {
    const c = this.getCtx(), now = c.currentTime;
    [0, 0.08, 0.16, 0.24, 0.32].forEach((t, i) => {
      const g = c.createGain(); g.gain.setValueAtTime(0.2 * this.sfxVol, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.2); g.connect(c.destination);
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime([523, 659, 784, 1047, 1319][i], now + t);
      o.connect(g); o.start(now + t); o.stop(now + t + 0.2);
    });
  }

  playRoundComplete() {
    const c = this.getCtx(), now = c.currentTime;
    const fanfare = [392, 494, 523, 659, 784];
    fanfare.forEach((freq, i) => {
      const t = i * 0.12;
      const g = c.createGain(); g.gain.setValueAtTime(0.25 * this.sfxVol, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.3); g.connect(c.destination);
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.value = freq; o.connect(g); o.start(now + t); o.stop(now + t + 0.3);
    });
  }

  // ─── Procedural Arpeggiator Music ───────────────────────────

  startMusic() {
    if (this.musicPlaying) return;
    const c = this.getCtx();
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.06 * this.musicVol;
    this.musicGain.connect(c.destination);

    // Sub-bass drone
    this.bassGain = c.createGain();
    this.bassGain.gain.value = 0.04 * this.musicVol;
    this.bassGain.connect(c.destination);
    this.bassOsc = c.createOscillator();
    this.bassOsc.type = 'sine';
    this.bassOsc.frequency.value = 55;
    this.bassOsc.connect(this.bassGain);
    this.bassOsc.start();

    // Arpeggiator: cycle through a minor pentatonic scale
    const arpNotes = [110, 131, 147, 165, 196, 220, 262, 294, 330, 392];
    let arpIdx = 0;
    const bpm = 128;
    const sixteenth = 60000 / bpm / 4;

    this.arpInterval = setInterval(() => {
      const now2 = c.currentTime;
      const freq = arpNotes[arpIdx % arpNotes.length];
      arpIdx++;

      // Arpeggiated synth note
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.04 * this.musicVol, now2);
      ng.gain.exponentialRampToValueAtTime(0.001, now2 + sixteenth / 1000 * 0.8);
      ng.connect(c.destination);
      const no = c.createOscillator();
      no.type = 'sawtooth';
      no.frequency.value = freq;
      no.connect(ng);
      no.start(now2);
      no.stop(now2 + sixteenth / 1000);
    }, sixteenth);

    // Kick drum on every beat
    this.kickInterval = setInterval(() => {
      const now2 = c.currentTime;
      const kg = c.createGain();
      kg.gain.setValueAtTime(0.06 * this.musicVol, now2);
      kg.gain.exponentialRampToValueAtTime(0.001, now2 + 0.15);
      kg.connect(c.destination);
      const ko = c.createOscillator();
      ko.type = 'sine';
      ko.frequency.setValueAtTime(150, now2);
      ko.frequency.exponentialRampToValueAtTime(40, now2 + 0.1);
      ko.connect(kg);
      ko.start(now2);
      ko.stop(now2 + 0.15);
    }, 60000 / bpm);

    this.musicPlaying = true;
  }

  stopMusic() {
    if (this.arpInterval) { clearInterval(this.arpInterval); this.arpInterval = null; }
    if (this.kickInterval) { clearInterval(this.kickInterval); this.kickInterval = null; }
    try { this.bassOsc?.stop(); } catch {}
    this.bassOsc = null; this.bassGain = null;
    this.musicGain = null;
    this.musicPlaying = false;
  }

  updateMusicVolume() {
    if (this.musicGain) {
      const c = this.getCtx();
      this.musicGain.gain.setTargetAtTime(0.06 * this.musicVol, c.currentTime, 0.1);
    }
    if (this.bassGain) {
      const c = this.getCtx();
      this.bassGain.gain.setTargetAtTime(0.04 * this.musicVol, c.currentTime, 0.1);
    }
  }
}


// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const container = document.getElementById('app')! as HTMLDivElement;
  const world = await World.create(container, {
    features: { spatialUI: true, physics: false, grabbing: false, locomotion: false },
  });

  const audio = new AudioEngine();
  const scene = world.scene;

  // ─── Save/Load ───────────────────────────────────────────────

  const DEFAULT_SAVE: SaveData = {
    xp: 0, level: 1, malletIdx: 0, themeIdx: 0, sfxVol: 100, musicVol: 80,
    totalGames: 0, totalWhacks: 0, totalMisses: 0, bestCombo: 0, totalTimePlayed: 0,
    highScores: {}, achievements: [], tutorialDone: false,
    totalBombsHit: 0, totalKingsHit: 0, totalGhostsHit: 0,
    totalMysteryHit: 0, totalPowerUps: 0, totalDailies: 0, tournamentBest: 0,
    bestStreak: 0, perfectRounds: 0, totalModifierGames: 0,
  };

  function loadSave(): SaveData {
    try {
      const raw = localStorage.getItem('neon-whack-save');
      if (raw) return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_SAVE };
  }

  function writeSave(s: SaveData) {
    localStorage.setItem('neon-whack-save', JSON.stringify(s));
  }

  let save = loadSave();
  audio.sfxVol = save.sfxVol / 100;
  audio.musicVol = save.musicVol / 100;

  // ─── XP & Level ──────────────────────────────────────────────

  function xpForLevel(lvl: number): number { return 80 + lvl * 20; }

  function addXP(amount: number): number {
    save.xp += amount;
    let leveled = 0;
    while (save.xp >= xpForLevel(save.level) && save.level < 50) {
      save.xp -= xpForLevel(save.level); save.level++; leveled++;
    }
    writeSave(save);
    return leveled;
  }

  // ─── Game State ──────────────────────────────────────────────

  let state: GameState = 'title';
  let mode: GameMode = 'classic';
  let score = 0, combo = 0, bestCombo = 0, hits = 0, misses = 0;
  let gameTime = 0, timeLimit = 60, lives = 3;
  let difficultyLevel = 1;
  let spawnTimer = 0, spawnInterval = 1.5;
  let countdownVal = 3, countdownTimer = 0;
  let activeTargets: ActiveTarget[] = [];
  let activePowerUp: PowerUpState | null = null;
  let prevState: GameState = 'title';
  let achievePage = 0;
  let gameStartTime = 0;

  // Pattern mode
  let patternSequence: number[] = [];
  let patternInputIdx = 0;
  let patternShowIdx = 0;
  let patternShowTimer = 0;
  let patternRound = 0;

  // Tournament mode
  let tournamentRound = 0;
  let tournamentTotalScore = 0;
  const TOURNAMENT_ROUNDS = 5;
  const TOURNAMENT_DURATIONS = [30, 40, 50, 60, 75]; // escalating time per round
  let tournamentTransTimer = 0;

  // Camera shake
  let shakeIntensity = 0;
  let shakeTimer = 0;
  const baseCamPos = new Vector3(0, 1.7, 0);

  // Session trackers
  let sessionBombsHit = 0, sessionKingsHit = 0, sessionGhostsHit = 0;
  let sessionMysteryHit = 0, sessionPowerUps = 0;

  // Streak tracking (consecutive hits without a miss)
  let streak = 0, bestSessionStreak = 0;

  // Active modifiers
  let activeModifiers: Set<string> = new Set();
  function getModifierMultiplier(): number {
    let m = 1;
    activeModifiers.forEach(id => {
      const mod = MODIFIERS.find(x => x.id === id);
      if (mod) m *= mod.scoreMultiplier;
    });
    return m;
  }

  // Daily seed
  const today = new Date();
  const dailySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  let dailyRng = dailySeed;
  function nextDailyRng(): number {
    dailyRng = (dailyRng * 1103515245 + 12345) & 0x7fffffff;
    return (dailyRng / 0x7fffffff);
  }

  // ─── Hole Layout (3x4 grid) ─────────────────────────────────

  const HOLES: HoleDef[] = [];
  const COLS = 4, ROWS = 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      HOLES.push({ x: (c - (COLS - 1) / 2) * 0.8, z: -2.0 - r * 0.7 });
    }
  }

  // ─── Scene Setup ─────────────────────────────────────────────

  let currentTheme = THEMES[save.themeIdx];

  // Ground
  const groundMesh = new Mesh(
    new PlaneGeometry(40, 40),
    new MeshStandardMaterial({ color: new Color(currentTheme.ground), roughness: 0.9 })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  scene.add(groundMesh);

  // Grid lines
  const gridLines: Line[] = [];
  for (let i = -20; i <= 20; i++) {
    const mat = new LineBasicMaterial({ color: new Color(currentTheme.grid), transparent: true, opacity: 0.15 });
    const pts1 = [new Vector3(i, 0.005, -20), new Vector3(i, 0.005, 20)];
    const g1 = new BufferGeometry().setFromPoints(pts1);
    const l1 = new Line(g1, mat); scene.add(l1); gridLines.push(l1);
    const pts2 = [new Vector3(-20, 0.005, i), new Vector3(20, 0.005, i)];
    const g2 = new BufferGeometry().setFromPoints(pts2);
    const l2 = new Line(g2, mat); scene.add(l2); gridLines.push(l2);
  }

  // Lighting
  scene.add(new AmbientLight(new Color('#222233'), 0.4));
  const dirLight = new DirectionalLight(new Color('#ffffff'), 0.6);
  dirLight.position.set(5, 10, 5); scene.add(dirLight);
  const accentLight1 = new PointLight(new Color(currentTheme.accent), 1.5, 15);
  accentLight1.position.set(-3, 3, -2); scene.add(accentLight1);
  const accentLight2 = new PointLight(new Color(currentTheme.accent), 1.5, 15);
  accentLight2.position.set(3, 3, -3); scene.add(accentLight2);

  scene.background = new Color(currentTheme.sky);
  scene.fog = new Fog(new Color(currentTheme.fog), 1, 30);

  // Holodeck walls
  function createWall(w: number, h: number, px: number, py: number, pz: number, ry: number) {
    const wall = new Mesh(
      new PlaneGeometry(w, h),
      new MeshStandardMaterial({ color: new Color('#080818'), transparent: true, opacity: 0.4, side: DoubleSide })
    );
    wall.position.set(px, py, pz); wall.rotation.y = ry; scene.add(wall);
    const gridMat = new LineBasicMaterial({ color: new Color(currentTheme.grid), transparent: true, opacity: 0.08 });
    for (let i = 0; i <= h; i += 1) {
      const pts = [new Vector3(-w / 2, i - h / 2, 0.01), new Vector3(w / 2, i - h / 2, 0.01)];
      const g = new BufferGeometry().setFromPoints(pts);
      const l = new Line(g, gridMat); l.position.copy(wall.position); l.rotation.y = ry; scene.add(l);
    }
  }
  createWall(12, 6, 0, 3, -5, 0);
  createWall(12, 6, -6, 3, -2, Math.PI / 2);
  createWall(12, 6, 6, 3, -2, -Math.PI / 2);

  // ─── Arena Decorations ───────────────────────────────────

  // Corner pillars with glowing edges
  const pillarPositions = [
    [-5.5, 0, -4.5], [5.5, 0, -4.5], [-5.5, 0, 0.5], [5.5, 0, 0.5],
  ];
  const pillarMeshes: Mesh[] = [];
  pillarPositions.forEach(([px, _py, pz]) => {
    const pillar = new Mesh(
      new BoxGeometry(0.15, 5, 0.15),
      new MeshStandardMaterial({
        color: new Color('#111133'),
        emissive: new Color(currentTheme.glow),
        emissiveIntensity: 0.15,
      })
    );
    pillar.position.set(px, 2.5, pz);
    scene.add(pillar);
    pillarMeshes.push(pillar);

    // Glowing top cap
    const cap = new Mesh(
      new SphereGeometry(0.12, 8, 6),
      new MeshBasicMaterial({
        color: new Color(currentTheme.accent),
        transparent: true, opacity: 0.5, blending: AdditiveBlending,
      })
    );
    cap.position.set(px, 5.1, pz);
    scene.add(cap);
  });

  // Floating energy orbs that slowly orbit the arena
  interface EnergyOrb {
    mesh: Mesh; glow: Mesh; angle: number; radius: number; speed: number; height: number;
  }
  const energyOrbs: EnergyOrb[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const radius = 3.5 + Math.random() * 1.5;
    const height = 2.5 + Math.random() * 2;
    const orb = new Mesh(
      new SphereGeometry(0.06, 8, 6),
      new MeshBasicMaterial({
        color: new Color(currentTheme.accent),
        transparent: true, opacity: 0.7,
      })
    );
    orb.position.set(Math.cos(angle) * radius, height, -2 + Math.sin(angle) * radius);
    scene.add(orb);

    const glow = new Mesh(
      new SphereGeometry(0.15, 8, 6),
      new MeshBasicMaterial({
        color: new Color(currentTheme.glow),
        transparent: true, opacity: 0.2, blending: AdditiveBlending,
      })
    );
    glow.position.copy(orb.position);
    scene.add(glow);

    energyOrbs.push({ mesh: orb, glow, angle, radius, speed: 0.15 + Math.random() * 0.1, height });
  }

  // Ceiling grid with faint lines
  const ceilingY = 5.5;
  for (let i = -5; i <= 5; i += 2) {
    const mat = new LineBasicMaterial({ color: new Color(currentTheme.grid), transparent: true, opacity: 0.06 });
    const g1 = new BufferGeometry().setFromPoints([new Vector3(i, ceilingY, -6), new Vector3(i, ceilingY, 2)]);
    scene.add(new Line(g1, mat));
    const g2 = new BufferGeometry().setFromPoints([new Vector3(-6, ceilingY, i - 2), new Vector3(6, ceilingY, i - 2)]);
    scene.add(new Line(g2, mat));
  }

  function applyTheme(theme: Theme) {
    currentTheme = theme;
    scene.background = new Color(theme.sky);
    scene.fog = new Fog(new Color(theme.fog), 1, 30);
    groundMesh.material = new MeshStandardMaterial({ color: new Color(theme.ground), roughness: 0.9 });
    gridLines.forEach(l => { (l.material as LineBasicMaterial).color.set(theme.grid); });
    holeMeshes.forEach(h => {
      (h.ring.material as MeshStandardMaterial).color.set(theme.accent);
      (h.ring.material as MeshStandardMaterial).emissiveIntensity = 0.5;
      (h.ring.material as MeshStandardMaterial).emissive.set(theme.glow);
    });
    accentLight1.color.set(theme.accent);
    accentLight2.color.set(theme.accent);
    updateMalletColor();
  }

  // ─── Holes ───────────────────────────────────────────────────

  interface HoleMeshes { base: Mesh; ring: Mesh; inner: Mesh; }
  const holeMeshes: HoleMeshes[] = [];

  HOLES.forEach(h => {
    const inner = new Mesh(
      new CylinderGeometry(0.18, 0.18, 0.05, 24),
      new MeshBasicMaterial({ color: new Color('#000000') })
    );
    inner.position.set(h.x, 0.01, h.z); scene.add(inner);
    const ring = new Mesh(
      new TorusGeometry(0.22, 0.03, 8, 24),
      new MeshStandardMaterial({
        color: new Color(currentTheme.accent),
        emissive: new Color(currentTheme.glow),
        emissiveIntensity: 0.5,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(h.x, 0.02, h.z); scene.add(ring);
    const base = new Mesh(
      new CylinderGeometry(0.25, 0.28, 0.06, 24),
      new MeshStandardMaterial({ color: new Color('#222244'), emissive: new Color('#111122'), emissiveIntensity: 0.3 })
    );
    base.position.set(h.x, 0.0, h.z); scene.add(base);
    holeMeshes.push({ base, ring, inner });
  });

  // ─── 3D Mallet ──────────────────────────────────────────────

  const malletGroup = new Group();
  const malletHandleMat = new MeshStandardMaterial({
    color: new Color('#443322'), emissive: new Color('#221100'), emissiveIntensity: 0.2
  });
  const malletHandle = new Mesh(new CylinderGeometry(0.025, 0.03, 0.35, 8), malletHandleMat);
  malletHandle.position.set(0, -0.12, 0);
  malletGroup.add(malletHandle);

  const malletHeadMat = new MeshStandardMaterial({
    color: new Color(MALLET_SKINS[save.malletIdx].color),
    emissive: new Color(MALLET_SKINS[save.malletIdx].emissive),
    emissiveIntensity: 0.6,
  });
  const malletHead = new Mesh(new CylinderGeometry(0.08, 0.08, 0.12, 12), malletHeadMat);
  malletHead.rotation.z = Math.PI / 2;
  malletHead.position.set(0, 0.08, 0);
  malletGroup.add(malletHead);

  // Glow ring around mallet head
  const malletGlow = new Mesh(
    new TorusGeometry(0.1, 0.015, 6, 16),
    new MeshBasicMaterial({
      color: new Color(MALLET_SKINS[save.malletIdx].color),
      transparent: true, opacity: 0.3, blending: AdditiveBlending,
    })
  );
  malletGlow.position.set(0, 0.08, 0);
  malletGroup.add(malletGlow);

  malletGroup.position.set(0, 0.5, -2);
  malletGroup.visible = false;
  scene.add(malletGroup);

  function updateMalletColor() {
    const skin = MALLET_SKINS[save.malletIdx];
    malletHeadMat.color.set(skin.color);
    malletHeadMat.emissive.set(skin.emissive);
    (malletGlow.material as MeshBasicMaterial).color.set(skin.color);
  }

  // Mallet animation state
  let malletSwingT = 0;
  let malletSwinging = false;
  const malletTargetPos = new Vector3(0, 0.5, -2);
  const mouseNDC = { x: 0, y: 0 };

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });

  function triggerMalletSwing() {
    malletSwinging = true;
    malletSwingT = 0;
  }

  function updateMallet(dt: number) {
    if (state !== 'playing' && state !== 'pattern_input') {
      malletGroup.visible = false;
      return;
    }
    malletGroup.visible = true;

    // Position mallet from mouse ray intersection with y=0.3 plane
    const cam = world.camera;
    if (cam) {
      const dir = new Vector3(mouseNDC.x, mouseNDC.y, 0.5).unproject(cam).sub(cam.position).normalize();
      const t2 = (0.3 - cam.position.y) / dir.y;
      if (t2 > 0) {
        malletTargetPos.set(
          cam.position.x + dir.x * t2,
          0.5,
          cam.position.z + dir.z * t2
        );
        // Clamp within play area
        malletTargetPos.x = Math.max(-2.5, Math.min(2.5, malletTargetPos.x));
        malletTargetPos.z = Math.max(-4.0, Math.min(-0.5, malletTargetPos.z));
      }
    }

    // Smooth follow
    malletGroup.position.lerp(malletTargetPos, 0.2);

    // Swing animation
    if (malletSwinging) {
      malletSwingT += dt * 12;
      if (malletSwingT < 1) {
        // Swing down
        malletGroup.rotation.x = -malletSwingT * 0.6;
        malletGroup.position.y = 0.5 - malletSwingT * 0.25;
      } else if (malletSwingT < 2) {
        // Swing back up
        const t3 = malletSwingT - 1;
        malletGroup.rotation.x = -0.6 * (1 - t3);
        malletGroup.position.y = 0.25 + t3 * 0.25;
      } else {
        malletSwinging = false;
        malletGroup.rotation.x = 0;
      }
    }

    // Idle bob
    if (!malletSwinging) {
      const t4 = performance.now() / 1000;
      malletGroup.rotation.x = Math.sin(t4 * 1.5) * 0.03;
    }
  }


  // ─── Particle System ────────────────────────────────────────

  interface Particle {
    mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number;
  }
  const particles: Particle[] = [];

  function spawnParticles(x: number, y: number, z: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const size = 0.02 + Math.random() * 0.04;
      const mesh = new Mesh(
        new BoxGeometry(size, size, size),
        new MeshBasicMaterial({ color: new Color(color) })
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
      const speed = 1.5 + Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.6 + 0.2;
      particles.push({
        mesh,
        vx: Math.cos(angle) * Math.sin(elev) * speed,
        vy: Math.cos(elev) * speed + 1,
        vz: Math.sin(angle) * Math.sin(elev) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }

  // Floating score popup particles (rising numbers effect)
  interface ScorePopup {
    mesh: Mesh; vy: number; life: number; maxLife: number;
  }
  const scorePopups: ScorePopup[] = [];

  function spawnScorePopup(x: number, y: number, z: number, color: string, big: boolean) {
    // Visual score indicator — a cluster of small glowing cubes rising up
    const count = big ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const size = big ? 0.04 + Math.random() * 0.03 : 0.02 + Math.random() * 0.02;
      const mesh = new Mesh(
        new BoxGeometry(size, size * 2, size),
        new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 1, blending: AdditiveBlending })
      );
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.1,
        y + 0.2 + Math.random() * 0.1,
        z + (Math.random() - 0.5) * 0.1
      );
      scene.add(mesh);
      scorePopups.push({
        mesh,
        vy: 0.8 + Math.random() * 0.5,
        life: 1.0 + Math.random() * 0.3,
        maxLife: 1.0 + Math.random() * 0.3,
      });
    }
  }

  // Ring burst VFX — expanding ring at hit point
  interface RingBurst {
    mesh: Mesh; life: number; maxLife: number; speed: number;
  }
  const ringBursts: RingBurst[] = [];

  function spawnRingBurst(x: number, y: number, z: number, color: string) {
    const mesh = new Mesh(
      new TorusGeometry(0.05, 0.015, 6, 24),
      new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.8, blending: AdditiveBlending })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    ringBursts.push({ mesh, life: 0.5, maxLife: 0.5, speed: 3 });
  }

  function updateRingBursts(dt: number) {
    for (let i = ringBursts.length - 1; i >= 0; i--) {
      const rb = ringBursts[i];
      rb.life -= dt;
      if (rb.life <= 0) { scene.remove(rb.mesh); ringBursts.splice(i, 1); continue; }
      const progress = 1 - rb.life / rb.maxLife;
      const scale = 1 + progress * rb.speed;
      rb.mesh.scale.set(scale, scale, scale);
      (rb.mesh.material as MeshBasicMaterial).opacity = 0.8 * (rb.life / rb.maxLife);
    }
  }

  // ─── Screen Flash System ─────────────────────────────────────

  const flashPlane = new Mesh(
    new PlaneGeometry(20, 20),
    new MeshBasicMaterial({
      color: new Color('#ffffff'),
      transparent: true, opacity: 0, blending: AdditiveBlending, side: DoubleSide,
      depthWrite: false,
    })
  );
  flashPlane.position.set(0, 1.7, -0.8);
  flashPlane.renderOrder = 999;
  scene.add(flashPlane);
  let flashTimer = 0;
  let flashDuration = 0;

  function triggerFlash(color: string, duration = 0.15) {
    (flashPlane.material as MeshBasicMaterial).color.set(color);
    (flashPlane.material as MeshBasicMaterial).opacity = 0.25;
    flashTimer = duration;
    flashDuration = duration;
  }

  function updateFlash(dt: number) {
    if (flashTimer > 0) {
      flashTimer -= dt;
      const frac = Math.max(0, flashTimer / flashDuration);
      (flashPlane.material as MeshBasicMaterial).opacity = 0.25 * frac;
    }
  }

  // ─── Floor Beat Pulse ────────────────────────────────────────

  let beatPhase = 0;
  const floorPulseMat = new MeshBasicMaterial({
    color: new Color(currentTheme.glow),
    transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false,
  });
  const floorPulse = new Mesh(new PlaneGeometry(8, 8), floorPulseMat);
  floorPulse.rotation.x = -Math.PI / 2;
  floorPulse.position.set(0, 0.008, -2);
  scene.add(floorPulse);

  function updateFloorPulse(dt: number) {
    beatPhase += dt * (128 / 60); // sync to 128 BPM
    const pulse = Math.max(0, Math.sin(beatPhase * Math.PI * 2) * 0.5);
    const isPlaying = state === 'playing' || state === 'pattern_input';
    floorPulseMat.opacity = isPlaying ? pulse * 0.04 : 0;
    floorPulseMat.color.set(currentTheme.glow);
  }

  // ─── Streak Milestone VFX ────────────────────────────────────

  function spawnStreakBurst(milestone: number) {
    // Spawn a ring of particles around the play area
    const count = Math.min(milestone, 30);
    const color = milestone >= 50 ? '#ffd700' : milestone >= 20 ? '#ff4400' : '#00ffff';
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 2.5;
      const x = Math.cos(angle) * radius;
      const z = -2 + Math.sin(angle) * radius;
      spawnParticles(x, 0.5, z, color, 3);
    }
    // Flash
    triggerFlash(color, 0.2);
    triggerShake(0.3, 0.15);
  }

  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
      p.vy -= 4 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const alpha = p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha;
      (p.mesh.material as MeshBasicMaterial).transparent = true;
      const s = alpha * 0.8 + 0.2;
      p.mesh.scale.set(s, s, s);
    }

    // Score popups
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      const sp = scorePopups[i];
      sp.life -= dt;
      if (sp.life <= 0) { scene.remove(sp.mesh); scorePopups.splice(i, 1); continue; }
      sp.mesh.position.y += sp.vy * dt;
      const alpha = sp.life / sp.maxLife;
      (sp.mesh.material as MeshBasicMaterial).opacity = alpha;
      const s = alpha * 1.2 + 0.3;
      sp.mesh.scale.set(s, s * 1.5, s);
    }
  }

  // ─── Camera Shake ────────────────────────────────────────────

  function triggerShake(intensity: number, duration: number) {
    shakeIntensity = intensity;
    shakeTimer = duration;
  }

  function updateShake(dt: number) {
    if (shakeTimer > 0) {
      shakeTimer -= dt;
      const t2 = shakeTimer > 0 ? shakeIntensity * (shakeTimer / 0.3) : 0;
      const cam = world.camera;
      if (cam && t2 > 0) {
        cam.position.x = baseCamPos.x + (Math.random() - 0.5) * t2 * 0.1;
        cam.position.y = baseCamPos.y + (Math.random() - 0.5) * t2 * 0.05;
      } else if (cam) {
        cam.position.x = baseCamPos.x;
        cam.position.y = baseCamPos.y;
      }
    }
  }

  // ─── Target Management ──────────────────────────────────────

  function spawnTarget(holeIdx: number, typeIdx: number) {
    if (activeTargets.some(t => t.holeIdx === holeIdx && t.alive)) return;
    const hole = HOLES[holeIdx];
    const ttype = TARGET_TYPES[typeIdx];

    const mesh = new Mesh(
      new SphereGeometry(0.15, 16, 12),
      new MeshStandardMaterial({
        color: new Color(ttype.color),
        emissive: new Color(ttype.emissive),
        emissiveIntensity: 0.6,
        transparent: ttype.isGhost || false,
        opacity: ttype.isGhost ? 0.5 : 1,
      })
    );
    mesh.position.set(hole.x, -0.15, hole.z);

    const cap = new Mesh(
      new SphereGeometry(0.08, 12, 8),
      new MeshStandardMaterial({
        color: new Color(ttype.edgeColor),
        emissive: new Color(ttype.emissive),
        emissiveIntensity: 0.4,
      })
    );
    cap.position.set(0, 0.12, 0);
    mesh.add(cap);

    const glow = new Mesh(
      new SphereGeometry(0.22, 12, 8),
      new MeshBasicMaterial({
        color: new Color(ttype.color),
        transparent: true, opacity: 0.15, blending: AdditiveBlending,
      })
    );
    glow.position.copy(mesh.position);

    const edgeGeo = new EdgesGeometry(new SphereGeometry(0.16, 8, 6));
    const edges = new LineSegments(edgeGeo, new LineBasicMaterial({ color: new Color(ttype.edgeColor), transparent: true, opacity: 0.4 }));
    edges.position.copy(mesh.position);

    scene.add(mesh); scene.add(glow); scene.add(edges);

    const sizeMultiplier = (activePowerUp?.type === 'sizeup' ? 1.4 : 1) *
      (activeModifiers.has('tinyTargets') ? 0.6 : 1);
    mesh.scale.setScalar(sizeMultiplier);

    const stayMult = (activePowerUp?.type === 'timeslow' ? 1.8 : 1) *
      (activePowerUp?.type === 'freeze' ? 2.5 : 1) *
      (activeModifiers.has('hardmode') ? 0.6 : 1);

    activeTargets.push({
      holeIdx, typeIdx, mesh, cap, glow, edges,
      timeLeft: ttype.stayTime * stayMult,
      hitsLeft: ttype.hitsNeeded,
      rising: true, riseT: 0, sinking: false, sinkT: 0,
      alive: true, ghostPhase: Math.random() * Math.PI * 2,
    });

    audio.playPopUp();
  }

  function removeTarget(t: ActiveTarget) {
    t.alive = false;
    t.sinking = true; t.sinkT = 0;
  }

  function destroyTarget(t: ActiveTarget) {
    scene.remove(t.mesh); scene.remove(t.glow); scene.remove(t.edges);
    const idx = activeTargets.indexOf(t);
    if (idx >= 0) activeTargets.splice(idx, 1);
  }

  function clearAllTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); scene.remove(t.glow); scene.remove(t.edges); });
    activeTargets = [];
  }

  // ─── Scoring & Combos ───────────────────────────────────────

  function hitTarget(t: ActiveTarget) {
    t.hitsLeft--;
    if (t.hitsLeft > 0) {
      audio.playWhack(1.2);
      spawnParticles(t.mesh.position.x, t.mesh.position.y + 0.15, t.mesh.position.z, TARGET_TYPES[t.typeIdx].color, 4);
      triggerMalletSwing();
      return;
    }

    const ttype = TARGET_TYPES[t.typeIdx];
    triggerMalletSwing();

    if (ttype.isBomb) {
      audio.playBomb();
      spawnParticles(t.mesh.position.x, t.mesh.position.y + 0.15, t.mesh.position.z, '#ff2200', 15);
      score += ttype.points;
      combo = 0;
      streak = 0;
      sessionBombsHit++;
      triggerShake(1.0, 0.3);
      triggerFlash('#ff2200', 0.25);
      if (mode === 'survival' || mode === 'frenzy' || mode === 'tournament') { lives--; }
      removeTarget(t);
      return;
    }

    // Track special targets
    if (ttype.name === 'KING') sessionKingsHit++;
    if (ttype.isGhost) sessionGhostsHit++;
    if (ttype.name === 'MYSTERY') sessionMysteryHit++;

    let pts = ttype.points;
    if (ttype.name === 'MYSTERY') {
      const options = [50, 100, 200, 300, 500, 1000];
      pts = options[Math.floor(Math.random() * options.length)];
      if (Math.random() < 0.3 && !activeModifiers.has('nopower')) {
        const types: PowerUpState['type'][] = ['timeslow', 'sizeup', 'scorex2', 'magnet', 'freeze'];
        const names = ['⏳ TIME SLOW', '🔍 SIZE UP', '⭐ SCORE ×2', '🧲 MAGNET', '❄️ FREEZE'];
        const idx = Math.floor(Math.random() * types.length);
        activePowerUp = { type: types[idx], name: names[idx], timeLeft: 10 };
        sessionPowerUps++;
        audio.playPowerUp();
        showToast(names[idx], '10s active');
      }
    }

    const multiplier = (activePowerUp?.type === 'scorex2' ? 2 : 1) * getModifierMultiplier();
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    streak++;
    if (streak > bestSessionStreak) bestSessionStreak = streak;
    const comboMult = 1 + Math.min(combo - 1, 9) * 0.1;
    // Streak bonus: every 10 consecutive hits without a miss
    const streakBonus = streak > 0 && streak % 10 === 0 ? 500 * Math.floor(streak / 10) : 0;
    const finalPts = Math.round(pts * comboMult * multiplier) + streakBonus;
    score += finalPts;
    hits++;

    if (streakBonus > 0) {
      showToast(`🔥 ${streak} STREAK!`, `+${streakBonus} bonus`);
      spawnStreakBurst(streak);
    }

    audio.playWhack(1.0 + Math.min(combo, 10) * 0.05);
    if (combo >= 3) audio.playCombo(combo);

    // Screen flash on high-value hits
    if (finalPts >= 1000) triggerFlash('#ffd700', 0.12);
    else if (finalPts >= 500) triggerFlash(ttype.color, 0.08);

    // Spawn visual effects
    spawnParticles(t.mesh.position.x, t.mesh.position.y + 0.15, t.mesh.position.z, ttype.color, 10);
    spawnScorePopup(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z, ttype.color, finalPts >= 500);
    spawnRingBurst(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z, ttype.color);

    if (combo >= 3) showCombo(`x${combo}`);

    removeTarget(t);

    // Power-up drop
    if (Math.random() < 0.05 && !activePowerUp && ttype.name !== 'MYSTERY' && !activeModifiers.has('nopower')) {
      const types: PowerUpState['type'][] = ['timeslow', 'sizeup', 'scorex2', 'magnet', 'freeze'];
      const names = ['⏳ TIME SLOW', '🔍 SIZE UP', '⭐ SCORE ×2', '🧲 MAGNET', '❄️ FREEZE'];
      const idx = Math.floor(Math.random() * types.length);
      activePowerUp = { type: types[idx], name: names[idx], timeLeft: 10 };
      sessionPowerUps++;
      audio.playPowerUp();
      showToast(names[idx], '10s active');
    }
  }

  function onTargetMissed(t: ActiveTarget) {
    if (TARGET_TYPES[t.typeIdx].isBomb) return;
    combo = 0;
    streak = 0;
    misses++;
    if (mode === 'survival' || mode === 'tournament') { lives--; }
    removeTarget(t);
  }


  // ─── Spawn Logic ─────────────────────────────────────────────

  function getSpawnWeights(): number[] {
    const base = [50, 10, 12, 5, 10, 5, 1, 7];
    const diff = Math.min(difficultyLevel, 20);
    base[2] += diff * 1;
    base[3] += diff * 0.5;
    base[4] += diff * 0.3;
    base[5] += diff * 0.5;
    base[6] += diff * 0.1;
    // Bomb Rush modifier: triple bomb weight
    if (activeModifiers.has('bombRush')) base[4] *= 3;
    return base;
  }

  function pickTargetType(): number {
    const w = getSpawnWeights();
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }

  function pickEmptyHole(): number {
    const occupied = new Set(activeTargets.filter(t => t.alive).map(t => t.holeIdx));
    const available = [];
    for (let i = 0; i < HOLES.length; i++) { if (!occupied.has(i)) available.push(i); }
    if (available.length === 0) return -1;
    return available[Math.floor(Math.random() * available.length)];
  }

  function getSpawnInterval(): number {
    const base = mode === 'frenzy' ? 0.3 :
                 mode === 'speed' ? Math.max(0.3, 1.2 - gameTime * 0.03) :
                 mode === 'zen' ? 2.0 :
                 mode === 'tournament' ? Math.max(0.5, 1.3 - tournamentRound * 0.15 - difficultyLevel * 0.05) :
                 Math.max(0.5, 1.5 - difficultyLevel * 0.08);
    return base * (activeModifiers.has('speedDemon') ? 0.5 : 1);
  }

  function updateDifficulty() {
    if (mode === 'classic' || mode === 'daily') {
      difficultyLevel = 1 + Math.floor(gameTime / 10);
    } else if (mode === 'survival') {
      difficultyLevel = 1 + Math.floor(hits / 8);
    } else if (mode === 'frenzy') {
      difficultyLevel = 5 + Math.floor(gameTime / 8);
    } else if (mode === 'speed') {
      difficultyLevel = 3 + Math.floor(gameTime / 5);
    } else if (mode === 'tournament') {
      difficultyLevel = tournamentRound * 3 + 1 + Math.floor(gameTime / 15);
    }
  }

  // ─── UI Panel Setup ──────────────────────────────────────────

  function createPanel(config: string, x: number, y: number, z: number, mw: number, mh: number) {
    const e = world.createTransformEntity(undefined, { persistent: true });
    e.object3D!.position.set(x, y, z);
    e.addComponent(PanelUI, { config, maxWidth: mw, maxHeight: mh });
    return e;
  }

  function createHUD(config: string, ox: number, oy: number, oz: number, mw: number, mh: number) {
    const e = world.createTransformEntity(undefined, { persistent: true });
    e.addComponent(PanelUI, { config, maxWidth: mw, maxHeight: mh });
    e.addComponent(Follower, {
      target: (world as any).player?.head, offsetPosition: [ox, oy, oz],
      behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3,
    });
    return e;
  }

  const titleEntity = createPanel('/ui/title.json', 0, 1.5, -3, 0.9, 1.2);
  const modeEntity = createPanel('/ui/modeselect.json', 0, 1.5, -3, 1.0, 1.4);
  const countdownEntity = createPanel('/ui/countdown.json', 0, 1.8, -2.5, 0.4, 0.4);
  const gameoverEntity = createPanel('/ui/gameover.json', 0, 1.5, -3, 1.0, 1.2);
  const pauseEntity = createPanel('/ui/pause.json', 0, 1.5, -2.5, 0.6, 0.8);
  const settingsEntity = createPanel('/ui/settings.json', 0, 1.5, -3, 0.9, 1.1);
  const achieveEntity = createPanel('/ui/achievements.json', 0, 1.5, -3, 1.0, 1.4);
  const statsEntity = createPanel('/ui/stats.json', 0, 1.5, -3, 0.9, 1.4);
  const helpEntity = createPanel('/ui/help.json', 0, 1.5, -3, 0.9, 1.4);
  const shopEntity = createPanel('/ui/shop.json', 0, 1.5, -3, 0.8, 1.2);
  const patternEntity = createPanel('/ui/pattern.json', 0, 2.0, -2.5, 0.6, 0.4);
  const tutorialEntity = createPanel('/ui/tutorial.json', 0, 1.5, -3, 1.0, 1.2);
  const tournamentEntity = createPanel('/ui/tournament.json', 0, 1.5, -3, 0.8, 0.8);

  const hudEntity = createHUD('/ui/hud.json', 0, 0.2, -0.5, 0.45, 0.08);
  const comboEntity = createHUD('/ui/combo.json', 0, 0.05, -0.5, 0.2, 0.1);
  const toastEntity = createHUD('/ui/toast.json', 0, -0.1, -0.5, 0.3, 0.06);
  const powerupEntity = createHUD('/ui/powerup.json', -0.2, 0.15, -0.5, 0.2, 0.04);

  const modifiersEntity = createPanel('/ui/modifiers.json', 0, 1.5, -3, 1.0, 1.6);

  const allPanels = [
    titleEntity, modeEntity, countdownEntity, gameoverEntity, pauseEntity,
    settingsEntity, achieveEntity, statsEntity, helpEntity, shopEntity, patternEntity,
    hudEntity, comboEntity, toastEntity, powerupEntity, tutorialEntity, tournamentEntity,
    modifiersEntity,
  ];

  const HIDDEN_Y = -100;

  function hideAllPanels() {
    allPanels.forEach(p => {
      if (p === hudEntity || p === comboEntity || p === toastEntity || p === powerupEntity) return;
      p.object3D!.position.y = HIDDEN_Y;
    });
    setHUDVisible(false);
    setComboVisible(false);
    setToastVisible(false);
    setPowerUpVisible(false);
  }

  function showPanel(entity: ReturnType<typeof createPanel>, y = 1.5) {
    entity.object3D!.position.y = y;
  }

  let hudVisible = false, comboVisible = false, toastVisible = false, powerupVisible = false;

  function setFollowerVisible(entity: any, visible: boolean, normalOffset: [number, number, number]) {
    const off: [number, number, number] = visible ? normalOffset : [normalOffset[0], -100, normalOffset[2]];
    try { (entity as any).removeComponent?.(Follower); } catch {}
    try { entity.addComponent(Follower, { target: (world as any).player?.head, offsetPosition: off, behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 }); } catch {}
  }

  function setHUDVisible(v: boolean) { hudVisible = v; setFollowerVisible(hudEntity, v, [0, 0.2, -0.5]); }
  function setComboVisible(v: boolean) { comboVisible = v; setFollowerVisible(comboEntity, v, [0, 0.05, -0.5]); }
  function setToastVisible(v: boolean) { toastVisible = v; setFollowerVisible(toastEntity, v, [0, -0.1, -0.5]); }
  function setPowerUpVisible(v: boolean) { powerupVisible = v; setFollowerVisible(powerupEntity, v, [-0.2, 0.15, -0.5]); }

  let comboTimer = 0;
  function showCombo(text: string) {
    comboTimer = 1.5;
    setComboVisible(true);
    updateEl(comboEntity, 'combo-text', text);
  }

  let toastTimer = 0;
  function showToast(text: string, desc = '') {
    toastTimer = 3;
    setToastVisible(true);
    updateEl(toastEntity, 'toast-text', text);
    updateEl(toastEntity, 'toast-desc', desc);
  }

  // ─── UI Helpers ──────────────────────────────────────────────

  function getDoc(entity: any): UIKitDocument | null {
    try {
      const doc = entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
      return doc || null;
    } catch { return null; }
  }

  function updateEl(entity: any, id: string, text: string) {
    const doc = getDoc(entity);
    if (doc) { const el = doc.getElementById(id); if (el && (el as any).text) (el as any).text.value = text; }
  }

  function bindBtn(entity: any, id: string, handler: () => void) {
    const doc = getDoc(entity);
    if (doc) { const el = doc.getElementById(id); if (el) el.addEventListener('click', handler); }
  }


  // ─── Achievements ────────────────────────────────────────────

  const ACHIEVEMENTS: Achievement[] = [
    // Whack milestones
    { id: 'first_whack', name: 'First Whack', desc: 'Hit your first target', icon: '🔨', check: () => save.totalWhacks >= 1 },
    { id: 'whack_50', name: 'Whack Master', desc: 'Hit 50 targets total', icon: '🔨', check: () => save.totalWhacks >= 50 },
    { id: 'whack_200', name: 'Whack Legend', desc: 'Hit 200 targets total', icon: '⚡', check: () => save.totalWhacks >= 200 },
    { id: 'whack_500', name: 'Whack God', desc: 'Hit 500 targets total', icon: '👑', check: () => save.totalWhacks >= 500 },
    { id: 'whack_1000', name: 'Whack Eternal', desc: 'Hit 1000 targets total', icon: '🌟', check: () => save.totalWhacks >= 1000 },
    { id: 'whack_2000', name: 'Whack Transcendent', desc: 'Hit 2000 targets total', icon: '✨', check: () => save.totalWhacks >= 2000 },
    // Combo
    { id: 'combo_5', name: 'Combo Starter', desc: '5x combo in one game', icon: '🔥', check: () => save.bestCombo >= 5 },
    { id: 'combo_10', name: 'Combo Pro', desc: '10x combo in one game', icon: '🔥', check: () => save.bestCombo >= 10 },
    { id: 'combo_20', name: 'Combo Master', desc: '20x combo in one game', icon: '💥', check: () => save.bestCombo >= 20 },
    { id: 'combo_50', name: 'Combo Deity', desc: '50x combo in one game', icon: '☄️', check: () => save.bestCombo >= 50 },
    { id: 'combo_100', name: 'Combo Immortal', desc: '100x combo in one game', icon: '🌠', check: () => save.bestCombo >= 100 },
    // Score
    { id: 'score_1k', name: 'Score Hunter', desc: 'Score 1,000 in a game', icon: '🎯', check: () => Object.values(save.highScores).some(s => s >= 1000) },
    { id: 'score_5k', name: 'Score Champion', desc: 'Score 5,000 in a game', icon: '🏆', check: () => Object.values(save.highScores).some(s => s >= 5000) },
    { id: 'score_10k', name: 'Score Legend', desc: 'Score 10,000 in a game', icon: '💎', check: () => Object.values(save.highScores).some(s => s >= 10000) },
    { id: 'score_25k', name: 'Score God', desc: 'Score 25,000 in a game', icon: '👑', check: () => Object.values(save.highScores).some(s => s >= 25000) },
    { id: 'score_50k', name: 'Score Titan', desc: 'Score 50,000 in a game', icon: '🌟', check: () => Object.values(save.highScores).some(s => s >= 50000) },
    // Mode-specific
    { id: 'survival_50', name: 'Survivor', desc: '50 hits in Survival', icon: '❤️', check: () => (save.highScores['survival'] || 0) >= 50 },
    { id: 'survival_100', name: 'Iron Will', desc: '100 hits in Survival', icon: '🛡️', check: () => (save.highScores['survival'] || 0) >= 100 },
    { id: 'survival_200', name: 'Unbreakable', desc: '200 hits in Survival', icon: '💪', check: () => (save.highScores['survival'] || 0) >= 200 },
    { id: 'timeattack_30', name: 'Speed Demon', desc: 'Time Attack under 30s', icon: '⏱', check: () => (save.highScores['timeattack'] || 999) <= 30 },
    { id: 'timeattack_20', name: 'Lightning Hands', desc: 'Time Attack under 20s', icon: '⚡', check: () => (save.highScores['timeattack'] || 999) <= 20 },
    { id: 'speed_5k', name: 'Rush Hour', desc: '5,000 in Speed Rush', icon: '🚀', check: () => (save.highScores['speed'] || 0) >= 5000 },
    { id: 'speed_10k', name: 'Speed King', desc: '10,000 in Speed Rush', icon: '👑', check: () => (save.highScores['speed'] || 0) >= 10000 },
    { id: 'pattern_5', name: 'Pattern Novice', desc: 'Round 5 in Pattern', icon: '🧠', check: () => (save.highScores['pattern'] || 0) >= 5 },
    { id: 'pattern_10', name: 'Pattern Master', desc: 'Round 10 in Pattern', icon: '🧠', check: () => (save.highScores['pattern'] || 0) >= 10 },
    { id: 'pattern_15', name: 'Pattern Genius', desc: 'Round 15 in Pattern', icon: '💡', check: () => (save.highScores['pattern'] || 0) >= 15 },
    { id: 'frenzy_8k', name: 'Frenzy Beast', desc: '8,000 in Frenzy', icon: '🔥', check: () => (save.highScores['frenzy'] || 0) >= 8000 },
    { id: 'frenzy_15k', name: 'Frenzy Overlord', desc: '15,000 in Frenzy', icon: '💥', check: () => (save.highScores['frenzy'] || 0) >= 15000 },
    // Tournament
    { id: 'tournament_complete', name: 'Tournament Finisher', desc: 'Complete a tournament', icon: '🏟️', check: () => save.tournamentBest > 0 },
    { id: 'tournament_10k', name: 'Tournament Champion', desc: '10,000 tournament total', icon: '🏆', check: () => save.tournamentBest >= 10000 },
    { id: 'tournament_25k', name: 'Tournament Legend', desc: '25,000 tournament total', icon: '🌟', check: () => save.tournamentBest >= 25000 },
    // Games played
    { id: 'games_10', name: 'Regular', desc: 'Play 10 games', icon: '🎮', check: () => save.totalGames >= 10 },
    { id: 'games_50', name: 'Dedicated', desc: 'Play 50 games', icon: '🎮', check: () => save.totalGames >= 50 },
    { id: 'games_100', name: 'Obsessed', desc: 'Play 100 games', icon: '🕹️', check: () => save.totalGames >= 100 },
    { id: 'games_200', name: 'Addicted', desc: 'Play 200 games', icon: '🎰', check: () => save.totalGames >= 200 },
    // Level
    { id: 'level_10', name: 'Rising Star', desc: 'Reach level 10', icon: '⭐', check: () => save.level >= 10 },
    { id: 'level_25', name: 'Veteran', desc: 'Reach level 25', icon: '⭐', check: () => save.level >= 25 },
    { id: 'level_50', name: 'Grandmaster', desc: 'Reach level 50', icon: '🌟', check: () => save.level >= 50 },
    // Special targets
    { id: 'king_slayer', name: 'King Slayer', desc: 'Hit a King target', icon: '👑', check: () => save.totalKingsHit >= 1 },
    { id: 'king_hunter', name: 'King Hunter', desc: 'Hit 20 Kings', icon: '👑', check: () => save.totalKingsHit >= 20 },
    { id: 'ghost_buster', name: 'Ghost Buster', desc: 'Hit 10 Ghosts', icon: '👻', check: () => save.totalGhostsHit >= 10 },
    { id: 'ghost_hunter', name: 'Ghost Hunter', desc: 'Hit 50 Ghosts', icon: '👻', check: () => save.totalGhostsHit >= 50 },
    { id: 'mystery_10', name: 'Mystery Fan', desc: 'Hit 10 Mysteries', icon: '🎁', check: () => save.totalMysteryHit >= 10 },
    { id: 'bomb_5', name: 'Bomb Magnet', desc: 'Hit 5 bombs total', icon: '💣', check: () => save.totalBombsHit >= 5 },
    { id: 'bomb_25', name: 'Explosive Personality', desc: 'Hit 25 bombs total', icon: '💣', check: () => save.totalBombsHit >= 25 },
    // Power-ups
    { id: 'powerup_5', name: 'Powered Up', desc: 'Activate 5 power-ups', icon: '⚡', check: () => save.totalPowerUps >= 5 },
    { id: 'powerup_25', name: 'Power Junkie', desc: 'Activate 25 power-ups', icon: '⚡', check: () => save.totalPowerUps >= 25 },
    // Session-checked (check: always false, checked at game end)
    { id: 'accuracy_90', name: 'Sharpshooter', desc: '90% accuracy (10+ hits)', icon: '🎯', check: () => false },
    { id: 'accuracy_100', name: 'Perfect Aim', desc: '100% accuracy (10+ hits)', icon: '💯', check: () => false },
    { id: 'no_bombs', name: 'Bomb Dodger', desc: 'Classic, no bombs hit', icon: '💣', check: () => false },
    { id: 'perfect_classic', name: 'Perfect Classic', desc: '0 misses in Classic (10+)', icon: '💎', check: () => false },
    { id: 'zen_master', name: 'Zen Master', desc: 'Zen mode for 5 minutes', icon: '🧘', check: () => false },
    // Time
    { id: 'time_30m', name: 'Dedicated Player', desc: '30 min total playtime', icon: '⏰', check: () => save.totalTimePlayed >= 1800 },
    { id: 'time_1h', name: 'Marathon', desc: '1 hour total playtime', icon: '⏰', check: () => save.totalTimePlayed >= 3600 },
    { id: 'time_3h', name: 'Endurance', desc: '3 hours total playtime', icon: '⏰', check: () => save.totalTimePlayed >= 10800 },
    // Daily
    { id: 'daily_3', name: 'Daily Streak', desc: 'Play 3 dailies', icon: '📅', check: () => save.totalDailies >= 3 },
    { id: 'daily_10', name: 'Daily Devotee', desc: 'Play 10 dailies', icon: '📅', check: () => save.totalDailies >= 10 },
    // Mallets
    { id: 'all_mallets', name: 'Collector', desc: 'Unlock all mallet skins', icon: '🔨', check: () => save.level >= 50 },
    // Streak
    { id: 'streak_10', name: 'Streak Starter', desc: '10 consecutive hits', icon: '🔥', check: () => save.bestStreak >= 10 },
    { id: 'streak_25', name: 'Streak Pro', desc: '25 consecutive hits', icon: '🔥', check: () => save.bestStreak >= 25 },
    { id: 'streak_50', name: 'Streak Master', desc: '50 consecutive hits', icon: '💥', check: () => save.bestStreak >= 50 },
    { id: 'streak_100', name: 'Unstoppable', desc: '100 consecutive hits', icon: '🌟', check: () => save.bestStreak >= 100 },
    // Modifier games
    { id: 'modifier_1', name: 'Modifier Curious', desc: 'Play with 1 modifier', icon: '⚙️', check: () => save.totalModifierGames >= 1 },
    { id: 'modifier_5', name: 'Modifier Fan', desc: 'Play 5 modified games', icon: '⚙️', check: () => save.totalModifierGames >= 5 },
    { id: 'modifier_all', name: 'All Modifiers', desc: 'Play with all 6 active', icon: '🔧', check: () => false },
    // Perfect rounds (checked at session end)
    { id: 'perfect_10', name: 'Perfect 10', desc: '10 hits, 0 misses', icon: '💎', check: () => save.perfectRounds >= 1 },
    { id: 'perfect_5_games', name: 'Perfectionist', desc: '5 perfect games', icon: '💎', check: () => save.perfectRounds >= 5 },
  ];

  function checkAchievements() {
    let newAchievements = 0;
    ACHIEVEMENTS.forEach(a => {
      if (save.achievements.includes(a.id)) return;
      if (a.check()) {
        save.achievements.push(a.id);
        newAchievements++;
        showToast(`🏆 ${a.name}`, a.desc);
        audio.playAchievement();
      }
    });
    if (newAchievements > 0) writeSave(save);
  }

  function checkSessionAchievements() {
    const totalTargets = hits + misses;
    if (totalTargets >= 10) {
      const acc = hits / totalTargets;
      if (acc >= 0.9 && !save.achievements.includes('accuracy_90')) {
        save.achievements.push('accuracy_90');
        showToast('🏆 Sharpshooter', '90% accuracy!');
        audio.playAchievement();
      }
      if (acc >= 1.0 && !save.achievements.includes('accuracy_100')) {
        save.achievements.push('accuracy_100');
        showToast('🏆 Perfect Aim', '100% accuracy!');
        audio.playAchievement();
      }
    }
    if (mode === 'classic' && sessionBombsHit === 0 && hits >= 5 && !save.achievements.includes('no_bombs')) {
      save.achievements.push('no_bombs');
      showToast('🏆 Bomb Dodger', 'No bombs!');
      audio.playAchievement();
    }
    if (mode === 'classic' && misses === 0 && hits >= 10 && !save.achievements.includes('perfect_classic')) {
      save.achievements.push('perfect_classic');
      showToast('🏆 Perfect Classic', '0 misses!');
      audio.playAchievement();
    }
    // Perfect round (10+ hits, 0 misses in any mode)
    if (hits >= 10 && misses === 0) {
      save.perfectRounds++;
    }
    // All modifiers active
    if (activeModifiers.size >= MODIFIERS.length && !save.achievements.includes('modifier_all')) {
      save.achievements.push('modifier_all');
      showToast('🏆 All Modifiers', 'All 6 modifiers active!');
      audio.playAchievement();
    }
    writeSave(save);
  }


  // ─── UI Binding ──────────────────────────────────────────────

  let uiBound = false;
  let uiBindDelay = 0;

  function bindAllUI() {
    // Title
    bindBtn(titleEntity, 'start-btn', () => {
      if (!save.tutorialDone) { switchState('tutorial'); }
      else switchState('modeselect');
    });
    bindBtn(titleEntity, 'achieve-btn', () => { prevState = 'title'; switchState('achievements'); });
    bindBtn(titleEntity, 'stats-btn', () => { prevState = 'title'; switchState('stats'); });
    bindBtn(titleEntity, 'settings-btn', () => { prevState = 'title'; switchState('settings'); });
    bindBtn(titleEntity, 'help-btn', () => { prevState = 'title'; switchState('help'); });
    bindBtn(titleEntity, 'shop-btn', () => { prevState = 'title'; switchState('shop'); });

    // Tutorial
    bindBtn(tutorialEntity, 'tutorial-skip', () => {
      save.tutorialDone = true; writeSave(save);
      switchState('modeselect');
    });
    bindBtn(tutorialEntity, 'tutorial-play', () => {
      save.tutorialDone = true; writeSave(save);
      startGame('classic');
    });

    // Mode select
    bindBtn(modeEntity, 'mode-classic', () => startGame('classic'));
    bindBtn(modeEntity, 'mode-survival', () => startGame('survival'));
    bindBtn(modeEntity, 'mode-timeattack', () => startGame('timeattack'));
    bindBtn(modeEntity, 'mode-zen', () => startGame('zen'));
    bindBtn(modeEntity, 'mode-speed', () => startGame('speed'));
    bindBtn(modeEntity, 'mode-pattern', () => startGame('pattern'));
    bindBtn(modeEntity, 'mode-daily', () => { save.totalDailies++; writeSave(save); startGame('daily'); });
    bindBtn(modeEntity, 'mode-frenzy', () => startGame('frenzy'));
    bindBtn(modeEntity, 'mode-tournament', () => startGame('tournament'));
    bindBtn(modeEntity, 'mode-modifiers', () => { prevState = 'modeselect'; switchState('modifiers'); });
    bindBtn(modeEntity, 'mode-back-btn', () => switchState('title'));

    // Game over
    bindBtn(gameoverEntity, 'go-retry-btn', () => startGame(mode));
    bindBtn(gameoverEntity, 'go-menu-btn', () => switchState('title'));

    // Pause
    bindBtn(pauseEntity, 'pause-resume-btn', () => switchState('playing'));
    bindBtn(pauseEntity, 'pause-restart-btn', () => startGame(mode));
    bindBtn(pauseEntity, 'pause-quit-btn', () => { clearAllTargets(); switchState('title'); });

    // Settings
    bindBtn(settingsEntity, 'sfx-down', () => { save.sfxVol = Math.max(0, save.sfxVol - 10); audio.sfxVol = save.sfxVol / 100; writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'sfx-up', () => { save.sfxVol = Math.min(100, save.sfxVol + 10); audio.sfxVol = save.sfxVol / 100; writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'music-down', () => { save.musicVol = Math.max(0, save.musicVol - 10); audio.musicVol = save.musicVol / 100; audio.updateMusicVolume(); writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'music-up', () => { save.musicVol = Math.min(100, save.musicVol + 10); audio.musicVol = save.musicVol / 100; audio.updateMusicVolume(); writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'theme-prev', () => { save.themeIdx = (save.themeIdx - 1 + THEMES.length) % THEMES.length; applyTheme(THEMES[save.themeIdx]); writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'theme-next', () => { save.themeIdx = (save.themeIdx + 1) % THEMES.length; applyTheme(THEMES[save.themeIdx]); writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'reset-btn', () => {
      save = { ...DEFAULT_SAVE }; writeSave(save);
      audio.sfxVol = 1.0; audio.musicVol = 0.8;
      applyTheme(THEMES[0]); updateSettingsUI();
      showToast('Progress Reset', 'All data cleared');
    });
    bindBtn(settingsEntity, 'settings-back-btn', () => switchState(prevState));

    // Achievements
    bindBtn(achieveEntity, 'achieve-prev', () => { achievePage = Math.max(0, achievePage - 1); updateAchievementsUI(); });
    bindBtn(achieveEntity, 'achieve-next', () => { achievePage = Math.min(Math.ceil(ACHIEVEMENTS.length / 8) - 1, achievePage + 1); updateAchievementsUI(); });
    bindBtn(achieveEntity, 'achieve-back-btn', () => switchState(prevState));

    // Stats
    bindBtn(statsEntity, 'stats-back-btn', () => switchState(prevState));

    // Help
    bindBtn(helpEntity, 'help-back-btn', () => switchState(prevState));

    // Shop - mallet items
    MALLET_SKINS.forEach((skin, i) => {
      bindBtn(shopEntity, `mallet-${i}`, () => {
        if (save.level >= skin.unlockLevel) {
          save.malletIdx = i;
          updateMalletColor();
          writeSave(save);
          updateShopUI();
          showToast(`${skin.icon} ${skin.name}`, 'Equipped!');
        } else {
          showToast('🔒 LOCKED', `Requires Level ${skin.unlockLevel}`);
        }
      });
    });
    bindBtn(shopEntity, 'shop-back-btn', () => switchState(prevState));

    // Tournament transition
    bindBtn(tournamentEntity, 'tournament-next-btn', () => {
      tournamentRound++;
      startTournamentRound();
    });

    // Modifiers
    MODIFIERS.forEach((_mod, i) => {
      bindBtn(modifiersEntity, `mod-${i}`, () => {
        const modId = MODIFIERS[i].id;
        if (activeModifiers.has(modId)) activeModifiers.delete(modId);
        else activeModifiers.add(modId);
        updateModifiersUI();
      });
    });
    bindBtn(modifiersEntity, 'mod-back', () => switchState(prevState));
    bindBtn(modifiersEntity, 'mod-start', () => switchState('modeselect'));

    uiBound = true;
  }

  // ─── State Machine ──────────────────────────────────────────

  function switchState(newState: GameState) {
    state = newState;
    hideAllPanels();

    switch (newState) {
      case 'title':
        showPanel(titleEntity);
        updateTitleUI();
        audio.startMusic();
        break;
      case 'tutorial':
        showPanel(tutorialEntity);
        break;
      case 'modeselect':
        showPanel(modeEntity);
        updateEl(modeEntity, 'mod-indicator', activeModifiers.size > 0
          ? `⚙️ MODIFIERS (${activeModifiers.size} active — ×${getModifierMultiplier().toFixed(2)})`
          : '⚙️ MODIFIERS (0 active)');
        break;
      case 'countdown':
        showPanel(countdownEntity, 1.8);
        countdownVal = 3; countdownTimer = 0;
        updateEl(countdownEntity, 'cd-value', '3');
        audio.playCountdown();
        break;
      case 'playing':
        setHUDVisible(true);
        updateHUD();
        break;
      case 'pattern_show':
        showPanel(patternEntity, 2.0);
        setHUDVisible(true);
        updateEl(patternEntity, 'pattern-title', 'WATCH THE PATTERN');
        updateEl(patternEntity, 'pattern-level', `Round ${patternRound + 1}`);
        updateEl(patternEntity, 'pattern-instruction', 'Memorize the sequence...');
        patternShowIdx = 0; patternShowTimer = 0;
        break;
      case 'pattern_input':
        showPanel(patternEntity, 2.0);
        setHUDVisible(true);
        updateEl(patternEntity, 'pattern-title', 'YOUR TURN');
        updateEl(patternEntity, 'pattern-instruction', 'Repeat the pattern!');
        patternInputIdx = 0;
        break;
      case 'tournament_transition':
        showPanel(tournamentEntity);
        tournamentTransTimer = 0;
        updateTournamentTransUI();
        audio.playRoundComplete();
        break;
      case 'gameover':
        showPanel(gameoverEntity);
        audio.stopMusic();
        updateGameOverUI();
        break;
      case 'pause':
        showPanel(pauseEntity);
        break;
      case 'achievements':
        showPanel(achieveEntity);
        achievePage = 0;
        updateAchievementsUI();
        break;
      case 'settings':
        showPanel(settingsEntity);
        updateSettingsUI();
        break;
      case 'stats':
        showPanel(statsEntity);
        updateStatsUI();
        break;
      case 'help':
        showPanel(helpEntity);
        break;
      case 'shop':
        showPanel(shopEntity);
        updateShopUI();
        break;
      case 'modifiers':
        showPanel(modifiersEntity);
        updateModifiersUI();
        break;
    }
  }

  // ─── Game Start ──────────────────────────────────────────────

  function startGame(m: GameMode) {
    mode = m;
    score = 0; combo = 0; bestCombo = 0; hits = 0; misses = 0;
    gameTime = 0; difficultyLevel = 1; spawnTimer = 0;
    activePowerUp = null;
    sessionBombsHit = 0; sessionKingsHit = 0; sessionGhostsHit = 0;
    sessionMysteryHit = 0; sessionPowerUps = 0;
    streak = 0; bestSessionStreak = 0;
    clearAllTargets();

    if (m === 'daily') dailyRng = dailySeed;

    switch (m) {
      case 'classic': timeLimit = 60; lives = 999; break;
      case 'survival': timeLimit = 999; lives = 3; break;
      case 'timeattack': timeLimit = 999; lives = 999; break;
      case 'zen': timeLimit = 999; lives = 999; break;
      case 'speed': timeLimit = 30; lives = 999; break;
      case 'pattern':
        timeLimit = 999; lives = 3; patternRound = 0;
        patternSequence = [];
        for (let i = 0; i < 3; i++) patternSequence.push(Math.floor(Math.random() * HOLES.length));
        break;
      case 'daily': timeLimit = 60; lives = 999; break;
      case 'frenzy': timeLimit = 45; lives = 3; break;
      case 'tournament':
        tournamentRound = 0; tournamentTotalScore = 0;
        startTournamentRound();
        return;
    }

    gameStartTime = Date.now();
    audio.startMusic();

    if (m === 'pattern') switchState('pattern_show');
    else switchState('countdown');
  }

  function startTournamentRound() {
    score = 0; combo = 0; bestCombo = 0; hits = 0; misses = 0;
    gameTime = 0; spawnTimer = 0; activePowerUp = null;
    clearAllTargets();
    timeLimit = TOURNAMENT_DURATIONS[tournamentRound] || 60;
    lives = 3 + tournamentRound; // More lives in later rounds
    difficultyLevel = tournamentRound * 3 + 1;
    gameStartTime = Date.now();
    audio.startMusic();
    switchState('countdown');
  }


  // ─── UI Update Functions ────────────────────────────────────

  function updateTitleUI() {
    const best = save.highScores['classic'] || 0;
    updateEl(titleEntity, 'highscore-display', best > 0 ? `HIGH SCORE: ${best.toLocaleString()}` : '');
  }

  function updateHUD() {
    updateEl(hudEntity, 'hud-score', (mode === 'tournament' ? tournamentTotalScore + score : score).toLocaleString());
    updateEl(hudEntity, 'hud-combo', combo > 1 ? `x${combo}` : 'x1');

    if (mode === 'timeattack') {
      updateEl(hudEntity, 'hud-time', `${hits}/50`);
    } else if (mode === 'zen') {
      updateEl(hudEntity, 'hud-time', '∞');
    } else if (mode === 'pattern') {
      updateEl(hudEntity, 'hud-time', `R${patternRound + 1}`);
    } else if (mode === 'tournament') {
      const remaining = Math.max(0, timeLimit - gameTime);
      updateEl(hudEntity, 'hud-time', `R${tournamentRound + 1} ${Math.ceil(remaining)}`);
    } else {
      const remaining = Math.max(0, timeLimit - gameTime);
      updateEl(hudEntity, 'hud-time', `${Math.ceil(remaining)}`);
    }

    if (mode === 'survival' || mode === 'frenzy' || mode === 'tournament') {
      updateEl(hudEntity, 'hud-lives', '♥'.repeat(Math.max(0, Math.min(lives, 10))));
    } else {
      updateEl(hudEntity, 'hud-lives', '—');
    }

    updateEl(hudEntity, 'hud-level', `${difficultyLevel}`);
  }

  function updateGameOverUI() {
    const modeNames: Record<string, string> = {
      classic: 'CLASSIC', survival: 'SURVIVAL', timeattack: 'TIME ATTACK',
      zen: 'ZEN', speed: 'SPEED RUSH', pattern: 'PATTERN', daily: 'DAILY',
      frenzy: 'FRENZY', tournament: 'TOURNAMENT',
    };
    updateEl(gameoverEntity, 'go-subtitle', `${modeNames[mode] || mode.toUpperCase()} MODE`);

    if (mode === 'timeattack') {
      updateEl(gameoverEntity, 'go-title', hits >= 50 ? 'COMPLETE!' : 'TIME UP');
      updateEl(gameoverEntity, 'go-score', `${gameTime.toFixed(1)}s`);
    } else if (mode === 'pattern') {
      updateEl(gameoverEntity, 'go-title', 'GAME OVER');
      updateEl(gameoverEntity, 'go-score', `Round ${patternRound}`);
    } else if (mode === 'tournament') {
      const finalScore = tournamentTotalScore + score;
      updateEl(gameoverEntity, 'go-title', tournamentRound >= TOURNAMENT_ROUNDS - 1 ? 'TOURNAMENT COMPLETE!' : 'ELIMINATED');
      updateEl(gameoverEntity, 'go-score', finalScore.toLocaleString());
    } else {
      updateEl(gameoverEntity, 'go-title', 'GAME OVER');
      updateEl(gameoverEntity, 'go-score', score.toLocaleString());
    }

    updateEl(gameoverEntity, 'go-hits', `${hits}`);
    updateEl(gameoverEntity, 'go-misses', `${misses}`);
    const acc = (hits + misses) > 0 ? Math.round(hits / (hits + misses) * 100) : 0;
    updateEl(gameoverEntity, 'go-accuracy', `${acc}%`);
    updateEl(gameoverEntity, 'go-best-combo', `x${bestCombo}`);
    updateEl(gameoverEntity, 'go-time', `${Math.round(gameTime)}s`);

    // High score tracking
    let scoreVal: number;
    if (mode === 'tournament') {
      scoreVal = tournamentTotalScore + score;
      if (scoreVal > save.tournamentBest) save.tournamentBest = scoreVal;
    } else if (mode === 'timeattack') {
      scoreVal = hits >= 50 ? gameTime : 999;
    } else if (mode === 'pattern') {
      scoreVal = patternRound;
    } else {
      scoreVal = score;
    }

    const prevBest = save.highScores[mode] || (mode === 'timeattack' ? 999 : 0);
    const isBetter = mode === 'timeattack' ? scoreVal < prevBest : scoreVal > prevBest;
    if (isBetter) {
      save.highScores[mode] = scoreVal;
      updateEl(gameoverEntity, 'go-new-best', '★ NEW BEST! ★');
    } else {
      updateEl(gameoverEntity, 'go-new-best', '');
    }

    // XP
    const xpEarned = Math.round(hits * 5 + bestCombo * 2 + (mode === 'pattern' ? patternRound * 10 : 0) +
      (mode === 'tournament' ? (tournamentRound + 1) * 15 : 0) +
      bestSessionStreak * 1.5 + (activeModifiers.size > 0 ? 20 : 0));
    const leveled = addXP(xpEarned);
    let xpText = `+${xpEarned} XP`;
    if (leveled > 0) { xpText += ` — LEVEL UP! (Lv ${save.level})`; audio.playLevelUp(); }
    updateEl(gameoverEntity, 'go-xp', xpText);

    // Streak display
    if (bestSessionStreak >= 5) {
      updateEl(gameoverEntity, 'go-streak', `🔥 Best Streak: ${bestSessionStreak} consecutive`);
    } else {
      updateEl(gameoverEntity, 'go-streak', '');
    }

    // Modifier display
    if (activeModifiers.size > 0) {
      const modNames = Array.from(activeModifiers).map(id => {
        const m = MODIFIERS.find(x => x.id === id);
        return m ? m.icon + ' ' + m.name : id;
      }).join(', ');
      updateEl(gameoverEntity, 'go-modifiers', `Modifiers: ${modNames} (×${getModifierMultiplier().toFixed(2)})`);
    } else {
      updateEl(gameoverEntity, 'go-modifiers', '');
    }

    // Career stats
    save.totalGames++; save.totalWhacks += hits; save.totalMisses += misses;
    save.totalBombsHit += sessionBombsHit; save.totalKingsHit += sessionKingsHit;
    save.totalGhostsHit += sessionGhostsHit; save.totalMysteryHit += sessionMysteryHit;
    save.totalPowerUps += sessionPowerUps;
    if (bestCombo > save.bestCombo) save.bestCombo = bestCombo;
    if (bestSessionStreak > save.bestStreak) save.bestStreak = bestSessionStreak;
    if (activeModifiers.size > 0) save.totalModifierGames++;
    save.totalTimePlayed += Math.round(gameTime);
    writeSave(save);

    checkSessionAchievements();
    checkAchievements();
  }

  function updateSettingsUI() {
    updateEl(settingsEntity, 'sfx-value', `${save.sfxVol}%`);
    updateEl(settingsEntity, 'music-value', `${save.musicVol}%`);
    updateEl(settingsEntity, 'theme-value', THEMES[save.themeIdx].name);
  }

  function updateAchievementsUI() {
    const unlocked = save.achievements.length;
    updateEl(achieveEntity, 'achieve-count', `${unlocked} / ${ACHIEVEMENTS.length} unlocked`);
    const pages = Math.ceil(ACHIEVEMENTS.length / 8);
    updateEl(achieveEntity, 'achieve-page-info', `${achievePage + 1} / ${pages}`);
    // Show achievement names for current page
    const start = achievePage * 8;
    for (let i = 0; i < 8; i++) {
      const a = ACHIEVEMENTS[start + i];
      if (a) {
        const isUnlocked = save.achievements.includes(a.id);
        updateEl(achieveEntity, `ach-name-${i}`, isUnlocked ? `${a.icon} ${a.name}` : `🔒 ${a.name}`);
        updateEl(achieveEntity, `ach-desc-${i}`, a.desc);
      } else {
        updateEl(achieveEntity, `ach-name-${i}`, '');
        updateEl(achieveEntity, `ach-desc-${i}`, '');
      }
    }
  }

  function updateStatsUI() {
    updateEl(statsEntity, 'stats-xp', `Level ${save.level} — ${save.xp} / ${xpForLevel(save.level)} XP`);
    updateEl(statsEntity, 'stat-games', `${save.totalGames}`);
    updateEl(statsEntity, 'stat-whacks', `${save.totalWhacks}`);
    updateEl(statsEntity, 'stat-misses', `${save.totalMisses}`);
    const totalAcc = (save.totalWhacks + save.totalMisses) > 0 ?
      Math.round(save.totalWhacks / (save.totalWhacks + save.totalMisses) * 100) : 0;
    updateEl(statsEntity, 'stat-accuracy', `${totalAcc}%`);
    updateEl(statsEntity, 'stat-combo', `x${save.bestCombo}`);
    updateEl(statsEntity, 'stat-streak', `${save.bestStreak}`);
    updateEl(statsEntity, 'stat-perfect', `${save.perfectRounds}`);
    updateEl(statsEntity, 'stat-modgames', `${save.totalModifierGames}`);
    const mins = Math.round(save.totalTimePlayed / 60);
    updateEl(statsEntity, 'stat-time', mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
    updateEl(statsEntity, 'stat-hs-classic', `${save.highScores['classic'] || 0}`);
    updateEl(statsEntity, 'stat-hs-survival', `${save.highScores['survival'] || 0}`);
    const ta = save.highScores['timeattack'];
    updateEl(statsEntity, 'stat-hs-timeattack', ta && ta < 999 ? `${ta.toFixed(1)}s` : '—');
    updateEl(statsEntity, 'stat-hs-speed', `${save.highScores['speed'] || 0}`);
    updateEl(statsEntity, 'stat-hs-pattern', `${save.highScores['pattern'] || 0}`);
    updateEl(statsEntity, 'stat-hs-frenzy', `${save.highScores['frenzy'] || 0}`);
    updateEl(statsEntity, 'stat-hs-tournament', `${save.tournamentBest || 0}`);
  }

  function updateShopUI() {
    MALLET_SKINS.forEach((skin, i) => {
      const unlocked = save.level >= skin.unlockLevel;
      const equipped = save.malletIdx === i;
      const label = equipped ? `${skin.icon} ${skin.name} ★` :
                    unlocked ? `${skin.icon} ${skin.name}` :
                    `🔒 Lv ${skin.unlockLevel}`;
      updateEl(shopEntity, `mallet-name-${i}`, label);
    });
  }

  function updateTournamentTransUI() {
    updateEl(tournamentEntity, 'tourn-round', `ROUND ${tournamentRound + 1} COMPLETE!`);
    updateEl(tournamentEntity, 'tourn-score', `Round Score: ${score.toLocaleString()}`);
    tournamentTotalScore += score;
    updateEl(tournamentEntity, 'tourn-total', `Total: ${tournamentTotalScore.toLocaleString()}`);
    updateEl(tournamentEntity, 'tourn-next', `Next: Round ${tournamentRound + 2} of ${TOURNAMENT_ROUNDS}`);
  }

  function updateModifiersUI() {
    MODIFIERS.forEach((mod, i) => {
      const isOn = activeModifiers.has(mod.id);
      updateEl(modifiersEntity, `mod-status-${i}`, isOn ? '✅ ON' : 'OFF');
      updateEl(modifiersEntity, `mod-name-${i}`, mod.name);
      updateEl(modifiersEntity, `mod-desc-${i}`, mod.desc);
      updateEl(modifiersEntity, `mod-icon-${i}`, mod.icon);
      updateEl(modifiersEntity, `mod-mult-${i}`, `×${mod.scoreMultiplier}`);
    });
    const totalMult = getModifierMultiplier();
    updateEl(modifiersEntity, 'mod-total-text', `TOTAL MULTIPLIER: ×${totalMult.toFixed(2)}`);
  }

  // ─── Pattern Mode Logic ─────────────────────────────────────

  function startPatternRound() {
    patternSequence.push(Math.floor(Math.random() * HOLES.length));
    patternShowIdx = 0; patternShowTimer = 0;
    clearAllTargets();
    switchState('pattern_show');
  }

  function handlePatternInput(holeIdx: number) {
    if (patternSequence[patternInputIdx] === holeIdx) {
      patternInputIdx++;
      audio.playPatternNote(patternInputIdx);
      score += 100 * (patternRound + 1);
      hits++;
      triggerMalletSwing();

      if (patternInputIdx >= patternSequence.length) {
        patternRound++;
        combo++;
        if (combo > bestCombo) bestCombo = combo;
        clearAllTargets();
        setTimeout(() => startPatternRound(), 500);
      }
    } else {
      audio.playMiss();
      lives--;
      combo = 0;
      misses++;
      if (lives <= 0) endGame();
      else { clearAllTargets(); setTimeout(() => startPatternRound(), 500); }
    }
  }


  // ─── Game End ────────────────────────────────────────────────

  function endGame() {
    clearAllTargets();
    activePowerUp = null;

    // Tournament: transition to next round if not final and lives > 0
    if (mode === 'tournament' && lives > 0 && tournamentRound < TOURNAMENT_ROUNDS - 1) {
      switchState('tournament_transition');
      return;
    }

    switchState('gameover');
  }

  // ─── Input Handling ─────────────────────────────────────────

  container.addEventListener('pointerdown', (event) => {
    if (state !== 'playing' && state !== 'pattern_input') return;

    const cam = world.camera;
    if (!cam) return;

    const rect = container.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const origin = new Vector3();
    const direction = new Vector3(ndcX, ndcY, 0.5);
    direction.unproject(cam);
    origin.copy(cam.position);
    direction.sub(origin).normalize();

    let closestDist = Infinity;
    let closestTarget: ActiveTarget | null = null;

    for (const t of activeTargets) {
      if (!t.alive || t.sinking) continue;
      const tPos = t.mesh.position;
      const oc = new Vector3().subVectors(origin, tPos);
      const radius = 0.2 * (activePowerUp?.type === 'sizeup' ? 1.4 : 1);
      const a = direction.dot(direction);
      const b = 2 * oc.dot(direction);
      const c2 = oc.dot(oc) - radius * radius;
      const disc = b * b - 4 * a * c2;
      if (disc < 0) continue;
      const dist = (-b - Math.sqrt(disc)) / (2 * a);
      if (dist > 0 && dist < closestDist) {
        closestDist = dist; closestTarget = t;
      }
    }

    if (closestTarget) {
      if (state === 'pattern_input') handlePatternInput(closestTarget.holeIdx);
      else hitTarget(closestTarget);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state === 'playing') switchState('pause');
      else if (state === 'pause') switchState('playing');
    }
  });

  // ─── XR Input ────────────────────────────────────────────────

  function checkXRInput() {
    const rightGP = (world.input as any).xr?.gamepads?.right;
    const leftGP = (world.input as any).xr?.gamepads?.left;

    if (rightGP) {
      const triggerDown = rightGP.getButtonDown?.(InputComponent.Trigger);
      if (triggerDown) onControllerSelect('right');
      const bDown = rightGP.getButtonDown?.(InputComponent.B_Button);
      if (bDown && state === 'playing') switchState('pause');
    }

    if (leftGP) {
      const triggerDown = leftGP.getButtonDown?.(InputComponent.Trigger);
      if (triggerDown) onControllerSelect('left');
    }
  }

  function onControllerSelect(hand: 'left' | 'right') {
    if (state !== 'playing' && state !== 'pattern_input') return;

    // Get controller ray from XR input
    const xrInput = (world.input as any).xr;
    if (!xrInput) return;

    // Use the player space entities for ray origin/direction
    const raySpaces = (world as any).playerSpaceEntities?.raySpaces;
    const raySpace = hand === 'right' ? raySpaces?.right : raySpaces?.left;
    let origin: Vector3;
    let direction: Vector3;

    if (raySpace?.object3D) {
      origin = new Vector3();
      direction = new Vector3(0, 0, -1);
      raySpace.object3D.getWorldPosition(origin);
      raySpace.object3D.getWorldDirection(direction);
      direction.negate(); // forward is -Z
    } else {
      // Fallback: use controller grip space or headset forward
      const gripSpaces = (world as any).playerSpaceEntities?.gripSpaces;
      const grip = hand === 'right' ? gripSpaces?.right : gripSpaces?.left;
      if (grip?.object3D) {
        origin = new Vector3();
        direction = new Vector3(0, 0, -1);
        grip.object3D.getWorldPosition(origin);
        grip.object3D.getWorldDirection(direction);
        direction.negate();
      } else {
        // Last fallback: head position aiming forward
        const cam = world.camera;
        if (!cam) return;
        origin = new Vector3().copy(cam.position);
        direction = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      }
    }

    // Raycast against targets using sphere intersection
    let closestDist = Infinity;
    let closestTarget: ActiveTarget | null = null;

    for (const t of activeTargets) {
      if (!t.alive || t.sinking) continue;
      const tPos = t.mesh.position;
      const oc = new Vector3().subVectors(origin, tPos);
      const radius = 0.2 * (activePowerUp?.type === 'sizeup' ? 1.4 : 1) *
        (activeModifiers.has('tinyTargets') ? 0.6 : 1);
      const a = direction.dot(direction);
      const b = 2 * oc.dot(direction);
      const c2 = oc.dot(oc) - radius * radius;
      const disc = b * b - 4 * a * c2;
      if (disc < 0) continue;
      const dist = (-b - Math.sqrt(disc)) / (2 * a);
      if (dist > 0 && dist < closestDist) {
        closestDist = dist; closestTarget = t;
      }
    }

    if (closestTarget) {
      if (state === 'pattern_input') handlePatternInput(closestTarget.holeIdx);
      else hitTarget(closestTarget);
    }

    triggerMalletSwing();
  }

  // ─── Update Loop ─────────────────────────────────────────────

  let lastTime = performance.now();

  const _origWorldUpdate = world.update.bind(world);
  (world as any).update = (delta: number, time: number) => {
    _origWorldUpdate(delta, time);
    gameUpdate();
  };

  function gameUpdate() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Deferred UI binding
    if (!uiBound) {
      uiBindDelay += dt;
      if (uiBindDelay > 0.5) {
        bindAllUI();
        switchState('title');
      }
      return;
    }

    // XR input
    try { checkXRInput(); } catch {}

    // Particles & effects
    updateParticles(dt);
    updateShake(dt);
    updateMallet(dt);
    updateRingBursts(dt);
    updateFlash(dt);
    updateFloorPulse(dt);

    // Animate energy orbs
    const tNow = performance.now() / 1000;
    energyOrbs.forEach(orb => {
      orb.angle += orb.speed * dt;
      const x = Math.cos(orb.angle) * orb.radius;
      const z = -2 + Math.sin(orb.angle) * orb.radius;
      const bobY = orb.height + Math.sin(tNow * 0.8 + orb.angle) * 0.3;
      orb.mesh.position.set(x, bobY, z);
      orb.glow.position.copy(orb.mesh.position);
      const pulse = 0.15 + Math.sin(tNow * 2 + orb.angle * 3) * 0.08;
      (orb.glow.material as MeshBasicMaterial).opacity = pulse;
    });

    // Combo timer
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) setComboVisible(false);
    }

    // Toast timer
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) setToastVisible(false);
    }

    // Power-up timer
    if (activePowerUp) {
      activePowerUp.timeLeft -= dt;
      setPowerUpVisible(true);
      updateEl(powerupEntity, 'powerup-name', activePowerUp.name);
      updateEl(powerupEntity, 'powerup-time', `${Math.ceil(activePowerUp.timeLeft)}s`);
      if (activePowerUp.timeLeft <= 0) {
        activePowerUp = null;
        setPowerUpVisible(false);
      }
    }

    // Animate hole rings
    const t = now / 1000;
    holeMeshes.forEach((h, i) => {
      const pulse = 0.5 + Math.sin(t * 2 + i * 0.5) * 0.15;
      (h.ring.material as MeshStandardMaterial).emissiveIntensity = pulse;
    });

    // Mallet glow pulse
    const glowPulse = 0.2 + Math.sin(t * 3) * 0.1;
    (malletGlow.material as MeshBasicMaterial).opacity = glowPulse;

    // ─── State Updates ──────────────────────────────────────

    switch (state) {
      case 'countdown': {
        countdownTimer += dt;
        const newVal = 3 - Math.floor(countdownTimer);
        if (newVal !== countdownVal && newVal > 0) {
          countdownVal = newVal;
          updateEl(countdownEntity, 'cd-value', `${countdownVal}`);
          audio.playCountdown();
        }
        if (countdownTimer >= 3) {
          updateEl(countdownEntity, 'cd-value', 'GO!');
          audio.playGo();
          setTimeout(() => { if (state === 'countdown') switchState('playing'); }, 400);
        }
        break;
      }

      case 'playing': {
        gameTime += dt;
        updateDifficulty();

        // Time-based end
        if (mode !== 'zen' && mode !== 'survival' && mode !== 'timeattack' && mode !== 'pattern') {
          if (gameTime >= timeLimit) { endGame(); break; }
        }

        // Life check
        if ((mode === 'survival' || mode === 'frenzy' || mode === 'tournament') && lives <= 0) { endGame(); break; }

        // Time Attack completion
        if (mode === 'timeattack' && hits >= 50) { endGame(); break; }

        // Zen achievement
        if (mode === 'zen' && gameTime >= 300 && !save.achievements.includes('zen_master')) {
          save.achievements.push('zen_master');
          showToast('🏆 Zen Master', '5 minutes of zen!');
          audio.playAchievement(); writeSave(save);
        }

        // Spawn targets
        spawnTimer += dt;
        const interval = getSpawnInterval();
        if (spawnTimer >= interval) {
          spawnTimer -= interval;
          const numToSpawn = mode === 'frenzy' ? Math.min(3, HOLES.length - activeTargets.filter(x => x.alive).length) : 1;
          for (let i = 0; i < numToSpawn; i++) {
            const hole = pickEmptyHole();
            if (hole >= 0) {
              let typeIdx: number;
              if (mode === 'daily') {
                typeIdx = Math.floor(nextDailyRng() * (TARGET_TYPES.length - 1));
              } else {
                typeIdx = pickTargetType();
              }
              spawnTarget(hole, typeIdx);
            }
          }
        }

        // Update active targets
        for (let i = activeTargets.length - 1; i >= 0; i--) {
          const at = activeTargets[i];
          const hole = HOLES[at.holeIdx];

          if (at.rising) {
            at.riseT += dt * 4;
            const y = -0.15 + at.riseT * 0.45;
            at.mesh.position.set(hole.x, Math.min(y, 0.3), hole.z);
            at.glow.position.copy(at.mesh.position);
            at.edges.position.copy(at.mesh.position);
            if (at.riseT >= 1) at.rising = false;
          } else if (at.sinking) {
            at.sinkT += dt * 5;
            const y = 0.3 - at.sinkT * 0.6;
            at.mesh.position.set(hole.x, Math.max(y, -0.3), hole.z);
            at.glow.position.copy(at.mesh.position);
            at.edges.position.copy(at.mesh.position);
            if (at.sinkT >= 1) { destroyTarget(at); continue; }
          } else if (at.alive) {
            at.timeLeft -= dt;

            // Magnet power-up: targets stay longer when active
            if (activePowerUp?.type === 'magnet' && at.timeLeft < 0.5 && at.timeLeft > 0) {
              at.timeLeft += dt * 0.8; // slow decay when magnet active
            }

            // Ghost flickering (or ghostMode modifier)
            if (TARGET_TYPES[at.typeIdx].isGhost || activeModifiers.has('ghostMode')) {
              at.ghostPhase += dt * 6;
              const opacity = 0.3 + Math.sin(at.ghostPhase) * 0.3;
              (at.mesh.material as MeshStandardMaterial).opacity = opacity;
              (at.mesh.material as MeshStandardMaterial).transparent = true;
            }

            // Bob
            const bob = Math.sin(t * 3 + at.holeIdx) * 0.02;
            at.mesh.position.y = 0.3 + bob;
            at.glow.position.copy(at.mesh.position);
            at.edges.position.copy(at.mesh.position);
            at.mesh.rotation.y += dt * 1.5;

            // Time-out warning glow
            if (at.timeLeft < 0.5 && at.timeLeft > 0) {
              const flash = Math.sin(at.timeLeft * 20) > 0 ? 1.2 : 0.3;
              (at.mesh.material as MeshStandardMaterial).emissiveIntensity = flash;
            }

            if (at.timeLeft <= 0) onTargetMissed(at);
          }
        }

        updateHUD();
        break;
      }

      case 'pattern_show': {
        patternShowTimer += dt;
        const showInterval = Math.max(0.3, 0.8 - patternRound * 0.03);
        if (patternShowIdx < patternSequence.length) {
          if (patternShowTimer >= showInterval) {
            patternShowTimer = 0;
            const hIdx = patternSequence[patternShowIdx];
            spawnTarget(hIdx, 0);
            audio.playPatternNote(patternShowIdx);
            setTimeout(() => {
              const at = activeTargets.find(x => x.holeIdx === hIdx && x.alive);
              if (at) removeTarget(at);
            }, showInterval * 600);
            patternShowIdx++;
          }
        } else if (patternShowTimer >= showInterval + 0.5) {
          clearAllTargets();
          switchState('pattern_input');
        }
        updateHUD();
        break;
      }

      case 'pattern_input': {
        const expectedHole = patternSequence[patternInputIdx];
        if (expectedHole !== undefined) {
          const hm = holeMeshes[expectedHole];
          if (hm) {
            const pulse = 0.7 + Math.sin(t * 4) * 0.3;
            (hm.ring.material as MeshStandardMaterial).emissiveIntensity = pulse;
          }
        }
        updateHUD();
        break;
      }

      case 'tournament_transition': {
        // Auto-advance handled by button press
        break;
      }
    }
  }
}

main().catch(console.error);
