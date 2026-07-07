import { FAMILY_IDS, STYLE_MODULES } from './core/families.js';
import { PALETTES } from './core/palettes.js';
import { COMPOSITIONS, PATTERN_TYPES } from './core/layout.js';
import { compose } from './core/engine.js';
import { defaultSchema, repairJson } from './core/schema.js';
import { buildPrompt } from './core/prompt.js';
import { metadataCsv } from './core/metadata.js';
import { runQc } from './core/qc.js';
import { download } from './core/export.js';
import { IDEAS } from './core/ideas.js';

const $ = (id) => document.getElementById(id);

const state = {
  schema: defaultSchema('botanical'),
  currentSVG: '',
  motifCount: 0,
};

function currentPaletteArray() {
  return PALETTES[$('paletteName').value] || Object.values(PALETTES)[0];
}

function fillSelect(id, options, labelFn = (v) => v) {
  $(id).innerHTML = options.map((v) => `<option value="${v}">${labelFn(v)}</option>`).join('');
}

function renderSwatches(palette) {
  $('swatches').innerHTML = palette.map((c) => `<span class="swatch" style="background:${c}"></span>`).join('');
}

function renderIdeaChips(familyId) {
  const ideas = IDEAS[familyId] || [];
  $('ideaChips').innerHTML = ideas
    .map((idea, i) => `<button class="chip" data-idea="${i}">${idea.title}</button>`)
    .join('');
  $('ideaChips').querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => applyIdea(ideas[Number(btn.dataset.idea)]));
  });
}

function refreshUIFromSchema() {
  $('family').value = state.schema.family;
  $('patternType').value = state.schema.patternType;
  $('composition').value = state.schema.composition;
  $('seed').value = state.schema.seed;
  $('exportSize').value = String(state.schema.exportSize);
  $('concept').value = state.schema.concept;
  const paletteName = Object.keys(PALETTES).find((name) => PALETTES[name] === state.schema.palette)
    || STYLE_MODULES[state.schema.family].FAMILY.paletteDefault;
  $('paletteName').value = paletteName;
  renderSwatches(state.schema.palette);
  renderIdeaChips(state.schema.family);
}

function applyIdea(idea) {
  state.schema.concept = idea.concept;
  state.schema.title = idea.title;
  state.schema.metadata.title = idea.title;
  state.schema.metadata.description = `Editable seamless vector pattern: ${idea.concept}.`;
  state.schema.palette = PALETTES[idea.palette] || state.schema.palette;
  state.schema.seed = `KOKO-${Math.floor(100000 + Math.random() * 900000)}`;
  refreshUIFromSchema();
  generate();
}

function generate() {
  const { svg, motifCount } = compose(state.schema);
  state.currentSVG = svg;
  state.motifCount = motifCount;
  $('preview').innerHTML = svg;
  $('status').textContent = 'generated';
  $('motifCount').textContent = `${motifCount} motifs`;
  const qc = runQc(state.schema, motifCount);
  $('score').textContent = `${qc.score}/10`;
  renderRepeat();
}

function renderRepeat() {
  $('repeatGrid').innerHTML = Array.from({ length: 9 }, () => `<div class="mini">${state.currentSVG}</div>`).join('');
}

function randomizeAll() {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.schema.seed = `KOKO-${Math.floor(100000 + Math.random() * 900000)}`;
  state.schema.patternType = rand(PATTERN_TYPES);
  state.schema.composition = rand(COMPOSITIONS);
  state.schema.palette = PALETTES[rand(Object.keys(PALETTES))];
  refreshUIFromSchema();
  generate();
}

function switchFamily(familyId) {
  state.schema = defaultSchema(familyId, {
    seed: $('seed').value,
    exportSize: Number($('exportSize').value),
  });
  refreshUIFromSchema();
  generate();
}

function sampleAiJson() {
  const s = state.schema;
  return {
    title: s.title,
    description: s.metadata.description,
    concept: s.concept,
    palette: s.palette,
    assets: s.assets,
    metadata: { keywords: s.metadata.keywords },
  };
}

function renderCollection() {
  $('collectionGrid').innerHTML = PATTERN_TYPES.map((type, i) => {
    const schema = { ...state.schema, patternType: type, seed: `${state.schema.seed}-${i}` };
    const { svg } = compose(schema);
    return `<figure><div class="mini">${svg}</div><figcaption>${type}</figcaption></figure>`;
  }).join('');
}

function renderColorways() {
  $('colorwayGrid').innerHTML = Object.keys(PALETTES).map((name) => {
    const schema = { ...state.schema, palette: PALETTES[name] };
    const { svg } = compose(schema);
    return `<figure><div class="mini">${svg}</div><figcaption>${name}</figcaption></figure>`;
  }).join('');
}

function showTab(id) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === id));
  if (id === 'collection') renderCollection();
  if (id === 'colorways') renderColorways();
  if (id === 'prompt') buildPromptBox();
  if (id === 'qc') runQcTab();
}

