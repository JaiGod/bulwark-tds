/* Bulwark TDS - game data (units, enemies, maps, skins, quests) and procedural assets
   (WebAudio sound/music, canvas terrain, unit and enemy art). All original, no image or audio files. */
'use strict';
const T = 40, COLS = 24, ROWS = 12, W = COLS * T, H = ROWS * T;

/* Units. place: g=ground, c=cliff, b=both. range in tiles, rate = seconds per attack.
   ups: [cost, {stat deltas}] for levels 1..4. ab: ability unlocked at level 2. */
const UNITS = {
  picket:  { n:'Picket', role:'Rifle infantry', cost:250, price:0, place:'g', shape:'circle', gun:'rifle', c1:'#5f8f4e', c2:'#2f4a28', lim:10,
    s:{dmg:3, rate:.9, range:3.2, air:1},
    ups:[[150,{dmg:2}],[350,{rate:-.2,range:.4,det:1}],[900,{dmg:5}],[2200,{dmg:10,rate:-.15}]],
    ab:{n:'Frag Toss', cd:20, d:'Grenade: 60 splash damage'} },
  longshot:{ n:'Longshot', role:'Cliff sniper', cost:400, price:0, place:'c', shape:'diamond', gun:'long', c1:'#7a8a99', c2:'#39424b', lim:8,
    s:{dmg:14, rate:2.3, range:7, air:1, ap:.3},
    ups:[[300,{dmg:8}],[650,{det:1,rate:-.4}],[1600,{dmg:25,ap:.3}],[3500,{dmg:60,rate:-.5}]],
    ab:{n:'Deadeye', cd:30, d:'500 damage to the strongest enemy'} },
  mint:    { n:'Mint', role:'Cash generator', cost:600, price:0, place:'g', shape:'square', gun:'none', c1:'#d9b44a', c2:'#7a5b17', lim:6,
    s:{income:60, range:0},
    ups:[[500,{income:60}],[1000,{income:100}],[2000,{income:160}],[3800,{income:250}]],
    ab:{n:'Payday', cd:60, d:'Instant cash: 150 per level'} },
  scorcher:{ n:'Scorcher', role:'Flame thrower', cost:600, price:600, place:'g', shape:'hex', gun:'nozzle', c1:'#c4562e', c2:'#5a2112', lim:8,
    s:{dmg:2, rate:.15, range:2.2, burn:2, cone:1},
    ups:[[400,{dmg:1,range:.3}],[900,{burn:3}],[2000,{dmg:2,range:.4}],[4200,{dmg:4,burn:6}]],
    ab:{n:'Inferno', cd:25, d:'Ignite everything in range (30 dps)'} },
  thumper: { n:'Thumper', role:'Mortar', cost:800, price:900, place:'c', shape:'square', gun:'mortar', c1:'#6b6f3a', c2:'#33351a', lim:8,
    s:{dmg:14, rate:3, range:6.5, splash:1.2, min:1.5},
    ups:[[450,{dmg:8}],[1000,{splash:.4}],[2200,{dmg:20,rate:-.6}],[4800,{dmg:40,splash:.4}]],
    ab:{n:'Barrage', cd:28, d:'Rain 6 shells on the enemy line'} },
  rime:    { n:'Rime Adept', role:'Frost caster', cost:750, price:1100, place:'b', shape:'tri', gun:'orb', c1:'#5ab4d6', c2:'#1d4c63', lim:8,
    s:{dmg:4, rate:1.2, range:3, slow:.35, splash:.6, air:1},
    ups:[[450,{slow:.1}],[1000,{dmg:6,range:.4}],[2100,{freeze:.12}],[4400,{dmg:12,slow:.1}]],
    ab:{n:'Deep Freeze', cd:30, d:'Freeze everything in range for 2.5s'} },
  flak:    { n:'Flak Nest', role:'Anti-air', cost:650, price:1200, place:'g', shape:'hex', gun:'flak', c1:'#8b7d6b', c2:'#3e362c', lim:8,
    s:{dmg:5, rate:.8, range:4, air:1, airx:3, splash:.5},
    ups:[[400,{dmg:3}],[900,{range:.6,rate:-.15}],[2000,{dmg:8,det:1}],[4000,{dmg:15,airx:1}]],
    ab:{n:'Skyburst', cd:25, d:'200 damage to every flyer in range'} },
  spotter: { n:'Spotter', role:'Radar & detection', cost:500, price:1400, place:'c', shape:'circle', gun:'radar', c1:'#4f9a8f', c2:'#1f403b', lim:4,
    s:{range:3, det:1, aura:1},
    ups:[[300,{range:.5}],[700,{mark:.1}],[1500,{range:.7}],[3000,{mark:.1,range:.5}]],
    ab:{n:'Flare', cd:40, d:'Reveal all hidden enemies map-wide (8s)'} },
  arc:     { n:'Arc Coil', role:'Chain lightning', cost:900, price:1800, place:'g', shape:'circle', gun:'coil', c1:'#7d6bd6', c2:'#2d2466', lim:8,
    s:{dmg:10, rate:1.6, range:2.8, chain:3, shx:2},
    ups:[[500,{chain:1}],[1100,{dmg:8}],[2400,{chain:2,rate:-.4}],[5000,{dmg:25}]],
    ab:{n:'Overload', cd:30, d:'Stun everything in range for 2s'} },
  mender:  { n:'Mender Drone', role:'Support & repair', cost:700, price:2000, place:'b', shape:'circle', gun:'dish', c1:'#e8e8e8', c2:'#3c8f62', lim:4,
    s:{range:2.5, buff:.05, aura:1, cleanse:1},
    ups:[[400,{range:.5}],[800,{buff:.05}],[1500,{range:.5,buff:.05}],[3000,{buff:.1}]],
    ab:{n:'Patch', cd:45, d:'Repair the Bulwark for 10 HP'} },
  rotor:   { n:'Rotor', role:'Minigunner', cost:1100, price:2400, place:'g', shape:'square', gun:'minigun', c1:'#566573', c2:'#232b33', lim:8,
    s:{dmg:2, rate:.13, range:3, air:1},
    ups:[[600,{dmg:1}],[1300,{range:.5,det:1}],[2800,{dmg:2,rate:-.03}],[5500,{dmg:4}]],
    ab:{n:'Overdrive', cd:30, d:'Double fire rate for 6s'} },
  volley:  { n:'Volley', role:'Homing rockets', cost:1300, price:2800, place:'b', shape:'hex', gun:'pods', c1:'#9a4646', c2:'#3d1717', lim:6,
    s:{dmg:18, rate:2.2, range:5, splash:.8, air:1, homing:1},
    ups:[[700,{dmg:10}],[1500,{rate:-.5}],[3200,{dmg:20,splash:.3}],[6500,{dmg:45}]],
    ab:{n:'Salvo', cd:30, d:'Launch 8 rockets at once'} },
  marshal: { n:'Marshal', role:'Commander buff', cost:1200, price:3200, place:'g', shape:'diamond', gun:'flag', c1:'#2f5fa8', c2:'#132644', lim:3,
    s:{range:2.5, buff:.15, aura:1},
    ups:[[800,{buff:.05,range:.5}],[1800,{det:1}],[3600,{buff:.1}],[6000,{range:.5,buff:.05}]],
    ab:{n:'Rally', cd:45, d:'All units +50% fire rate for 8s'} },
  lancer:  { n:'Lancer', role:'Railgun', cost:1500, price:3800, place:'c', shape:'diamond', gun:'rail', c1:'#3a8fb0', c2:'#14384a', lim:5,
    s:{dmg:40, rate:3.5, range:6.5, pierce:1, ap:.5, air:1},
    ups:[[800,{dmg:25}],[1600,{det:1}],[3500,{dmg:50,rate:-.7}],[7000,{dmg:120}]],
    ab:{n:'Overcharge', cd:35, d:'Piercing 900 damage beam'} }
};
const UNIT_IDS = Object.keys(UNITS);

