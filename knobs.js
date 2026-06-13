'use strict';
/* ============================================================
   Rotary knob controller.
   Each .knob[data-for="<inputId>"] wraps a (visually hidden)
   native <input type=range>, which remains the source of truth
   that app.js reads. Dragging/scrolling the knob writes the
   range value and dispatches an 'input' event so app.js recomputes.
   Exposes window.syncKnobs() and window.updateKnobRange() for
   programmatic updates (presets, range constraining).

   data-curve="log"  logarithmic mapping (min must be > 0)
   data-curve="N"    power curve  v = min + range * t^N
   Both drag and scroll operate in normalized (0–1) space so the
   physical travel feels even regardless of value distribution.
   ============================================================ */
(function () {
  const C     = 2 * Math.PI * 30;   // circumference, r=30
  const SWEEP = 0.75 * C;           // 270° visible arc
  const TAU   = 270;                 // degrees of travel

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML =
    '<defs>' +
      // dark anodized aluminium cap, light from upper-left
      '<radialGradient id="knobCap" cx="38%" cy="30%" r="78%">' +
        '<stop offset="0%"  stop-color="#4a4d54"/>' +
        '<stop offset="46%" stop-color="#33363c"/>' +
        '<stop offset="100%" stop-color="#191b1f"/>' +
      '</radialGradient>' +
      // brushed metal skirt ring
      '<linearGradient id="knobSkirt" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%"   stop-color="#6c6f76"/>' +
        '<stop offset="50%"  stop-color="#43464c"/>' +
        '<stop offset="100%" stop-color="#2a2c31"/>' +
      '</linearGradient>' +
      // soft top highlight on the cap
      '<radialGradient id="knobGloss" cx="42%" cy="24%" r="46%">' +
        '<stop offset="0%"  stop-color="rgba(255,255,255,0.30)"/>' +
        '<stop offset="100%" stop-color="rgba(255,255,255,0)"/>' +
      '</radialGradient>' +
    '</defs>';
  document.body.appendChild(defs);

  /* ── Static tick ring (11 marks across the 270° sweep) ── */
  function buildTicks() {
    let s = '';
    const cx = 40, cy = 40, rOut = 35, rInMin = 30.5, rInMaj = 28.5;
    for (let i = 0; i <= 10; i++) {
      const deg = -135 + i * 27;
      const th  = deg * Math.PI / 180;
      const dx  = Math.sin(th), dy = -Math.cos(th);
      const major = (i === 0 || i === 5 || i === 10);
      const rIn = major ? rInMaj : rInMin;
      const x1 = (cx + dx * rIn ).toFixed(2), y1 = (cy + dy * rIn ).toFixed(2);
      const x2 = (cx + dx * rOut).toFixed(2), y2 = (cy + dy * rOut).toFixed(2);
      s += '<line class="kb-tick' + (major ? ' kb-tick-major' : '') +
           '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    }
    return s;
  }
  const TICKS = buildTicks();

  const knobs = [];

  /* ── Curve helpers ── */
  function valToT(v, k) {
    const c = k.curve;
    if (!c) return (v - k.min) / (k.max - k.min);
    if (c === 'log') return Math.log(v / k.min) / Math.log(k.max / k.min);
    return Math.pow((v - k.min) / (k.max - k.min), 1 / c);
  }

  function tToVal(t, k) {
    const c = k.curve;
    t = Math.max(0, Math.min(1, t));
    if (!c) return k.min + (k.max - k.min) * t;
    if (c === 'log') return k.min * Math.pow(k.max / k.min, t);
    return k.min + (k.max - k.min) * Math.pow(t, c);
  }

  function build(el) {
    const input = document.getElementById(el.dataset.for);
    if (!input) return;

    const step = parseFloat(input.step) || 1;
    const def  = el.dataset.default !== undefined
                   ? parseFloat(el.dataset.default)
                   : parseFloat(input.value);

    let curve = el.dataset.curve || null;
    if (curve && curve !== 'log') curve = parseFloat(curve);

    el.innerHTML =
      '<svg viewBox="0 0 80 80" class="knob-svg">' +
        '<g class="kb-ticks">' + TICKS + '</g>' +
        '<circle class="kb-track" cx="40" cy="40" r="30" transform="rotate(135 40 40)"/>' +
        '<circle class="kb-arc"   cx="40" cy="40" r="30" transform="rotate(135 40 40)"/>' +
        '<circle class="kb-skirt" cx="40" cy="40" r="24.5"/>' +
        '<circle class="kb-cap"   cx="40" cy="40" r="20.5"/>' +
        '<circle class="kb-gloss" cx="40" cy="40" r="20.5"/>' +
        '<line   class="kb-ptr" x1="40" y1="40" x2="40" y2="21.5"/>' +
      '</svg>';

    const arc = el.querySelector('.kb-arc');
    const ptr = el.querySelector('.kb-ptr');
    arc.style.strokeDasharray = '0 ' + C;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'slider');

    /* k.min / k.max are mutable — updateKnobRange writes them directly */
    const k = {
      el, input, step, def, arc, ptr,
      min: parseFloat(input.min),
      max: parseFloat(input.max),
      curve,
    };
    knobs.push(k);

    /* All clamping uses k.min / k.max so preset range changes take effect */
    function setVal(v, fire) {
      v = Math.max(k.min, Math.min(k.max, v));
      const snapped = Math.round((v - k.min) / step) * step + k.min;
      input.value = String(parseFloat(snapped.toFixed(10))); // avoid float dust
      paint(k);
      if (fire) input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ── drag (works in normalized t-space so log/power knobs feel even) ──
    let dragging = false, dragStarted = false, startY = 0, startT = 0;
    el.addEventListener('pointerdown', (e) => {
      if (input.disabled) return;
      dragging = true; dragStarted = false;
      startY = e.clientY;
      startT = valToT(parseFloat(input.value), k);
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = startY - e.clientY;
      // 3px dead-zone prevents micro-movements from registering as drag
      if (!dragStarted && Math.abs(dy) < 3) return;
      dragStarted = true;
      el.classList.add('dragging');
      const fine  = e.shiftKey ? 0.25 : 1;
      const delta = (dy / 200) * fine;
      setVal(tToVal(startT + delta, k), true);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false; dragStarted = false;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.addEventListener('pointerup',     end);
    el.addEventListener('pointercancel', end);

    // ── wheel ──
    el.addEventListener('wheel', (e) => {
      if (input.disabled) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      if (k.curve) {
        // curved knob: step in normalized space (~60 ticks = full range)
        const fine = e.shiftKey ? 0.005 : 1 / 60;
        const curT = valToT(parseFloat(input.value), k);
        setVal(tToVal(curT + dir * fine, k), true);
      } else {
        // linear knob: step in value space
        const fine = e.shiftKey ? 1 : Math.max(1, (k.max - k.min) / 60 / step);
        setVal(parseFloat(input.value) + dir * step * fine, true);
      }
    }, { passive: false });

    // ── double-click → reset ──
    el.addEventListener('dblclick', () => {
      if (!input.disabled) setVal(def, true);
    });

    // ── keyboard ──
    el.addEventListener('keydown', (e) => {
      if (input.disabled) return;
      let d = 0;
      if      (e.key === 'ArrowUp'   || e.key === 'ArrowRight') d =  1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft')  d = -1;
      else return;
      e.preventDefault();
      setVal(parseFloat(input.value) + d * step * (e.shiftKey ? 5 : 1), true);
    });

    paint(k);
  }

  function paint(k) {
    const v = parseFloat(k.input.value);
    const t = valToT(v, k);
    k.arc.style.strokeDasharray = (Math.max(0, Math.min(1, t)) * SWEEP) + ' ' + C;
    k.ptr.setAttribute('transform', 'rotate(' + (-135 + t * TAU) + ' 40 40)');
    k.el.classList.toggle('is-disabled', !!k.input.disabled);
    k.el.setAttribute('aria-valuenow', k.input.value);
  }

  window.syncKnobs = function () { knobs.forEach(paint); };

  window.flashKnob = function (inputId) {
    var k = knobs.find(function (k) { return k.input.id === inputId; });
    if (!k) return;
    k.arc.classList.remove('flashing');
    void k.arc.offsetWidth; // force reflow to restart animation
    k.arc.classList.add('flashing');
  };

  /* Update a knob's min/max at runtime (used by presets for range constraining) */
  window.updateKnobRange = function (inputId, newMin, newMax) {
    const k = knobs.find(function (k) { return k.input.id === inputId; });
    if (!k) return;
    k.min = newMin;
    k.max = newMax;
    k.input.min = String(newMin);
    k.input.max = String(newMax);
    // Clamp current value to new range
    const cur     = parseFloat(k.input.value);
    const clamped = Math.max(newMin, Math.min(newMax, cur));
    if (cur !== clamped) {
      k.input.value = String(clamped);
      k.input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    paint(k);
  };

  document.querySelectorAll('.knob[data-for]').forEach(build);
})();
