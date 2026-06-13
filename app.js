'use strict';

/* ================================================
   Constants
   ================================================ */
const SAMPLE_RATE = 44100;
const HIT_DURATION = 0.85; // seconds per single hit

/* themeable accent (set by theme.js / inline init) */
const THEME = (window.THEME = window.THEME || { accent: '#5fb2d4' });
function _hx(h){ h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join(''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
function acc(a){ if (a==null) return THEME.accent; const c=_hx(THEME.accent); return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'; }

const SAMPLE_COLORS = {
  kick:  { stroke: acc(), fill: acc(0.20) },
  snare: { stroke: acc(), fill: acc(0.20) },
  hihat: { stroke: acc(), fill: acc(0.20) },
  tom:   { stroke: acc(), fill: acc(0.20) },
  clap:  { stroke: acc(), fill: acc(0.20) },
  bass:  { stroke: acc(), fill: acc(0.20) },
};

/* ================================================
   DOM
   ================================================ */
const waveCanvas = document.getElementById('waveformCanvas');
const waveCtx    = waveCanvas.getContext('2d');
const compCanvas = document.getElementById('compressorCanvas');
const compCtx    = compCanvas.getContext('2d');

const controls = {
  threshold:  document.getElementById('threshold'),
  sourceGain: document.getElementById('sourceGain'),
  ratio:      document.getElementById('ratio'),
  knee:       document.getElementById('knee'),
  attack:     document.getElementById('attack'),
  release:    document.getElementById('release'),
  hold:       document.getElementById('hold'),
  makeupGain: document.getElementById('makeupGain'),
};
const displays = {
  threshold:  document.getElementById('thresholdValue'),
  sourceGain: document.getElementById('sourceGainValue'),
  ratio:      document.getElementById('ratioValue'),
  knee:       document.getElementById('kneeValue'),
  attack:     document.getElementById('attackValue'),
  release:    document.getElementById('releaseValue'),
  hold:       document.getElementById('holdValue'),
  makeupGain: document.getElementById('makeupGainValue'),
};

const inputMeterFill  = document.getElementById('inputMeterFill');
const grMeterFill     = document.getElementById('grMeterFill');
const outputMeterFill = document.getElementById('outputMeterFill');
const inputMeterLabel  = document.getElementById('inputMeterLabel');
const grMeterLabel     = document.getElementById('grMeterLabel');
const outputMeterLabel = document.getElementById('outputMeterLabel');

/* ================================================
   App State
   ================================================ */
let currentSample  = 'kick';
let repeatCount    = 2;
let hitSpacingMs   = 200; // silence gap between hits (ms)
let audioCtx       = null;
let audioSource    = null;
let origAudioSrc   = null; // separate source for original playback
let animFrameId    = null;
let playStartTime  = 0;
let isPlaying      = false;
let isPlayingOrig  = false;

// 'original' | 'compressed' | 'makeup'
let listenMode        = 'makeup';
let autoMakeupEnabled = false;

const meterState = { inputDb: -60, outputDb: -60, grDb: 0 };

const grPeak  = { db: 0 }; // GR peak hold

let state = {
  original:         new Float32Array(0),
  compressedNoMkup: new Float32Array(0),
  compressedMakeup: new Float32Array(0),
  processed:        new Float32Array(0),
  gainReduction:    new Float32Array(0),
  stage:            new Uint8Array(0),
  maxReduction:     0,
  inputPeakDb:      -120,
  outputPeakDb:     -120,
};

/* ================================================
   Utilities
   ================================================ */
const dbToLin = (db) => Math.pow(10, db / 20);
const linToDb = (v)  => 20 * Math.log10(Math.max(v, 1e-10));

function normalizeBuffer(buf) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0) {
    const inv = 1 / peak;
    for (let i = 0; i < buf.length; i++) buf[i] *= inv;
  }
  return buf;
}

function getPeakDb(buf) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > peak) peak = a;
  }
  return peak > 0 ? linToDb(peak) : -120;
}

function applyGain(buf, gainDb) {
  const g = dbToLin(gainDb);
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * g;
  return out;
}

/* ================================================
   Sample Generators (single hit, normalized 0..1 peak)
   ================================================ */
function genKick(len) {
  const buf = new Float32Array(len);
  const T = 1 / SAMPLE_RATE;
  for (let i = 0; i < len; i++) {
    const t = i * T;
    const env   = Math.exp(-9 * t);
    const freq  = 55 + 160 * Math.exp(-7 * t);
    const body  = env * Math.sin(2 * Math.PI * freq * t);
    const click = Math.exp(-110 * t) * (Math.random() * 2 - 1) * 0.5;
    buf[i] = body * 0.88 + click * 0.12;
  }
  return normalizeBuffer(buf);
}

function genSnare(len) {
  const buf = new Float32Array(len);
  const T = 1 / SAMPLE_RATE;
  for (let i = 0; i < len; i++) {
    const t = i * T;
    const toneEnv  = Math.exp(-8 * t);
    const noiseEnv = Math.exp(-13 * t);
    const tone  = toneEnv * (Math.sin(2 * Math.PI * 195 * t) * 0.55 + Math.sin(2 * Math.PI * 330 * t) * 0.45);
    const noise = noiseEnv * (Math.random() * 2 - 1);
    const trans = Math.exp(-130 * t) * 0.7;
    buf[i] = tone * 0.3 + noise * 0.6 + trans * 0.1;
  }
  return normalizeBuffer(buf);
}

function genHihat(len) {
  const buf = new Float32Array(len);
  const T = 1 / SAMPLE_RATE;
  for (let i = 0; i < len; i++) {
    const t = i * T;
    const env  = Math.exp(-50 * t);
    const ring = Math.sin(2 * Math.PI * 8200 * t) * 0.3
               + Math.sin(2 * Math.PI * 10700 * t) * 0.4
               + Math.sin(2 * Math.PI * 13100 * t) * 0.3;
    buf[i] = env * ((Math.random() * 2 - 1) * 0.55 + ring * 0.45);
  }
  return normalizeBuffer(buf);
}

function genTom(len) {
  const buf = new Float32Array(len);
  const T = 1 / SAMPLE_RATE;
  for (let i = 0; i < len; i++) {
    const t = i * T;
    const env  = Math.exp(-5.5 * t);
    const freq = 82 + 55 * Math.exp(-5 * t);
    const body = env * Math.sin(2 * Math.PI * freq * t);
    const att  = Math.exp(-85 * t) * (Math.random() * 2 - 1) * 0.35;
    buf[i] = body + att;
  }
  return normalizeBuffer(buf);
}

