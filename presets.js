'use strict';

/* ===================================================================
   Compressor Presets — real-unit spec data for educational overlay
   =================================================================== */

const COMPRESSOR_PRESETS = {
  free: {
    name: 'Free',
    shortName: 'FREE',
    color: '#9aa0a8',
    desc: '제한 없는 자유 설정 모드. 모든 파라미터를 글로벌 범위 내에서 자유롭게 조절하세요.',
    params: { threshold: -24, ratio: 4, knee: 6, attack: 5, release: 80, hold: 20, makeup: 0 },
    ranges: { threshold: [-80, 0], ratio: [1, 100], knee: [0, 30], attack: [0.02, 300], release: [1, 25000], hold: [0, 500], makeup: [0, 40] },
    specTable: [],
    notes: [],
  },

  la2a: {
    name: 'Teletronix LA-2A',
    shortName: 'LA-2A',
    color: '#d6a24c',
    desc: '광학식(Optical) 진공관 컴프레서 (1962). 어택·릴리즈는 프로그램 의존적으로 직접 조절 불가. 보컬·베이스·어쿠스틱 등 프로그램 의존 특성이 유리한 신호에 주로 사용.',
    params: { threshold: -20, ratio: 3, knee: 14, attack: 10, release: 500, hold: 0, makeup: 15 },
    ranges: { threshold: [-40, -5], ratio: [2, 100], knee: [8, 20], attack: [6, 15], release: [40, 2000], hold: [0, 5], makeup: [0, 40] },
    specTable: [
      ['타입', 'Optical · 진공관(Tube)'],
      ['어택', '~10ms (프로그램 의존, 직접 조절 불가)'],
      ['릴리즈', '40ms ~ 2s (프로그램 의존)'],
      ['비율', '~3:1 (Compress 모드) / 100:1 (Limit 모드)'],
      ['Knee', '항상 Soft (~18dB, 광학 소자 특성)'],
      ['메이크업', '0 ~ +40 dB (Gain 노브)'],
      ['제조', 'Jim Lawrence / Teletronix, 1962'],
    ],
    notes: [
      'Peak Reduction 노브 하나로 임계점 + 압축 강도를 동시에 제어함',
      'COMPRESS / LIMIT 토글 스위치로 비율 전환 (Compress ≈ 3:1, Limit ≈ 100:1)',
      '광학 소자(OTA) 특성상 입력 레벨이 높을수록 어택이 자동으로 빨라짐',
      '어택·릴리즈가 프로그램에 반응하므로 별도 조절 노브 없음',
    ],
  },

  '1176': {
    name: 'UREI 1176LN (Rev E)',
    shortName: '1176',
    color: '#5fb2d4',
    desc: 'FET 방식 초고속 컴프레서 (1967). 어택 20~800μs(마이크로초). 고정 비율 버튼(4/8/12/20:1). 드럼·기타·보컬 트랜지언트 성형에 사용.',
    params: { threshold: -18, ratio: 4, knee: 0, attack: 0.1, release: 200, hold: 0, makeup: 12 },
    ranges: { threshold: [-60, 0], ratio: [4, 20], knee: [0, 2], attack: [0.020, 0.800], release: [50, 1100], hold: [0, 10], makeup: [0, 40] },
    specTable: [
      ['타입', 'FET (Field-Effect Transistor)'],
      ['어택', '20μs ~ 800μs (마이크로초 단위!)'],
      ['릴리즈', '50ms ~ 1.1s'],
      ['비율', '4:1 / 8:1 / 12:1 / 20:1 (4개 고정 버튼)'],
      ['Knee', 'Hard (FET 특성)'],
      ['메이크업', '0 ~ +40 dB (OUTPUT 노브)'],
      ['제조', 'Bill Putnam / UREI, 1967'],
    ],
    notes: [
      'INPUT 노브로 임계점 조절 — 별도 Threshold 노브 없음',
      '어택 노브: 반시계 방향 = 가장 느림, 시계 방향 = 가장 빠름 (역방향 배열!)',
      '"All-buttons" 모드: 4+8+12+20:1 버튼 동시 압입 → FET 포화 영역 동작, 고조파 왜곡 증가',
      '어택이 20~800μs로 매우 빠르므로 트랜지언트 성형 및 퍼커시브 소스에 탁월',
    ],
  },

  fairchild: {
    hidden: true, // DEV-ONLY
    name: 'Fairchild 670',
    shortName: 'FC-670',
    color: '#cf7da0',
    desc: '진공관 방식 최고가 빈티지 컴프레서 (1959). 6단계 Time Constant 스위치. 스테레오·Mid-Side 처리 가능. 마스터버스·스트링에 사용.',
    params: { threshold: -15, ratio: 8, knee: 12, attack: 0.4, release: 800, hold: 0, makeup: 10 },
    ranges: { threshold: [-40, 0], ratio: [2, 30], knee: [8, 20], attack: [0.2, 0.8], release: [300, 25000], hold: [0, 50], makeup: [0, 30] },
    specTable: [
      ['타입', '진공관(Tube) VCA · 스테레오'],
      ['어택', '200μs ~ 800μs (6단 Time Constant 스위치)'],
      ['릴리즈', '300ms ~ 25s (6단 Time Constant 스위치)'],
      ['비율', '~2:1 ~ 30:1 (프로그램 의존)'],
      ['Knee', 'Soft (진공관 특성)'],
      ['메이크업', '고정형 (Threshold Bias로 압축량 조절)'],
      ['제조', 'Rein Narma / Fairchild, 1959'],
    ],
    notes: [
      'Time Constant(T/C) 스위치 1~6: 값이 클수록 어택과 릴리즈 모두 느려짐',
      'Threshold(Bias) 노브로 압축 진입 세기 제어 (메이크업은 고정)',
      '릴리즈 최대 25초 — 매우 느린 특성으로 마스터버스에서 자주 사용',
      '스테레오 링크 + Mid/Side(M-S) 동시 처리 기능 탑재 (당시로선 혁신적)',
    ],
  },

  ssl: {
    name: 'SSL G-Bus',
    shortName: 'SSL-G',
    color: '#9b8cd8',
    desc: 'SSL 4000 G 콘솔 내장 버스 컴프레서 (1980s). 고속 VCA 설계. 믹스버스에서 채널 간 다이나믹 상호작용(Glue)을 유발하는 특성으로 알려짐.',
    params: { threshold: -15, ratio: 4, knee: 2, attack: 1, release: 200, hold: 0, makeup: 8 },
    ranges: { threshold: [-15, 0], ratio: [2, 10], knee: [0, 4], attack: [0.1, 30], release: [100, 1200], hold: [0, 20], makeup: [0, 20] },
    specTable: [
      ['타입', 'VCA (Solid State Logic)'],
      ['어택', '0.1 / 0.3 / 1 / 3 / 10 / 30ms (6포지션)'],
      ['릴리즈', '0.1 / 0.3 / 0.6 / 1.2s + Auto (5포지션)'],
      ['비율', '2:1 / 4:1 / 10:1 (3포지션)'],
      ['Knee', 'Hard에 가깝게 (VCA)'],
      ['메이크업', '0 ~ +20 dB'],
      ['제조', 'Solid State Logic, 1980s'],
    ],
    notes: [
      'Attack: 0.1 / 0.3 / 1 / 3 / 10 / 30ms — 6포지션 스텝 스위치 (연속 조절 없음)',
      'Release: 0.1 / 0.3 / 0.6 / 1.2s + Auto — 5포지션 (Auto = 신호 의존적)',
      'Ratio: 2 / 4 / 10:1 — 단 3포지션만 존재 (중간값 설정 불가)',
      '믹스버스에서 채널 간 다이나믹 상호작용(Glue) 효과로 버스 컴프레서로 주로 사용됨',
    ],
  },

  dbx160: {
    hidden: true, // DEV-ONLY
    name: 'dbx 160',
    shortName: 'DBX160',
    color: '#6fb98a',
    desc: 'Over Easy® VCA 컴프레서 (1976). 프로그램 의존적 초고속 응답. Soft Knee 방식의 원조. 드럼·베이스에 강력하고 빠른 압축 특성.',
    params: { threshold: -20, ratio: 10, knee: 8, attack: 0.5, release: 80, hold: 0, makeup: 12 },
    ranges: { threshold: [-60, 0], ratio: [1, 100], knee: [4, 14], attack: [0.1, 5], release: [1, 500], hold: [0, 30], makeup: [0, 30] },
    specTable: [
      ['타입', 'VCA (Over Easy® 방식)'],
      ['어택', '<0.5ms (프로그램 의존, 직접 조절 불가)'],
      ['릴리즈', '<2ms ~ 250ms (프로그램 의존)'],
      ['비율', '1:1 ~ ∞:1 (연속 조절)'],
      ['Knee', 'Over Easy® — Soft Knee의 원조 특허 기술'],
      ['메이크업', '0 ~ +30 dB'],
      ['제조', 'David Blackmer / dbx, 1976'],
    ],
    notes: [
      '"Over Easy®" — 임계점 전후를 부드럽게 연결하는 Soft Knee의 원조 특허 기술',
      '어택·릴리즈가 프로그램에 의존 (자동 최적화, 노브 없음)',
      '비율이 1:1 ~ ∞:1로 매우 넓어 컴프레서와 리미터를 하나로 겸용',
      '드럼 룸, 베이스 DI, 버스 채널 등 강한 압축이 필요한 곳에 주로 사용',
    ],
  },

  neve33609: {
    hidden: true, // DEV-ONLY
    name: 'Neve 33609',
    shortName: 'NEVE',
    color: '#82ab86',
    desc: 'Neve 트랜스포머 기반 버스 컴프레서 (1969). 트랜스포머 포화에 의한 저역 강조 및 짝수 고조파 왜곡 특성. 단계별(스텝 스위치) 설정. 마스터버스·스트링·패드에 주로 사용.',
    params: { threshold: -20, ratio: 4, knee: 6, attack: 10, release: 300, hold: 0, makeup: 10 },
    ranges: { threshold: [-30, 0], ratio: [1.5, 8], knee: [4, 10], attack: [3, 100], release: [100, 600], hold: [0, 30], makeup: [0, 20] },
    specTable: [
      ['타입', 'VCA + 트랜스포머(Transformer)'],
      ['어택', '3 / 10 / 30 / 100ms (4단 스위치)'],
      ['릴리즈', '100 / 300 / 600ms + Auto (4단)'],
      ['비율', '1.5 / 2 / 3 / 4 / 6 / 8:1 (6단)'],
      ['Knee', 'Soft-ish (트랜스포머 특성)'],
      ['메이크업', '0 ~ +20 dB'],
      ['제조', 'Rupert Neve / Neve Electronics, 1969'],
    ],
    notes: [
      'Attack: 3 / 10 / 30 / 100ms — 4단계 스텝 스위치',
      'Release: 100 / 300 / 600ms + Auto — 4단계 스텝 스위치',
      'Ratio: 1.5 / 2 / 3 / 4 / 6 / 8:1 — 6단계 스텝 스위치',
      '트랜스포머 포화(Saturation) 특성으로 저역 에너지 증가 및 짝수 고조파(Even Harmonic) 왜곡 추가',
    ],
  },

  distressor: {
    hidden: true, // DEV-ONLY
    name: 'Empirical Labs Distressor',
    shortName: 'DSTRSS',
    color: '#b8c0cc',
    desc: '현대적 멀티 캐릭터 컴프레서 (1990s). Dist 왜곡 모드 + Nuke(∞:1) 포함. 어택 0.05ms~50ms, 릴리즈 50ms~3.5s로 적용 범위가 넓음.',
    params: { threshold: -20, ratio: 4, knee: 4, attack: 2, release: 200, hold: 10, makeup: 12 },
    ranges: { threshold: [-60, 0], ratio: [1, 100], knee: [0, 12], attack: [0.05, 50], release: [50, 3500], hold: [0, 50], makeup: [0, 30] },
    specTable: [
      ['타입', 'VCA (멀티 캐릭터 에뮬레이션)'],
      ['어택', '0.05ms ~ 50ms (연속 조절)'],
      ['릴리즈', '50ms ~ 3.5s (연속 조절)'],
      ['비율', '1 / 2 / 3 / 4 / 6 / 10 / 20 / ∞:1 (NUKE)'],
      ['Knee', '0 ~ variable (조절 가능)'],
      ['메이크업', '0 ~ +30 dB'],
      ['제조', 'Dave Derr / Empirical Labs, 1990s'],
    ],
    notes: [
      'Dist 1·2·3 모드로 고조파(Harmonic) 왜곡 캐릭터 선택 가능',
      '"Nuke" 모드: ∞:1 비율로 극단적 클리핑/하드 리미팅',
      'HP Sidechain, Stereo Link, Emphasis(Presence boost) 기능 내장',
      '어택·릴리즈 범위가 매우 넓고, 왜곡 모드가 있어 거의 모든 용도에 활용',
    ],
  },
};

