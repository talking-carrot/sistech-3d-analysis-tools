(async()=>{
const S=window.SisMenu, C=S.C||window.Cesium, viewer=S.viewer, scene=viewer.scene;
if (S.photo && S.photo.remove) S.photo.remove();
const bin=atob(window.__pjb64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); window.__pjb64=null;
const META={name:'DJI_20260908114941_0040_V.JPG', lon:126.667629704, lat:37.390202139, alt:148.057, rel:120.715, yaw:-16.0, pitch:-39.8, roll:0, f:3725.151611, w:5280, h:3956, cx:2640, cy:1978};
const bmp=await createImageBitmap(new Blob([u8],{type:'image/jpeg'}));
const sc=0.5, src=document.createElement('canvas'); src.width=bmp.width*sc; src.height=bmp.height*sc; const sg=src.getContext('2d'); sg.drawImage(bmp,0,0,src.width,src.height); const sd=sg.getImageData(0,0,src.width,src.height);
const OW=1600, OH=1200, fo=META.f*OW/META.w, fx=3713.29,k1=-0.11257524,k2=0.01487443,p1=-0.00008572,p2=0.0000001,k3=-0.02706411,cxo=7.02,cyo=-8.72;
const out=document.createElement('canvas'); out.width=OW; out.height=OH; const og=out.getContext('2d'); const od=og.createImageData(OW,OH);
for(let y=0;y<OH;y++) for(let x=0;x<OW;x++){ const xn=(x+0.5-OW/2)/fo, yn=(y+0.5-OH/2)/fo; const r2=xn*xn+yn*yn; const rad=1+k1*r2+k2*r2*r2+k3*r2*r2*r2; const xd=xn*rad+2*p1*xn*yn+p2*(r2+2*xn*xn), yd=yn*rad+p1*(r2+2*yn*yn)+2*p2*xn*yn;
 const u=(xd*fx+META.w/2+cxo)*sc, v=(yd*fx+META.h/2+cyo)*sc; const o=(y*OW+x)*4; if(u<0||v<0||u>=src.width-1||v>=src.height-1){ continue; }
 const iu=Math.floor(u), iv=Math.floor(v), fu=u-iu, fv=v-iv; for(let c=0;c<3;c++){ const a=sd.data[(iv*src.width+iu)*4+c], b=sd.data[(iv*src.width+iu+1)*4+c], d=sd.data[((iv+1)*src.width+iu)*4+c], e=sd.data[((iv+1)*src.width+iu+1)*4+c]; od.data[o+c]=a*(1-fu)*(1-fv)+b*fu*(1-fv)+d*(1-fu)*fv+e*fu*fv; } od.data[o+3]=255; }
og.putImageData(od,0,0);
const camPos0=C.Cartesian3.fromDegrees(META.lon,META.lat,META.alt);
const fr0=C.Transforms.eastNorthUpToFixedFrame(camPos0);
const AKEY='sisPhotoAdj:'+META.name; const A0={e:0,n:0,u:0,yaw:0,pitch:0,roll:0,fov:0};
let A=Object.assign({},A0); try{ Object.assign(A, JSON.parse(localStorage.getItem(AKEY)||'{}')); }catch(e){}
const tmp=new C.Camera(scene);
let camPos, hpr, dir, up, right, tu, tv;
function recompute(){ camPos=C.Matrix4.multiplyByPoint(fr0,new C.Cartesian3(A.e,A.n,A.u),new C.Cartesian3());
 hpr=new C.HeadingPitchRoll(C.Math.toRadians(META.yaw+A.yaw),C.Math.toRadians(META.pitch+A.pitch),C.Math.toRadians(META.roll+A.roll));
 tmp.setView({destination:camPos, orientation:{heading:hpr.heading,pitch:hpr.pitch,roll:hpr.roll}});
 dir=C.Cartesian3.clone(tmp.directionWC); up=C.Cartesian3.clone(tmp.upWC); right=C.Cartesian3.clone(tmp.rightWC);
 const s=1+A.fov/100; tu=META.cx/META.f/s; tv=META.cy/META.f/s; }
recompute();
let D=150; const hit=scene.pickFromRay? null:null;
function corners(D){ const c=(a,b)=>{ const v=C.Cartesian3.multiplyByScalar(dir,1,new C.Cartesian3()); C.Cartesian3.add(v,C.Cartesian3.multiplyByScalar(right,a*tu,new C.Cartesian3()),v); C.Cartesian3.add(v,C.Cartesian3.multiplyByScalar(up,b*tv,new C.Cartesian3()),v); C.Cartesian3.multiplyByScalar(v,D,v); return C.Cartesian3.add(camPos,v,new C.Cartesian3()); }; return [c(-1,-1),c(1,-1),c(1,1),c(-1,1)]; }
let prim=null, lines=null, dist=120, opa=0.6;
const ents=[];
function build(){ if(prim) scene.primitives.remove(prim); const P=corners(dist);
  const pos=new Float64Array(12); P.forEach((p,i)=>{pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;});
  const st=new Float32Array([0,0, 1,0, 1,1, 0,1]);
  const geom=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:pos}), st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:st})}, indices:new Uint16Array([0,1,2,0,2,3]), primitiveType:C.PrimitiveType.TRIANGLES, boundingSphere:C.BoundingSphere.fromPoints(P)});
  prim=new C.Primitive({geometryInstances:new C.GeometryInstance({geometry:geom}), appearance:new C.MaterialAppearance({material:new C.Material({fabric:{type:'Image',uniforms:{image:out, color:new C.Color(1,1,1,opa)}}}), translucent:true, faceCulling:false, flat:true}), asynchronous:false});
  scene.primitives.add(prim);
  ents.forEach(e=>viewer.entities.remove(e)); ents.length=0;
  ents.push(viewer.entities.add({position:camPos, point:{pixelSize:10,color:C.Color.fromCssColorString('#ffd54f'),outlineColor:C.Color.BLACK,outlineWidth:2,disableDepthTestDistance:1e9}}));
  P.forEach(p=>ents.push(viewer.entities.add({polyline:{positions:[camPos,p],width:1.5,material:C.Color.fromCssColorString('#ffd54f').withAlpha(0.8)}})));
  ents.push(viewer.entities.add({polyline:{positions:[...P,P[0]],width:2,material:C.Color.fromCssColorString('#ffd54f')}}));
 applyVis();
}
function setOpa(v){ opa=v; if(prim){ prim.appearance.material.uniforms.color=new C.Color(1,1,1,opa);} }
function fly(){ const aspect=viewer.canvas.clientWidth/viewer.canvas.clientHeight; const hf=2*Math.atan(tu); viewer.camera.setView({destination:camPos, orientation:{heading:hpr.heading,pitch:hpr.pitch,roll:hpr.roll}}); viewer.camera.frustum.fov = aspect>=1? hf : 2*Math.atan(Math.tan(hf/2)/aspect); }
let shaderOn=false, pre=null, savedShaders=[], projOpa=0.85, minFacing=0.12, texUrl=null;
async function projectOn(){ if(shaderOn) return; const tss=S.api.getTilesets(); if(!tss.length) return;
  if(!texUrl){ const blob=await new Promise(r=>out.toBlob(r,'image/jpeg',0.92)); texUrl=URL.createObjectURL(blob); }
  const photoView=new C.Matrix4();
  const mk=()=>new C.CustomShader({ uniforms:{ u_tex:{type:C.UniformType.SAMPLER_2D,value:new C.TextureUniform({url:texUrl})}, u_M:{type:C.UniformType.MAT4,value:new C.Matrix4()}, u_camEC:{type:C.UniformType.VEC3,value:new C.Cartesian3()}, u_k:{type:C.UniformType.VEC4,value:new C.Cartesian4(tu,tv,projOpa,minFacing)} },
   fragmentShaderText:'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){ vec3 pe=fsInput.attributes.positionEC; vec4 pc=u_M*vec4(pe,1.0); if(pc.z>=-0.5) return; float tx=pc.x/(-pc.z), ty=pc.y/(-pc.z); vec2 uv=vec2(0.5+tx/(2.0*u_k.x), 0.5+ty/(2.0*u_k.y)); if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return; vec3 n=normalize(cross(dFdx(pe),dFdy(pe))); float facing=dot(n,normalize(u_camEC-pe)); if(facing<u_k.w) return; vec4 c=texture(u_tex,uv); float edge=smoothstep(0.0,0.015,min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y))); float a=u_k.z*edge*smoothstep(u_k.w,u_k.w+0.15,facing); material.diffuse=mix(material.diffuse,c.rgb,a); }' });
  savedShaders=tss.map(t=>t.customShader); shaders=tss.map(t=>{ const cs=mk(); t.customShader=cs; return cs; });
  pre=()=>{ C.Matrix4.computeView(camPos,dir,up,right,photoView); const cam=viewer.camera; const M=C.Matrix4.multiply(photoView,cam.inverseViewMatrix,new C.Matrix4()); const pe=C.Matrix4.multiplyByPoint(cam.viewMatrix,camPos,new C.Cartesian3()); shaders.forEach(cs=>{ cs.setUniform('u_M',M); cs.setUniform('u_camEC',pe); cs.setUniform('u_k',new C.Cartesian4(tu,tv,projOpa,minFacing)); }); };
  scene.preRender.addEventListener(pre); shaderOn=true; }
