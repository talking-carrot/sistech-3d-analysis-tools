(async()=>{
const S=window.SisMenu, C=S.C||window.Cesium, viewer=S.viewer, scene=viewer.scene;
if (S.photo && S.photo.remove) S.photo.remove();
const rad=(d)=>C.Math.toRadians(d), sleep0=()=>new Promise(r=>setTimeout(r,20));
let panelEl=null;
const say=(m)=>{ const el=panelEl&&panelEl.querySelector('#ph-ls'); if(el) el.textContent=m; };
const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LIB=[]; let ACT=null, actTok=0;
const A0={e:0,n:0,u:0,yaw:0,pitch:0,roll:0,fov:0};
let META=null,bmp=null,out=null,OW=1600,OH=1200,fo=1,fx=1,k1=0,k2=0,p1=0,p2=0,k3=0,cxo=0,cyo=0,fr0=null,AKEY='',A=Object.assign({},A0);
let camPos=null,hpr=null,dir=null,up=null,right=null,tu=0.5,tv=0.4;
const tmp=new C.Camera(scene);

// ===== 사진 목록 저장 (IndexedDB: 사진 정보와 미리보기만 저장, 사진 파일 자체는 저장하지 않음) =====
const idb=()=>new Promise((res,rej)=>{ const r=indexedDB.open('sisPhotoLib',1); r.onupgradeneeded=()=>r.result.createObjectStore('k'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
async function dbGet(k){ try{ const d=await idb(); return await new Promise((res)=>{ const q=d.transaction('k').objectStore('k').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null); }); }catch(e){ return null; } }
async function dbSet(k,v){ try{ const d=await idb(); return await new Promise((res)=>{ const t=d.transaction('k','readwrite'); t.objectStore('k').put(v,k); t.oncomplete=()=>res(true); t.onerror=()=>res(false); }); }catch(e){ return false; } }
let saveT=null; const saveLib=()=>{ clearTimeout(saveT); saveT=setTimeout(()=>dbSet('lib',LIB.map(r=>({id:r.id,meta:r.meta,thumb:r.thumb,align:r.align}))),300); };

// ===== 사진 정보(EXIF/XMP) 읽기 =====
function parseExif(dv,t){
 const le=dv.getUint16(t)===0x4949; const g16=(o)=>dv.getUint16(o,le), g32=(o)=>dv.getUint32(o,le);
 const SZ=[0,1,1,2,4,8,1,1,2,4,8,4,8];
 const val=(typ,cnt,vo)=>{ if(typ===2){ let s=''; for(let k=0;k<cnt;k++){ const c=dv.getUint8(vo+k); if(!c) break; s+=String.fromCharCode(c); } return s; } const a=[]; for(let i=0;i<cnt&&i<64;i++){ if(typ===3) a.push(g16(vo+i*2)); else if(typ===4) a.push(g32(vo+i*4)); else if(typ===1||typ===7) a.push(dv.getUint8(vo+i)); else if(typ===5){ const d=g32(vo+i*8+4); a.push(d? g32(vo+i*8)/d : 0); } else return null; } return cnt===1?a[0]:a; };
 const rd=(off)=>{ const tags={}; const n=g16(t+off); for(let i=0;i<n;i++){ const e=t+off+2+i*12; if(e+12>dv.byteLength) break; const tag=g16(e), typ=g16(e+2), cnt=g32(e+4); const sz=(SZ[typ]||1)*cnt; const vo=sz<=4? e+8 : t+g32(e+8); if(vo+sz>dv.byteLength) continue; tags[tag]=val(typ,cnt,vo); } const nx=t+off+2+n*12; tags.__next=(nx+4<=dv.byteLength)? g32(nx):0; return tags; };
 const i0=rd(g32(t+4)); const ex=i0[0x8769]!=null? rd(i0[0x8769]):{}; const gp=i0[0x8825]!=null? rd(i0[0x8825]):{};
 let thumb=null; if(i0.__next){ try{ const i1=rd(i0.__next); if(i1[0x201]&&i1[0x202]) thumb=[t+i1[0x201],i1[0x202]]; }catch(e){} }
 return {i0,ex,gp,thumb};
}
async function readMeta(file){
 const buf=await file.slice(0,786432).arrayBuffer(); const dv=new DataView(buf);
 if(dv.byteLength<4||dv.getUint16(0)!==0xFFD8) throw new Error('JPEG 사진이 아닙니다');
 let off=2, ex=null, xmp='', w=0, h=0; const dec=new TextDecoder('latin1');
 while(off+4<=dv.byteLength){ if(dv.getUint8(off)!==0xFF){ off++; continue; } const mk=dv.getUint8(off+1); if(mk===0xFF){ off++; continue; } if(mk===0xD8||mk===0x01||(mk>=0xD0&&mk<=0xD7)){ off+=2; continue; } const len=dv.getUint16(off+2);
  if(mk===0xE1){ const hd=dec.decode(new Uint8Array(buf,off+4,Math.min(32,len-2)));
   if(hd.startsWith('Exif\0\0')){ try{ ex=parseExif(dv,off+10); ex.base=off+10; }catch(e){} }
   else if(hd.startsWith('http://ns.adobe.com/xap/1.0/')){ xmp+=new TextDecoder().decode(new Uint8Array(buf,off+4+29,Math.max(0,len-2-29))); } }
  else if(mk===0xC0||mk===0xC1||mk===0xC2){ h=dv.getUint16(off+5); w=dv.getUint16(off+7); break; }
  else if(mk===0xDA) break;
  off+=2+len; }
 const xa=(k)=>{ let m=new RegExp('drone-dji:'+k+'\\s*=\\s*"([^"]*)"').exec(xmp); if(!m) m=new RegExp('<drone-dji:'+k+'>([^<]*)<').exec(xmp); return m? m[1]:null; };
 const xn=(k)=>{ const v=xa(k); if(v==null) return null; const f=parseFloat(v); return isFinite(f)? f:null; };
 const i0=ex?ex.i0:{}, e2=ex?ex.ex:{}, gp=ex?ex.gp:{}; const warns=[]; const dms=(a)=>a[0]+a[1]/60+a[2]/3600;
 let lat=xn('GpsLatitude'), lon=xn('GpsLongitude'); if(lon==null) lon=xn('GpsLongtitude');
 if(lat==null||lon==null){ if(Array.isArray(gp[2])&&Array.isArray(gp[4])){ lat=dms(gp[2])*(gp[1]==='S'?-1:1); lon=dms(gp[4])*(gp[3]==='W'?-1:1); } }
 if(lat==null||lon==null||!isFinite(lat)||!isFinite(lon)) throw new Error('촬영 위치(GPS) 정보가 없어 3D 모델 위에 놓을 수 없습니다');
 let alt=xn('AbsoluteAltitude'); if(alt==null&&gp[6]!=null&&isFinite(gp[6])) alt=gp[6]*(gp[5]===1?-1:1);
 if(alt==null){ alt=0; warns.push('고도 정보가 없어 0 m로 두었습니다. 고도 보정이 필요합니다.'); }
 let yaw=xn('GimbalYawDegree'); if(yaw==null) yaw=xn('FlightYawDegree'); let pitch=xn('GimbalPitchDegree'), roll=xn('GimbalRollDegree'); let poseOk=true;
 if(yaw==null||pitch==null){ poseOk=false; warns.push('카메라 방향 정보가 없어 수직 아래 방향으로 가정했습니다. 미세 조정이 필요합니다.'); if(yaw==null) yaw=0; if(pitch==null) pitch=-90; } if(roll==null) roll=0;
 if(!w||!h){ w=e2[0xA002]||0; h=e2[0xA003]||0; } if(!w||!h) throw new Error('사진 크기를 읽을 수 없습니다');
 if(i0[0x112]&&i0[0x112]>1) warns.push('사진이 회전 저장된 파일(Orientation '+i0[0x112]+')이라 방향이 어긋날 수 있습니다.');
 let f=xn('CalibratedFocalLength'); const f35=e2[0xA405]; if(!(f>0)){ if(f35>0){ f=f35/36*Math.max(w,h); warns.push('정확한 초점거리가 없어 35mm 환산값으로 계산했습니다.'); } else { f=0.8*Math.max(w,h); warns.push('초점거리 정보가 없어 임의 값을 썼습니다. 화각 맞춤이 필요합니다.'); } }
 const cx=xn('CalibratedOpticalCenterX')??w/2, cy=xn('CalibratedOpticalCenterY')??h/2;
 const flag=xn('DewarpFlag'), dd=xa('DewarpData'); let dist={fx:f,k1:0,k2:0,p1:0,p2:0,k3:0,cxo:0,cyo:0}; let lens='왜곡 정보 없음';
 if(dd&&flag!==1){ const arr=dd.split(';').pop().split(',').map(parseFloat); if(arr.length>=9&&arr.every(isFinite)){ dist={fx:arr[0],k1:arr[4],k2:arr[5],p1:arr[6],p2:arr[7],k3:arr[8],cxo:arr[2],cyo:arr[3]}; lens='렌즈 왜곡 보정 적용'; } } else if(flag===1) lens='이미 왜곡 보정된 사진';
 let date=''; const dt=e2[0x9003]||e2[0x9004]; if(typeof dt==='string'&&dt.length>=19) date=dt.slice(0,4)+'-'+dt.slice(5,7)+'-'+dt.slice(8,10)+' '+dt.slice(11,19);
 else { const m=/(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/.exec(file.name); if(m) date=m[1]+'-'+m[2]+'-'+m[3]+' '+m[4]+':'+m[5]+':'+m[6]; }
 const meta={name:file.name,size:file.size,lon,lat,alt,rel:xn('RelativeAltitude'),yaw,pitch,roll,f,w,h,cx,cy,dist,lens,date,make:(typeof i0[0x10F]==='string'?i0[0x10F]:''),model:(typeof i0[0x110]==='string'?i0[0x110]:''),poseOk,warns};
 let thumbBlob=null; if(ex&&ex.thumb&&ex.thumb[0]+ex.thumb[1]<=buf.byteLength){ thumbBlob=new Blob([buf.slice(ex.thumb[0],ex.thumb[0]+ex.thumb[1])],{type:'image/jpeg'}); }
 return {meta,thumbBlob};
}
const b2d=(b)=>new Promise((res)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>res(''); r.readAsDataURL(b); });
async function makeThumb(file){ try{ const bm=await createImageBitmap(file,{resizeWidth:160,resizeQuality:'low'}); const c=document.createElement('canvas'); c.width=bm.width; c.height=bm.height; c.getContext('2d').drawImage(bm,0,0); bm.close(); return c.toDataURL('image/jpeg',0.6); }catch(e){ return ''; } }

// ===== 사진별 조정값, 카메라 자세 =====
const loadAdj=(name)=>{ let a=Object.assign({},A0); try{ Object.assign(a,JSON.parse(localStorage.getItem('sisPhotoAdj:'+name)||'{}')); }catch(e){} return a; };
const getAdj=(rec)=>rec===ACT? A : (rec.adj||(rec.adj=loadAdj(rec.meta.name)));
function poseRec(rec){ if(rec===ACT) return {pos:camPos,dir,up,right,s:1+A.fov/100};
 const a=getAdj(rec), key=JSON.stringify(a); if(rec._pose&&rec._pk===key) return rec._pose; const m=rec.meta;
 const fr=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(m.lon,m.lat,m.alt)); const pos=C.Matrix4.multiplyByPoint(fr,new C.Cartesian3(a.e,a.n,a.u),new C.Cartesian3());
 tmp.setView({destination:pos,orientation:{heading:rad(m.yaw+a.yaw),pitch:rad(m.pitch+a.pitch),roll:rad(m.roll+a.roll)}});
 rec._pose={pos,dir:C.Cartesian3.clone(tmp.directionWC),up:C.Cartesian3.clone(tmp.upWC),right:C.Cartesian3.clone(tmp.rightWC),s:1+a.fov/100}; rec._pk=key; return rec._pose; }
// 3D 좌표(ECEF) -> 그 사진의 원본 픽셀. 카메라 뒤쪽이면 null
function pixelRec(rec,p){ const ps=poseRec(rec), m=rec.meta, d=m.dist||{}; const v=C.Cartesian3.subtract(p,ps.pos,new C.Cartesian3()); const z=C.Cartesian3.dot(v,ps.dir); if(z<=1) return null;
 const x=C.Cartesian3.dot(v,ps.right), y=C.Cartesian3.dot(v,ps.up); const xn=x/z*ps.s, yn=-y/z*ps.s; const r2=xn*xn+yn*yn; const K1=d.k1||0,K2=d.k2||0,K3=d.k3||0,P1=d.p1||0,P2=d.p2||0;
 const rad_=1+K1*r2+K2*r2*r2+K3*r2*r2*r2; const xd=xn*rad_+2*P1*xn*yn+P2*(r2+2*xn*xn), yd=yn*rad_+P1*(r2+2*yn*yn)+2*P2*xn*yn; const FX=d.fx||m.f;
 return {x:xd*FX+m.w/2+(d.cxo||0), y:yd*FX+m.h/2+(d.cyo||0), z}; }
// 주어진 3D 점들이 모두 찍힌 사진을 가까운 순(+화면 가장자리 감점)으로 찾기. 가려짐(다른 물체 뒤)은 따지지 않음
function bestFor(P3,o){ o=o||{}; const res=[]; const mg=(o.margin==null)?0.02:o.margin;
 for(const rec of LIB){ if(!rec.meta||(o.needFile&&!rec.file)) continue; const px=P3.map(p=>pixelRec(rec,p)); if(px.some(q=>!q)) continue; const m=rec.meta;
  if(px.some(q=>q.x<m.w*mg||q.y<m.h*mg||q.x>m.w*(1-mg)||q.y>m.h*(1-mg))) continue;
  const c=[px.reduce((s,q)=>s+q.x,0)/px.length, px.reduce((s,q)=>s+q.y,0)/px.length]; const offc=Math.max(Math.abs(c[0]/m.w-0.5),Math.abs(c[1]/m.h-0.5))*2;
  const d3=C.Cartesian3.distance(poseRec(rec).pos,P3[0]); res.push({rec,px,d:d3,cost:d3*(1+offc)}); }
 res.sort((a,b)=>a.cost-b.cost); return res; }

const tmpFrame=()=>fr0;
function recompute(){ if(!META) return;
 camPos=C.Matrix4.multiplyByPoint(fr0,new C.Cartesian3(A.e,A.n,A.u),new C.Cartesian3());
 hpr=new C.HeadingPitchRoll(C.Math.toRadians(META.yaw+A.yaw),C.Math.toRadians(META.pitch+A.pitch),C.Math.toRadians(META.roll+A.roll));
 tmp.setView({destination:camPos, orientation:{heading:hpr.heading,pitch:hpr.pitch,roll:hpr.roll}});
 dir=C.Cartesian3.clone(tmp.directionWC); up=C.Cartesian3.clone(tmp.upWC); right=C.Cartesian3.clone(tmp.rightWC);
 const s=1+A.fov/100; tu=META.cx/META.f/s; tv=META.cy/META.f/s; }
function corners(D){ const c=(a,b)=>{ const v=C.Cartesian3.multiplyByScalar(dir,1,new C.Cartesian3()); C.Cartesian3.add(v,C.Cartesian3.multiplyByScalar(right,a*tu,new C.Cartesian3()),v); C.Cartesian3.add(v,C.Cartesian3.multiplyByScalar(up,b*tv,new C.Cartesian3()),v); C.Cartesian3.multiplyByScalar(v,D,v); return C.Cartesian3.add(camPos,v,new C.Cartesian3()); }; return [c(-1,-1),c(1,-1),c(1,1),c(-1,1)]; }
let prim=null, dist=120, opa=0.6;
const ents=[], camEnts=[]; let showAll=true;
function build(){ if(prim){ scene.primitives.remove(prim); prim=null; } ents.forEach(e=>viewer.entities.remove(e)); ents.length=0; if(!ACT){ return; } const P=corners(dist);
  const pos=new Float64Array(12); P.forEach((p,i)=>{pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;});
  const st=new Float32Array([0,0, 1,0, 1,1, 0,1]);
  const geom=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:pos}), st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:st})}, indices:new Uint16Array([0,1,2,0,2,3]), primitiveType:C.PrimitiveType.TRIANGLES, boundingSphere:C.BoundingSphere.fromPoints(P)});
  prim=new C.Primitive({geometryInstances:new C.GeometryInstance({geometry:geom}), appearance:new C.MaterialAppearance({material:new C.Material({fabric:{type:'Image',uniforms:{image:out, color:new C.Color(1,1,1,opa)}}}), translucent:true, faceCulling:false, flat:true}), asynchronous:false});
  scene.primitives.add(prim);
  ents.push(viewer.entities.add({position:camPos, point:{pixelSize:10,color:C.Color.fromCssColorString('#ffd54f'),outlineColor:C.Color.BLACK,outlineWidth:2,disableDepthTestDistance:1e9}}));
  P.forEach(p=>ents.push(viewer.entities.add({polyline:{positions:[camPos,p],width:1.5,material:C.Color.fromCssColorString('#ffd54f').withAlpha(0.8)}})));
  ents.push(viewer.entities.add({polyline:{positions:[...P,P[0]],width:2,material:C.Color.fromCssColorString('#ffd54f')}}));
 applyVis();
}
function setOpa(v){ opa=v; if(prim){ prim.appearance.material.uniforms.color=new C.Color(1,1,1,opa);} }
function fly(){ if(!ACT) return; const aspect=viewer.canvas.clientWidth/viewer.canvas.clientHeight; const hf=2*Math.atan(tu); viewer.camera.setView({destination:camPos, orientation:{heading:hpr.heading,pitch:hpr.pitch,roll:hpr.roll}}); viewer.camera.frustum.fov = aspect>=1? hf : 2*Math.atan(Math.tan(hf/2)/aspect); }
let shaderOn=false, pre=null, savedShaders=[], projOpa=0.85, minFacing=0.12, texUrl=null;
async function projectOn(){ if(shaderOn||!ACT) return; const tss=S.api.getTilesets(); if(!tss.length) return;
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
function applyVis(){ const q=shown&&quadVis; if(prim) prim.show=q&&!(shown&&projWanted); ents.forEach(x=>x.show=q); camEnts.forEach(x=>x.show=shown&&showAll); }
async function applyShow(){ if(shown&&projWanted) await projectOn(); else projectOff(); applyVis(); }

// ===== 사진 선택(활성화): 선택한 사진 한 장을 불러와 3D 위에 겹침 =====
async function activate(rec,o){ o=o||{};
 if(!rec||!rec.meta) return false;
 if(!rec.file){ say('"'+rec.meta.name+'" 파일이 연결돼 있지 않습니다. "폴더 선택"으로 사진이 있는 폴더를 다시 선택해 주세요.'); return false; }
 const tok=++actTok; say('사진 준비 중... '+rec.meta.name); await sleep0();
 let bm; try{ bm=await createImageBitmap(rec.file); }catch(e){ say('사진을 열 수 없습니다: '+e.message); return false; }
 if(tok!==actTok){ bm.close(); return false; }
 const wasProj=shaderOn; if(wasProj) projectOff(); if(texUrl){ URL.revokeObjectURL(texUrl); texUrl=null; }
 const m=rec.meta; if(bm.width!==m.w||bm.height!==m.h){ m.w=bm.width; m.h=bm.height; m.cx=m.w/2; m.cy=m.h/2; m.warns=(m.warns||[]).concat(['사진 크기가 정보와 달라 중심을 다시 계산했습니다.']); }
 if(bmp&&bmp.close){ try{ bmp.close(); }catch(e){} } bmp=bm; ACT=rec; META=m; OW=1600; OH=Math.round(OW*m.h/m.w);
 const d=m.dist||{}; fo=m.f*OW/m.w; fx=d.fx||m.f; k1=d.k1||0; k2=d.k2||0; p1=d.p1||0; p2=d.p2||0; k3=d.k3||0; cxo=d.cxo||0; cyo=d.cyo||0;
 const sc=Math.min(1,Math.max(0.25,2*OW/m.w)); const src=document.createElement('canvas'); src.width=Math.round(m.w*sc); src.height=Math.round(m.h*sc); const sg=src.getContext('2d'); sg.drawImage(bm,0,0,src.width,src.height); const sd=sg.getImageData(0,0,src.width,src.height);
 const oc=document.createElement('canvas'); oc.width=OW; oc.height=OH; const og=oc.getContext('2d'); const od=og.createImageData(OW,OH);
 for(let y=0;y<OH;y++) for(let x=0;x<OW;x++){ const xn=(x+0.5-OW/2)/fo, yn=(y+0.5-OH/2)/fo; const r2=xn*xn+yn*yn; const rad_=1+k1*r2+k2*r2*r2+k3*r2*r2*r2; const xd=xn*rad_+2*p1*xn*yn+p2*(r2+2*xn*xn), yd=yn*rad_+p1*(r2+2*yn*yn)+2*p2*xn*yn;
  const u=(xd*fx+m.w/2+cxo)*sc, v=(yd*fx+m.h/2+cyo)*sc; const oo=(y*OW+x)*4; if(u<0||v<0||u>=src.width-1||v>=src.height-1){ continue; }
  const iu=Math.floor(u), iv=Math.floor(v), fu=u-iu, fv=v-iv; for(let c=0;c<3;c++){ const a=sd.data[(iv*src.width+iu)*4+c], b=sd.data[(iv*src.width+iu+1)*4+c], dd=sd.data[((iv+1)*src.width+iu)*4+c], e=sd.data[((iv+1)*src.width+iu+1)*4+c]; od.data[oo+c]=a*(1-fu)*(1-fv)+b*fu*(1-fv)+dd*(1-fu)*fv+e*fu*fv; } od.data[oo+3]=255; }
 og.putImageData(od,0,0); out=oc;
 fr0=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(m.lon,m.lat,m.alt)); AKEY='sisPhotoAdj:'+m.name; A=loadAdj(m.name); rec.adj=null; alLast=null;
 recompute(); build(); updateInfo(); if(syncFn) syncFn(); renderList(); renderMarkers();
 if(wasProj||projWanted) await applyShow();
 if(o.fly!==false) fly();
 say('사진 선택: '+m.name); return true; }
