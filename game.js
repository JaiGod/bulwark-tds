/* Bulwark TDS - engine, rendering, audio and UI. (c) 2026 Jaineil Rana, MIT. */
'use strict';
const $ = id => document.getElementById(id);
const cv = $('cv'), cx = cv.getContext('2d');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const fmt = n => n >= 1e4 ? (n / 1000).toFixed(1) + 'k' : '' + Math.floor(n);

/* ---------------- Profile ---------------- */
const P = Object.assign({ coins: 0, xp: 0, owned: { picket: 1, longshot: 1, mint: 1 }, skins: {}, eq: {}, load: ['picket', 'longshot', 'mint', null, null], best: {}, snd: 1, q: null, lvc: 1 }, store.get('bw_prof', {}));
const saveP = () => store.set('bw_prof', P);
function lvOf(xp) { let l = 1, need = 100; while (xp >= need) { xp -= need; l++; need = Math.round(100 * Math.pow(l, 1.3)); } return { l, xp, need }; }
function dayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function ensureQuests() {
  const k = dayKey(); if (P.q && P.q.day === k) return;
  const r = rng(hash(k)), pool = QUESTS.slice(), list = [];
  while (list.length < 3) {
    const q = pool.splice(Math.floor(r() * pool.length), 1)[0];
    let g = q.g[0] + r() * (q.g[1] - q.g[0]); g = g > 100 ? Math.round(g / 50) * 50 : Math.round(g);
    list.push({ k: q.k, d: q.d.replace('{g}', g), g, p: 0, rw: q.rw, c: 0 });
  }
  P.q = { day: k, list }; saveP();
}
function qAdd(k, n) { ensureQuests(); for (const q of P.q.list) if (q.k === k && !q.c) q.p = Math.min(q.g, q.p + n); }
function addXp(n) {
  P.xp += Math.round(n); const l = lvOf(P.xp).l; let bonus = 0;
  while (P.lvc < l) { P.lvc++; bonus += 100 * P.lvc; }
  P.coins += bonus; return bonus;
}

/* ---------------- Run state ---------------- */
let G = null;
function newRun(mapI, modeI, demo) {
  const m = MAPS[mapI], md = MODES[modeI], tr = terrain(mapI);
  const paths = m.paths.map(p => { const pts = p.map(([a, b]) => [a * T + T / 2, b * T + T / 2]), cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(...pts[i - 1], ...pts[i])); return { pts, cum, len: cum[cum.length - 1] }; });
  G = { mapI, modeI, m, md, demo, tr, grid: tr.g, occ: {}, paths, wave: 0, cash: demo ? 1e9 : md.cash, hp: md.hp, maxHp: md.hp, units: [], en: [], pr: [], fx: [], txt: [], bm: [], t: 0, wt: 0, state: 'pre', q: [], inter: 0, kills: 0, earned: 0, flare: 0, rally: 0, shake: 0, spd: 1, paused: false, sel: null, placing: null, hover: null, boss: null, st: {}, uid: 1, load: demo ? [] : P.load.filter(Boolean), auraT: 0 };
  if (demo) { [['picket', 5, 4], ['picket', 7, 6], ['longshot', 10, 4], ['thumper', 16, 6], ['rime', 12, 7], ['arc', 14, 9], ['rotor', 20, 6], ['spotter', 9, 3], ['volley', 18, 2]].forEach(([id, tx, ty], i) => { const u = place(id, tx, ty, true); if (u) u.lv = i % 5; }); G.state = 'inter'; G.inter = 1; }
  return G;
}
function stat(id, lv) { const d = UNITS[id], s = Object.assign({}, d.s); for (let i = 0; i < lv; i++) for (const k in d.ups[i][1]) s[k] = (s[k] || 0) + d.ups[i][1][k]; return s; }
function canPlace(id, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 'Out of bounds';
  const d = UNITS[id], g = G.grid[ty * COLS + tx];
  if (G.occ[tx + ',' + ty]) return 'Tile occupied';
  if (g === 1 || g === 3) return 'Cannot build here';
  if (d.place === 'g' && g !== 0) return 'Needs ground';
  if (d.place === 'c' && g !== 2) return 'Needs a cliff';
  if (G.units.filter(u => u.id === id).length >= d.lim) return 'Limit reached (' + d.lim + ')';
  if (G.cash < d.cost) return 'Not enough cash';
  return '';
}
function place(id, tx, ty, free) {
  if (!free && canPlace(id, tx, ty)) return null;
  const d = UNITS[id], u = { uid: G.uid++, id, def: d, tx, ty, x: tx * T + T / 2, y: ty * T + T / 2 - (G.grid[ty * COLS + tx] === 2 ? 4 : 0), lv: 0, cd: .3, ab: 0, tm: 0, ang: -Math.PI / 2, spent: d.cost, jam: 0, pop: .3, od: 0, buff: 0, det: 0, cl: 0, fl: 0, st: stat(id, 0), stLv: 0 };
  if (!free) { G.cash -= d.cost; G.st.placed = (G.st.placed || 0) + 1; }
  G.units.push(u); G.occ[tx + ',' + ty] = u; burst(u.x, u.y + 8, '#d8c9a0', 12, 60, .5, 3); AU.sfx('place'); return u;
}
function upgrade(u) {
  if (u.lv >= 4) return; const c = u.def.ups[u.lv][0]; if (G.cash < c) { AU.sfx('bad'); return; }
  G.cash -= c; u.spent += c; u.lv++; u.pop = .35; G.st.upgrades = (G.st.upgrades || 0) + 1;
  burst(u.x, u.y, TIERC[u.lv], 22, 120, .7, 3); text(u.x, u.y - 20, 'LEVEL ' + u.lv, TIERC[u.lv], 14); AU.sfx('up'); uiPanel();
}
function sell(u) { const v = Math.floor(u.spent * .5); G.cash += v; G.units.splice(G.units.indexOf(u), 1); delete G.occ[u.tx + ',' + u.ty]; burst(u.x, u.y, '#ffd34d', 14, 90, .5, 3); text(u.x, u.y - 14, '+$' + v, '#ffd34d', 13); AU.sfx('sell'); G.sel = null; uiPanel(); }

