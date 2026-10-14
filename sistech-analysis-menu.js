/*
 * Sistech 3D 분석 메뉴 (왼쪽 메뉴바 + 측정 기능: 거리 / 높이 / 면적 / 체적 + 그리기 + 선택 + 보안구역 위장 기능)
 * - 3dview.sistech3d.com 과 같은 출처(same-origin)에서 실행해야 합니다. (콘솔 붙여넣기 또는 같은 도메인 경로에 호스팅)
 * - 사이트 상단 헤더는 그대로 두고, 그 아래 영역에 분석용 Cesium 뷰어를 덮어서 띄웁니다.
 * - 새 기능 추가 방법:
 *     SisMenu.addFeature({ id:'xxx', icon:'🧪', title:'이름', mount(panel, api){ ... }, unmount(){ ... } });
 *   api = { C, viewer, scene, loadProject, getTilesets, toast }
 */
(async function () {
  if (window.SisMenu) { try { window.SisMenu.destroy(); } catch (e) {} }
  const BASE = location.origin;
  const PROJECTS = [
    { id: 'busan_01', name: '부산-1 (마린시티, 해운대)' },
    { id: 'incheon_busan_01', name: '인천-부산-1' },
    { id: 'incheon_01', name: '인천-1' },
    { id: 'bundang_01', name: '분당-1' },
    { id: 'goyang_01', name: '고양-1' },
  ];

  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load fail ' + src)); document.head.appendChild(s);
  });
  if (!window.Cesium) {
    window.CESIUM_BASE_URL = BASE + '/cesium/';
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + '/cesium/Widgets/widgets.css'; document.head.appendChild(l);
    await loadScript(BASE + '/cesium/Cesium.js');
  }
  const C = window.Cesium;

  // ================= 레이아웃 =================
  const hdr = document.querySelector('header');
  const HEADER_H = Math.round((hdr && hdr.getBoundingClientRect().bottom) || 56);
  const RAIL_W = 68, PANEL_W = 320;
  const root = document.createElement('div');
  root.id = 'sis-menu-root';
  root.style.cssText = `position:fixed;left:0;right:0;bottom:0;top:${HEADER_H}px;z-index:2147483000;background:#000;font-family:Inter,"Noto Sans KR",sans-serif;color:#e8eaf6;`;
  root.innerHTML = `
    <style>
      #sis-menu-root *{box-sizing:border-box}
      #sis-rail{position:absolute;left:0;top:0;bottom:0;width:${RAIL_W}px;background:#0b0d1a;border-right:1px solid #232846;display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:6px;z-index:3}
      .sis-rb{width:56px;padding:8px 2px;background:none;border:1px solid transparent;border-radius:10px;color:#aab2d8;cursor:pointer;font-size:11px;line-height:1.3}
      .sis-rb .ic{display:block;font-size:22px;margin-bottom:2px}
      .sis-rb:hover{background:#171c36}.sis-rb.on{background:#262e63;border-color:#5b6cff;color:#fff}
      #sis-panel{position:absolute;left:${RAIL_W}px;top:0;bottom:0;width:${PANEL_W}px;background:rgba(12,14,26,.96);border-right:1px solid #232846;z-index:2;display:flex;flex-direction:column;transition:transform .18s}
      #sis-panel.hide{transform:translateX(-${PANEL_W}px)}
      #sis-ptop{padding:12px 14px;border-bottom:1px solid #232846}
      #sis-pbody{padding:12px 14px;overflow:auto;flex:1;font-size:13px}
      #sis-cesium{position:absolute;inset:0}
      .sis-btn{background:#1d2340;color:#e8eaf6;border:1px solid #343b66;border-radius:8px;padding:8px 6px;cursor:pointer;font-size:13px}
      .sis-btn:hover{background:#2a3260}.sis-btn.on{background:#5b6cff;border-color:#8a96ff}
      .sis-in{width:100%;padding:6px;background:#161a2e;color:#e8eaf6;border:1px solid #2c3050;border-radius:6px;font-size:13px}
      .sis-res{border-top:1px solid #272c4d;padding:8px 0;line-height:1.55;position:relative}
      .sis-res b{color:#9fb0ff}.sis-res .x{position:absolute;right:0;top:6px;background:none;border:0;color:#889;cursor:pointer;font-size:14px}
      .sis-lbl{font-size:12px;color:#9aa}
      #sis-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(12,14,26,.95);border:1px solid #343b66;padding:8px 14px;border-radius:8px;font-size:13px;z-index:5;display:none}
    </style>
    <div id="sis-cesium"></div>
    <div id="sis-rail"></div>
    <div id="sis-panel">
      <div id="sis-ptop">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <b style="font-size:15px">3D 분석 메뉴</b>
          <span id="sis-ptitle" class="sis-lbl"></span>
        </div>
        <span class="sis-lbl">프로젝트</span>
        <select id="sis-proj" class="sis-in" style="margin-top:4px"></select>
        <div id="sis-status" class="sis-lbl" style="margin-top:6px"></div>
      </div>
      <div id="sis-pbody"></div>
    </div>
    <div id="sis-toast"></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);

  // ================= 뷰어 =================
  const viewer = new C.Viewer('sis-cesium', {
    baseLayer: new C.ImageryLayer(new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })),
    baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
    infoBox: false, selectionIndicator: false,
  });
  const scene = viewer.scene;
  scene.globe.depthTestAgainstTerrain = true;
  scene.screenSpaceCameraController.enableCollisionDetection = true;
  viewer.cesiumWidget.creditContainer.style.display = 'none';
  // 왼쪽 패널에 가리지 않도록 뷰어 영역 전체를 쓰되 툴바 여백만 둠
  let tileset = null;
  const toast = (msg, ms = 2500) => { const t = $('#sis-toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = 'none'), ms); };

  async function getToken() { const r = await fetch(BASE + '/api/tileset-token', { credentials: 'include' }); return (await r.json()).token; }
  async function loadProject(id) {
    $('#sis-status').textContent = '모델 로딩 중...';
    if (tileset) { scene.primitives.remove(tileset); tileset = null; }
    try {
      const token = await getToken();
      const res = new C.Resource({ url: BASE + '/api/tileset/project/' + id + '/tileset.json', queryParameters: { token } });
      tileset = await C.Cesium3DTileset.fromUrl(res, { maximumScreenSpaceError: 8 });
      scene.primitives.add(tileset);
      await viewer.zoomTo(tileset, new C.HeadingPitchRange(0, C.Math.toRadians(-40), tileset.boundingSphere.radius * 1.2));
      $('#sis-status').textContent = '로드 완료: ' + id;
      features.forEach((f) => f.onProjectChange && f.onProjectChange(id));
    } catch (e) { $('#sis-status').textContent = '로드 실패: ' + (e.message || e); }
  }
  const sel = $('#sis-proj');
  PROJECTS.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.appendChild(o); });
  sel.onchange = () => loadProject(sel.value);

  // ================= 메뉴 레지스트리 =================
  const features = [];
  let active = null;
  const api = { C, viewer, scene, loadProject, getTilesets: () => (tileset ? [tileset] : []), toast };
  function renderRail() {
    const rail = $('#sis-rail'); rail.innerHTML = '';
    features.forEach((f) => {
      const b = document.createElement('button'); b.className = 'sis-rb' + (active === f ? ' on' : ''); b.title = f.title;
      b.innerHTML = `<span class="ic">${f.icon}</span>${f.title}`;
      b.onclick = () => openFeature(active === f ? null : f);
      rail.appendChild(b);
    });
    const sp = document.createElement('div'); sp.style.flex = '1'; rail.appendChild(sp);
    const x = document.createElement('button'); x.className = 'sis-rb'; x.title = '분석 메뉴 닫기';
    x.innerHTML = '<span class="ic">✕</span>닫기'; x.onclick = () => destroy(); rail.appendChild(x);
  }
  function openFeature(f) {
    if (active && active.unmount) { try { active.unmount(); } catch (e) {} }
    active = f;
    const body = $('#sis-pbody'); body.innerHTML = '';
    $('#sis-panel').classList.toggle('hide', !f);
    $('#sis-ptitle').textContent = f ? f.title : '';
    if (f) f.mount(body, api);
    renderRail();
  }
  function addFeature(f, o) { if (o && o.first) features.unshift(f); else features.push(f); renderRail(); if (!active) openFeature(f); }

  // ================= 공통 헬퍼 =================
  const fmtLen = (m) => (m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m.toFixed(2) + ' m');
  const fmtArea = (m2) => (m2 >= 1e6 ? (m2 / 1e6).toFixed(4) + ' ㎢' : m2.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + ' ㎡' + (m2 >= 1e4 ? ' (' + (m2 / 1e4).toFixed(3) + ' ha)' : ''));
  const fmtVol = (m3) => m3.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + ' ㎥';
  const carto = (p) => C.Cartographic.fromCartesian(p);
  const horizDist = (a, b) => {
    const ca = carto(a), cb = carto(b);
    return new C.EllipsoidGeodesic(new C.Cartographic(ca.longitude, ca.latitude), new C.Cartographic(cb.longitude, cb.latitude)).surfaceDistance;
  };
  function pick(pos) {
    let p; if (scene.pickPositionSupported) p = scene.pickPosition(pos);
    if (!p) p = viewer.camera.pickEllipsoid(pos, scene.globe.ellipsoid);
    return p;
  }
  function toENU(pts) {
    const frame = C.Transforms.eastNorthUpToFixedFrame(pts[0]);
    const inv = C.Matrix4.inverseTransformation(frame, new C.Matrix4());
    return { frame, L: pts.map((p) => C.Matrix4.multiplyByPoint(inv, p, new C.Cartesian3())) };
  }
  // 면적 두 가지:
  //  projected = 폴리곤을 수평면(2D)으로 환산한 면적 (높이 무시)
  //  surface   = 클릭한 3D 점들을 삼각형으로 이어 만든 면의 실제 면적 (삼각형 3D 면적의 합)
  function areaOf(pts) {
    const { L } = toENU(pts); let proj = 0;
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; proj += a.x * b.y - b.x * a.y; }
    const tri = triangulate(L.map((v) => [v.x, v.y]));
    let surface = 0;
    tri.forEach(([i, j, k]) => {
      const u = C.Cartesian3.subtract(L[j], L[i], new C.Cartesian3()), v = C.Cartesian3.subtract(L[k], L[i], new C.Cartesian3());
      surface += C.Cartesian3.magnitude(C.Cartesian3.cross(u, v, new C.Cartesian3())) / 2;
    });
    return { projected: Math.abs(proj) / 2, surface, tri };
  }
  const YEL = C.Color.fromCssColorString('#ffd54f');
  // 도구별 색상 (거리=노랑, 높이=보라/빨강/하늘, 면적=초록, 체적=주황)
  const HEX = { distance: '#ffd54f', height: '#e040fb', area: '#69f0ae', volume: '#ff9800' };
  const COL = {}; Object.keys(HEX).forEach((k) => (COL[k] = C.Color.fromCssColorString(HEX[k])));
  const changeCbs = []; const emitChange = () => changeCbs.forEach((f) => { try { f(); } catch (e) {} });   // 도형/측정 결과가 바뀔 때 (선택 기능이 구독)
  const rm = (e) => { if (e && e.__prim) { try { scene.primitives.remove(e.__prim); } catch (x) {} } else viewer.entities.remove(e); };
  const addPoint = (p, color = YEL) => viewer.entities.add({ position: p, point: { pixelSize: 9, color, outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
  const addLabel = (pos, text, oy = -14) => viewer.entities.add({
    position: pos,
    label: { text, font: '13px "Noto Sans KR",sans-serif', fillColor: C.Color.WHITE, showBackground: true,
      backgroundColor: C.Color.fromCssColorString('#0c0e18').withAlpha(0.85), pixelOffset: new C.Cartesian2(0, oy),
      disableDepthTestDistance: Number.POSITIVE_INFINITY, verticalOrigin: C.VerticalOrigin.BOTTOM },
  });
  const addLine = (positions, color = YEL, dashed = false) => viewer.entities.add({
    polyline: { positions, width: 3, arcType: C.ArcType.NONE, material: dashed ? new C.PolylineDashMaterialProperty({ color }) : color, depthFailMaterial: color },
  });

  // ================= 체적 계산 =================
  // 다각형 삼각분할 (ear clipping) - 경계점 기준 면 만들기
  function triangulate(poly) {
    const n = poly.length; let idx = [...Array(n).keys()];
    let A = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
    if (A < 0) idx.reverse();
    const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inTri = (p, a, b, c) => cr(a, b, p) >= -1e-9 && cr(b, c, p) >= -1e-9 && cr(c, a, p) >= -1e-9;
    const tris = []; let guard = 0;
    while (idx.length > 3 && guard++ < 2000) {
      let found = false;
      for (let i = 0; i < idx.length; i++) {
        const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        const a = poly[i0], b = poly[i1], c = poly[i2];
        if (cr(a, b, c) <= 1e-9) continue;
        let ok = true; for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; if (inTri(poly[j], a, b, c)) { ok = false; break; } }
        if (ok) { tris.push([i0, i1, i2]); idx.splice(i, 1); found = true; break; }
      }
      if (!found) break;
    }
    if (idx.length >= 3) for (let k = 1; k < idx.length - 1; k++) tris.push([idx[0], idx[k], idx[k + 1]]);
    return tris;
  }
  // 체적 기준면: 'surface' = 경계점(3D 높이 포함)을 모두 이은 면, 그 외 = 수평면
  function makeBase(pts, baseMode, baseCustom) {
    const { L } = toENU(pts); const h0 = carto(pts[0]).height; const bh = pts.map((p) => carto(p).height);
    const mean = bh.reduce((a, b) => a + b, 0) / bh.length;
    if (baseMode === 'surface') {
      const poly = L.map((v) => [v.x, v.y]), zs = L.map((v) => v.z), tri = triangulate(poly);
      const tb = tri.map(([a, b, c]) => { const A = poly[a], B = poly[b], Cc = poly[c]; const den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]); return { a, b, c, den }; });
      const fn = (x, y) => {
        let best = null, bestMin = -Infinity;
        for (const t of tb) {
          const A = poly[t.a], B = poly[t.b], Cc = poly[t.c];
          const l1 = ((B[1] - Cc[1]) * (x - Cc[0]) + (Cc[0] - B[0]) * (y - Cc[1])) / t.den, l2 = ((Cc[1] - A[1]) * (x - Cc[0]) + (A[0] - Cc[0]) * (y - Cc[1])) / t.den, l3 = 1 - l1 - l2;
          const m = Math.min(l1, l2, l3);
          if (m >= -1e-9) return l1 * zs[t.a] + l2 * zs[t.b] + l3 * zs[t.c];
          if (m > bestMin) { bestMin = m; best = [l1, l2, l3, t]; }
        }
        if (!best) return zs.reduce((a, b) => a + b, 0) / zs.length;
        const [l1, l2, l3, t] = best; return l1 * zs[t.a] + l2 * zs[t.b] + l3 * zs[t.c];   // 경계 밖 오차는 가장 가까운 면으로 연장
      };
      return { mode: 'surface', fn, min: Math.min(...zs), max: Math.max(...zs), tri, base: mean, h0, hMin: Math.min(...bh), hMax: Math.max(...bh) };
    }
    const base = baseMode === 'min' ? Math.min(...bh) : baseMode === 'max' ? Math.max(...bh) : baseMode === 'custom' ? baseCustom : mean;
    return { mode: 'flat', fn: () => base - h0, min: base - h0, max: base - h0, base, h0, hMin: base, hMax: base };
  }
  async function computeVolume(pts, baseMode, baseCustom, onProgress) {
    const { frame, L } = toENU(pts);
    const poly = L.map((v) => [v.x, v.y]);
    let A = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; A += a[0] * b[1] - b[0] * a[1]; }
    const area = Math.abs(A) / 2;
    const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    let step = Math.max(0.5, Math.sqrt(area / 4000)), cells = [];
    for (let tries = 0; tries < 5; tries++) {
      cells = [];
      for (let x = minx + step / 2; x < maxx; x += step) for (let y = miny + step / 2; y < maxy; y += step) if (inside(x, y)) cells.push([x, y]);
      if (cells.length <= 8000) break; step *= 1.5;
    }
    const cartos = cells.map(([x, y]) => carto(C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(x, y, 0), new C.Cartesian3())));
    const heights = [];
    for (let i = 0; i < cartos.length; i += 1500) {
      const chunk = cartos.slice(i, i + 1500);
      let out;
      try { out = await scene.sampleHeightMostDetailed(chunk); } catch (e) { out = chunk.map((c) => ({ height: scene.sampleHeight(c) })); }
      out.forEach((c) => heights.push(c.height));
      onProgress && onProgress(Math.min(100, Math.round(((i + 1500) / cartos.length) * 100)));
    }
    const B = makeBase(pts, baseMode, baseCustom), base = B.base;
    const bases = cells.map((c) => B.fn(c[0], c[1]) + B.h0);
    const cell = step * step; let fill = 0, cut = 0, n = 0, maxUp = -Infinity, maxDown = Infinity;
    heights.forEach((h, i) => { if (h === undefined || h === null || isNaN(h)) return; n++; const d = h - bases[i]; if (d > 0) fill += d * cell; else cut += -d * cell; maxUp = Math.max(maxUp, d); maxDown = Math.min(maxDown, d); });
    return { base, area, step, total: cells.length, valid: n, fill, cut, net: fill - cut, maxUp, maxDown, cells, heights, bases, B, frame, h0: carto(pts[0]).height, minx, miny };
  }

  // ================= 3D 복셀 체적 (공중 구조물 대응) =================
  // 로딩된 3D Tiles 의 삼각형을 직접 읽어 정육면체(복셀)로 나눈 뒤, 위쪽 공기에서 흘러들어가는 영역을 비어있음으로 판정합니다.
  // - 지면 위 간판/캐노피처럼 떠있는 구조물 아래는 '빈 공간'으로 계산되고, 건물 내부/지면 아래는 '채워진 공간'으로 계산됩니다.
  // 복셀 코어: 삼각형 메쉬(영역 로컬 좌표) -> 성토/절토 체적 (테스트 가능하도록 분리)
  async function voxelizeVolume(meshes, P, say) {
    const { minx, maxx, miny, maxy, zmin, zmax, voxelSize, area, inside, tris } = P;
    const baseFn = P.baseFn || (() => P.baseZ), baseLo = P.baseMin !== undefined ? P.baseMin : P.baseZ, baseHi = P.baseMax !== undefined ? P.baseMax : P.baseZ;
    // (4) 복셀 격자 결정
    const zlo0 = Math.min(baseLo, zmin), zhi0 = Math.max(baseHi, zmax);
    let s = voxelSize > 0 ? voxelSize : Math.min(8, Math.max(0.3, Math.cbrt((area * (zhi0 - zlo0)) / 2.5e6)));
    let nx, ny, nz, z0;
    for (let g = 0; g < 8; g++) {
      nx = Math.ceil((maxx - minx) / s) + 1; ny = Math.ceil((maxy - miny) / s) + 1;
      z0 = zlo0 - 2 * s; nz = Math.ceil((zhi0 + 2 * s - z0) / s) + 1;
      if (nx * ny * nz <= 9e6) break; s *= 1.3;
    }
    const N = nx * ny * nz, plane = nx * ny;
    const state = new Uint8Array(N);   // bit0=표면, bit1=위 공기에서 도달
    const zs = new Float32Array(N), cn = new Uint8Array(N);   // 표면 복셀 안의 실제 표면 높이(평균)

    // (5) 표면 복셀화 (삼각형을 촘촘히 샘플링해 표시)
    say('복셀화 중... (' + nx + '×' + ny + '×' + nz + ', 격자 ' + s.toFixed(2) + ' m, 삼각형 ' + tris.toLocaleString() + ')');
    const step = s * 0.4, maxx2 = maxx + s, minx2 = minx - s, maxy2 = maxy + s, miny2 = miny - s;
    for (const { v, idx } of meshes) {
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ax = v[a], ay = v[a + 1], az = v[a + 2], bx = v[b], by = v[b + 1], bz = v[b + 2], cx = v[c], cy = v[c + 1], cz = v[c + 2];
        if (Math.max(ax, bx, cx) < minx2 || Math.min(ax, bx, cx) > maxx2 || Math.max(ay, by, cy) < miny2 || Math.min(ay, by, cy) > maxy2) continue;
        const e1 = Math.hypot(bx - ax, by - ay, bz - az), e2 = Math.hypot(cx - bx, cy - by, cz - bz), e3 = Math.hypot(ax - cx, ay - cy, az - cz);
        const nn = Math.min(300, Math.max(1, Math.ceil(Math.max(e1, e2, e3) / step)));
        for (let i = 0; i <= nn; i++) for (let j = 0; j <= nn - i; j++) {
          const u = i / nn, w = j / nn, o = 1 - u - w;
          const x = ax * o + bx * u + cx * w, y = ay * o + by * u + cy * w, z = az * o + bz * u + cz * w;
          const ix = Math.floor((x - minx) / s), iy = Math.floor((y - miny) / s), iz = Math.floor((z - z0) / s);
          if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) continue;
          const id = iz * plane + iy * nx + ix; state[id] |= 1;
          if (cn[id] < 255) { cn[id]++; zs[id] += (z - zs[id]) / cn[id]; }
        }
      }
      await new Promise((r) => setTimeout(r, 0));
    }

    // (6) 위쪽 공기에서 흘러들어가는 영역 찾기 (6방향 flood fill, 위에서만 시작)
    say('공기 영역 계산 중...');
    const queue = new Int32Array(N); let qh = 0, qt = 0;
    const top = (nz - 1) * plane;
    for (let k = 0; k < plane; k++) if (!(state[top + k] & 1)) { state[top + k] |= 2; queue[qt++] = top + k; }
    while (qh < qt) {
      const id = queue[qh++]; const iz = (id / plane) | 0, rem = id - iz * plane, iy = (rem / nx) | 0, ix = rem - iy * nx;
      let n2;
      if (iz > 0) { n2 = id - plane; if (!state[n2]) { state[n2] = 2; queue[qt++] = n2; } }
      if (iz < nz - 1) { n2 = id + plane; if (!state[n2]) { state[n2] = 2; queue[qt++] = n2; } }
      if (iy > 0) { n2 = id - nx; if (!state[n2]) { state[n2] = 2; queue[qt++] = n2; } }
      if (iy < ny - 1) { n2 = id + nx; if (!state[n2]) { state[n2] = 2; queue[qt++] = n2; } }
      if (ix > 0) { n2 = id - 1; if (!state[n2]) { state[n2] = 2; queue[qt++] = n2; } }
      if (ix < nx - 1) { n2 = id + 1; if (!state[n2]) { state[n2] = 2; queue[qt++] = n2; } }
    }

    // (7) 열(column)별 분류 -> 체적 집계 (표면이 지나가는 복셀은 절반만 채워진 것으로 계산)
    say('체적 집계 중...');
    const cellV = s * s * s;
    let fill = 0, cut = 0, maxUp = -Infinity, maxDown = Infinity, colsIn = 0, colsHit = 0, fillVox = 0, cutVox = 0;
    const colCells = [], runs = [], colInfo = [];
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      if (!inside(minx + (ix + 0.5) * s, miny + (iy + 0.5) * s)) continue;
      colsIn++;
      const zb = baseFn(minx + (ix + 0.5) * s, miny + (iy + 0.5) * s), kBase = Math.round((zb - z0) / s);
      const col = iy * nx + ix; let bot = nz, topS = -1;
      for (let k = 0; k < nz; k++) if (state[k * plane + col] & 1) { if (bot === nz) bot = k; topS = k; }
      if (topS >= 0) { colsHit++; colInfo.push({ ix, iy, zb, botZ: z0 + bot * s, topZ: z0 + (topS + 1) * s }); }
      let fT = 0, cT = 0, runStart = -1, runType = 0;
      const closeRun = (k) => { if (runType) runs.push({ ix, iy, k0: runStart, k1: k, type: runType }); runType = 0; };
      const ov = (a, b, lo, hi) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));
      for (let k = 0; k < nz; k++) {
        const idx = k * plane + col, st = state[idx];
        let solid; if (st & 1) solid = true; else if (!(st & 2)) solid = true; else solid = k < bot && k < topS;
        const bottom = z0 + k * s, topZ = bottom + s;
        if (st & 1) {
          // 표면이 지나는 복셀: 표면의 실제 높이로 채워진 부분/빈 부분을 나눔
          const airA = k + 1 < nz && (state[idx + plane] & 3) === 2, airB = k > 0 && (state[idx - plane] & 3) === 2;
          let a, b;
          if (airA && !airB) { a = bottom; b = Math.min(topZ, Math.max(bottom, zs[idx])); }
          else if (airB && !airA) { b = topZ; a = Math.max(bottom, Math.min(topZ, zs[idx])); }
          else { a = bottom + 0.25 * s; b = bottom + 0.75 * s; }
          const f = ov(a, b, zb, Infinity); fillVox += f / s;
          if (f > 0 && b - zb > maxUp) maxUp = b - zb;
          if (airA && k + 1 > bot) cutVox += ov(b, topZ, -Infinity, zb) / s;
          if (airB && k - 1 > bot) cutVox += ov(bottom, a, -Infinity, zb) / s;
        } else {
          const fa = Math.max(0, Math.min(1, (topZ - zb) / s));
          if (solid) { fillVox += fa; if (fa > 0 && topZ - zb > maxUp) maxUp = topZ - zb; }
          else if (k > bot) { cutVox += 1 - fa; if (fa < 1 && bottom - zb < maxDown) maxDown = bottom - zb; }
        }
        let type = 0;   // 표시용 구분 (3D 기둥)
        if (k >= kBase) { if (solid) { type = 1; fT++; } }
        else if (!solid && k > bot) { type = 2; cT++; }
        if (type !== runType) { if (runType) closeRun(k); if (type) { runStart = k; runType = type; } }
      }
      closeRun(nz);
      if (fT || cT) colCells.push({ ix, iy, sg: fT >= cT ? 1 : -1 });
    }
    fill = fillVox * cellV; cut = cutVox * cellV;
    return { s, fill, cut, maxUp: isFinite(maxUp) ? maxUp : 0, maxDown: isFinite(maxDown) ? maxDown : 0, colsIn, colsHit, colCells, runs, colInfo, z0, nvox: N };
  }

  async function computeVolume3D(pts, baseMode, baseCustom, voxelSize, onProgress) {
    const say = (m) => onProgress && onProgress(m);
    const ts = tileset; if (!ts) throw new Error('모델이 로드되지 않았습니다.');
    const { frame, L } = toENU(pts);
    const inv = C.Matrix4.inverseTransformation(frame, new C.Matrix4());
    const poly = L.map((v) => [v.x, v.y]);
    let A2 = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; A2 += a[0] * b[1] - b[0] * a[1]; }
    const area = Math.abs(A2) / 2;
    const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const B = makeBase(pts, baseMode, baseCustom), base = B.base, h0 = B.h0;

    // (1) 영역 안의 가장 상세한 타일을 불러오도록 듬성듬성 높이를 샘플링
    say('상세 타일 불러오는 중...');
    const sp = Math.max(5, Math.sqrt(area / 500)); const pre = [];
    for (let x = minx + sp / 2; x < maxx && pre.length < 900; x += sp) for (let y = miny + sp / 2; y < maxy && pre.length < 900; y += sp) if (inside(x, y)) pre.push(carto(C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(x, y, 0), new C.Cartesian3())));
    if (pre.length) {
      // sampleHeightMostDetailed 가 응답하지 않고 멈추는 경우가 있어 20초 제한을 둠 (초과 시 지금까지 로드된 타일로 계속 진행)
      const t0s = performance.now(); let tick = setInterval(() => say('상세 타일 불러오는 중... (' + Math.round((performance.now() - t0s) / 1000) + '초)'), 1000);
      try { await Promise.race([scene.sampleHeightMostDetailed(pre), new Promise((res) => setTimeout(res, 20000))]); } catch (e) {}
      clearInterval(tick);
    }

    // (2) 영역과 겹치는 '가장 상세하게 로드된' 타일 수집
    const inter = (t) => { const bs = t.boundingSphere; const c = C.Matrix4.multiplyByPoint(inv, bs.center, new C.Cartesian3()); const dx = Math.max(minx - c.x, 0, c.x - maxx), dy = Math.max(miny - c.y, 0, c.y - maxy); return dx * dx + dy * dy <= bs.radius * bs.radius; };
    const hasModel = (t) => { try { return !!(t.contentReady && t.content && t.content._model && t.content._model.sceneGraph); } catch (e) { return false; } };
    const cover = (t) => {
      if (!inter(t)) return [];
      const kids = t.children || [];
      if (kids.length) { const subs = kids.map(cover); if (subs.every((x) => x !== null)) return subs.flat(); }
      return hasModel(t) ? [t] : null;
    };
    const tiles = cover(ts.root) || [];
    if (!tiles.length) throw new Error('영역의 타일 데이터를 찾지 못했습니다.');

    // (3) GPU 버퍼에서 삼각형 읽기 (영역 로컬 ENU 좌표로 변환)
    say('모델 삼각형 읽는 중... (타일 ' + tiles.length + '개)');
    const TA = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const meshes = []; let zmin = Infinity, zmax = -Infinity, tris = 0;
    for (const t of tiles) {
      const sg = t.content._model.sceneGraph, comps = sg.components, cmm = sg.computedModelMatrix;
      for (const node of comps.nodes) {
        const nm = node.matrix ? node.matrix : C.Matrix4.fromTranslationQuaternionRotationScale(node.translation || C.Cartesian3.ZERO, node.rotation || C.Quaternion.IDENTITY, node.scale || new C.Cartesian3(1, 1, 1), new C.Matrix4());
        const M = C.Matrix4.multiply(inv, C.Matrix4.multiply(cmm, nm, new C.Matrix4()), new C.Matrix4());
        for (const prim of node.primitives) {
          if (prim.primitiveType !== C.PrimitiveType.TRIANGLES) continue;
          const pa = prim.attributes.find((a) => a.semantic === 'POSITION'); if (!pa || !pa.buffer) continue;
          const q = pa.quantization, cd = q ? q.componentDatatype : pa.componentDatatype, Ctor = TA[cd]; if (!Ctor) continue;
          const bytes = Ctor.BYTES_PER_ELEMENT;
          const raw = new Ctor(Math.floor(pa.buffer.sizeInBytes / bytes)); pa.buffer.getBufferData(raw);
          const stride = (pa.byteStride || bytes * 3) / bytes, off = (pa.byteOffset || 0) / bytes, n = pa.count;
          const out = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            let x = raw[off + i * stride], y = raw[off + i * stride + 1], z = raw[off + i * stride + 2];
            if (q) { x = q.quantizedVolumeOffset.x + x * q.quantizedVolumeStepSize.x; y = q.quantizedVolumeOffset.y + y * q.quantizedVolumeStepSize.y; z = q.quantizedVolumeOffset.z + z * q.quantizedVolumeStepSize.z; }
            const ex = M[0] * x + M[4] * y + M[8] * z + M[12], ey = M[1] * x + M[5] * y + M[9] * z + M[13], ez = M[2] * x + M[6] * y + M[10] * z + M[14];
            out[i * 3] = ex; out[i * 3 + 1] = ey; out[i * 3 + 2] = ez;
          }
          let idx;
          if (prim.indices && prim.indices.buffer) { const IC = TA[prim.indices.indexDatatype]; idx = new IC(prim.indices.count); prim.indices.buffer.getBufferData(idx); }
          else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
          meshes.push({ v: out, idx }); tris += Math.floor(idx.length / 3);
        }
      }
    }
    // 영역과 겹치는 삼각형의 꼭짓점 높이로 z 범위 결정
    for (const { v, idx } of meshes) {
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        if (Math.max(v[a], v[b], v[c]) < minx || Math.min(v[a], v[b], v[c]) > maxx || Math.max(v[a + 1], v[b + 1], v[c + 1]) < miny || Math.min(v[a + 1], v[b + 1], v[c + 1]) > maxy) continue;
        for (const o of [a, b, c]) { const z = v[o + 2]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
      }
    }
    if (!isFinite(zmin)) throw new Error('영역 안에 모델 표면이 없습니다. (타일 ' + tiles.length + '개, 삼각형 ' + tris + '개)');

    const vr = await voxelizeVolume(meshes, { minx, maxx, miny, maxy, baseFn: B.fn, baseMin: B.min, baseMax: B.max, zmin, zmax, voxelSize, area, inside, tris }, say);
    return { method: 'voxel', B, base, area, step: vr.s, total: vr.colsIn, valid: vr.colsHit, fill: vr.fill, cut: vr.cut, net: vr.fill - vr.cut, maxUp: vr.maxUp, maxDown: vr.maxDown, colCells: vr.colCells, runs: vr.runs, colInfo: vr.colInfo, frame, h0, minx, miny, z0: vr.z0, nvox: vr.nvox, tris, tiles: tiles.length };
  }
  // 3D 복셀 계산이 불가능할 때 쓰는 대체(수직 높이 샘플) 결과를 같은 형식으로 변환
  function fromHeightfield(r) {
    const colCells = [], runs = [], colInfo = [];
    r.cells.forEach((c, i) => {
      const h = r.heights[i]; if (h === undefined || h === null || isNaN(h)) return;
      const bz = r.bases ? r.bases[i] : r.base; const d = h - bz; const sg = d > 0.05 ? 1 : d < -0.05 ? -1 : 0; if (!sg) return;
      const ix = Math.round((c[0] - r.minx - r.step / 2) / r.step), iy = Math.round((c[1] - r.miny - r.step / 2) / r.step);
      colCells.push({ ix, iy, sg });
      colInfo.push({ ix, iy, zb: bz - r.h0, botZ: h - r.h0, topZ: h - r.h0 });
      runs.push({ ix, iy, z0: Math.min(h, bz) - r.h0, z1: Math.max(h, bz) - r.h0, type: sg > 0 ? 1 : 2, abs: true });
    });
    return Object.assign({}, r, { method: 'height', colCells, runs, colInfo });
  }

  // ================= 측정 기능 =================
  const measure = (function () {
    let colsVisible = false;
    let panel = null, mode = null, pts = [], hover = null, live = [], dyn = [];
    const items = [];            // { html, ents, kind, pts, name, metrics }
    let lastMode = null, lastPts = [], mseq = 0; const kcount = {};
    const KN = { distance: '거리', height: '높이', area: '면적', volume: '체적' };
    let handler = null, onKey = null, resEl = null, hintEl = null;
    const HINTS = {
      distance: '모델 위를 좌클릭해 점을 찍으세요. 우클릭/Enter로 완료, Esc로 취소.',
      height: '두 점을 차례로 클릭하세요. 두 번째 클릭에서 자동 완료됩니다.',
      area: '3개 이상 점을 찍으세요. 우클릭/Enter로 완료, Esc로 취소.',
      volume: '체적을 구할 영역의 경계를 3점 이상 찍으세요. 우클릭/Enter로 완료. 영역을 정육면체로 잘라, 공중에 떠있는 구조물 아래는 빈 공간으로 계산합니다.',
    };
    function renderResults() {
      emitChange();
      if (!resEl) return;
      resEl.innerHTML = items.map((it, i) => `<div class="sis-res"><button class="x" data-i="${i}" title="삭제">✕</button>${it.html}</div>`).join('') || '<div class="sis-lbl">측정 결과가 여기에 표시됩니다.</div>';
      resEl.querySelectorAll('.x').forEach((b) => (b.onclick = () => { const it = items[+b.dataset.i]; it.ents.forEach((e) => rm(e)); items.splice(+b.dataset.i, 1); renderResults(); }));
    }
    function cancel() { [...live, ...dyn].forEach((e) => rm(e)); live = []; dyn = []; pts = []; hover = null; }
    function setMode(m) {
      cancel(); mode = m;
      if (panel) { panel.querySelectorAll('.sis-btn[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m)); }
      if (hintEl) hintEl.textContent = m ? HINTS[m] : '도구를 선택하세요.';
      if (panel) panel.querySelector('#sis-volopt').style.display = m === 'volume' ? 'block' : 'none'; panel.querySelector('#sis-colswrap').style.display = m === 'volume' ? 'block' : 'none';
      scene.canvas.style.cursor = m ? 'crosshair' : '';
    }
    function startDynamic() {
      if (mode === 'distance') dyn.push(viewer.entities.add({ polyline: { positions: new C.CallbackProperty(() => (hover ? [...pts, hover] : [...pts]), false), width: 3, arcType: C.ArcType.NONE, material: COL.distance, depthFailMaterial: COL.distance } }));
      if (mode === 'area' || mode === 'volume') dyn.push(viewer.entities.add({ polyline: { positions: new C.CallbackProperty(() => { const a = hover ? [...pts, hover] : [...pts]; return a.length > 2 ? [...a, a[0]] : a; }, false), width: 3, arcType: C.ArcType.NONE, material: COL[mode], depthFailMaterial: COL[mode] } }));
    }
    function onClick(e) {
      if (!mode) return;
      const p = pick(e.position); if (!p) return;
      pts.push(p); live.push(addPoint(p, COL[mode]));
      if (pts.length === 1) startDynamic();
      if (mode === 'distance' && pts.length > 1) { const a = pts[pts.length - 2]; live.push(addLabel(C.Cartesian3.midpoint(a, p, new C.Cartesian3()), fmtLen(C.Cartesian3.distance(a, p)))); }
      if (mode === 'height' && pts.length === 2) finish();
    }
    function onMove(e) { if (!mode || !pts.length) return; const p = pick(e.endPosition); if (p) hover = p; }
    function record(html, ents, metrics) { kcount[lastMode] = (kcount[lastMode] || 0) + 1; const it = { html, ents, kind: lastMode, pts: lastPts, name: (KN[lastMode] || '측정') + ' ' + kcount[lastMode], metrics, id: ++mseq }; items.unshift(it); renderResults(); return it; }

    function finish() {
      if (!mode) return;
      hover = null;
      const m = mode; let ents = [...live]; lastMode = m; lastPts = pts.slice();
      dyn.forEach((e) => rm(e)); dyn = [];
      if (m === 'distance' && pts.length >= 2) {
        let d3 = 0, dh = 0;
        for (let i = 1; i < pts.length; i++) { d3 += C.Cartesian3.distance(pts[i - 1], pts[i]); dh += horizDist(pts[i - 1], pts[i]); }
        ents.push(addLine(pts.slice(), COL.distance), addLabel(pts[pts.length - 1], '총 ' + fmtLen(d3), -34));
        record(`<b style="color:${HEX.distance}">거리</b> (${pts.length}점)<br>3D 거리: <b>${fmtLen(d3)}</b><br>수평 거리: ${fmtLen(dh)}`, ents, { length: d3 });
      } else if (m === 'height' && pts.length === 2) {
        const [a, b] = pts; const hi = carto(a).height >= carto(b).height ? a : b, lo = hi === a ? b : a;
        const chi = carto(hi), clo = carto(lo);
        const corner = C.Cartesian3.fromRadians(chi.longitude, chi.latitude, clo.height);
        const dz = chi.height - clo.height, dh = horizDist(a, b), ds = C.Cartesian3.distance(a, b);
        ents.push(addLine([lo, corner], C.Color.fromCssColorString('#40c4ff'), true), addLine([corner, hi], C.Color.fromCssColorString('#ff5252')), addLine([lo, hi], COL.height),
          addLabel(C.Cartesian3.midpoint(corner, hi, new C.Cartesian3()), '높이차 ' + fmtLen(dz), -6),
          addLabel(C.Cartesian3.midpoint(lo, corner, new C.Cartesian3()), '수평 ' + fmtLen(dh), -6));
        record(`<b style="color:${HEX.height}">높이</b><br>높이차: <b>${fmtLen(dz)}</b><br>수평 거리: ${fmtLen(dh)}<br>경사 거리: ${fmtLen(ds)}<br>상단 고도 ${chi.height.toFixed(2)} m / 하단 고도 ${clo.height.toFixed(2)} m`, ents);
      } else if (m === 'area' && pts.length >= 3) {
        const ar = areaOf(pts);
        const cen = C.Cartesian3.divideByScalar(pts.reduce((s, p) => C.Cartesian3.add(s, p, new C.Cartesian3()), new C.Cartesian3()), pts.length, new C.Cartesian3());
        ents.push(addLine([...pts, pts[0]], COL.area), ...ar.tri.map(([a, b, c]) => viewer.entities.add({ polygon: { hierarchy: new C.PolygonHierarchy([pts[a], pts[b], pts[c]]), perPositionHeight: true, material: COL.area.withAlpha(0.45) } })), addLabel(cen, '2D 수평 ' + fmtArea(ar.projected) + '\n3D 표면 ' + fmtArea(ar.surface), -6));
        record(`<b style="color:${HEX.area}">면적</b> (${pts.length}점)<br>수평 면적(2D 환산): <b>${fmtArea(ar.projected)}</b><br>표면 면적(점을 이은 3D 면): <b>${fmtArea(ar.surface)}</b><br><span class="sis-lbl">경사 비율 ×${(ar.surface / Math.max(1e-9, ar.projected)).toFixed(3)}</span>`, ents, { area: ar.projected });
      } else if (m === 'volume' && pts.length >= 3) {
        const P = pts.slice();
        const baseMode = panel.querySelector('#sis-base').value, custom = parseFloat(panel.querySelector('#sis-basev').value), vsz = parseFloat(panel.querySelector('#sis-vox').value);
        ents.push(addLine([...P, P[0]], COL.volume));
        const T = '<b style="color:' + HEX.volume + '">체적</b> (' + P.length + '점)';
        const it = record(T + '<br>준비 중...', ents); it.pts = P;
        (async () => {
          let r, note = '3D 복셀 방식';
          try { r = await computeVolume3D(P, baseMode, custom, vsz, (m) => { it.html = T + '<br>' + m; renderResults(); }); }
          catch (err) {
            console.warn('3D 복셀 계산 실패, 수직 높이 방식으로 대체:', err);
            note = '수직 높이 방식(대체: ' + (err.message || err) + ')';
            it.html = T + '<br>수직 높이 샘플링 중...'; renderResults();
            r = fromHeightfield(await computeVolume(P, baseMode, custom, (pc) => { it.html = T + '<br>수직 높이 샘플링 중... ' + pc + '%'; renderResults(); }));
          }
          const cen = C.Cartesian3.divideByScalar(P.reduce((s, p) => C.Cartesian3.add(s, p, new C.Cartesian3()), new C.Cartesian3()), P.length, new C.Cartesian3());
          const cc = carto(cen);
          const surf = r.B && r.B.mode === 'surface';
          const baseRing = surf ? P.slice() : P.map((p) => { const c = carto(p); return C.Cartesian3.fromRadians(c.longitude, c.latitude, r.base); });
          if (surf) {
            // 경계점을 이은 기준면: 삼각형 면(반투명) + 빨간 윤곽선
            const triInst = r.B.tri.map(([a, b, c]) => new C.GeometryInstance({
              geometry: new C.PolygonGeometry({ polygonHierarchy: new C.PolygonHierarchy([P[a], P[b], P[c]]), perPositionHeight: true, vertexFormat: C.PerInstanceColorAppearance.VERTEX_FORMAT }),
              attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString('#ff6b6b').withAlpha(0.4)) },
            }));
            const bs = scene.primitives.add(new C.Primitive({ geometryInstances: triInst, appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true, closed: false }), asynchronous: false }));
            it.ents.push({ __prim: bs });
            it.ents.push(addLine([...P, P[0]], C.Color.fromCssColorString('#ff5252')));
            r.B.tri.forEach(([a, b]) => it.ents.push(addLine([P[a], P[b]], C.Color.fromCssColorString('#ff5252'))));
          } else {
            // 수평 기준면(반투명) + 윤곽선 + 경계 수직선
            it.ents.push(viewer.entities.add({ polygon: { hierarchy: new C.PolygonHierarchy(baseRing), perPositionHeight: true, material: C.Color.WHITE.withAlpha(0.12) } }));
            it.ents.push(addLine([...baseRing, baseRing[0]], C.Color.WHITE));
            P.forEach((p, i) => it.ents.push(addLine([baseRing[i], p], COL.volume)));
          }
          // 3D 기둥/큐브: 기준 위 채워진 곳=주황, 기준 아래 파인 곳=하늘색 (공중 구조물 아래는 비어 있음)
          const up = C.Color.fromCssColorString('#ff9800').withAlpha(0.5), dn = C.Color.fromCssColorString('#40c4ff').withAlpha(0.5);
          const insts = [];
          r.runs.slice(0, 80000).forEach((u) => {
            let zA, zB;
            if (u.abs) { zA = u.z0; zB = u.z1; } else { zA = r.z0 + u.k0 * r.step - r.h0 + 0; zB = r.z0 + u.k1 * r.step - r.h0 + 0; }
            if (!u.abs) { zA = r.z0 + u.k0 * r.step; zB = r.z0 + u.k1 * r.step; }
            if (zB - zA < 0.02) return;
            const cx = r.minx + (u.ix + 0.5) * r.step, cy = r.miny + (u.iy + 0.5) * r.step;
            insts.push(new C.GeometryInstance({
              geometry: C.BoxGeometry.fromDimensions({ dimensions: new C.Cartesian3(r.step * 0.98, r.step * 0.98, zB - zA), vertexFormat: C.PerInstanceColorAppearance.VERTEX_FORMAT }),
              modelMatrix: C.Matrix4.multiply(r.frame, C.Matrix4.fromTranslation(new C.Cartesian3(cx, cy, (zA + zB) / 2), new C.Matrix4()), new C.Matrix4()),
              attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(u.type === 1 ? up : dn) },
            }));
          });
          if (insts.length) {
            const prim = scene.primitives.add(new C.Primitive({ geometryInstances: insts, appearance: new C.PerInstanceColorAppearance({ translucent: true, closed: true }), asynchronous: false, show: colsVisible }));
            it.ents.push({ __prim: prim }); it.cols = prim;
          }
          // 모델 표면 색칠: 기준면보다 위에 있는 표면=주황, 아래에 있는 표면=하늘색
          // (열 전체를 한 색으로 덮으면 벽면이 잘못 칠해지므로, 기준면 위/아래 높이 구간만 분류하는 볼륨을 사용)
          const fillUp = C.Color.fromCssColorString('#ff9800').withAlpha(0.5), fillDn = C.Color.fromCssColorString('#40c4ff').withAlpha(0.5);
          const w = (x, y) => C.Matrix4.multiplyByPoint(r.frame, new C.Cartesian3(x, y, 0), new C.Cartesian3());
          const bf = Math.max(1, Math.ceil(Math.sqrt((r.colInfo || []).length / 10000)));
          const blocks = new Map();
          (r.colInfo || []).forEach((c) => {
            const key = Math.floor(c.ix / bf) + ',' + Math.floor(c.iy / bf); let b = blocks.get(key);
            if (!b) { b = { x0: c.ix, x1: c.ix, y0: c.iy, y1: c.iy, zb: 0, n: 0, bot: Infinity, top: -Infinity }; blocks.set(key, b); }
            b.x0 = Math.min(b.x0, c.ix); b.x1 = Math.max(b.x1, c.ix); b.y0 = Math.min(b.y0, c.iy); b.y1 = Math.max(b.y1, c.iy);
            b.zb += c.zb; b.n++; b.bot = Math.min(b.bot, c.botZ); b.top = Math.max(b.top, c.topZ);
          });
          const clsUp = [], clsDn = [], PAD = 0.3;
          blocks.forEach((b) => {
            const zb = b.zb / b.n;
            const x0 = r.minx + b.x0 * r.step, x1 = r.minx + (b.x1 + 1) * r.step, y0 = r.miny + b.y0 * r.step, y1 = r.miny + (b.y1 + 1) * r.step;
            const hier = new C.PolygonHierarchy([w(x0, y0), w(x1, y0), w(x1, y1), w(x0, y1)]);
            const mk = (lo, hi, col) => new C.GeometryInstance({ geometry: new C.PolygonGeometry({ polygonHierarchy: hier, height: r.h0 + lo, extrudedHeight: r.h0 + hi }), attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(col) } });
            if (b.top - zb > 0.02) clsUp.push(mk(zb, b.top + PAD, fillUp));       // 기준면 위 표면
            if (zb - b.bot > 0.02) clsDn.push(mk(b.bot - PAD, zb, fillDn));       // 기준면 아래 표면
          });
          // ClassificationPrimitive 는 한 번에 한 가지 색만 허용하므로 색별로 따로 생성
          [clsUp, clsDn].forEach((arr) => {
            if (!arr.length) return;
            const cp = scene.primitives.add(new C.ClassificationPrimitive({ geometryInstances: arr, classificationType: C.ClassificationType.BOTH, appearance: new C.PerInstanceColorAppearance({ flat: true, translucent: true }), asynchronous: true }));
            it.ents.push({ __prim: cp });
          });
          const topP = C.Cartesian3.fromRadians(cc.longitude, cc.latitude, r.base + Math.max(0, r.maxUp));
          it.ents.push(addLabel(topP, '체적 ' + fmtVol(r.fill) + ' (기준 위)', -6));
          const cov = ((r.valid / Math.max(1, r.total)) * 100).toFixed(0);
          it.html = T + '<br>' + (surf ? '기준: <b>경계점 기준 면</b> (경계점 고도 ' + r.B.hMin.toFixed(2) + ' ~ ' + r.B.hMax.toFixed(2) + ' m)' : '기준 높이(수평면): ' + r.base.toFixed(2) + ' m') + '<br>수평 면적: ' + fmtArea(r.area) +
            '<br><span style="color:#ff9800">■</span> 기준 위 체적(성토): <b>' + fmtVol(r.fill) + '</b>' +
            '<br><span style="color:#40c4ff">■</span> 기준 아래 체적(절토): <b>' + fmtVol(r.cut) + '</b>' +
            '<br>순체적(위-아래): ' + fmtVol(r.net) +
            '<br><span class="sis-lbl">' + note + ' · 큐브 ' + r.step.toFixed(2) + ' m' + (r.nvox ? ' (' + r.nvox.toLocaleString() + '칸, 타일 ' + r.tiles + '개)' : '') +
            '<br>최대 +' + r.maxUp.toFixed(2) + ' m / ' + r.maxDown.toFixed(2) + ' m, 모델이 있는 열 ' + r.valid + '/' + r.total + ' (' + cov + '%)</span>';
          it.result = r; it.metrics = { fill: r.fill, cut: r.cut }; renderResults();
        })().catch((e) => { it.html = T + ' 계산 실패: ' + (e.message || e); renderResults(); });
      } else { cancel(); return; }
      live = []; pts = [];
    }

    function bind() {
      handler = new C.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction(onClick, C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction(onMove, C.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction(() => finish(), C.ScreenSpaceEventType.RIGHT_CLICK);
      onKey = (ev) => { if (/INPUT|SELECT|TEXTAREA/.test((ev.target || {}).tagName || '')) return; if (ev.key === 'Enter') finish(); if (ev.key === 'Escape') { if (pts.length) cancel(); else setMode(null); } };
      window.addEventListener('keydown', onKey);
    }
    function unbind() { if (handler) { handler.destroy(); handler = null; } if (onKey) window.removeEventListener('keydown', onKey); }

    return {
      id: 'measure', icon: '📏', title: '측정',
      mount(el) {
        panel = el;
        el.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
            <button class="sis-btn" data-mode="distance" style="border-left:5px solid #ffd54f">📐 거리</button>
            <button class="sis-btn" data-mode="height" style="border-left:5px solid #e040fb">↕ 높이</button>
            <button class="sis-btn" data-mode="area" style="border-left:5px solid #69f0ae">⬠ 면적</button>
            <button class="sis-btn" data-mode="volume" style="border-left:5px solid #ff9800">🧊 체적</button>
          </div>
          <div id="sis-volopt" style="display:none;margin-top:10px;padding:8px;border:1px solid #2c3050;border-radius:8px">
            <div class="sis-lbl">체적 기준 (경계점 기준 높이: 찍은 점들의 실제 높이를 이어 만든 면)</div>
            <select id="sis-base" class="sis-in" style="margin:4px 0">
              <option value="surface">경계점 기준 높이 (경계점을 이은 면)</option>
              <option value="mean">수평면 · 경계점 평균 높이</option><option value="min">수평면 · 경계점 최저 높이</option>
              <option value="max">수평면 · 경계점 최고 높이</option><option value="custom">수평면 · 직접 입력 (m)</option>
            </select>
            <input id="sis-basev" class="sis-in" type="number" step="0.1" placeholder="직접 입력 시 높이(m)" value="0">
            <div class="sis-lbl" style="margin-top:8px">복셀(정육면체) 크기 (m, 비우면 자동)</div>
            <input id="sis-vox" class="sis-in" type="number" step="0.1" min="0.1" placeholder="자동" style="margin-top:4px">
          </div>
          <label id="sis-colswrap" style="display:none;margin-top:8px;font-size:12px;color:#9aa;cursor:pointer"><input id="sis-cols" type="checkbox" style="vertical-align:middle"> 3D 기둥도 함께 표시</label>
          <button id="sis-clear" class="sis-btn" style="width:100%;margin-top:8px">전체 지우기</button>
          <div id="sis-hint" style="margin:10px 0;color:#9fb0ff;font-size:12px;min-height:32px">도구를 선택하세요.</div>
          <div id="sis-results"></div>`;
        const cw = el.querySelector('#sis-cols'); cw.checked = colsVisible; cw.onchange = () => { colsVisible = cw.checked; items.forEach((it) => { if (it.cols) it.cols.show = colsVisible; }); };
        hintEl = el.querySelector('#sis-hint'); resEl = el.querySelector('#sis-results');
        el.querySelectorAll('.sis-btn[data-mode]').forEach((b) => (b.onclick = () => setMode(mode === b.dataset.mode ? null : b.dataset.mode)));
        el.querySelector('#sis-clear').onclick = () => { cancel(); items.forEach((it) => it.ents.forEach((e) => rm(e))); items.length = 0; renderResults(); };
        bind(); renderResults(); if (mode) setMode(mode);
      },
      unmount() { cancel(); mode = null; scene.canvas.style.cursor = ''; unbind(); panel = null; },
      items, setMode, finish, get pts() { return pts; },
      source() {
        return { id: 'measure', name: '측정', items: () => items.map((it) => ({
          key: 'measure:' + it.id, name: it.name, kind: KN[it.kind] || '측정', pts: it.pts || [], closed: it.kind === 'area' || it.kind === 'volume',
          ents: (it.ents || []).filter((e) => e && !e.__prim), visible: !it.hidden, props: () => it.html, metrics: () => it.metrics || {},
          remove: () => { it.ents.forEach((e) => rm(e)); const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); renderResults(); },
          setVisible: (v) => { it.hidden = !v; (it.ents || []).forEach((e) => { if (e.__prim) e.__prim.show = v && (e.__prim !== it.cols ? true : colsVisible); else e.show = v; }); },
        })) };
      },
      // 테스트/자동화용: 월드 좌표 배열로 직접 측정
      feed(m, cart3s) { setMode(m); cart3s.forEach((p) => { pts.push(p); live.push(addPoint(p, COL[m])); if (pts.length === 1) startDynamic(); }); finish(); },
    };
  })();

  // ================= 그리기 =================
  // 점 / 폴리라인 / 폴리곤 / 사각형 / 원 / 화살표 / 문자 + 편집(꼭짓점 드래그) + 스타일 + 목록 + GeoJSON 내보내기·가져오기 + 자동 저장
  const draw = (() => {
    const TOOLS = [
      { id: 'point', ic: '📍', name: '점', hint: '클릭한 위치에 점을 찍습니다. 계속 클릭하면 여러 개 찍을 수 있어요.' },
      { id: 'polyline', ic: '〰', name: '폴리라인', hint: '점을 차례로 클릭하세요. 우클릭/Enter로 완료, Backspace로 마지막 점 취소, Esc로 취소.' },
      { id: 'polygon', ic: '⬠', name: '폴리곤', hint: '꼭짓점을 차례로 클릭하세요 (3점 이상). 우클릭/Enter로 완료, Backspace로 마지막 점 취소, Esc로 취소.' },
      { id: 'rect', ic: '▭', name: '사각형', hint: '대각선 두 모서리를 클릭하세요. (동서·남북 방향 직사각형)' },
      { id: 'circle', ic: '◯', name: '원', hint: '중심을 클릭한 뒤, 원의 가장자리를 클릭하세요.' },
      { id: 'arrow', ic: '➜', name: '화살표', hint: '시작점과 끝점(화살표 머리)을 클릭하세요.' },
      { id: 'text', ic: '🔤', name: '문자', hint: '아래 "문구"를 입력하고, 글자를 놓을 위치를 클릭하세요.' },
      { id: 'move', ic: '✥', name: '이동', hint: '옮길 도형 위에서 마우스를 누른 채 끌면 도형 전체가 이동합니다. (도형 위가 아닌 곳을 끌면 화면이 움직여요)' },
      { id: 'edit', ic: '✋', name: '꼭짓점 편집', hint: '도형을 클릭해 선택하면 흰 점(꼭짓점)이 나타납니다. 점을 끌어서 옮기세요. Delete로 선택 도형 삭제.' },
    ];
    const NAMES = { point: '점', polyline: '폴리라인', polygon: '폴리곤', rect: '사각형', circle: '원', arrow: '화살표', text: '문자' };
    const NEED = { polyline: 2, polygon: 3, rect: 2, circle: 2, arrow: 2 };
    const PALETTE = ['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff', '#e040fb', '#ff9800', '#ffffff', '#111111'];
    const style = { color: '#ff5252', width: 3, alpha: 0.35, labels: true, drape: false };
    const objs = []; const counters = {}; let seq = 0;
    let panel = null, tool = null, handler = null, onKey = null, listEl = null, hintEl = null, projId = '';
    let draft = null, selected = null, handles = [], drag = null, mv = null, raf = 0;
    const deg = (r) => C.Math.toDegrees(r);
    // ---------- 계산 ----------
    const len3 = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += C.Cartesian3.distance(p[i - 1], p[i]); return s; };
    function circleR(o) { const { L } = toENU([o.pts[0], o.pts[1]]); return Math.hypot(L[1].x, L[1].y); }
    function ringOf(o) {
      if (o.type !== 'circle') return o.pts;
      const { frame } = toENU([o.pts[0], o.pts[1]]), r = circleR(o), out = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * 2 * Math.PI; out.push(C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(r * Math.cos(a), r * Math.sin(a), 0), new C.Cartesian3())); }
      return out;
    }
    function rectCorners(a, b) {
      const { frame, L } = toENU([a, b]), x1 = L[1].x, y1 = L[1].y, zb = L[1].z, zm = zb / 2;
      return [[0, 0, 0], [x1, 0, zm], [x1, y1, zb], [0, y1, zm]].map((v) => C.Matrix4.multiplyByPoint(frame, new C.Cartesian3(v[0], v[1], v[2]), new C.Cartesian3()));
    }
    function info(o) {
      const p = o.pts, t = o.type;
      if (t === 'point') { const c = carto(p[0]); return { html: '경도 ' + deg(c.longitude).toFixed(6) + ', 위도 ' + deg(c.latitude).toFixed(6) + ' · 고도 ' + c.height.toFixed(2) + ' m', label: '' }; }
      if ((t === 'polyline' || t === 'arrow') && p.length >= 2) { const l = len3(p); return { html: '길이(3D) <b>' + fmtLen(l) + '</b> · 점 ' + p.length + '개', label: fmtLen(l) }; }
      if (t === 'circle' && p.length >= 2) { const r = circleR(o); return { html: '반지름 <b>' + fmtLen(r) + '</b> · 둘레 ' + fmtLen(2 * Math.PI * r) + ' · 면적 ' + fmtArea(Math.PI * r * r), label: '반지름 ' + fmtLen(r) + '\n' + fmtArea(Math.PI * r * r) }; }
      if ((t === 'polygon' || t === 'rect') && p.length >= 3) { const a = areaOf(p); return { html: '면적(2D 수평) <b>' + fmtArea(a.projected) + '</b><br>면적(3D 표면) ' + fmtArea(a.surface) + ' · 둘레 ' + fmtLen(len3([...p, p[0]])), label: fmtArea(a.projected) }; }
      return { html: '', label: '' };
    }
    const centroid = (pts) => C.Cartesian3.divideByScalar(pts.reduce((s, q) => C.Cartesian3.add(s, q, new C.Cartesian3()), new C.Cartesian3()), pts.length, new C.Cartesian3());

    // ---------- 그리기(엔티티 생성) ----------
    function clearEnts(o) { (o.ents || []).forEach((e) => viewer.entities.remove(e)); o.ents = []; }
    function build(o) {
      clearEnts(o);
      const p = o.pts, t = o.type; if (!p.length) return;
      const col = C.Color.fromCssColorString(o.style.color), w = o.style.width, show = o.visible !== false;
      const add = (def) => { def.show = show; const e = viewer.entities.add(def); e.__draw = o; o.ents.push(e); return e; };
      const line = (pos, dashed) => add({ polyline: { positions: pos, width: w, arcType: C.ArcType.NONE, material: dashed ? new C.PolylineDashMaterialProperty({ color: col }) : col, depthFailMaterial: col } });
      const fill = (ring) => {
        if (o.style.alpha <= 0 || ring.length < 3) return;
        const fc = col.withAlpha(o.style.alpha);
        if (o.style.drape) add({ polygon: { hierarchy: new C.PolygonHierarchy(ring.slice()), material: fc, classificationType: C.ClassificationType.BOTH } });
        else { const { L } = toENU(ring); triangulate(L.map((v) => [v.x, v.y])).forEach(([a, b, c]) => add({ polygon: { hierarchy: new C.PolygonHierarchy([ring[a], ring[b], ring[c]]), perPositionHeight: true, material: fc } })); }
      };
      const lab = () => {};   // 길이/면적 값은 지도에 표시하지 않고 왼쪽 속성 목록에만 표시
      if (t === 'point') {
        add({ position: p[0], point: { pixelSize: 8 + w * 2, color: col, outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
      } else if (t === 'text') {
        add({ position: p[0], label: { text: o.text || o.name, font: 'bold ' + (13 + w * 2) + 'px "Noto Sans KR",sans-serif', fillColor: col, outlineColor: C.Color.BLACK, outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: C.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
      } else if (t === 'polyline' && p.length >= 2) {
        line(p); lab(p[Math.floor(p.length / 2)], info(o).label);
      } else if (t === 'arrow' && p.length >= 2) {
        add({ polyline: { positions: p, width: Math.max(12, w * 4), arcType: C.ArcType.NONE, material: new C.PolylineArrowMaterialProperty(col), depthFailMaterial: new C.PolylineArrowMaterialProperty(col) } });
        lab(centroid(p), info(o).label);
      } else if (t === 'polygon' || t === 'rect' || t === 'circle') {
        const ring = ringOf(o);
        if (ring.length >= 3) { line([...ring, ring[0]]); fill(ring); lab(t === 'circle' ? p[0] : centroid(ring), info(o).label, -6); }
        else if (ring.length === 2) line(ring);
      }
    }

    // ---------- 저장 / 불러오기 ----------
    const cd = (q) => { const c = carto(q); return [deg(c.longitude), deg(c.latitude), +c.height.toFixed(3)]; };
    const fromCd = (a) => { let h = a[2]; if (h == null || !isFinite(h)) { let sh; try { sh = scene.sampleHeight(C.Cartographic.fromDegrees(a[0], a[1])); } catch (e) {} h = sh != null ? sh : 0; } return C.Cartesian3.fromDegrees(a[0], a[1], h); };
    const serial = (o) => ({ type: o.type, name: o.name, text: o.text, style: o.style, visible: o.visible !== false, pts: o.pts.map(cd) });
    const KEY = () => 'sisDraw:' + projId;
    function save() { try { localStorage.setItem(KEY(), JSON.stringify(objs.map(serial))); } catch (e) {} emitChange(); }
    function addObj(d) {
      const o = { id: ++seq, type: d.type, name: d.name, text: d.text, style: Object.assign({}, style, d.style || {}), visible: d.visible !== false, pts: d.pts, ents: [] };
      objs.push(o); build(o); return o;
    }
    function loadStored() {
      try { const arr = JSON.parse(localStorage.getItem(KEY()) || '[]'); arr.forEach((d) => { if (NAMES[d.type] && d.pts && d.pts.length) addObj({ ...d, pts: d.pts.map(fromCd) }); }); } catch (e) {}
    }
    function clearAll(keepStorage) { cancelDraft(); select(null); objs.forEach(clearEnts); objs.length = 0; if (!keepStorage) save(); renderList(); }
    function toGeoJSON() {
      return { type: 'FeatureCollection', features: objs.map((o) => {
        let g;
        if (o.type === 'point' || o.type === 'text') g = { type: 'Point', coordinates: cd(o.pts[0]) };
        else if (o.type === 'polyline' || o.type === 'arrow') g = { type: 'LineString', coordinates: o.pts.map(cd) };
        else { const r = ringOf(o).map(cd); r.push(r[0]); g = { type: 'Polygon', coordinates: [r] }; }
        return { type: 'Feature', properties: { sisType: o.type, name: o.name, text: o.text, style: o.style, sisPts: o.pts.map(cd) }, geometry: g };
      }) };
    }
    function importGeoJSON(txt) {
      const gj = JSON.parse(txt); const fs = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [{ type: 'Feature', properties: {}, geometry: gj }];
      let n = 0;
      fs.forEach((f) => {
        const pr = f.properties || {}, g = f.geometry; if (!g) return;
        let type = pr.sisType, pts;
        if (type && pr.sisPts) pts = pr.sisPts.map(fromCd);
        else if (g.type === 'Point') { type = 'point'; pts = [fromCd(g.coordinates)]; }
        else if (g.type === 'LineString') { type = 'polyline'; pts = g.coordinates.map(fromCd); }
        else if (g.type === 'Polygon') { type = 'polygon'; const r = g.coordinates[0].slice(); if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop(); pts = r.map(fromCd); }
        if (!type || !pts) return;
        counters[type] = (counters[type] || 0) + 1;
        addObj({ type, name: pr.name || NAMES[type] + ' ' + counters[type], text: pr.text, style: pr.style, pts }); n++;
      });
      save(); renderList(); return n;
    }

    // ---------- 그리는 중(초안) ----------
    function startDraft(type) { draft = { type, pts: [], hover: null, pins: [], o: { type, pts: [], style: Object.assign({}, style), ents: [], visible: true, name: '' } }; }
    function shapeOf(pts) { return draft.type === 'rect' && pts.length >= 2 ? rectCorners(pts[0], pts[1]) : pts; }
    function refreshDraft() {
      if (!draft) return;
      const pts = draft.hover ? [...draft.pts, draft.hover] : draft.pts.slice();
      draft.o.style = Object.assign({}, style); draft.o.pts = shapeOf(pts);
      build(draft.o); setLive(info(draft.o).html);
    }
    function setLive(h) { const lv = panel && panel.querySelector('#dr-live'); if (lv) lv.innerHTML = h || ''; }
    function cancelDraft() { setLive(''); if (!draft) return; clearEnts(draft.o); draft.pins.forEach((e) => viewer.entities.remove(e)); draft = null; }
    function finish() {
      if (!draft) return; const t = draft.type, pts = draft.pts.slice();
      if (pts.length < NEED[t]) { toast('점이 부족합니다 (최소 ' + NEED[t] + '개)'); return; }
      cancelDraft();
      const final = t === 'rect' ? rectCorners(pts[0], pts[1]) : pts;
      commit(t, final);
    }
    function commit(type, pts, text) {
      counters[type] = (counters[type] || 0) + 1;
      const o = addObj({ type, name: text || NAMES[type] + ' ' + counters[type], text, pts });
      save(); renderList(); return o;
    }

    // ---------- 편집 ----------
    function clearHandles() { handles.forEach((h) => viewer.entities.remove(h)); handles = []; }
    function showHandles(o) {
      clearHandles();
      o.pts.forEach((q, i) => {
        const h = viewer.entities.add({ position: q, point: { pixelSize: 13, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString(o.style.color), outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
        h.__vertex = { o, i }; handles.push(h);
      });
    }
    function select(o) { selected = o; if (o) showHandles(o); else clearHandles(); renderList(); }
    function removeObj(o) { clearEnts(o); const i = objs.indexOf(o); if (i >= 0) objs.splice(i, 1); if (selected === o) select(null); save(); renderList(); }

    // ---------- 입력 ----------
    const setHint = (t) => { if (hintEl) hintEl.textContent = t; };
    function setTool(t) {
      cancelDraft(); if (t !== 'edit') clearHandles(); if (t !== 'edit' && t !== 'move') select(null);
      tool = t;
      if (panel) panel.querySelectorAll('.sis-btn[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
      scene.canvas.style.cursor = t ? (t === 'edit' ? 'default' : t === 'move' ? 'move' : 'crosshair') : '';
      const td = TOOLS.find((x) => x.id === t); setHint(td ? td.hint : '도구를 선택하세요.');
      if (panel) { const tw = panel.querySelector('#dr-textwrap'); if (tw) tw.style.display = t === 'text' ? 'block' : 'none'; }
    }
    function onClick(e) {
      if (tool === 'move') return;
      if (tool === 'edit') {
        const hits = scene.drillPick(e.position, 8, 9, 9).filter((h) => h && h.id);
        if (hits.some((h) => h.id.__vertex)) return;
        const hd = hits.find((h) => h.id.__draw && h.id.__draw.ents.indexOf(h.id) >= 0);
        if (hd) select(hd.id.__draw); else select(null);
        return;
      }
      if (!tool) return;
      const p = pick(e.position); if (!p) return;
      if (tool === 'point') { commit('point', [p]); return; }
      if (tool === 'text') {
        const txt = (panel && panel.querySelector('#dr-text').value || '').trim();
        if (!txt) { toast('먼저 "문구"를 입력하세요.'); return; }
        commit('text', [p], txt); return;
      }
      if (!draft) startDraft(tool);
      draft.pts.push(p);
      draft.pins.push(viewer.entities.add({ position: p, point: { pixelSize: 7, color: C.Color.fromCssColorString(style.color), outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }));
      draft.hover = null;
      if ((tool === 'rect' || tool === 'circle' || tool === 'arrow') && draft.pts.length === 2) { finish(); return; }
      refreshDraft();
    }
    function onMove(e) {
      if (drag || !draft) return;
      draft.hover = pick(e.endPosition);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; refreshDraft(); });
    }
    // ----- 도형 끌기(이동 / 꼭짓점 편집): 카메라가 같이 움직이지 않도록 지도(Cesium)보다 먼저 포인터 이벤트를 가로채서 처리 -----
    let rootEl = null, sup = false;
    const canvasPos = (ev) => { const r = scene.canvas.getBoundingClientRect(); return new C.Cartesian2(ev.clientX - r.left, ev.clientY - r.top); };
    function planeHit(pos, p0) {
      const ray = viewer.camera.getPickRay(pos); if (!ray) return null;
      const n = scene.globe.ellipsoid.geodeticSurfaceNormal(p0, new C.Cartesian3());
      return C.IntersectionTests.rayPlane(ray, C.Plane.fromPointNormal(p0, n));
    }
    // 도형 자신은 잠시 숨기고 그 아래 모델 표면 위치를 조회 (자기 자신이 가려 위치가 흔들리는 것을 방지)
    function pickClean(o, pos) {
      const hide = o.ents.concat(handles), prev = hide.map((x) => x.show);
      hide.forEach((x) => (x.show = false)); viewer.render();
      let p; try { p = pick(pos); } catch (err) {}
      hide.forEach((x, i) => (x.show = prev[i])); return p;
    }
    function applyDrag(o, st, target) {
      if (st.kind === 'move') { const d = C.Cartesian3.subtract(target, st.p0, new C.Cartesian3()); o.pts = st.orig.map((q) => C.Cartesian3.add(q, d, new C.Cartesian3())); }
      else if (o.type === 'circle' && st.i === 0) { const d = C.Cartesian3.subtract(target, st.orig[0], new C.Cartesian3()); o.pts = [target, C.Cartesian3.add(st.orig[1], d, new C.Cartesian3())]; }
      else { o.pts = st.orig.slice(); o.pts[st.i] = target; }
    }
    function nDown(ev) {
      if (ev.button !== 0 || (tool !== 'move' && tool !== 'edit') || ev.target !== scene.canvas) return;
      const pos = canvasPos(ev); let st = null;
      if (tool === 'edit') {
        const hv = scene.drillPick(pos, 8, 9, 9).find((h) => h && h.id && h.id.__vertex);
        if (hv) { const v = hv.id.__vertex; st = { kind: 'vertex', o: v.o, i: v.i, h: hv.id, p0: C.Cartesian3.clone(v.o.pts[v.i]), orig: v.o.pts.map((q) => C.Cartesian3.clone(q)) }; }
      } else {
        const hm = scene.drillPick(pos, 10, 11, 11).find((h) => h && h.id && h.id.__draw && !h.id.__vertex && h.id.__draw.ents.indexOf(h.id) >= 0 && h.id.__draw.visible !== false);
        if (hm) { const p0 = pick(pos); const o = hm.id.__draw; if (p0) st = { kind: 'move', o, p0, orig: o.pts.map((q) => C.Cartesian3.clone(q)) }; }
      }
      if (!st) return;
      ev.stopPropagation(); ev.preventDefault();
      drag = st; if (st.h) st.h.show = false;
      if (st.kind === 'move' && selected !== st.o) { selected = st.o; renderList(); }
      window.addEventListener('pointermove', nMove, true); window.addEventListener('pointerup', nUp, true);
    }
    function nMove(ev) {
      if (!drag) return; ev.stopPropagation();
      const hit = planeHit(canvasPos(ev), drag.p0); if (!hit) return;
      applyDrag(drag.o, drag, hit);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (drag) build(drag.o); });
    }
    function nUp(ev) {
      window.removeEventListener('pointermove', nMove, true); window.removeEventListener('pointerup', nUp, true);
      if (!drag) return; ev.stopPropagation();
      const st = drag; drag = null; const o = st.o; sup = true; setTimeout(() => (sup = false), 80);
      const mp = pickClean(o, canvasPos(ev));    // 놓은 위치의 모델 표면에 맞춤
      if (mp) applyDrag(o, st, mp);
      build(o); if (selected === o && tool === 'edit') showHandles(o); save(); renderList();
    }
    function bind() {
      handler = new C.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((e) => { if (!sup) onClick(e); }, C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction(onMove, C.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction(() => finish(), C.ScreenSpaceEventType.RIGHT_CLICK);
      rootEl = root; rootEl.addEventListener('pointerdown', nDown, true);
      onKey = (ev) => {
        if (/INPUT|SELECT|TEXTAREA/.test((ev.target || {}).tagName || '')) return;
        if (ev.key === 'Enter') finish();
        else if (ev.key === 'Escape') { if (draft) cancelDraft(); else if (selected) select(null); else setTool(null); }
        else if (ev.key === 'Backspace' || (ev.ctrlKey && ev.key.toLowerCase() === 'z')) undo();
        else if (ev.key === 'Delete' && selected) removeObj(selected);
      };
      window.addEventListener('keydown', onKey);
    }
    function unbind() {
      if (handler) { handler.destroy(); handler = null; }
      if (onKey) window.removeEventListener('keydown', onKey); onKey = null;
      if (rootEl) { rootEl.removeEventListener('pointerdown', nDown, true); rootEl = null; }
      window.removeEventListener('pointermove', nMove, true); window.removeEventListener('pointerup', nUp, true);
    }
    function undo() {
      if (draft && draft.pts.length) { draft.pts.pop(); const pin = draft.pins.pop(); if (pin) viewer.entities.remove(pin); draft.hover = null; if (draft.pts.length) refreshDraft(); else cancelDraft(); }
      else if (!draft && objs.length) { const o = objs[objs.length - 1]; removeObj(o); toast('마지막 도형을 지웠습니다: ' + o.name); }
    }

    // ---------- 목록 ----------
    function renderList() {
      if (!listEl) return; listEl.innerHTML = ''; const cnt = panel && panel.querySelector('#dr-cnt'); if (cnt) cnt.textContent = objs.length;
const all = panel && panel.querySelector('#dr-all'); if (all) { all.checked = objs.length > 0 && objs.every((x) => x.visible !== false); all.onchange = () => { objs.forEach((x) => { x.visible = all.checked; x.ents.forEach((e) => (e.show = all.checked)); }); handles.forEach((h) => (h.show = all.checked)); save(); renderList(); }; }
      if (!objs.length) { listEl.innerHTML = '<div class="sis-lbl" style="padding:8px 0">그린 도형이 여기에 표시됩니다.</div>'; return; }
      objs.forEach((o) => {
        const d = document.createElement('div'); d.className = 'sis-res';
        if (o === selected) d.style.borderLeft = '3px solid #fff';
        d.innerHTML = '<div style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="vis" title="지도에 표시/숨기기" style="width:16px;height:16px;cursor:pointer;flex:none"><input type="color" class="c" style="width:26px;height:26px;padding:0;border:0;background:none;cursor:pointer;flex:none"><input class="sis-in n" style="flex:1;min-width:0"></div>' +
          '<div style="display:flex;gap:4px;margin-top:5px"><button class="sis-btn z" title="이 도형으로 화면 이동" style="flex:1;padding:3px 2px;font-size:12px">🔍 보기</button><button class="sis-btn m" title="도형 전체를 끌어서 이동" style="flex:1;padding:3px 2px;font-size:12px">✥ 이동</button><button class="sis-btn e" title="꼭짓점 편집" style="flex:1;padding:3px 2px;font-size:12px">✋ 편집</button><button class="sis-btn r" title="삭제" style="flex:1;padding:3px 2px;font-size:12px">✕ 삭제</button></div><div class="sis-lbl inf" style="margin-top:5px"></div>';
        const q = (s) => d.querySelector(s);
        q('.c').value = o.style.color; q('.n').value = o.name; q('.inf').innerHTML = info(o).html || '<span style="opacity:.6">(속성 없음)</span>';
        q('.vis').checked = o.visible !== false; d.style.opacity = o.visible === false ? 0.55 : 1;
        q('.vis').onchange = (ev) => { o.visible = ev.target.checked; o.ents.forEach((x) => (x.show = o.visible)); if (selected === o) handles.forEach((h) => (h.show = o.visible)); save(); renderList(); };
        q('.c').oninput = (ev) => { o.style.color = ev.target.value; build(o); if (selected === o && tool === 'edit') showHandles(o); save(); };
        q('.n').onchange = (ev) => { o.name = ev.target.value; if (o.type === 'text' && !o.text) build(o); save(); };
        q('.z').onclick = () => { const bs = C.BoundingSphere.fromPoints(ringOf(o)); viewer.camera.flyToBoundingSphere(bs, { duration: 0.8, offset: new C.HeadingPitchRange(viewer.camera.heading, C.Math.toRadians(-45), Math.max(bs.radius * 3, 60)) }); };
        q('.m').onclick = () => { if (o.visible === false) { o.visible = true; o.ents.forEach((x) => (x.show = true)); } setTool('move'); selected = o; renderList(); setHint('"' + o.name + '" 위에서 마우스를 누른 채 끌면 이동합니다.'); };
        q('.e').onclick = () => { setTool('edit'); select(o); };
        q('.r').onclick = () => removeObj(o);
        listEl.appendChild(d);
      });
    }

    return {
      id: 'draw', icon: '✏️', title: '그리기',
      mount(el) {
        panel = el;
        el.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
            ${TOOLS.map((t) => `<button class="sis-btn" data-tool="${t.id}">${t.ic} ${t.name}</button>`).join('')}
          </div>
          <div id="dr-textwrap" style="display:none;margin-top:8px"><div class="sis-lbl">문구</div><input id="dr-text" class="sis-in" placeholder="지도에 표시할 글자" style="margin-top:4px"></div>
          <div style="margin-top:10px;padding:8px;border:1px solid #2c3050;border-radius:8px">
            <div class="sis-lbl">색상</div>
            <div id="dr-pal" style="display:flex;gap:5px;margin:4px 0 8px;flex-wrap:wrap;align-items:center"></div>
            <div style="display:flex;gap:8px"><div style="flex:1"><div class="sis-lbl">선 굵기</div><input id="dr-w" class="sis-in" type="number" min="1" max="12" step="1" style="margin-top:4px"></div>
            <div style="flex:1"><div class="sis-lbl">채움 투명도 <span id="dr-av"></span></div><input id="dr-a" type="range" min="0" max="100" step="5" style="width:100%;margin-top:8px"></div></div>
            <label style="display:block;margin-top:4px;font-size:12px;color:#9aa;cursor:pointer"><input id="dr-drape" type="checkbox" style="vertical-align:middle"> 모델 표면에 투영해 칠하기 (위쪽 건물까지 칠해질 수 있음)</label>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px">
            <button id="dr-undo" class="sis-btn">↶ 되돌리기</button><button id="dr-done" class="sis-btn">✔ 완료</button>
            <button id="dr-exp" class="sis-btn">⬇ 내보내기</button><button id="dr-imp" class="sis-btn">⬆ 가져오기</button>
          </div>
          <input id="dr-file" type="file" accept=".geojson,.json,application/json" style="display:none">
          <button id="dr-clear" class="sis-btn" style="width:100%;margin-top:6px">전체 지우기</button>
          <div id="dr-hint" style="margin:10px 0 4px;color:#9fb0ff;font-size:12px;min-height:32px">도구를 선택하세요.</div>
          <div id="dr-live" class="sis-lbl" style="min-height:18px;margin-bottom:6px;color:#e8eaf6"></div>
          <div style="display:flex;justify-content:space-between;align-items:center"><div class="sis-lbl">그린 도형 · 속성 (<span id="dr-cnt">0</span>)</div>
            <label class="sis-lbl" style="cursor:pointer"><input id="dr-all" type="checkbox" style="vertical-align:middle"> 전체 표시</label></div>
          <div id="dr-list"></div>`;
        hintEl = el.querySelector('#dr-hint'); listEl = el.querySelector('#dr-list');
        const q = (s) => el.querySelector(s);
        // 팔레트
        const pal = q('#dr-pal');
        const applyStyle = () => { if (selected) { Object.assign(selected.style, style); build(selected); showHandles(selected); save(); renderList(); } if (draft) refreshDraft(); };
        const drawPal = () => {
          pal.innerHTML = '';
          PALETTE.forEach((c) => { const b = document.createElement('button'); b.style.cssText = 'width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid ' + (style.color === c ? '#fff' : '#343b66') + ';background:' + c; b.onclick = () => { style.color = c; ci.value = c; drawPal(); applyStyle(); }; pal.appendChild(b); });
          pal.appendChild(ci);
        };
        const ci = document.createElement('input'); ci.type = 'color'; ci.title = '직접 고르기'; ci.value = style.color; ci.style.cssText = 'width:26px;height:26px;padding:0;border:0;background:none;cursor:pointer';
        ci.oninput = () => { style.color = ci.value; drawPal(); applyStyle(); };
        drawPal();
        q('#dr-w').value = style.width; q('#dr-w').oninput = (ev) => { style.width = Math.max(1, Math.min(12, +ev.target.value || 3)); applyStyle(); };
        q('#dr-a').value = Math.round(style.alpha * 100); q('#dr-av').textContent = Math.round(style.alpha * 100) + '%';
        q('#dr-a').oninput = (ev) => { style.alpha = +ev.target.value / 100; q('#dr-av').textContent = ev.target.value + '%'; applyStyle(); };
        q('#dr-drape').checked = style.drape; q('#dr-drape').onchange = (ev) => { style.drape = ev.target.checked; applyStyle(); };
        el.querySelectorAll('.sis-btn[data-tool]').forEach((b) => (b.onclick = () => setTool(tool === b.dataset.tool ? null : b.dataset.tool)));
        q('#dr-undo').onclick = undo; q('#dr-done').onclick = finish;
        q('#dr-clear').onclick = () => { if (!objs.length) return; clearAll(); toast('모두 지웠습니다.'); };
        q('#dr-exp').onclick = () => {
          if (!objs.length) { toast('내보낼 도형이 없습니다.'); return; }
          const blob = new Blob([JSON.stringify(toGeoJSON(), null, 1)], { type: 'application/geo+json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sistech-drawings-' + (projId || 'project') + '.geojson'; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('GeoJSON 파일로 내보냈습니다.');
        };
        q('#dr-imp').onclick = () => q('#dr-file').click();
        q('#dr-file').onchange = async (ev) => {
          const f = ev.target.files[0]; if (!f) return;
          try { const n = importGeoJSON(await f.text()); toast(n + '개 도형을 가져왔습니다.'); } catch (e) { toast('가져오기 실패: 올바른 GeoJSON 파일이 아닙니다.'); }
          ev.target.value = '';
        };
        bind(); renderList(); setTool(tool);
      },
      unmount() { cancelDraft(); clearHandles(); selected = null; tool = null; scene.canvas.style.cursor = ''; unbind(); drag = null; panel = null; listEl = null; hintEl = null; },
      onProjectChange(id) { clearAll(true); projId = id; loadStored(); renderList(); },
      objs, commit, finish, setTool, select, importGeoJSON, toGeoJSON, info, get draft() { return draft; },
      source() {
        const mt = (o) => { try { if (o.type === 'polyline' || o.type === 'arrow') return { length: len3(o.pts) }; if (o.type === 'polygon' || o.type === 'rect') return { area: areaOf(o.pts).projected }; if (o.type === 'circle') { const r = circleR(o); return { area: Math.PI * r * r }; } } catch (e) {} return {}; };
        return { id: 'draw', name: '그리기', items: () => objs.map((o) => ({
          key: 'draw:' + o.id, name: o.name, kind: NAMES[o.type], pts: o.pts.length ? (o.type === 'circle' ? ringOf(o) : o.pts) : [], closed: o.type === 'polygon' || o.type === 'rect' || o.type === 'circle',
          ents: o.ents, visible: o.visible !== false, props: () => info(o).html, metrics: () => mt(o), remove: () => removeObj(o),
          setVisible: (v) => { o.visible = v; o.ents.forEach((e) => (e.show = v)); save(); renderList(); },
        })) };
      },
      // 테스트/자동화용: 월드 좌표 배열로 직접 추가
      feed(type, cart3s, text) { return commit(type, type === 'rect' ? rectCorners(cart3s[0], cart3s[1]) : cart3s, text); },
    };
  })();

  // ================= 선택 =================
  // 클릭 선택(도형/측정 결과/클릭 지점 정보) + 영역(폴리곤/사각형) 선택 + 선택 항목 속성·합계·일괄 처리
  // 새 데이터 종류를 붙이려면: SisMenu.registerSource({ id, name, items: () => [ { key, name, kind, pts:[Cartesian3...], closed, ents:[Entity...],
  //   visible, props: () => 'HTML', metrics: () => ({length,area,fill,cut}), remove(), setVisible(v) } ] })
  const select = (() => {
    const extra = [];
    const sources = () => [draw.source(), measure.source(), ...(typeof camo !== 'undefined' ? [camo.source()] : []), ...extra];
    const CY = C.Color.fromCssColorString('#00e5ff');
    const sel = new Set();
    let panel = null, mode = 'click', handler = null, onKey = null, hintEl = null, resEl = null, ptEl = null;
    let hl = [], region = null, ad = null, pointMark = null, lastPoint = null, raf = 0, delArm = false;
    const opt = { rule: 'touch', add: false, off: {} };
    const HINT = {
      click: '도형·측정 결과를 클릭하면 선택됩니다. 빈 모델 위를 클릭하면 그 지점의 좌표가 나옵니다. Shift/Ctrl+클릭으로 여러 개를 추가·해제할 수 있어요.',
      poly: '영역의 꼭짓점을 차례로 클릭하세요 (3점 이상). 우클릭/Enter로 완료, Backspace로 마지막 점 취소, Esc로 취소. 그 안의 도형·분석 결과가 모두 선택됩니다.',
      rect: '대각선 두 모서리를 클릭하세요. (동서·남북 방향 직사각형) 그 안의 도형·분석 결과가 모두 선택됩니다.',
    };

    // ---------- 항목 모으기 ----------
    function allItems() {
      const out = [];
      sources().forEach((s) => { let list = []; try { list = s.items(); } catch (e) {} list.forEach((it) => { it.srcId = s.id; it.srcName = s.name; out.push(it); }); });
      return out;
    }
    function current() {
      const all = allItems(), keys = new Set(all.map((x) => x.key));
      [...sel].forEach((k) => { if (!keys.has(k)) sel.delete(k); });
      return all.filter((x) => sel.has(x.key));
    }

    // ---------- 강조 표시 ----------
    function clearHl() { hl.forEach((e) => viewer.entities.remove(e)); hl = []; }
    function drawHl(items) {
      clearHl();
      items.forEach((it) => {
        const p = it.pts; if (!p || !p.length) return;
        const add = (d) => { const e = viewer.entities.add(d); e.__sel = true; hl.push(e); };
        if (p.length === 1) { add({ position: p[0], point: { pixelSize: 22, color: CY.withAlpha(0.25), outlineColor: CY, outlineWidth: 4, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); return; }
        const mat = new C.PolylineGlowMaterialProperty({ color: CY, glowPower: 0.35 });
        add({ polyline: { positions: it.closed ? [...p, p[0]] : p, width: 8, arcType: C.ArcType.NONE, material: mat, depthFailMaterial: mat } });
        if (p.length <= 30) p.forEach((q) => add({ position: q, point: { pixelSize: 9, color: C.Color.WHITE, outlineColor: CY, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY } }));
      });
    }

    // ---------- 영역 판정 ----------
    const pip = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const segX = (a, b, c, d) => { const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b); return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0); };
    function hitsRegion(it, poly, inv, rule) {
      const P = it.pts.map((q) => { const l = C.Matrix4.multiplyByPoint(inv, q, new C.Cartesian3()); return [l.x, l.y]; });
      const ins = P.map((q) => pip(poly, q[0], q[1]));
      if (rule === 'contain') return ins.every(Boolean);
      if (ins.some(Boolean)) return true;
      const segs = []; for (let i = 0; i < P.length - 1; i++) segs.push([P[i], P[i + 1]]);
      if (it.closed && P.length > 2) segs.push([P[P.length - 1], P[0]]);
      for (const [a, b] of segs) for (let j = 0; j < poly.length; j++) if (segX(a, b, poly[j], poly[(j + 1) % poly.length])) return true;
      if (it.closed && P.length >= 3 && pip(P, poly[0][0], poly[0][1])) return true;   // 영역이 도형 안에 완전히 들어간 경우
      return false;
    }
    function rectPts(a, b) {
      const fr = C.Transforms.eastNorthUpToFixedFrame(a), inv = C.Matrix4.inverseTransformation(fr, new C.Matrix4());
      const l = C.Matrix4.multiplyByPoint(inv, b, new C.Cartesian3());
      return [[0, 0, 0], [l.x, 0, l.z / 2], [l.x, l.y, l.z], [0, l.y, l.z / 2]].map((v) => C.Matrix4.multiplyByPoint(fr, new C.Cartesian3(v[0], v[1], v[2]), new C.Cartesian3()));
    }

    // ---------- 영역 그리기 ----------
    function clearAreaDraft() { if (!ad) return; ad.ents.forEach((e) => viewer.entities.remove(e)); ad.pins.forEach((e) => viewer.entities.remove(e)); ad = null; }
    function clearRegion() { if (!region) return; region.ents.forEach((e) => viewer.entities.remove(e)); region = null; }
    function dashed(pos, w) { const e = viewer.entities.add({ polyline: { positions: pos, width: w || 3, arcType: C.ArcType.NONE, material: new C.PolylineDashMaterialProperty({ color: CY, dashLength: 14 }), depthFailMaterial: new C.PolylineDashMaterialProperty({ color: CY, dashLength: 14 }) } }); e.__sel = true; return e; }
    function refreshArea() {
      if (!ad) return;
      ad.ents.forEach((e) => viewer.entities.remove(e)); ad.ents = [];
      const pts = ad.hover ? [...ad.pts, ad.hover] : ad.pts.slice();
      const shape = mode === 'rect' ? (pts.length >= 2 ? rectPts(pts[0], pts[1]) : pts) : pts;
      if (shape.length >= 2) ad.ents.push(dashed(shape.length >= 3 ? [...shape, shape[0]] : shape));
    }
    function areaClick(e) {
      const p = pick(e.position); if (!p) return;
      if (!ad) ad = { pts: [], pins: [], hover: null, ents: [] };
      ad.pts.push(p);
      const pin = viewer.entities.add({ position: p, point: { pixelSize: 8, color: CY, outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); pin.__sel = true; ad.pins.push(pin);
      ad.hover = null;
      if (mode === 'rect' && ad.pts.length === 2) { finishArea(); return; }
      refreshArea();
    }
    function finishArea() {
      if (!ad) return;
      const base = mode === 'rect' ? (ad.pts.length >= 2 ? rectPts(ad.pts[0], ad.pts[1]) : null) : (ad.pts.length >= 3 ? ad.pts.slice() : null);
      if (!base) { toast('영역이 부족합니다 (폴리곤은 3점 이상)'); return; }
      clearAreaDraft(); clearRegion();
      region = { pts: base, ents: [dashed([...base, base[0]], 4)] };
      applyRegion();
    }
    function applyRegion() {
      if (!region) return;
      const fr = C.Transforms.eastNorthUpToFixedFrame(region.pts[0]), inv = C.Matrix4.inverseTransformation(fr, new C.Matrix4());
      const poly = region.pts.map((q) => { const l = C.Matrix4.multiplyByPoint(inv, q, new C.Cartesian3()); return [l.x, l.y]; });
      const hits = allItems().filter((it) => !opt.off[it.srcId] && it.visible !== false && it.pts && it.pts.length && hitsRegion(it, poly, inv, opt.rule));
      if (!opt.add) sel.clear();
      hits.forEach((it) => sel.add(it.key));
      clearPoint(); refresh();
      toast(hits.length + '개를 선택했습니다.');
    }

    // ---------- 클릭 선택 ----------
    function pickItem(pos) {
      const map = new Map(); allItems().forEach((it) => (it.ents || []).forEach((en) => map.set(en, it)));
      const hits = scene.drillPick(pos, 12, 9, 9);
      for (const h of hits) { if (h && h.id && !h.id.__sel && map.has(h.id)) { const it = map.get(h.id); if (it.visible !== false) return it; } }
      return null;
    }
    function clearPoint() { if (pointMark) { viewer.entities.remove(pointMark); pointMark = null; } lastPoint = null; }
    function setPoint(p) {
      clearPoint(); lastPoint = p;
      pointMark = viewer.entities.add({ position: p, point: { pixelSize: 14, color: CY.withAlpha(0.35), outlineColor: CY, outlineWidth: 4, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); pointMark.__sel = true;
    }
    function onClick(e, toggle) {
      if (mode !== 'click') { areaClick(e); return; }
      const it = pickItem(e.position); clearRegion();
      if (it) {
        clearPoint();
        if (toggle) { if (sel.has(it.key)) sel.delete(it.key); else sel.add(it.key); } else { sel.clear(); sel.add(it.key); }
        refresh(); return;
      }
      const p = pick(e.position);
      if (!toggle) sel.clear();
      if (p) setPoint(p); else clearPoint();
      refresh();
    }

    // ---------- 화면 갱신 ----------
    const dms = (d) => { const a = Math.abs(d), g = Math.floor(a), m = Math.floor((a - g) * 60), s = ((a - g) * 60 - m) * 60; return g + '° ' + m + '′ ' + s.toFixed(2) + '″'; };
    function renderPoint() {
      if (!ptEl) return;
      if (!lastPoint) { ptEl.innerHTML = ''; return; }
      const c = carto(lastPoint), lon = C.Math.toDegrees(c.longitude), lat = C.Math.toDegrees(c.latitude);
      ptEl.innerHTML = '<div class="sis-res"><b style="color:#00e5ff">선택한 지점</b><br>경도 <b>' + lon.toFixed(7) + '</b> (' + dms(lon) + (lon >= 0 ? ' E' : ' W') + ')<br>위도 <b>' + lat.toFixed(7) + '</b> (' + dms(lat) + (lat >= 0 ? ' N' : ' S') + ')<br>고도(타원체) <b>' + c.height.toFixed(2) + ' m</b>' +
        '<div style="display:flex;gap:4px;margin-top:6px"><button class="sis-btn" id="sl-copy" style="flex:1;padding:4px;font-size:12px">좌표 복사</button><button class="sis-btn" id="sl-addpt" style="flex:1;padding:4px;font-size:12px">이 위치에 점 그리기</button></div></div>';
      ptEl.querySelector('#sl-copy').onclick = () => { const t = lat.toFixed(7) + ', ' + lon.toFixed(7) + ', ' + c.height.toFixed(2); try { navigator.clipboard.writeText(t); toast('복사했습니다: ' + t); } catch (e) { toast(t); } };
      ptEl.querySelector('#sl-addpt').onclick = () => { draw.commit('point', [lastPoint]); toast('"그리기"에 점을 추가했습니다.'); };
    }
    function totals(items) {
      const t = { length: 0, area: 0, fill: 0, cut: 0 }; let any = {};
      items.forEach((it) => { let m = {}; try { m = (it.metrics && it.metrics()) || {}; } catch (e) {} Object.keys(t).forEach((k) => { if (m[k] != null) { t[k] += m[k]; any[k] = 1; } }); });
      const out = [];
      if (any.length) out.push('길이 합계 <b>' + fmtLen(t.length) + '</b>');
      if (any.area) out.push('면적 합계 <b>' + fmtArea(t.area) + '</b>');
      if (any.fill) out.push('성토 합계 <b>' + fmtVol(t.fill) + '</b>');
      if (any.cut) out.push('절토 합계 <b>' + fmtVol(t.cut) + '</b>');
      return out;
    }
    function flyToItems(items) {
      const ps = []; items.forEach((it) => (it.pts || []).forEach((q) => ps.push(q))); if (!ps.length) return;
      const bs = C.BoundingSphere.fromPoints(ps);
      viewer.camera.flyToBoundingSphere(bs, { duration: 0.8, offset: new C.HeadingPitchRange(viewer.camera.heading, C.Math.toRadians(-45), Math.max(bs.radius * 3, 80)) });
    }
    function renderSrc() {
      if (!panel) return; const box = panel.querySelector('#sl-src'); if (!box) return;
      box.innerHTML = '';
      sources().forEach((s) => {
        const l = document.createElement('label'); l.style.cssText = 'display:inline-block;margin-right:10px;font-size:12px;color:#c5cae9;cursor:pointer';
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !opt.off[s.id]; c.style.verticalAlign = 'middle'; c.onchange = () => { opt.off[s.id] = !c.checked; };
        l.appendChild(c); l.appendChild(document.createTextNode(' ' + s.name)); box.appendChild(l);
      });
    }
    function renderResults() {
      renderPoint();
      if (!resEl) return;
      const items = current();
      if (!items.length) { resEl.innerHTML = '<div class="sis-lbl" style="padding:8px 0">선택된 항목이 없습니다.</div>'; return; }
      resEl.innerHTML = '';
      const head = document.createElement('div'); head.className = 'sis-res';
      const tt = totals(items);
      head.innerHTML = '<b style="color:#00e5ff">선택됨 ' + items.length + '개</b>' + (tt.length ? '<div style="margin-top:3px">' + tt.join('<br>') + '</div>' : '') +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-top:6px"><button class="sis-btn b-fly" style="padding:4px;font-size:12px">🔍 선택 보기</button><button class="sis-btn b-clr" style="padding:4px;font-size:12px">선택 해제</button>' +
        '<button class="sis-btn b-hide" style="padding:4px;font-size:12px">숨기기</button><button class="sis-btn b-show" style="padding:4px;font-size:12px">표시</button></div>' +
        '<button class="sis-btn b-del" style="width:100%;margin-top:4px;padding:4px;font-size:12px' + (delArm ? ';background:#b71c1c;border-color:#ff5252' : '') + '">' + (delArm ? '정말 삭제할까요? 한 번 더 누르세요' : '✕ 선택 항목 삭제') + '</button>';
      resEl.appendChild(head);
      head.querySelector('.b-fly').onclick = () => flyToItems(items);
      head.querySelector('.b-clr').onclick = () => { sel.clear(); clearRegion(); refresh(); };
      head.querySelector('.b-hide').onclick = () => { items.forEach((it) => it.setVisible && it.setVisible(false)); refresh(); };
      head.querySelector('.b-show').onclick = () => { items.forEach((it) => it.setVisible && it.setVisible(true)); refresh(); };
      head.querySelector('.b-del').onclick = () => {
        if (!delArm) { delArm = true; renderResults(); setTimeout(() => { if (delArm) { delArm = false; renderResults(); } }, 3000); return; }
        delArm = false; const n = items.length; items.forEach((it) => it.remove && it.remove()); sel.clear(); refresh(); toast(n + '개를 삭제했습니다.');
      };
      items.forEach((it) => {
        const d = document.createElement('div'); d.className = 'sis-res';
        d.innerHTML = '<div style="display:flex;justify-content:space-between;gap:6px"><b>' + it.name + '</b><span class="sis-lbl">' + (it.srcName || '') + ' · ' + (it.kind || '') + '</span></div><div class="sis-lbl" style="margin-top:3px;color:#e8eaf6"></div>' +
          '<div style="display:flex;gap:4px;margin-top:5px"><button class="sis-btn z" style="flex:1;padding:3px;font-size:12px">🔍 보기</button><button class="sis-btn u" style="flex:1;padding:3px;font-size:12px">선택 해제</button></div>';
        d.children[1].innerHTML = (it.props && it.props()) || '<span style="opacity:.6">(속성 없음)</span>';
        d.querySelector('.z').onclick = () => flyToItems([it]);
        d.querySelector('.u').onclick = () => { sel.delete(it.key); refresh(); };
        resEl.appendChild(d);
      });
    }
    function refresh() { const items = current(); drawHl(items); renderSrc(); renderResults(); }

    // ---------- 모드 / 입력 ----------
    function setMode(m) {
      clearAreaDraft(); mode = m;
      if (panel) panel.querySelectorAll('.sis-btn[data-sm]').forEach((b) => b.classList.toggle('on', b.dataset.sm === m));
      if (hintEl) hintEl.textContent = HINT[m];
      scene.canvas.style.cursor = m === 'click' ? '' : 'crosshair';
    }
    function bind() {
      handler = new C.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((e) => onClick(e, false), C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction((e) => onClick(e, true), C.ScreenSpaceEventType.LEFT_CLICK, C.KeyboardEventModifier.SHIFT);
      handler.setInputAction((e) => onClick(e, true), C.ScreenSpaceEventType.LEFT_CLICK, C.KeyboardEventModifier.CTRL);
      handler.setInputAction((e) => { if (mode === 'click' || !ad) return; ad.hover = pick(e.endPosition); if (!raf) raf = requestAnimationFrame(() => { raf = 0; refreshArea(); }); }, C.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction(() => { if (mode !== 'click') finishArea(); }, C.ScreenSpaceEventType.RIGHT_CLICK);
      onKey = (ev) => {
        if (/INPUT|SELECT|TEXTAREA/.test((ev.target || {}).tagName || '')) return;
        if (ev.key === 'Enter') { if (mode !== 'click') finishArea(); }
        else if (ev.key === 'Escape') { if (ad) clearAreaDraft(); else if (sel.size || region) { sel.clear(); clearRegion(); refresh(); } else clearPoint(), refresh(); }
        else if (ev.key === 'Backspace' && ad && ad.pts.length) { ad.pts.pop(); const pin = ad.pins.pop(); if (pin) viewer.entities.remove(pin); ad.hover = null; if (ad.pts.length) refreshArea(); else clearAreaDraft(); }
      };
      window.addEventListener('keydown', onKey);
    }
    function unbind() { if (handler) { handler.destroy(); handler = null; } if (onKey) window.removeEventListener('keydown', onKey); onKey = null; }

    changeCbs.push(() => { if (sel.size || panel) refresh(); });

    return {
      id: 'select', icon: '👆', title: '선택',
      mount(el) {
        panel = el;
        el.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            <button class="sis-btn" data-sm="click" style="padding:8px 2px">👆 클릭</button>
            <button class="sis-btn" data-sm="poly" style="padding:8px 2px">⬠ 영역</button>
            <button class="sis-btn" data-sm="rect" style="padding:8px 2px">▭ 사각형</button>
          </div>
          <div style="margin-top:10px;padding:8px;border:1px solid #2c3050;border-radius:8px">
            <div class="sis-lbl">영역 선택 규칙</div>
            <label style="display:block;margin:4px 0 2px;font-size:12px;color:#c5cae9;cursor:pointer"><input type="radio" name="sl-rule" value="touch" style="vertical-align:middle"> 영역에 걸치기만 해도 선택</label>
            <label style="display:block;margin:2px 0;font-size:12px;color:#c5cae9;cursor:pointer"><input type="radio" name="sl-rule" value="contain" style="vertical-align:middle"> 영역 안에 완전히 들어온 것만 선택</label>
            <label style="display:block;margin:6px 0 2px;font-size:12px;color:#c5cae9;cursor:pointer"><input id="sl-add" type="checkbox" style="vertical-align:middle"> 기존 선택에 추가</label>
            <div class="sis-lbl" style="margin-top:6px">선택 대상</div><div id="sl-src" style="margin-top:2px"></div>
          </div>
          <div id="sl-hint" style="margin:10px 0;color:#9fb0ff;font-size:12px;min-height:32px"></div>
          <div id="sl-pt"></div>
          <div id="sl-res"></div>`;
        hintEl = el.querySelector('#sl-hint'); resEl = el.querySelector('#sl-res'); ptEl = el.querySelector('#sl-pt');
        el.querySelectorAll('input[name="sl-rule"]').forEach((r) => { r.checked = r.value === opt.rule; r.onchange = () => { opt.rule = r.value; if (region) applyRegion(); }; });
        el.querySelector('#sl-add').checked = opt.add; el.querySelector('#sl-add').onchange = (ev) => { opt.add = ev.target.checked; };
        el.querySelectorAll('.sis-btn[data-sm]').forEach((b) => (b.onclick = () => setMode(b.dataset.sm)));
        bind(); setMode(mode); refresh();
      },
      unmount() { clearAreaDraft(); unbind(); scene.canvas.style.cursor = ''; panel = null; hintEl = resEl = ptEl = null; },
      onProjectChange() { sel.clear(); clearAreaDraft(); clearRegion(); clearPoint(); refresh(); },
      registerSource(src) { extra.push(src); if (panel) renderSrc(); },
      select(keys) { sel.clear(); keys.forEach((k) => sel.add(k)); refresh(); }, clear() { sel.clear(); clearRegion(); clearPoint(); refresh(); },
      items: current, allItems, applyArea(pts, rule) { clearRegion(); region = { pts, ents: [dashed([...pts, pts[0]], 4)] }; if (rule) opt.rule = rule; applyRegion(); },
      regionPts() {
        if (region) return region.pts.slice();
        const ps = []; current().forEach((it) => (it.pts || []).forEach((q) => ps.push(q)));
        if (ps.length < 3) return null;
        const c = ps.reduce((a, q) => C.Cartesian3.add(a, q, new C.Cartesian3()), new C.Cartesian3()); C.Cartesian3.multiplyByScalar(c, 1 / ps.length, c);
        const fr = C.Transforms.eastNorthUpToFixedFrame(c), inv = C.Matrix4.inverseTransformation(fr, new C.Matrix4());
        const L = ps.map((q, i) => { const l = C.Matrix4.multiplyByPoint(inv, q, new C.Cartesian3()); return { x: l.x, y: l.y, i }; }).sort((a, b) => a.x - b.x || a.y - b.y);
        const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); const lo = [], up = [];
        L.forEach((p) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
        for (let k = L.length - 1; k >= 0; k--) { const p = L[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
        const h = lo.slice(0, -1).concat(up.slice(0, -1)); if (h.length < 3) return null; return h.map((p) => ps[p.i]);
      },
      get selected() { return [...sel]; }, get mode() { return mode; }, setMode, opt,
    };
  })();

  // ================= 보안구역 위장 =================
  // 선택한 폴리곤 "안쪽"만 숲 모양 모델(GLB 패치)로 덮어 다른 지역처럼 보이게 한다.
  //  - 원본 3D 타일 파일은 수정하지 않는다. 화면에서만 폴리곤 안쪽 원본을 가리고(클리핑) 패치를 얹는다.
  //  - 경계: 폴리곤 안쪽 '퍼짐 폭' 구간은 나무 모양으로 점점 성글어져 원본과 자연스럽게 이어진다(폴리곤 바깥은 건드리지 않음).
  //  - 높이: 폴리곤 둘레 바깥 표면 높이를 읽어 그 높이에 맞춘다.
  //  - 색상: 화면에 보이는 폴리곤 주변 색을 읽어 숲 색을 맞춘다(없으면 기본 숲색). 숲 느낌/밝기/채도로 미세 조정.
  const camo = (() => {
    const items = []; let seq = 0, panel = null, listEl = null, stEl = null, infoEl = null, busy = false;
    const P = { feather: 12, forest: 25, bright: 0, sat: 0, tree: 4.5, canopy: 3, hoff: 0, clip: true, fill: true };
    const FOREST = [58, 98, 48];
    const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const say = (s) => { if (stEl) stEl.textContent = s; };
    const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const clamp8 = (v) => Math.max(0, Math.min(255, v));
    const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vnoise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; };
    const fbm = (x, y, s) => (vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15) * 2 - 1;
    const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    async function sampleList(carts, excl, label) {
      const out = new Array(carts.length); let t0 = performance.now();
      for (let i = 0; i < carts.length; i++) {
        let h; try { h = scene.sampleHeight(carts[i], excl); } catch (e) { h = undefined; }
        out[i] = (h === undefined || h === null || isNaN(h)) ? null : h;
        if (performance.now() - t0 > 60) { say(label + ' ' + Math.round((i / carts.length) * 100) + '%'); await frame(); t0 = performance.now(); }
      }
      return out;
    }

    // ---- PNG 인코더 (알파 0 픽셀의 색도 보존: 테두리 검은 띠 방지)
    const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRCT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    async function encodePng(w, h, rgba) {
      const row = w * 4 + 1, raw = new Uint8Array(row * h);
      for (let y = 0; y < h; y++) { raw[y * row] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * row + 1); }
      const cs = new CompressionStream('deflate'); const wr = cs.writable.getWriter(); wr.write(raw); wr.close();
      const comp = new Uint8Array(await new Response(cs.readable).arrayBuffer());
      const chunk = (type, data) => { const o = new Uint8Array(12 + data.length), dv = new DataView(o.buffer); dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i); o.set(data, 8); dv.setUint32(8 + data.length, crc32(o.subarray(4, 8 + data.length))); return o; };
      const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer); hv.setUint32(0, w); hv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
      const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', new Uint8Array(0))];
      const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; }); return out;
    }

    // ---- GLB (텍스처, 조명 영향 없음 KHR_materials_unlit, 알파 컷)
    function makeGlb(pos, uv, ind, png, extras) {
      let mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18]; for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
      const pb = pos.byteLength, ub = uv.byteLength, ib = ind.byteLength, gl = png.length, gpad = (4 - (gl % 4)) % 4;
      const json = { asset: { version: '2.0', generator: extras.generator, extras }, extensionsUsed: ['KHR_materials_unlit'], scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'camouflage_patch' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0, mode: 4 }] }],
        materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 }, alphaMode: 'MASK', alphaCutoff: 0.5, doubleSided: true, extensions: { KHR_materials_unlit: {} } }],
        textures: [{ sampler: 0, source: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }], images: [{ bufferView: 3, mimeType: 'image/png' }],
        accessors: [{ bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: mn, max: mx }, { bufferView: 1, componentType: 5126, count: uv.length / 2, type: 'VEC2' }, { bufferView: 2, componentType: 5125, count: ind.length, type: 'SCALAR' }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pb, target: 34962 }, { buffer: 0, byteOffset: pb, byteLength: ub, target: 34962 }, { buffer: 0, byteOffset: pb + ub, byteLength: ib, target: 34963 }, { buffer: 0, byteOffset: pb + ub + ib, byteLength: gl }],
        buffers: [{ byteLength: pb + ub + ib + gl + gpad }] };
      let js = new TextEncoder().encode(JSON.stringify(json)); const jpad = (4 - (js.length % 4)) % 4; if (jpad) { const t = new Uint8Array(js.length + jpad).fill(32); t.set(js); js = t; }
      const binLen = pb + ub + ib + gl + gpad, total = 12 + 8 + js.length + 8 + binLen; const out = new ArrayBuffer(total), dv = new DataView(out), u8 = new Uint8Array(out);
      dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
      dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(js, 20);
      let o = 20 + js.length; dv.setUint32(o, binLen, true); dv.setUint32(o + 4, 0x004e4942, true); o += 8;
      u8.set(new Uint8Array(pos.buffer), o); u8.set(new Uint8Array(uv.buffer), o + pb); u8.set(new Uint8Array(ind.buffer), o + pb + ub); u8.set(png, o + pb + ub + ib);
      return u8;
    }

    // ---- 폴리곤 안쪽으로 줄이기 (클리핑용). 실패하면 null
    function insetPoly(poly, d) {
      const n = poly.length; let ar = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
      const P2 = ar >= 0 ? poly : poly.slice().reverse(); const A0 = Math.abs(ar) / 2;
      const inside = (pl, x, y) => { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const dEdge = (x, y) => { let m = 1e18; for (let i = 0; i < n; i++) { const a = P2[i], b = P2[(i + 1) % n]; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const px = a[0] + dx * t - x, py = a[1] + dy * t - y; m = Math.min(m, px * px + py * py); } return Math.sqrt(m); };
      const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const simple = (pl) => { const m = pl.length; for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { if (Math.abs(i - j) <= 1 || (i === 0 && j === m - 1)) continue; const a = pl[i], b = pl[(i + 1) % m], c = pl[j], e = pl[(j + 1) % m]; if ((cr(a, b, c) > 0) !== (cr(a, b, e) > 0) && (cr(c, e, a) > 0) !== (cr(c, e, b) > 0)) return false; } return true; };
      for (let t = 0; t < 7; t++) {
        const dd = d * Math.pow(0.7, t); const out = [];
        for (let i = 0; i < n; i++) {
          const p0 = P2[(i + n - 1) % n], p1 = P2[i], p2 = P2[(i + 1) % n];
          const e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p1[0], p2[1] - p1[1]]; const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
          const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2]; let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
          let sc = dd / Math.max(k, 0.35); let vx = mx * sc, vy = my * sc; const vl = Math.hypot(vx, vy); if (vl > dd * 3) { vx *= (dd * 3) / vl; vy *= (dd * 3) / vl; }
          out.push([p1[0] + vx, p1[1] + vy]);
        }
        let a2 = 0; for (let i = 0; i < n; i++) { const a = out[i], b = out[(i + 1) % n]; a2 += a[0] * b[1] - b[0] * a[1]; } a2 = a2 / 2;
        if (a2 > 0 && a2 < A0 && a2 > A0 * 0.02 && simple(out) && out.every((q) => inside(P2, q[0], q[1]) && dEdge(q[0], q[1]) > dd * 0.35)) return out;
      }
      return null;
    }

    // ---- 화면에서 폴리곤 주변 색 읽기
    function captureColors(pts) {
      const out = []; const cv = scene.canvas; const prev = viewer.entities.show; viewer.entities.show = false;
      try {
        scene.render();
        const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const g = c2.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, 0, 0);
        const sx = cv.width / cv.clientWidth, sy = cv.height / cv.clientHeight;
        for (const p of pts) {
          const w = scene.cartesianToCanvasCoordinates(p.cart); if (!w) continue; const px = Math.round(w.x * sx), py = Math.round(w.y * sy);
          if (px < 3 || py < 3 || px > cv.width - 4 || py > cv.height - 4) continue;
          let pk = null; try { pk = scene.pickPosition(w); } catch (e) {} if (!pk || C.Cartesian3.distance(pk, p.cart) > 4) continue;
          const d = g.getImageData(px - 1, py - 1, 3, 3).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 9; i++) { r += d[i * 4]; gg += d[i * 4 + 1]; b += d[i * 4 + 2]; }
          out.push({ x: p.x, y: p.y, h: p.h, c: [r / 9, gg / 9, b / 9] });
        }
      } finally { viewer.entities.show = prev; }
      return out;
    }

    async function build() {
      if (busy) return;
      const rp = select.regionPts();
      if (!rp) { say('먼저 "선택" 메뉴에서 위장할 영역(폴리곤, 3점 이상)을 그리세요.'); return; }
      busy = true; const T0 = performance.now(); const prm = Object.assign({}, P);
      try {
        const excl = items.map((m) => m.model).filter(Boolean);
        const cs = rp.map((p) => C.Cartographic.fromCartesian(p));
        const h0 = cs.reduce((a, c) => a + c.height, 0) / cs.length;
        const cen = rp.reduce((a, p) => C.Cartesian3.add(a, p, new C.Cartesian3()), new C.Cartesian3()); C.Cartesian3.multiplyByScalar(cen, 1 / rp.length, cen);
        const cc = C.Cartographic.fromCartesian(cen); const origin = C.Cartographic.toCartesian(new C.Cartographic(cc.longitude, cc.latitude, h0));
        const fr = C.Transforms.eastNorthUpToFixedFrame(origin), inv = C.Matrix4.inverseTransformation(fr, new C.Matrix4());
        const toCart = (x, y, z) => C.Matrix4.multiplyByPoint(fr, new C.Cartesian3(x, y, z || 0), new C.Cartesian3());
        const toCarto = (x, y) => C.Cartographic.fromCartesian(toCart(x, y, 0));
        let poly = rp.map((q) => { const l = C.Matrix4.multiplyByPoint(inv, q, new C.Cartesian3()); return [l.x, l.y]; });
        let ar = 0; const n0 = poly.length; for (let i = 0; i < n0; i++) { const a = poly[i], b = poly[(i + 1) % n0]; ar += a[0] * b[1] - b[0] * a[1]; }
        if (ar < 0) { poly = poly.slice().reverse(); ar = -ar; } const area = ar / 2; const n = poly.length;   // 이제 반시계 방향
        const inside = (x, y) => { let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
        const dEdge = (x, y) => { let m = 1e18; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const px = a[0] + dx * t - x, py = a[1] + dy * t - y; m = Math.min(m, px * px + py * py); } return Math.sqrt(m); };
        const sdist = (x, y) => (inside(x, y) ? dEdge(x, y) : -dEdge(x, y));
        let minx = 1e18, maxx = -1e18, miny = 1e18, maxy = -1e18; poly.forEach((p) => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
        const feather = Math.max(1, Math.min(+prm.feather || 10, Math.sqrt(area) * 0.45));

        // ---- 1) 폴리곤 바깥 둘레(4 m, 10 m)의 표면 높이와 색 읽기
        say('주변 높이·색 확인 중...');
        let per = 0; for (let i = 0; i < n; i++) per += Math.hypot(poly[(i + 1) % n][0] - poly[i][0], poly[(i + 1) % n][1] - poly[i][1]);
        const spc = Math.max(3, per / 260); const ring = [];
        [4, 10].forEach((off) => { for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; const k = Math.max(1, Math.round(L / spc)); const nx = dy / L, ny = -dx / L;
          for (let j = 0; j < k; j++) { const t = (j + 0.5) / k, x = a[0] + dx * t + nx * off, y = a[1] + dy * t + ny * off; if (!inside(x, y) && sdist(x, y) < -off * 0.6) ring.push({ x, y, off }); } } });
        if (ring.length < 4) throw new Error('폴리곤 둘레를 읽지 못했습니다. 영역을 다시 그려 보세요.');
        const rh = await sampleList(ring.map((p) => toCarto(p.x, p.y)), excl, '주변 높이');
        // 같은 둘레 순서대로 중앙값 필터 (작은 물체·차량 제거)
        const rr = ring.map((p, i) => ({ x: p.x, y: p.y, off: p.off, h: rh[i] }));
        const filt = rr.map((p, i) => { const w = []; for (let d = -3; d <= 3; d++) { const q = rr[(i + d + rr.length) % rr.length]; if (q.off === p.off && q.h !== null) w.push(q.h); } if (!w.length) return null; w.sort((a, b) => a - b); return w[Math.floor(w.length / 2)]; });
        let hp = rr.map((p, i) => ({ x: p.x, y: p.y, h: filt[i] })).filter((p) => p.h !== null);
        { const land = hp.filter((p) => p.h > 1.0); if (land.length >= 8) hp = land; }   // 바다/모델 없는 곳(약 0 m)은 높이 기준에서 제외
        if (hp.length < 4) throw new Error('주변 모델 높이를 읽지 못했습니다. 영역 주변이 화면에 보이도록 가까이 이동해 타일이 로드된 뒤 다시 시도하세요.');
        const cart3 = (p, h) => toCart(p.x, p.y, h - h0);
        const cpts = ring.map((p, i) => (rh[i] !== null ? { x: p.x, y: p.y, h: rh[i], cart: toCart(p.x, p.y, rh[i] - h0) } : null)).filter(Boolean);
        let samples = captureColors(cpts);
        const isVeg = (c) => c[1] >= c[0] * 1.03 && c[1] >= c[2] * 1.25 && lum(c) > 25 && lum(c) < 215;
        const veg = samples.filter((s) => isVeg(s.c)); const useVeg = veg.length >= 6;
        const csrc = (useVeg ? veg : samples); const matched = csrc.length >= 6;
        const vh = veg.filter((s) => s.h !== undefined && s.h !== null); const hpUse = vh.length >= 8 ? vh.map((s) => ({ x: s.x, y: s.y, h: s.h })) : hp; const heightFrom = vh.length >= 8 ? '식생 높이' : '주변 표면 높이';
        const palMean = matched ? [0, 1, 2].map((k) => csrc.reduce((a, s) => a + s.c[k], 0) / csrc.length) : FOREST.slice();

        // ---- 2) 높이장 (바깥 둘레 높이를 폴리곤 안쪽으로 부드럽게 이어서 숲 수관 질감 추가)
        say('숲 표면 만드는 중...');
        const bw = maxx - minx, bh = maxy - miny; const s = Math.max(0.9, Math.sqrt((bw * bh) / 30000));
        const nx = Math.ceil(bw / s) + 3, ny = Math.ceil(bh / s) + 3, x0 = minx - s, y0 = miny - s; const N = nx * ny;
        const gstep = Math.max(1, Math.floor(hpUse.length / 220)); const gps = hpUse.filter((_, t) => t % gstep === 0);
        const gstepA = Math.max(1, Math.floor(hp.length / 220)); const gpsA = hp.filter((_, t) => t % gstepA === 0);   // 가장자리용: 모든 주변 표면
        const SD = new Float32Array(N), use = new Uint8Array(N), Hz = new Float32Array(N), HA = new Float32Array(N);
        const tree = Math.max(2, +prm.tree || 6), canopy = Math.max(0, +prm.canopy || 0), hoff = +prm.hoff || 0;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const k = j * nx + i, x = x0 + i * s, y = y0 + j * s; const d = sdist(x, y); SD[k] = d; if (d < -1.6 * s) continue; use[k] = 1;
          let sw = 0, sv = 0; for (let t = 0; t < gps.length; t++) { const dx = gps[t].x - x, dy = gps[t].y - y; const w = 1 / (dx * dx + dy * dy + 9); sw += w; sv += w * gps[t].h; }
          let sw2 = 0, sv2 = 0; for (let t = 0; t < gpsA.length; t++) { const dx = gpsA[t].x - x, dy = gpsA[t].y - y; const w = 1 / (dx * dx + dy * dy + 9); sw2 += w; sv2 += w * gpsA[t].h; }
          const ramp = sm(Math.max(0, d) / feather);
          const hv2 = sv / sw, ha2 = sv2 / sw2; HA[k] = ha2;   // 식생(수관) 높이 / 모든 주변 표면 높이: 가장자리는 주변 표면에 맞추고 안쪽으로 갈수록 숲 높이로 전환
          const nz = fbm(x / (tree * 1.6), y / (tree * 1.6), 5) * 0.65 + fbm(x / (tree * 0.6), y / (tree * 0.6), 17) * 0.35;
          Hz[k] = Math.max(1.4, ha2 + (hv2 - ha2) * ramp + ramp * (hoff + canopy * (0.6 + nz)));   // 바탕 지도(0 m) 아래로 묻히지 않게 최소 높이 보장
        }
        // 경계 퍼짐 구간에서 원본이 비어 있는(모델이 없어 바탕 지도가 보이는) 곳을 찾아 숲으로 메움
        const gap = new Uint8Array(N); let nGap = 0;
        if (prm.fill) {
          say('원본의 빈 곳 확인 중...');
          const bi = []; for (let k = 0; k < N; k++) if (use[k] && SD[k] >= 0 && SD[k] <= feather + 1.5 * s) bi.push(k);
          const stride = Math.max(1, Math.ceil(bi.length / 5000)); const bs2 = bi.filter((_, t) => t % stride === 0);
          const bh2 = await sampleList(bs2.map((k) => toCarto(x0 + (k % nx) * s, y0 + Math.floor(k / nx) * s)), excl, '빈 곳 확인');
          bs2.forEach((k, t) => { if (bh2[t] === null || bh2[t] < 2.0 || bh2[t] < HA[k] - 10) { for (let dj = -stride; dj <= stride; dj++) for (let di = -stride; di <= stride; di++) { const ii = (k % nx) + di, jj = Math.floor(k / nx) + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) { gap[jj * nx + ii] = 1; } } } });
          for (let k = 0; k < N; k++) if (gap[k]) nGap++;
        }
        // ---- 3) 메쉬
        const vid = new Int32Array(N).fill(-1); let nv = 0; for (let k = 0; k < N; k++) if (use[k]) vid[k] = nv++;
        const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2); const W = nx * s, H = ny * s;
        for (let k = 0; k < N; k++) { const v = vid[k]; if (v < 0) continue; const i = k % nx, j = Math.floor(k / nx); const x = x0 + i * s, y = y0 + j * s;
          pos[v * 3] = x; pos[v * 3 + 1] = Hz[k] - h0; pos[v * 3 + 2] = -y; uv[v * 2] = (x - x0) / W; uv[v * 2 + 1] = (y0 + H - y) / H; }
        const idx = []; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c2 = a + nx + 1, d = a + nx; if (use[a] && use[b] && use[c2] && use[d]) idx.push(vid[a], vid[b], vid[c2], vid[a], vid[c2], vid[d]); }
        const ind = new Uint32Array(idx);

        // ---- 4) 텍스처 (주변 색 맞춘 숲 수관 + 경계 퍼짐 알파)
        say('숲 질감 만드는 중...');
        const scale = Math.max(0.12, Math.max(W, H) / 1536); const tw = Math.max(16, Math.ceil(W / scale)), th = Math.max(16, Math.ceil(H / scale));
        const GN = 40, tint = new Float32Array(GN * GN * 3);
        const csc = csrc.length > 300 ? csrc.filter((_, t) => t % Math.ceil(csrc.length / 300) === 0) : csrc;
        const Fl = lum(FOREST), fa = Math.max(0, Math.min(1, prm.forest / 100)), br = 1 + prm.bright / 100, sa = 1 + prm.sat / 100;
        // 주변에서 읽은 색 -> 숲 느낌/밝기/채도 반영
        const adj = (c) => { const lt = lum(c); const f = Math.max(0.6, Math.min(1.5, (lt * 0.85) / Fl)); let m = [c[0] * (1 - fa) + FOREST[0] * f * fa, c[1] * (1 - fa) + FOREST[1] * f * fa, c[2] * (1 - fa) + FOREST[2] * f * fa]; m = m.map((v) => v * br); const g2 = lum(m); return m.map((v) => clamp8(g2 + (v - g2) * sa)); };
        const pal = csc.map((q) => ({ x: q.x, y: q.y, c: adj(q.c) }));
        for (let gj = 0; gj < GN; gj++) for (let gi = 0; gi < GN; gi++) {
          const x = x0 + ((gi + 0.5) / GN) * W, y = y0 + ((gj + 0.5) / GN) * H; let c = palMean.slice();
          if (matched) { let sw = 0, a = [0, 0, 0]; for (const q of pal) { const dx = q.x - x, dy = q.y - y; const w = 1 / (dx * dx + dy * dy + 16); sw += w; a[0] += w * q.c[0]; a[1] += w * q.c[1]; a[2] += w * q.c[2]; } c = [a[0] / sw, a[1] / sw, a[2] / sw]; } else c = adj(c);
          const o = (gj * GN + gi) * 3; tint[o] = c[0]; tint[o + 1] = c[1]; tint[o + 2] = c[2];
        }
        const tintAt = (px, py) => { const u = Math.max(0, Math.min(GN - 1.001, (px / tw) * GN - 0.5)), v = Math.max(0, Math.min(GN - 1.001, (py / th) * GN - 0.5)); const i0 = Math.floor(u), j0 = Math.floor(v), fx = u - i0, fy = v - j0; const r = [0, 0, 0];
          for (let k = 0; k < 3; k++) { const a = tint[(j0 * GN + i0) * 3 + k], b = tint[(j0 * GN + i0 + 1) * 3 + k], c = tint[((j0 + 1) * GN + i0) * 3 + k], d = tint[((j0 + 1) * GN + i0 + 1) * 3 + k]; r[k] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; } return r; };
        const cv = document.createElement('canvas'); cv.width = tw; cv.height = th; const g = cv.getContext('2d', { willReadFrequently: true });
        const base = g.createImageData(tw, th);
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const c = tintAt(x, y), o = (y * tw + x) * 4; base.data[o] = c[0] * 0.42; base.data[o + 1] = c[1] * 0.44; base.data[o + 2] = c[2] * 0.42; base.data[o + 3] = 255; }
        g.putImageData(base, 0, 0);
        const R = rng(7 + seq * 131); const trPx = tree / scale;
        // 큰 나무 -> 중간 -> 작은 잎덩이 순으로 겹쳐 그림. 각 덩이는 주변 샘플 색 중 가까운 것에서 무작위로 골라 색 분포를 닮게 함
        const nearCol = (bx, by) => { if (!pal.length) { const t = tintAt(Math.max(0, Math.min(tw - 1, bx)), Math.max(0, Math.min(th - 1, by))); return t; }
          const wx = x0 + (bx / tw) * W, wy = y0 + H - (by / th) * H; const cand = []; for (const q of pal) { const dx = q.x - wx, dy = q.y - wy; cand.push([dx * dx + dy * dy, q.c]); } cand.sort((a, b) => a[0] - b[0]); const k = Math.min(6, cand.length); const pick = cand[Math.floor(R() * k)][1]; const t = tintAt(Math.max(0, Math.min(tw - 1, bx)), Math.max(0, Math.min(th - 1, by))); return [pick[0] * 0.6 + t[0] * 0.4, pick[1] * 0.6 + t[1] * 0.4, pick[2] * 0.6 + t[2] * 0.4]; };
        const layers = [{ d: 1.5, st: 0.62, dark: 0.7 }, { d: 1.0, st: 0.55, dark: 0.8 }, { d: 0.5, st: 0.7, dark: 0.9 }];
        for (const L of layers) {
          const rpx = trPx * L.d * 0.5, stp = Math.max(2, trPx * L.d * L.st); const blobs = [];
          for (let y = -stp; y < th + stp; y += stp) for (let x = -stp; x < tw + stp; x += stp) blobs.push([x + (R() - 0.5) * stp * 1.2, y + (R() - 0.5) * stp * 1.2, rpx * (0.7 + R() * 0.6), R()]);
          blobs.sort((a, b) => a[1] - b[1]);
          for (const [bx, by, br0, rv] of blobs) {
            const c = nearCol(bx, by); const f = (0.84 + rv * 0.32) * L.dark / 0.85;
            const col = (m) => 'rgb(' + clamp8(c[0] * f * m) + ',' + clamp8(c[1] * f * m) + ',' + clamp8(c[2] * f * m * 0.96) + ')';
            const gr = g.createRadialGradient(bx - br0 * 0.32, by - br0 * 0.34, br0 * 0.08, bx, by, br0); gr.addColorStop(0, col(1.14)); gr.addColorStop(0.55, col(0.98)); gr.addColorStop(1, col(0.76));
            g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br0, 0, Math.PI * 2); g.fill();
          }
        }
        // 잔 노이즈: 사진 같은 거친 느낌
        { const im = g.getImageData(0, 0, tw, th), d = im.data; for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = (y * tw + x) * 4; const k = 1 + (hash(x, y, 9) - 0.5) * 0.16 + (vnoise(x / (trPx * 2.5), y / (trPx * 2.5), 21) - 0.5) * 0.18; d[o] = clamp8(d[o] * k); d[o + 1] = clamp8(d[o + 1] * k); d[o + 2] = clamp8(d[o + 2] * k); } g.putImageData(im, 0, 0); }
        // 경계 퍼짐 알파: 폴리곤 안쪽 feather 구간에서 나무 모양으로 점점 성글게
        const mk = document.createElement('canvas'); mk.width = tw; mk.height = th; const mg = mk.getContext('2d', { willReadFrequently: true });
        mg.fillStyle = '#000'; mg.fillRect(0, 0, tw, th); mg.fillStyle = '#fff'; mg.beginPath();
        poly.forEach((p, i) => { const px = ((p[0] - x0) / W) * tw, py = ((y0 + H - p[1]) / H) * th; if (i) mg.lineTo(px, py); else mg.moveTo(px, py); }); mg.closePath(); mg.fill();
        const blurPx = Math.max(1, (feather / scale) / 2); const mb = document.createElement('canvas'); mb.width = tw; mb.height = th; const mbg = mb.getContext('2d', { willReadFrequently: true }); mbg.filter = 'blur(' + blurPx.toFixed(1) + 'px)'; mbg.drawImage(mk, 0, 0);
        const md = mbg.getImageData(0, 0, tw, th).data, hd = mg.getImageData(0, 0, tw, th).data, cd = g.getImageData(0, 0, tw, th); const rgba = cd.data;
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
          const o = (y * tw + x) * 4; const m = md[o] / 255, t = Math.max(0, Math.min(1, (m - 0.5) * 2)); const hard = hd[o] > 127;
          const thr = vnoise(x / (trPx * 1.1), y / (trPx * 1.1), 41) * 0.7 + hash(x, y, 3) * 0.3;
          let gp2 = false; if (nGap && hard) { const gi2 = Math.round(((x / tw) * W) / s), gj2 = Math.round(((th - y) / th * H) / s); const kk = gj2 * nx + gi2; gp2 = gi2 >= 0 && gj2 >= 0 && gi2 < nx && gj2 < ny && gap[kk] === 1; }
          rgba[o + 3] = hard && (gp2 || t * 1.15 > thr * 0.95) ? 255 : 0;
        }
        const png = await encodePng(tw, th, rgba);

        // ---- 5) GLB 만들고 화면에 올리기 + 폴리곤 안 원본 가리기
        const glb = makeGlb(pos, uv, ind, png, { generator: 'Sistech 3D analysis tools', note: '보안구역 위장 패치 (원본 모델 미수정). 원점/축: ENU(동,북,위), 폴리곤 안쪽만 유효', origin: { lonDeg: C.Math.toDegrees(cc.longitude), latDeg: C.Math.toDegrees(cc.latitude), ellipsoidHeight: h0 }, polygonLocalENU: poly, featherM: feather, treeM: tree });
        const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
        const model = await C.Model.fromGltfAsync({ url, modelMatrix: fr, backFaceCulling: false, shadows: C.ShadowMode.DISABLED, forwardAxis: C.Axis.X });
        scene.primitives.add(model);
        let clipPts = null, clipNote = '';
        if (prm.clip) {
          const ins = insetPoly(poly, feather * 0.9);
          if (ins) clipPts = ins.map((p) => toCart(p[0], p[1], 0)); else clipNote = ' · 모양이 복잡해 원본 가리기 생략';
        }
        const id = ++seq; const nm = '위장 ' + id;
        const it = { id, name: nm, glb, url, model, show: true, pts: rp.slice(), cen: origin, clipPts, info: { area, feather, tree, matched, useVeg, nSamples: csrc.length, nRing: ring.length, bytes: glb.byteLength, tris: ind.length / 3, tex: tw + '×' + th, tint: palMean, clipNote, heightFrom, nGap, clip: !!clipPts, mix: tint.slice(0, 3).map((v) => Math.round(v)) } };
        items.unshift(it); syncClip(); renderList(); emitChange();
        say('완료: ' + ((performance.now() - T0) / 1000).toFixed(1) + '초 · ' + (matched ? '주변 색 ' + csrc.length + '곳 반영' : '주변 색 부족 → 기본 숲색 사용 (영역 주변이 화면에 보이게 한 뒤 다시 만들면 주변 색에 맞춰집니다)') + clipNote);
        return it;
      } catch (e) { console.error(e); say('실패: ' + (e && e.message ? e.message : e)); }
      finally { busy = false; }
    }

    // 폴리곤 안 원본 가리기 (화면 표시만. 타일 데이터는 그대로)
    function syncClip() {
      const polys = items.filter((m) => m.show && m.clipPts).map((m) => new C.ClippingPolygon({ positions: m.clipPts }));
      (api.getTilesets() || []).forEach((ts) => { try { ts.clippingPolygons = polys.length ? new C.ClippingPolygonCollection({ polygons: polys }) : new C.ClippingPolygonCollection({ polygons: [], enabled: false }); } catch (e) { console.error(e); } });
    }
    function download(it) { const a = document.createElement('a'); a.href = it.url; a.download = 'camouflage_' + (projId || 'project') + '_' + it.id + '.glb'; document.body.appendChild(a); a.click(); a.remove(); }
    function remove(it) { try { scene.primitives.remove(it.model); } catch (e) {} try { URL.revokeObjectURL(it.url); } catch (e) {} const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); syncClip(); renderList(); emitChange(); }
    function setShow(it, v) { it.show = v; it.model.show = v; syncClip(); }

    function refreshInfo() {
      if (!infoEl) return; const rp = select.regionPts();
      if (!rp) { infoEl.innerHTML = '<span style="color:#ffab91">선택된 영역 없음 · "선택" 메뉴에서 위장할 폴리곤을 그리세요. (폴리곤 안쪽만 바뀝니다)</span>'; return; }
      const fr = C.Transforms.eastNorthUpToFixedFrame(rp[0]), inv = C.Matrix4.inverseTransformation(fr, new C.Matrix4()); const L = rp.map((q) => C.Matrix4.multiplyByPoint(inv, q, new C.Cartesian3())); let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p.x * q.y - q.x * p.y; }
      infoEl.innerHTML = '<span style="color:#00e5ff">위장 영역 선택됨</span> · 꼭짓점 ' + rp.length + '개 · 약 ' + fmtArea(Math.abs(a) / 2);
    }
    const chip = (c) => '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:3px;border:1px solid #556;background:rgb(' + c.map((v) => Math.round(v)).join(',') + ')"></span>';
    function renderList() {
      if (!listEl) return; listEl.innerHTML = '';
      if (!items.length) { listEl.innerHTML = '<div class="sis-lbl" style="padding:8px 0">만든 위장 영역이 여기에 표시됩니다.</div>'; return; }
      items.forEach((it) => {
        const f = it.info, d = document.createElement('div'); d.className = 'sis-res';
        d.innerHTML = '<div style="display:flex;align-items:center;gap:6px"><input type="checkbox" class="vz" ' + (it.show ? 'checked' : '') + ' title="체크: 위장 적용 / 해제: 원본 보기"><b style="flex:1">' + it.name + '</b><span class="sis-lbl">' + (it.show ? '위장 적용 중' : '원본 보기') + '</span></div>' +
          '<div class="sis-lbl" style="margin-top:3px;color:#e8eaf6">영역 ' + fmtArea(f.area) + ' · 경계 퍼짐 ' + f.feather.toFixed(0) + ' m · 나무 ' + f.tree + ' m<br>' + chip(f.tint) + (f.matched ? '주변 색 ' + f.nSamples + '곳(' + (f.useVeg ? '식생' : '전체') + ') 반영' : '기본 숲색 사용') + ' · ' + (f.clip ? '폴리곤 안 원본 가림' : '원본 가림 없음') + f.clipNote + (f.nGap ? ' · 원본 빈 곳 메움' : '') + '<br>높이: ' + f.heightFrom + ' 기준 · 텍스처 ' + f.tex + ' · 삼각형 ' + f.tris.toLocaleString() + '개 · ' + (f.bytes / 1048576).toFixed(1) + ' MB</div>' +
          '<div style="display:flex;gap:4px;margin-top:5px"><button class="sis-btn fl" style="flex:1;padding:3px;font-size:12px">🔍 보기</button><button class="sis-btn dl" style="flex:1;padding:3px;font-size:12px">⬇ GLB 저장</button><button class="sis-btn rm" style="flex:1;padding:3px;font-size:12px">원본 복원</button></div>';
        d.querySelector('.vz').onchange = (ev) => { setShow(it, ev.target.checked); renderList(); };
        d.querySelector('.fl').onclick = () => { const bs = new C.BoundingSphere(it.cen, Math.max(Math.sqrt(f.area), 40) * 1.4); viewer.camera.flyToBoundingSphere(bs, { duration: 0.8, offset: new C.HeadingPitchRange(viewer.camera.heading, C.Math.toRadians(-40), bs.radius * 2.4) }); };
        d.querySelector('.dl').onclick = () => download(it); d.querySelector('.rm').onclick = () => remove(it);
        listEl.appendChild(d);
      });
    }

    const rowH = (label, inner) => '<div style="margin-top:8px"><div class="sis-lbl">' + label + '</div>' + inner + '</div>';
    const slider = (id, min, max, step) => '<input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" style="width:100%">';
    changeCbs.push(() => { if (panel) refreshInfo(); });
    return {
      id: 'camo', icon: '🌲', title: '위장',
      mount(el) {
        panel = el;
        el.innerHTML = '<div id="cm-info" style="padding:8px;border:1px solid #2c3050;border-radius:8px;font-size:12px"></div>' +
          '<div class="sis-lbl" style="margin-top:8px;line-height:1.5">폴리곤 <b>안쪽만</b> 숲으로 바뀌고 바깥은 그대로입니다. 원본 파일은 수정되지 않고 화면에서만 가려집니다. 주변 색을 읽으려면 폴리곤 주변이 화면에 보이게 한 뒤 만드세요.</div>' +
          rowH('경계 퍼짐 폭 <b id="cm-v-feather"></b> m (안쪽에서 점점 성글게)', slider('cm-feather', 2, 40, 1)) +
          rowH('숲 느낌 강화 <b id="cm-v-forest"></b>% (0=주변 색 그대로)', slider('cm-forest', 0, 100, 5)) +
          rowH('밝기 <b id="cm-v-bright"></b>%', slider('cm-bright', -40, 40, 2)) +
          rowH('채도 <b id="cm-v-sat"></b>%', slider('cm-sat', -60, 40, 5)) +
          rowH('나무 크기 <b id="cm-v-tree"></b> m', slider('cm-tree', 2, 14, 0.5)) +
          rowH('수관 높이 변화 <b id="cm-v-canopy"></b> m', slider('cm-canopy', 0, 8, 0.5)) +
          rowH('높이 보정 <b id="cm-v-hoff"></b> m (주변보다 위+/아래-)', slider('cm-hoff', -5, 10, 0.5)) +
          '<label style="display:block;margin-top:8px;font-size:12px;color:#c5cae9;cursor:pointer"><input id="cm-clip" type="checkbox" style="vertical-align:middle"> 폴리곤 안 원본 모델 가리기 (끄면 원본 위에 덮기만)</label>' +
          '<label style="display:block;margin-top:6px;font-size:12px;color:#c5cae9;cursor:pointer"><input id="cm-fill" type="checkbox" style="vertical-align:middle"> 경계 구간에서 원본 모델이 비어 있는 곳도 숲으로 메우기</label>' +
          '<button id="cm-go" class="sis-btn" style="width:100%;margin-top:10px;padding:10px;font-weight:600">🌲 선택한 폴리곤을 숲으로 위장</button>' +
          '<div id="cm-st" style="margin:8px 0;color:#9fb0ff;font-size:12px;min-height:18px"></div><div id="cm-list"></div>';
        listEl = el.querySelector('#cm-list'); stEl = el.querySelector('#cm-st'); infoEl = el.querySelector('#cm-info');
        ['feather', 'forest', 'bright', 'sat', 'tree', 'canopy', 'hoff'].forEach((k) => { const e = el.querySelector('#cm-' + k), v = el.querySelector('#cm-v-' + k); e.value = P[k]; v.textContent = P[k]; e.oninput = () => { P[k] = +e.value; v.textContent = e.value; }; });
        const cl = el.querySelector('#cm-clip'); cl.checked = P.clip; cl.onchange = () => { P.clip = cl.checked; };
        const cf = el.querySelector('#cm-fill'); cf.checked = P.fill; cf.onchange = () => { P.fill = cf.checked; };
        el.querySelector('#cm-go').onclick = () => build();
        refreshInfo(); renderList();
      },
      unmount() { panel = listEl = stEl = infoEl = null; },
      onProjectChange() { [...items].forEach((it) => { try { scene.primitives.remove(it.model); } catch (e) {} try { URL.revokeObjectURL(it.url); } catch (e) {} }); items.length = 0; renderList(); },
      build, items, P, makeGlb, syncClip, insetPoly,
      source() {
        return { id: 'camo', name: '위장 영역', items: () => items.map((it) => ({ key: 'camo:' + it.id, name: it.name, kind: '위장', pts: it.pts, closed: true, ents: [], visible: it.show,
          props: () => '위장 영역 ' + fmtArea(it.info.area), metrics: () => ({ area: it.info.area }), remove: () => remove(it), setVisible: (v) => setShow(it, v) })) };
      },
    };
  })();

  // ================= 시작 =================
  addFeature(measure);
  addFeature(draw);
  addFeature(camo);
  addFeature(select, { first: true });   // 맨 위(측정 위)에 "선택" 메뉴
  api.registerSource = select.registerSource; api.onChange = (f) => changeCbs.push(f);
  function destroy() {
    features.forEach((f) => { try { f.unmount && f.unmount(); } catch (e) {} });
    try { viewer.destroy(); } catch (e) {} root.remove(); delete window.SisMenu;
  }
  window.SisMenu = { C, viewer, scene, api, features, addFeature, openFeature, measure, draw, select, camo, registerSource: select.registerSource, loadProject, destroy, computeVolume, computeVolume3D, voxelizeVolume, fromHeightfield };
  await loadProject(sel.value);
})();
