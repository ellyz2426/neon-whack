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
  'pattern_input' | 'gameover' | 'pause' | 'achievements' | 'settings' | 'help' | 'stats' | 'shop';

type GameMode = 'classic' | 'survival' | 'timeattack' | 'zen' | 'speed' | 'pattern' | 'daily' | 'frenzy';

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
}

// ─── Audio Engine ────────────────────────────────────────────────

class AudioEngine {
  private ctx: AudioContext | null = null;
  sfxVol = 1.0; musicVol = 0.8;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;

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
    // noise burst
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
    // explosion noise
    const ng = c.createGain(); ng.gain.setValueAtTime(0.2 * this.sfxVol, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25); ng.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * 2;
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

  startDrone() {
    const c = this.getCtx(), now = c.currentTime;
    if (this.droneOsc1) return;
    this.droneGain = c.createGain();
    this.droneGain.gain.setValueAtTime(0.06 * this.musicVol, now);
    this.droneGain.connect(c.destination);
    this.droneOsc1 = c.createOscillator(); this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.value = 55; this.droneOsc1.connect(this.droneGain); this.droneOsc1.start(now);
    this.droneOsc2 = c.createOscillator(); this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.value = 82.5; this.droneOsc2.connect(this.droneGain); this.droneOsc2.start(now);
  }

  stopDrone() {
    try { this.droneOsc1?.stop(); this.droneOsc2?.stop(); } catch {}
    this.droneOsc1 = null; this.droneOsc2 = null; this.droneGain = null;
  }

  updateDroneVolume() {
    if (this.droneGain) {
      const c = this.getCtx();
      this.droneGain.gain.setTargetAtTime(0.06 * this.musicVol, c.currentTime, 0.1);
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
    highScores: {}, achievements: [],
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
  }

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

  // Holodeck walls
  function createWall(w: number, h: number, px: number, py: number, pz: number, ry: number) {
    const wall = new Mesh(
      new PlaneGeometry(w, h),
      new MeshStandardMaterial({ color: new Color('#080818'), transparent: true, opacity: 0.4, side: DoubleSide })
    );
    wall.position.set(px, py, pz);
    wall.rotation.y = ry;
    scene.add(wall);
    // Grid lines on wall
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

  // ─── Holes ───────────────────────────────────────────────────

  interface HoleMeshes { base: Mesh; ring: Mesh; inner: Mesh; }
  const holeMeshes: HoleMeshes[] = [];

  HOLES.forEach(h => {
    // Dark inner hole
    const inner = new Mesh(
      new CylinderGeometry(0.18, 0.18, 0.05, 24),
      new MeshBasicMaterial({ color: new Color('#000000') })
    );
    inner.position.set(h.x, 0.01, h.z); scene.add(inner);
    // Glowing ring
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
    // Base rim
    const base = new Mesh(
      new CylinderGeometry(0.25, 0.28, 0.06, 24),
      new MeshStandardMaterial({ color: new Color('#222244'), emissive: new Color('#111122'), emissiveIntensity: 0.3 })
    );
    base.position.set(h.x, 0.0, h.z); scene.add(base);

    holeMeshes.push({ base, ring, inner });
  });

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

  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh); particles.splice(i, 1); continue;
      }
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

    // Cap/top detail
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

    // Glow
    const glow = new Mesh(
      new SphereGeometry(0.22, 12, 8),
      new MeshBasicMaterial({
        color: new Color(ttype.color),
        transparent: true, opacity: 0.15, blending: AdditiveBlending,
      })
    );
    glow.position.copy(mesh.position);

    // Edge wireframe
    const edgeGeo = new EdgesGeometry(new SphereGeometry(0.16, 8, 6));
    const edges = new LineSegments(edgeGeo, new LineBasicMaterial({ color: new Color(ttype.edgeColor), transparent: true, opacity: 0.4 }));
    edges.position.copy(mesh.position);

    scene.add(mesh); scene.add(glow); scene.add(edges);

    const sizeMultiplier = activePowerUp?.type === 'sizeup' ? 1.4 : 1;
    mesh.scale.setScalar(sizeMultiplier);