/* Wave construction */
function hpMul(n) { return G.md.hpx * Math.pow(1 + .085 * (n - 1), 1.68); }
function buildWave(n) {
  const r = rng(n * 977 + G.mapI * 31 + 7), shift = G.md.id === 'hard' ? 2 : 0, np = G.paths.length;
  const av = UNLOCK.filter(u => u[1] <= n + shift).map(u => u[0]), fresh = UNLOCK.find(u => u[1] === n + shift);
  const budget = 5 + n * 2.6 + n * n * .25, groups = Math.min(2 + (n / 8 | 0), 5), q = []; let t = 0;
  for (let g = 0; g < groups; g++) {
    const ty = g === 0 && fresh ? fresh[0] : av[Math.floor(Math.pow(r(), .65) * av.length)];
    const cnt = clamp(Math.round(budget / groups / WCOST[ty]), 1, 24), gap = Math.max(.22, 1 - n * .016) / (ty === 'dasher' || ty === 'phantom' ? 1.5 : 1);
    for (let i = 0; i < cnt; i++) { q.push({ t, ty, p: (i + g) % np }); t += gap; }
    t += 1.4;
  }
  const mini = { 10: ['juggernaut'], 20: ['juggernaut', 'juggernaut'], 25: ['warlord'], 30: ['skyreaver'], 35: ['warlord', 'skyreaver'], 40: ['monolith'] };
  let ms = mini[n] || [];
  if (n > 40) ms = n % 10 === 0 ? ['monolith'] : n % 5 === 0 ? [['juggernaut', 'warlord', 'skyreaver'][(n / 5) % 3]] : [];
  ms.forEach((ty, i) => q.push({ t: t * .5 + i * 3, ty, p: i % np }));
  return q.sort((a, b) => a.t - b.t);
}
function startWave() {
  if (G.state === 'wave') return;
  if (G.state === 'inter' && !G.demo && G.inter > 1) { const b = Math.round(G.inter * 10); G.cash += b; text(W / 2, H - 40, 'SKIP +$' + b, '#ffd34d', 16); }
  G.wave++; G.q = buildWave(G.wave); G.wt = 0; G.state = 'wave';
  if (!G.demo) { const f = UNLOCK.find(u => u[1] === G.wave + (G.md.id === 'hard' ? 2 : 0)), e = f && ENEMIES[f[0]], tag = e ? ' · NEW: ' + e.n + (e.hidden ? ' (hidden!)' : e.fly ? ' (flying)' : e.armor ? ' (armored)' : e.shield ? ' (shielded)' : e.heal ? ' (healer)' : e.jam ? ' (jammer)' : e.split ? ' (splits)' : '') : ''; toast('WAVE ' + G.wave + (G.wave === 40 && G.md.id !== 'endless' ? ' - FINAL' : '') + tag); AU.sfx('horn'); }
}
function spawn(ty, p, d) {
  const e = ENEMIES[ty], n = G.wave, mul = e.boss ? G.md.hpx * (n > 40 ? hpMul(n) / hpMul(40) : 1) : e.mini ? G.md.hpx * (1 + n * .045) : hpMul(n);
  const o = { ty, def: e, p, d: d || 0, hp: e.hp * mul, max: e.hp * mul, spd: e.spd, x: -99, y: -99, ang: 0, armor: e.armor || 0, shield: (e.shield || 0) * mul, smax: (e.shield || 0) * mul, hid: !!e.hidden, fly: !!e.fly, sl: 0, sla: 0, frz: 0, stun: 0, burn: 0, bd: 0, bt: 0, cdA: 3, acc: 0, accT: 0, fl: 0, mk: 0, ph: 1, sm: 1, cloak: 0, wob: Math.random() * 7 };
  G.en.push(o); if (e.boss) { G.boss = o; toast('THE MONOLITH AWAKENS'); G.shake = 14; } return o;
}
function pathPos(p, d) {
  const P2 = G.paths[p], c = P2.cum; let i = 1; while (i < c.length - 1 && c[i] < d) i++;
  const [ax, ay] = P2.pts[i - 1], [bx, by] = P2.pts[i], f = clamp((d - c[i - 1]) / (c[i] - c[i - 1] || 1), 0, 1);
  return [ax + (bx - ax) * f, ay + (by - ay) * f, Math.atan2(by - ay, bx - ax)];
}

