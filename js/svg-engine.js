function hashCode(str){let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}return Math.abs(h)}
function pick(arr,i){return arr[i%arr.length]}
function escapeXml(s){return String(s||'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[m]))}
function motifSVG(name,x,y,scale,rot,color,stroke){
  const type = hashCode(name)%7;
  const tr = `translate(${x} ${y}) rotate(${rot}) scale(${scale})`;
  if(type===0) return `<g transform="${tr}" fill="none" stroke="${stroke}" stroke-width="18" stroke-linecap="round"><path d="M0 140 C70 40 80 -60 20 -150"/><ellipse cx="-30" cy="40" rx="38" ry="76" fill="${color}" stroke="none"/><ellipse cx="50" cy="-40" rx="35" ry="70" fill="${color}" stroke="none"/><ellipse cx="5" cy="-110" rx="28" ry="55" fill="${color}" stroke="none"/></g>`;
  if(type===1) return `<g transform="${tr}" fill="${color}" stroke="${stroke}" stroke-width="10"><circle cx="0" cy="0" r="72"/><circle cx="-55" cy="50" r="36"/><circle cx="55" cy="50" r="36"/><path d="M0 75 C20 120 -10 160 -60 180" fill="none"/></g>`;
  if(type===2) return `<g transform="${tr}" fill="${color}" stroke="${stroke}" stroke-width="8"><path d="M0 -120 C90 -80 110 40 0 140 C-110 40 -90 -80 0 -120Z"/><path d="M0 -90 L0 110" fill="none"/><path d="M0 -20 C40 -10 60 10 80 40" fill="none"/></g>`;
  if(type===3) return `<g transform="${tr}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"><path d="M-110 0 C-30 -90 30 90 110 0"/><path d="M-80 60 C-20 10 30 80 90 35"/><circle cx="-120" cy="8" r="20" fill="${color}" stroke="none"/><circle cx="120" cy="-8" r="20" fill="${color}" stroke="none"/></g>`;
  if(type===4) return `<g transform="${tr}" fill="${color}" stroke="none"><rect x="-80" y="-80" width="160" height="160" rx="42"/><circle cx="-95" cy="95" r="28"/><circle cx="95" cy="-95" r="28"/></g>`;
  if(type===5) return `<g transform="${tr}" fill="${color}" stroke="${stroke}" stroke-width="8"><path d="M0 -100 L24 -28 L100 -28 L38 16 L62 92 L0 48 L-62 92 L-38 16 L-100 -28 L-24 -28Z"/></g>`;
  return `<g transform="${tr}" fill="${color}" stroke="${stroke}" stroke-width="8"><ellipse cx="0" cy="0" rx="110" ry="48"/><ellipse cx="0" cy="0" rx="48" ry="110" opacity=".72"/><circle cx="0" cy="0" r="22" fill="${stroke}"/></g>`;
}
function generatePatternSVG(project, repeat3=false){
  const size = Number(project.artboard || 10000);
  const view = repeat3 ? size*3 : size;
  const palette = (project.palette && project.palette.length ? project.palette : ["#D8C7AE","#A8B08C","#7B8453","#F3EBDD","#C98A6A"]);
  const bg = palette[3] || "#F3EBDD";
  const stroke = palette[2] || "#7B8453";
  const elements = project.elements && project.elements.length ? project.elements : ["leaf stem","flower pod","branch","dot accent"];
  let defs = `<pattern id="tile" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${bg}"/>`;
  const total = Math.max(16, elements.length);
  for(let i=0;i<total;i++){
    const name = elements[i%elements.length];
    const h = hashCode(name+i+project.title);
    const x = (h*37 % size);
    const y = (h*91 % size);
    const sc = 3.8 + (h%220)/100;
    const rot = h%360;
    const color = pick(palette, i);
    const m = motifSVG(name,x,y,sc,rot,color,stroke);
    defs += m;
    if(x<900) defs += motifSVG(name,x+size,y,sc,rot,color,stroke);
    if(y<900) defs += motifSVG(name,x,y+size,sc,rot,color,stroke);
    if(x>size-900) defs += motifSVG(name,x-size,y,sc,rot,color,stroke);
    if(y>size-900) defs += motifSVG(name,x,y-size,sc,rot,color,stroke);
  }
  defs += `</pattern>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${view}" height="${view}" viewBox="0 0 ${view} ${view}" role="img" aria-label="${escapeXml(project.title||'pattern')}"><defs>${defs}</defs><rect width="${view}" height="${view}" fill="url(#tile)"/></svg>`;
}