function clearActive(){ projectOff(); if(prim){ scene.primitives.remove(prim); prim=null; } ents.forEach(e=>viewer.entities.remove(e)); ents.length=0; ACT=null; META=null; if(bmp&&bmp.close){ try{bmp.close();}catch(e){} } bmp=null; out=null; camPos=null; if(texUrl){ URL.revokeObjectURL(texUrl); texUrl=null; } updateInfo(); renderList(); renderMarkers(); }

// ===== 촬영 위치 표시 (목록의 모든 사진) =====
function renderMarkers(){ camEnts.forEach(e=>viewer.entities.remove(e)); camEnts.length=0;
 for(const rec of LIB){ if(rec===ACT||!rec.meta) continue; const ps=poseRec(rec); const end=C.Cartesian3.add(ps.pos,C.Cartesian3.multiplyByScalar(ps.dir,30,new C.Cartesian3()),new C.Cartesian3());
  const col=rec.file? C.Color.fromCssColorString('#40c4ff') : C.Color.fromCssColorString('#9e9e9e');
  const pt=viewer.entities.add({position:ps.pos, point:{pixelSize:9,color:col,outlineColor:C.Color.BLACK,outlineWidth:2,disableDepthTestDistance:1e9}}); pt.sisPhotoId=rec.id; camEnts.push(pt);
  camEnts.push(viewer.entities.add({polyline:{positions:[ps.pos,end],width:2,material:col.withAlpha(0.85)}})); }
 applyVis(); }

