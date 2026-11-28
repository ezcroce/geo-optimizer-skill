// Transizione "a cerchio" tra sito e gioco (script classico, condiviso dalle due pagine)
(function () {
  function go(href, x, y) {
    let w = document.getElementById('pageWipe');
    if (!w) { w = document.createElement('div'); w.id = 'pageWipe'; document.body.appendChild(w); }
    w.style.setProperty('--wx', x + 'px');
    w.style.setProperty('--wy', y + 'px');
    w.classList.remove('in'); void w.offsetWidth; w.classList.add('in');
    setTimeout(function () { location.href = href; }, 520);
  }
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[data-transition]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    go(a.getAttribute('href'), r.left + r.width / 2, r.top + r.height / 2);
  });
  // tornando indietro con la cronologia, la pagina potrebbe essere ancora coperta
  addEventListener('pageshow', function (e) {
    if (e.persisted) { const w = document.getElementById('pageWipe'); if (w) w.classList.remove('in'); }
  });
})();