/* Global (widest) ranges this simulator supports */
const GLOBAL_RANGES = {
  threshold: [-80, 0],
  ratio:     [1,   100],
  knee:      [0,   30],
  attack:    [0.02, 300],
  release:   [1,   25000],
  hold:      [0,   500],
  makeup:    [0,   40],
};

let currentPresetKey = 'free';

/* ── Apply a preset ─────────────────────────────── */
function applyPreset(key) {
  const preset = COMPRESSOR_PRESETS[key];
  if (!preset) return;

  const knobParams = ['threshold', 'ratio', 'knee', 'attack', 'release', 'hold'];

  // Capture old values for flash comparison (before any range / value changes)
  const oldVals = {};
  knobParams.forEach(function (p) {
    const el = document.getElementById(p);
    if (el) oldVals[p] = parseFloat(el.value);
  });

  currentPresetKey = key;

  // 1. Update knob min/max to model's allowed range first
  knobParams.forEach(function (param) {
    const r = preset.ranges[param];
    if (!r) return;
    // Update the hidden range input's bounds
    const el = document.getElementById(param);
    if (el) { el.min = r[0]; el.max = r[1]; }
    // Update the knob's internal range (if knobs are already built)
    if (typeof window.updateKnobRange === 'function') {
      window.updateKnobRange(param, r[0], r[1]);
    }
  });

  // 2. Set values (clamped to new ranges)
  const ids = { threshold: 'threshold', ratio: 'ratio', knee: 'knee',
                attack: 'attack', release: 'release', hold: 'hold', makeup: 'makeupGain' };
  Object.entries(preset.params).forEach(function ([k, v]) {
    const el = document.getElementById(ids[k]);
    if (!el) return;
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    el.value = (isNaN(min) || isNaN(max)) ? v : Math.max(min, Math.min(max, v));
  });

  updateRangeBars(preset);
  updateModelInfo(preset);
  updatePresetButtons(key);

  if (typeof updateDisplays === 'function') updateDisplays();
  if (typeof window.syncKnobs === 'function') window.syncKnobs();

  // Flash knobs whose value changed
  if (typeof window.flashKnob === 'function') {
    knobParams.forEach(function (p) {
      const el = document.getElementById(p);
      if (!el) return;
      if (Math.abs(parseFloat(el.value) - (oldVals[p] || 0)) > 1e-4) {
        window.flashKnob(p);
      }
    });
  }

  if (typeof render === 'function') render();

  // Rebuild compare table to reflect new active column
  if (typeof buildCompareTable === 'function') buildCompareTable();

  // DEV-ONLY: action panels (allBtnsPanel, autoRelPanel) are commented out in HTML
}