// ===== 사진 불러오기 (선택/폴더/끌어놓기) =====
async function addFiles(files){ files=[...files].filter(f=>/\.jpe?g$/i.test(f.name)); if(!files.length){ say('JPG 사진이 없습니다.'); return {added:0,skipped:[]}; }
 let added=0, linked=0; const skipped=[]; const t0=Date.now();
 for(let i=0;i<files.length;i++){ const f=files[i]; say('사진 정보 읽는 중... '+(i+1)+' / '+files.length); const id=f.name+'|'+f.size; const ex=LIB.find(r=>r.id===id);
  try{ if(ex){ if(!ex.file){ ex.file=f; linked++; } continue; } const rm=await readMeta(f); const thumb=rm.thumbBlob? await b2d(rm.thumbBlob) : await makeThumb(f); LIB.push({id,file:f,meta:rm.meta,thumb,align:null}); added++; }catch(e){ skipped.push(f.name+' : '+e.message); }
  if(i%4===3) await sleep0(); }
 saveLib(); renderList(); renderMarkers();
 let msg='완료: '+added+'장 추가'+(linked? ', '+linked+'장 파일 다시 연결':'')+(skipped.length? ', '+skipped.length+'장 건너뜀':'')+' ('+((Date.now()-t0)/1000).toFixed(1)+'초)';
 if(skipped.length) msg+='\n건너뜀: '+skipped.slice(0,6).join(' / ')+(skipped.length>6?' 외 '+(skipped.length-6)+'장':'');
 say(msg);
 if(!ACT||(ACT&&!ACT.file)){ const first=sortedList().find(r=>r.file); if(first) await activate(first); }
 return {added,linked,skipped}; }