    activeTargets.push({
      holeIdx, typeIdx, mesh, cap, glow, edges,
      timeLeft: ttype.stayTime * (activePowerUp?.type === 'timeslow' ? 1.8 : 1) *
        (activePowerUp?.type === 'freeze' ? 2.5 : 1),
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
      // Tank: flash but don't destroy yet
      audio.playWhack(1.2);
      spawnParticles(t.mesh.position.x, t.mesh.position.y + 0.15, t.mesh.position.z, TARGET_TYPES[t.typeIdx].color, 4);
      return;
    }

    const ttype = TARGET_TYPES[t.typeIdx];

    if (ttype.isBomb) {
      audio.playBomb();
      spawnParticles(t.mesh.position.x, t.mesh.position.y + 0.15, t.mesh.position.z, '#ff2200', 15);
      score += ttype.points;
      combo = 0;
      if (mode === 'survival' || mode === 'frenzy') { lives--; }
      removeTarget(t);
      return;
    }

    // Mystery: random points
    let pts = ttype.points;
    if (ttype.name === 'MYSTERY') {
      const options = [50, 100, 200, 300, 500, 1000];
      pts = options[Math.floor(Math.random() * options.length)];
      // Small chance of power-up
      if (Math.random() < 0.3) {
        const types: PowerUpState['type'][] = ['timeslow', 'sizeup', 'scorex2', 'magnet', 'freeze'];
        const names = ['⏳ TIME SLOW', '🔍 SIZE UP', '⭐ SCORE ×2', '🧲 MAGNET', '❄️ FREEZE'];
        const idx = Math.floor(Math.random() * types.length);
        activePowerUp = { type: types[idx], name: names[idx], timeLeft: 10 };
        audio.playPowerUp();
        showToast(names[idx], '10s active');
      }
    }

    const multiplier = (activePowerUp?.type === 'scorex2' ? 2 : 1);
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    const comboMult = 1 + Math.min(combo - 1, 9) * 0.1;
    const finalPts = Math.round(pts * comboMult * multiplier);
    score += finalPts;
    hits++;

    audio.playWhack(1.0 + Math.min(combo, 10) * 0.05);
    if (combo >= 3) audio.playCombo(combo);
    spawnParticles(t.mesh.position.x, t.mesh.position.y + 0.15, t.mesh.position.z, ttype.color, 10);

    // Show combo popup
    if (combo >= 3) {
      showCombo(`x${combo}`);
    }

    removeTarget(t);

    // Power-up drop chance
    if (Math.random() < 0.05 && !activePowerUp && ttype.name !== 'MYSTERY') {
      const types: PowerUpState['type'][] = ['timeslow', 'sizeup', 'scorex2', 'magnet', 'freeze'];
      const names = ['⏳ TIME SLOW', '🔍 SIZE UP', '⭐ SCORE ×2', '🧲 MAGNET', '❄️ FREEZE'];
      const idx = Math.floor(Math.random() * types.length);
      activePowerUp = { type: types[idx], name: names[idx], timeLeft: 10 };
      audio.playPowerUp();
      showToast(names[idx], '10s active');
    }
  }

  function onTargetMissed(t: ActiveTarget) {
    if (TARGET_TYPES[t.typeIdx].isBomb) return; // Bombs: good if they expire
    combo = 0;
    misses++;
    if (mode === 'survival') { lives--; }
    removeTarget(t);
  }

  // ─── Spawn Logic ─────────────────────────────────────────────

  function getSpawnWeights(): number[] {
    // [normal, bonus, speed, tank, bomb, ghost, king, mystery]
    const base = [50, 10, 12, 5, 10, 5, 1, 7];
    // Increase difficulty over time
    const diff = Math.min(difficultyLevel, 20);
    base[2] += diff * 1; // more speed
    base[3] += diff * 0.5; // more tanks
    base[4] += diff * 0.3; // more bombs
    base[5] += diff * 0.5; // more ghosts
    base[6] += diff * 0.1; // slightly more kings
    return base;
  }