/* Enemies. hp, spd tiles/s, $ reward, leak damage, flags. */
const ENEMIES = {
  grunt:    { n:'Grunt',    hp:6,  spd:1.1, cash:4,  leak:2, r:9,  c:'#b86b4b' },
  dasher:   { n:'Dasher',   hp:4,  spd:2.2, cash:4,  leak:2, r:7,  c:'#e0b04a' },
  brute:    { n:'Brute',    hp:32, spd:.7,  cash:9,  leak:6, r:13, c:'#8c3f3f' },
  wisp:     { n:'Wisp',     hp:10, spd:1.3, cash:7,  leak:4, r:8,  c:'#9fd8e8', hidden:1 },
  glider:   { n:'Glider',   hp:12, spd:1.4, cash:7,  leak:4, r:9,  c:'#c58ee0', fly:1 },
  plated:   { n:'Plated',   hp:22, spd:.9,  cash:9,  leak:5, r:11, c:'#7f8790', armor:.5 },
  splitter: { n:'Splitter', hp:26, spd:.9,  cash:6,  leak:5, r:12, c:'#6fae5a', split:'splitling' },
  splitling:{ n:'Splitling',hp:6,  spd:1.6, cash:2,  leak:1, r:6,  c:'#9fd67f' },
  tender:   { n:'Tender',   hp:22, spd:.9,  cash:9,  leak:5, r:10, c:'#e07fa8', heal:1 },
  aegis:    { n:'Aegis',    hp:20, spd:.95, cash:10, leak:5, r:11, c:'#5c7fd6', shield:32 },
  jammer:   { n:'Jammer',   hp:26, spd:1,   cash:10, leak:5, r:11, c:'#d6d65c', jam:1 },
  phantom:  { n:'Phantom',  hp:18, spd:2,   cash:9,  leak:5, r:9,  c:'#b8b8ff', hidden:1 },
  juggernaut:{n:'Juggernaut',hp:520,spd:.5, cash:120,leak:40,r:20, c:'#5a5f66', armor:.4, mini:1 },
  warlord:  { n:'Warlord',  hp:900, spd:.55,cash:180,leak:60,r:21, c:'#a33a2a', spawn:'grunt', mini:1 },
  skyreaver:{ n:'Skyreaver',hp:760, spd:.75,cash:180,leak:50,r:20, c:'#7d3fae', fly:1, mini:1 },
  monolith: { n:'The Monolith', hp:9000, spd:.32, cash:1000, leak:9999, r:28, c:'#2b2b3a', armor:.25, boss:1 }
};
const UNLOCK = [['grunt',1],['dasher',3],['brute',5],['wisp',7],['glider',9],['plated',11],['splitter',13],['tender',16],['aegis',18],['jammer',21],['phantom',24]];
const WCOST = { grunt:1, dasher:1, brute:4, wisp:2.5, glider:2, plated:3.5, splitter:4, tender:3.5, aegis:3.5, jammer:4, phantom:3 };