let shaders=[]; let bq=0;
function adjChanged(){ recompute(); try{ localStorage.setItem(AKEY,JSON.stringify(A)); }catch(e){} if(!bq) bq=requestAnimationFrame(()=>{ bq=0; build(); viewer.scene.requestRender&&viewer.scene.requestRender(); }); }
function projectOff(){ if(!shaderOn) return; scene.preRender.removeEventListener(pre); S.api.getTilesets().forEach((t,i)=>{ t.customShader=savedShaders[i]; }); shaderOn=false; }
let quadVis=true, shown=true, projWanted=false;
function applyVis(){ const q=shown&&quadVis; if(prim) prim.show=q&&!(shown&&projWanted); ents.forEach(x=>x.show=q); }
async function applyShow(){ if(shown&&projWanted) await projectOn(); else projectOff(); applyVis(); }
function remove(){ projectOff(); if(prim) scene.primitives.remove(prim); prim=null; ents.forEach(e=>viewer.entities.remove(e)); ents.length=0; }
S.photo={adj:()=>A, setAdj:(o)=>{ Object.assign(A,o); adjChanged(); }, toggle:async(v)=>{ shown=(v===undefined)?!shown:v; await applyShow(); const el=document.querySelector('#ph-show'); if(el) el.checked=shown; return shown; }, remove, fly, setOpa, build, META, projectOn, projectOff, setProjOpa:(v)=>{projOpa=v;}, get shaders(){return shaders;}, setDist:(d)=>{dist=d; build();}};