function genClap(len) {
  const buf = new Float32Array(len);
  const T = 1 / SAMPLE_RATE;
  const layers = [0, 0.003, 0.007, 0.013];
  for (let i = 0; i < len; i++) {
    const t = i * T;
    let sum = 0;
    for (const off of layers) {
      const lt = t - off;
      if (lt >= 0) sum += Math.exp(-65 * lt) * (Math.random() * 2 - 1);
    }
    const body = Math.exp(-11 * t) * (Math.random() * 2 - 1) * 0.45;
    buf[i] = sum * 0.62 + body * 0.38;
  }
  return normalizeBuffer(buf);
}

function genBass(len) {
  const buf = new Float32Array(len);
  const T = 1 / SAMPLE_RATE;
  for (let i = 0; i < len; i++) {
    const t = i * T;
    const env = (1 - Math.exp(-55 * t)) * Math.exp(-2.8 * t);
    const f   = 82; // E2
    buf[i] = env * (
      Math.sin(2 * Math.PI * f * t) * 0.55 +
      Math.sin(2 * Math.PI * f * 2 * t) * 0.30 +
      Math.sin(2 * Math.PI * f * 3 * t) * 0.15
    );
  }
  return normalizeBuffer(buf);
}

const generators = { kick: genKick, snare: genSnare, hihat: genHihat, tom: genTom, clap: genClap, bass: genBass };

/* ================================================
   Buffer Building (with caching)
   ================================================ */
const hitCache = {};
const multiHitCache = {};

function getSingleHit(key) {
  if (!hitCache[key]) {
    hitCache[key] = generators[key](Math.floor(SAMPLE_RATE * HIT_DURATION));
  }
  return hitCache[key];
}

function getSlotLen() {
  return Math.floor(SAMPLE_RATE * HIT_DURATION) + Math.floor(SAMPLE_RATE * hitSpacingMs / 1000);
}

// Fixed reference length (max 800ms spacing) so the X axis stays stable as spacing changes
function getFixedTotalLen() {
  const fixedSlotLen = Math.floor(SAMPLE_RATE * HIT_DURATION) + Math.floor(SAMPLE_RATE * 800 / 1000);
  return fixedSlotLen * repeatCount;
}

function buildRawBuffer(key) {
  const cacheKey = `${key}_${repeatCount}_${hitSpacingMs}`;
  if (!multiHitCache[cacheKey]) {
    const singleLen = Math.floor(SAMPLE_RATE * HIT_DURATION);
    const slotLen   = getSlotLen();
    const hit       = getSingleHit(key);
    const buf       = new Float32Array(slotLen * repeatCount);
    for (let r = 0; r < repeatCount; r++) buf.set(hit, r * slotLen);
    multiHitCache[cacheKey] = buf;
  }
  return multiHitCache[cacheKey];
}

/* ================================================
   Compressor
   ================================================ */
function computeCompressor(input, params) {
  const { threshold: thr, knee, ratio, attack, release, hold, autoRelease } = params;
  const bl = input.length;
  const output        = new Float32Array(bl);
  const gainReduction = new Float32Array(bl);
  const stage         = new Uint8Array(bl);

  const attackCoeff  = Math.exp(-1 / (SAMPLE_RATE * (attack  / 1000)));
  const releaseCoeff = Math.exp(-1 / (SAMPLE_RATE * (release / 1000)));
  const holdSamples  = Math.round((hold / 1000) * SAMPLE_RATE);

  // RMS-style sidechain detector. Real compressors don't react to the raw waveform's
  // zero-crossings — their detector averages the signal level (power) over a short
  // window, so the gain reduction follows the ENVELOPE. Without this, a fast attack
  // on a low-frequency tone produces an unrealistic per-cycle staircase in the GR.
  const DETECTOR_MS = 10;
  const detCoeff = Math.exp(-1 / (SAMPLE_RATE * (DETECTOR_MS / 1000)));
  let detSq = 0;

  // Auto-release: fast (8% of release ms) blends to slow (3.5× release ms) as compression sustains
  const fastRelCoeff  = autoRelease ? Math.exp(-1 / (SAMPLE_RATE * (release * 0.08 / 1000))) : releaseCoeff;
  const slowRelCoeff  = autoRelease ? Math.exp(-1 / (SAMPLE_RATE * (release * 3.5  / 1000))) : releaseCoeff;
  const sustainThresh = Math.round(SAMPLE_RATE * 0.06); // 60ms of compression → fully slow release

  let curGrDb    = 0;
  let holdCnt    = 0;
  let maxGr      = 0;
  let sustainCnt = 0; // counts samples under active compression (auto-release only)

  for (let i = 0; i < bl; i++) {
    const s = input[i];
    detSq = detCoeff * detSq + (1 - detCoeff) * (s * s); // smoothed mean-square
    const levelDb = linToDb(Math.sqrt(detSq));           // RMS detector level
    const over    = levelDb - thr;

    let targetGrDb = 0;
    if (knee > 0 && over > -knee / 2 && over < knee / 2) {
      const x = over + knee / 2;
      targetGrDb = (x * x) / (2 * knee) * (1 - 1 / ratio);
    } else if (over >= knee / 2) {
      targetGrDb = over * (1 - 1 / ratio);
    }

    if (autoRelease) {
      if (targetGrDb > 0.1) {
        if (sustainCnt < sustainThresh * 10) sustainCnt++;
      } else {
        sustainCnt = Math.max(0, sustainCnt - 3);
      }
    }

    if (holdCnt > 0 && targetGrDb < curGrDb) {
      holdCnt--;
      stage[i] = 2; // hold
    } else if (targetGrDb > curGrDb) {
      holdCnt = holdSamples;
      curGrDb = attackCoeff * curGrDb + (1 - attackCoeff) * targetGrDb;
      stage[i] = 1; // attack
    } else {
      if (autoRelease) {
        const blend = Math.min(1, sustainCnt / sustainThresh);
        const adaptCoeff = fastRelCoeff + (slowRelCoeff - fastRelCoeff) * blend;
        curGrDb = adaptCoeff * curGrDb + (1 - adaptCoeff) * targetGrDb;
      } else {
        curGrDb = releaseCoeff * curGrDb + (1 - releaseCoeff) * targetGrDb;
      }
      stage[i] = curGrDb > 0.1 ? 3 : 0; // release or idle
    }

    gainReduction[i] = curGrDb;
    output[i]        = s * dbToLin(-curGrDb);
    if (curGrDb > maxGr) maxGr = curGrDb;
  }

  return { output, gainReduction, stage, maxReduction: maxGr };
}