/* ---------------- Simulation ---------------- */
function step(dt) {
  G.t += dt; NOW = G.t; G.flare = Math.max(0, G.flare - dt); G.rally = Math.max(0, G.rally - dt); G.shake = Math.max(0, G.shake - dt * 30);
  if (G.state === 'wave') {
    G.wt += dt;
    while (G.q.length && G.q[0].t <= G.wt) { const s = G.q.shift(); spawn(s.ty, s.p); }
    if (!G.q.length && !G.en.length) waveDone();
  } else if (G.state === 'inter') { G.inter -= dt; if (G.inter <= 0) startWave(); }
  if ((G.auraT -= dt) <= 0) { G.auraT = .2; auras(); }
  for (const e of G.en) stepEnemy(e, dt);
  G.en = G.en.filter(e => !e.dead);
  for (const u of G.units) stepUnit(u, dt);
  for (const p of G.pr) stepProj(p, dt);
  G.pr = G.pr.filter(p => !p.dead);
  for (const f of G.fx) { f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; f.vx *= .96; f.vy *= .96; }
  G.fx = G.fx.filter(f => f.t > 0); if (G.fx.length > 600) G.fx.splice(0, G.fx.length - 600);
  for (const s of G.txt) { s.t -= dt; s.y -= 28 * dt; } G.txt = G.txt.filter(s => s.t > 0);
  for (const b of G.bm) b.t -= dt; G.bm = G.bm.filter(b => b.t > 0);
}
function waveDone() {
  const n = G.wave; G.st.waves = (G.st.waves || 0) + 1;
  let inc = 0; for (const u of G.units) if (u.st.income) inc += u.st.income;
  const bonus = 150 + n * 35 + inc; G.cash += bonus; G.earned += bonus; G.st.cash = (G.st.cash || 0) + bonus;
  if (G.demo) { G.state = 'inter'; G.inter = 2; if (G.wave > 12) G.wave = 0; return; }
  if (n >= G.md.waves) return endRun(true);
  toast('WAVE ' + n + ' CLEARED  +$' + bonus); AU.sfx('coin');
  G.state = 'inter'; G.inter = 6; G.boss = null; flushStats(); saveRun();
}
function auras() {
  for (const u of G.units) { u.buff = G.rally ? .5 : 0; u.det = u.st.det || G.flare > 0 ? 1 : 0; u.cl = 0; }
  for (const a of G.units) {
    if (!a.st.aura) continue; const R = a.st.range * T;
    for (const u of G.units) {
      if (u === a || dist(a.x, a.y, u.x, u.y) > R) continue;
      if (a.st.buff) u.buff = Math.min(.8, u.buff + a.st.buff);
      if (a.id === 'spotter' || (a.id === 'marshal' && a.st.det)) u.det = 1;
      if (a.st.cleanse) u.cl = 1;
    }
  }
  for (const e of G.en) { e.mk = 0; for (const a of G.units) if (a.id === 'spotter' && a.st.mark && dist(a.x, a.y, e.x, e.y) < a.st.range * T) e.mk = Math.max(e.mk, a.st.mark); }
}
function stepEnemy(e, dt) {
  const d = e.def;
  e.fl -= dt; e.frz -= dt; e.stun -= dt; e.sl -= dt; e.accT -= dt;
  let sp = e.spd * T * e.sm; if (e.frz > 0 || e.stun > 0) sp = 0; else if (e.sl > 0) sp *= 1 - e.sla;
  e.d += sp * dt; const pp = pathPos(e.p, e.d); e.x = pp[0]; e.y = pp[1]; e.ang = pp[2];
  if (e.acc > 0 && e.accT <= 0) flushNum(e);
  if (e.burn > 0) { e.burn -= dt; e.bt -= dt; if (e.bt <= 0) { e.bt = .5; hurt(e, e.bd * .5, null, {}); if (Math.random() < .6) G.fx.push({ x: e.x, y: e.y - 6, vx: 0, vy: -30, t: .4, m: .4, c: '#ff8a2b', s: 3 }); } }
  e.cdA -= dt;
  if (d.heal && e.cdA <= 0) { e.cdA = 3; ring(e.x, e.y, 2 * T, '#7dff9a'); for (const o of G.en) if (!o.def.boss && dist(o.x, o.y, e.x, e.y) < 2 * T) { o.hp = Math.min(o.max, o.hp + o.max * .08); } }
  if (d.jam && e.cdA <= 0) { e.cdA = 6; ring(e.x, e.y, 2 * T, '#f4f45c'); for (const u of G.units) if (!u.cl && dist(u.x, u.y, e.x, e.y) < 2 * T) u.jam = 3; }
  if (d.spawn && e.cdA <= 0) { e.cdA = 5; for (let i = 0; i < 3; i++) spawn('grunt', e.p, Math.max(0, e.d - 15 - i * 12)); }
  if (d.boss) boss(e, dt);
  if (e.d >= G.paths[e.p].len) {
    e.dead = 1; const dmg = d.leak + Math.floor(G.wave / 10); G.hp -= dmg; G.shake = Math.max(G.shake, 8); AU.sfx('leak');
    const [bx, by] = G.paths[e.p].pts.at(-1); text(clamp(bx, 30, W - 30), clamp(by, 30, H - 30), '-' + dmg + ' HP', '#ff5a5a', 16);
    if (G.boss === e) G.boss = null;
    if (G.hp <= 0) { G.hp = 0; if (G.demo) G.hp = G.maxHp; else endRun(false); }
  }
}
function boss(e, dt) {
  const f = e.hp / e.max, ph = f > .66 ? 1 : f > .33 ? 2 : 3;
  if (ph !== e.ph) { e.ph = ph; toast('MONOLITH - PHASE ' + ph); G.shake = 16; AU.sfx('horn'); burst(e.x, e.y, ph === 2 ? '#ff9a3b' : '#ff3b5c', 50, 220, 1, 4); if (ph === 2) e.armor = .45; if (ph === 3) { e.sm = 1.7; e.armor = .3; } }
  if (e.cdA <= 0) {
    e.cdA = ph === 1 ? 7 : 6;
    if (ph === 1) for (let i = 0; i < 3; i++) spawn('brute', e.p, Math.max(0, e.d - 20 - i * 14));
    if (ph === 2) { ring(e.x, e.y, 3.5 * T, '#ff9a3b'); for (const u of G.units) if (!u.cl && dist(u.x, u.y, e.x, e.y) < 3.5 * T) u.jam = 3; for (let i = 0; i < 2; i++) spawn('aegis', e.p, Math.max(0, e.d - 20 - i * 14)); }
    if (ph === 3) for (let i = 0; i < 3; i++) spawn('phantom', e.p, Math.max(0, e.d - 20 - i * 14));
  }
  if (ph === 3) { e.cloak -= dt; if (e.cloak <= -6) e.cloak = 3; e.hid = e.cloak > 0; }
}
function visible(u, e) { return (!e.hid || u.det) && (!e.fly || u.st.air); }
function targets(u, R, all) {
  const mn = (u.st.min || 0) * T, out = [];
  for (const e of G.en) { if (e.dead || (!all && !visible(u, e))) continue; const dd = dist(u.x, u.y, e.x, e.y); if (dd <= R && dd >= mn) out.push(e); }
  return out;
}
function pick(u, list) {
  let best = null, bv = -1e18;
  for (const e of list) { const rem = G.paths[e.p].len - e.d, v = u.tm === 0 ? -rem : u.tm === 1 ? rem : u.tm === 2 ? e.hp + e.shield : -dist(u.x, u.y, e.x, e.y); if (v > bv) { bv = v; best = e; } }
  return best;
}
function stepUnit(u, dt) {
  u.st = u.st && u.stLv === u.lv ? u.st : (u.stLv = u.lv, stat(u.id, u.lv));
  u.pop = Math.max(0, u.pop - dt); u.fl -= dt; u.ab -= dt; u.od -= dt;
  if (u.jam > 0) { u.jam -= dt; if (u.cl) u.jam = 0; return; }
  const s = u.st; if (!s.dmg) return;
  u.cd -= dt * (1 + u.buff) * (u.od > 0 ? 2 : 1);
  if (u.cd > 0) return;
  const list = targets(u, s.range * T), tg = pick(u, list); if (!tg) return;
  u.ang = Math.atan2(tg.y - u.y, tg.x - u.x); u.cd = s.rate; u.fl = .06;
  const mx = u.x + Math.cos(u.ang) * 20, my = u.y + Math.sin(u.ang) * 20, o = { ap: s.ap, shx: s.shx };
  switch (u.def.gun) {
    case 'nozzle': {
      for (const e of targets(u, s.range * T)) { if (e.fly) continue; let da = Math.abs(Math.atan2(e.y - u.y, e.x - u.x) - u.ang); if (da > Math.PI) da = 2 * Math.PI - da; if (da < .45) { hurt(e, s.dmg, u, o); e.burn = 3; e.bd = Math.max(e.bd, s.burn); } }
      for (let i = 0; i < 3; i++) { const a = u.ang + (Math.random() - .5) * .7, v = 90 + Math.random() * 60; G.fx.push({ x: mx, y: my, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: .35, m: .35, c: Math.random() < .5 ? '#ffb53b' : '#ff5a2b', s: 4 }); }
      AU.sfx('flame'); break;
    }
    case 'mortar': G.pr.push({ k: 'shell', u, sx: mx, sy: my, tx: tg.x + Math.cos(tg.ang) * tg.spd * T * .8, ty: tg.y + Math.sin(tg.ang) * tg.spd * T * .8, t: 0, dur: .8, x: mx, y: my }); AU.sfx('shot'); break;
    case 'coil': {
      let cur = tg, px = u.x, py = u.y - 6, hit = new Set(), dmg = s.dmg;
      for (let i = 0; i < s.chain && cur; i++) {
        hit.add(cur); hurt(cur, dmg, u, o); if (Math.random() < .25) cur.stun = Math.max(cur.stun, .25); G.bm.push({ k: 'zap', x1: px, y1: py, x2: cur.x, y2: cur.y, t: .12, c: '#d9c8ff' }); px = cur.x; py = cur.y; dmg *= .85;
        let nx = null, nd = 1.8 * T; for (const e of G.en) if (!e.dead && !hit.has(e) && visible(u, e)) { const dd = dist(px, py, e.x, e.y); if (dd < nd) { nd = dd; nx = e; } } cur = nx;
      }
      AU.sfx('zap'); break;
    }
    case 'orb': G.pr.push({ k: 'orb', u, x: mx, y: my, tg, v: 7 * T }); AU.sfx('frost'); break;
    case 'pods': G.pr.push({ k: 'rkt', u, x: mx, y: my, tg, v: 5 * T, a: u.ang + (Math.random() - .5), tx: tg.x, ty: tg.y }); AU.sfx('rocket'); break;
    case 'rail': rail(u, s.dmg); break;
    default:
      hurt(tg, s.dmg, u, o); G.bm.push({ k: 'tr', x1: mx, y1: my, x2: tg.x, y2: tg.y, t: u.def.gun === 'long' ? .12 : .05, c: u.def.gun === 'long' ? '#fff6c2' : '#ffe08a', w: u.def.gun === 'long' ? 2.5 : 1.5 });
      if (s.splash) splash(tg.x, tg.y, s.splash * T, s.dmg * .5, u, tg);
      spark(tg.x, tg.y, '#ffe08a'); AU.sfx(u.def.gun === 'long' ? 'snipe' : 'shot');
  }
}
function rail(u, dmg, a) {
  a = a === undefined ? u.ang : a; const L = u.st.range * T * 1.3, ex = u.x + Math.cos(a) * L, ey = u.y + Math.sin(a) * L;
  for (const e of G.en) { if (e.dead || (e.fly && !u.st.air)) continue; const t = clamp(((e.x - u.x) * (ex - u.x) + (e.y - u.y) * (ey - u.y)) / (L * L), 0, 1); if (dist(e.x, e.y, u.x + (ex - u.x) * t, u.y + (ey - u.y) * t) < 14 + e.def.r * .5) hurt(e, dmg, u, { ap: u.st.ap }); }
  G.bm.push({ k: 'rail', x1: u.x, y1: u.y, x2: ex, y2: ey, t: .3, c: '#5ad1ff', w: 6 }); G.shake = Math.max(G.shake, 3); AU.sfx('rail');
}
function splash(x, y, R, dmg, u, skip, air) {
  for (const e of G.en) if (!e.dead && e !== skip && (air || !e.fly || (u && u.st.air)) && dist(x, y, e.x, e.y) < R) hurt(e, dmg, u, { ap: u && u.st.ap });
}
function stepProj(p, dt) {
  const s = p.u.st;
  if (p.k === 'shell') {
    p.t += dt; const f = p.t / p.dur; p.x = p.sx + (p.tx - p.sx) * f; p.y = p.sy + (p.ty - p.sy) * f - Math.sin(f * Math.PI) * 60;
    if (f >= 1) { p.dead = 1; for (const e of G.en) if (!e.dead && !e.fly && dist(p.tx, p.ty, e.x, e.y) < (p.R || s.splash * T)) hurt(e, p.dmg || s.dmg, p.u, {}); boom(p.tx, p.ty, (p.R || s.splash * T)); }
    return;
  }
  const tg = p.tg && !p.tg.dead ? p.tg : null; if (tg) { p.tx = tg.x; p.ty = tg.y; }
  const want = Math.atan2(p.ty - p.y, p.tx - p.x);
  if (p.k === 'rkt') { let da = want - p.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; p.a += clamp(da, -8 * dt, 8 * dt); if (Math.random() < .7) G.fx.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: .4, m: .4, c: '#bbb', s: 3 }); } else p.a = want;
  p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt;
  if (dist(p.x, p.y, p.tx, p.ty) < 10 || (p.life = (p.life || 0) + dt) > 3) {
    p.dead = 1;
    if (p.k === 'orb') { for (const e of G.en) if (!e.dead && dist(p.tx, p.ty, e.x, e.y) < s.splash * T + 6) { e.sla = Math.max(e.sl > 0 ? e.sla : 0, s.slow * (e.def.boss ? .4 : 1)); e.sl = 2; if (s.freeze && Math.random() < s.freeze && !e.def.boss) e.frz = 1.2; hurt(e, s.dmg, p.u, {}); } burst(p.tx, p.ty, '#bff3ff', 8, 70, .4, 2.5); }
    else { if (tg) hurt(tg, p.dmg || s.dmg, p.u, {}); splash(p.tx, p.ty, s.splash * T, (p.dmg || s.dmg) * .6, p.u, tg, 0); boom(p.tx, p.ty, s.splash * T * .8); }
  }
}
function hurt(e, amt, u, o) {
  if (e.dead || amt <= 0) return;
  if (u && u.st.airx && e.fly) amt *= u.st.airx;
  if (e.mk) amt *= 1 + e.mk;
  if (e.shield > 0) { const sx = (o && o.shx) || 1, sd = amt * sx; if (sd < e.shield) { e.shield -= sd; e.fl = .06; return; } amt -= e.shield / sx; e.shield = 0; burst(e.x, e.y, '#8fb3ff', 16, 120, .5, 3); }
  amt *= 1 - e.armor * (1 - ((o && o.ap) || 0));
  e.hp -= amt; e.fl = .07; e.acc += amt; if (e.accT <= 0) flushNum(e);
  if (e.hp <= 0) kill(e, u);
}
function flushNum(e) { if (e.acc >= .5 || e.hp <= 0) text(e.x + (Math.random() - .5) * (e.acc > 50 ? 34 : 12), e.y - e.def.r - 6 - Math.random() * (e.acc > 50 ? 16 : 4), fmt(Math.max(1, e.acc)), e.armor > .3 ? '#c8d0da' : '#ffffff', e.acc > 100 ? 15 : 11); e.acc = 0; e.accT = .25; }
function kill(e, u) {
  e.dead = 1; flushNum(e); const d = e.def, rw = Math.round(d.cash * (G.md.id === 'easy' ? 2.4 : 2) * (1 + G.wave * .03));
  G.cash += rw; G.earned += rw; G.kills++; const S = G.st; S.kills = (S.kills || 0) + 1; S.cash = (S.cash || 0) + rw;
  if (e.hid || d.hidden) S.hidden = (S.hidden || 0) + 1; if (d.fly) S.flyers = (S.flyers || 0) + 1; if (d.mini) { S.minis = (S.minis || 0) + 1; G.shake = 10; if (!G.demo) toast(d.n.toUpperCase() + ' DOWN'); }
  burst(e.x, e.y, d.c, d.boss ? 80 : d.mini ? 40 : 10, d.boss ? 260 : 120, .6, d.boss ? 6 : 3.5); AU.sfx('die');
  if (d.split) for (let i = 0; i < 3; i++) spawn(d.split, e.p, Math.max(0, e.d - i * 9));
  if (d.boss) { G.boss = null; boom(e.x, e.y, 120); G.shake = 25; }
}
function burst(x, y, c, n, sp, life, s) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = sp * (.3 + Math.random() * .7); G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: life * (.5 + Math.random() * .5), m: life, c, s: s * (.6 + Math.random() * .6), g: 160 }); } }
function spark(x, y, c) { for (let i = 0; i < 3; i++) { const a = Math.random() * 7; G.fx.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, t: .15, m: .15, c, s: 2 }); } }
function boom(x, y, R) { burst(x, y, '#ffb53b', 14, R * 3, .45, 4); burst(x, y, '#555', 8, R * 1.5, .7, 5); G.fx.push({ x, y, vx: 0, vy: 0, t: .3, m: .3, c: '#fff3c2', s: R, ring: 1 }); G.shake = Math.max(G.shake, 4); AU.sfx('boom'); }
function ring(x, y, R, c) { G.fx.push({ x, y, vx: 0, vy: 0, t: .5, m: .5, c, s: R, ring: 1 }); }
function text(x, y, s, c, z) { if (G.txt.length < 90) G.txt.push({ x, y, s, c, z: z || 12, t: .8 }); }