async function filesFromDrop(dt){ const outF=[]; const walk=async(en)=>{ if(en.isFile){ outF.push(await new Promise(r=>en.file(r))); } else if(en.isDirectory){ const rd=en.createReader(); let b; do{ b=await new Promise(r=>rd.readEntries(r)); for(const e of b) await walk(e); }while(b.length); } };
 const its=[...dt.items].map(i=>i.webkitGetAsEntry&&i.webkitGetAsEntry()).filter(Boolean); if(its.length){ for(const e of its) await walk(e); } else outF.push(...dt.files); return outF; }

let sortMode='time';
const sortedList=()=>LIB.slice().sort((a,b)=> sortMode==='name'? a.meta.name.localeCompare(b.meta.name) : ((a.meta.date||'')+a.meta.name).localeCompare((b.meta.date||'')+b.meta.name));
async function stepPhoto(dlt){ const L=sortedList().filter(r=>r.file); if(!L.length){ say('연결된 사진이 없습니다.'); return; } let i=L.indexOf(ACT); i=(i<0)? 0 : (i+dlt+L.length)%L.length; await activate(L[i],{fly:fo2()}); }
const fo2=()=>{ const el=panelEl&&panelEl.querySelector('#ph-autofly'); return el? el.checked : true; };
async function selectRec(rec){ await activate(rec,{fly:fo2()}); }
function removeRec(rec){ const i=LIB.indexOf(rec); if(i<0) return; LIB.splice(i,1); if(ACT===rec) clearActive(); saveLib(); renderList(); renderMarkers(); }