/* ================================================
   Waveform Drawing
   ================================================ */
// Layout constants (pixel coords within canvas)
// GR + Stage are flush — no gap between them
const WF = {
  waveTop:  0,
  waveH:    330,
  grTop:    336,
  grH:      110,  // gain-reduction bars (taller for headroom)
  stageTop: 446,  // immediately after GR (336+110)
  stageH:   22,
  legendTop: 470,
  legendH:  28,
  // total canvas height ≈ 500
};

function drawFilledWaveform(ctx, buf, x0, midY, w, halfH, strokeCol, fillCol, scale, totalSamples) {
  if (!buf || !buf.length) return;
  if (scale === undefined) scale = halfH * 0.91;
  const T = totalSamples || buf.length;

  ctx.beginPath();
  ctx.moveTo(x0, midY);
  for (let x = 0; x <= w; x++) {
    const idx = Math.min(buf.length - 1, Math.floor((x / w) * T));
    ctx.lineTo(x0 + x, midY - buf[idx] * scale);
  }
  ctx.lineTo(x0 + w, midY);
  ctx.closePath();
  ctx.fillStyle = fillCol;
  ctx.fill();

  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const idx = Math.min(buf.length - 1, Math.floor((x / w) * T));
    const y = midY - buf[idx] * scale;
    if (x === 0) ctx.moveTo(x0, y);
    else ctx.lineTo(x0 + x, y);
  }
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

let waveCache = null; // cached waveform bitmap so the moving playhead is cheap to overlay