S.photo.state=()=>({shown,projWanted,quadVis});
S.photo.fileDate=()=>{ const m=/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(META.name); return m? m[1]+'-'+m[2]+'-'+m[3]+' '+m[4]+':'+m[5]+':'+m[6] : ''; };
// 3D 좌표(ECEF) -> 원본 사진 픽셀. 카메라 뒤쪽이거나 사진 밖이면 null
S.photo.pixelOf=(p)=>{ const v=C.Cartesian3.subtract(p,camPos,new C.Cartesian3()); const z=C.Cartesian3.dot(v,dir); if(z<=1) return null; const x=C.Cartesian3.dot(v,right), y=C.Cartesian3.dot(v,up); const s=1+A.fov/100; const xn=x/z*s, yn=-y/z*s; const r2=xn*xn+yn*yn; const rad=1+k1*r2+k2*r2*r2+k3*r2*r2*r2; const xd=xn*rad+2*p1*xn*yn+p2*(r2+2*xn*xn), yd=yn*rad+p1*(r2+2*yn*yn)+2*p2*xn*yn; return {x:xd*fx+META.w/2+cxo, y:yd*fx+META.h/2+cyo}; };
S.photo.cropOriginal=(P3,o)=>{ o=o||{}; const px=P3.map(p=>S.photo.pixelOf(p)); if(px.some(q=>!q)) return null; const xs=px.map(q=>q.x), ys=px.map(q=>q.y); const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys); if(x1<0||y1<0||x0>META.w||y0>META.h) return null;
  const cx=(x0+x1)/2, cy=(y0+y1)/2; let w=Math.max(720,(x1-x0)*1.8), h=w*0.75; if(h<(y1-y0)*1.8){ h=(y1-y0)*1.8; w=h/0.75; } w=Math.min(w,META.w); h=Math.min(h,META.h); let rx=Math.min(Math.max(cx-w/2,0),META.w-w), ry=Math.min(Math.max(cy-h/2,0),META.h-h);
  const OWc=Math.min(960,Math.round(w)); const k=OWc/w; const cv=document.createElement('canvas'); cv.width=OWc; cv.height=Math.round(h*k); const g=cv.getContext('2d'); g.drawImage(bmp,rx,ry,w,h,0,0,cv.width,cv.height);
  const col=o.color||'#ff5252'; g.lineWidth=Math.max(2,cv.width/240); g.strokeStyle=col; g.fillStyle=col; const q=px.map(a=>[(a.x-rx)*k,(a.y-ry)*k]);
  if(o.type==='point'){ g.beginPath(); g.arc(q[0][0],q[0][1],cv.width/28,0,7); g.stroke(); g.beginPath(); g.moveTo(q[0][0]-cv.width/18,q[0][1]); g.lineTo(q[0][0]-cv.width/50,q[0][1]); g.moveTo(q[0][0]+cv.width/50,q[0][1]); g.lineTo(q[0][0]+cv.width/18,q[0][1]); g.moveTo(q[0][0],q[0][1]-cv.width/18); g.lineTo(q[0][0],q[0][1]-cv.width/50); g.moveTo(q[0][0],q[0][1]+cv.width/50); g.lineTo(q[0][0],q[0][1]+cv.width/18); g.stroke(); }
  else { g.beginPath(); q.forEach((a,i)=>i?g.lineTo(a[0],a[1]):g.moveTo(a[0],a[1])); if(o.type==='area') g.closePath(); g.stroke(); }
  return {url:cv.toDataURL('image/jpeg',0.88), px:px.map(a=>({x:Math.round(a.x),y:Math.round(a.y)})), region:[Math.round(rx),Math.round(ry),Math.round(w),Math.round(h)]}; };
