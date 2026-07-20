/* =========================================================================
   ELECTRO-GRÚA // CAPA DE PRESENTACIÓN — nav, scroll-reveal, contadores
   No toca el estado del simulador (App/Sound viven en app1.js)
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. NAV: fondo al hacer scroll + enlace activo + menú móvil
------------------------------------------------------------------------- */
(function siteNav(){
  const nav = document.getElementById('site-nav');
  const links = document.getElementById('nav-links');
  const toggle = document.getElementById('nav-toggle');
  if(!nav) return;

  window.addEventListener('scroll', ()=>{
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive:true });

  if(toggle){
    toggle.addEventListener('click', ()=> links.classList.toggle('open'));
  }

  document.querySelectorAll('a[data-nav]').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const id = a.getAttribute('href');
      if(id && id.startsWith('#')){
        const el = document.querySelector(id);
        if(el){
          e.preventDefault();
          el.scrollIntoView({ behavior:'smooth' });
          links.classList.remove('open');
        }
      }
    });
  });

  const navAnchors = Array.from(document.querySelectorAll('.nav-links a[data-nav]'));
  const sections = navAnchors
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if('IntersectionObserver' in window && sections.length){
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          navAnchors.forEach(a=>a.classList.remove('active'));
          const match = navAnchors.find(a => a.getAttribute('href') === '#'+entry.target.id);
          if(match) match.classList.add('active');
        }
      });
    }, { rootMargin:'-45% 0px -50% 0px', threshold:0 });
    sections.forEach(s=>obs.observe(s));
  }
})();

/* -------------------------------------------------------------------------
   2. SCROLL REVEAL: fade + rise para secciones informativas
------------------------------------------------------------------------- */
(function scrollReveal(){
  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if(!targets.length) return;

  if(!('IntersectionObserver' in window)){
    targets.forEach(t=>t.classList.add('in-view'));
    return;
  }

  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold:0.15, rootMargin:'0px 0px -8% 0px' });

  targets.forEach(t=>obs.observe(t));
})();

/* -------------------------------------------------------------------------
   3. CONTADORES: cifras del panel "stat-strip" cuentan al entrar en vista
------------------------------------------------------------------------- */
(function statCounters(){
  const stats = document.querySelectorAll('.stat-chip b[data-count]');
  if(!stats.length) return;

  function animateCount(el){
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 1100;
    const start = performance.now();

    function tick(now){
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(target * eased);
      el.textContent = value + suffix;
      if(p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if(!('IntersectionObserver' in window)){
    stats.forEach(animateCount);
    return;
  }

  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        animateCount(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold:0.6 });

  stats.forEach(s=>obs.observe(s));
})();

/* -------------------------------------------------------------------------
   4. REEL TRACK: soporte de arrastre con rueda del mouse (desktop)
------------------------------------------------------------------------- */
(function reelDragScroll(){
  const track = document.querySelector('.reel-track');
  if(!track) return;
  track.addEventListener('wheel', (e)=>{
    if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive:false });
})();