// ===== 화면 목록 =====
let findMode=false, armDel=null, batchBusy=false, batchStop=false;
function statusOf(r){ const t=[]; if(!r.file) t.push('<span style="color:#ffb74d">파일 연결 필요</span>'); if(r.meta.warns&&r.meta.warns.length) t.push('<span style="color:#ffb74d" title="'+esc(r.meta.warns.join(' / '))+'">⚠ 확인</span>');
 if(r.align){ if(r.align.err) t.push('<span style="color:#ef9a9a" title="'+esc(r.align.err)+'">맞춤 실패</span>'); else t.push('<span style="color:#a5d6a7">맞춤 ✔ '+(r.align.m!=null? r.align.m.toFixed(2)+' m':'')+'</span>'); } else t.push('<span style="color:#9fa8da">맞춤 전</span>'); return t.join(' · '); }
function renderList(){ if(!panelEl) return; const el=panelEl.querySelector('#ph-list'); const cnt=panelEl.querySelector('#ph-cnt'); if(cnt) cnt.textContent=LIB.length+'장';
 if(!LIB.length){ el.innerHTML='<div style="color:#889;font-size:12px;padding:8px 2px">아직 불러온 사진이 없습니다. 위의 버튼으로 사진이나 폴더를 선택하세요.</div>'; return; }
 el.innerHTML=sortedList().map(r=>{ const act=r===ACT; const m=r.meta; return '<div class="phrow" data-id="'+esc(r.id)+'" style="display:flex;gap:6px;align-items:center;padding:5px 4px;border-bottom:1px solid #2a2f4a;cursor:pointer;background:'+(act?'rgba(255,213,79,.14)':'transparent')+';border-left:3px solid '+(act?'#ffd54f':'transparent')+(r.file?'':';opacity:.7')+'">'+
  (r.thumb? '<img src="'+r.thumb+'" style="flex:none;width:56px;height:42px;object-fit:cover;border-radius:3px;background:#000">':'<div style="flex:none;width:56px;height:42px;background:#1b1f3a;border-radius:3px"></div>')+
  '<div style="flex:1;min-width:0;font-size:11.5px;line-height:1.35"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(m.name)+'">'+esc(m.name)+'</div><div style="color:#9fa8da">'+esc((m.date||'').slice(5,16))+' · '+m.alt.toFixed(0)+' m'+(m.rel!=null?' (상대 '+m.rel.toFixed(0)+')':'')+'</div><div>'+statusOf(r)+'</div></div>'+
  '<button class="sis-btn" data-a="rm" title="목록에서 빼기 (사진 파일은 지워지지 않음)" style="padding:2px 6px;flex:none">'+(armDel===r.id?'확인':'✕')+'</button></div>'; }).join(''); }
function updateInfo(){ if(!panelEl) return; const ctl=panelEl.querySelector('#ph-ctl'), none=panelEl.querySelector('#ph-none'), inf=panelEl.querySelector('#ph-info'); if(ctl) ctl.style.display=ACT?'':'none'; if(none) none.style.display=ACT?'none':'';
 if(!inf) return; if(!META){ inf.innerHTML=''; return; } const w=(META.warns||[]).map(x=>'<div style="color:#ffb74d">⚠ '+esc(x)+'</div>').join('');
 inf.innerHTML='<div style="color:#c5cae9;font-size:12px;word-break:break-all;font-weight:600">'+esc(META.name)+'</div><div style="font-size:12px;margin:4px 0;color:#9fa8da">'+esc((META.make+' '+META.model).trim()||'카메라 정보 없음')+(META.date?' · '+esc(META.date):'')+'<br>위도 '+META.lat.toFixed(6)+' · 경도 '+META.lon.toFixed(6)+'<br>절대고도 '+META.alt.toFixed(1)+' m'+(META.rel!=null?' (상대 '+META.rel.toFixed(1)+' m)':'')+'<br>방위 '+META.yaw+'° · 상하각 '+META.pitch+'° · 기울기 '+META.roll+'°<br>'+esc(META.lens)+' · '+META.w+'×'+META.h+'</div>'+w; }
