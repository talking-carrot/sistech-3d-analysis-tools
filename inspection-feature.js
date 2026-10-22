/* 점검 보고 도구 (사진 중첩 결과에서 균열/문제 지점 표시 -> 내용 입력 -> 보고서 자동 작성)
 * 사용: sistech-analysis-menu.js 실행 후 이 파일을 실행. (사진 중첩 시제품이 있으면 원본 사진 크롭과 중첩 화면이 보고서에 같이 들어갑니다)
 * 데이터는 브라우저 IndexedDB(sisInsp)에 프로젝트별로 자동 저장됩니다. */
(async () => {
  const S = window.SisMenu;
  if (!S) throw new Error('먼저 sistech-analysis-menu.js 를 실행해 주세요.');
  if (S.inspect && S.inspect.destroy) S.inspect.destroy();
  const C = S.C, viewer = S.viewer, scene = viewer.scene, api = S.api;
  const CATS = ['균열', '박리·탈락', '누수·백태', '침하·변형', '파손·손상', '오염·식생', '기타'];
  const SEVS = [['경미', '#ffd54f'], ['보통', '#ff9800'], ['심각', '#ff5252']];
  const sevCol = (s) => (SEVS.find((x) => x[0] === s) || SEVS[1])[1];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const projId = () => { const el = document.querySelector('#sis-menu-root select'); return (el && el.value) || 'proj'; };
  const projName = () => { const el = document.querySelector('#sis-menu-root select'); return el && el.selectedOptions[0] ? el.selectedOptions[0].textContent : projId(); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  // ---------- 저장소 (IndexedDB) ----------
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('sisInsp', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function dbGet(k) { try { const d = await idb(); return await new Promise((res) => { const q = d.transaction('p').objectStore('p').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } }
  async function dbSet(k, v) { try { const d = await idb(); return await new Promise((res) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); } catch (e) { return false; } }

  // ---------- 상태 ----------
  let items = [], meta = { title: '드론 촬영 점검 보고서', site: '', inspector: '', date: today() };
  let curProj = null, panelEl = null, mode = null, draft = null, editing = null, handler = null, kd = null, poll = null, markersOn = true;
  const draftEnts = []; let draftPts = [];
  let saveTimer = null;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => dbSet('i:' + curProj, { meta, items: items.map(({ _e, ...r }) => r) }), 250); };

  // ---------- 좌표 도우미 ----------
  const toC = (o) => C.Cartesian3.fromDegrees(o.lon, o.lat, o.h);
  const toLL = (p) => { const g = C.Cartographic.fromCartesian(p); return { lon: C.Math.toDegrees(g.longitude), lat: C.Math.toDegrees(g.latitude), h: g.height }; };
  const len3 = (P) => { let s = 0; for (let i = 1; i < P.length; i++) s += C.Cartesian3.distance(P[i - 1], P[i]); return s; };
  const area3 = (P) => { // 3D 다각형 면적 (Newell). 벽면 위 영역도 실제 면적으로 계산
    const o = P[0]; const q = P.map((p) => C.Cartesian3.subtract(p, o, new C.Cartesian3())); let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; nx += a.y * b.z - a.z * b.y; ny += a.z * b.x - a.x * b.z; nz += a.x * b.y - a.y * b.x; }
    return Math.hypot(nx, ny, nz) / 2; };
  const fmtLen = (m) => (m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m.toFixed(2) + ' m');
  const fmtArea = (m2) => (m2 >= 1e6 ? (m2 / 1e6).toFixed(4) + ' km²' : m2.toFixed(2) + ' m²');
  const sizeText = (it) => it.type === 'line' ? '길이 ' + fmtLen(it.len) : it.type === 'area' ? '면적 ' + fmtArea(it.area) : '-';
  const typeName = { point: '지점', line: '선(길이)', area: '영역(면적)' };
  const anchorOf = (it) => { const P = it.pts.map(toC); if (it.type === 'line') return P[Math.floor(P.length / 2)]; if (it.type === 'area') { const m = new C.Cartesian3(); P.forEach((p) => C.Cartesian3.add(m, p, m)); return C.Cartesian3.multiplyByScalar(m, 1 / P.length, m); } return P[0]; };
  const w2c = (p) => (C.SceneTransforms.worldToWindowCoordinates || C.SceneTransforms.wgs84ToWindowCoordinates)(scene, p);

  // ---------- 번호 핀 ----------
  function pinImg(n, col) {
    const c = document.createElement('canvas'); c.width = 52; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(14, 38); g.lineTo(26, 62); g.lineTo(38, 38); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(26, 24, 21, 0, 7); g.fill(); g.stroke();
    g.fillStyle = col === '#ffd54f' ? '#222' : '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 26, 25);
    return c.toDataURL();
  }
  function clearEnt(it) { (it._e || []).forEach((e) => viewer.entities.remove(e)); it._e = []; }
  function drawItem(it, i) {
    clearEnt(it); const col = C.Color.fromCssColorString(sevCol(it.sev)); const P = it.pts.map(toC);
    if (it.type !== 'point') it._e.push(viewer.entities.add({ polyline: { positions: it.type === 'area' ? [...P, P[0]] : P, width: 4, material: col, depthFailMaterial: col } }));
    it._e.push(viewer.entities.add({ position: anchorOf(it), billboard: { image: pinImg(i + 1, sevCol(it.sev)), verticalOrigin: C.VerticalOrigin.BOTTOM, scale: 0.75, disableDepthTestDistance: 1e9 } }));
    it._e.forEach((e) => (e.show = markersOn));
  }
  const redrawAll = () => items.forEach((it, i) => drawItem(it, i));
  const clearAll = () => items.forEach(clearEnt);

  // ---------- 불러오기 ----------
  async function loadProj() {
    clearAll(); curProj = projId(); const d = await dbGet('i:' + curProj);
    items = d && d.items ? d.items : []; if (d && d.meta) meta = Object.assign(meta, d.meta);
    redrawAll(); renderList(); fillMeta();
  }

  // ---------- 화면 캡처 ----------
  async function waitTiles(ms) { const t0 = Date.now(); let ok = 0; while (Date.now() - t0 < ms) { scene.render(); const ts = api.getTilesets(); if (ts.every((t) => t.tilesLoaded)) { if (++ok >= 3) return true; } else ok = 0; await sleep(200); } return false; }
  function snapShape(P, it) {
    scene.render(); const cv = viewer.canvas, W = cv.width, H = cv.height, sx = W / cv.clientWidth, sy = H / cv.clientHeight;
    const q = P.map((p) => w2c(p)); if (q.some((a) => !a)) return null;
    const pts = q.map((a) => [a.x * sx, a.y * sy]);
    const c1 = document.createElement('canvas'); c1.width = W; c1.height = H; const g = c1.getContext('2d'); g.drawImage(cv, 0, 0);
    const col = sevCol(it.sev), lw = 3 * sx;
    const stroke = () => { g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = lw + 3 * sx; g.stroke(); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
    if (it.type === 'point') { g.beginPath(); g.arc(pts[0][0], pts[0][1], 16 * sx, 0, 7); stroke(); g.beginPath(); g.arc(pts[0][0], pts[0][1], 2.5 * sx, 0, 7); g.fillStyle = col; g.fill(); }
    else { g.beginPath(); pts.forEach((a, i) => (i ? g.lineTo(a[0], a[1]) : g.moveTo(a[0], a[1]))); if (it.type === 'area') g.closePath(); stroke(); }
    // 전체 화면
    const wide = document.createElement('canvas'); const ww = Math.min(1000, W); wide.width = ww; wide.height = Math.round(H * ww / W); wide.getContext('2d').drawImage(c1, 0, 0, wide.width, wide.height);
    // 확대(해당 위치 중심)
    const xs = pts.map((a) => a[0]), ys = pts.map((a) => a[1]); const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2; let zw = Math.max(240 * sx, (bx1 - bx0) * 1.8), zh = zw * 0.75; if (zh < (by1 - by0) * 1.8) { zh = (by1 - by0) * 1.8; zw = zh / 0.75; } zw = Math.min(zw, W); zh = Math.min(zh, H);
    const rx = Math.min(Math.max(cx - zw / 2, 0), W - zw), ry = Math.min(Math.max(cy - zh / 2, 0), H - zh);
    const zoom = document.createElement('canvas'); zoom.width = 640; zoom.height = Math.round(640 * zh / zw); zoom.getContext('2d').drawImage(c1, rx, ry, zw, zh, 0, 0, zoom.width, zoom.height);
    return { wide: wide.toDataURL('image/jpeg', 0.82), zoom: zoom.toDataURL('image/jpeg', 0.88), inView: pts.every((a) => a[0] >= 0 && a[1] >= 0 && a[0] <= W && a[1] <= H) };
  }
  async function captureItem(it, st) {
    const P = it.pts.map(toC); const PH = S.photo; const out = {};
    const oldRS = viewer.resolutionScale, ents0 = viewer.entities.show;
    let photoState = null;
    try {
      // 화면 밖이면 해당 위치로 접근
      const w0 = w2c(anchorOf(it)); const cv = viewer.canvas;
      if (!w0 || w0.x < 20 || w0.y < 20 || w0.x > cv.clientWidth - 20 || w0.y > cv.clientHeight - 20) {
        st('해당 위치로 이동하는 중...'); const bs = C.BoundingSphere.fromPoints(P); const r = Math.max(bs.radius, 4);
        viewer.camera.flyToBoundingSphere(bs, { duration: 0, offset: new C.HeadingPitchRange(viewer.camera.heading, C.Math.toRadians(-40), Math.max(30, r * 5)) }); await sleep(300); await waitTiles(25000);
      }
      it.cam = camState();
      viewer.entities.show = false; viewer.resolutionScale = Math.min(2, Math.max(oldRS, 1.5)); viewer.resize(); await sleep(300); await waitTiles(15000);
      st('화면 캡처 중... (현재 화면)');
      const cur = snapShape(P, it); if (!cur) throw new Error('선택한 위치가 화면에 보이지 않습니다. 화면을 옮겨서 위치가 보이게 한 뒤 다시 저장해 주세요.');
      out.wide = cur.wide;
      if (PH && PH.toggle && PH.state) {
        photoState = PH.state().shown;
        st('화면 캡처 중... (사진 중첩)'); await PH.toggle(true); await sleep(1800); await waitTiles(8000); const a = snapShape(P, it); if (a) out.zoomPhoto = a.zoom;
        st('화면 캡처 중... (모델만)'); await PH.toggle(false); await sleep(900); await waitTiles(8000); const b = snapShape(P, it); if (b) out.zoomModel = b.zoom;
        await PH.toggle(photoState); await sleep(600);
        if (PH.cropOriginal) { st('원본 사진에서 잘라내는 중...'); const o = PH.cropOriginal(P, { color: sevCol(it.sev), type: it.type }); if (o) { out.orig = o.url; out.origPx = o.px; out.origRegion = o.region; } }
      } else { out.zoomModel = cur.zoom; }
      if (PH && PH.META) { out.photo = { name: PH.META.name, date: PH.fileDate ? PH.fileDate() : '' }; }
    } finally { viewer.entities.show = ents0; viewer.resolutionScale = oldRS; viewer.resize(); if (PH && photoState !== null && PH.state && PH.state().shown !== photoState) { try { await PH.toggle(photoState); } catch (e) {} } }
    return out;
  }
  function camState() { const c = viewer.camera; return { pos: { x: c.positionWC.x, y: c.positionWC.y, z: c.positionWC.z }, h: c.heading, p: c.pitch, r: c.roll, fov: c.frustum.fov }; }
  function gotoCam(cm) { if (!cm) return; viewer.camera.setView({ destination: new C.Cartesian3(cm.pos.x, cm.pos.y, cm.pos.z), orientation: { heading: cm.h, pitch: cm.p, roll: cm.r } }); if (cm.fov) viewer.camera.frustum.fov = cm.fov; }

  // ---------- 지점 찍기 ----------
  function setMode(m) {
    mode = m; draft = null; cancelDraftGeom();
    if (panelEl) { panelEl.querySelectorAll('[data-im]').forEach((b) => b.classList.toggle('on', b.dataset.im === m)); const h = panelEl.querySelector('#in-hint'); h.textContent = m === 'point' ? '문제 지점을 한 번 클릭하세요.' : m === 'line' ? '균열을 따라 점을 차례로 클릭하세요. 끝나면 Enter, 오른쪽 클릭 또는 "찍기 완료". (Backspace: 한 점 취소, Esc: 취소)' : m === 'area' ? '문제 영역의 모서리를 차례로 클릭하세요(3점 이상). 끝나면 Enter, 오른쪽 클릭 또는 "찍기 완료".' : '위 도구를 눌러 시작하세요. 벽면에도 점을 찍을 수 있습니다.'; panelEl.querySelector('#in-fin').style.display = (m === 'line' || m === 'area') ? '' : 'none'; panelEl.querySelector('#in-form').style.display = 'none'; }
    scene.canvas.style.cursor = m ? 'crosshair' : '';
  }
  function cancelDraftGeom() { draftEnts.forEach((e) => viewer.entities.remove(e)); draftEnts.length = 0; draftPts = []; }
  function pickAt(pos) { let p = null; try { p = scene.pickPosition(pos); } catch (e) {} if (!p || !isFinite(p.x)) { const r = viewer.camera.getPickRay(pos); p = r && scene.globe.pick(r, scene); } return p || null; }
  function onClick(e) {
    if (!mode || draft || editing) return; const p = pickAt(e.position); if (!p) { api.toast && api.toast('모델 위를 클릭해 주세요.'); return; }
    draftPts.push(p);
    draftEnts.push(viewer.entities.add({ position: p, point: { pixelSize: 9, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#ff5252'), outlineWidth: 2, disableDepthTestDistance: 1e9 } }));
    if (draftPts.length === 2 && mode !== 'point') draftEnts.push(viewer.entities.add({ polyline: { positions: new C.CallbackProperty(() => (mode === 'area' && draftPts.length > 2 ? [...draftPts, draftPts[0]] : draftPts), false), width: 3, material: C.Color.fromCssColorString('#ff5252'), depthFailMaterial: C.Color.fromCssColorString('#ff5252') } }));
    if (mode === 'point') finishGeom(); else showHint();
  }
  function showHint() { const h = panelEl && panelEl.querySelector('#in-hint'); if (h) h.textContent = (mode === 'line' ? '선' : '영역') + ' 점 ' + draftPts.length + '개. 계속 클릭하거나 Enter/오른쪽 클릭으로 완료하세요.'; }
  function finishGeom() {
    const min = mode === 'point' ? 1 : mode === 'line' ? 2 : 3;
    if (draftPts.length < min) { api.toast && api.toast('점이 더 필요합니다 (최소 ' + min + '개).'); return; }
    draft = { type: mode, P: draftPts.slice() }; draft.len = mode === 'line' ? len3(draft.P) : 0; draft.area = mode === 'area' ? area3(draft.P) : 0;
    scene.canvas.style.cursor = ''; openForm(null);
  }

  // ---------- 입력 폼 ----------
  const opt = (arr, v) => arr.map((a) => { const x = Array.isArray(a) ? a[0] : a; return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('');
  function openForm(it) {
    editing = it; const f = panelEl.querySelector('#in-form'); f.style.display = '';
    const d = it || { cat: '균열', sev: '보통', title: '', desc: '', action: '' }; // 새 항목: 제목/내용/조치 의견은 빈 칸
    f.querySelector('#f-cat').innerHTML = opt(CATS, d.cat); f.querySelector('#f-sev').innerHTML = opt(SEVS, d.sev);
    f.querySelector('#f-title').value = d.title || ''; f.querySelector('#f-desc').value = d.desc || ''; f.querySelector('#f-act').value = d.action || '';
    const t = it ? it.type : draft.type, ln = it ? it.len : draft.len, ar = it ? it.area : draft.area;
    f.querySelector('#f-size').textContent = typeName[t] + (t === 'line' ? ' · 길이 ' + fmtLen(ln) : t === 'area' ? ' · 면적 ' + fmtArea(ar) : '');
    f.querySelector('#f-head').textContent = it ? '#' + (items.indexOf(it) + 1) + ' 내용 수정' : '새 점검 항목 입력';
    f.querySelector('#f-recap').parentElement.style.display = it ? '' : 'none'; f.querySelector('#f-recap').checked = false;
    f.querySelector('#f-st').textContent = ''; setTimeout(() => f.querySelector('#f-title').focus(), 50);
    panelEl.querySelector('#in-hint').textContent = it ? '' : '내용을 입력하고 저장하세요. 저장할 때 현재 화면이 증빙 이미지로 자동 캡처됩니다. 위치가 잘 보이게 화면을 맞춰 두세요.';
  }
  function closeForm() { editing = null; draft = null; panelEl.querySelector('#in-form').style.display = 'none'; cancelDraftGeom(); setMode(null); }
  async function saveForm() {
    const f = panelEl.querySelector('#in-form'); const st = (m) => (f.querySelector('#f-st').textContent = m);
    const v = { cat: f.querySelector('#f-cat').value, sev: f.querySelector('#f-sev').value, title: f.querySelector('#f-title').value.trim(), desc: f.querySelector('#f-desc').value.trim(), action: f.querySelector('#f-act').value.trim() };
    if (!v.title) { st('제목을 입력해 주세요.'); f.querySelector('#f-title').focus(); return; }
    const btn = f.querySelector('#f-save'); btn.disabled = true;
    try {
      if (editing) {
        Object.assign(editing, v);
        if (f.querySelector('#f-recap').checked) { editing.shots = await captureItem(editing, st); }
        drawItem(editing, items.indexOf(editing)); st('수정했습니다.');
      } else {
        const it = Object.assign({ id: Date.now().toString(36), type: draft.type, pts: draft.P.map(toLL), len: draft.len, area: draft.area, createdAt: new Date().toISOString() }, v);
        const tmpDraft = draftEnts.slice(); tmpDraft.forEach((e) => (e.show = false));
        it.shots = await captureItem(it, st);
        cancelDraftGeom(); items.push(it); drawItem(it, items.length - 1);
      }
      persist(); closeForm(); renderList();
    } catch (e) { st('저장하지 못했습니다: ' + e.message); draftEnts.forEach((x) => (x.show = true)); }
    finally { btn.disabled = false; }
  }

  // ---------- 목록 ----------
  let delArm = null;
  function renderList() {
    if (!panelEl) return; const el = panelEl.querySelector('#in-list');
    if (!items.length) { el.innerHTML = '<div style="color:#889;font-size:12px;padding:6px 0">아직 표시한 항목이 없습니다.</div>'; panelEl.querySelector('#in-sum').textContent = ''; return; }
    el.innerHTML = items.map((it, i) => '<div class="inrow" data-i="' + i + '" style="display:flex;gap:6px;align-items:center;padding:6px 4px;border-bottom:1px solid #2a2f4a">' +
      '<span style="flex:none;width:22px;height:22px;border-radius:50%;background:' + sevCol(it.sev) + ';color:' + (it.sev === '경미' ? '#222' : '#fff') + ';font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</span>' +
      '<div style="flex:1;min-width:0;font-size:12px;line-height:1.35"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(it.title) + '</div><div style="color:#9fa8da">' + esc(it.cat) + ' · ' + esc(it.sev) + ' · ' + sizeText(it) + '</div></div>' +
      '<button class="sis-btn" data-a="go" title="이 항목 보기" style="padding:3px 6px">🔍</button><button class="sis-btn" data-a="ed" title="내용 수정" style="padding:3px 6px">✎</button><button class="sis-btn" data-a="del" title="삭제" style="padding:3px 6px">' + (delArm === it.id ? '확인' : '✕') + '</button></div>').join('');
    const by = {}; items.forEach((it) => { by[it.sev] = (by[it.sev] || 0) + 1; });
    panelEl.querySelector('#in-sum').textContent = '총 ' + items.length + '건 · ' + SEVS.map((s) => s[0] + ' ' + (by[s[0]] || 0)).join(' / ');
  }
  function onListClick(e) {
    const b = e.target.closest('button[data-a]'); if (!b) return; const row = b.closest('.inrow'); const it = items[+row.dataset.i]; const a = b.dataset.a;
    if (a === 'go') { gotoCam(it.cam); }
    else if (a === 'ed') { if (draft) return; mode = null; openForm(it); }
    else if (a === 'del') { if (delArm === it.id) { clearEnt(it); items = items.filter((x) => x !== it); delArm = null; redrawAll(); persist(); } else { delArm = it.id; setTimeout(() => { if (delArm === it.id) { delArm = null; renderList(); } }, 3000); } renderList(); }
  }

  // ---------- 보고서 ----------
  async function overview(st) {
    if (!items.length) return null; const P = items.flatMap((it) => it.pts.map(toC)); const bs = C.BoundingSphere.fromPoints(P); const save = camState(); const oldRS = viewer.resolutionScale;
    try { st('전체 개요 화면 만드는 중...'); viewer.camera.flyToBoundingSphere(bs, { duration: 0, offset: new C.HeadingPitchRange(viewer.camera.heading, C.Math.toRadians(-55), Math.max(120, bs.radius * 3.2)) }); viewer.resolutionScale = Math.min(2, Math.max(oldRS, 1.5)); viewer.resize(); await sleep(400); await waitTiles(25000);
      scene.render(); const cv = viewer.canvas; const c = document.createElement('canvas'); const w = Math.min(1100, cv.width); c.width = w; c.height = Math.round(cv.height * w / cv.width); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85);
    } finally { viewer.resolutionScale = oldRS; viewer.resize(); gotoCam(save); }
  }
  function photoInfo() { const PH = S.photo; if (!PH || !PH.META) return null; const m = PH.META, a = PH.adj ? PH.adj() : null; return { name: m.name, date: PH.fileDate ? PH.fileDate() : '', lon: m.lon, lat: m.lat, alt: m.alt, yaw: m.yaw, pitch: m.pitch, adj: a }; }
  function reportHtml(ov) {
    const pi = photoInfo(); const now = new Date(); const nowS = today() + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const cnt = {}; CATS.forEach((c) => (cnt[c] = { 경미: 0, 보통: 0, 심각: 0 })); items.forEach((it) => { (cnt[it.cat] = cnt[it.cat] || { 경미: 0, 보통: 0, 심각: 0 })[it.sev]++; });
    const totLen = items.filter((i) => i.type === 'line').reduce((s, i) => s + i.len, 0), totArea = items.filter((i) => i.type === 'area').reduce((s, i) => s + i.area, 0);
    const badge = (s) => '<span class="bd" style="background:' + sevCol(s) + ';color:' + (s === '경미' ? '#222' : '#fff') + '">' + esc(s) + '</span>';
    const sumRows = Object.keys(cnt).filter((c) => cnt[c].경미 + cnt[c].보통 + cnt[c].심각 > 0).map((c) => '<tr><td>' + esc(c) + '</td><td>' + cnt[c].경미 + '</td><td>' + cnt[c].보통 + '</td><td>' + cnt[c].심각 + '</td><td><b>' + (cnt[c].경미 + cnt[c].보통 + cnt[c].심각) + '</b></td></tr>').join('');
    const listRows = items.map((it, i) => { const g = toLL(anchorOf(it)); return '<tr><td>' + (i + 1) + '</td><td>' + esc(it.cat) + '</td><td>' + badge(it.sev) + '</td><td>' + esc(it.title) + '</td><td>' + sizeText(it) + '</td><td>' + g.lat.toFixed(6) + ', ' + g.lon.toFixed(6) + '</td></tr>'; }).join('');
    const cards = items.map((it, i) => { const g = toLL(anchorOf(it)); const s = it.shots || {}; const imgs = [];
      if (s.wide) imgs.push(['현재 화면 (위치 표시)', s.wide, 'wide']); if (s.zoomPhoto) imgs.push(['사진 중첩 확대', s.zoomPhoto, '']); if (s.zoomModel) imgs.push([s.zoomPhoto ? '3D 모델만 확대' : '확대', s.zoomModel, '']); if (s.orig) imgs.push(['원본 사진 (원해상도 크롭' + (s.origRegion ? ' · ' + s.origRegion[2] + '×' + s.origRegion[3] + 'px' : '') + ')', s.orig, '']);
      return '<section class="card"><h3><span class="no" style="background:' + sevCol(it.sev) + ';color:' + (it.sev === '경미' ? '#222' : '#fff') + '">' + (i + 1) + '</span> ' + esc(it.title) + ' ' + badge(it.sev) + '</h3>' +
        '<table class="kv"><tr><th>종류</th><td>' + esc(it.cat) + '</td><th>표시 방식</th><td>' + typeName[it.type] + (it.type !== 'point' ? ' · ' + sizeText(it) : '') + '</td></tr>' +
        '<tr><th>위치</th><td colspan="3">위도 ' + g.lat.toFixed(7) + ' · 경도 ' + g.lon.toFixed(7) + ' · 높이 ' + g.h.toFixed(2) + ' m (WGS84 타원체고)</td></tr>' +
        (s.origPx ? '<tr><th>원본 사진 위치</th><td colspan="3">' + esc((s.photo && s.photo.name) || '') + ' · 픽셀 ' + s.origPx.map((q) => '(' + q.x + ', ' + q.y + ')').join(' → ') + '</td></tr>' : '') +
        '<tr><th>점검 내용</th><td colspan="3" class="tx">' + (esc(it.desc) || '-') + '</td></tr><tr><th>조치 의견</th><td colspan="3" class="tx">' + (esc(it.action) || '-') + '</td></tr></table>' +
        '<div class="imgs">' + imgs.map((m) => '<figure class="' + m[2] + '"><img src="' + m[1] + '"><figcaption>' + esc(m[0]) + '</figcaption></figure>').join('') + '</div></section>'; }).join('');
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(meta.title) + '</title><style>' +
      '@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1b1f33;margin:0;padding:24px;line-height:1.5;font-size:13px}' +
      'h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;border-left:5px solid #5b6cff;padding-left:8px;margin:26px 0 8px}h3{font-size:15px;margin:0 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.sub{color:#667;margin-bottom:14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cfd3e6;padding:5px 8px;text-align:left;vertical-align:top}th{background:#f1f3fb;width:110px;white-space:nowrap}' +
      '.sm th,.lst th{width:auto;text-align:center}.sm td{text-align:center}.sm td:first-child{text-align:left}.bd{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:700}' +
      '.no{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:13px}.card{border:1px solid #cfd3e6;border-radius:8px;padding:12px;margin:12px 0;page-break-inside:avoid}.tx{white-space:pre-wrap}' +
      '.imgs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}figure{margin:0;flex:1 1 calc(50% - 8px);min-width:240px}figure.wide{flex:1 1 100%}figure img{width:100%;border:1px solid #cfd3e6;border-radius:4px;display:block}figcaption{font-size:11px;color:#667;margin-top:2px}' +
      '.ov img{width:100%;border:1px solid #cfd3e6;border-radius:6px}.foot{margin-top:24px;color:#889;font-size:11px;border-top:1px solid #cfd3e6;padding-top:8px}@media print{body{padding:0}}' +
      '</style></head><body><h1>' + esc(meta.title) + '</h1><div class="sub">' + esc(projName()) + (meta.site ? ' · ' + esc(meta.site) : '') + '</div>' +
      '<table><tr><th>현장/구역</th><td>' + esc(meta.site || '-') + '</td><th>점검자</th><td>' + esc(meta.inspector || '-') + '</td></tr><tr><th>점검일</th><td>' + esc(meta.date) + '</td><th>작성일시</th><td>' + nowS + '</td></tr>' +
      '<tr><th>3D 모델</th><td colspan="3">' + esc(projName()) + ' (' + esc(projId()) + ')</td></tr>' +
      (pi ? '<tr><th>드론 사진</th><td colspan="3">' + esc(pi.name) + (pi.date ? ' · 촬영 ' + esc(pi.date) : '') + '<br>촬영 위치 위도 ' + pi.lat.toFixed(6) + ', 경도 ' + pi.lon.toFixed(6) + ', 고도 ' + pi.alt.toFixed(1) + ' m · 방위 ' + pi.yaw + '°, 상하 ' + pi.pitch + '°' + (pi.adj ? '<br>모델 맞춤 보정: 동 ' + pi.adj.e.toFixed(2) + ' m, 북 ' + pi.adj.n.toFixed(2) + ' m, 고도 ' + pi.adj.u.toFixed(2) + ' m, 방위 ' + pi.adj.yaw.toFixed(2) + '°, 상하 ' + pi.adj.pitch.toFixed(2) + '°, 기울기 ' + pi.adj.roll.toFixed(2) + '°' : '') + '</td></tr>' : '') + '</table>' +
      '<h2>1. 점검 요약</h2><p>총 <b>' + items.length + '건</b> (경미 ' + items.filter((i) => i.sev === '경미').length + ' / 보통 ' + items.filter((i) => i.sev === '보통').length + ' / 심각 ' + items.filter((i) => i.sev === '심각').length + ')' + (totLen ? ' · 선형 합계 ' + fmtLen(totLen) : '') + (totArea ? ' · 면적 합계 ' + fmtArea(totArea) : '') + '</p>' +
      '<table class="sm"><tr><th>종류</th><th>경미</th><th>보통</th><th>심각</th><th>합계</th></tr>' + sumRows + '</table>' +
      (ov ? '<h2>2. 전체 위치 개요</h2><div class="ov"><img src="' + ov + '"></div>' : '') +
      '<h2>' + (ov ? '3' : '2') + '. 점검 항목 목록</h2><table class="lst"><tr><th>번호</th><th>종류</th><th>정도</th><th>제목</th><th>규모</th><th>위치(위도, 경도)</th></tr>' + listRows + '</table>' +
      '<h2>' + (ov ? '4' : '3') + '. 항목별 상세</h2>' + cards +
      '<div class="foot">본 보고서는 Sistech 3D-VIEW 위에서 드론 사진 중첩 결과를 이용해 자동 작성되었습니다. 위치는 3D 모델과 사진 맞춤 결과에 따른 값으로 수 미터 오차가 있을 수 있으며, 균열 폭 등 정밀 판정은 현장 확인이 필요합니다.</div></body></html>';
  }
  function csv() {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const pi = photoInfo();
    const rows = [['번호', '종류', '정도', '제목', '표시방식', '길이(m)', '면적(m2)', '위도', '경도', '높이(타원체고 m)', '점검 내용', '조치 의견', '원본 사진', '원본 사진 픽셀', '점검일']];
    items.forEach((it, i) => { const g = toLL(anchorOf(it)); const s = it.shots || {}; rows.push([i + 1, it.cat, it.sev, it.title, typeName[it.type], it.type === 'line' ? it.len.toFixed(3) : '', it.type === 'area' ? it.area.toFixed(3) : '', g.lat.toFixed(7), g.lon.toFixed(7), g.h.toFixed(2), it.desc, it.action, (s.photo && s.photo.name) || (pi && pi.name) || '', s.origPx ? s.origPx.map((a) => a.x + ':' + a.y).join(' ') : '', meta.date]); });
    return '\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n');
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  const fname = (ext) => '점검보고서_' + projId() + '_' + meta.date + '.' + ext;
  async function makeReport(kind) {
    const st = (m) => { const el = panelEl && panelEl.querySelector('#rp-st'); if (el) el.textContent = m; };
    if (!items.length) { st('표시한 항목이 없습니다. 먼저 문제 지점을 표시해 주세요.'); return null; }
    syncMeta(); const btn = panelEl.querySelectorAll('.rpb'); btn.forEach((b) => (b.disabled = true));
    try {
      if (kind === 'csv') { download(fname('csv'), csv(), 'text/csv;charset=utf-8'); st('CSV를 저장했습니다.'); return null; }
      const ov = await overview(st); const html = reportHtml(ov);
      if (kind === 'html') { download(fname('html'), html, 'text/html;charset=utf-8'); st('보고서(HTML)를 저장했습니다. 브라우저에서 열어 인쇄하면 PDF로 저장할 수 있습니다.'); }
      else if (kind === 'print') { const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-9999px;width:900px;height:900px'; document.body.appendChild(fr); fr.srcdoc = html; await new Promise((r) => (fr.onload = r)); await sleep(600); fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000); st('인쇄 창을 열었습니다. 대상에서 "PDF로 저장"을 선택하세요.'); }
      return html;
    } catch (e) { st('보고서를 만들지 못했습니다: ' + e.message); return null; } finally { btn.forEach((b) => (b.disabled = false)); }
  }
  function syncMeta() { if (!panelEl) return; meta.title = panelEl.querySelector('#m-title').value.trim() || '드론 촬영 점검 보고서'; meta.site = panelEl.querySelector('#m-site').value.trim(); meta.inspector = panelEl.querySelector('#m-insp').value.trim(); meta.date = panelEl.querySelector('#m-date').value || today(); persist(); }
  function fillMeta() { if (!panelEl) return; panelEl.querySelector('#m-title').value = meta.title; panelEl.querySelector('#m-site').value = meta.site; panelEl.querySelector('#m-insp').value = meta.inspector; panelEl.querySelector('#m-date').value = meta.date; }

  // ---------- 패널 ----------
  const IN = 'width:100%;padding:6px;background:#161a2e;color:#e8eaf6;border:1px solid #343b66;border-radius:6px;font-size:13px;box-sizing:border-box';
  const feature = {
    id: 'inspect', icon: '🔍', title: '점검',
    mount(panel) {
      panelEl = panel;
      panel.innerHTML = '<div style="padding:12px;font-size:13px;line-height:1.5">' +
        '<div style="font-weight:600;margin-bottom:6px">점검 항목 표시</div>' +
        '<div style="display:flex;gap:6px"><button class="sis-btn" data-im="point" style="flex:1">📍 지점</button><button class="sis-btn" data-im="line" style="flex:1">〰 선(균열)</button><button class="sis-btn" data-im="area" style="flex:1">⬠ 영역</button></div>' +
        '<div id="in-hint" style="font-size:12px;color:#9fa8da;margin-top:6px"></div>' +
        '<button class="sis-btn" id="in-fin" style="width:100%;margin-top:6px;display:none">찍기 완료</button>' +
        '<div id="in-form" style="display:none;margin-top:10px;padding:10px;border:1px solid #343b66;border-radius:8px;background:#12162b">' +
          '<div id="f-head" style="font-weight:600;margin-bottom:2px"></div><div id="f-size" style="font-size:12px;color:#9fa8da;margin-bottom:6px"></div>' +
          '<div style="display:flex;gap:6px"><div style="flex:1"><div class="sis-lbl">종류</div><select id="f-cat" style="' + IN + '"></select></div><div style="flex:1"><div class="sis-lbl">정도</div><select id="f-sev" style="' + IN + '"></select></div></div>' +
          '<div class="sis-lbl" style="margin-top:6px">제목</div><input id="f-title" style="' + IN + '" placeholder="제목을 직접 입력하세요 (필수)">' +
          '<div class="sis-lbl" style="margin-top:6px">점검 내용</div><textarea id="f-desc" rows="3" style="' + IN + ';resize:vertical" placeholder="점검 내용을 직접 입력하세요"></textarea>' +
          '<div class="sis-lbl" style="margin-top:6px">조치 의견</div><textarea id="f-act" rows="2" style="' + IN + ';resize:vertical" placeholder="조치 의견을 직접 입력하세요"></textarea>' +
          '<label style="display:block;margin-top:6px;font-size:12px"><input id="f-recap" type="checkbox" style="vertical-align:middle"> 현재 화면으로 증빙 이미지 다시 캡처</label>' +
          '<div style="display:flex;gap:6px;margin-top:8px"><button class="sis-btn" id="f-save" style="flex:2">💾 저장</button><button class="sis-btn" id="f-cancel" style="flex:1">취소</button></div>' +
          '<div id="f-st" style="font-size:12px;color:#c5cae9;margin-top:6px;word-break:keep-all"></div></div>' +
        '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #2a2f4a"><div style="display:flex;justify-content:space-between;align-items:center"><b>점검 목록</b><label style="font-size:12px;cursor:pointer"><input id="in-show" type="checkbox" checked style="vertical-align:middle"> 지도에 표시</label></div>' +
          '<div id="in-sum" style="font-size:12px;color:#9fa8da;margin:4px 0"></div><div id="in-list"></div></div>' +
        '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #2a2f4a"><b>보고서</b>' +
          '<div class="sis-lbl" style="margin-top:6px">보고서 제목</div><input id="m-title" style="' + IN + '">' +
          '<div style="display:flex;gap:6px"><div style="flex:1"><div class="sis-lbl" style="margin-top:6px">현장/구역</div><input id="m-site" style="' + IN + '"></div><div style="flex:1"><div class="sis-lbl" style="margin-top:6px">점검자</div><input id="m-insp" style="' + IN + '"></div></div>' +
          '<div class="sis-lbl" style="margin-top:6px">점검일</div><input id="m-date" type="date" style="' + IN + '">' +
          '<button class="sis-btn rpb" data-rp="html" style="width:100%;margin-top:10px">📄 보고서 만들기 (HTML 저장)</button>' +
          '<button class="sis-btn rpb" data-rp="print" style="width:100%;margin-top:6px">🖨 인쇄 / PDF로 저장</button>' +
          '<button class="sis-btn rpb" data-rp="csv" style="width:100%;margin-top:6px">📊 표(CSV) 저장</button>' +
          '<div id="rp-st" style="font-size:12px;color:#c5cae9;margin-top:6px;word-break:keep-all"></div></div></div>';
      panel.querySelectorAll('[data-im]').forEach((b) => (b.onclick = () => { if (draft || editing) return; setMode(mode === b.dataset.im ? null : b.dataset.im); }));
      panel.querySelector('#in-fin').onclick = finishGeom; panel.querySelector('#f-save').onclick = saveForm; panel.querySelector('#f-cancel').onclick = closeForm;
      panel.querySelector('#in-list').onclick = onListClick;
      panel.querySelector('#in-show').onchange = (e) => { markersOn = e.target.checked; items.forEach((it) => (it._e || []).forEach((x) => (x.show = markersOn))); };
      panel.querySelectorAll('.rpb').forEach((b) => (b.onclick = () => makeReport(b.dataset.rp)));
      ['#m-title', '#m-site', '#m-insp', '#m-date'].forEach((s) => (panel.querySelector(s).onchange = syncMeta));
      handler = new C.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction(onClick, C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction(() => { if (mode && !draft && (mode === 'line' || mode === 'area') && draftPts.length) finishGeom(); }, C.ScreenSpaceEventType.RIGHT_CLICK);
      kd = (e) => { const t = e.target; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; if (!mode || draft) return;
        if (e.key === 'Enter') finishGeom(); else if (e.key === 'Escape') setMode(null); else if (e.key === 'Backspace') { e.preventDefault(); if (draftPts.length) { draftPts.pop(); const l = draftEnts.length; for (let i = l - 1; i >= 0; i--) { if (draftEnts[i].point) { viewer.entities.remove(draftEnts.splice(i, 1)[0]); break; } } showHint(); } } };
      document.addEventListener('keydown', kd);
      setMode(null); renderList(); fillMeta();
      if (curProj !== projId()) loadProj();
      poll = setInterval(() => { if (curProj !== projId()) { loadProj(); } }, 1200);
    },
    unmount() { setMode(null); if (handler) { handler.destroy(); handler = null; } if (kd) { document.removeEventListener('keydown', kd); kd = null; } if (poll) { clearInterval(poll); poll = null; } panelEl = null; draft = null; editing = null; }
  };
  S.addFeature(feature);
  const insp = {
    items: () => items, meta: () => meta, reportHtml: async () => { syncMeta(); const ov = await overview(() => {}); return reportHtml(ov); }, csv, loadProj, feature,
    addItem: async (o) => { // 테스트/자동화용: {type,pts:[{lon,lat,h}],cat,sev,title,desc,action}
      const it = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), createdAt: new Date().toISOString(), cat: '균열', sev: '보통', title: '', desc: '', action: '' }, o);
      const P = it.pts.map(toC); it.len = it.type === 'line' ? len3(P) : 0; it.area = it.type === 'area' ? area3(P) : 0; if (!it.title) it.title = it.cat + ' ' + (items.length + 1);
      it.shots = await captureItem(it, () => {}); items.push(it); drawItem(it, items.length - 1); persist(); renderList(); return it; },
    destroy() { try { feature.unmount(); } catch (e) {} clearAll(); cancelDraftGeom(); const i = S.features.indexOf(feature); if (i >= 0) S.features.splice(i, 1); }
  };
  S.inspect = insp;
  await loadProj();
})();