/* Maps: paths of tile waypoints (may start/end off-grid), cliffs & blocks as [x,y,w,h]. */
const MAPS = [
  { n:'Meadow Gate', lvl:1, th:{g:'#4f7a3a',g2:'#5b8842',p:'#c9b07a',pe:'#8e7547',c:'#7d8a6a',cf:'#4d5640',dec:'grass',b:'#3f7fa6'},
    paths:[[[-1,2],[6,2],[6,8],[13,8],[13,3],[19,3],[19,9],[24,9]]],
    cliffs:[[9,3,3,3],[15,5,3,3],[1,5,3,2],[21,0,2,2],[2,10,3,2]], blocks:[[9,10,3,2]] },
  { n:'Rustbowl Canyon', lvl:2, th:{g:'#b97c45',g2:'#c48a52',p:'#e3c68f',pe:'#9a7442',c:'#95603a',cf:'#5c3a22',dec:'rock',b:'#6d4a2c'},
    paths:[[[-1,6],[4,6],[4,1],[10,1],[10,10],[16,10],[16,4],[24,4]]],
    cliffs:[[6,3,3,4],[12,5,3,3],[18,6,4,3],[0,0,3,3],[19,0,3,2]], blocks:[[0,9,3,3]] },
  { n:'Glacier Spine', lvl:3, th:{g:'#cfe3ee',g2:'#bcd6e6',p:'#8fa8bd',pe:'#5f788d',c:'#9fb8cc',cf:'#5e7387',dec:'ice',b:'#6fb1d9'},
    paths:[[[3,-1],[3,9],[9,9],[9,2],[15,2],[15,9],[20,9],[20,-1]]],
    cliffs:[[5,3,3,4],[11,4,3,4],[17,3,2,4],[22,6,2,4],[0,2,2,3]], blocks:[[11,10,4,2]] },
  { n:'Cinder Foundry', lvl:5, th:{g:'#3a2a2a',g2:'#443030',p:'#6b5146',pe:'#2a1c18',c:'#5a4038',cf:'#2a1a16',dec:'ember',b:'#d9541e'},
    paths:[[[-1,10],[5,10],[5,5],[1,5],[1,1],[11,1],[11,7],[17,7],[17,1],[22,1],[22,12]]],
    cliffs:[[7,3,3,3],[13,3,3,3],[7,9,4,2],[19,4,2,4],[13,9,3,2]], blocks:[[2,7,2,2]] },
  { n:'Bogwater Locks', lvl:7, th:{g:'#4a5a34',g2:'#55663b',p:'#8a7a52',pe:'#5a4e30',c:'#6a6a4a',cf:'#3a3a26',dec:'reed',b:'#3d6b5c'},
    paths:[[[-1,2],[8,2],[8,6],[24,6]],[[-1,10],[14,10],[14,6],[24,6]]],
    cliffs:[[3,4,3,3],[10,0,3,3],[17,8,3,3],[18,2,3,3],[10,7,3,2]], blocks:[[20,10,3,2],[0,6,2,2]] },
  { n:'Stormcrown Keep', lvl:10, th:{g:'#2c2a44',g2:'#33304f',p:'#6a6488',pe:'#3c3858',c:'#4c4870',cf:'#25223a',dec:'crystal',b:'#7b5cd6'},
    paths:[[[-1,1],[11,1],[11,6],[18,6],[18,2],[24,2]],[[-1,10],[11,10],[11,6],[18,6],[18,2],[24,2]]],
    cliffs:[[4,3,4,5],[13,8,4,3],[14,1,3,3],[20,4,3,4],[0,4,2,3]], blocks:[[20,9,3,2]] }
];

const MODES = [
  { id:'easy', n:'Easy', hp:200, hpx:.7, cash:800, coin:3, win:150, waves:40, d:'Gentle waves, bigger wallet.' },
  { id:'normal', n:'Normal', hp:150, hpx:1, cash:700, coin:5, win:300, waves:40, d:'The intended fight.' },
  { id:'hard', n:'Hard', hp:100, hpx:1.45, cash:600, coin:8, win:650, waves:40, d:'Earlier threats, tougher hides.' },
  { id:'endless', n:'Endless', hp:150, hpx:1, cash:700, coin:5, win:0, waves:1e9, d:'No end. How long can you hold?' }
];