function drawWaveform() {
  const W = waveCanvas.width;
  const H = waveCanvas.height;
  waveCtx.clearRect(0, 0, W, H);

  // ----- Background -----
  waveCtx.fillStyle = '#101216';
  waveCtx.fillRect(0, 0, W, H);

  // GR + Stage share same background (no visible break between them)
  waveCtx.fillStyle = '#171a1f';
  waveCtx.fillRect(0, WF.grTop, W, WF.grH + WF.stageH);
  // Legend area slightly darker
  waveCtx.fillStyle = '#0d0f12';
  waveCtx.fillRect(0, WF.legendTop, W, WF.legendH);

  // ----- Waveform section -----
  const midY  = WF.waveTop + WF.waveH / 2;
  const halfH = WF.waveH / 2;

  // Scale derived from original peak so source-gain and makeup never overflow
  let origPeak = 0;
  for (let i = 0; i < state.original.length; i++) {
    const a = Math.abs(state.original[i]);
    if (a > origPeak) origPeak = a;
  }
  const scale = origPeak > 0 ? (halfH * 0.91) / origPeak : halfH * 0.91;

  const slotLen  = getSlotLen();
  const totalLen = state.original.length;
  const fixedLen = getFixedTotalLen(); // stable X-axis reference regardless of spacing

  // ── clip everything to waveform section ──
  waveCtx.save();
  waveCtx.beginPath();
  waveCtx.rect(0, WF.waveTop, W, WF.waveH);
  waveCtx.clip();

  // dB grid
  waveCtx.setLineDash([2, 5]);
  waveCtx.lineWidth = 1;
  for (let db = -6; db >= -36; db -= 6) {
    const amp = dbToLin(db);
    waveCtx.strokeStyle = db % 12 === 0 ? '#2b2f37' : '#212530';
    [midY - amp * scale, midY + amp * scale].forEach(y => {
      waveCtx.beginPath(); waveCtx.moveTo(40, y); waveCtx.lineTo(W, y); waveCtx.stroke();
    });
    waveCtx.fillStyle = '#5a616c';
    waveCtx.font = '9px monospace';
    waveCtx.textAlign = 'right';
    waveCtx.fillText(`${db}`, 36, midY - amp * scale + 3);
  }
  waveCtx.setLineDash([]);
  waveCtx.textAlign = 'left';

  // Center line
  waveCtx.strokeStyle = '#2b2f37';
  waveCtx.lineWidth = 1;
  waveCtx.beginPath(); waveCtx.moveTo(0, midY); waveCtx.lineTo(W, midY); waveCtx.stroke();

  // Waveforms
  const col = { stroke: acc(), fill: acc(0.20) };
  if (listenMode === 'original') {
    drawFilledWaveform(waveCtx, state.original, 0, midY, W, halfH,
      col.stroke, col.fill, scale, fixedLen);
  } else {
    drawFilledWaveform(waveCtx, state.original, 0, midY, W, halfH,
      'rgba(150,156,164,0.5)', 'rgba(120,126,134,0.12)', scale, fixedLen);
    const frontBuf = listenMode === 'compressed' ? state.compressedNoMkup : state.compressedMakeup;
    drawFilledWaveform(waveCtx, frontBuf, 0, midY, W, halfH,
      col.stroke, col.fill, scale, fixedLen);
  }

  // ── Silence gap overlay in waveform section ──
  {
    const hitSamplesWf = Math.floor(SAMPLE_RATE * HIT_DURATION);
    for (let r = 0; r < repeatCount - 1; r++) {
      const gapStart = r * slotLen + hitSamplesWf;
      const gapEnd   = (r + 1) * slotLen;
      const gx1 = Math.round((gapStart / fixedLen) * W);
      const gx2 = Math.round((gapEnd   / fixedLen) * W);
      if (gx2 <= gx1) continue;
      waveCtx.fillStyle = 'rgba(10,11,13,0.7)';
      waveCtx.fillRect(gx1, WF.waveTop, gx2 - gx1, WF.waveH);
      waveCtx.strokeStyle = '#3a3f48';
      waveCtx.lineWidth = 1;
      waveCtx.setLineDash([3, 4]);
      waveCtx.beginPath();
      waveCtx.moveTo(gx1, WF.waveTop); waveCtx.lineTo(gx1, WF.waveTop + WF.waveH);
      waveCtx.stroke();
      waveCtx.setLineDash([]);
      if (gx2 - gx1 > 44) {
        waveCtx.fillStyle = '#6a7078';
        waveCtx.font = '9px monospace';
        waveCtx.textAlign = 'center';
        waveCtx.fillText(`${hitSpacingMs} ms`, (gx1 + gx2) / 2, midY + 4);
        waveCtx.textAlign = 'left';
      }
    }
  }

  // Threshold lines (positive + negative)
  const thr    = parseFloat(controls.threshold.value);
  const thrAmp = dbToLin(thr);
  const thrY   = midY - thrAmp * scale;
  const thrYn  = midY + thrAmp * scale;

  waveCtx.fillStyle = 'rgba(202,162,79,0.06)';
  waveCtx.fillRect(0, WF.waveTop, W, thrY - WF.waveTop);
  waveCtx.fillRect(0, thrYn, W, WF.waveTop + WF.waveH - thrYn);

  waveCtx.setLineDash([6, 4]);
  waveCtx.strokeStyle = '#caa24f';
  waveCtx.lineWidth = 1.5;
  [thrY, thrYn].forEach(y => {
    waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(W, y); waveCtx.stroke();
  });
  waveCtx.setLineDash([]);
  waveCtx.fillStyle = '#caa24f';
  waveCtx.font = 'bold 11px Inter, sans-serif';
  waveCtx.fillText(`Threshold  ${thr} dB`, 44, thrY - 5);

  // Hit separators on top of waveforms
  waveCtx.setLineDash([3, 4]);
  waveCtx.strokeStyle = '#3c4250';
  waveCtx.lineWidth = 1;
  for (let r = 0; r < repeatCount; r++) {
    const sepX = Math.round((r * slotLen / fixedLen) * W);
    if (r > 0) {
      waveCtx.beginPath(); waveCtx.moveTo(sepX, WF.waveTop); waveCtx.lineTo(sepX, WF.waveTop + WF.waveH); waveCtx.stroke();
    }
    waveCtx.fillStyle = '#7b828d';
    waveCtx.font = 'bold 10px Inter, sans-serif';
    waveCtx.fillText(`Hit ${r + 1}`, sepX + 5, WF.waveTop + 14);
  }
  waveCtx.setLineDash([]);

  waveCtx.restore(); // ── end clip ──

  // Hit separator lines extended into GR + stage sections
  waveCtx.setLineDash([3, 4]);
  waveCtx.strokeStyle = '#2c313a';
  waveCtx.lineWidth = 1;
  for (let r = 1; r < repeatCount; r++) {
    const sepX = Math.round((r * slotLen / fixedLen) * W);
    waveCtx.beginPath();
    waveCtx.moveTo(sepX, WF.grTop);
    waveCtx.lineTo(sepX, WF.stageTop + WF.stageH);
    waveCtx.stroke();
  }
  waveCtx.setLineDash([]);

  // ----- GR Timeline -----
  const grBottom = WF.grTop + WF.grH - 14;
  const grDrawH  = WF.grH - 22;

  // Fixed GR axis (0 ~ -24 dB, same as the GR level meter) so the graph stays stable
  // and doesn't rescale on every tweak. Only widens if GR genuinely exceeds 24 dB.
  const maxGrDisp = Math.max(24, Math.ceil(state.maxReduction / 12) * 12);

  // Clip GR section so bars never bleed outside
  waveCtx.save();
  waveCtx.beginPath();
  waveCtx.rect(0, WF.grTop, W, WF.grH);
  waveCtx.clip();

  // Grid lines
  waveCtx.setLineDash([2, 5]);
  waveCtx.strokeStyle = '#242830';
  waveCtx.lineWidth = 1;
  const grGridSteps = maxGrDisp <= 12 ? [3, 6, 9] : maxGrDisp <= 24 ? [6, 12, 18] : [6, 12, 18, 24];
  grGridSteps.forEach(g => {
    if (g >= maxGrDisp) return;
    const gy = grBottom - (g / maxGrDisp) * grDrawH;
    waveCtx.beginPath(); waveCtx.moveTo(0, gy); waveCtx.lineTo(W, gy); waveCtx.stroke();
    waveCtx.fillStyle = '#5a616c';
    waveCtx.font = '9px monospace';
    waveCtx.textAlign = 'right';
    waveCtx.fillText(`-${g}`, W - 2, gy - 1);
  });
  // Max label at top
  waveCtx.fillStyle = '#6a7078';
  waveCtx.textAlign = 'right';
  waveCtx.fillText(`-${maxGrDisp}`, W - 2, grBottom - grDrawH + 9);
  waveCtx.setLineDash([]);
  waveCtx.textAlign = 'left';

  // GR label + scale hint
  waveCtx.fillStyle = '#6a7078';
  waveCtx.font = 'bold 9px Inter, sans-serif';
  waveCtx.fillText(`GR  (0 – -${maxGrDisp} dB)`, 4, WF.grTop + 12);

  // Zero baseline
  waveCtx.strokeStyle = '#2b2f37';
  waveCtx.lineWidth = 1;
  waveCtx.beginPath(); waveCtx.moveTo(0, grBottom); waveCtx.lineTo(W, grBottom); waveCtx.stroke();

  // Silence gap shading
  const hitSamples = Math.floor(SAMPLE_RATE * HIT_DURATION);
  for (let r = 0; r < repeatCount - 1; r++) {
    const gapStart = r * slotLen + hitSamples;
    const gapEnd   = (r + 1) * slotLen;
    const gx1 = Math.round((gapStart / fixedLen) * W);
    const gx2 = Math.round((gapEnd   / fixedLen) * W);
    if (gx2 <= gx1) continue;
    waveCtx.fillStyle = 'rgba(255,255,255,0.06)';
    waveCtx.fillRect(gx1, WF.grTop, gx2 - gx1, WF.grH);
    if (gx2 - gx1 > 40) {
      waveCtx.fillStyle = '#2c313a';
      waveCtx.font = '8px Inter, sans-serif';
      waveCtx.textAlign = 'center';
      waveCtx.fillText('silence', (gx1 + gx2) / 2, grBottom - grDrawH / 2 + 4);
      waveCtx.textAlign = 'left';
    }
  }

  // GR bars colored by stage
  for (let x = 0; x < W; x++) {
    const i  = Math.min(totalLen - 1, Math.floor((x / W) * fixedLen));
    const gr = state.gainReduction[i];
    if (gr < 0.1) continue;
    const pct  = Math.min(gr / maxGrDisp, 1);
    const barH = pct * grDrawH;
    const barY = grBottom - barH;
    const stg  = state.stage[i];
    waveCtx.fillStyle = stg === 1 ? '#caa24f' : stg === 2 ? acc() : '#82ab86';
    waveCtx.fillRect(x, barY, 1, barH);
  }

  waveCtx.restore(); // end GR clip

  // Separator: waveform↔GR only (thin); GR↔Stage has NO line
  waveCtx.strokeStyle = '#2b2f37';
  waveCtx.lineWidth = 1;
  waveCtx.beginPath(); waveCtx.moveTo(0, WF.grTop - 1); waveCtx.lineTo(W, WF.grTop - 1); waveCtx.stroke();

  // ----- Stage strip -----
  for (let x = 0; x < W; x++) {
    const i   = Math.min(totalLen - 1, Math.floor((x / W) * fixedLen));
    const stg = state.stage[i];
    if (!stg) continue;
    waveCtx.fillStyle = stg === 1 ? 'rgba(202,162,79,0.85)' : stg === 2 ? acc(0.85) : 'rgba(130,171,134,0.85)';
    waveCtx.fillRect(x, WF.stageTop, 1, WF.stageH);
  }

  // ----- Legend row -----
  const lY = WF.legendTop + 18;
  waveCtx.font = '10px Inter, sans-serif';

  if (listenMode === 'original') {
    waveCtx.fillStyle = col.stroke;
    waveCtx.fillRect(4, lY - 10, 20, 10);
    waveCtx.fillStyle = '#9aa0a8';
    waveCtx.fillText('원본 (Original)', 28, lY);
  } else {
    waveCtx.fillStyle = 'rgba(150,156,164,0.6)';
    waveCtx.fillRect(4, lY - 10, 20, 10);
    waveCtx.fillStyle = '#9aa0a8';
    waveCtx.fillText('원본', 28, lY);

    waveCtx.fillStyle = col.stroke;
    waveCtx.fillRect(84, lY - 10, 20, 10);
    waveCtx.fillStyle = '#9aa0a8';
    waveCtx.fillText(listenMode === 'compressed' ? '컴프 (Makeup 없음)' : '컴프 + Makeup', 108, lY);
  }

  // Stage legend
  const stageLegends = [
    { c: '#caa24f', t: 'Attack' },
    { c: acc(), t: 'Hold' },
    { c: '#82ab86', t: 'Release' },
  ];
  let lx = 260;
  stageLegends.forEach(({ c, t }) => {
    waveCtx.fillStyle = c;
    waveCtx.fillRect(lx, lY - 10, 12, 10);
    waveCtx.fillStyle = '#9aa0a8';
    waveCtx.fillText(t, lx + 16, lY);
    lx += 80;
  });

  // Cache the finished waveform so the playhead can be overlaid each frame without
  // re-running this whole (heavy) draw.
  if (!waveCache) {
    waveCache = document.createElement('canvas');
    waveCache.width  = waveCanvas.width;
    waveCache.height = waveCanvas.height;
  }
  waveCache.getContext('2d').drawImage(waveCanvas, 0, 0);
}

