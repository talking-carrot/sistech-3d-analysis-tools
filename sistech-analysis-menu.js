/*
 * Sistech 3D 분석 메뉴 (왼쪽 메뉴바 + 측정 기능: 거리 / 높이 / 면적 / 체적)
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
  function addFeature(f) { features.push(f); renderRail(); if (!active) openFeature(f); }

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
    if (pre.length) { try { await scene.sampleHeightMostDetailed(pre); } catch (e) {} }

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
    const items = [];            // { html, ents }
    let handler = null, onKey = null, resEl = null, hintEl = null;
    const HINTS = {
      distance: '모델 위를 좌클릭해 점을 찍으세요. 우클릭/Enter로 완료, Esc로 취소.',
      height: '두 점을 차례로 클릭하세요. 두 번째 클릭에서 자동 완료됩니다.',
      area: '3개 이상 점을 찍으세요. 우클릭/Enter로 완료, Esc로 취소.',
      volume: '체적을 구할 영역의 경계를 3점 이상 찍으세요. 우클릭/Enter로 완료. 영역을 정육면체로 잘라, 공중에 떠있는 구조물 아래는 빈 공간으로 계산합니다.',
    };
    function renderResults() {
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
    function record(html, ents) { const it = { html, ents }; items.unshift(it); renderResults(); return it; }

    function finish() {
      if (!mode) return;
      hover = null;
      const m = mode; let ents = [...live];
      dyn.forEach((e) => rm(e)); dyn = [];
      if (m === 'distance' && pts.length >= 2) {
        let d3 = 0, dh = 0;
        for (let i = 1; i < pts.length; i++) { d3 += C.Cartesian3.distance(pts[i - 1], pts[i]); dh += horizDist(pts[i - 1], pts[i]); }
        ents.push(addLine(pts.slice(), COL.distance), addLabel(pts[pts.length - 1], '총 ' + fmtLen(d3), -34));
        record(`<b style="color:${HEX.distance}">거리</b> (${pts.length}점)<br>3D 거리: <b>${fmtLen(d3)}</b><br>수평 거리: ${fmtLen(dh)}`, ents);
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
        record(`<b style="color:${HEX.area}">면적</b> (${pts.length}점)<br>수평 면적(2D 환산): <b>${fmtArea(ar.projected)}</b><br>표면 면적(점을 이은 3D 면): <b>${fmtArea(ar.surface)}</b><br><span class="sis-lbl">경사 비율 ×${(ar.surface / Math.max(1e-9, ar.projected)).toFixed(3)}</span>`, ents);
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
          it.result = r; renderResults();
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
      // 테스트/자동화용: 월드 좌표 배열로 직접 측정
      feed(m, cart3s) { setMode(m); cart3s.forEach((p) => { pts.push(p); live.push(addPoint(p, COL[m])); if (pts.length === 1) startDynamic(); }); finish(); },
    };
  })();

  // ================= 시작 =================
  addFeature(measure);
  function destroy() {
    features.forEach((f) => { try { f.unmount && f.unmount(); } catch (e) {} });
    try { viewer.destroy(); } catch (e) {} root.remove(); delete window.SisMenu;
  }
  window.SisMenu = { C, viewer, scene, api, features, addFeature, openFeature, measure, loadProject, destroy, computeVolume, computeVolume3D, voxelizeVolume, fromHeightfield };
  await loadProject(sel.value);
})();