/* Abilities */
function ability(u) {
  if (u.lv < 2 || u.ab > 0 || u.jam > 0) return false;
  const s = u.st, R = s.range * T, list = targets(u, R), strong = list.slice().sort((a, b) => b.hp - a.hp)[0];
  const need = ['picket', 'longshot', 'thumper', 'lancer', 'volley'].includes(u.id);
  if (need && !strong) { text(u.x, u.y - 22, 'NO TARGET', '#ff8a8a', 12); AU.sfx('bad'); return false; }
  switch (u.id) {
    case 'picket': G.pr.push({ k: 'shell', u, sx: u.x, sy: u.y, tx: strong.x, ty: strong.y, t: 0, dur: .5, x: u.x, y: u.y, dmg: 60 + u.lv * 30, R: 1.3 * T }); break;
    case 'longshot': hurt(strong, 500, u, { ap: 1 }); G.bm.push({ k: 'tr', x1: u.x, y1: u.y, x2: strong.x, y2: strong.y, t: .3, c: '#ff4040', w: 4 }); G.shake = 6; break;
    case 'mint': { const v = 150 * u.lv; G.cash += v; G.earned += v; text(u.x, u.y - 22, '+$' + v, '#ffd34d', 16); burst(u.x, u.y, '#ffd34d', 20, 120, .7, 3); break; }
    case 'scorcher': for (const e of targets(u, R)) if (!e.fly) { e.burn = 4; e.bd = Math.max(e.bd, 30); } ring(u.x, u.y, R, '#ff7a2b'); break;
    case 'thumper': list.slice(0, 6).concat(list.slice(0, 6)).slice(0, 6).forEach((e, i) => G.pr.push({ k: 'shell', u, sx: u.x, sy: u.y, tx: e.x + (Math.random() - .5) * 30, ty: e.y + (Math.random() - .5) * 30, t: -i * .12, dur: .9, x: u.x, y: u.y, dmg: s.dmg * 2 })); break;
    case 'rime': for (const e of targets(u, R, 1)) e.frz = e.def.boss ? 1 : 2.5; ring(u.x, u.y, R, '#bff3ff'); break;
    case 'flak': for (const e of targets(u, R)) if (e.fly) { hurt(e, 200, u, {}); boom(e.x, e.y, 20); } break;
    case 'spotter': G.flare = 8; ring(u.x, u.y, W, '#fff'); toast('FLARE!'); break;
    case 'arc': for (const e of targets(u, R, 1)) { e.stun = e.def.boss ? .5 : 2; G.bm.push({ k: 'zap', x1: u.x, y1: u.y, x2: e.x, y2: e.y, t: .25, c: '#fff' }); } break;
    case 'mender': G.hp = Math.min(G.maxHp, G.hp + 10); text(u.x, u.y - 22, '+10 HP', '#7dff9a', 16); break;
    case 'rotor': u.od = 6; break;
    case 'volley': for (let i = 0; i < 8; i++) { const e = list[i % list.length]; G.pr.push({ k: 'rkt', u, x: u.x, y: u.y, tg: e, v: 5 * T, a: Math.random() * 7, tx: e.x, ty: e.y, dmg: s.dmg }); } break;
    case 'marshal': G.rally = 8; toast('RALLY!'); break;
    case 'lancer': rail(u, 900, Math.atan2(strong.y - u.y, strong.x - u.x)); break;
  }
  u.ab = u.def.ab.cd; G.st.abilities = (G.st.abilities || 0) + 1; burst(u.x, u.y, '#fff', 16, 100, .5, 3); AU.sfx('ab'); uiPanel(); return true;
}