/* Playhead overlay — vertical line on the time-axis graph that follows playback.
   Pass a sample index to draw it, or null to just restore the clean waveform. */
function drawPlayhead(curIdx) {
  if (!waveCache) return;
  waveCtx.drawImage(waveCache, 0, 0);            // restore clean waveform (clears old line)
  if (curIdx == null) return;
  const W = waveCanvas.width;
  const x = (curIdx / getFixedTotalLen()) * W;
  if (x < 0 || x > W) return;
  const xp   = Math.round(x) + 0.5;
  const yTop = WF.waveTop;
  const yBot = WF.stageTop + WF.stageH;
  waveCtx.save();
  waveCtx.strokeStyle = acc(0.30);               // soft glow
  waveCtx.lineWidth = 4;
  waveCtx.beginPath(); waveCtx.moveTo(xp, yTop); waveCtx.lineTo(xp, yBot); waveCtx.stroke();
  waveCtx.strokeStyle = acc(0.95);               // crisp line
  waveCtx.lineWidth = 1.5;
  waveCtx.beginPath(); waveCtx.moveTo(xp, yTop); waveCtx.lineTo(xp, yBot); waveCtx.stroke();
  waveCtx.fillStyle = acc();                      // top marker
  waveCtx.beginPath();
  waveCtx.moveTo(xp - 4, yTop); waveCtx.lineTo(xp + 4, yTop); waveCtx.lineTo(xp, yTop + 6);
  waveCtx.closePath(); waveCtx.fill();
  waveCtx.restore();
}

/* ================================================
   Transfer Curve
   ================================================ */