let panelEl=null;
for(let i=S.features.length-1;i>=0;i--){ if(S.features[i].id==='photo'){ try{S.features[i].unmount&&S.features[i].unmount();}catch(e){} S.features.splice(i,1);} }
S.addFeature({id:'photo', icon:'📷', title:'사진', mount(panel){ panelEl=panel; panel.innerHTML='<div style="padding:12px;font-size:13px;line-height:1.55">'+
 '<label style="display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:8px;cursor:pointer;font-size:14px"><input id="ph-show" type="checkbox" checked style="width:18px;height:18px"> 사진 중첩 표시 (켜기/끄기)</label>'+
 '<div style="color:#c5cae9;font-size:12px;word-break:break-all">'+META.name+'</div>'+
 '<div style="font-size:12px;margin:6px 0;color:#9fa8da">DJI M3E · 위도 '+META.lat.toFixed(6)+' · 경도 '+META.lon.toFixed(6)+'<br>절대고도 '+META.alt+' m (상대 '+META.rel+' m)<br>방위 '+META.yaw+'° · 상하각 '+META.pitch+'° · 기울기 '+META.roll+'°<br>렌즈 왜곡 보정 적용</div>'+
 '<div class="sis-lbl" style="margin-top:8px">사진 투명도 <b id="ph-opv">60%</b></div><input id="ph-op" type="range" min="5" max="100" value="60" style="width:100%">'+
 '<div class="sis-lbl" style="margin-top:8px">카메라에서 사진 면까지 거리 <b id="ph-dv">120 m</b></div><input id="ph-d" type="range" min="10" max="400" value="120" style="width:100%">'+
 '<label style="display:block;margin-top:10px;font-size:13px;cursor:pointer"><input id="ph-proj" type="checkbox" style="vertical-align:middle"> 3D 모델 면 위에 완전히 중첩 (투영)</label>'+
 '<div class="sis-lbl" style="margin-top:6px">투영 진하기 <b id="ph-pov">85%</b></div><input id="ph-po" type="range" min="10" max="100" value="85" style="width:100%">'+
 '<label style="display:block;margin-top:8px;font-size:13px;cursor:pointer"><input id="ph-quad" type="checkbox" checked style="vertical-align:middle"> 공중 사진면(사각형) 표시</label>'+
 '<button class="sis-btn" id="ph-go" style="width:100%;margin-top:10px">📍 촬영 위치로 이동</button>'+
 '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #2a2f4a"><div style="font-weight:600;margin-bottom:2px">🎯 자동 맞춤 (이미지 매칭)</div><div style="font-size:11px;color:#9fa8da;margin-bottom:6px">사진 속성의 위치·방향에서 시작해, 사진과 3D 모델 화면에서 같은 지점을 찾아 위치와 방향을 자동으로 보정합니다. 완료 후 아래 미세 조정 값이 바뀝니다.</div>'+
 '<label style="display:block;font-size:13px;cursor:pointer"><input id="al-fov" type="checkbox" style="vertical-align:middle"> 화각(초점거리)도 함께 맞추기</label>'+
 '<button class="sis-btn" id="al-go" style="width:100%;margin-top:8px">🎯 자동 맞춤 실행</button>'+
 '<button class="sis-btn" id="al-undo" style="width:100%;margin-top:6px">↩ 맞춤 전 값으로 되돌리기</button>'+
 '<div id="al-st" style="font-size:12px;color:#c5cae9;margin-top:8px;line-height:1.5;word-break:keep-all"></div></div>'+
 '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #2a2f4a"><div style="font-weight:600;margin-bottom:2px">위치·방향 미세 조정</div><div style="font-size:11px;color:#9fa8da;margin-bottom:6px">촬영 위치에서 본 상태로 두고 조정하면 사진이 모델에 맞춰지는 것을 바로 볼 수 있습니다. 값은 사진별로 자동 저장됩니다.</div>'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>동(+)/서(−) 이동</span><span><input id="ad-e-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> m</span></div><input id="ad-e" type="range" min="-50" max="50" step="0.1" style="width:100%">'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>북(+)/남(−) 이동</span><span><input id="ad-n-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> m</span></div><input id="ad-n" type="range" min="-50" max="50" step="0.1" style="width:100%">'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>고도 보정 (위+/아래−)</span><span><input id="ad-u-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> m</span></div><input id="ad-u" type="range" min="-60" max="60" step="0.1" style="width:100%">'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>방위 (오른쪽 회전 +)</span><span><input id="ad-yaw-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> °</span></div><input id="ad-yaw" type="range" min="-15" max="15" step="0.1" style="width:100%">'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>상하 각도 (위로 +)</span><span><input id="ad-pitch-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> °</span></div><input id="ad-pitch" type="range" min="-15" max="15" step="0.1" style="width:100%">'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>기울기 (시계 방향 +)</span><span><input id="ad-roll-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> °</span></div><input id="ad-roll" type="range" min="-15" max="15" step="0.1" style="width:100%">'+
'<div class="sis-lbl" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>화각 배율 (확대 +)</span><span><input id="ad-fov-n" type="number" step="0.1" style="width:64px;background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;text-align:right"> %</span></div><input id="ad-fov" type="range" min="-10" max="10" step="0.1" style="width:100%">'+
 '<button class="sis-btn" id="ad-reset" style="width:100%;margin-top:10px">조정값 초기화</button>'+
 '<div id="ad-sum" style="font-size:11px;color:#9fa8da;margin-top:8px;line-height:1.5"></div></div>'+
 '</div>';
 panel.querySelector('#ph-op').oninput=(e)=>{ panel.querySelector('#ph-opv').textContent=e.target.value+'%'; setOpa(e.target.value/100); };
 panel.querySelector('#ph-d').oninput=(e)=>{ panel.querySelector('#ph-dv').textContent=e.target.value+' m'; dist=+e.target.value; build(); };
 panel.querySelector('#ph-show').checked=shown; panel.querySelector('#ph-proj').checked=projWanted; panel.querySelector('#ph-quad').checked=quadVis;
 panel.querySelector('#ph-show').onchange=async(e)=>{ shown=e.target.checked; await applyShow(); };
 panel.querySelector('#ph-proj').onchange=async(e)=>{ projWanted=e.target.checked; await applyShow(); };
 panel.querySelector('#ph-po').oninput=(e)=>{ panel.querySelector('#ph-pov').textContent=e.target.value+'%'; projOpa=e.target.value/100; };
 panel.querySelector('#ph-quad').onchange=(e)=>{ quadVis=e.target.checked; applyVis(); };
 panel.querySelector('#ph-go').onclick=fly;
 const keys=['e','n','u','yaw','pitch','roll','fov'];
 const sum=()=>{ const el=panel.querySelector('#ad-sum'); const ll=C.Cartographic.fromCartesian(camPos); el.innerHTML='조정 후 위치: 경도 '+C.Math.toDegrees(ll.longitude).toFixed(7)+' · 위도 '+C.Math.toDegrees(ll.latitude).toFixed(7)+' · 높이 '+ll.height.toFixed(2)+' m<br>조정 후 방향: 방위 '+(META.yaw+A.yaw).toFixed(2)+'° · 상하 '+(META.pitch+A.pitch).toFixed(2)+'° · 기울기 '+(META.roll+A.roll).toFixed(2)+'°'; };
 const sync=()=>{ keys.forEach(k=>{ panel.querySelector('#ad-'+k).value=A[k]; panel.querySelector('#ad-'+k+'-n').value=(+A[k]).toFixed(1); }); sum(); };
 keys.forEach(k=>{ const r=panel.querySelector('#ad-'+k), n=panel.querySelector('#ad-'+k+'-n');
  r.oninput=()=>{ A[k]=+r.value; n.value=(+r.value).toFixed(1); adjChanged(); sum(); };
  n.onchange=()=>{ let v=parseFloat(n.value); if(!isFinite(v)) v=0; A[k]=v; r.value=v; n.value=v.toFixed(1); adjChanged(); sum(); }; });
 panel.querySelector('#ad-reset').onclick=()=>{ A=Object.assign({},A0); adjChanged(); sync(); };
 syncFn=sync; sync();
 panel.querySelector('#al-go').onclick=()=>autoAlign({fitFov:panel.querySelector('#al-fov').checked});
 panel.querySelector('#al-undo').onclick=()=>{ if(!undoAlign()) panel.querySelector('#al-st').textContent='되돌릴 이전 값이 없습니다.'; };

 }, unmount(){} });