/* Cosmetic skins (earned in-game only via crates). */
const SKINS = {
  default: { n:'Standard', r:0 },
  arctic:  { n:'Arctic',   r:1, c1:'#dfe9f0', c2:'#7f9fb5' },
  jungle:  { n:'Jungle',   r:1, c1:'#3f6e2f', c2:'#a3874f' },
  desert:  { n:'Dune',     r:1, c1:'#d8b77a', c2:'#7a5a33' },
  neon:    { n:'Neon',     r:2, c1:'#1b1b2f', c2:'#3ff5d0' },
  obsidian:{ n:'Obsidian', r:2, c1:'#24222b', c2:'#a05cff' },
  crimson: { n:'Crimson',  r:2, c1:'#b3202f', c2:'#3a0a10' },
  gilded:  { n:'Gilded',   r:3, c1:'#f2c94c', c2:'#6b4a0c' },
  prism:   { n:'Prism',    r:3, c1:'prism',   c2:'#ffffff' }
};
const RARITY = [{n:'Standard',c:'#9aa'},{n:'Common',c:'#8fd16a'},{n:'Rare',c:'#4fa8ff'},{n:'Elite',c:'#ffb53b'}];
const CRATES = [
  { id:'field', n:'Field Crate', price:200, odds:[0,.8,.18,.02], c:'#7b8f5a' },
  { id:'vet',   n:'Veteran Crate', price:500, odds:[0,.5,.4,.1], c:'#4f78b0' },
  { id:'legend',n:'Legend Crate', price:1200, odds:[0,0,.6,.4], c:'#c98a1e' }
];

/* Daily quest templates: k=stat key, g=goal range, rw=coin reward. */
const QUESTS = [
  { k:'kills', d:'Defeat {g} enemies', g:[250,600], rw:150 },
  { k:'hidden', d:'Defeat {g} hidden enemies', g:[15,40], rw:180 },
  { k:'flyers', d:'Shoot down {g} flyers', g:[20,50], rw:160 },
  { k:'waves', d:'Clear {g} waves', g:[15,40], rw:150 },
  { k:'placed', d:'Deploy {g} units', g:[12,30], rw:120 },
  { k:'abilities', d:'Use {g} unit abilities', g:[5,15], rw:150 },
  { k:'upgrades', d:'Buy {g} upgrades', g:[12,30], rw:140 },
  { k:'minis', d:'Defeat {g} mini-bosses', g:[1,3], rw:220 },
  { k:'cash', d:'Earn {g} cash in battle', g:[5000,15000], rw:160 },
  { k:'wins', d:'Win {g} match', g:[1,1], rw:300 }
];
const TIERC = ['#8a9099', '#cd8a4a', '#c8d0da', '#f2c14e', '#ff5ad1'];

/* ================= Procedural assets ================= */
/* ---------------- Audio ---------------- */
const AU = {
  ctx: null, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.m = this.ctx.createGain(); this.m.gain.value = P.snd ? .55 : 0; this.m.connect(this.ctx.destination);
      this.mu = this.ctx.createGain(); this.mu.gain.value = .2; this.mu.connect(this.m);
      const b = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = b;
      this.nt = this.ctx.currentTime; this.stp = 0;
    } catch (e) { this.ctx = null; }
  },
  setOn(v) { P.snd = v ? 1 : 0; saveP(); if (this.m) this.m.gain.value = v ? .55 : 0; syncSnd(); },
  tone(f, dur, type, vol, f2, when, dest) {
    const c = this.ctx; if (!c) return; const t = when || c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(dest || this.m); o.start(t); o.stop(t + dur + .02);
  },
  nz(dur, vol, fq, when, dest, hp) {
    const c = this.ctx; if (!c) return; const t = when || c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = fq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.m); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  },
  sfx(n) {
    if (!this.ctx || !P.snd || (G && G.demo)) return;
    const now = this.ctx.currentTime; if (this.last[n] && now - this.last[n] < .045) return; this.last[n] = now;
    switch (n) {
      case 'shot': this.nz(.06, .18, 3000, 0, 0, 1); break;
      case 'snipe': this.nz(.18, .35, 1800); this.tone(900, .12, 'square', .06, 200); break;
      case 'boom': this.nz(.4, .5, 400); this.tone(120, .3, 'sine', .3, 40); break;
      case 'zap': this.tone(1400, .12, 'sawtooth', .07, 300); break;
      case 'flame': this.nz(.12, .08, 900); break;
      case 'rail': this.tone(200, .4, 'sawtooth', .12, 1800); this.nz(.25, .2, 5000, 0, 0, 1); break;
      case 'frost': this.tone(1800, .15, 'triangle', .07, 2600); break;
      case 'rocket': this.nz(.25, .12, 1500); break;
      case 'place': this.tone(300, .08, 'square', .1, 600); this.nz(.15, .2, 300); break;
      case 'up': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .12, 'square', .07, 0, now + i * .06)); break;
      case 'sell': this.tone(700, .1, 'triangle', .1, 1400); break;
      case 'leak': this.tone(90, .35, 'sawtooth', .25, 45); break;
      case 'die': this.tone(260, .08, 'triangle', .06, 120); break;
      case 'coin': this.tone(1320, .07, 'square', .05); this.tone(1760, .1, 'square', .05, 0, now + .06); break;
      case 'click': this.tone(500, .04, 'square', .06); break;
      case 'bad': this.tone(160, .15, 'square', .08, 110); break;
      case 'ab': this.tone(400, .3, 'sawtooth', .09, 1200); break;
      case 'horn': {
        const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(250, now); f.frequency.exponentialRampToValueAtTime(2200, now + .5); f.frequency.exponentialRampToValueAtTime(500, now + 1.5);
        g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(.35, now + .15); g.gain.setValueAtTime(.35, now + 1.1); g.gain.exponentialRampToValueAtTime(.001, now + 1.6);
        f.connect(g); g.connect(this.m);
        [110, 165, 220.5].forEach(fr => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr * .94, now); o.frequency.linearRampToValueAtTime(fr, now + .2); o.connect(f); o.start(now); o.stop(now + 1.7); });
        break;
      }
      case 'win': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, .3, 'square', .08, 0, now + i * .12)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, .4, 'sawtooth', .08, 0, now + i * .2)); break;
    }
  },
  music() {
    const c = this.ctx; if (!c || !G || G.demo || G.paused || G.state === 'over') { if (c) this.nt = c.currentTime + .05; return; }
    const boss = G.boss, bpm = boss ? 138 : 112, sd = 60 / bpm / 4, inter = G.state !== 'wave';
    if (this.nt < c.currentTime) this.nt = c.currentTime + .02;
    while (this.nt < c.currentTime + .25) {
      const s = this.stp % 16, bar = (this.stp >> 4) % 4, t = this.nt, M = this.mu;
      const root = [45, 41, 48, 43][bar], hz = m => 440 * Math.pow(2, (m - 69) / 12);
      if (!inter || s % 8 === 0) {
        if (s % 8 === 0 || (boss && s % 4 === 0)) { this.tone(150, .18, 'sine', .9, 40, t, M); }
        if (!inter && (s === 4 || s === 12)) this.nz(.14, .45, 2500, t, M);
        if (!inter && s % 2 === 1) this.nz(.03, .15, 7000, t, M, 1);
      }
      if ([0, 3, 6, 8, 10, 13].includes(s)) this.tone(hz(root + (s === 10 ? 12 : 0)), sd * 1.8, 'sawtooth', inter ? .18 : .32, 0, t, M);
      if (!inter && bar >= 2 && s % 2 === 0) { const ch = [0, 3, 7, 10, 12, 7, 3, 0][(s >> 1)]; this.tone(hz(root + 24 + ch), sd * 1.5, 'square', .1, 0, t, M); }
      if (s === 0) this.tone(hz(root + 12), sd * 15, 'triangle', .12, 0, t, M);
      this.nt += sd; this.stp++;
    }
  }
};
setInterval(() => AU.music(), 60);