function drawCompressorGraph() {
  const W = compCanvas.width;
  const H = compCanvas.height;
  compCtx.clearRect(0, 0, W, H);
  compCtx.fillStyle = '#101216';
  compCtx.fillRect(0, 0, W, H);

  const pad = { top: 32, right: 16, bottom: 44, left: 48 };
  const pw  = W - pad.left - pad.right;
  const ph  = H - pad.top  - pad.bottom;
  const DB_MIN = -60, DB_MAX = 0;

  const toX = (db) => pad.left + ((db - DB_MIN) / (DB_MAX - DB_MIN)) * pw;
  const toY = (db) => pad.top  + ph - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * ph;

  // Plot bg
  compCtx.fillStyle = '#0d0f12';
  compCtx.fillRect(pad.left, pad.top, pw, ph);

  // Grid
  compCtx.setLineDash([2, 5]);
  compCtx.lineWidth = 1;
  for (let db = DB_MIN; db <= DB_MAX; db += 6) {
    compCtx.strokeStyle = db % 12 === 0 ? '#2b2f37' : '#212530';
    compCtx.beginPath(); compCtx.moveTo(toX(db), pad.top); compCtx.lineTo(toX(db), pad.top + ph); compCtx.stroke();
    compCtx.beginPath(); compCtx.moveTo(pad.left, toY(db)); compCtx.lineTo(pad.left + pw, toY(db)); compCtx.stroke();
    compCtx.fillStyle = '#5a616c';
    compCtx.font = '9px monospace';
    compCtx.textAlign = 'center';
    if (db !== DB_MIN) compCtx.fillText(db, toX(db), pad.top + ph + 13);
    compCtx.textAlign = 'right';
    compCtx.fillText(db, pad.left - 4, toY(db) + 3);
  }
  compCtx.setLineDash([]);
  compCtx.textAlign = 'left';

  // Border
  compCtx.strokeStyle = '#2b2f37';
  compCtx.lineWidth = 1;
  compCtx.strokeRect(pad.left, pad.top, pw, ph);

  const thr    = parseFloat(controls.threshold.value);
  const ratio  = parseFloat(controls.ratio.value);
  const knee   = parseFloat(controls.knee.value);
  const makeup = parseFloat(controls.makeupGain.value);

  // Unity-gain diagonal
  compCtx.strokeStyle = '#2f3742';
  compCtx.lineWidth = 1;
  compCtx.setLineDash([4, 4]);
  compCtx.beginPath();
  compCtx.moveTo(toX(DB_MIN), toY(DB_MIN));
  compCtx.lineTo(toX(DB_MAX), toY(DB_MAX));
  compCtx.stroke();
  compCtx.setLineDash([]);

  // Knee region fill
  compCtx.fillStyle = acc(0.08);
  compCtx.fillRect(toX(thr - knee / 2), pad.top, toX(thr + knee / 2) - toX(thr - knee / 2), ph);

  // Transfer curve
  compCtx.strokeStyle = acc();
  compCtx.lineWidth = 2.5;
  compCtx.beginPath();
  for (let x = 0; x <= pw; x++) {
    const inDb = DB_MIN + (x / pw) * (DB_MAX - DB_MIN);
    const over = inDb - thr;
    let outDb;
    if (over <= -knee / 2) {
      outDb = inDb;
    } else if (over >= knee / 2) {
      outDb = thr + over / ratio;
    } else {
      const d = over + knee / 2;
      outDb = inDb + (1 / ratio - 1) * (d * d) / (2 * knee);
    }
    outDb = Math.min(0, outDb + (window.showCurveMakeup ? makeup : 0)); // makeup optional, clamp at 0 dBFS
    if (x === 0) compCtx.moveTo(toX(inDb), toY(outDb));
    else compCtx.lineTo(toX(inDb), toY(outDb));
  }
  compCtx.stroke();

  // Threshold line
  compCtx.strokeStyle = '#caa24f';
  compCtx.lineWidth = 1.5;
  compCtx.setLineDash([5, 4]);
  compCtx.beginPath();
  compCtx.moveTo(toX(thr), pad.top);
  compCtx.lineTo(toX(thr), pad.top + ph);
  compCtx.stroke();
  compCtx.setLineDash([]);
  compCtx.fillStyle = '#caa24f';
  compCtx.font = 'bold 10px Inter, sans-serif';
  compCtx.fillText(`THR ${thr}`, toX(thr) + 4, pad.top + 12);

  // Axis labels
  compCtx.fillStyle = '#6a7078';
  compCtx.font = '10px Inter, sans-serif';
  compCtx.textAlign = 'center';
  compCtx.fillText('Input (dB)', pad.left + pw / 2, H - 5);
  compCtx.save();
  compCtx.translate(11, pad.top + ph / 2);
  compCtx.rotate(-Math.PI / 2);
  compCtx.fillText('Output (dB)', 0, 0);
  compCtx.restore();
  compCtx.textAlign = 'left';

}

/* ================================================
   Meters
   ================================================ */
function updateMeters(tIn, tOut, tGr) {
  const fall = 0.8;
  meterState.inputDb  = tIn  > meterState.inputDb  ? tIn  : meterState.inputDb  - fall;
  meterState.outputDb = tOut > meterState.outputDb ? tOut : meterState.outputDb - fall;
  meterState.grDb     = tGr  > meterState.grDb     ? tGr  : meterState.grDb     - fall * 0.45;

  meterState.inputDb  = Math.max(-60, meterState.inputDb);
  meterState.outputDb = Math.max(-60, meterState.outputDb);
  meterState.grDb     = Math.max(0,   meterState.grDb);

  const inPct  = ((meterState.inputDb  + 60) / 60) * 100;
  const outPct = ((meterState.outputDb + 60) / 60) * 100;
  const grPct  = (meterState.grDb / 24) * 100;

  const col = (db) => db >= -3 ? '#cf6b5a' : db >= -18 ? '#cbb24e' : '#62a574';

  inputMeterFill.style.height  = `${Math.max(0, Math.min(100, inPct))}%`;
  outputMeterFill.style.height = `${Math.max(0, Math.min(100, outPct))}%`;
  grMeterFill.style.height     = `${Math.max(0, Math.min(100, grPct))}%`;

  // GR peak hold
  if (tGr > grPeak.db) {
    grPeak.db = tGr;
    const pkPct = Math.min(100, (grPeak.db / 24) * 100);
    const line  = document.getElementById('grPeakLine');
    if (line) { line.style.top = pkPct.toFixed(1) + '%'; line.style.display = 'block'; }
  }

  inputMeterFill.style.backgroundColor  = col(meterState.inputDb);
  outputMeterFill.style.backgroundColor = col(meterState.outputDb);

  inputMeterLabel.textContent  = `${meterState.inputDb.toFixed(1)} dB`;
  outputMeterLabel.textContent = `${meterState.outputDb.toFixed(1)} dB`;
  grMeterLabel.textContent     = meterState.grDb > 0.1 ? `-${meterState.grDb.toFixed(1)} dB` : '0.0 dB';
}

function decayMeters() {
  if (isPlaying) return;
  if (meterState.inputDb <= -60 && meterState.outputDb <= -60 && meterState.grDb <= 0) return;
  updateMeters(-60, -60, 0);
  requestAnimationFrame(decayMeters);
}

/* ================================================
   AHR Timeline Diagram
   ================================================ */
function updateAHRDiagram() {
  const aEl = document.getElementById('ahrAttackVal');
  if (!aEl) return;
  const hEl = document.getElementById('ahrHoldVal');
  const rEl = document.getElementById('ahrReleaseVal');
  const ap  = document.getElementById('ahrAttackPhase');
  const hp  = document.getElementById('ahrHoldPhase');
  const rp  = document.getElementById('ahrReleasePhase');
  const attackMs  = parseFloat(controls.attack.value);
  const holdMs    = parseFloat(controls.hold.value);
  const releaseMs = parseFloat(controls.release.value);
  aEl.textContent = fmtAttack(attackMs);
  if (hEl) hEl.textContent = `${holdMs} ms`;
  if (rEl) rEl.textContent = fmtRelease(releaseMs);
  if (ap) {
    // Log scale so μs attacks and second-long releases coexist visually
    const aLog = Math.log10(Math.max(attackMs, 0.01) + 1);
    const hLog = Math.log10(Math.max(holdMs, 0.5) + 1);
    const rLog = Math.log10(Math.max(releaseMs, 1) + 1);
    ap.style.flexGrow = aLog;
    hp.style.flexGrow = hLog;
    rp.style.flexGrow = rLog;
  }
}

/* ================================================
   Render
   ================================================ */
