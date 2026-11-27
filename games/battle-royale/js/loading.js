// ─────────────────────────────────────────────────────────────
//  v40: schermate di caricamento
//  Illustrazione a tutto schermo (cambia a ogni caricamento e, se dura, sfuma nella successiva),
//  logo, stagione, barra di avanzamento con percentuale, fase in corso e consigli a rotazione.
//  Script classico (non modulo): parte subito, prima che il gioco abbia finito di scaricarsi, e
//  durante il primo avvio conta da solo i file arrivati. Poi il gioco lo guida con
//  window.LOADING.set(frazione, testo). Le altre parti del gioco continuano a mostrare/nascondere
//  #loading con la classe 'hidden' e a scrivere la fase nel suo <p>: qui ce ne accorgiamo.
// ─────────────────────────────────────────────────────────────
(function () {
  var ART = [
    { src: 'img/loading/load1.jpg', title: 'Il Gargoyle del Colosseo', sub: 'Scendi sulla sabbia… se hai coraggio' },
    { src: 'img/loading/load2.jpg', title: 'Si parte!', sub: 'Salta dal bus e plana dove vuoi' },
    { src: 'img/loading/load3.jpg', title: 'Costruisci, ripara, sopravvivi', sub: 'La tempesta non aspetta nessuno' },
    { src: 'img/loading/load4.jpg', title: 'Vittoria Reale', sub: 'Festeggia con il tuo balletto preferito' },
  ];
  var TIPS = [
    'Il cerchio della tempesta si stringe fase dopo fase: guarda la minimappa per sapere dove andare.',
    'Abbassati (C) per essere un bersaglio più piccolo e sparare con meno dispersione.',
    'Tieni W contro un muro e premi Spazio per arrampicarti fino al tetto.',
    'I forzieri dorati luccicano e fanno un suono: seguili per trovare armi migliori.',
    'Premi Q per costruire un muro al volo: costa 10 di legno.',
    'Col piccone raccogli materiali da muri, alberi e casse.',
    'Nel Colosseo può dormire il Gargoyle: sconfiggilo per prendere gli Artigli leggendari.',
    'Gli Artigli: clic per la combo di quattro colpi, mirando fai il balzo.',
    'Nascosto nell’erba alta sei molto più difficile da vedere.',
    'Le pozioni scudo danno 50 punti di scudo: bevile prima dello scontro.',
    'I colpi alla testa fanno molti più danni.',
    'Più un’arma è rara (verde, blu, viola, oro) più fa male.',
    'Missioni giornaliere e settimanali danno tanti XP per il pass battaglia.',
    'Nel pass della Stagione 2 c’è una ricompensa a ogni livello, anche nella parte gratuita.',
    'Sul telefono il fuoco automatico spara da solo quando il mirino è su un avversario.',
    'Sul telefono puoi spostare e ridimensionare i pulsanti: Impostazioni → Controlli → Disponi i pulsanti.',
    'Spingi il joystick fino in fondo verso l’alto per correre.',
    'Premi B (o il pulsante 😀) per un balletto: 6, 7, 8, 9, 0 e ’ li scelgono direttamente.',
    'Eliminato? Guarda chi ti ha battuto e cambia giocatore con ← e →.',
    'Online con gli amici: crea una lobby e mandagli il codice o il link.',
    'In Duo, Trio e Squad i compagni hanno il loro colore sulla minimappa: restate vicini.',
    'Il deltaplano si apre da solo vicino al suolo, ma aprirlo prima ti fa arrivare più lontano.',
    'Il negozio cambia ogni giorno a mezzanotte.',
    'Le stufe delle casette si accendono: belle da vedere di notte.',
  ];
  var el, img0, img1, bar, pct, title, sub, tip, stage, front = 0;
  var target = 0, shown = 0, auto = true, artIdx = -1, tipIdx = Math.floor(Math.random() * TIPS.length);
  var tArt = 0, tTip = 0, visible = false, raf = 0, started = 0;

  function pickArt() {
    var i;
    do { i = Math.floor(Math.random() * ART.length); } while (ART.length > 1 && i === artIdx);
    return i;
  }
  function showArt(i, instant) {
    artIdx = i;
    var a = ART[i], next = front ? img0 : img1, cur = front ? img1 : img0;
    next.style.backgroundImage = 'url("' + a.src + '")';
    next.classList.remove('kb'); void next.offsetWidth; next.classList.add('kb');
    if (instant) { next.style.transition = 'none'; cur.style.transition = 'none'; }
    next.style.opacity = 1; cur.style.opacity = 0;
    if (instant) { void next.offsetWidth; next.style.transition = ''; cur.style.transition = ''; }
    front = 1 - front;
    title.textContent = a.title; sub.textContent = a.sub;
  }
  function nextTip() {
    tipIdx = (tipIdx + 1) % TIPS.length;
    tip.classList.remove('in'); void tip.offsetWidth;
    tip.textContent = TIPS[tipIdx]; tip.classList.add('in');
  }
  function loop(now) {
    raf = 0;
    if (!visible) return;
    // senza indicazioni dal gioco la barra avanza piano da sola (mai oltre il 92%)
    if (auto) target = Math.max(target, Math.min(0.92, 1 - Math.exp(-(now - started) / 9000)));
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.002) shown = target;
    bar.style.transform = 'scaleX(' + shown.toFixed(4) + ')';
    pct.textContent = Math.round(shown * 100) + '%';
    if (now - tTip > 5200) { tTip = now; nextTip(); }
    if (now - tArt > 9000) { tArt = now; showArt(pickArt(), false); }
    raf = requestAnimationFrame(loop);
  }
  function onShow() {
    if (visible) return;
    visible = true; started = performance.now(); tTip = tArt = started;
    target = 0; shown = 0; auto = true;
    showArt(pickArt(), true); nextTip();
    el.classList.remove('out');
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function onHide() { visible = false; }

  function build() {
    el = document.getElementById('loading');
    if (!el) return;
    var p = el.querySelector('p');
    el.classList.add('ld40');
    el.innerHTML =
      '<div class="ldart"></div><div class="ldart"></div><div class="ldshade"></div>' +
      '<div class="ldtop"><div class="ldlogo">ARENA<span>ROYALE 3D</span></div><div class="ldseason">Stagione 2 · Il Colosseo</div></div>' +
      '<div class="ldcap"><b class="ldtitle"></b><span class="ldsub"></span></div>' +
      '<div class="ldbottom">' +
      '  <div class="ldtipbox"><span class="ldtiplbl">💡 CONSIGLIO</span><span class="ldtip"></span></div>' +
      '  <div class="ldrow"><div class="spinner"></div><p></p><span class="ldpct">0%</span></div>' +
      '  <div class="ldbar"><i></i></div>' +
      '</div>';
    var arts = el.querySelectorAll('.ldart');
    img0 = arts[0]; img1 = arts[1];
    bar = el.querySelector('.ldbar i'); pct = el.querySelector('.ldpct');
    title = el.querySelector('.ldtitle'); sub = el.querySelector('.ldsub'); tip = el.querySelector('.ldtip');
    stage = el.querySelector('p');
    stage.textContent = (p && p.textContent) || 'Caricamento…';
    tip.addEventListener('click', function () { tTip = performance.now(); nextTip(); });
    // il gioco mostra/nasconde la schermata con la classe 'hidden'
    new MutationObserver(function () { if (el.classList.contains('hidden')) onHide(); else onShow(); })
      .observe(el, { attributes: true, attributeFilter: ['class'] });
    if (!el.classList.contains('hidden')) onShow();
    // primo avvio: avanzamento in base ai file del gioco già arrivati
    try {
      var seen = 0, EXPECT = 70;
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) { if (/\.(js|glb|css)(\?|$)/.test(e.name)) seen++; });
        if (auto && visible) target = Math.max(target, Math.min(0.6, seen / EXPECT * 0.6));
      }).observe({ type: 'resource', buffered: true });
    } catch (e) { /* browser vecchio: avanza a tempo */ }
  }

  window.LOADING = {
    /** frazione 0..1 (null = lascia avanzare da sola) e testo della fase (facoltativo) */
    set: function (f, text) {
      if (!el) return;
      if (f == null) auto = true; else { auto = false; target = Math.max(0, Math.min(1, f)); }
      if (text) stage.textContent = text;
    },
    tips: TIPS, art: ART,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
