let currentProject = {
  title:"Premium Scandinavian Botanical Seamless Pattern",
  description:"Elegant flat botanical seamless vector pattern with soft foliage, flowers and seed pods for textile, wallpaper and packaging design.",
  concept:"Clean commercial evergreen botanical pattern with balanced handmade spacing.",
  category:"Botanical",
  theme:"Scandinavian Botanical",
  elements:["eucalyptus stem","olive branch","sage sprig","minimal flower","seed pod","tiny dot accent","curved foliage","rounded leaf","laurel branch","wildflower bud","fern frond","berry cluster","herb stem","small blossom","organic twig","leaf pair","flower head","botanical spray","soft petal","mini sprig","seed stem","leaf cluster","airy branch","oval leaf","tiny bloom","minimal berry","small pod","accent dot"],
  keywords:["botanical","seamless","pattern","vector","floral","leaves","scandinavian","minimal","flat design","surface pattern","textile","wallpaper","fabric","background","nature","foliage","eucalyptus","olive","sage","green","neutral","beige","organic","repeat","tile","modern","clean","commercial","decorative","botany","flower","seed pod","branch","spring","evergreen","wrapping paper","packaging","stationery","home decor","nursery","simple","elegant","natural","abstract botanical","leaf pattern","floral pattern","editable","stock illustration","soft color","minimalist"],
  palette:["#D8C7AE","#A8B08C","#7B8453","#F3EBDD","#C98A6A"],
  originality_notes:["Use generic botanical forms only","Avoid copying identifiable artwork","Edit final SVG manually in Affinity Designer"]
};
let currentSVG = "";
const $ = id => document.getElementById(id);
function init(){
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  $('darkModeBtn').onclick=()=>document.body.classList.toggle('dark');
  initThemes(); bindActions(); updateDashboard(); fillFromProject(); buildPrompt(); loadProject(currentProject);
}
function showTab(id){document.querySelectorAll('.tab').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));}
function initThemes(){
  const cat=$('categorySelect'); cat.innerHTML=Object.keys(THEME_LIBRARY).map(c=>`<option>${c}</option>`).join('');
  cat.onchange=refreshThemeSelect; refreshThemeSelect();
}
function refreshThemeSelect(){
  const category=$('categorySelect').value; const theme=$('themeSelect');
  theme.innerHTML=THEME_LIBRARY[category].map(t=>`<option>${t}</option>`).join(''); theme.onchange=showThemeDetail; showThemeDetail();
}
function showThemeDetail(){
  const t=$('themeSelect').value, d=THEME_DATA[t];
  $('themeDetail').innerHTML=`<b>${d.theme}</b><br>Category: ${d.category}<br>${d.promptHint}<br><br><b>Suggested palette:</b> ${d.palette.join(', ')}`;
}
function fillFromProject(){
  $('collectionName').value=currentProject.title; $('elementsCount').value=currentProject.elements.length; $('artboard').value=10000; $('palette').value=currentProject.palette.join(',');
}
function bindActions(){
  $('applyThemeBtn').onclick=()=>{const t=$('themeSelect').value,d=THEME_DATA[t]; currentProject.category=d.category; currentProject.theme=d.theme; currentProject.palette=d.palette; currentProject.title=`Premium ${d.theme} Seamless Vector Pattern`; currentProject.description=`Commercial ${d.theme.toLowerCase()} seamless vector pattern in clean flat editable style for textile, wallpaper, packaging and surface design.`; $('collectionName').value=currentProject.title; $('palette').value=d.palette.join(','); buildPrompt(); alert('ใช้ Theme แล้ว');};
  $('buildPromptBtn').onclick=buildPrompt; $('copyPromptBtn').onclick=()=>copyText($('promptBox').value);
  $('loadJsonBtn').onclick=()=>{try{const obj=JSON.parse(cleanJson($('jsonInput').value)); loadProject(obj);}catch(e){$('jsonStatus').textContent='JSON ไม่ถูกต้อง: '+e.message;}};
  $('sampleJsonBtn').onclick=()=>{$('jsonInput').value=JSON.stringify(currentProject,null,2);};
  $('generateSvgBtn').onclick=()=>renderSVG(false); $('preview3Btn').onclick=()=>renderSVG(true); $('runGuardBtn').onclick=runGuard;
  $('buildCollectionBtn').onclick=buildCollection; $('buildMetadataBtn').onclick=buildMetadata; $('copyMetadataBtn').onclick=()=>copyText($('metadataBox').value);
  $('downloadSvgBtn').onclick=()=>download('pattern.svg',currentSVG||generatePatternSVG(currentProject),'image/svg+xml');
  $('downloadCsvBtn').onclick=()=>download('metadata.csv',metadataCSV(currentProject),'text/csv');
  $('downloadJsonBtn').onclick=()=>download('project.json',JSON.stringify(currentProject,null,2),'application/json');
}
function cleanJson(s){return s.trim().replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();}
function buildPrompt(){
 const theme=currentProject.theme||$('themeSelect')?.value||'Scandinavian Botanical'; const category=currentProject.category||$('categorySelect')?.value||'Botanical';
 const count=Number($('elementsCount').value||28); const art=Number($('artboard').value||10000); const pal=$('palette').value;
 const prompt=`คุณคือนักออกแบบเวคเตอร์ stock ระดับมืออาชีพ ช่วยออกแบบ concept สำหรับ seamless vector pattern ที่ขายดี โดยต้องไม่ลอกงานใด ๆ และหลีกเลี่ยงแบรนด์ โลโก้ ตัวละคร ลิขสิทธิ์ ภาพบุคคล และทรัพย์สินทางปัญญา\n\nเงื่อนไข:\n- Category: ${category}\n- Theme: ${theme}\n- Style: ${$('styleText').value}\n- Artboard: ${art}x${art}px\n- Elements: ${count} ชิ้น แบ่งเป็น hero motifs, medium motifs, small fillers, tiny accents\n- Color palette: ${pal}\n\nตอบกลับเป็น JSON เท่านั้น ห้ามใส่ markdown และต้องมี schema นี้:\n{\n  "title":"English stock title under 70 chars",\n  "description":"English description under 200 chars",\n  "concept":"Short original concept",\n  "category":"${category}",\n  "theme":"${theme}",\n  "elements":["${count} unique generic vector element names"],\n  "keywords":["exactly 50 stock keywords"],\n  "palette":["#HEX colors"],\n  "originality_notes":["3-5 practical notes to avoid copying and improve human editing"]\n}\n\nข้อกำหนดสำคัญ:\n- keywords ต้องมี 50 คำพอดี\n- elements ต้องเป็น generic motifs เท่านั้น เช่น leaf stem, seed pod, abstract flower ห้ามใช้ชื่อแบรนด์ ศิลปิน ตัวละคร\n- title และ description ต้องเหมาะสำหรับ Adobe Stock/Shutterstock\n- concept ต้องมีความต่างเชิงองค์ประกอบจากงานทั่วไป`;
 $('promptBox').value=prompt;
}
function loadProject(obj){
 currentProject={...currentProject,...obj};
 if(typeof currentProject.palette==='string') currentProject.palette=currentProject.palette.split(',').map(x=>x.trim());
 currentProject.elements=currentProject.elements||[]; currentProject.keywords=currentProject.keywords||[];
 $('jsonStatus').textContent='นำข้อมูลเข้าแล้ว';
 $('jsonSummary').innerHTML=`<p><b>Title:</b> ${currentProject.title}</p><p><b>Theme:</b> ${currentProject.theme}</p><p><b>Elements:</b> ${currentProject.elements.length}</p><p><b>Keywords:</b> ${currentProject.keywords.length}</p>`;
 updateDashboard(); buildMetadata(); runGuard(); renderSVG(false);
}
function renderSVG(rep){currentSVG=generatePatternSVG({...currentProject, artboard:Number($('artboard').value||10000)},rep); $('svgPreview').innerHTML=currentSVG; showTab('preview');}
function updateDashboard(){ $('themeCount').textContent=Object.values(THEME_LIBRARY).reduce((a,b)=>a+b.length,0); $('keywordCount').textContent=currentProject.keywords?.length||0; }
function runGuard(){
 const e=currentProject.elements||[], k=currentProject.keywords||[]; const dupE=e.length-new Set(e.map(x=>x.toLowerCase())).size; const dupK=k.length-new Set(k.map(x=>x.toLowerCase())).size;
 const issues=[]; if(k.length!==50) issues.push(`Keywords ควรมี 50 คำ ตอนนี้มี ${k.length}`); if(dupK) issues.push(`พบ keyword ซ้ำ ${dupK} รายการ`); if(dupE) issues.push(`พบ element ซ้ำ ${dupE} รายการ`); if(e.length<20) issues.push('Elements น้อยเกินไป ควร 28+'); if(!issues.length) issues.push('ผ่าน checklist เบื้องต้น แต่ยังต้องตรวจภาพอ้างอิง/ลิขสิทธิ์ด้วยตนเอง');
 $('guardReport').innerHTML='<ul>'+issues.map(i=>`<li>${i}</li>`).join('')+'</ul><p class="warn">ก่อนส่งขาย: เปิด SVG ใน Affinity Designer แล้วปรับรูปทรง/ตำแหน่ง/สีด้วยมือทุกครั้ง</p>';
}
function buildCollection(){
 const n=Math.min(100,Math.max(1,Number($('collectionSize').value||10))); const base=currentProject.theme||'Pattern'; let rows='';
 for(let i=1;i<=n;i++){rows+=`<tr><td>${i}</td><td>${base} Variation ${String(i).padStart(2,'0')}</td><td>${pick(currentProject.palette||[],i)}, ${pick(currentProject.palette||[],i+2)}</td><td>Change hero motif rotation, scale and filler density</td></tr>`;}
 $('collectionList').innerHTML=`<table><thead><tr><th>#</th><th>Design Name</th><th>Palette Focus</th><th>Human Edit Plan</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function buildMetadata(){const m=makeMetadata(currentProject); $('metadataBox').value=`ADOBE STOCK\nTitle: ${m.adobe.title}\nDescription: ${m.adobe.description}\nKeywords: ${m.adobe.keywords}\nCategory: ${m.adobe.category}\n\nSHUTTERSTOCK\nTitle: ${m.shutterstock.title}\nDescription: ${m.shutterstock.description}\nKeywords: ${m.shutterstock.keywords}\n\nFREEPIK\nTitle: ${m.freepik.title}\nTags: ${m.freepik.tags}`;}
function copyText(t){navigator.clipboard?.writeText(t).then(()=>alert('คัดลอกแล้ว')).catch(()=>alert('คัดลอกไม่สำเร็จ ให้กดเลือกข้อความแล้ว Copy เอง'));}
function download(name, content, type){const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href);}
function pick(arr,i){return arr && arr.length ? arr[i%arr.length] : ''}
document.addEventListener('DOMContentLoaded',init);
