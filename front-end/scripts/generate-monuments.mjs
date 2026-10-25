// Original educational geometry, distributed under the repository MIT license.
// Coordinates are illustrative tabletop units, not surveyed monument dimensions.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/models/monuments/', import.meta.url));
const materials = [[0.73, 0.55, 0.32, 1], [0.91, 0.87, 0.75, 1], [0.55, 0.23, 0.13, 1], [0.23, 0.31, 0.23, 1], [0.17, 0.19, 0.18, 1], [0.66, 0.48, 0.18, 1]];
let parts = [];
function mesh(vertices, faces, material) {
  const p = [], n = [];
  for (const face of faces) {
    const [a,b,c] = face.map(i => vertices[i]);
    const u=b.map((v,i)=>v-a[i]), v=c.map((w,i)=>w-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...normal);
    if (length < 1e-9) continue;
    for (const vertex of [a,b,c]) { p.push(...vertex); n.push(...normal.map(x=>x/length)); }
  }
  parts.push({p,n,material});
}
function box(x,y,z,w,h,d,m) {
  const vs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h/2,z+c*d/2]);
  mesh(vs,[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]],m);
}
function lathe(x,z,profile,m,segments=40) {
  const vs=[],fs=[];
  for (const [r,y] of profile) for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments;vs.push([x+r*Math.cos(a),y,z+r*Math.sin(a)]);}
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=b+segments,d=a+segments;fs.push([a,d,b],[b,d,c]);}
  mesh(vs,fs,m);
}
function cylinder(x,z,bottom,top,r1,r2,m){lathe(x,z,[[0,bottom],[r1,bottom],[r2,top],[0,top]],m);}
function pyramid(){
  box(0,0.06,0,8.5,0.12,8.5,0);
  mesh([[-3,0.12,-3],[3,0.12,-3],[3,0.12,3],[-3,0.12,3],[0,3.95,0]],[[0,4,1],[1,4,2],[2,4,3],[3,4,0],[0,1,2],[0,2,3]],0);
  // Thin horizontal seams illustrate courses without implying an exact block count.
  for(let i=1;i<17;i++){const y=.12+i*.215,half=3*(1-(y-.12)/3.83);if(half>0)box(0,y,0,2*half+.015,.012,2*half+.015,5);}
  box(0,1.15,2.15,.35,.42,.04,4);
}
function taj(){
  box(0,.08,0,10,.16,10,3);box(0,.23,-.4,8,.3,6.8,1);
  box(0,.35,3.8,1.05,.06,2.15,4);box(0,.385,3.8,.74,.02,2,0);
  box(0,1.36,-.4,3.6,2,3.2,1);
  // Stylized portal recesses, not an interior reconstruction.
  for(const x of [-1.15,0,1.15]){box(x,1.25,1.215,x===0?.72:.45,x===0?1.45:1.1,.025,4);}
  cylinder(0,-.4,2.36,2.65,.9,.9,1);
  lathe(0,-.4,[[.8,2.63],[1.02,2.9],[1.06,3.18],[.93,3.5],[.65,3.8],[.28,4.03],[.06,4.18],[0,4.2]],1);
  cylinder(0,-.4,4.15,4.6,.035,.01,5);
  for(const x of [-3.35,3.35])for(const z of [-3.05,2.25]){
    cylinder(x,z,.38,3.15,.18,.13,1);
    for(const y of [1.35,2.25,3.15])cylinder(x,z,y,y+.07,.25,.25,1);
    lathe(x,z,[[.22,3.22],[.22,3.43],[.1,3.63],[0,3.71]],1);
  }
  for(const x of [-1.3,1.3])for(const z of [-1.5,.7]){
    cylinder(x,z,2.36,2.65,.26,.26,1);lathe(x,z,[[.3,2.65],[.32,2.8],[.12,3],[0,3.08]],1);
  }
}
function qutb(){
  box(0,.08,0,5,.16,5,0);
  const levels=[[.16,2.1,.72,.56,2],[2.16,3.7,.55,.44,2],[3.76,4.95,.43,.34,2],[5.01,5.9,.33,.27,1],[5.96,6.8,.26,.2,1]];
  for(const [bottom,top,r1,r2,m] of levels){
    cylinder(0,0,bottom,top,r1,r2,m);
    cylinder(0,0,top,top+.06,r2+.17,r2+.17,0);
    // Faceted ribs suggest fluting; inscriptions and individual carvings are omitted.
    for(let i=0;i<20;i++){const a=i*Math.PI/10;const r=(r1+r2)/2;cylinder(Math.cos(a)*r,Math.sin(a)*r,bottom,top,.035,.025,m);}
    for(let j=1;j<3;j++){const y=bottom+(top-bottom)*j/3;const r=r1+(r2-r1)*j/3;cylinder(0,0,y,y+.055,r+.012,r+.012,5);}
  }
}
function glb(){
  const chunks=[],views=[],accessors=[],meshes=[],nodes=[];let offset=0;
  // Merge geometry sharing a material to keep draw calls low on laptop GPUs.
  const used=[...new Set(parts.map(p=>p.material))];
  const grouped=used.map(material=>({material,p:parts.filter(p=>p.material===material).flatMap(p=>p.p),n:parts.filter(p=>p.material===material).flatMap(p=>p.n)}));
  function accessor(values,isPosition){
    const data=Buffer.from(new Float32Array(values).buffer),view=views.length;
    views.push({buffer:0,byteOffset:offset,byteLength:data.length,target:34962});chunks.push(data);offset+=data.length;
    const a={bufferView:view,componentType:5126,count:values.length/3,type:'VEC3'};
    if(isPosition){a.min=[0,1,2].map(i=>Math.min(...values.filter((_,j)=>j%3===i)));a.max=[0,1,2].map(i=>Math.max(...values.filter((_,j)=>j%3===i)));}
    accessors.push(a);return accessors.length-1;
  }
  for(const part of grouped){meshes.push({primitives:[{attributes:{POSITION:accessor(part.p,true),NORMAL:accessor(part.n,false)},material:used.indexOf(part.material)}]});nodes.push({mesh:meshes.length-1});}
  const json={asset:{version:'2.0',generator:'HistoFacts original educational geometry v1',copyright:'2026 Apoorva Puranik; MIT'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:used.map(i=>({pbrMetallicRoughness:{baseColorFactor:materials[i],metallicFactor:0,roughnessFactor:.85}})),buffers:[{byteLength:offset}],bufferViews:views,accessors};
  let data=Buffer.from(JSON.stringify(json));data=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+data.length+offset,8);header.writeUInt32LE(data.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bin=Buffer.alloc(8);bin.writeUInt32LE(offset);bin.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,data,bin,...chunks]);
}
const posters={
  'great-pyramid':'<path d="M80 235 230 62 380 235Z" fill="#c9a267"/><path d="m230 62 38 173h112Z" fill="#987142"/><path d="M80 235h300" stroke="#dfc494"/>',
  'taj-mahal':'<g fill="#ece4cf"><path d="M148 235v-88h164v88Z"/><path d="M189 145c-35-47 25-57 41-88 16 31 76 41 41 88Z"/><path d="M102 235V115h12v120m232 0V115h12v120"/><path d="m95 115 13-27 13 27m218 0 13-27 13 27"/></g><path d="M211 235v-55q19-37 38 0v55" fill="#414c46"/><path d="M80 240h300" stroke="#c9a267" stroke-width="8"/>',
  'qutub-minar':'<path d="m195 240 22-190h26l22 190Z" fill="#b87850"/><g stroke="#e1c396" stroke-width="7"><path d="M198 209h64m-60-39h56m-51-40h46m-41-38h36m-32-40h28"/></g><path d="M165 244h130" stroke="#c9a267" stroke-width="9"/>',
};
for(const [id,build] of [['great-pyramid',pyramid],['taj-mahal',taj],['qutub-minar',qutb]]){
  parts=[];build();await mkdir(`${root}/${id}`,{recursive:true});const data=glb();await writeFile(`${root}/${id}/monument.glb`,data);
  await writeFile(`${root}/${id}/poster.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 300"><rect width="460" height="300" fill="#26332e"/><ellipse cx="230" cy="245" rx="170" ry="18" fill="#1d2924"/>${posters[id]}</svg>`);
  console.log(`${id}: ${data.length} bytes`);
}