function showFind(P3,label){ const box=panelEl&&panelEl.querySelector('#ph-find'); if(!box) return; const res=bestFor(P3,{}); 
 if(!res.length){ box.innerHTML='<div style="color:#ffb74d;font-size:12px">'+esc(label)+': 이 지점이 찍힌 사진이 목록에 없습니다. (목록 '+LIB.length+'장)</div>'; return; }
 box.innerHTML='<div style="font-size:12px;color:#c5cae9;margin-bottom:3px">'+esc(label)+'이 찍힌 사진 '+res.length+'장 (가까운 순, 다른 물체에 가려진 경우는 구분하지 못합니다)</div>'+res.slice(0,12).map(x=>'<div class="phfind" data-id="'+esc(x.rec.id)+'" style="display:flex;gap:6px;align-items:center;padding:4px;border-bottom:1px solid #2a2f4a;cursor:pointer;font-size:11.5px">'+(x.rec.thumb?'<img src="'+x.rec.thumb+'" style="width:48px;height:36px;object-fit:cover;border-radius:3px">':'')+'<div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(x.rec.meta.name)+'</div><div style="color:#9fa8da">거리 '+x.d.toFixed(0)+' m'+(x.rec.file?'':' · 파일 연결 필요')+'</div></div></div>').join(''); }

// ===== 원본 사진 크롭 (점검 보고서용) =====
function cropWith(bm,m,px,o){ const xs=px.map(q=>q.x), ys=px.map(q=>q.y); const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys); if(x1<0||y1<0||x0>m.w||y0>m.h) return null;
  const cx=(x0+x1)/2, cy=(y0+y1)/2; let w=Math.max(720,(x1-x0)*1.8), h=w*0.75; if(h<(y1-y0)*1.8){ h=(y1-y0)*1.8; w=h/0.75; } w=Math.min(w,m.w); h=Math.min(h,m.h); let rx=Math.min(Math.max(cx-w/2,0),m.w-w), ry=Math.min(Math.max(cy-h/2,0),m.h-h);
  const OWc=Math.min(960,Math.round(w)); const k=OWc/w; const cv=document.createElement('canvas'); cv.width=OWc; cv.height=Math.round(h*k); const g=cv.getContext('2d'); g.drawImage(bm,rx,ry,w,h,0,0,cv.width,cv.height);
  const col=o.color||'#ff5252'; g.lineWidth=Math.max(2,cv.width/240); g.strokeStyle=col; g.fillStyle=col; const q=px.map(a=>[(a.x-rx)*k,(a.y-ry)*k]);
  if(o.type==='point'){ g.beginPath(); g.arc(q[0][0],q[0][1],cv.width/28,0,7); g.stroke(); g.beginPath(); g.moveTo(q[0][0]-cv.width/18,q[0][1]); g.lineTo(q[0][0]-cv.width/50,q[0][1]); g.moveTo(q[0][0]+cv.width/50,q[0][1]); g.lineTo(q[0][0]+cv.width/18,q[0][1]); g.moveTo(q[0][0],q[0][1]-cv.width/18); g.lineTo(q[0][0],q[0][1]-cv.width/50); g.moveTo(q[0][0],q[0][1]+cv.width/50); g.lineTo(q[0][0],q[0][1]+cv.width/18); g.stroke(); }
  else { g.beginPath(); q.forEach((a,i)=>i?g.lineTo(a[0],a[1]):g.moveTo(a[0],a[1])); if(o.type==='area') g.closePath(); g.stroke(); }
  return {url:cv.toDataURL('image/jpeg',0.88), px:px.map(a=>({x:Math.round(a.x),y:Math.round(a.y)})), region:[Math.round(rx),Math.round(ry),Math.round(w),Math.round(h)]}; }
async function cropAll(P3,o){ o=o||{}; const cand=bestFor(P3,{needFile:true,margin:0.02}); const ai=cand.findIndex(c=>c.rec===ACT); if(ai>0){ const a=cand.splice(ai,1)[0]; cand.unshift(a); }
  const res=[]; for(const c of cand.slice(0,o.max||3)){ let bm=(c.rec===ACT)?bmp:null; try{ if(!bm) bm=await createImageBitmap(c.rec.file); const r=cropWith(bm,c.rec.meta,c.px,o); if(r){ r.name=c.rec.meta.name; r.date=c.rec.meta.date; r.dist=c.d; r.active=(c.rec===ACT); res.push(r); } }catch(e){} finally{ if(bm&&bm!==bmp&&bm.close) bm.close(); } } return res; }

// ===== 목록 전체 자동 맞춤 =====
async function alignAll(){ if(batchBusy){ batchStop=true; return null; } const L=sortedList().filter(r=>r.file); if(!L.length){ say('연결된 사진이 없습니다.'); return null; }
 batchBusy=true; batchStop=false; const keep=ACT; const btn=()=>panelEl&&panelEl.querySelector('#ph-batch'); if(btn()) btn().textContent='■ 중지 (현재 사진까지 끝내고 멈춤)'; let ok=0, fail=0; let stopped=false;
 try{ for(let i=0;i<L.length;i++){ if(batchStop){ stopped=true; break; } say('전체 자동 맞춤 ('+(i+1)+'/'+L.length+'): '+L[i].meta.name); if(!(await activate(L[i],{fly:true}))){ fail++; continue; } const r=await autoAlign({fitFov:false}); if(r&&!r.err) ok++; else fail++; } }
 finally{ batchBusy=false; if(btn()) btn().textContent='🎯 목록 전체 자동 맞춤'; if(keep&&keep.file&&keep!==ACT) await activate(keep,{fly:true}); say('전체 자동 맞춤 끝: 성공 '+ok+'장, 실패 '+fail+'장'+(stopped?' (중지됨)':'')); }
 return {ok,fail}; }

let handler=null;
function remove(){ projectOff(); if(prim) scene.primitives.remove(prim); prim=null; ents.forEach(e=>viewer.entities.remove(e)); ents.length=0; camEnts.forEach(e=>viewer.entities.remove(e)); camEnts.length=0; if(handler){ try{handler.destroy();}catch(e){} handler=null; } }
S.photo={adj:()=>A, setAdj:(o)=>{ if(!ACT) return; Object.assign(A,o); adjChanged(); }, toggle:async(v)=>{ shown=(v===undefined)?!shown:v; await applyShow(); const el=document.querySelector('#ph-show'); if(el) el.checked=shown; return shown; }, remove, fly, setOpa, build, get META(){ return META; }, projectOn, projectOff, setProjOpa:(v)=>{projOpa=v;}, get shaders(){return shaders;}, setDist:(d)=>{dist=d; build();},
 state:()=>({shown,projWanted,quadVis}), fileDate:()=>META?META.date:'', pixelOf:(p)=>ACT?pixelRec(ACT,p):null,
 cropOriginal:(P3,o)=>{ if(!ACT) return null; const px=P3.map(p=>pixelRec(ACT,p)); if(px.some(q=>!q)) return null; return cropWith(bmp,META,px,o||{}); }, cropAll,
 lib:()=>LIB, active:()=>ACT, addFiles, activate:(id,o)=>{ const r=LIB.find(x=>x.id===id||x.meta.name===id); return activate(r,o); }, step:stepPhoto, best:(P3,o)=>bestFor(P3,o), alignAll, clearActive };

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
async function autoAlign(opts){ opts=opts||{}; if(!ACT){ say('먼저 사진을 선택해 주세요.'); return {err:'사진 없음'}; } const rec0=ACT; const st=(m)=>{ const el=panelEl&&panelEl.querySelector('#al-st'); if(el) el.textContent=m; };
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
  if(rec0){ rec0.align={px:result.finalMed,m:ms(result.finalMed),inl:nIn,at:Date.now()}; saveLib(); renderList(); } st('완료: '+result.sec.toFixed(1)+'초 · 신뢰 점 '+nIn+'개 · 중간 오차 '+result.firstMed.toFixed(1)+'px → '+result.finalMed.toFixed(1)+'px (약 '+ms(result.firstMed).toFixed(2)+' m → '+ms(result.finalMed).toFixed(2)+' m)');
 }catch(err){ Object.assign(A,prev); recompute(); if(rec0){ rec0.align={err:err.message,at:Date.now()}; saveLib(); renderList(); } st('실패: '+err.message); log.push({err:err.message}); result={err:err.message,log}; }
 finally{ viewer.resolutionScale=oldRS; viewer.resize(); viewer.entities.show=entShow; shown=wasShown; adjChanged(); await applyShow(); if(syncFn) syncFn(); fly(); if(btn) btn.disabled=false; }
 return result; }
