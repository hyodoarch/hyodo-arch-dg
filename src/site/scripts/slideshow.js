(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function init() {
    document.querySelectorAll('.dg-slideshow:not([data-initialized])').forEach(root => {
      root.dataset.initialized = 'true';
      const slides = [...root.querySelectorAll('.dg-slideshow__slide')];
      root.style.setProperty('--dg-slideshow-speed', `${Number(root.dataset.speed ?? 1000)}ms`);
      if (slides.length < 2) return;
      const autoplay = root.dataset.autoplay === 'true';
      const duration = Number(root.dataset.autoPlayDuration ?? 3000);
      let current = 0, timer, paused = false, hovering = false, touching = false, start;
      root.tabIndex = 0;
      function button(label, text, action) {
        const button = document.createElement('button');
        button.type = 'button'; button.setAttribute('aria-label', label);
        button.textContent = text; button.addEventListener('click', action);
        return button;
      }
      function schedule() {
        clearTimeout(timer);
        if (!root.isConnected || !autoplay || paused || reduced.matches || document.hidden || hovering || touching || root.contains(document.activeElement)) return;
        timer = setTimeout(() => show(current + 1), duration);
      }
      function show(index) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.classList.toggle('is-active', i === current);
          slide.setAttribute('aria-hidden', String(i !== current));
          dots[i]?.setAttribute('aria-current', String(i === current));
        });
        schedule();
      }
      const stage = root.querySelector('.dg-slideshow__stage');
      if (root.dataset.arrow === 'true') {
        const previous = button('前の画像', '‹', () => show(current - 1));
        const next = button('次の画像', '›', () => show(current + 1));
        previous.className = 'dg-slideshow__previous'; next.className = 'dg-slideshow__next';
        stage.append(previous, next);
      }
      const dotGroup = document.createElement('div'); dotGroup.className = 'dg-slideshow__dots';
      const dots = root.dataset.nav === 'true' ? slides.map((_, i) => {
        const dot = button(`画像 ${i + 1} を表示`, '', () => show(i));
        dotGroup.append(dot); return dot;
      }) : [];
      if (dots.length) root.append(dotGroup);
      root.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1));
      });
      root.addEventListener('mouseenter', () => { hovering = true; schedule(); });
      root.addEventListener('mouseleave', () => { hovering = false; schedule(); });
      root.addEventListener('focusin', schedule);
      root.addEventListener('focusout', () => setTimeout(schedule, 0));
      stage.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' || e.target.closest('button')) return;
        start = { x: e.clientX, y: e.clientY }; touching = true; schedule();
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointerup', e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        start = null; touching = false;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          paused = true; // Keep the selected photo still until this page is reloaded.
          show(current + (dx < 0 ? 1 : -1));
        }
        else schedule();
      });
      stage.addEventListener('pointercancel', () => { start = null; touching = false; schedule(); });
      document.addEventListener('visibilitychange', schedule);
      reduced.addEventListener('change', schedule);
      show(0);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('nav', init);
})();
