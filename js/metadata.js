function makeMetadata(project){
  const kws = (project.keywords||[]).slice(0,50);
  while(kws.length<50) kws.push(["vector","pattern","seamless","flat design","stock illustration","surface design","wallpaper","textile","background","editable"][kws.length%10]);
  return {
    adobe: {title: (project.title||"Premium Seamless Vector Pattern").slice(0,70), description:(project.description||"Clean editable seamless vector pattern for fabric, wallpaper, packaging and surface design.").slice(0,200), keywords:kws.join(", "), category: project.category||"Illustrations"},
    shutterstock: {title:(project.title||"Premium Seamless Vector Pattern").slice(0,80), description:(project.description||"Clean editable seamless vector pattern for commercial surface design.").slice(0,200), keywords:kws.join(", ")},
    freepik: {title:project.title||"Premium Seamless Vector Pattern", tags:kws.join(", ")}
  }
}
function metadataCSV(project){
  const m = makeMetadata(project); const esc=v=>'"'+String(v||'').replaceAll('"','""')+'"';
  return ["platform,title,description,keywords,category",["Adobe Stock",m.adobe.title,m.adobe.description,m.adobe.keywords,m.adobe.category].map(esc).join(','),["Shutterstock",m.shutterstock.title,m.shutterstock.description,m.shutterstock.keywords,"Vector"].map(esc).join(','),["Freepik",m.freepik.title,"",m.freepik.tags,"Vector"].map(esc).join(',')].join('\n');
}