/* ── Log-scale position (0..1) for time params ── */
function logPos(val, min, max) {
  const lMin = Math.log10(Math.max(min, 1e-6));
  const lMax = Math.log10(Math.max(max, 1e-6));
  const lVal = Math.log10(Math.max(val,  1e-6));
  return Math.max(0, Math.min(1, (lVal - lMin) / (lMax - lMin)));
}

function linPos(val, min, max) {
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

/* ── Update range bars below each knob ── */
function updateRangeBars(preset) {
  const useLog = new Set(['attack', 'release']);
  Object.entries(preset.ranges).forEach(([param, r]) => {
    const barFill  = document.getElementById(`${param}RangeFill`);
    const barLabel = document.getElementById(`${param}RangeLabel`);
    const global   = GLOBAL_RANGES[param];
    if (!barFill || !global) return;

    const pos = useLog.has(param) ? logPos : linPos;
    const leftPct  = pos(r[0], global[0], global[1]) * 100;
    const rightPct = pos(r[1], global[0], global[1]) * 100;
    const widthPct = Math.max(2, rightPct - leftPct);

    barFill.style.left  = `${leftPct.toFixed(1)}%`;
    barFill.style.width = `${widthPct.toFixed(1)}%`;
    if (barLabel) barLabel.textContent = fmtParamRange(param, r);
  });
}

function fmtParamRange(param, r) {
  switch (param) {
    case 'threshold': return `${r[0]} ~ ${r[1]} dB`;
    case 'ratio':     return r[1] >= 100 ? `${r[0]}:1 ~ ∞:1` : `${r[0]}:1 ~ ${r[1]}:1`;
    case 'knee':      return `${r[0]} ~ ${r[1]} dB`;
    case 'attack':
    case 'release':   return `${fmtMs(r[0])} ~ ${fmtMs(r[1])}`;
    case 'hold':      return `${r[0]} ~ ${r[1]} ms`;
    case 'makeup':    return `0 ~ +${r[1]} dB`;
    default:          return `${r[0]} ~ ${r[1]}`;
  }
}

function fmtMs(ms) {
  if (ms < 1)     return `${Math.round(ms * 1000)}μs`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 10)    return `${ms}ms`;
  return `${Math.round(ms)}ms`;
}