// ===== 자동 맞춤 (이미지 매칭) =====
let alWorker=null, alLast=null, syncFn=null;
const CVURL='https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js';
const WSRC=String.raw`
let cvr=null;
self.onmessage=async(e)=>{ const d=e.data;
 try{
  if(d.type==='init'){ importScripts(d.url); let c=self.cv; if(typeof c==='function') c=c(); const t=Date.now(); while(!(c&&c.Mat)&&Date.now()-t<90000) await new Promise(r=>setTimeout(r,100)); cvr=c; postMessage({type:'ready',ok:!!(c&&c.Mat)}); }
  else if(d.type==='match'){ const cv=cvr, W=d.w, H=d.h;
   const m1=new cv.Mat(H,W,cv.CV_8UC1), m2=new cv.Mat(H,W,cv.CV_8UC1); m1.data.set(d.a); m2.data.set(d.b);
   const mk=new cv.Mat(); const ak=new cv.AKAZE();
   const k1=new cv.KeyPointVector(), k2=new cv.KeyPointVector(), d1=new cv.Mat(), d2=new cv.Mat();
   ak.detectAndCompute(m1,mk,k1,d1); ak.detectAndCompute(m2,mk,k2,d2);
   const n1=k1.size(), n2=k2.size(); const out=[]; 
   if(n1>5&&n2>5){ const bf=new cv.BFMatcher(cv.NORM_HAMMING,false); const mm=new cv.DMatchVectorVector(); bf.knnMatch(d1,d2,mm,2);
    for(let i=0;i<mm.size();i++){ const v=mm.get(i); if(v.size()<2) continue; const a=v.get(0), b=v.get(1); if(a.distance<d.ratio*b.distance){ const p=k1.get(a.queryIdx).pt, q=k2.get(a.trainIdx).pt; out.push(p.x,p.y,q.x,q.y,a.distance); } }
    mm.delete(); bf.delete(); }
   m1.delete(); m2.delete(); mk.delete(); ak.delete(); k1.delete(); k2.delete(); d1.delete(); d2.delete();
   postMessage({type:'match',n1,n2,pairs:new Float32Array(out)}); }
 }catch(err){ postMessage({type:'err',msg:String(err&&err.message||err)}); } };
`;
function getWorker(st){ if(alWorker) return Promise.resolve(alWorker);
 return new Promise((res,rej)=>{ st('이미지 매칭 라이브러리(OpenCV) 불러오는 중... 처음 한 번만 걸립니다');
  let w; try{ w=new Worker(URL.createObjectURL(new Blob([WSRC],{type:'text/javascript'}))); }catch(e){ rej(new Error('작업 프로세스를 만들 수 없습니다: '+e.message)); return; }
  const to=setTimeout(()=>{ rej(new Error('OpenCV 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')); },100000);
  w.onmessage=(e)=>{ if(e.data.type==='ready'){ clearTimeout(to); if(e.data.ok){ alWorker=w; res(w);} else rej(new Error('OpenCV 초기화에 실패했습니다.')); } else if(e.data.type==='err'){ clearTimeout(to); rej(new Error('OpenCV 오류: '+e.data.msg)); } };
  w.onerror=(e)=>{ clearTimeout(to); rej(new Error('OpenCV 로딩 오류: '+(e.message||'알 수 없음'))); };
  w.postMessage({type:'init',url:CVURL}); }); }
