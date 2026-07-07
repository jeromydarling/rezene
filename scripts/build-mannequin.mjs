// Rebuild public/models/mannequin.glb from the MakeHuman base mesh (CC0).
// One-off asset build, not part of the app runtime. Prereq (throwaway):
//   mkdir /tmp/mh-gen && cd /tmp/mh-gen && npm init -y && npm i makehuman-data@0.0.2
// Then from the repo root:
//   node scripts/build-mannequin.mjs public/models/mannequin.glb <armDeg> <legDeg>
// Extracts the "body" material group, re-poses arms/legs via the rig skin
// weights, scales to ~1.7m, and writes a binary glTF. See public/models/README.md.
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
const DATA = process.env.MH_DATA || "/tmp/mh-gen/node_modules/makehuman-data/public/data/models/human_full_size.json";
const d = JSON.parse(readFileSync(DATA,'utf8'));
const armDeg = Number(process.argv[3]??28), legDeg = Number(process.argv[4]??7);
const B=d.bones, V=d.vertices.slice(), SI=d.skinIndices, SW=d.skinWeights, INF=d.influencesPerVertex;
// bone world positions (all rest rotations identity -> cumulative translation)
const wp=B.map(()=>[0,0,0]);
for(let i=0;i<B.length;i++){ const p=B[i].parent; const base=p>=0?wp[p]:[0,0,0]; wp[i]=[base[0]+B[i].pos[0],base[1]+B[i].pos[1],base[2]+B[i].pos[2]]; }
// subtree roots (____head nodes): leftArm 72, rightArm 74, leftLeg 10, rightLeg 12
const ROOTS={72:'LA',74:'RA',10:'LL',12:'RL'};
const label=new Array(B.length).fill(null);
for(let i=0;i<B.length;i++){ let j=i; while(j>=0){ if(ROOTS[j]){label[i]=ROOTS[j];break;} j=B[j].parent; } }
const J={LA:wp[72],RA:wp[74],LL:wp[10],RL:wp[12]};
const rad=x=>x*Math.PI/180;
// rotation about Z through pivot Jxy by theta
function rotZ(x,y,jx,jy,th){ const dx=x-jx,dy=y-jy,c=Math.cos(th),s=Math.sin(th); return [jx+dx*c-dy*s, jy+dx*s+dy*c]; }
const ang={LA:-rad(armDeg),RA:rad(armDeg),LL:-rad(legDeg),RL:rad(legDeg)};
const nv=V.length/3; const out=new Float32Array(V.length);
for(let v=0;v<nv;v++){
  const x=V[v*3],y=V[v*3+1],z=V[v*3+2];
  let nx=x,ny=y; // accumulate blended offset
  let ox=0,oy=0;
  for(let k=0;k<INF;k++){ const bi=SI[v*INF+k], w=SW[v*INF+k]; if(w<=0)continue; const L=label[bi]; if(!L)continue;
    const j=J[L]; const [rx,ry]=rotZ(x,y,j[0],j[1],ang[L]); ox+=w*(rx-x); oy+=w*(ry-y); }
  out[v*3]=x+ox; out[v*3+1]=y+oy; out[v*3+2]=z;
}
// build body-only mesh (material 'body' = vertex idx < 13380)
const F=d.faces; const nUv=(d.uvs||[]).length; const BODY=13380; const isBit=(vv,p)=>vv&(1<<p); let o=0; const fi=[];
while(o<F.length){ const t=F[o++]; const quad=isBit(t,0),mat=isBit(t,1),fvUv=isBit(t,3),fN=isBit(t,4),fvN=isBit(t,5),fC=isBit(t,6),fvC=isBit(t,7); const n=quad?4:3; const a=[]; for(let i=0;i<n;i++)a.push(F[o++]); if(mat)o++; if(fvUv)o+=nUv*n; if(fN)o++; if(fvN)o+=n; if(fC)o++; if(fvC)o+=n; if(!a.every(z=>z<BODY))continue; if(quad){fi.push(a[0],a[1],a[2],a[0],a[2],a[3]);} else fi.push(a[0],a[1],a[2]); }
const remap=new Map(); const pos=[]; const gi=fi.map(vi=>{ let n=remap.get(vi); if(n===undefined){n=remap.size;remap.set(vi,n);pos.push(out[vi*3],out[vi*3+1],out[vi*3+2]);} return n; });
let positions=new Float32Array(pos);
const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(positions,3)); g.setIndex(gi);
g.computeBoundingBox(); const bb=g.boundingBox; const h=bb.max.y-bb.min.y; const s=1.7/h; const cx=(bb.max.x+bb.min.x)/2,cz=(bb.max.z+bb.min.z)/2;
for(let i=0;i<positions.length;i+=3){ positions[i]=(positions[i]-cx)*s; positions[i+1]=(positions[i+1]-bb.min.y)*s; positions[i+2]=(positions[i+2]-cz)*s; }
g.computeVertexNormals(); const normals=g.attributes.normal.array; g.computeBoundingBox();
const pmin=[g.boundingBox.min.x,g.boundingBox.min.y,g.boundingBox.min.z],pmax=[g.boundingBox.max.x,g.boundingBox.max.y,g.boundingBox.max.z];
const index=new Uint16Array(gi); const nvv=positions.length/3,ni=gi.length;
const idxB=Buffer.from(index.buffer),idxPad=(4-(idxB.length%4))%4,posB=Buffer.from(positions.buffer),normB=Buffer.from(normals.buffer);
const posOff=idxB.length+idxPad,normOff=posOff+posB.length,binLen=normOff+normB.length;
const json={asset:{version:"2.0",generator:"verto makehuman posed (CC0)"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:"MannequinBody"}],meshes:[{name:"MannequinBody",primitives:[{attributes:{POSITION:1,NORMAL:2},indices:0}]}],buffers:[{byteLength:binLen}],bufferViews:[{buffer:0,byteOffset:0,byteLength:idxB.length,target:34963},{buffer:0,byteOffset:posOff,byteLength:posB.length,target:34962},{buffer:0,byteOffset:normOff,byteLength:normB.length,target:34962}],accessors:[{bufferView:0,componentType:5123,count:ni,type:"SCALAR"},{bufferView:1,componentType:5126,count:nvv,type:"VEC3",min:pmin,max:pmax},{bufferView:2,componentType:5126,count:nvv,type:"VEC3"}]};
let js=JSON.stringify(json); while(js.length%4)js+=' '; const jsonB=Buffer.from(js,'utf8');
const bin=Buffer.concat([idxB,Buffer.alloc(idxPad),posB,normB]);
const hd=Buffer.alloc(12);hd.writeUInt32LE(0x46546C67,0);hd.writeUInt32LE(2,4);hd.writeUInt32LE(12+8+jsonB.length+8+bin.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(jsonB.length,0);jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004E4942,4);
writeFileSync(process.argv[2],Buffer.concat([hd,jh,jsonB,bh,bin]));
console.log('posed GLB',process.argv[2],'arms',armDeg,'legs',legDeg,'verts',nvv);