/* ---------------- Terrain ---------------- */
const BG = {};
function mapGrid(m) {
  const g = new Uint8Array(COLS * ROWS);
  for (const p of m.paths) for (let i = 0; i < p.length - 1; i++) {
    let [x, y] = p[i]; const [x2, y2] = p[i + 1], dx = Math.sign(x2 - x), dy = Math.sign(y2 - y);
    for (;;) { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) g[y * COLS + x] = 1; if (x === x2 && y === y2) break; x += dx; y += dy; }
  }
  const fill = (rs, v) => { for (const [a, b, w, h] of rs) for (let y = b; y < b + h; y++) for (let x = a; x < a + w; x++) if (x < COLS && y < ROWS && !g[y * COLS + x]) g[y * COLS + x] = v; };
  fill(m.cliffs, 2); fill(m.blocks, 3); return g;
}
function terrain(mi) {
  if (BG[mi]) return BG[mi];
  const m = MAPS[mi], th = m.th, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = rng(mi * 99 + 5), g = mapGrid(m);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) { x.fillStyle = (tx + ty) % 2 ? th.g : th.g2; x.fillRect(tx * T, ty * T, T, T); x.fillStyle = 'rgba(0,0,0,' + (r() * .08) + ')'; x.fillRect(tx * T, ty * T, T, T); }
  for (let i = 0; i < 260; i++) { const px = r() * W, py = r() * H; deco(x, th.dec, px, py, r); }
  for (const [a, b, w, h] of m.blocks) { x.fillStyle = th.b; rr(x, a * T + 3, b * T + 3, w * T - 6, h * T - 6, 12); x.fill(); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2; for (let i = 0; i < w * h * 2; i++) { const px = a * T + 10 + r() * (w * T - 26), py = b * T + 10 + r() * (h * T - 20); x.beginPath(); x.arc(px, py, 5, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); } }
  for (const p of m.paths) {
    const pts = p.map(([a, b]) => [a * T + T / 2, b * T + T / 2]);
    for (const [w, col] of [[38, th.pe], [30, th.p]]) { x.strokeStyle = col; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = 'square'; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
    x.setLineDash([6, 10]); x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 3; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); x.setLineDash([]);
  }
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) if (g[ty * COLS + tx] === 1) for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(0,0,0,.13)'; x.beginPath(); x.arc(tx * T + 6 + r() * 28, ty * T + 6 + r() * 28, 1 + r() * 2, 0, 7); x.fill(); }
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) if (g[ty * COLS + tx] === 2) {
    const X = tx * T, Y = ty * T, below = ty + 1 >= ROWS || g[(ty + 1) * COLS + tx] !== 2;
    x.fillStyle = th.c; x.fillRect(X, Y - 4, T, T + 4); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(X + 3, Y, T - 6, T - 8);
    if (below) { x.fillStyle = th.cf; x.fillRect(X, Y + T - 8, T, 10); }
    if (ty === 0 || g[(ty - 1) * COLS + tx] !== 2) { x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(X, Y - 4, T, 3); }
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(X + 6 + r() * 28, Y + 4 + r() * 22, 1.5 + r() * 2, 0, 7); x.fill(); }
  }
  const vg = x.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, W * .65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  return (BG[mi] = { c, g });
}
function deco(x, k, px, py, r) {
  x.save(); x.translate(px, py);
  if (k === 'grass' || k === 'reed') { x.strokeStyle = k === 'reed' ? '#7d8a4a' : '#7fb35a'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(i * 3, 0); x.lineTo(i * 3 + (r() - .5) * 4, -4 - r() * (k === 'reed' ? 9 : 4)); x.stroke(); } }
  else if (k === 'rock') { x.fillStyle = 'rgba(80,45,20,.45)'; x.beginPath(); x.ellipse(0, 0, 2 + r() * 4, 1.5 + r() * 2, 0, 0, 7); x.fill(); }
  else if (k === 'ice') { x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(4 + r() * 6, r() * 6 - 3); x.stroke(); }
  else if (k === 'ember') { x.fillStyle = r() < .3 ? '#ff7a2b' : 'rgba(0,0,0,.3)'; x.fillRect(0, 0, 2, 2); }
  else { x.fillStyle = r() < .5 ? '#9b7cff' : '#5ad1ff'; x.globalAlpha = .5; x.beginPath(); x.moveTo(0, -5); x.lineTo(2, 0); x.lineTo(0, 2); x.lineTo(-2, 0); x.fill(); }
  x.restore();
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function circ(x, a, b, r) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }

/* ---------------- Unit art ---------------- */
let NOW = 0;
function skinCols(id, sk) { const d = UNITS[id], s = SKINS[sk || 'default']; if (!s || !s.c1) return [d.c1, d.c2]; if (s.c1 === 'prism') return ['hsl(' + ((NOW * 80) % 360) + ',80%,60%)', '#fff']; return [s.c1, s.c2]; }
function shape(x, s, r) {
  x.beginPath();
  if (s === 'circle') x.arc(0, 0, r, 0, 7);
  else if (s === 'square') rr(x, -r, -r, r * 2, r * 2, r * .3);
  else { const n = s === 'hex' ? 6 : s === 'tri' ? 3 : 4, o = s === 'tri' ? -Math.PI / 2 : 0; for (let i = 0; i < n; i++) { const a = o + i * Math.PI * 2 / n; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); } x.closePath(); }
}
function drawUnit(x, id, lv, px, py, ang, sk, t, sc) {
  const d = UNITS[id], [c1, c2] = skinCols(id, sk); sc = sc || 1; const r = 12 * (1 + lv * .05);
  x.save(); x.translate(px, py); x.scale(sc, sc);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(0, 5, r + 4, r * .7 + 3, 0, 0, 7); x.fill();
  if (lv >= 4) { x.globalAlpha = .3 + .15 * Math.sin(t * 4); x.fillStyle = TIERC[4]; circ(x, 0, 0, r + 8); x.globalAlpha = 1; }
  x.fillStyle = TIERC[lv]; circ(x, 0, 0, r + 3); x.fillStyle = 'rgba(10,12,18,.6)'; circ(x, 0, 0, r + 1);
  shape(x, d.shape, r); x.fillStyle = c1; x.fill(); x.strokeStyle = c2; x.lineWidth = 2; x.stroke();
  if (lv >= 1) { shape(x, d.shape, r * .62); x.strokeStyle = TIERC[lv]; x.lineWidth = 2; x.stroke(); }
  x.save(); x.rotate(ang); gun(x, d.gun, lv, r, c1, c2, t); x.restore();
  if (lv >= 3) { x.fillStyle = TIERC[lv]; x.save(); x.translate(r * .8, -r * .8); x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? 2 : 5; x.lineTo(Math.cos(a) * q, Math.sin(a) * q); } x.fill(); x.restore(); }
  if (lv >= 4) { x.fillStyle = TIERC[4]; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t; x.beginPath(); x.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3)); x.lineTo(Math.cos(a + .2) * (r + 9), Math.sin(a + .2) * (r + 9)); x.lineTo(Math.cos(a + .4) * (r + 3), Math.sin(a + .4) * (r + 3)); x.fill(); } }
  x.restore();
}
function gun(x, g, lv, r, c1, c2, t) {
  const bar = (a, w, l, col) => { x.fillStyle = col || '#2a2f38'; x.fillRect(0, a - w / 2, l, w); x.strokeStyle = '#0008'; x.lineWidth = 1; x.strokeRect(0, a - w / 2, l, w); };
  const head = () => { x.fillStyle = c2; circ(x, 0, 0, r * .42); x.fillStyle = c1; circ(x, 0, 0, r * .24); };
  switch (g) {
    case 'rifle': bar(0, 4, r + 6 + lv * 2); if (lv >= 2) bar(-5, 3, r + 3 + lv); if (lv >= 4) bar(5, 3, r + 3 + lv); head(); break;
    case 'long': bar(0, 3, r + 14 + lv * 3); x.fillStyle = '#111'; x.fillRect(4, -5, 8, 3); if (lv >= 2) { x.fillStyle = '#5ad1ff'; x.fillRect(r + 12 + lv * 3, -1, 3, 2); } head(); break;
    case 'nozzle': x.fillStyle = '#b5482a'; circ(x, -6, -6, 4); circ(x, -6, 6, 4); bar(0, 6, r + 4); x.fillStyle = '#333'; x.beginPath(); x.moveTo(r + 4, -4); x.lineTo(r + 9 + lv, -6 - lv); x.lineTo(r + 9 + lv, 6 + lv); x.lineTo(r + 4, 4); x.fill(); if (lv >= 2) { x.fillStyle = '#ffb53b'; circ(x, r + 9 + lv, 0, 2); } head(); break;
    case 'mortar': x.fillStyle = '#2b2e1c'; x.fillRect(-2, -(5 + lv), r + 2, 10 + lv * 2); x.fillStyle = '#111'; circ(x, r, 0, 4 + lv * .6); if (lv >= 2) { x.fillStyle = c2; x.fillRect(-6, -r * .8, 5, r * 1.6); } break;
    case 'orb': { x.fillStyle = '#bff3ff'; x.globalAlpha = .4; circ(x, r * .9, 0, 7 + lv); x.globalAlpha = 1; x.fillStyle = '#e8fbff'; circ(x, r * .9, 0, 4 + lv * .5); for (let i = 0; i < lv; i++) { const a = t * 2 + i * 2; x.fillStyle = '#7fe0ff'; circ(x, Math.cos(a) * r * .7, Math.sin(a) * r * .7, 2); } head(); break; }
    case 'flak': for (let i = 0; i < 2 + Math.min(lv, 2); i++) bar((i - (1 + Math.min(lv, 2)) / 2) * 5, 3, r + 4 + lv); x.fillStyle = c2; x.fillRect(-6, -7, 10, 14); break;
    case 'radar': x.rotate(t * 2); x.strokeStyle = '#d8fff5'; x.lineWidth = 2.5; x.beginPath(); x.arc(-4, 0, r * .9 + lv, -1, 1); x.stroke(); x.fillStyle = '#d8fff5'; x.fillRect(-4, -1, r * .9, 2); if (lv >= 2) { x.globalAlpha = .4; x.beginPath(); x.arc(0, 0, r + 4 + lv, -.3, .3); x.stroke(); x.globalAlpha = 1; } break;
    case 'dish': x.fillStyle = '#e74c3c'; x.fillRect(-2, -6, 4, 12); x.fillRect(-6, -2, 12, 4); x.rotate(t * 12); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; for (let i = 0; i < (lv >= 2 ? 4 : 2); i++) { x.rotate(Math.PI / (lv >= 2 ? 2 : 1)); x.beginPath(); x.moveTo(0, 0); x.lineTo(r + 5, 0); x.stroke(); } break;
    case 'minigun': for (let i = -1; i <= 1; i++) bar(i * 3, 2.5, r + 8 + lv * 2, '#3a3f48'); x.fillStyle = '#1b1f26'; x.fillRect(r + 4 + lv * 2, -5, 3, 10); x.fillStyle = c2; circ(x, -5, 0, 6); head(); break;
    case 'pods': { const n = 2 + Math.min(lv, 2), sp = 5; x.fillStyle = c2; x.fillRect(-7, -n * sp / 2 - 3, 12, n * sp + 6); for (let k = 0; k < n; k++) { const yy = -n * sp / 2 + sp / 2 + k * sp; x.fillStyle = '#d9d4c7'; x.fillRect(-2, yy - 2, r + 2, 4); x.fillStyle = '#e04a3a'; x.beginPath(); x.moveTo(r, yy - 2); x.lineTo(r + 5, yy); x.lineTo(r, yy + 2); x.fill(); } break; }
    case 'flag': x.fillStyle = '#ddd'; x.fillRect(-1, -r - 12, 2, r + 10); x.fillStyle = TIERC[Math.max(lv, 3)]; x.beginPath(); x.moveTo(1, -r - 12); x.lineTo(14 + lv * 2, -r - 8 + Math.sin(t * 6) * 2); x.lineTo(1, -r - 3); x.fill(); head(); break;
    case 'rail': bar(-3, 2.5, r + 12 + lv * 2, '#1d2a33'); bar(3, 2.5, r + 12 + lv * 2, '#1d2a33'); x.fillStyle = 'rgba(90,209,255,' + (.5 + .4 * Math.sin(t * 8)) + ')'; x.fillRect(2, -1, r + 10 + lv * 2, 2); head(); break;
    case 'coil': for (let i = 0; i < 2 + lv; i++) { x.strokeStyle = i % 2 ? '#c9b6ff' : '#f7e36b'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r * .3 + i * 2.2, 0, 7); x.stroke(); } x.fillStyle = '#fff'; circ(x, 0, 0, 3 + Math.sin(t * 20)); break;
    default: x.fillStyle = '#f7d774'; for (let i = 0; i <= lv; i++) { x.beginPath(); x.ellipse(0, 4 - i * 3, 7, 3, 0, 0, 7); x.fill(); x.strokeStyle = '#7a5b17'; x.lineWidth = 1; x.stroke(); } x.fillStyle = '#7a5b17'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.fillText('$', 0, -lv * 3 + 4);
  }
}
function icon(id, lv, sk, size) { const c = document.createElement('canvas'); c.width = c.height = size * 2; const x = c.getContext('2d'); x.scale(2, 2); drawUnit(x, id, lv, size / 2, size / 2, -.5, sk, 0, size / 40); return c; }