/* ---------------- Rendering ---------------- */
function render() {
  const x = cx; x.save();
  if (G.shake > 0 && !G.demo) x.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
  x.drawImage(G.tr.c, 0, 0);
  if (G.placing) {
    const id = G.placing;
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) { const ok = !canPlace(id, tx, ty) || canPlace(id, tx, ty) === 'Not enough cash'; if (ok) { x.fillStyle = 'rgba(120,255,150,.13)'; x.fillRect(tx * T + 2, ty * T + 2, T - 4, T - 4); } }
    if (G.hover) { const [tx, ty] = G.hover, bad = canPlace(id, tx, ty), px = tx * T + T / 2, py = ty * T + T / 2; rangeC(px, py, (stat(id, 0).range || 0) * T, bad ? '#ff5a5a' : '#8fffb0'); x.globalAlpha = .7; drawUnit(x, id, 0, px, py, -Math.PI / 2, P.eq[id], NOW); x.globalAlpha = 1; }
  }
  // portals and base
  G.paths.forEach(p => { const [sx, sy] = p.pts[0], px = clamp(sx, 14, W - 14), py = clamp(sy, 14, H - 14); x.save(); x.translate(px, py); x.rotate(NOW * 2); x.strokeStyle = '#c45cff'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.rotate(2.1); x.beginPath(); x.arc(0, 0, 13, 0, 1.6); x.stroke(); } x.restore(); });
  { const [bx, by] = G.paths[0].pts.at(-1), px = clamp(bx, 26, W - 26), py = clamp(by, 26, H - 26); x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(px, py + 14, 28, 10, 0, 0, 7); x.fill(); x.fillStyle = '#5b6678'; rr(x, px - 22, py - 18, 44, 34, 5); x.fill(); x.fillStyle = '#7a879c'; for (let i = 0; i < 4; i++) x.fillRect(px - 22 + i * 12, py - 24, 8, 8); x.fillStyle = '#ffb53b'; x.beginPath(); x.moveTo(px, py - 12); x.lineTo(px + 10, py - 7); x.lineTo(px + 10, py + 2); x.quadraticCurveTo(px + 9, py + 10, px, py + 13); x.quadraticCurveTo(px - 9, py + 10, px - 10, py + 2); x.lineTo(px - 10, py - 7); x.fill(); x.fillStyle = '#000a'; x.fillRect(px - 22, py + 19, 44, 5); x.fillStyle = G.hp / G.maxHp > .35 ? '#6fdc8c' : '#ff5a5a'; x.fillRect(px - 22, py + 19, 44 * G.hp / G.maxHp, 5); }
  const ground = G.en.filter(e => !e.fly).sort((a, b) => a.y - b.y);
  for (const e of ground) drawEnemy(x, e);
  for (const u of G.units) { const sc = 1 + Math.sin(u.pop * 20) * u.pop * .8; drawUnit(x, u.id, u.lv, u.x, u.y, u.ang, P.eq[u.id], NOW, sc); if (u.fl > 0 && u.def.s.dmg) { x.fillStyle = '#fff4b0'; circ(x, u.x + Math.cos(u.ang) * 22, u.y + Math.sin(u.ang) * 22, 4); } if (u.jam > 0) { x.strokeStyle = '#f4f45c'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 5; i++) x.lineTo(u.x - 10 + i * 5, u.y - 18 + (i % 2 ? -4 : 4)); x.stroke(); } if (!G.demo && u.lv >= 2 && u.ab <= 0) { x.fillStyle = '#fff'; x.globalAlpha = .6 + .4 * Math.sin(NOW * 6); circ(x, u.x + 12, u.y - 14, 3); x.globalAlpha = 1; } if (u.od > 0) { x.strokeStyle = '#ff5a2b'; x.lineWidth = 2; x.beginPath(); x.arc(u.x, u.y, 18, 0, 7); x.stroke(); } }
  for (const e of G.en) if (e.fly) drawEnemy(x, e);
  for (const p of G.pr) { if (p.t < 0) continue; if (p.k === 'shell') { x.fillStyle = '#222'; circ(x, p.x, p.y, 4); } else if (p.k === 'orb') { x.fillStyle = '#bff3ff'; circ(x, p.x, p.y, 5); x.fillStyle = '#fff'; circ(x, p.x, p.y, 2.5); } else { x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = '#eee'; x.fillRect(-5, -2, 10, 4); x.fillStyle = '#ff7a2b'; x.fillRect(-8, -1.5, 3, 3); x.restore(); } }
  for (const b of G.bm) {
    x.strokeStyle = b.c; x.globalAlpha = Math.min(1, b.t * 10); x.lineWidth = b.w || 2; x.beginPath(); x.moveTo(b.x1, b.y1);
    if (b.k === 'zap') { for (let i = 1; i < 6; i++) { const f = i / 6; x.lineTo(b.x1 + (b.x2 - b.x1) * f + (Math.random() - .5) * 14, b.y1 + (b.y2 - b.y1) * f + (Math.random() - .5) * 14); } }
    x.lineTo(b.x2, b.y2); x.stroke(); if (b.k === 'rail') { x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); } x.globalAlpha = 1;
  }
  for (const f of G.fx) { const a = f.t / f.m; x.globalAlpha = a; if (f.ring) { x.strokeStyle = f.c; x.lineWidth = 3; x.beginPath(); x.arc(f.x, f.y, f.s * (1 - a * .7), 0, 7); x.stroke(); } else { x.fillStyle = f.c; x.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s * a + 1, f.s * a + 1); } }
  x.globalAlpha = 1; x.textAlign = 'center';
  for (const s of G.txt) { x.globalAlpha = Math.min(1, s.t * 3); x.font = '900 ' + s.z + 'px system-ui,sans-serif'; x.lineWidth = 3; x.strokeStyle = '#000b'; x.strokeText(s.s, s.x, s.y); x.fillStyle = s.c; x.fillText(s.s, s.x, s.y); }
  x.globalAlpha = 1;
  if (G.sel) rangeC(G.sel.x, G.sel.y, (G.sel.st.range || 0) * T, '#ffffff');
  if (G.flare > 0) { x.fillStyle = 'rgba(255,240,200,' + (.06 * Math.min(1, G.flare)) + ')'; x.fillRect(0, 0, W, H); }
  x.restore();
}
function rangeC(px, py, R, c) { if (!R) return; const x = cx; x.fillStyle = c + '18'; x.strokeStyle = c + 'aa'; x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.arc(px, py, R, 0, 7); x.fill(); x.stroke(); x.setLineDash([]); }
/* ---------------- Main loop ---------------- */
let last = performance.now(), acc = 0, uiT = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (G && !G.paused && G.state !== 'over') { acc += dt * (G.demo ? 1 : G.spd); let n = 0; while (acc >= 1 / 60 && n++ < 8) { step(1 / 60); acc -= 1 / 60; } if (n >= 8) acc = 0; }
  if (G) { if (G.paused || G.state === 'over') NOW += dt * .2; render(); }
  if ((uiT -= dt) <= 0) { uiT = .12; if (G && !G.demo) uiHud(); }
  requestAnimationFrame(frame);
}