function undoAlign(){ if(!alLast||!alLast.prev) return false; Object.assign(A,alLast.prev); adjChanged(); if(syncFn) syncFn(); const el=panelEl&&panelEl.querySelector('#al-st'); if(el) el.textContent='맞춤 전 값으로 되돌렸습니다.'; return true; }
S.photo.autoAlign=autoAlign; S.photo.undoAlign=undoAlign; S.photo.alignDebug=()=>alLast;


S.photo.autoAlign=autoAlign; S.photo.undoAlign=undoAlign; S.photo.alignDebug=()=>alLast;

// ===== 패널 =====
function mountPanel(panel){ panelEl=panel; let armClear=false;
 panel.innerHTML='<div style="padding:12px;font-size:13px;line-height:1.55">'+
 '<label style="display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:8px;cursor:pointer;font-size:14px"><input id="ph-show" type="checkbox" checked style="width:18px;height:18px"> 사진 중첩 표시 (켜기/끄기)</label>'+
 '<div style="font-weight:600;margin:4px 0">사진 불러오기</div>'+
 '<div style="display:flex;gap:6px"><button class="sis-btn" id="ph-pick" style="flex:1">📷 사진 선택</button><button class="sis-btn" id="ph-pickdir" style="flex:1">📁 폴더 선택</button></div>'+
 '<input id="ph-file" type="file" accept="image/jpeg,.jpg,.jpeg" multiple style="display:none"><input id="ph-dir" type="file" webkitdirectory multiple style="display:none">'+
 '<div style="font-size:11px;color:#9fa8da;margin-top:4px">여러 장을 한 번에 고를 수 있고, 사진이나 폴더를 이 패널에 끌어 놓아도 됩니다. 사진은 이 브라우저 안에서만 처리하며 어디에도 올리지 않습니다. 촬영 위치와 카메라 방향 정보(GPS, 짐벌 각도)가 들어 있는 드론 JPG를 지원합니다.</div>'+
 '<div id="ph-ls" style="font-size:12px;color:#c5cae9;margin-top:6px;white-space:pre-line;word-break:keep-all"></div>'+
 '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #2a2f4a"><div style="display:flex;justify-content:space-between;align-items:center"><b>사진 목록 <span id="ph-cnt" style="color:#9fa8da;font-weight:400"></span></b><select id="ph-sort" style="background:#10142a;color:#e8eaf6;border:1px solid #333a5e;border-radius:4px;padding:2px 4px;font-size:12px"><option value="time">촬영 시간순</option><option value="name">이름순</option></select></div>'+
 '<div style="display:flex;gap:6px;margin-top:6px"><button class="sis-btn" id="ph-prev" style="flex:1">◀ 이전 사진</button><button class="sis-btn" id="ph-next" style="flex:1">다음 사진 ▶</button></div>'+
 '<label style="display:block;margin-top:6px;font-size:12.5px;cursor:pointer"><input id="ph-autofly" type="checkbox" checked style="vertical-align:middle"> 사진을 고르면 그 촬영 위치로 이동</label>'+
 '<label style="display:block;margin-top:2px;font-size:12.5px;cursor:pointer"><input id="ph-all" type="checkbox" checked style="vertical-align:middle"> 촬영 위치 전체 표시 (하늘색 점, 클릭하면 선택)</label>'+
 '<div style="display:flex;gap:6px;margin-top:6px"><button class="sis-btn" id="ph-cfind" style="flex:1">🔎 화면 가운데가 찍힌 사진</button><button class="sis-btn" id="ph-kfind" style="flex:1">👆 지도 클릭으로 찾기</button></div>'+
 '<div id="ph-find" style="margin-top:6px"></div>'+
 '<div id="ph-list" style="margin-top:6px;max-height:300px;overflow:auto;border:1px solid #2a2f4a;border-radius:6px"></div>'+
 '<button class="sis-btn" id="ph-batch" style="width:100%;margin-top:8px">🎯 목록 전체 자동 맞춤</button>'+
 '<button class="sis-btn" id="ph-clear" style="width:100%;margin-top:6px">목록 비우기 (사진 파일은 지워지지 않음)</button></div>'+
 '<div id="ph-none" style="margin-top:14px;padding:10px;border:1px dashed #343b66;border-radius:8px;color:#9fa8da;font-size:12px">사진을 선택하면 여기에 사진 정보와 투명도, 투영, 자동 맞춤, 미세 조정 도구가 나타납니다.</div>'+
 '<div id="ph-ctl" style="display:none;margin-top:14px;padding-top:10px;border-top:1px solid #2a2f4a"><div style="font-weight:700;margin-bottom:2px">선택한 사진</div><div id="ph-info"></div>'+
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
 '</div></div>';
 const fileIn=panel.querySelector('#ph-file'), dirIn=panel.querySelector('#ph-dir');
 panel.querySelector('#ph-pick').onclick=()=>fileIn.click(); panel.querySelector('#ph-pickdir').onclick=()=>dirIn.click();
 fileIn.onchange=async()=>{ const a=[...fileIn.files]; fileIn.value=''; await addFiles(a); };
 dirIn.onchange=async()=>{ const a=[...dirIn.files]; dirIn.value=''; await addFiles(a); };
 panel.ondragover=(e)=>{ e.preventDefault(); }; panel.ondrop=async(e)=>{ e.preventDefault(); const fl=await filesFromDrop(e.dataTransfer); await addFiles(fl); };
 panel.querySelector('#ph-sort').value=sortMode; panel.querySelector('#ph-sort').onchange=(e)=>{ sortMode=e.target.value; renderList(); };
 panel.querySelector('#ph-prev').onclick=()=>stepPhoto(-1); panel.querySelector('#ph-next').onclick=()=>stepPhoto(1);
 panel.querySelector('#ph-all').checked=showAll; panel.querySelector('#ph-all').onchange=(e)=>{ showAll=e.target.checked; applyVis(); };
 panel.querySelector('#ph-list').onclick=(e)=>{ const row=e.target.closest('.phrow'); if(!row) return; const r=LIB.find(x=>x.id===row.dataset.id); if(!r) return;
  if(e.target.closest('[data-a="rm"]')){ if(armDel===r.id){ armDel=null; removeRec(r); } else { armDel=r.id; setTimeout(()=>{ if(armDel===r.id){ armDel=null; renderList(); } },3000); renderList(); } return; } selectRec(r); };
 panel.querySelector('#ph-find').onclick=(e)=>{ const row=e.target.closest('.phfind'); if(!row) return; const r=LIB.find(x=>x.id===row.dataset.id); if(r) selectRec(r); };
 panel.querySelector('#ph-cfind').onclick=()=>{ const cw=viewer.canvas.clientWidth, ch=viewer.canvas.clientHeight; const p=scene.pickPosition(new C.Cartesian2(cw/2,ch/2)); if(!p||!isFinite(p.x)){ panel.querySelector('#ph-find').innerHTML='<div style="color:#ffb74d;font-size:12px">화면 가운데에서 모델 위의 지점을 찾지 못했습니다. 모델이 보이게 화면을 옮겨 주세요.</div>'; return; } showFind([p],'화면 가운데 지점'); };
 const kb=panel.querySelector('#ph-kfind'); kb.onclick=()=>{ findMode=!findMode; kb.style.outline=findMode?'2px solid #ffd54f':''; kb.textContent=findMode?'👆 모델을 클릭하세요 (다시 누르면 끝)':'👆 지도 클릭으로 찾기'; scene.canvas.style.cursor=findMode?'crosshair':''; };
 panel.querySelector('#ph-batch').onclick=()=>alignAll();
 const cb=panel.querySelector('#ph-clear'); cb.onclick=()=>{ if(!armClear){ armClear=true; cb.textContent='한 번 더 누르면 목록이 비워집니다 (사진 파일은 지워지지 않음)'; setTimeout(()=>{ armClear=false; cb.textContent='목록 비우기 (사진 파일은 지워지지 않음)'; },3000); return; } armClear=false; cb.textContent='목록 비우기 (사진 파일은 지워지지 않음)'; LIB.length=0; clearActive(); saveLib(); renderList(); renderMarkers(); say('목록을 비웠습니다.'); };
 panel.querySelector('#ph-op').oninput=(e)=>{ panel.querySelector('#ph-opv').textContent=e.target.value+'%'; setOpa(e.target.value/100); };
 panel.querySelector('#ph-d').oninput=(e)=>{ panel.querySelector('#ph-dv').textContent=e.target.value+' m'; dist=+e.target.value; build(); };
 panel.querySelector('#ph-show').checked=shown; panel.querySelector('#ph-proj').checked=projWanted; panel.querySelector('#ph-quad').checked=quadVis;
 panel.querySelector('#ph-show').onchange=async(e)=>{ shown=e.target.checked; await applyShow(); };
 panel.querySelector('#ph-proj').onchange=async(e)=>{ projWanted=e.target.checked; await applyShow(); };
 panel.querySelector('#ph-po').oninput=(e)=>{ panel.querySelector('#ph-pov').textContent=e.target.value+'%'; projOpa=e.target.value/100; };
 panel.querySelector('#ph-quad').onchange=(e)=>{ quadVis=e.target.checked; applyVis(); };
 panel.querySelector('#ph-go').onclick=fly;
 const keys=['e','n','u','yaw','pitch','roll','fov'];
 const sum=()=>{ const el=panel.querySelector('#ad-sum'); if(!camPos){ el.innerHTML=''; return; } const ll=C.Cartographic.fromCartesian(camPos); el.innerHTML='조정 후 위치: 경도 '+C.Math.toDegrees(ll.longitude).toFixed(7)+' · 위도 '+C.Math.toDegrees(ll.latitude).toFixed(7)+' · 높이 '+ll.height.toFixed(2)+' m<br>조정 후 방향: 방위 '+(META.yaw+A.yaw).toFixed(2)+'° · 상하 '+(META.pitch+A.pitch).toFixed(2)+'° · 기울기 '+(META.roll+A.roll).toFixed(2)+'°'; };
 const sync=()=>{ keys.forEach(k=>{ panel.querySelector('#ad-'+k).value=A[k]; panel.querySelector('#ad-'+k+'-n').value=(+A[k]).toFixed(1); }); sum(); };
 keys.forEach(k=>{ const r=panel.querySelector('#ad-'+k), n=panel.querySelector('#ad-'+k+'-n');
  r.oninput=()=>{ A[k]=+r.value; n.value=(+r.value).toFixed(1); adjChanged(); sum(); };
  n.onchange=()=>{ let v=parseFloat(n.value); if(!isFinite(v)) v=0; A[k]=v; r.value=v; n.value=v.toFixed(1); adjChanged(); sum(); }; });
 panel.querySelector('#ad-reset').onclick=()=>{ A=Object.assign({},A0); adjChanged(); sync(); };
 syncFn=sync; sync();
 panel.querySelector('#al-go').onclick=()=>autoAlign({fitFov:panel.querySelector('#al-fov').checked});
 panel.querySelector('#al-undo').onclick=()=>{ if(!undoAlign()) panel.querySelector('#al-st').textContent='되돌릴 이전 값이 없습니다.'; };
 handler=new C.ScreenSpaceEventHandler(scene.canvas);
 handler.setInputAction((e)=>{ const pk=scene.pick(e.position); const id=pk&&pk.id&&pk.id.sisPhotoId; if(id){ const r=LIB.find(x=>x.id===id); if(r){ selectRec(r); return; } } if(findMode){ const p=scene.pickPosition(e.position); if(p&&isFinite(p.x)) showFind([p],'클릭한 지점'); } }, C.ScreenSpaceEventType.LEFT_CLICK);
 renderList(); updateInfo(); if(syncFn) syncFn();
}
for(let i=S.features.length-1;i>=0;i--){ if(S.features[i].id==='photo'){ try{S.features[i].unmount&&S.features[i].unmount();}catch(e){} S.features.splice(i,1);} }
S.addFeature({id:'photo', icon:'📷', title:'사진', mount:mountPanel, unmount(){ if(handler){ try{handler.destroy();}catch(e){} handler=null; } if(findMode){ findMode=false; scene.canvas.style.cursor=''; } panelEl=null; } });

// ===== 시작: 저장돼 있던 목록 복원 + (있으면) 주입된 사진 추가 =====
{ const saved=await dbGet('lib'); if(Array.isArray(saved)) for(const s of saved){ if(s&&s.id&&s.meta&&!LIB.find(r=>r.id===s.id)) LIB.push({id:s.id,file:null,meta:s.meta,thumb:s.thumb,align:s.align}); }
  if(window.__pjb64){ const bin=atob(window.__pjb64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); window.__pjb64=null; const nm=window.__pjname||'DJI_20260908114941_0040_V.JPG'; await addFiles([new File([u8],nm,{type:'image/jpeg'})]); }
  renderMarkers(); }
})()