/* ---------------- Enemy art ---------------- */
function drawEnemy(x, e) {
  const d = e.def, r = d.r, fy = e.fly ? 12 + Math.sin(NOW * 3 + e.wob) * 3 : 0, px = e.x, py = e.y - fy - (d.boss ? 10 : 0);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(e.x, e.y + 4, r * (e.fly ? .7 : 1), r * .45, 0, 0, 7); x.fill();
  x.save(); x.translate(px, py); if (e.hid) x.globalAlpha = .35 + .15 * Math.sin(NOW * 8 + e.wob);
  const col = e.fl > 0 ? '#fff' : e.frz > 0 ? '#cdefff' : d.c;
  if (d.boss) {
    x.rotate(Math.sin(NOW) * .1); const rc = ['#5ad1ff', '#ff9a3b', '#ff3b5c'][e.ph - 1];
    x.fillStyle = col === '#fff' ? '#fff' : d.c; x.beginPath(); x.moveTo(0, -r * 1.5); x.lineTo(r * .8, 0); x.lineTo(r * .5, r); x.lineTo(-r * .5, r); x.lineTo(-r * .8, 0); x.closePath(); x.fill(); x.strokeStyle = rc; x.lineWidth = 3; x.stroke();
    x.fillStyle = rc; x.fillRect(-3, -r, 6, r * 1.4); x.fillRect(-r * .4, -r * .3, r * .8, 5);
    for (let i = 0; i < 4 + e.ph; i++) { const a = NOW * (1 + e.ph * .5) + i * 7 / (4 + e.ph); x.fillStyle = rc; x.save(); x.translate(Math.cos(a) * r * 1.4, Math.sin(a) * r * .9); x.rotate(a); x.fillRect(-4, -4, 8, 8); x.restore(); }
  } else {
    x.rotate(e.ang);
    if (e.fly) { const fl = Math.sin(NOW * 14 + e.wob) * 5; x.fillStyle = d.c; x.globalAlpha *= .8; x.beginPath(); x.moveTo(0, 0); x.lineTo(-r * .4, -r * 1.6 - fl); x.lineTo(-r * .9, -r * .4); x.lineTo(-r * .9, r * .4); x.lineTo(-r * .4, r * 1.6 + fl); x.closePath(); x.fill(); x.globalAlpha = e.hid ? .4 : 1; }
    x.fillStyle = col; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2;
    if (e.ty === 'dasher' || e.ty === 'phantom') { x.beginPath(); x.moveTo(r * 1.3, 0); x.lineTo(-r, -r); x.lineTo(-r * .6, 0); x.lineTo(-r, r); x.closePath(); }
    else if (e.ty === 'brute' || e.ty === 'juggernaut' || e.ty === 'warlord') rr(x, -r, -r, r * 2, r * 2, r * .4);
    else if (e.armor || e.ty === 'jammer') shape(x, 'hex', r * .92);
    else { x.beginPath(); x.ellipse(0, 0, r * (1 + Math.sin(NOW * 8 + e.wob) * .06), r, 0, 0, 7); }
    x.fill(); x.stroke();
    if (e.armor) { x.strokeStyle = '#d5dbe2'; x.lineWidth = 3; shape(x, 'hex', r * .6); x.stroke(); }
    if (e.ty === 'tender') { x.fillStyle = '#fff'; x.fillRect(-2, -6, 4, 12); x.fillRect(-6, -2, 12, 4); }
    if (e.ty === 'jammer') { x.strokeStyle = '#333'; x.lineWidth = 2; x.beginPath(); x.moveTo(-2, 0); x.lineTo(-8, -r - 4); x.stroke(); x.fillStyle = '#ff3b3b'; circ(x, -8, -r - 4, 2.5); }
    if (e.ty === 'splitter') { x.strokeStyle = '#2d5a22'; x.lineWidth = 2; x.beginPath(); x.moveTo(-r * .6, -r * .5); x.lineTo(r * .2, 0); x.lineTo(-r * .6, r * .5); x.stroke(); }
    if (e.ty === 'warlord') { x.fillStyle = '#ffd34d'; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(-r * .3, i * 7 - 3); x.lineTo(-r * .3 - 9, i * 7); x.lineTo(-r * .3, i * 7 + 3); x.fill(); } }
    x.fillStyle = '#fff'; circ(x, r * .45, -r * .32, r * .2 + 1); circ(x, r * .45, r * .32, r * .2 + 1); x.fillStyle = '#111'; circ(x, r * .55, -r * .32, r * .1 + .5); circ(x, r * .55, r * .32, r * .1 + .5);
  }
  x.restore();
  if (e.shield > 0) { x.strokeStyle = 'rgba(143,179,255,' + (.4 + .5 * e.shield / e.smax) + ')'; x.lineWidth = 2.5; x.beginPath(); x.arc(px, py, r + 5, 0, 7); x.stroke(); }
  if (e.sl > 0 && e.frz <= 0) { x.strokeStyle = 'rgba(150,220,255,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, r + 2, 0, 7); x.stroke(); }
  if (e.stun > 0) { x.fillStyle = '#f7e36b'; for (let i = 0; i < 3; i++) circ(x, px + Math.cos(NOW * 6 + i * 2) * r, py - r - 4 + Math.sin(NOW * 6 + i * 2) * 2, 2); }
  if (e.hp < e.max && !d.boss) { const w = Math.max(18, r * 2); x.fillStyle = '#000a'; x.fillRect(px - w / 2, py - r - 9, w, 4); x.fillStyle = e.hp / e.max > .5 ? '#6fdc8c' : '#ffb53b'; x.fillRect(px - w / 2, py - r - 9, w * e.hp / e.max, 4); }
}