/* ---------------- UI ---------------- */
const screens = ['sTitle', 'sPlay', 'sLoad', 'sShop', 'sQuest', 'sHow', 'sPause', 'sEnd'];
function show(id) { screens.forEach(s => $(s).classList.toggle('on', s === id)); if (id === 'sTitle') uiTitle(); if (id === 'sPlay') uiPlay(); if (id === 'sLoad') uiLoad(); if (id === 'sShop') uiShop(); if (id === 'sQuest') uiQuest(); }
let toastT = 0; function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }
function syncSnd() { const s = 'Sound: ' + (P.snd ? 'On' : 'Off'); $('bSnd2').textContent = s; $('bSnd3').textContent = s; $('bSnd').innerHTML = P.snd ? '&#9835;' : '&#215;'; }
function uiTitle() {
  ensureQuests(); const L = lvOf(P.xp); $('pLv').textContent = L.l; $('pXp').style.width = (L.xp / L.need * 100) + '%'; $('pCoins').textContent = P.coins;
  $('bCont').style.display = store.get('bw_run', null) ? '' : 'none';
  $('qDot').textContent = P.q.list.some(q => q.p >= q.g && !q.c) ? '(!)' : ''; syncSnd();
}
let selMap = 0, selMode = 1;
function uiPlay() {
  const L = lvOf(P.xp).l, mg = $('mapGrid'); mg.innerHTML = '';
  MAPS.forEach((m, i) => {
    const lock = L < m.lvl, b = document.createElement('button'); b.className = 'tile' + (i === selMap ? ' sel' : '') + (lock ? ' lock' : '');
    const c = document.createElement('canvas'); c.width = 192; c.height = 96; c.style.width = '100%'; c.getContext('2d').drawImage(terrain(i).c, 0, 0, 192, 96);
    b.appendChild(c); b.insertAdjacentHTML('beforeend', '<b>' + m.n + '</b><small>' + (lock ? 'Unlocks at Lv ' + m.lvl : 'Best: wave ' + (P.best[i + '-' + selMode] || 0) + (m.paths.length > 1 ? ' · 2 lanes' : '')) + '</small>');
    b.onclick = () => { if (lock) return AU.sfx('bad'); selMap = i; AU.sfx('click'); uiPlay(); }; mg.appendChild(b);
  });
  const mr = $('modeRow'); mr.innerHTML = '';
  MODES.forEach((md, i) => { const b = document.createElement('button'); b.className = 'btn' + (i === selMode ? ' pri' : ''); b.textContent = md.n; b.onclick = () => { selMode = i; AU.sfx('click'); uiPlay(); }; mr.appendChild(b); });
  $('modeD').textContent = MODES[selMode].d + ' Bulwark HP ' + MODES[selMode].hp + ', start $' + MODES[selMode].cash + '.';
  $('bDeploy').classList.toggle('dis', !P.load.some(Boolean));
}
let selUnit = 'picket';
function uiLoad() {
  const sl = $('slots'); sl.innerHTML = '';
  P.load.forEach((id, i) => { const b = document.createElement('button'); b.className = 'slot' + (id ? ' f' : ''); if (id) { b.appendChild(icon(id, 0, P.eq[id], 40)); b.lastChild.style.width = '40px'; b.insertAdjacentHTML('beforeend', UNITS[id].n); } else b.textContent = 'Empty'; b.onclick = () => { if (id) { P.load[i] = null; saveP(); AU.sfx('click'); uiLoad(); } }; sl.appendChild(b); });
  const ug = $('unitGrid'); ug.innerHTML = '';
  UNIT_IDS.forEach(id => {
    const d = UNITS[id], own = P.owned[id], inL = P.load.includes(id), b = document.createElement('button'); b.className = 'tile' + (inL ? ' sel' : '') + (own ? '' : ' lock');
    const ic = icon(id, inL ? 2 : 0, P.eq[id], 44); ic.style.width = '44px'; b.appendChild(ic);
    b.insertAdjacentHTML('beforeend', '<b>' + d.n + '</b><small>' + d.role + ' · $' + d.cost + '</small><small>' + ({ g: 'Ground', c: 'Cliff', b: 'Ground/Cliff' })[d.place] + (d.s.air ? ' · Anti-air' : '') + '</small>' + (own ? '' : '<span class="badge coin">' + d.price + 'c</span>'));
    b.onclick = () => {
      selUnit = id; AU.sfx('click');
      if (own) { const i = P.load.indexOf(id); if (i >= 0) P.load[i] = null; else { const f = P.load.indexOf(null); if (f >= 0) P.load[f] = id; else toast('Loadout full'); } saveP(); }
      uiLoad();
    };
    ug.appendChild(b);
  });
  const sb = $('skinBox'), d = UNITS[selUnit], owned = ['default'].concat(P.skins[selUnit] || []);
  sb.innerHTML = '<h3 style="font-size:14px">' + d.n + ' skins <small style="color:var(--mu)">(' + d.ab.n + ': ' + d.ab.d + ')</small></h3>'; const row = document.createElement('div'); row.className = 'row';
  owned.forEach(k => { const b = document.createElement('button'); b.className = 'tile' + ((P.eq[selUnit] || 'default') === k ? ' sel' : ''); b.style.width = '96px'; const ic = icon(selUnit, 3, k, 44); ic.style.width = '44px'; b.appendChild(ic); b.insertAdjacentHTML('beforeend', '<small style="color:' + RARITY[SKINS[k].r].c + '">' + SKINS[k].n + '</small>'); b.onclick = () => { P.eq[selUnit] = k; saveP(); AU.sfx('click'); uiLoad(); }; row.appendChild(b); });
  sb.appendChild(row); if (owned.length < 2) sb.insertAdjacentHTML('beforeend', '<p style="font-size:12px;color:var(--mu);margin-top:6px">Open crates in the Shop to win skins.</p>');
}
let shopTab = 'units';
function uiShop() {
  $('sCoins').textContent = P.coins; document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  const body = $('shopBody'); body.innerHTML = ''; const g = document.createElement('div'); g.className = 'grid'; body.appendChild(g);
  if (shopTab === 'units') {
    UNIT_IDS.filter(id => !P.owned[id]).forEach(id => { const d = UNITS[id], b = document.createElement('button'); b.className = 'tile' + (P.coins < d.price ? ' lock' : ''); const ic = icon(id, 4, null, 48); ic.style.width = '48px'; b.appendChild(ic); b.insertAdjacentHTML('beforeend', '<b>' + d.n + '</b><small>' + d.role + '</small><small>Ability: ' + d.ab.n + '</small><span class="badge coin">' + d.price + 'c</span>'); b.onclick = () => { if (P.coins < d.price) return AU.sfx('bad'); P.coins -= d.price; P.owned[id] = 1; const f = P.load.indexOf(null); if (f >= 0) P.load[f] = id; saveP(); AU.sfx('up'); toast(d.n + ' unlocked!'); uiShop(); }; g.appendChild(b); });
    if (!g.children.length) body.innerHTML = '<p>You own every unit. Commander, the armory is yours.</p>';
  } else {
    CRATES.forEach(cr => { const b = document.createElement('button'); b.className = 'tile' + (P.coins < cr.price ? ' lock' : ''); b.innerHTML = '<div class="cbox" style="animation:none;width:60px;height:60px;font-size:28px;background:' + cr.c + ';margin:0 auto 6px">&#9635;</div><b>' + cr.n + '</b><small>' + cr.odds.map((o, i) => o ? RARITY[i].n + ' ' + Math.round(o * 100) + '%' : '').filter(Boolean).join(' · ') + '</small><span class="badge coin">' + cr.price + 'c</span>'; b.onclick = () => openCrate(cr); g.appendChild(b); });
  }
}
function openCrate(cr) {
  if (P.coins < cr.price) return AU.sfx('bad');
  P.coins -= cr.price; let r = Math.random(), rar = 1; for (let i = 0; i < 4; i++) { if (r < cr.odds[i]) { rar = i; break; } r -= cr.odds[i]; }
  const pool = Object.keys(SKINS).filter(k => SKINS[k].r === rar), sk = pool[Math.floor(Math.random() * pool.length)], id = UNIT_IDS[Math.floor(Math.random() * UNIT_IDS.length)];
  const have = (P.skins[id] || []).includes(sk); let refund = 0; if (have) { refund = Math.round(cr.price * .3); P.coins += refund; } else (P.skins[id] = P.skins[id] || []).push(sk);
  saveP(); const box = $('crate'); box.classList.add('on'); box.innerHTML = '<div class="cbox" style="background:' + cr.c + '">&#9635;</div><b>Opening...</b>'; AU.sfx('click');
  setTimeout(() => {
    box.innerHTML = ''; const ic = icon(id, 4, sk, 96); ic.style.width = '96px'; ic.className = 'rev'; box.appendChild(ic);
    box.insertAdjacentHTML('beforeend', '<b style="color:' + RARITY[rar].c + ';font-size:18px">' + RARITY[rar].n.toUpperCase() + ': ' + SKINS[sk].n + ' ' + UNITS[id].n + '</b><small>' + (have ? 'Duplicate - refunded ' + refund + ' coins' : 'Equip it in Loadout & Skins') + '</small>');
    AU.sfx(rar >= 2 ? 'win' : 'coin'); $('sCoins').textContent = P.coins;
  }, 1100);
  uiShop();
}
function uiQuest() {
  ensureQuests(); const ql = $('qList'); ql.innerHTML = '';
  P.q.list.forEach(q => { const done = q.p >= q.g, d = document.createElement('div'); d.className = 'q'; d.innerHTML = '<div><b>' + q.d + '</b><small style="display:block;color:var(--mu)">' + fmt(q.p) + ' / ' + fmt(q.g) + ' · reward ' + q.rw + ' coins + 50 XP</small><div class="bar"><i style="width:' + (q.p / q.g * 100) + '%"></i></div></div>'; const b = document.createElement('button'); b.className = 'btn' + (done && !q.c ? ' pri' : ' dis'); b.textContent = q.c ? 'Claimed' : done ? 'Claim' : '...'; b.onclick = () => { if (!done || q.c) return; q.c = 1; P.coins += q.rw; addXp(50); saveP(); AU.sfx('coin'); uiQuest(); }; d.appendChild(b); ql.appendChild(d); });
}
function uiBar() {
  const bar = $('bar'); bar.innerHTML = '';
  G.load.forEach((id, i) => { const b = document.createElement('button'); b.className = 'uc'; b.dataset.id = id; const ic = icon(id, 0, P.eq[id], 44); b.appendChild(ic); b.insertAdjacentHTML('beforeend', '<span class="kb">' + (i + 1) + '</span><b class="coin">$' + UNITS[id].cost + '</b>'); b.onclick = () => selPlace(id); bar.appendChild(b); });
}
function selPlace(id) { if (!G || G.demo) return; AU.init(); G.sel = null; G.placing = G.placing === id ? null : id; AU.sfx('click'); uiPanel(); uiHud(); }
function uiHud() {
  $('hHp').textContent = Math.ceil(G.hp) + '/' + G.maxHp; $('hCash').textContent = fmt(G.cash); $('hWave').textContent = G.wave + (G.md.id === 'endless' ? '' : '/' + G.md.waves);
  $('bSpd').textContent = G.spd + 'x';
  document.querySelectorAll('.uc').forEach(b => { b.classList.toggle('sel', G.placing === b.dataset.id); b.classList.toggle('poor', G.cash < UNITS[b.dataset.id].cost); });
  const wb = $('wbtn'); wb.classList.toggle('on', G.state !== 'wave' && G.state !== 'over');
  wb.textContent = G.state === 'pre' ? 'Start wave ' + (G.wave + 1) : 'Next wave in ' + Math.ceil(G.inter) + 's · skip';
  const bs = $('boss'); bs.classList.toggle('on', !!G.boss);
  if (G.boss) { $('bossN').textContent = G.boss.def.n + ' · phase ' + G.boss.ph + (G.boss.hid ? ' · CLOAKED' : ''); $('bossF').style.width = (G.boss.hp / G.boss.max * 100) + '%'; }
  const ab = $('pAb'); if (ab && G.sel) { const u = G.sel; ab.textContent = u.lv < 2 ? 'Ability at Lv 2' : u.ab > 0 ? u.def.ab.n + ' ' + Math.ceil(u.ab) + 's' : u.def.ab.n + ' (Q)'; ab.classList.toggle('pri', u.lv >= 2 && u.ab <= 0); const ub = $('pUp'); if (ub && u.lv < 4) ub.classList.toggle('dis', G.cash < u.def.ups[u.lv][0]); }
}
const TM = ['First', 'Last', 'Strong', 'Close'];
function uiPanel() {
  const p = $('panel'), u = G && G.sel; p.classList.toggle('on', !!u); if (!u) return;
  const s = stat(u.id, u.lv), d = u.def, nx = u.lv < 4 ? d.ups[u.lv] : null;
  const rows = [];
  if (s.dmg) rows.push(['Damage', fmt(s.dmg)], ['Fire rate', (1 / s.rate).toFixed(2) + '/s']);
  if (s.range) rows.push(['Range', s.range.toFixed(1)]);
  if (s.income) rows.push(['Income', '$' + s.income + '/wave']);
  if (s.buff) rows.push(['Buff', '+' + Math.round(s.buff * 100) + '% rate']);
  if (s.splash) rows.push(['Splash', s.splash.toFixed(1)]); if (s.chain) rows.push(['Chain', s.chain]); if (s.slow) rows.push(['Slow', Math.round(s.slow * 100) + '%']); if (s.burn) rows.push(['Burn', s.burn + '/s']);
  rows.push(['Detect', s.det ? 'Yes' : u.det ? 'Aura' : 'No']); if (s.dmg) rows.push(['Anti-air', s.air ? 'Yes' : 'No']);
  const nxt = nx ? Object.entries(nx[1]).map(([k, v]) => ({ dmg: '+' + v + ' dmg', rate: 'faster fire', range: '+' + v + ' range', det: 'detection', income: '+$' + v + ' income', buff: '+' + Math.round(v * 100) + '% buff', splash: 'bigger splash', chain: '+' + v + ' chain', slow: 'stronger slow', burn: 'hotter burn', ap: 'armor pierce', freeze: 'freeze chance', airx: 'more anti-air', mark: 'enemies take +' + Math.round(v * 100) + '%' })[k] || k).join(', ') : 'Max level';
  p.innerHTML = '<div class="row" style="justify-content:space-between"><b>' + d.n + ' <span style="color:' + TIERC[u.lv] + '">Lv ' + u.lv + '/4</span></b><button class="btn" id="pX" style="flex:0;padding:2px 8px">&#215;</button></div>' +
    '<div class="st">' + rows.map(r => '<span>' + r[0] + ': <b>' + r[1] + '</b></span>').join('') + '</div><div class="nx">Next: ' + nxt + '</div>' +
    '<div class="row"><button class="btn pri" id="pUp">' + (nx ? 'Upgrade $' + nx[0] : 'MAX') + '</button><button class="btn" id="pSell">Sell $' + Math.floor(u.spent * .5) + '</button></div>' +
    '<div class="row" style="margin-top:6px">' + (s.dmg ? '<button class="btn" id="pTm">Target: ' + TM[u.tm] + '</button>' : '') + '<button class="btn" id="pAb">' + d.ab.n + '</button></div>';
  $('pX').onclick = () => { G.sel = null; uiPanel(); };
  $('pUp').onclick = () => upgrade(u); $('pSell').onclick = () => sell(u);
  if ($('pTm')) $('pTm').onclick = () => { u.tm = (u.tm + 1) % 4; AU.sfx('click'); uiPanel(); };
  $('pAb').onclick = () => ability(u); if (!nx) $('pUp').classList.add('dis'); uiHud();
}

