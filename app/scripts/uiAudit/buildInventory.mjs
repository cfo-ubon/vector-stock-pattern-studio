// Builds UI_CONTROL_INVENTORY.csv from the real crawl_results.json data
// (every screen's actually-rendered buttons/links/tabs, captured live from
// the running app) plus manual verdicts for the controls that were
// click-tested during Workflows A-F and the accessibility pass.
import fs from 'node:fs';

const CRAWL = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/crawl_results.json', 'utf8'));

const SCREEN_NAMES = {
  mission_control: 'Mission Control',
  todays_production: "Today's Production",
  design_for_me_today: 'Design for Me Today',
  overview: 'Overview / Project Dashboard',
  pattern_studio: 'Pattern Studio (Design Workbench)',
  portfolio: 'Portfolio Manager',
  backup: 'Backup Manager',
  ai_market_advisor: 'AI Market Advisor',
  ai_design_director: 'AI Design Director',
  advanced_mode: 'Advanced Mode (legacy generator)',
};

// Controls that were actually clicked and observed during Workflows A-F / accessibility pass.
// key: `${screen}|${label}` -> { result, severity, note }
const VERIFIED = {
  "todays_production|▶ START FACTORY": { result: 'PASS', severity: 'P3', note: 'Starts a real Factory session; verified online, offline, and mid-interrupt (Workflow A/B/E).' },
  "mission_control|🏭 Today's Production": { result: 'CONFUSING', severity: 'P2', note: "NAV-001: stays highlighted simultaneously with '✨ ออกแบบให้ฉันวันนี้' on every screen — unclear which section is actually active." },
  "mission_control|✨ ออกแบบให้ฉันวันนี้": { result: 'CONFUSING', severity: 'P2', note: 'NAV-001: highlighted active at the same time as another nav button on every screen visited.' },
  "todays_production|Progress": { result: 'PASS', severity: 'P3', note: 'Shows real Production Progress stepper; correctly reflects Running/Packaging/Completed states.' },
  "todays_production|Review (1)": { result: 'CONFUSING', severity: 'P1', note: "Session Summary reports 'Repair: 10' but this Review tab only ever shows the 1 REVIEW-status item — the other 9 REPAIR-status packages are not visible or actionable anywhere in Today's Production." },
  "todays_production|Export ": { result: 'CONFUSING', severity: 'P0', note: 'Export Readiness Dashboard shows 0 Ready / 11 Blocked immediately after a completed Factory run — every freshly generated asset is blocked from commercial export. See BUG-001.' },
  "todays_production|Mark Session Complete": { result: 'PASS', severity: 'P3', note: 'Correctly transitions the batch to Completed and shows an honest Session Summary.' },
  "todays_production|Skip these and continue": { result: 'CONFUSING', severity: 'P2', note: 'Clicking this visibly regressed Progress state from "Packaging" back to "Running" before completing — looks like the batch stalled or looped.' },
  "todays_production|▶ Continue Yesterday": { result: 'PASS', severity: 'P3', note: 'Correctly detects a genuinely unfinished batch and resumes it after a fresh reload (Workflow B).' },
  "portfolio|📤 Export (bulk action bar)": { result: 'PASS', severity: 'P3', note: '10 assets selected -> 2 marketplaces chosen -> real ZIP packages built -> Download Center auto-opened -> real ZIP download confirmed (251KB) (Workflow C).' },
  "portfolio|ดาวน์โหลด ZIP": { result: 'PASS', severity: 'P3', note: 'Triggers a real browser download event with a real non-empty ZIP file (Workflow C).' },
  "portfolio|(asset thumbnail click -> Preview Dialog)": { result: 'PASS', severity: 'P3', note: 'Opens the Preview Dialog with real Commercial Score/SEO/Export Status/Readiness checks (Hotfix v1.0.1).' },
  "portfolio|(Preview Dialog Escape key)": { result: 'BROKEN', severity: 'P2', note: 'Escape does not close the dialog — 6 of 9 portfolio-modal-backdrop dialogs lack Escape handling (see BUG-006).' },
  "backup|+ สร้างไฟล์สำรองใหม่": { result: 'PASS', severity: 'P3', note: 'Builds a real 24-file / ~1.2MB .vspsb backup; shows honest progress/compression stats (Workflow D).' },
  "backup|ดาวน์โหลดไฟล์ ...vspsb": { result: 'PASS', severity: 'P3', note: 'Real file download confirmed (1.2MB) (Workflow D).' },
  "backup|ตรวจสอบไฟล์สำรอง (upload+verify)": { result: 'PASS', severity: 'P3', note: 'Verify returned an honest PASS with checksum counts for the exact file just created (Workflow D).' },
  "backup|กู้คืนข้อมูล -> ยืนยันกู้คืนข้อมูล": { result: 'PASS', severity: 'P3', note: 'Full restore completed; Portfolio still showed all 10 assets afterward — data intact (Workflow D).' },
};

function escapeCsv(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const rows = [];
rows.push(['Screen', 'Control Label', 'Control Type', 'Expected Behavior', 'Observed Behavior / Evidence', 'Result', 'Severity', 'Recommended Fix'].map(escapeCsv).join(','));

for (const screen of CRAWL) {
  const screenName = SCREEN_NAMES[screen.key] || screen.key;
  const seen = new Set();

  const addRow = (label, type) => {
    const dedupeKey = `${screen.key}|${label}|${type}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const verified = VERIFIED[`${screen.key}|${label}`];
    if (verified) {
      rows.push([
        screenName, label, type,
        'Reachable, produces the labelled action, gives visible feedback',
        verified.note,
        verified.result, verified.severity, verified.result === 'PASS' ? '—' : 'See FULL_UI_UX_AUDIT_REPORT.md remediation plan',
      ].map(escapeCsv).join(','));
    } else {
      rows.push([
        screenName, label, type,
        'Reachable, produces the labelled action, gives visible feedback',
        `Enumerated live from the rendered DOM on ${screenName}; not individually clicked during this audit pass (time-boxed to the workflows and controls listed in FULL_UI_UX_AUDIT_REPORT.md).`,
        'NOT INDEPENDENTLY VERIFIED', '—', '—',
      ].map(escapeCsv).join(','));
    }
  };

  for (const b of screen.buttons || []) addRow(b, 'button');
  for (const l of screen.links || []) addRow(l, 'link');
  for (const t of screen.tabs || []) addRow(t, 'tab');
  for (const d of screen.disabledButtons || []) {
    const dedupeKey = `${screen.key}|${d}|disabled-button`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push([
      screenName, d, 'button (disabled)',
      'Disabled state should be explained (title/aria-label) or the reason should be visible nearby',
      'No title/aria-label found on sampled disabled controls during accessibility pass — reason for disablement is usually only inferable from surrounding text, not from the control itself.',
      'MISSING FEEDBACK', 'P3', 'Add title/aria-label explaining why the control is disabled.',
    ].map(escapeCsv).join(','));
  }
}

fs.writeFileSync('/home/user/vector-stock-pattern-studio/UI_CONTROL_INVENTORY.csv', rows.join('\n') + '\n');
console.log('Wrote', rows.length - 1, 'control rows');