function render() {
  const rawBuf   = buildRawBuffer(currentSample);
  const gainDb   = parseFloat(controls.sourceGain.value);
  const withGain = applyGain(rawBuf, gainDb);

  const compParams = {
    threshold:   parseFloat(controls.threshold.value),
    ratio:       parseFloat(controls.ratio.value),
    knee:        parseFloat(controls.knee.value),
    attack:      parseFloat(controls.attack.value),
    release:     parseFloat(controls.release.value),
    hold:        parseFloat(controls.hold.value),
    autoRelease: window.autoReleaseEnabled,
  };

  // 1176 All-buttons: force minimum attack/release and maximum ratio
  if (window.allButtonsMode) {
    compParams.attack  = Math.min(compParams.attack, 0.020);
    compParams.release = Math.min(compParams.release, 50);
    compParams.ratio   = 20;
  }

  const result = computeCompressor(withGain, compParams);

  // 1176 All-buttons: soft-saturation to simulate harmonic distortion
  let finalOutput = result.output;
  if (window.allButtonsMode) {
    finalOutput = new Float32Array(result.output.length);
    for (let i = 0; i < result.output.length; i++) {
      const x = result.output[i] * 1.5;
      finalOutput[i] = (x / (1 + Math.abs(x))) * 0.85;
    }
  }

  // Auto makeup: compensate for the maximum GR applied
  let makeupDb;
  if (autoMakeupEnabled) {
    makeupDb = Math.min(40, result.maxReduction);
    controls.makeupGain.value    = makeupDb.toFixed(1);
    displays.makeupGain.textContent = `+${makeupDb.toFixed(1)} dB`;
  } else {
    makeupDb = parseFloat(controls.makeupGain.value);
  }

  const withMakeup = makeupDb > 0 ? applyGain(finalOutput, makeupDb) : finalOutput;

  state.original         = withGain;
  state.compressedNoMkup = finalOutput;
  state.compressedMakeup = withMakeup;
  state.gainReduction    = result.gainReduction;
  state.stage            = result.stage;
  state.maxReduction     = result.maxReduction;
  state.inputPeakDb      = getPeakDb(withGain);

  // Decide what gets played (and metered as output)
  if      (listenMode === 'original')    state.processed = withGain;
  else if (listenMode === 'compressed')  state.processed = finalOutput;
  else                                   state.processed = withMakeup;

  state.outputPeakDb = getPeakDb(state.processed);

  drawWaveform();
  drawCompressorGraph();
  updateAHRDiagram();
  if (typeof window.syncKnobs === 'function') window.syncKnobs();

  if (!isPlaying) {
    meterState.inputDb  = Math.max(-60, state.inputPeakDb);
    meterState.outputDb = Math.max(-60, state.outputPeakDb);
    meterState.grDb     = listenMode === 'original' ? 0 : (state.maxReduction || 0);
    updateMeters(meterState.inputDb, meterState.outputDb, meterState.grDb);
    cancelAnimationFrame(animFrameId);
    requestAnimationFrame(decayMeters);
  }
}

/* ================================================
   Playback
   ================================================ */
function animatePlayback() {
  if (!isPlaying || !audioCtx) return;
  const elapsed = audioCtx.currentTime - playStartTime;
  const curIdx  = Math.floor(elapsed * SAMPLE_RATE);
  if (curIdx >= state.original.length) { stopSample(); return; }

  const win = 2048;
  const s0  = Math.max(0, curIdx - win);
  let inPk = 0, outPk = 0, grMax = 0;
  for (let i = s0; i < curIdx; i++) {
    const ai = Math.abs(state.original[i]);
    const ao = Math.abs(state.processed[i]);
    if (ai > inPk)  inPk  = ai;
    if (ao > outPk) outPk = ao;
    if (state.gainReduction[i] > grMax) grMax = state.gainReduction[i];
  }
  updateMeters(
    inPk  > 0 ? linToDb(inPk)  : -60,
    outPk > 0 ? linToDb(outPk) : -60,
    grMax
  );

  drawPlayhead(curIdx);
  drawCompressorGraph();
  animFrameId = requestAnimationFrame(animatePlayback);
}

function playSample() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  stopSample();
  grPeak.db = 0;
  const grPeakLine = document.getElementById('grPeakLine');
  if (grPeakLine) grPeakLine.style.display = 'none';

  const buf = audioCtx.createBuffer(1, state.processed.length, SAMPLE_RATE);
  buf.copyToChannel(state.processed, 0, 0);
  audioSource = audioCtx.createBufferSource();
  audioSource.buffer = buf;
  audioSource.connect(audioCtx.destination);
  audioSource.start();
  playStartTime = audioCtx.currentTime;
  isPlaying = true;
  animatePlayback();
}

function stopSample() {
  if (audioSource) {
    try { audioSource.stop(); } catch (e) {}
    audioSource.disconnect();
    audioSource = null;
  }
  isPlaying = false;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  drawPlayhead(null);
  drawCompressorGraph();
  decayMeters();
}

function playOriginal() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // Stop both channels if playing
  stopSample();
  if (origAudioSrc) {
    try { origAudioSrc.stop(); } catch(e) {}
    origAudioSrc.disconnect();
    origAudioSrc = null;
  }
  isPlayingOrig = false;

  const src = state.original;
  const buf = audioCtx.createBuffer(1, src.length, SAMPLE_RATE);
  buf.copyToChannel(src, 0, 0);
  origAudioSrc = audioCtx.createBufferSource();
  origAudioSrc.buffer = buf;
  origAudioSrc.connect(audioCtx.destination);
  origAudioSrc.onended = () => { isPlayingOrig = false; };
  origAudioSrc.start();
  isPlayingOrig = true;
}

function stopOriginal() {
  if (origAudioSrc) {
    try { origAudioSrc.stop(); } catch(e) {}
    origAudioSrc.disconnect();
    origAudioSrc = null;
  }
  isPlayingOrig = false;
}

/* ================================================
   UI
   ================================================ */
function fmtAttack(ms) {
  const v = parseFloat(ms);
  if (v < 1)    return `${Math.round(v * 1000)} μs`;
  if (v < 10)   return `${v.toFixed(2)} ms`;
  if (v < 100)  return `${v.toFixed(1)} ms`;
  return `${v.toFixed(0)} ms`;
}

function fmtRelease(ms) {
  const v = parseFloat(ms);
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  return `${parseFloat(v).toFixed(0)} ms`;
}

function fmtRatio(val) {
  const v = parseFloat(val);
  if (v >= 100) return '∞:1';
  return `${v.toFixed(1)}:1`;
}

/* Tracks which param-val input is currently being typed into */
const editingParams = new Set();