  function pickTargetType(): number {
    const w = getSpawnWeights();
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++) {
      r -= w[i]; if (r <= 0) return i;
    }
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
                 Math.max(0.5, 1.5 - difficultyLevel * 0.08);
    return base;
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
    }
  }

  // ─── UI Panel Setup ──────────────────────────────────────────

  // Helper: Create a world-space panel entity
  function createPanel(config: string, x: number, y: number, z: number, mw: number, mh: number) {
    const e = world.createTransformEntity(undefined, { persistent: true });
    e.object3D!.position.set(x, y, z);
    e.addComponent(PanelUI, { config, maxWidth: mw, maxHeight: mh });
    return e;
  }

  // Helper: Create a head-following HUD
  function createHUD(config: string, ox: number, oy: number, oz: number, mw: number, mh: number) {
    const e = world.createTransformEntity(undefined, { persistent: true });
    e.addComponent(PanelUI, { config, maxWidth: mw, maxHeight: mh });
    e.addComponent(Follower, {
      target: (world as any).player?.head, offsetPosition: [ox, oy, oz],
      behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3,
    });
    return e;
  }

  // Create all panels (hidden initially via position)
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

  const hudEntity = createHUD('/ui/hud.json', 0, 0.2, -0.5, 0.45, 0.08);
  const comboEntity = createHUD('/ui/combo.json', 0, 0.05, -0.5, 0.2, 0.1);
  const toastEntity = createHUD('/ui/toast.json', 0, -0.1, -0.5, 0.3, 0.06);
  const powerupEntity = createHUD('/ui/powerup.json', -0.2, 0.15, -0.5, 0.2, 0.04);

  // All panels array for easy show/hide
  const allPanels = [
    titleEntity, modeEntity, countdownEntity, gameoverEntity, pauseEntity,
    settingsEntity, achieveEntity, statsEntity, helpEntity, shopEntity, patternEntity,
    hudEntity, comboEntity, toastEntity, powerupEntity,
  ];

  const HIDDEN_Y = -100;

  function hideAllPanels() {
    allPanels.forEach(p => {
      if (p === hudEntity || p === comboEntity || p === toastEntity || p === powerupEntity) {
        // HUD panels use follower offsets — we can't easily move them. Use visibility later.
        return;
      }
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

  // HUD visibility via follower offset
  let hudVisible = false, comboVisible = false, toastVisible = false, powerupVisible = false;

  function setHUDVisible(v: boolean) {
    hudVisible = v;
    const off: [number, number, number] = v ? [0, 0.2, -0.5] : [0, -100, -0.5];
    try { (hudEntity as any).removeComponent?.(Follower); } catch {}
    try { hudEntity.addComponent(Follower, { target: (world as any).player?.head, offsetPosition: off, behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 }); } catch {}
  }

  function setComboVisible(v: boolean) {
    comboVisible = v;
    const off: [number, number, number] = v ? [0, 0.05, -0.5] : [0, -100, -0.5];
    try { (comboEntity as any).removeComponent?.(Follower); } catch {}
    try { comboEntity.addComponent(Follower, { target: (world as any).player?.head, offsetPosition: off, behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 }); } catch {}
  }

  function setToastVisible(v: boolean) {
    toastVisible = v;
    const off: [number, number, number] = v ? [0, -0.1, -0.5] : [0, -100, -0.5];
    try { (toastEntity as any).removeComponent?.(Follower); } catch {}
    try { toastEntity.addComponent(Follower, { target: (world as any).player?.head, offsetPosition: off, behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 }); } catch {}
  }

  function setPowerUpVisible(v: boolean) {
    powerupVisible = v;
    const off: [number, number, number] = v ? [-0.2, 0.15, -0.5] : [-0.2, -100, -0.5];
    try { (powerupEntity as any).removeComponent?.(Follower); } catch {}
    try { powerupEntity.addComponent(Follower, { target: (world as any).player?.head, offsetPosition: off, behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 }); } catch {}
  }

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

  // ─── UI Binding (deferred to first frame to let panels load) ─

  let uiBound = false;
  let uiBindDelay = 0;

  function bindAllUI() {
    // Title
    bindBtn(titleEntity, 'start-btn', () => switchState('modeselect'));
    bindBtn(titleEntity, 'achieve-btn', () => { prevState = 'title'; switchState('achievements'); });
    bindBtn(titleEntity, 'stats-btn', () => { prevState = 'title'; switchState('stats'); });
    bindBtn(titleEntity, 'settings-btn', () => { prevState = 'title'; switchState('settings'); });
    bindBtn(titleEntity, 'help-btn', () => { prevState = 'title'; switchState('help'); });
    bindBtn(titleEntity, 'shop-btn', () => { prevState = 'title'; switchState('shop'); });

    // Mode select
    bindBtn(modeEntity, 'mode-classic', () => startGame('classic'));
    bindBtn(modeEntity, 'mode-survival', () => startGame('survival'));
    bindBtn(modeEntity, 'mode-timeattack', () => startGame('timeattack'));
    bindBtn(modeEntity, 'mode-zen', () => startGame('zen'));
    bindBtn(modeEntity, 'mode-speed', () => startGame('speed'));
    bindBtn(modeEntity, 'mode-pattern', () => startGame('pattern'));
    bindBtn(modeEntity, 'mode-daily', () => startGame('daily'));
    bindBtn(modeEntity, 'mode-frenzy', () => startGame('frenzy'));
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
    bindBtn(settingsEntity, 'music-down', () => { save.musicVol = Math.max(0, save.musicVol - 10); audio.musicVol = save.musicVol / 100; audio.updateDroneVolume(); writeSave(save); updateSettingsUI(); });
    bindBtn(settingsEntity, 'music-up', () => { save.musicVol = Math.min(100, save.musicVol + 10); audio.musicVol = save.musicVol / 100; audio.updateDroneVolume(); writeSave(save); updateSettingsUI(); });
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

    // Shop
    bindBtn(shopEntity, 'shop-back-btn', () => switchState(prevState));

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
        audio.startDrone();
        break;
      case 'modeselect':
        showPanel(modeEntity);
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
      case 'gameover':
        showPanel(gameoverEntity);
        audio.stopDrone();
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
    }
  }

  // ─── Game Start ──────────────────────────────────────────────

  function startGame(m: GameMode) {
    mode = m;
    score = 0; combo = 0; bestCombo = 0; hits = 0; misses = 0;
    gameTime = 0; difficultyLevel = 1; spawnTimer = 0;
    activePowerUp = null;
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
    }

    gameStartTime = Date.now();
    audio.startDrone();

    if (m === 'pattern') {
      switchState('pattern_show');
    } else {
      switchState('countdown');
    }
  }

  // ─── Achievements ────────────────────────────────────────────

  const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_whack', name: 'First Whack', desc: 'Hit your first target', icon: '🔨', check: () => save.totalWhacks >= 1 },
    { id: 'whack_50', name: 'Whack Master', desc: 'Hit 50 targets total', icon: '🔨', check: () => save.totalWhacks >= 50 },
    { id: 'whack_200', name: 'Whack Legend', desc: 'Hit 200 targets total', icon: '⚡', check: () => save.totalWhacks >= 200 },
    { id: 'whack_500', name: 'Whack God', desc: 'Hit 500 targets total', icon: '👑', check: () => save.totalWhacks >= 500 },
    { id: 'whack_1000', name: 'Whack Eternal', desc: 'Hit 1000 targets total', icon: '🌟', check: () => save.totalWhacks >= 1000 },
    { id: 'combo_5', name: 'Combo Starter', desc: '5x combo in one game', icon: '🔥', check: () => save.bestCombo >= 5 },
    { id: 'combo_10', name: 'Combo Pro', desc: '10x combo in one game', icon: '🔥', check: () => save.bestCombo >= 10 },
    { id: 'combo_20', name: 'Combo Master', desc: '20x combo in one game', icon: '💥', check: () => save.bestCombo >= 20 },
    { id: 'combo_50', name: 'Combo Deity', desc: '50x combo in one game', icon: '☄️', check: () => save.bestCombo >= 50 },
    { id: 'score_1k', name: 'Score Hunter', desc: 'Score 1,000 in a game', icon: '🎯', check: () => Object.values(save.highScores).some(s => s >= 1000) },
    { id: 'score_5k', name: 'Score Champion', desc: 'Score 5,000 in a game', icon: '🏆', check: () => Object.values(save.highScores).some(s => s >= 5000) },
    { id: 'score_10k', name: 'Score Legend', desc: 'Score 10,000 in a game', icon: '💎', check: () => Object.values(save.highScores).some(s => s >= 10000) },
    { id: 'score_25k', name: 'Score God', desc: 'Score 25,000 in a game', icon: '👑', check: () => Object.values(save.highScores).some(s => s >= 25000) },
    { id: 'survival_50', name: 'Survivor', desc: 'Hit 50 in Survival mode', icon: '❤️', check: () => (save.highScores['survival'] || 0) >= 50 },
    { id: 'survival_100', name: 'Iron Will', desc: 'Hit 100 in Survival mode', icon: '🛡️', check: () => (save.highScores['survival'] || 0) >= 100 },
    { id: 'timeattack_30', name: 'Speed Demon', desc: 'Time Attack under 30s', icon: '⏱', check: () => (save.highScores['timeattack'] || 999) <= 30 },
    { id: 'timeattack_20', name: 'Lightning Hands', desc: 'Time Attack under 20s', icon: '⚡', check: () => (save.highScores['timeattack'] || 999) <= 20 },
    { id: 'speed_5k', name: 'Rush Hour', desc: 'Score 5,000 in Speed Rush', icon: '🚀', check: () => (save.highScores['speed'] || 0) >= 5000 },
    { id: 'pattern_5', name: 'Pattern Novice', desc: 'Reach round 5 in Pattern mode', icon: '🧠', check: () => (save.highScores['pattern'] || 0) >= 5 },
    { id: 'pattern_10', name: 'Pattern Master', desc: 'Reach round 10 in Pattern mode', icon: '🧠', check: () => (save.highScores['pattern'] || 0) >= 10 },
    { id: 'frenzy_8k', name: 'Frenzy Beast', desc: 'Score 8,000 in Frenzy', icon: '🔥', check: () => (save.highScores['frenzy'] || 0) >= 8000 },
    { id: 'games_10', name: 'Regular', desc: 'Play 10 games', icon: '🎮', check: () => save.totalGames >= 10 },
    { id: 'games_50', name: 'Dedicated', desc: 'Play 50 games', icon: '🎮', check: () => save.totalGames >= 50 },
    { id: 'games_100', name: 'Obsessed', desc: 'Play 100 games', icon: '🕹️', check: () => save.totalGames >= 100 },
    { id: 'level_10', name: 'Rising Star', desc: 'Reach level 10', icon: '⭐', check: () => save.level >= 10 },
    { id: 'level_25', name: 'Veteran', desc: 'Reach level 25', icon: '⭐', check: () => save.level >= 25 },
    { id: 'level_50', name: 'Grandmaster', desc: 'Reach level 50', icon: '🌟', check: () => save.level >= 50 },
    { id: 'accuracy_90', name: 'Sharpshooter', desc: '90% accuracy in a game (10+ hits)', icon: '🎯', check: () => false }, // checked at end
    { id: 'accuracy_100', name: 'Perfect Aim', desc: '100% accuracy in a game (10+ hits)', icon: '💯', check: () => false },
    { id: 'zen_master', name: 'Zen Master', desc: 'Play Zen mode for 5 minutes', icon: '🧘', check: () => false },
    { id: 'no_bombs', name: 'Bomb Dodger', desc: 'Classic game without hitting a bomb', icon: '💣', check: () => false },
    { id: 'king_slayer', name: 'King Slayer', desc: 'Hit a King target', icon: '👑', check: () => false },
    { id: 'ghost_buster', name: 'Ghost Buster', desc: 'Hit 10 Ghost targets total', icon: '👻', check: () => false },
    { id: 'all_mallets', name: 'Collector', desc: 'Unlock all mallet skins', icon: '🔨', check: () => save.level >= 50 },
    { id: 'daily_3', name: 'Streak', desc: 'Play 3 Daily Challenges', icon: '📅', check: () => false },
    { id: 'time_30m', name: 'Dedicated Player', desc: 'Play for 30 minutes total', icon: '⏰', check: () => save.totalTimePlayed >= 1800 },
    { id: 'time_1h', name: 'Marathon', desc: 'Play for 1 hour total', icon: '⏰', check: () => save.totalTimePlayed >= 3600 },
    { id: 'mystery_10', name: 'Mystery Fan', desc: 'Hit 10 Mystery targets', icon: '🎁', check: () => false },
    { id: 'perfect_classic', name: 'Perfect Classic', desc: '0 misses in Classic mode', icon: '💎', check: () => false },
    { id: 'powerup_5', name: 'Powered Up', desc: 'Activate 5 power-ups', icon: '⚡', check: () => false },
  ];

  // Session-level achievement trackers
  let sessionBombsHit = 0, sessionKingsHit = 0, sessionGhostsHit = 0;
  let sessionMysteryHit = 0, sessionPowerUps = 0;

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
    // Achievements that need session context
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
      showToast('🏆 Bomb Dodger', 'No bombs hit!');
      audio.playAchievement();
    }
    if (mode === 'classic' && misses === 0 && hits >= 10 && !save.achievements.includes('perfect_classic')) {
      save.achievements.push('perfect_classic');
      showToast('🏆 Perfect Classic', '0 misses!');
      audio.playAchievement();
    }
    writeSave(save);
  }

  // ─── UI Update Functions ────────────────────────────────────

  function updateTitleUI() {
    const best = save.highScores['classic'] || 0;
    updateEl(titleEntity, 'highscore-display', best > 0 ? `HIGH SCORE: ${best.toLocaleString()}` : '');
  }

  function updateHUD() {
    updateEl(hudEntity, 'hud-score', score.toLocaleString());
    updateEl(hudEntity, 'hud-combo', combo > 1 ? `x${combo}` : 'x1');

    if (mode === 'timeattack') {
      updateEl(hudEntity, 'hud-time', `${hits}/50`);
    } else if (mode === 'zen') {
      updateEl(hudEntity, 'hud-time', '∞');
    } else if (mode === 'pattern') {
      updateEl(hudEntity, 'hud-time', `R${patternRound + 1}`);
    } else {
      const remaining = Math.max(0, timeLimit - gameTime);
      updateEl(hudEntity, 'hud-time', `${Math.ceil(remaining)}`);
    }

    if (mode === 'survival' || mode === 'frenzy') {
      updateEl(hudEntity, 'hud-lives', '♥'.repeat(Math.max(0, lives)));
    } else {
      updateEl(hudEntity, 'hud-lives', '—');
    }

    updateEl(hudEntity, 'hud-level', `${difficultyLevel}`);
  }

  function updateGameOverUI() {
    const modeNames: Record<string, string> = {
      classic: 'CLASSIC', survival: 'SURVIVAL', timeattack: 'TIME ATTACK',
      zen: 'ZEN', speed: 'SPEED RUSH', pattern: 'PATTERN', daily: 'DAILY', frenzy: 'FRENZY',
    };
    updateEl(gameoverEntity, 'go-subtitle', `${modeNames[mode] || mode.toUpperCase()} MODE`);

    if (mode === 'timeattack') {
      updateEl(gameoverEntity, 'go-title', hits >= 50 ? 'COMPLETE!' : 'TIME UP');
      updateEl(gameoverEntity, 'go-score', `${gameTime.toFixed(1)}s`);
    } else if (mode === 'pattern') {
      updateEl(gameoverEntity, 'go-title', 'GAME OVER');
      updateEl(gameoverEntity, 'go-score', `Round ${patternRound}`);
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

    // High score check
    let scoreVal = mode === 'timeattack' ? (hits >= 50 ? gameTime : 999) :
                   mode === 'pattern' ? patternRound : score;
    const prevBest = save.highScores[mode] || (mode === 'timeattack' ? 999 : 0);
    const isBetter = mode === 'timeattack' ? scoreVal < prevBest : scoreVal > prevBest;
    if (isBetter) {
      save.highScores[mode] = scoreVal;
      updateEl(gameoverEntity, 'go-new-best', '★ NEW BEST! ★');
    } else {
      updateEl(gameoverEntity, 'go-new-best', '');
    }

    // XP award
    const xpEarned = Math.round(hits * 5 + bestCombo * 2 + (mode === 'pattern' ? patternRound * 10 : 0));
    const leveled = addXP(xpEarned);
    let xpText = `+${xpEarned} XP`;
    if (leveled > 0) xpText += ` — LEVEL UP! (Lv ${save.level})`;
    updateEl(gameoverEntity, 'go-xp', xpText);

    // Update career stats
    save.totalGames++; save.totalWhacks += hits; save.totalMisses += misses;
    if (bestCombo > save.bestCombo) save.bestCombo = bestCombo;
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
    // Note: dynamic list population requires creating child elements which uikitml doesn't support
    // We'll show page info and let the static list handle it
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
    const mins = Math.round(save.totalTimePlayed / 60);
    updateEl(statsEntity, 'stat-time', mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
    updateEl(statsEntity, 'stat-hs-classic', `${save.highScores['classic'] || 0}`);
    updateEl(statsEntity, 'stat-hs-survival', `${save.highScores['survival'] || 0}`);
    const ta = save.highScores['timeattack'];
    updateEl(statsEntity, 'stat-hs-timeattack', ta && ta < 999 ? `${ta.toFixed(1)}s` : '—');
    updateEl(statsEntity, 'stat-hs-speed', `${save.highScores['speed'] || 0}`);
    updateEl(statsEntity, 'stat-hs-pattern', `${save.highScores['pattern'] || 0}`);
    updateEl(statsEntity, 'stat-hs-frenzy', `${save.highScores['frenzy'] || 0}`);
  }

  function updateShopUI() {
    // Shop items are rendered statically; we can't dynamically create child elements.
    // Use the toast to show equip/unlock info when interacted with.
  }

  // ─── Input Handling ─────────────────────────────────────────

  // Raycasting for target hits
  // Raycasting handled via manual sphere intersection in pointerdown handler

  // Click handler for browser + XR
  function handlePointerDown(event: PointerEvent | MouseEvent) {
    if (state === 'playing' || state === 'pattern_input') {
      // Raycast against active targets
      const rect = container.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Use Three.js raycaster from world
      const cam = (world as any).camera || (world as any).scene?.userData?.camera;

      // Simple distance-based hit check for targets
      checkTargetHits();
    }

    if (state === 'playing' && event instanceof KeyboardEvent) return;
  }

  // Check pointer/controller against targets
  function checkTargetHits() {
    // In VR: InputComponent handles select events
    // In browser: use mouse position raycasting
    // For simplicity, check if any target's click handler was triggered
  }

  // ─── XR Input via Controller ────────────────────────────────

  let prevTriggerRight = false;
  let prevTriggerLeft = false;

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
    // The PanelUI system handles button clicks via pointer events automatically.
    // For game targets, we need spatial raycast hit detection.
    if (state !== 'playing' && state !== 'pattern_input') return;
    // Targets are hit via their click events attached to meshes
  }

  // ─── Make Targets Clickable ─────────────────────────────────

  // We attach click detection via pointer events on the target meshes.
  // IWSDK pointer events work through the scene graph.
  // For browser: register container click handler with raycasting.

  container.addEventListener('pointerdown', (event) => {
    if (state !== 'playing' && state !== 'pattern_input') return;

    // Get camera from world
    const cam = world.camera;
    if (!cam) return;

    // Convert mouse to NDC
    const rect = container.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Create ray from camera
    const origin = new Vector3();
    const direction = new Vector3(ndcX, ndcY, 0.5);

    // Unproject
    direction.unproject(cam);
    origin.copy(cam.position);
    direction.sub(origin).normalize();

    // Check hit against active targets
    let closestDist = Infinity;
    let closestTarget: ActiveTarget | null = null;

    for (const t of activeTargets) {
      if (!t.alive || t.sinking) continue;
      const tPos = t.mesh.position;
      // Sphere intersection test
      const oc = new Vector3().subVectors(origin, tPos);
      const radius = 0.2 * (activePowerUp?.type === 'sizeup' ? 1.4 : 1);
      const a = direction.dot(direction);
      const b = 2 * oc.dot(direction);
      const c = oc.dot(oc) - radius * radius;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      const dist = (-b - Math.sqrt(disc)) / (2 * a);
      if (dist > 0 && dist < closestDist) {
        closestDist = dist; closestTarget = t;
      }
    }

    if (closestTarget) {
      if (state === 'pattern_input') {
        handlePatternInput(closestTarget.holeIdx);
      } else {
        hitTarget(closestTarget);
      }
    }
  });

  // Keyboard: Escape for pause, space for interactions
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state === 'playing') switchState('pause');
      else if (state === 'pause') switchState('playing');
    }
  });

  // ─── Pattern Mode Logic ─────────────────────────────────────

  function startPatternRound() {
    // Add a new step
    patternSequence.push(Math.floor(Math.random() * HOLES.length));
    patternShowIdx = 0;
    patternShowTimer = 0;
    clearAllTargets();
    switchState('pattern_show');
  }

  function handlePatternInput(holeIdx: number) {
    if (patternSequence[patternInputIdx] === holeIdx) {
      patternInputIdx++;
      audio.playPatternNote(patternInputIdx);
      score += 100 * (patternRound + 1);
      hits++;

      if (patternInputIdx >= patternSequence.length) {
        // Round complete!
        patternRound++;
        combo++;
        if (combo > bestCombo) bestCombo = combo;
        clearAllTargets();
        setTimeout(() => startPatternRound(), 500);
      }
    } else {
      // Wrong! Lose a life
      audio.playMiss();
      lives--;
      combo = 0;
      misses++;
      if (lives <= 0) {
        endGame();
      } else {
        clearAllTargets();
        setTimeout(() => startPatternRound(), 500);
      }
    }
  }

  // ─── Game End ────────────────────────────────────────────────

  function endGame() {
    clearAllTargets();
    activePowerUp = null;
    sessionBombsHit = 0; sessionKingsHit = 0; sessionGhostsHit = 0;
    sessionMysteryHit = 0; sessionPowerUps = 0;
    switchState('gameover');
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

    // Particles
    updateParticles(dt);

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
          setTimeout(() => {
            if (state === 'countdown') switchState('playing');
          }, 400);
        }
        break;
      }

      case 'playing': {
        gameTime += dt;
        updateDifficulty();

        // Time-based game end
        if (mode !== 'zen' && mode !== 'survival' && mode !== 'timeattack' && mode !== 'pattern') {
          if (gameTime >= timeLimit) { endGame(); break; }
        }

        // Survival/Frenzy life check
        if ((mode === 'survival' || mode === 'frenzy') && lives <= 0) { endGame(); break; }

        // Time Attack: 50 hits check
        if (mode === 'timeattack' && hits >= 50) { endGame(); break; }

        // Zen: check for long play achievement
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
                typeIdx = Math.floor(nextDailyRng() * (TARGET_TYPES.length - 1)); // no mystery in daily
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
            if (at.riseT >= 1) { at.rising = false; }
          } else if (at.sinking) {
            at.sinkT += dt * 5;
            const y = 0.3 - at.sinkT * 0.6;
            at.mesh.position.set(hole.x, Math.max(y, -0.3), hole.z);
            at.glow.position.copy(at.mesh.position);
            at.edges.position.copy(at.mesh.position);
            if (at.sinkT >= 1) { destroyTarget(at); continue; }
          } else if (at.alive) {
            at.timeLeft -= dt;

            // Ghost flickering
            if (TARGET_TYPES[at.typeIdx].isGhost) {
              at.ghostPhase += dt * 6;
              const opacity = 0.3 + Math.sin(at.ghostPhase) * 0.3;
              (at.mesh.material as MeshStandardMaterial).opacity = opacity;
            }

            // Bob animation
            const bob = Math.sin(t * 3 + at.holeIdx) * 0.02;
            at.mesh.position.y = 0.3 + bob;
            at.glow.position.copy(at.mesh.position);
            at.edges.position.copy(at.mesh.position);

            // Rotate slightly
            at.mesh.rotation.y += dt * 1.5;

            if (at.timeLeft <= 0) {
              onTargetMissed(at);
            }
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
            // Highlight hole
            const hIdx = patternSequence[patternShowIdx];
            spawnTarget(hIdx, 0); // Show normal target briefly
            audio.playPatternNote(patternShowIdx);

            // Auto-remove after brief flash
            setTimeout(() => {
              const at = activeTargets.find(x => x.holeIdx === hIdx && x.alive);
              if (at) removeTarget(at);
            }, showInterval * 600);

            patternShowIdx++;
          }
        } else if (patternShowTimer >= showInterval + 0.5) {
          clearAllTargets();
          // Now show all holes for player input
          switchState('pattern_input');
        }

        updateHUD();
        break;
      }

      case 'pattern_input': {
        // Waiting for player to click targets in correct order
        // Highlight expected hole subtly
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
    }
  }
}

main().catch(console.error);