function buildPromptBox() {
  const famLabel = STYLE_MODULES[state.schema.family].FAMILY.label;
  $('promptBox').value = buildPrompt(state.schema, famLabel);
}

function runQcTab() {
  const qc = runQc(state.schema, state.motifCount);
  $('qcScore').textContent = `${qc.score}/10`;
  $('qcText').value = qc.text;
}

function bind() {
  fillSelect('family', FAMILY_IDS, (id) => STYLE_MODULES[id].FAMILY.label);
  fillSelect('patternType', PATTERN_TYPES);
  fillSelect('composition', COMPOSITIONS);
  fillSelect('paletteName', Object.keys(PALETTES));

  document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  $('family').addEventListener('change', () => switchFamily($('family').value));
  ['patternType', 'composition', 'paletteName', 'exportSize'].forEach((id) => {
    $(id).addEventListener('change', () => {
      state.schema.patternType = $('patternType').value;
      state.schema.composition = $('composition').value;
      state.schema.palette = currentPaletteArray();
      state.schema.exportSize = Number($('exportSize').value);
      renderSwatches(state.schema.palette);
      generate();
    });
  });
  $('seed').addEventListener('change', () => { state.schema.seed = $('seed').value; generate(); });
  $('concept').addEventListener('change', () => { state.schema.concept = $('concept').value; });

  $('btnRandomSeed').addEventListener('click', () => {
    $('seed').value = `KOKO-${Math.floor(100000 + Math.random() * 900000)}`;
    state.schema.seed = $('seed').value;
    generate();
  });
  $('btnRandomIdea').addEventListener('click', () => {
    const ideas = IDEAS[state.schema.family];
    applyIdea(ideas[Math.floor(Math.random() * ideas.length)]);
  });

  $('btnGenerate').addEventListener('click', generate);
  $('btnRandomize').addEventListener('click', randomizeAll);
  $('btnExportSvg').addEventListener('click', () => download(`${state.schema.family}_pattern.svg`, state.currentSVG, 'image/svg+xml'));
  $('btnGoPrompt').addEventListener('click', () => showTab('prompt'));
  $('btnRepeat').addEventListener('click', renderRepeat);

  $('btnSampleJson').addEventListener('click', () => {
    $('jsonInput').value = JSON.stringify(sampleAiJson(), null, 2);
    $('jsonStatus').textContent = 'สร้าง JSON ตัวอย่างแล้ว';
  });
  $('btnRepairJson').addEventListener('click', () => {
    try {
      const repaired = repairJson($('jsonInput').value, state.schema);
      $('jsonInput').value = JSON.stringify(repaired, null, 2);
      $('jsonStatus').textContent = 'ปรับ JSON สำเร็จ';
    } catch (e) {
      $('jsonStatus').textContent = e.message;
    }
  });
  $('btnApplyJson').addEventListener('click', () => {
    try {
      state.schema = repairJson($('jsonInput').value, state.schema);
      $('jsonStatus').textContent = 'นำ JSON เข้า Engine สำเร็จ';
      refreshUIFromSchema();
      showTab('studio');
      generate();
    } catch (e) {
      $('jsonStatus').textContent = e.message;
    }
  });
  const dropZone = $('dropZone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#fff3ce'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.background = ''; });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      $('jsonInput').value = await file.text();
      $('btnRepairJson').click();
    }
  });

  $('btnCollection').addEventListener('click', renderCollection);
  $('btnCollectionCsv').addEventListener('click', () => download('metadata.csv', metadataCsv(state.schema), 'text/csv;charset=utf-8'));
  $('btnColorways').addEventListener('click', renderColorways);

  $('btnBuildPrompt').addEventListener('click', buildPromptBox);
  $('btnCopyPrompt').addEventListener('click', () => navigator.clipboard.writeText($('promptBox').value));
  $('btnOpenChatGpt').addEventListener('click', () => window.open('https://chatgpt.com', '_blank'));
  $('btnOpenClaude').addEventListener('click', () => window.open('https://claude.ai', '_blank'));

  $('btnRunQc').addEventListener('click', runQcTab);
  $('btnDownloadQc').addEventListener('click', () => download('qc_report.txt', runQc(state.schema, state.motifCount).text, 'text/plain;charset=utf-8'));

  $('btnDlSvg').addEventListener('click', () => download(`${state.schema.family}_pattern.svg`, state.currentSVG, 'image/svg+xml'));
  $('btnDlJson').addEventListener('click', () => download(`${state.schema.family}_schema.json`, JSON.stringify(state.schema, null, 2), 'application/json'));
  $('btnDlCsv').addEventListener('click', () => download('metadata.csv', metadataCsv(state.schema), 'text/csv;charset=utf-8'));
  $('btnDlQc').addEventListener('click', () => download('qc_report.txt', runQc(state.schema, state.motifCount).text, 'text/plain;charset=utf-8'));
}

export function init() {
  bind();
  refreshUIFromSchema();
  generate();
  buildPromptBox();
}