/* param-val inputs use .value; fader displays (sourceGain, makeupGain) use .textContent */
function updateDisplays() {
  if (!editingParams.has('threshold')) displays.threshold.value = `${controls.threshold.value} dB`;
  if (!editingParams.has('ratio'))     displays.ratio.value     = fmtRatio(controls.ratio.value);
  if (!editingParams.has('knee'))      displays.knee.value      = `${controls.knee.value} dB`;
  if (!editingParams.has('attack'))    displays.attack.value    = fmtAttack(controls.attack.value);
  if (!editingParams.has('release'))   displays.release.value   = fmtRelease(controls.release.value);
  if (!editingParams.has('hold'))      displays.hold.value      = `${controls.hold.value} ms`;
  displays.sourceGain.textContent = `${controls.sourceGain.value} dB`;
  displays.makeupGain.textContent = `+${parseFloat(controls.makeupGain.value).toFixed(1)} dB`;
}

/* Parse a typed string into a raw numeric value for the given param (in native units) */
function parseParamInput(param, text) {
  text = text.trim();
  const lower = text.toLowerCase().replace(/\s+/g, '');

  switch (param) {
    case 'threshold':
    case 'knee': {
      const v = parseFloat(text);
      return isNaN(v) ? null : v;
    }
    case 'ratio': {
      if (/[∞inf]/i.test(lower)) return 100;
      // accept "4", "4:1", "4.5:1"
      const v = parseFloat(text);
      return isNaN(v) ? null : v;
    }
    case 'attack':
    case 'release':
    case 'hold': {
      // μs / us / µs → convert to ms
      if (/[μuµ]s/.test(lower)) {
        const v = parseFloat(text);
        return isNaN(v) ? null : v / 1000;
      }
      // seconds: "1.5s" or "1.5 s" but NOT "ms"
      if (/\d\.?\d*s$/.test(lower) && !lower.endsWith('ms')) {
        const v = parseFloat(text);
        return isNaN(v) ? null : v * 1000;
      }
      // default: ms
      const v = parseFloat(text);
      return isNaN(v) ? null : v;
    }
    default:
      return null;
  }
}

/* Wire up direct-type editing for all param-val inputs */
(function () {
  const paramMap = {
    threshold: controls.threshold,
    ratio:     controls.ratio,
    knee:      controls.knee,
    attack:    controls.attack,
    release:   controls.release,
    hold:      controls.hold,
  };

  Object.entries(paramMap).forEach(([param, ctrl]) => {
    const displayEl = displays[param];
    if (!displayEl || displayEl.tagName !== 'INPUT') return;

    displayEl.addEventListener('focus', () => {
      editingParams.add(param);
      displayEl.select();
    });

    displayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); displayEl.blur(); return; }
      if (e.key === 'Tab')   { displayEl.blur(); return; } // commit + natural tab movement
      if (e.key === 'Escape') {
        editingParams.delete(param);
        updateDisplays(); // restore formatted value
        displayEl.blur();
        return;
      }
      // Prevent knob keyboard handler from firing
      e.stopPropagation();
    });

    displayEl.addEventListener('blur', () => {
      editingParams.delete(param);
      const parsed = parseParamInput(param, displayEl.value);
      if (parsed !== null) {
        const min = parseFloat(ctrl.min);
        const max = parseFloat(ctrl.max);
        const clamped = Math.max(min, Math.min(max, parsed));
        ctrl.value = String(clamped);
      }
      updateDisplays();
      if (typeof window.syncKnobs === 'function') window.syncKnobs();
      render();
    });
  });
})();

document.querySelectorAll('[data-sample]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentSample = btn.dataset.sample;
    document.querySelectorAll('[data-sample]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    // Update button accent color
    const c = SAMPLE_COLORS[currentSample];
    document.querySelectorAll('[data-sample]').forEach(b => {
      b.style.removeProperty('--btn-accent');
    });
    btn.style.setProperty('--btn-accent', c.stroke);
    render();
  });
});

document.querySelectorAll('[data-rep]').forEach(btn => {
  btn.addEventListener('click', () => {
    repeatCount = parseInt(btn.dataset.rep, 10);
    document.querySelectorAll('[data-rep]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    render();
  });
});

document.getElementById('playBtn').addEventListener('click', playSample);
document.getElementById('stopBtn').addEventListener('click', () => { stopSample(); stopOriginal(); });
document.getElementById('playOrigBtn').addEventListener('click', playOriginal);

// Hit spacing slider
document.getElementById('hitSpacing').addEventListener('input', (e) => {
  hitSpacingMs = parseInt(e.target.value, 10);
  document.getElementById('hitSpacingValue').textContent = `${hitSpacingMs} ms`;
  render();
});

// Listen mode buttons
document.querySelectorAll('[data-listen]').forEach(btn => {
  btn.addEventListener('click', () => {
    listenMode = btn.dataset.listen;
    document.querySelectorAll('[data-listen]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    render();
  });
});

// Auto makeup toggle
document.getElementById('autoMakeupBtn').addEventListener('click', () => {
  autoMakeupEnabled = !autoMakeupEnabled;
  document.getElementById('autoMakeupBtn').classList.toggle('active', autoMakeupEnabled);
  controls.makeupGain.disabled = autoMakeupEnabled;
  controls.makeupGain.style.opacity = autoMakeupEnabled ? '0.4' : '1';
  render();
});

// 1176 All-buttons mode toggle
(function () {
  var btn = document.getElementById('allBtnsBtn');
  if (btn) btn.addEventListener('click', () => {
    window.allButtonsMode = !window.allButtonsMode;
    btn.classList.toggle('active', window.allButtonsMode);
    render();
  });
})();

// SSL-G / Neve Auto Release toggle
(function () {
  var btn = document.getElementById('autoRelBtn');
  if (btn) btn.addEventListener('click', () => {
    window.autoReleaseEnabled = !window.autoReleaseEnabled;
    btn.classList.toggle('active', window.autoReleaseEnabled);
    render();
  });
})();

Object.values(controls).forEach(ctrl => {
  ctrl.addEventListener('input', () => { updateDisplays(); render(); });
});

/* GR peak hold reset */
(function () {
  var track = document.getElementById('grMeterTrack');
  if (track) track.addEventListener('click', function () {
    grPeak.db = 0;
    var line = document.getElementById('grPeakLine');
    if (line) line.style.display = 'none';
  });
})();

/* Spacebar — play / stop toggle */
document.addEventListener('keydown', function (e) {
  if (e.key !== ' ') return;
  var tag = (document.activeElement || {}).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();
  if (isPlaying) stopSample(); else playSample();
});

/* Init */
updateDisplays();
render();
