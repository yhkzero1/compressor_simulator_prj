'use strict';
/* ============================================================
   Rotary knob controller.
   Each .knob[data-for="<inputId>"] wraps a (visually hidden)
   native <input type=range>, which remains the source of truth
   that app.js reads. Dragging/scrolling the knob writes the
   range value and dispatches an 'input' event so app.js recomputes.
   Exposes window.syncKnobs() so programmatic value changes
   (e.g. AUTO makeup) refresh the dials.
   ============================================================ */
(function () {
  const C = 2 * Math.PI * 30;          // circumference, r=30
  const SWEEP = 0.75 * C;              // 270° visible arc
  const TAU = 270;                     // degrees of travel

  // shared gradient defs for the knob cap
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML =
    '<defs><radialGradient id="knobCap" cx="50%" cy="34%" r="70%">' +
    '<stop offset="0%" stop-color="#30333b"/>' +
    '<stop offset="55%" stop-color="#222view"/>' +
    '<stop offset="100%" stop-color="#16181c"/>' +
    '</radialGradient></defs>';
  defs.innerHTML = defs.innerHTML.replace('#222view', '#22242a');
  document.body.appendChild(defs);

  const knobs = [];

  function build(el) {
    const input = document.getElementById(el.dataset.for);
    if (!input) return;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const step = parseFloat(input.step) || 1;
    const def = el.dataset.default !== undefined ? parseFloat(el.dataset.default)
                                                 : parseFloat(input.value);

    el.innerHTML =
      '<svg viewBox="0 0 80 80" class="knob-svg">' +
        '<circle class="kb-track" cx="40" cy="40" r="30" transform="rotate(135 40 40)"/>' +
        '<circle class="kb-arc"   cx="40" cy="40" r="30" transform="rotate(135 40 40)"/>' +
        '<circle class="kb-cap"   cx="40" cy="40" r="21"/>' +
        '<circle class="kb-cap-ring" cx="40" cy="40" r="21"/>' +
        '<line   class="kb-ptr" x1="40" y1="40" x2="40" y2="16"/>' +
      '</svg>';

    const arc = el.querySelector('.kb-arc');
    const ptr = el.querySelector('.kb-ptr');
    arc.style.strokeDasharray = '0 ' + C;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'slider');

    const k = { el, input, min, max, step, def, arc, ptr };
    knobs.push(k);

    function setVal(v, fire) {
      v = Math.max(min, Math.min(max, v));
      const snapped = Math.round((v - min) / step) * step + min;
      input.value = String(snapped);
      paint(k);
      if (fire) input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // drag
    let dragging = false, startY = 0, startV = 0;
    el.addEventListener('pointerdown', (e) => {
      if (input.disabled) return;
      dragging = true; startY = e.clientY; startV = parseFloat(input.value);
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const fine = e.shiftKey ? 0.25 : 1;
      const dy = startY - e.clientY;
      const delta = (dy / 200) * (max - min) * fine;
      setVal(startV + delta, true);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    // wheel
    el.addEventListener('wheel', (e) => {
      if (input.disabled) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const fine = e.shiftKey ? 1 : Math.max(1, (max - min) / 60 / step);
      setVal(parseFloat(input.value) + dir * step * fine, true);
    }, { passive: false });

    // dblclick → default
    el.addEventListener('dblclick', () => { if (!input.disabled) setVal(def, true); });

    // keyboard
    el.addEventListener('keydown', (e) => {
      if (input.disabled) return;
      let d = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -1;
      else return;
      e.preventDefault();
      setVal(parseFloat(input.value) + d * step * (e.shiftKey ? 5 : 1), true);
    });

    paint(k);
  }

  function paint(k) {
    const v = parseFloat(k.input.value);
    const t = (v - k.min) / (k.max - k.min);
    k.arc.style.strokeDasharray = (t * SWEEP) + ' ' + C;
    k.ptr.setAttribute('transform', 'rotate(' + (-135 + t * TAU) + ' 40 40)');
    k.el.classList.toggle('is-disabled', !!k.input.disabled);
    k.el.setAttribute('aria-valuenow', k.input.value);
  }

  window.syncKnobs = function () { knobs.forEach(paint); };

  document.querySelectorAll('.knob[data-for]').forEach(build);
})();