/* Input */
function evTile(ev) { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height; return [Math.floor(x / T), Math.floor(y / T)]; }
cv.addEventListener('pointermove', ev => { if (G && !G.demo) G.hover = evTile(ev); });
cv.addEventListener('pointerdown', ev => {
  if (!G || G.demo || G.paused) return; AU.init(); const [tx, ty] = evTile(ev);
  if (ev.button === 2) { G.placing = null; G.sel = null; uiPanel(); return; }
  if (G.placing) {
    const why = canPlace(G.placing, tx, ty);
    if (why) { G.hover = [tx, ty]; text(tx * T + T / 2, ty * T, why, '#ff8a8a', 12); AU.sfx('bad'); return; }
    G.sel = place(G.placing, tx, ty); G.placing = null; uiPanel(); return;
  }
  G.sel = G.occ[tx + ',' + ty] || null; if (G.sel) AU.sfx('click'); uiPanel();
});
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', ev => {
  if (!G || G.demo || G.state === 'over') return; const k = ev.key.toLowerCase();
  if (k === 'p' || (k === 'escape' && !G.placing && !G.sel)) return togglePause();
  if (G.paused) return;
  if (k >= '1' && k <= '5' && G.load[k - 1]) selPlace(G.load[k - 1]);
  else if (k === 'escape') { G.placing = null; G.sel = null; uiPanel(); }
  else if (k === ' ') { ev.preventDefault(); startWave(); }
  else if (k === 'f') cycleSpd();
  else if (G.sel && k === 'u') upgrade(G.sel); else if (G.sel && k === 'x') sell(G.sel); else if (G.sel && k === 'q') ability(G.sel); else if (G.sel && k === 't') { G.sel.tm = (G.sel.tm + 1) % 4; uiPanel(); }
});
function cycleSpd() { G.spd = G.spd % 3 + 1; AU.sfx('click'); uiHud(); }
function togglePause(v) { if (!G || G.demo || G.state === 'over') return; G.paused = v === undefined ? !G.paused : v; show(G.paused ? 'sPause' : null); }
function fit() { const st = $('stage'), s = Math.min((st.clientWidth - 8) / W, (st.clientHeight - 8) / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; }
addEventListener('resize', fit);
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.demo && G.state !== 'over') togglePause(true); });