function workerMatch(w,W,H,a,b,ratio){ return new Promise((res,rej)=>{ const h=(e)=>{ if(e.data.type==='match'){ w.removeEventListener('message',h); res(e.data); } else if(e.data.type==='err'){ w.removeEventListener('message',h); rej(new Error('OpenCV 오류: '+e.data.msg)); } }; w.addEventListener('message',h); w.postMessage({type:'match',w:W,h:H,a,b,ratio},[a.buffer,b.buffer]); }); }
async function waitTiles(ms){ const t0=Date.now(); let ok=0; while(Date.now()-t0<ms){ scene.render(); const ts=S.api.getTilesets(); if(ts.every(t=>t.tilesLoaded)){ if(++ok>=4) return true; } else ok=0; await new Promise(r=>setTimeout(r,250)); } return false; }
function toGray(cv2){ const g=cv2.getContext('2d').getImageData(0,0,cv2.width,cv2.height).data; const o=new Uint8Array(cv2.width*cv2.height); for(let i=0;i<o.length;i++){ o[i]=(0.299*g[i*4]+0.587*g[i*4+1]+0.114*g[i*4+2])|0; } return o; }
const mmul=(A,B)=>A.map((r,i)=>B[0].map((_,j)=>r.reduce((s,_,k)=>s+A[i][k]*B[k][j],0)));
function rodr(w){ const th=Math.hypot(w[0],w[1],w[2]); if(th<1e-12) return [[1,0,0],[0,1,0],[0,0,1]]; const x=w[0]/th,y=w[1]/th,z=w[2]/th,c=Math.cos(th),s=Math.sin(th),t=1-c; return [[t*x*x+c,t*x*y-s*z,t*x*z+s*y],[t*x*y+s*z,t*y*y+c,t*y*z-s*x],[t*x*z-s*y,t*y*z+s*x,t*z*z+c]]; }
function projP(R,Cc,m,P){ const dx=P[0]-Cc[0],dy=P[1]-Cc[1],dz=P[2]-Cc[2]; const xc=R[0][0]*dx+R[0][1]*dy+R[0][2]*dz, yc=R[1][0]*dx+R[1][1]*dy+R[1][2]*dz, zc=R[2][0]*dx+R[2][1]*dy+R[2][2]*dz; return [OW/2+m*fo*xc/zc, OH/2+m*fo*yc/zc, zc]; }
function solveLin(M,b){ const n=b.length; const a=M.map((r,i)=>[...r,b[i]]); for(let i=0;i<n;i++){ let p=i; for(let k=i+1;k<n;k++) if(Math.abs(a[k][i])>Math.abs(a[p][i])) p=k; [a[i],a[p]]=[a[p],a[i]]; if(Math.abs(a[i][i])<1e-12) return null; for(let k=i+1;k<n;k++){ const f=a[k][i]/a[i][i]; for(let j=i;j<=n;j++) a[k][j]-=f*a[i][j]; } } const x=new Array(n); for(let i=n-1;i>=0;i--){ let s=a[i][n]; for(let j=i+1;j<n;j++) s-=a[i][j]*x[j]; x[i]=s/a[i][i]; } return x; }
function solvePose(obs,X,R0,C0,m0,fitM){ let R=R0.map(r=>r.slice()), Cc=C0.slice(), m=m0; const n=X.length, np=fitM?7:6;
 const res=(R,Cc,m)=>{ const e=new Float64Array(2*n); for(let i=0;i<n;i++){ const p=projP(R,Cc,m,X[i]); e[2*i]=p[0]-obs[i][0]; e[2*i+1]=p[1]-obs[i][1]; } return e; };
 const upd=(R,Cc,m,d)=>[mmul(rodr([d[0],d[1],d[2]]),R),[Cc[0]+d[3],Cc[1]+d[4],Cc[2]+d[5]],fitM?m*Math.exp(d[6]):m];
 let lam=1e-3; const steps=[1e-4,1e-4,1e-4,1e-2,1e-2,1e-2,1e-3]; const ei=res(R,Cc,m); const rn0=[]; for(let i=0;i<n;i++) rn0.push(Math.hypot(ei[2*i],ei[2*i+1])); const c0=Math.max(30,2.5*[...rn0].sort((a,b)=>a-b)[n>>1]);
 for(let it=0;it<30;it++){ const c=Math.max(3,c0*Math.pow(0.82,it)); const e0=res(R,Cc,m); const w=new Float64Array(n); for(let i=0;i<n;i++){ const r=Math.hypot(e0[2*i],e0[2*i+1]); const q=r/c; w[i]=q<1?(1-q*q)*(1-q*q):0; }
  const J=[]; for(let k=0;k<np;k++){ const d=new Array(7).fill(0); d[k]=steps[k]; const s=upd(R,Cc,m,d); const e1=res(s[0],s[1],s[2]); const col=new Float64Array(2*n); for(let i=0;i<2*n;i++) col[i]=(e1[i]-e0[i])/steps[k]; J.push(col); }
  const H=[],g=[]; for(let a=0;a<np;a++){ H.push(new Array(np).fill(0)); g.push(0); for(let i=0;i<n;i++){ if(!w[i]) continue; g[a]+=w[i]*(J[a][2*i]*e0[2*i]+J[a][2*i+1]*e0[2*i+1]); } }
  for(let a=0;a<np;a++) for(let b=0;b<np;b++){ let s=0; for(let i=0;i<n;i++){ if(!w[i]) continue; s+=w[i]*(J[a][2*i]*J[b][2*i]+J[a][2*i+1]*J[b][2*i+1]); } H[a][b]=s; }
  for(let a=0;a<np;a++) H[a][a]*=(1+lam); const dx=solveLin(H,g.map(v=>-v)); if(!dx) break;
  const sc=Math.max(1, Math.hypot(dx[0],dx[1],dx[2])/0.05, Math.hypot(dx[3],dx[4],dx[5])/10); const dd=dx.map(v=>v/sc); while(dd.length<7) dd.push(0);
  [R,Cc,m]=upd(R,Cc,m,dd); if(it>8 && Math.hypot(dd[3],dd[4],dd[5])<1e-3 && Math.hypot(dd[0],dd[1],dd[2])<1e-6) break; }
 const e=res(R,Cc,m); const rr=[]; for(let i=0;i<n;i++) rr.push(Math.hypot(e[2*i],e[2*i+1])); return {R,C:Cc,m,rr}; }
