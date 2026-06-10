'use strict';
/* ============================================================
   Accent color picker (titlebar swatches).
   window.PALETTES + initial THEME are set by the inline init
   that runs before app.js. Here we render the swatches and
   re-color everything live on click (CSS vars + canvas via
   app.js render()).
   ============================================================ */
(function () {
  const wrap = document.getElementById('swatches');
  if (!wrap || !window.PALETTES) return;
  const rootStyle = document.documentElement.style;

  function apply(key) {
    const p = window.PALETTES[key];
    if (!p) return;
    window.THEME.accent = p.accent;
    window.THEME.key = key;
    rootStyle.setProperty('--accent', p.accent);
    rootStyle.setProperty('--accent-dim', p.dim);
    try { localStorage.setItem('comp_accent', key); } catch (e) {}
    wrap.querySelectorAll('.swatch').forEach((s) =>
      s.classList.toggle('active', s.dataset.key === key));
    if (typeof render === 'function') render();   // recolor canvases
    if (window.syncKnobs) window.syncKnobs();
  }

  Object.keys(window.PALETTES).forEach((key) => {
    const p = window.PALETTES[key];
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.key = key;
    b.title = p.name;
    b.setAttribute('aria-label', p.name + ' accent');
    b.style.setProperty('--sw', p.accent);
    if ((window.THEME && window.THEME.key) === key) b.classList.add('active');
    b.addEventListener('click', () => apply(key));
    wrap.appendChild(b);
  });
})();
