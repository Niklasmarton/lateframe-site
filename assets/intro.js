// LateFrame front page intro: a figure runs along the headline, front-flips towards the mark, freezes
// mid-flip, rewinds at half speed to the take-off, then flips into the frame and becomes the logo.
// The page (index.html) sets the 'intro' class on <html> before this runs; without it nothing happens.
(() => {
  if (!document.documentElement.classList.contains('intro')) return;   // reduced motion: the page is already in its final state
  clearTimeout(window.lfIntroFallback);

  const YELLOW = '#FFD21F';
  const rad = d => d * Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const easeOut = t => 1 - (1 - t) * (1 - t);

  // ── The rig, in "mark units": 100 = the mark's box. Proportions and the FINAL pose are fitted to the
  // logo figure (assets/mark-figure.svg); its arm stroke is 4.43 units at the widest.
  const RIG = { torso: 17.5, torsoRx: 4.68, torsoRy: 9.46, neck: 8.5, headR: 6.21, shoulder: 16.5, upper: 12.6, fore: 12.6,
                thigh: 17, shin: 18.2, legW: 7.4, armW: 2.215, hipTop: 10.1 };
  // Angles in degrees from straight down; positive = towards the direction the figure faces (right).
  const POSES = {
    FINAL:  { lean: 25.4, head: 4.7, armB: -109.8, elbowB: -4.2, armF: 50.5, elbowF: 9.9, thighF: 62.1, kneeF: -78.5, thighB: -57.4, kneeB: -3.1 },
    CROUCH: { lean: 40, head: -6, armB: -75, elbowB: 30, armF: -55, elbowF: 45, thighF: 80, kneeF: -118, thighB: 55, kneeB: -105, sx: 1.06, sy: 0.9 },
    LAUNCH: { lean: 16, head: 8, armB: 105, elbowB: 25, armF: 140, elbowF: 15, thighF: 2, kneeF: -10, thighB: -34, kneeB: -22, sx: 0.97, sy: 1.04 },
    TUCK:   { lean: 14, head: -2, armB: -50, elbowB: 35, armF: 35, elbowF: 40, thighF: 95, kneeF: -118, thighB: 72, kneeB: -108 },
    REACH:  { lean: 20, head: 4, armB: -70, elbowB: 15, armF: 45, elbowF: 25, thighF: 48, kneeF: -38, thighB: -18, kneeB: -55 },
    LANDSQ: { lean: 36, head: -4, armB: -95, elbowB: 20, armF: 25, elbowF: 50, thighF: 66, kneeF: -100, thighB: -22, kneeB: -72, sx: 1.06, sy: 0.9 },
  };
  const KEYS = ['lean', 'head', 'armB', 'elbowB', 'armF', 'elbowF', 'thighF', 'kneeF', 'thighB', 'kneeB', 'sx', 'sy'];
  const full = p => ({ sx: 1, sy: 1, ...p });
  function mix(a, b, t) { const o = {}; for (const k of KEYS) o[k] = lerp(a[k] ?? 1, b[k] ?? 1, t); return o; }

  // Run cycle: four keys per leg, interpolated round the loop (Catmull-Rom), the other leg half a cycle later.
  const LEG = [[45, -12], [10, -32], [-50, -26], [26, -122]];
  const ARM = [[-95, 40], [-35, 70], [105, 55], [30, 95]];
  function cyc(keys, phase, i) {
    const n = keys.length, x = ((phase % 1) + 1) % 1 * n, k = Math.floor(x), t = x - k;
    const p0 = keys[(k - 1 + n) % n][i], p1 = keys[k][i], p2 = keys[(k + 1) % n][i], p3 = keys[(k + 2) % n][i];
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }
  function runPose(phase) {
    return { lean: 31 + 5 * Math.sin(phase * 4 * Math.PI), head: -12, sx: 1, sy: 1,
      thighF: cyc(LEG, phase, 0), kneeF: cyc(LEG, phase, 1), thighB: cyc(LEG, phase + 0.5, 0), kneeB: cyc(LEG, phase + 0.5, 1),
      armF: cyc(ARM, phase + 0.5, 0), elbowF: cyc(ARM, phase + 0.5, 1), armB: cyc(ARM, phase, 0), elbowB: cyc(ARM, phase, 1) };
  }

  // Joint positions for a pose, in mark units relative to the pelvis (before size, squash, rotation).
  const dir = a => [Math.sin(rad(a)), Math.cos(rad(a))];
  const add = (p, v, l) => [p[0] + v[0] * l, p[1] + v[1] * l];
  function joints(p) {
    const P = [0, 0], up = [Math.sin(rad(p.lean)), -Math.cos(rad(p.lean))];
    const C = add(P, up, RIG.torso), S = add(P, up, RIG.shoulder);
    const H = add(C, [Math.sin(rad(p.lean + p.head)), -Math.cos(rad(p.lean + p.head))], RIG.neck);
    const eB = add(S, dir(p.armB), RIG.upper), hB = add(eB, dir(p.armB + p.elbowB), RIG.fore);
    const eF = add(S, dir(p.armF), RIG.upper), hF = add(eF, dir(p.armF + p.elbowF), RIG.fore);
    const kF = add(P, dir(p.thighF), RIG.thigh), fF = add(kF, dir(p.thighF + p.kneeF), RIG.shin);
    const kB = add(P, dir(p.thighB), RIG.thigh), fB = add(kB, dir(p.thighB + p.kneeB), RIG.shin);
    const torsoMid = add(P, up, RIG.torso / 2 + 0.6), hipTop = add(P, up, RIG.hipTop);
    return { P, C, S, H, eB, hB, eF, hF, kF, fF, kB, fB, torsoMid, hipTop, up };
  }

  // A tapered crescent along a chain of points, like the logo's limbs.
  function crescent(pts, W, profile) {
    const N = 22, L = [], R = [];
    const at = t => {                         // Catmull-Rom through the chain
      const n = pts.length - 1, x = t * n, k = Math.min(n - 1, Math.floor(x)), u = x - k;
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(n, k + 2)];
      return [0, 1].map(i => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u * u + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u * u * u));
    };
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = at(Math.max(0, t - 0.01)), b = at(Math.min(1, t + 0.01)), c = at(t);
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      const w = W * profile(t) / 2;
      L.push([c[0] + nx * w, c[1] + ny * w]); R.push([c[0] - nx * w, c[1] - ny * w]);
    }
    return [...L, ...R.reverse()];
  }
  const legProfile = t => { const s = Math.pow(t, 0.75); return Math.min(1, 4 * s * (1 - s) * 1.05); };
  const armProfile = t => Math.pow(Math.sin(Math.PI * t), 0.74);

  // The figure's shapes in px: root = pelvis, size = px per 100 mark units, rot = whole-body rotation.
  function shapes(pose, root, size, rot) {
    const j = joints(pose), u = size / 100, sx = pose.sx ?? 1, sy = pose.sy ?? 1, cr = Math.cos(rad(rot)), sr = Math.sin(rad(rot));
    const T = p => { const x = p[0] * u * sx, y = p[1] * u * sy; return [root[0] + x * cr - y * sr, root[1] + x * sr + y * cr]; };
    const polys = [
      crescent([j.hipTop, j.P, j.kB, j.fB], RIG.legW, t => Math.min(1, Math.pow(Math.sin(Math.PI * Math.pow(t, 0.55)), 0.9) * 1.04)),
      crescent([j.P, j.kF, j.fF], RIG.legW, legProfile),
      crescent([j.hB, j.eB, j.S, j.eF, j.hF], RIG.armW * 2, armProfile),
    ].map(pts => pts.map(T));
    const tm = T(j.torsoMid), hd = T(j.H);
    return { polys, torso: { c: tm, rx: RIG.torsoRx * u * sx, ry: RIG.torsoRy * u * sy, ang: pose.lean + rot }, head: { c: hd, r: RIG.headR * u } };
  }
  // Points round the whole silhouette, for collision checks.
  function outline(sh) {
    const pts = sh.polys.flat(), { torso: t, head: h } = sh, a = rad(t.ang);
    for (let i = 0; i < 16; i++) {
      const q = i / 16 * 2 * Math.PI, ex = t.rx * Math.cos(q), ey = t.ry * Math.sin(q);
      pts.push([t.c[0] + ex * Math.cos(a) - ey * Math.sin(a), t.c[1] + ex * Math.sin(a) + ey * Math.cos(a)]);
      pts.push([h.c[0] + h.r * Math.cos(q), h.c[1] + h.r * Math.sin(q)]);
    }
    return pts;
  }
  function drawRig(g, pose, root, size, rot, opacity) {
    if (!pose) { g.setAttribute('opacity', 0); return; }
    const sh = shapes(pose, root, size, rot), f = v => v.toFixed(1);
    const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
    const { torso: t, head: h } = sh;
    g.innerHTML = sh.polys.map(pts => `<path d="${poly(pts)}"/>`).join('') +
      `<ellipse cx="${f(t.c[0])}" cy="${f(t.c[1])}" rx="${f(t.rx)}" ry="${f(t.ry)}" transform="rotate(${f(t.ang)} ${f(t.c[0])} ${f(t.c[1])})"/>` +
      `<circle cx="${f(h.c[0])}" cy="${f(h.c[1])}" r="${f(h.r)}"/>`;
    g.setAttribute('fill', YELLOW);
    g.setAttribute('opacity', opacity);
  }

  // ── The page: mark, headline lines and the letters' heights (the terrain).
  const teaser = document.getElementById('teaser'), stage = document.getElementById('stage'), markbox = document.getElementById('markbox');
  const h1 = document.getElementById('headline');
  const HEIGHT = c => /[A-Zbdfhkl]/.test(c) ? 0.73 : c === 't' ? 0.64 : /[a-z]/.test(c) ? 0.55 : c === '.' ? 0.13 : 0;
  let G = null, TL = null;

  function measure() {
    { const hr = h1.getBoundingClientRect(); layoutKey = `${hr.left|0},${hr.top|0},${hr.width|0},${hr.height|0}`; }
    const st = stage.getBoundingClientRect(), mk = markbox.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(h1).fontSize);
    const lines = [...h1.querySelectorAll('.ln')].map(ln => {
      const base = ln.querySelector('.bl').getBoundingClientRect().top - st.top;
      const text = [...ln.childNodes].find(n => n.nodeType === 3), chars = [];
      for (let i = 0; i < text.length; i++) {
        const r = document.createRange(); r.setStart(text, i); r.setEnd(text, i + 1);
        const b = r.getBoundingClientRect(), h = HEIGHT(text.data[i]);
        if (h) chars.push({ l: b.left - st.left, r: b.right - st.left, top: base - h * fs, base });
      }
      return terrain({ base, chars, left: chars[0].l, right: chars[chars.length - 1].r, xTop: base - 0.55 * fs }, fs);
    });
    G = { fs, lines, m: mk.width, mark: [mk.left - st.left, mk.top - st.top] };
    build();
  }
  // Terrain: the top of the letters along a line, every 2 px, softened over a small width so a
  // foot steps from a tall letter to a short one without a jump. Gaps between words have no ground.
  function terrain(line, fs) {
    const x0 = line.left - 2 * fs, x1 = line.right + 2 * fs, n = Math.ceil((x1 - x0) / 2) + 1, raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 2; let y = line.base;
      for (const c of line.chars) if (x >= c.l && x <= c.r) y = Math.min(y, c.top);
      raw[i] = x < line.left || x > line.right ? line.xTop : y;
    }
    const r = Math.max(1, Math.round(0.035 * fs / 2)), prof = new Float32Array(n);
    for (let i = 0; i < n; i++) { let sum = 0, k = 0; for (let d = -r; d <= r; d++) { const v = raw[i + d]; if (v !== undefined) { sum += v; k++; } } prof[i] = sum / k; }
    return { ...line, x0, prof };
  }
  function ground(line, x) {
    const f = (x - line.x0) / 2, i = clamp(Math.floor(f), 0, line.prof.length - 2), k = clamp(f - i, 0, 1);
    return lerp(line.prof[i], line.prof[i + 1], k);
  }
  // Pelvis position that puts the lower foot (relative to the letters under each foot) on the letters.
  // The figure rests on the letters with the whole outline of its legs: whichever part (foot, shin,
  // knee) would touch first decides the height, so a leg reaching across a step doesn't cut a corner.
  const groundAt = (line, x, pose, size) => {
    const sh = shapes(pose, [x, 0], size, 0); let y = Infinity;
    for (const pts of [sh.polys[0], sh.polys[1]]) for (const [px, py] of pts) y = Math.min(y, ground(line, px) - py);
    return [x, y];
  };
  // No part of the figure may sink into a letter: lift it by the deepest overlap.
  function lift(pose, root, size, rot) {
    let pen = 0;
    for (const [x, y] of outline(shapes(pose, root, size, rot)))
      for (const ln of G.lines) for (const c of ln.chars)
        if (x > c.l + 1 && x < c.r - 1 && y > c.top && y < c.base) pen = Math.max(pen, y - c.top);
    return pen > 0 ? [root[0], root[1] - pen - 0.5] : root;
  }

  // ── The performance: segments of time, each giving pose, pelvis position, size and rotation.
  function build() {
    const { fs, lines: [L1, L2], m, mark } = G;
    const s = Math.min(1.65 * fs, 1.5 * m);              // figure size while running on the text
    const v = 3.3 * s, CYCLE = 0.34;                     // run speed (px/s) and stride cycle (s)
    const finalRoot = [mark[0] + 51 * m / 100, mark[1] + 50 * m / 100];
    const segs = []; let t = 0;
    const push = seg => { seg.t0 = t; t += seg.dur; seg.t1 = t; segs.push(seg); return seg; };
    const groundRoot = groundAt;

    // Keyframed pose inside a segment: [[u, pose], ...], eased between keys.
    const keyed = keys => u => {
      for (let i = 0; i < keys.length - 1; i++) if (u <= keys[i + 1][0]) {
        const k = (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return mix(full(keys[i][1]), full(keys[i + 1][1]), smooth(clamp(k, 0, 1)));
      }
      return full(keys[keys.length - 1][1]);
    };
    // A jump from a to b (pelvis points), height h above the straight line between them.
    const arcRoot = (a, b, h) => u => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - h * 4 * u * (1 - u)];

    // 1. Leap in from off-screen left onto "every".
    const x2a = L2.left + 0.22 * s;
    const land2 = groundRoot(L2, x2a, full(POSES.REACH), s);   // arrive feet-first; the landing squash follows on the ground
    const in0 = [-0.7 * s, land2[1] - 1.1 * s];
    push({ dur: 0.42, size: () => s, rot: u => lerp(-25, 0, easeOut(u)), pose: keyed([[0, POSES.TUCK], [0.55, POSES.TUCK], [1, POSES.REACH]]), root: arcRoot(in0, land2, 0.35 * s), cue: 'in' });
    const xr0 = x2a + 0.25 * v * 0.1;
    push({ dur: 0.1, size: () => s, rot: () => 0, pose: keyed([[0, POSES.LANDSQ], [1, runPose(0)]]), line: L2, x: u => lerp(x2a, xr0, u) });
    // 2. Run along "every…" towards "Watch".
    const take1 = Math.max(xr0 + 0.05 * s, L1.left - 0.5 * s);
    const run2 = push({ dur: Math.max(0.17, (take1 - xr0) / v), size: () => s, rot: () => 0, cue: 'run2' });
    run2.pose = u => runPose((u * run2.dur) / CYCLE);
    run2.line = L2; run2.x = u => lerp(xr0, take1, u);
    // 3. Crouch at the foot of "Watch", push off "every", then one front salto over "Watch" into the
    //    frame, opening into the logo pose. The pelvis flies a true ballistic arc: constant forward
    //    speed, constant gravity, so it rises fast, hangs at the top and drops softly into the frame.
    push({ dur: 0.07, size: () => s, rot: () => 0, pose: u => mix(run2.pose(1), full(POSES.CROUCH), smooth(u)), line: L2, x: () => take1 });
    push({ dur: 0.08, size: () => s, rot: () => 0, pose: u => mix(full(POSES.CROUCH), full(POSES.LAUNCH), u * u), line: L2, x: () => take1, cue: 'push' });
    const p0 = groundRoot(L2, take1, full(POSES.LAUNCH), s), FLIGHT = 0.8;
    const fPose = keyed([[0, POSES.LAUNCH], [0.12, POSES.LAUNCH], [0.28, POSES.TUCK], [0.6, POSES.TUCK], [0.82, POSES.REACH], [1, POSES.FINAL]]);
    const fSize = u => lerp(s, m, smooth(u));
    // Spin: angular momentum is conserved, so it turns fast tucked and slowly stretched out, and eases
    // off as the feet find the frame. Integrated once and scaled to exactly one turn.
    const tuck = u => { const K = [[0, 0], [0.12, 0.1], [0.28, 1], [0.6, 1], [0.82, 0.3], [1, 0]];
      for (let i = 0; i < K.length - 1; i++) if (u <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], smooth((u - K[i][0]) / (K[i + 1][0] - K[i][0]))); return 0; };
    const N = 240, turn = [0];
    for (let i = 1; i <= N; i++) { const u = (i - 0.5) / N; turn.push(turn[i - 1] + (1 - 0.6 * smooth(clamp((u - 0.85) / 0.15, 0, 1))) / (1 - 0.62 * tuck(u))); }
    const fRot = u => { const f = clamp(u, 0, 1) * N, i = Math.min(N - 1, Math.floor(f)); return 360 * lerp(turn[i], turn[i + 1], f - i) / turn[N]; };
    // Arc with its top h above the frame: y = top + K (u - ua)^2, through the take-off and the frame.
    const arc = h => { const top = finalRoot[1] - h, hu = p0[1] - top, hd = h, ua = Math.sqrt(hu) / (Math.sqrt(hu) + Math.sqrt(hd)), K = hu / (ua * ua);
      return u => [lerp(p0[0], finalRoot[0], u), top + K * (u - ua) * (u - ua)]; };
    // The lowest arc (at least 0.3 of the frame above it) that clears "Watch" by a small margin.
    const clears = r => { for (let i = 2; i <= 80; i++) { const u = i / 80;
      for (const [x, y] of outline(shapes(fPose(u), r(u), fSize(u), fRot(u)))) for (const c of L1.chars)
        if (x > c.l - 2 && x < c.r + 2 && y > c.top - 0.05 * s && y < c.base) return false; } return true; };
    let h = 0.3 * m; while (!clears(arc(h)) && h < 5 * m) h += 0.05 * m;
    const fRoot = arc(h);
    push({ dur: FLIGHT, size: fSize, rot: fRot, pose: fPose, root: fRoot, cue: 'salto' });
    // 4. Land in the frame: no dead stop. The body carries its arrival speed and spin a few pixels
    //    further, knees giving, then springs back to the exact logo pose (a critically damped spring).
    const e = 1e-3, vx = (fRoot(1)[0] - fRoot(1 - e)[0]) / e / FLIGHT, vy = (fRoot(1)[1] - fRoot(1 - e)[1]) / e / FLIGHT, vr = (fRot(1) - fRot(1 - e)) / e / FLIGHT;
    const SETTLE = 0.32, OMEGA = 20, SQUASH = full({ ...POSES.FINAL, sx: 1.05, sy: 0.92, kneeF: -92 });
    const give = u => { const tau = u * SETTLE; return tau * Math.exp(-OMEGA * tau) * (1 - smooth(clamp((u - 0.55) / 0.45, 0, 1))); };   // displacement per unit of arrival speed; 0 at the end
    push({ dur: SETTLE, size: () => m, rot: u => vr * give(u), pose: u => mix(full(POSES.FINAL), SQUASH, OMEGA * Math.E * give(u)),
           root: u => [finalRoot[0] + vx * give(u), finalRoot[1] + vy * give(u)], cue: 'end' });
    TL = timeline(segs);
    // Mid-flip: the moment it is upside down, where the replay freezes and rewinds.
    let um = 0; while (um < 1 && fRot(um) < 180) um += 1 / 400;
    TL.midFlip = TL.cues.salto.t0 + um * FLIGHT;
  }
  // Index the cues, and precompute the lift needed to clear the letters every 1/240 s: a max filter
  // followed by an average over the same window, so lifts ramp in smoothly and are never less than needed.
  function timeline(segs) {
    const tl = { segs, total: segs[segs.length - 1].t1, cues: {}, DT: 1 / 240 };
    segs.forEach(sg => { if (sg.cue) tl.cues[sg.cue] = sg; });
    const n = Math.ceil(tl.total / tl.DT) + 1, need = new Float32Array(n), W = Math.round(0.07 / tl.DT);
    for (let i = 0; i < n; i++) { const st = rawState(i * tl.DT, tl); need[i] = st.root[1] - lift(st.pose, st.root, st.size, st.rot)[1]; }
    const mx = need.map((_, i) => { let m = 0; for (let d = -W; d <= W; d++) m = Math.max(m, need[i + d] ?? 0); return m; });
    tl.lift = mx.map((_, i) => { let sum = 0, k = 0; for (let d = -W; d <= W; d++) { const v = mx[i + d]; if (v !== undefined) { sum += v; k++; } } return sum / k; });
    return tl;
  }

  const BLEND = 0.06;
  function stateAt(t, tl = TL) {
    const st = rawState(t, tl), f = clamp(t, 0, tl.total) / tl.DT, i = Math.min(tl.lift.length - 2, Math.floor(f));
    const l = lerp(tl.lift[i], tl.lift[i + 1], clamp(f - i, 0, 1));
    return { ...st, root: [st.root[0], st.root[1] - l] };
  }
  function rawState(t, tl = TL) {
    const { segs } = tl; t = clamp(t, 0, tl.total - 1e-6);
    const i = segs.findIndex(sg => t < sg.t1), sg = segs[i], u = (t - sg.t0) / sg.dur;
    let pose = sg.pose(u), rot = sg.rot(u);
    if (i > 0 && t - sg.t0 < BLEND) {             // ease out of the previous segment's last pose and tilt
      const prev = segs[i - 1], k = smooth((t - sg.t0) / BLEND), r0 = prev.rot(1);
      pose = mix(prev.pose(1), pose, k); rot = r0 + ((((rot - r0) % 360) + 540) % 360 - 180) * k;   // the short way round: 360° is 0°
    }
    const size = sg.size(u);   // on the ground: place the pose actually drawn (after blending) on the letters
    return { pose, root: sg.line ? groundAt(sg.line, sg.x(u), pose, size) : sg.root(u), size, rot };
  }

  // ── Playback: the salto is played, frozen mid-flip, rewound at half speed, then played to the landing.
  const layers = ['actor', 'ghost1', 'ghost2'].map(id => document.getElementById(id));
  let layoutKey = '';
  function render(t, mode, tl = TL) {
    const hr = h1.getBoundingClientRect(), key = `${hr.left|0},${hr.top|0},${hr.width|0},${hr.height|0}`;
    if (key !== layoutKey) { layoutKey = key; measure(); }
    const st = stateAt(t, tl);
    drawRig(layers[0], st.pose, st.root, st.size, st.rot, 1);
    const scrub = mode === 'back', d = -1;
    [1, 2].forEach(k => {
      if (!scrub) { layers[k].setAttribute('opacity', 0); return; }
      const g = stateAt(t - d * k * 0.045, tl); drawRig(layers[k], g.pose, g.root, g.size, g.rot, k === 1 ? 0.25 : 0.11);
    });
  }

  let raf = 0;
  // One slow rewind: the salto plays until the figure is upside down and eases to a freeze, holds, and
  // is rewound at half speed until the feet touch "every" again. After a hold it plays forward, all
  // the way into the frame. Speed changes are eased so nothing jerks.
  const RW = 0.5;
  function playback() {
    const c = TL.cues, slow = 0.12, rw = RW;
    const stop = TL.midFlip;                 // upside down, mid-flip
    const back = c.salto.t0;                 // feet back on "every": the instant they left it
    const plan = [
      { from: 0, to: stop - slow, speed: 1 },
      { from: stop - slow, to: stop, speed: 1, ease: 'out' },   // brake to a freeze mid-air
      { pause: 0.16 },
      { from: stop, to: back, speed: rw, ease: 'inout' },       // the one rewind, in slow motion, to touch-down
      { pause: 0.12 },
      { from: back, to: back + slow, speed: 1, ease: 'in' },    // pick up speed again
      { from: back + slow, to: TL.total, speed: 1 },            // the salto into the frame
    ];
    const factor = { out: 2, in: 2 };
    let t0 = 0; const items = plan.map(p => { const dur = p.pause ?? (factor[p.ease] ?? 1) * Math.abs(p.to - p.from) / p.speed; const it = { start: t0, dur, p }; t0 += dur; return it; });
    return { items, total: t0 };
  }
  // Where the animation is (t) and what it is doing (mode) at e seconds into playback.
  function sample(pb, e, last) {
    const it = pb.items.find(x => e < x.start + x.dur) || pb.items[pb.items.length - 1], p = it.p;
    if (p.pause !== undefined) return { ...last, mode: 'pause' };
    const k = clamp((e - it.start) / it.dur, 0, 1);
    const f = p.ease === 'out' ? 1 - (1 - k) * (1 - k) : p.ease === 'in' ? k * k : p.ease === 'inout' ? smooth(k) : k;
    return { t: lerp(p.from, p.to, f), mode: p.to < p.from ? 'back' : 'play' };
  }
  function run() {
    cancelAnimationFrame(raf); teaser.classList.remove('done'); measure();
    const pb = playback(), start = performance.now(); let last = { t: 0 };
    const tick = now => {
      const e = (now - start) / 1000;
      if (e >= pb.total) { finish(); return; }
      const st = sample(pb, e, last); last = st; render(st.t, st.mode);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function finish() { render(TL.total, 'play'); teaser.classList.add('done'); }

  window.addEventListener('resize', () => { if (!teaser.classList.contains('done')) measure(); });
  // Start once the headline font is in (the letters' positions are the terrain) and the page is
  // visible. If the font takes too long, skip the show and present the finished page.
  const fontsIn = Promise.all(['800 1em "Inter Tight"', '600 1em "Inter Tight"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready);
  const late = new Promise(r => setTimeout(() => r('late'), 2500));
  const whenVisible = () => document.hidden ? document.addEventListener('visibilitychange', whenVisible, { once: true }) : run();
  const settled = () => { document.documentElement.classList.remove('intro'); };   // finished page, no show
  Promise.race([fontsIn, late]).then(r => {
    if (!markbox.getBoundingClientRect().width) return settled();   // styles missing: nothing to land in
    r === 'late' ? (measure(), finish()) : whenVisible();
  }, settled);
})();