const med=(a)=>{ const s=[...a].sort((x,y)=>x-y); return s.length? s[s.length>>1]:NaN; };
async function autoAlign(opts){ opts=opts||{}; const st=(m)=>{ const el=panelEl&&panelEl.querySelector('#al-st'); if(el) el.textContent=m; };
 const btn=panelEl&&panelEl.querySelector('#al-go'); if(btn) btn.disabled=true;
 const prev=Object.assign({},A), wasShown=shown, entShow=viewer.entities.show, oldRS=viewer.resolutionScale, t00=Date.now();
 const log=[]; let result=null;
 try{
  const w=await getWorker(st);
  shown=false; await applyShow(); viewer.entities.show=false;
  const inv=C.Matrix4.inverseTransformation(fr0,new C.Matrix4());
  const toE=(v)=>{ const r=C.Matrix4.multiplyByPointAsVector(inv,v,new C.Cartesian3()); return [r.x,r.y,r.z]; };
  const toEp=(p)=>{ const r=C.Matrix4.multiplyByPoint(inv,p,new C.Cartesian3()); return [r.x,r.y,r.z]; };
  let finalRR=null, firstRR=null, nIn=0, nAll=0, depthMed=0;
  for(let it=0; it<(opts.iters||3); it++){
   st('('+(it+1)+'/3) 촬영 위치에서 모델 화면 만드는 중... (상세 타일을 불러옵니다)');
   fly(); viewer.resolutionScale=opts.scale||1.5; viewer.resize(); await waitTiles(40000);
   scene.render(); const W=viewer.canvas.width, H=viewer.canvas.height;
   const c1=document.createElement('canvas'); c1.width=W; c1.height=H; c1.getContext('2d').drawImage(viewer.canvas,0,0);
   const P=viewer.camera.frustum.projectionMatrix; const fxr=W/2*P[0]; const kk=fxr/fo;
   const c2=document.createElement('canvas'); c2.width=W; c2.height=H; const g2=c2.getContext('2d'); g2.fillStyle='#000'; g2.fillRect(0,0,W,H); g2.drawImage(out,W/2-OW/2*kk,H/2-OH/2*kk,OW*kk,OH*kk);
   alLast={render:c1.toDataURL('image/jpeg',0.8), photo:c2.toDataURL('image/jpeg',0.8)};
   st('('+(it+1)+'/3) 사진과 모델에서 같은 지점 찾는 중...');
   const mt=await workerMatch(w,W,H,toGray(c1),toGray(c2),opts.ratio||0.8);
   const pr=mt.pairs; const cw=viewer.canvas.clientWidth, ch=viewer.canvas.clientHeight; let cand=[];
   for(let i=0;i<pr.length;i+=5){ const qx=pr[i+2],qy=pr[i+3]; const uo=OW/2+(qx-W/2)/kk, vo=OH/2+(qy-H/2)/kk; if(uo<10||vo<10||uo>OW-10||vo>OH-10) continue; cand.push({px:pr[i],py:pr[i+1],uo,vo}); }
   // 변위 일관성 필터 (주변 점과 비슷하게 움직이는 쌍만)
   const keep=[]; for(let i=0;i<cand.length;i++){ const a=cand[i]; const nb=cand.map((b,j)=>({j,d:Math.hypot(a.px-b.px,a.py-b.py)})).sort((x,y)=>x.d-y.d).slice(1,13); if(nb.length<4){ continue; } const ddx=nb.map(o=>(cand[o.j].uo-OW/2)*kk+W/2-cand[o.j].px), ddy=nb.map(o=>(cand[o.j].vo-OH/2)*kk+H/2-cand[o.j].py); const mx=med(ddx), my=med(ddy); const mine_x=(a.uo-OW/2)*kk+W/2-a.px, mine_y=(a.vo-OH/2)*kk+H/2-a.py; if(Math.hypot(mine_x-mx,mine_y-my)<Math.max(6,0.012*W)) keep.push(a); }
   st('('+(it+1)+'/3) 모델 표면의 3차원 좌표 읽는 중... (매칭 '+cand.length+'쌍 중 '+keep.length+'쌍 사용)');
   scene.render(); const obs=[],X=[]; const ds=[];
   for(const a of keep){ const wp=new C.Cartesian2(a.px/W*cw,a.py/H*ch); const p3=scene.pickPosition(wp); if(!p3||!isFinite(p3.x)) continue; const pe=toEp(p3); obs.push([a.uo,a.vo]); X.push(pe); }
   nAll=cand.length; if(X.length<12) throw new Error('맞는 점이 너무 적습니다 ('+X.length+'쌍). 사진과 모델이 많이 달라 자동 맞춤을 할 수 없습니다. 수동 조정을 이용해 주세요.');
   const Ri=toE(right), Ui=toE(up), Di=toE(dir); const R0=[Ri,[-Ui[0],-Ui[1],-Ui[2]],Di]; const C0=[A.e,A.n,A.u]; const m0=1+A.fov/100;
   const sol=solvePose(obs,X,R0,C0,m0,!!opts.fitFov);
   const rr0=X.map((p,i)=>{ const q=projP(R0,C0,m0,p); return Math.hypot(q[0]-obs[i][0],q[1]-obs[i][1]); });
   const inl=sol.rr.map((v,i)=>v<4?i:-1).filter(i=>i>=0); alLast.dbg={it,n1:mt.n1,n2:mt.n2,pairs:pr.length/5,cand:cand.length,keep:keep.length,used:X.length,med0:med(rr0),medSol:med(sol.rr),inl:inl.length,solC:sol.C,solM:sol.m,C0,sample:obs.slice(0,3),X3:X.slice(0,3)};
   if(inl.length<10) throw new Error('결과가 안정적이지 않습니다 (신뢰 점 '+inl.length+'개). 자동 맞춤을 적용하지 않았습니다. 수동 조정을 이용해 주세요.');
   if(it===0) firstRR=inl.map(i=>rr0[i]);
   const dist=sol.R?inl.map(i=>{ const d=projP(sol.R,sol.C,sol.m,X[i]); return d[2]; }):[]; depthMed=med(dist);
   // 조정값으로 변환
   const dirE=C.Matrix4.multiplyByPointAsVector(fr0,new C.Cartesian3(...sol.R[2]),new C.Cartesian3());
   const upE=C.Matrix4.multiplyByPointAsVector(fr0,new C.Cartesian3(-sol.R[1][0],-sol.R[1][1],-sol.R[1][2]),new C.Cartesian3());
   const pos=C.Matrix4.multiplyByPoint(fr0,new C.Cartesian3(...sol.C),new C.Cartesian3());
   tmp.setView({destination:pos,orientation:{direction:dirE,up:upE}});
   const wrap=(x)=>((x+540)%360)-180; const nA={e:sol.C[0],n:sol.C[1],u:sol.C[2],yaw:wrap(C.Math.toDegrees(tmp.heading)-META.yaw),pitch:C.Math.toDegrees(tmp.pitch)-META.pitch,roll:wrap(C.Math.toDegrees(tmp.roll)-META.roll),fov:(sol.m-1)*100};
   const dpos=Math.hypot(nA.e-A.e,nA.n-A.n,nA.u-A.u), dang=Math.max(Math.abs(nA.yaw-A.yaw),Math.abs(nA.pitch-A.pitch),Math.abs(nA.roll-A.roll));
   log.push({it:it+1,cand:cand.length,used:X.length,inl:inl.length,rmsBefore:Math.sqrt(inl.reduce((s,i)=>s+rr0[i]*rr0[i],0)/inl.length),rmsAfter:Math.sqrt(inl.reduce((s,i)=>s+sol.rr[i]*sol.rr[i],0)/inl.length),dpos,dang,nA});
   nIn=inl.length; finalRR=inl.map(i=>sol.rr[i]);
   if(opts.fitFov===false || !opts.fitFov){ nA.fov=A.fov; }
   Object.assign(A,nA); recompute();
   if(dpos<0.15 && dang<0.03) break;
  }
  // 최종 반영
  try{ localStorage.setItem(AKEY,JSON.stringify(A)); }catch(e){}
  result={prev, now:Object.assign({},A), log, firstMed:med(firstRR), finalMed:med(finalRR), nIn, depthMed, sec:(Date.now()-t00)/1000};
  alLast.result=result; alLast.prev=prev;
  const ms=(px)=>px*depthMed/(fo*(1+A.fov/100));
  st('완료: '+result.sec.toFixed(1)+'초 · 신뢰 점 '+nIn+'개 · 중간 오차 '+result.firstMed.toFixed(1)+'px → '+result.finalMed.toFixed(1)+'px (약 '+ms(result.firstMed).toFixed(2)+' m → '+ms(result.finalMed).toFixed(2)+' m)');
 }catch(err){ Object.assign(A,prev); recompute(); st('실패: '+err.message); log.push({err:err.message}); result={err:err.message,log}; }
 finally{ viewer.resolutionScale=oldRS; viewer.resize(); viewer.entities.show=entShow; shown=wasShown; adjChanged(); await applyShow(); if(syncFn) syncFn(); fly(); if(btn) btn.disabled=false; }
 return result; }
function undoAlign(){ if(!alLast||!alLast.prev) return false; Object.assign(A,alLast.prev); adjChanged(); if(syncFn) syncFn(); const el=panelEl&&panelEl.querySelector('#al-st'); if(el) el.textContent='맞춤 전 값으로 되돌렸습니다.'; return true; }
S.photo.autoAlign=autoAlign; S.photo.undoAlign=undoAlign; S.photo.alignDebug=()=>alLast;

build(); fly();
})()