/* ── Update model info panel ── */
function updateModelInfo(preset) {
  const el = document.getElementById('modelInfo');
  if (!el) return;

  if (!preset.specTable || preset.specTable.length === 0) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }

  el.style.display = '';
  let html = `<div class="model-desc">${preset.desc}</div><div class="model-cols">`;
  html += `<table class="spec-table"><tbody>`;
  preset.specTable.forEach(([k, v]) => {
    html += `<tr><td class="spec-key">${k}</td><td class="spec-val">${v}</td></tr>`;
  });
  html += `</tbody></table>`;

  if (preset.notes && preset.notes.length) {
    html += `<ul class="model-notes">`;
    preset.notes.forEach(n => { html += `<li>${n}</li>`; });
    html += `</ul>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

/* ── Update preset button selection state ── */
function updatePresetButtons(key) {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    const active = btn.dataset.preset === key;
    btn.classList.toggle('selected', active);
  });
}

/* ── Build comparison table ── */
function buildCompareTable() {
  const tableEl = document.getElementById('compareTable');
  if (!tableEl) return;

  const models = Object.entries(COMPRESSOR_PRESETS).filter(([k, p]) => k !== 'free' && !p.hidden);

  const params = [
    { key: 'attack',    label: 'Attack',     log: true,  fmt: v => fmtMs(v) },
    { key: 'release',   label: 'Release',    log: true,  fmt: v => fmtMs(v) },
    { key: 'ratio',     label: 'Ratio',      log: false, fmt: v => v >= 100 ? '∞:1' : `${v}:1` },
    { key: 'threshold', label: 'Threshold',  log: false, fmt: v => `${v}dB` },
    { key: 'knee',      label: 'Knee',       log: false, fmt: v => `${v}dB` },
    { key: 'makeup',    label: 'Makeup',     log: false, fmt: v => `+${v}dB` },
  ];

  /* Text comparison table */
  let html = `<div class="cmp-wrapper">
  <div class="cmp-text-section">
    <div class="cmp-section-title">파라미터 범위 비교 (텍스트)</div>
    <div class="cmp-scroll"><table class="cmp-table">
      <thead><tr><th class="cmp-th-param">파라미터</th>`;
  models.forEach(([k, p]) => {
    const act = k === currentPresetKey ? ' cmp-active' : '';
    html += `<th class="cmp-th-model${act}" style="color:${p.color};--mc:${p.color}">${p.shortName}</th>`;
  });
  html += `</tr></thead><tbody>`;

  params.forEach(({ key, label, fmt }) => {
    html += `<tr><td class="cmp-td-param">${label}</td>`;
    models.forEach(([mk, p]) => {
      const r   = p.ranges[key];
      const lo  = fmt(r[0]);
      const hi  = key === 'ratio' && r[1] >= 100 ? '∞:1' : fmt(r[1]);
      const act = mk === currentPresetKey ? ' cmp-active' : '';
      html += `<td class="cmp-td${act}" style="--mc:${p.color}">${lo}&nbsp;~&nbsp;${hi}</td>`;
    });
    html += `</tr>`;
  });

  /* Type row */
  const typeMap = { la2a:'Optical', '1176':'FET', fairchild:'Tube VCA',
                    ssl:'VCA', dbx160:'VCA', neve33609:'VCA+Xfmr', distressor:'VCA' };
  html += `<tr><td class="cmp-td-param">타입</td>`;
  models.forEach(([k, p]) => {
    const act = k === currentPresetKey ? ' cmp-active' : '';
    html += `<td class="cmp-td${act}" style="--mc:${p.color}">${typeMap[k] || 'VCA'}</td>`;
  });
  html += `</tr>`;

  /* Typical use row */
  const useMap = {
    la2a:'보컬·베이스·어쿠스틱', '1176':'드럼·기타·보컬', fairchild:'마스터·스트링',
    ssl:'믹스버스·드럼버스', dbx160:'드럼·베이스', neve33609:'마스터버스·패드', distressor:'범용',
  };
  html += `<tr><td class="cmp-td-param">주요 용도</td>`;
  models.forEach(([k, p]) => {
    const act = k === currentPresetKey ? ' cmp-active' : '';
    html += `<td class="cmp-td${act}" style="--mc:${p.color}">${useMap[k] || ''}</td>`;
  });
  html += `</tr></tbody></table></div></div>`;

  /* Visual range bars */
  html += `<div class="cmp-bars-section">
    <div class="cmp-section-title">시각적 범위 비교 (로그·선형 스케일)</div>`;

  /* Attack + Release on log scale */
  ['attack', 'release'].forEach(paramKey => {
    const global = GLOBAL_RANGES[paramKey];
    const label  = paramKey === 'attack' ? 'Attack (log scale)' : 'Release (log scale)';
    html += `<div class="cmp-bar-group">
      <div class="cmp-bar-title">${label}</div>
      <div class="cmp-bar-scale-row">
        <span>${fmtMs(global[0])}</span>
        <span class="cmp-scale-mid">← 로그(log) 스케일 →</span>
        <span>${fmtMs(global[1])}</span>
      </div>`;
    models.forEach(([, p]) => {
      const r = p.ranges[paramKey];
      const lp = (logPos(r[0], global[0], global[1]) * 100).toFixed(1);
      const rp = (logPos(r[1], global[0], global[1]) * 100).toFixed(1);
      const w  = Math.max(2, rp - lp).toFixed(1);
      html += `<div class="cmp-bar-row">
        <span class="cmp-bar-model-name" style="color:${p.color}">${p.shortName}</span>
        <div class="cmp-bar-track">
          <div class="cmp-bar-fill" style="left:${lp}%;width:${w}%;background:${p.color}"></div>
        </div>
        <span class="cmp-bar-range-text">${fmtMs(r[0])} ~ ${fmtMs(r[1])}</span>
      </div>`;
    });
    html += `</div>`;
  });

  /* Ratio on linear scale */
  const rGlobal = GLOBAL_RANGES['ratio'];
  html += `<div class="cmp-bar-group">
    <div class="cmp-bar-title">Ratio (linear scale)</div>
    <div class="cmp-bar-scale-row">
      <span>1:1</span>
      <span class="cmp-scale-mid">← 선형(linear) 스케일 →</span>
      <span>∞:1</span>
    </div>`;
  models.forEach(([, p]) => {
    const r  = p.ranges['ratio'];
    const lp = (linPos(r[0], rGlobal[0], rGlobal[1]) * 100).toFixed(1);
    const rp = (linPos(Math.min(r[1], rGlobal[1]), rGlobal[0], rGlobal[1]) * 100).toFixed(1);
    const w  = Math.max(2, rp - lp).toFixed(1);
    const rs = r[1] >= 100 ? `${r[0]}:1 ~ ∞:1` : `${r[0]}:1 ~ ${r[1]}:1`;
    html += `<div class="cmp-bar-row">
      <span class="cmp-bar-model-name" style="color:${p.color}">${p.shortName}</span>
      <div class="cmp-bar-track">
        <div class="cmp-bar-fill" style="left:${lp}%;width:${w}%;background:${p.color}"></div>
      </div>
      <span class="cmp-bar-range-text">${rs}</span>
    </div>`;
  });
  html += `</div>`;

  html += `</div></div>`;
  tableEl.innerHTML = html;
}

window.COMPRESSOR_PRESETS = COMPRESSOR_PRESETS;
window.GLOBAL_RANGES      = GLOBAL_RANGES;
window.applyPreset        = applyPreset;
window.buildCompareTable  = buildCompareTable;