/* Run lifecycle */
function startGame(mapI, modeI, saved) {
  AU.init(); newRun(mapI, modeI, false);
  if (saved) { Object.assign(G, { wave: saved.wave, cash: saved.cash, hp: saved.hp, kills: saved.kills, earned: saved.earned, load: saved.load }); saved.units.forEach(([id, tx, ty, lv, tm, sp]) => { const u = place(id, tx, ty, true); u.lv = lv; u.tm = tm; u.spent = sp; }); G.fx = []; }
  show(null); $('hud').classList.add('on'); $('bar').classList.add('on'); uiBar(); fit(); uiHud(); uiPanel();
  toast(saved ? 'RUN RESUMED · WAVE ' + (G.wave + 1) : MAPS[mapI].n.toUpperCase());
}
function saveRun() { if (!G || G.demo) return; store.set('bw_run', { mapI: G.mapI, modeI: G.modeI, wave: G.wave, cash: G.cash, hp: G.hp, kills: G.kills, earned: G.earned, load: G.load, units: G.units.map(u => [u.id, u.tx, u.ty, u.lv, u.tm, u.spent]) }); }
function flushStats() { for (const k in G.st) qAdd(k, G.st[k]); G.st = {}; saveP(); }
function endRun(win) {
  G.state = 'over'; G.boss = null; store.del('bw_run'); if (win) G.st.wins = 1; flushStats();
  const md = G.md, cleared = win ? G.wave : G.wave - 1, coins = Math.max(0, cleared) * md.coin + Math.floor(G.kills / 20) + (win ? md.win : 0), xp = cleared * 8 + G.kills / 3 + (win ? 200 : 0);
  const key = G.mapI + '-' + G.modeI; P.best[key] = Math.max(P.best[key] || 0, cleared); P.coins += coins; const bonus = addXp(xp); saveP();
  $('eT').textContent = win ? 'VICTORY' : 'DEFEAT'; $('eT').style.color = win ? 'var(--ac)' : 'var(--bad)';
  $('eS').textContent = (win ? 'The Bulwark stands. ' : 'The Bulwark has fallen. ') + G.m.n + ' · ' + md.n + ' · waves cleared: ' + cleared + ' · kills: ' + G.kills;
  $('eR').innerHTML = '<div class="chip" style="margin:0 auto"><span class="coin">+' + coins + ' coins</span><span style="color:#9fe0ff">+' + Math.round(xp) + ' XP</span>' + (bonus ? '<span class="coin">Level up! +' + bonus + '</span>' : '') + '</div>';
  AU.sfx(win ? 'win' : 'lose'); if (win) for (let i = 0; i < 6; i++) setTimeout(() => G && burst(Math.random() * W, Math.random() * H * .6, ['#ffb53b', '#6fdc8c', '#4fa8ff'][i % 3], 40, 200, 1.2, 4), i * 200);
  setTimeout(() => show('sEnd'), 900);
}
function toMenu() { $('hud').classList.remove('on'); $('bar').classList.remove('on'); $('panel').classList.remove('on'); $('boss').classList.remove('on'); $('wbtn').classList.remove('on'); newRun(0, 1, true); show('sTitle'); fit(); }

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { AU.init(); AU.sfx('click'); show(b.dataset.go); }));
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.tab; $('crate').classList.remove('on'); uiShop(); }));
$('bDeploy').onclick = () => { store.del('bw_run'); startGame(selMap, selMode); };
$('bCont').onclick = () => { const s = store.get('bw_run', null); if (s) startGame(s.mapI, s.modeI, s); };
$('wbtn').onclick = () => { AU.init(); startWave(); };
$('bSpd').onclick = cycleSpd; $('bPause').onclick = () => togglePause(true); $('bResume').onclick = () => togglePause(false);
[$('bSnd'), $('bSnd2'), $('bSnd3')].forEach(b => b.onclick = () => { AU.init(); AU.setOn(!P.snd); });
$('bQuit').onclick = () => { if (G.state !== 'wave') saveRun(); flushStats(); toMenu(); };
$('bAbandon').onclick = () => { G.paused = false; endRun(false); };
$('bAgain').onclick = () => startGame(G.mapI, G.modeI);
$('bMenu').onclick = toMenu;

window.BW = { get G() { return G; }, P, step: n => { for (let i = 0; i < n && G.state !== 'over'; i++) step(1 / 60); }, place, upgrade, startWave, ability };
ensureQuests(); newRun(0, 1, true); show('sTitle'); fit(); requestAnimationFrame(frame);
