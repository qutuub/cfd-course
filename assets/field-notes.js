/* Reading position only; all lesson content and disclosures work without this. */
(() => {
  const bar = document.querySelector('.reading-progress i');
  function update() {
    if (!bar) return;
    const total = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (total > 0 ? Math.min(100, scrollY / total * 100) : 0) + '%';
  }
  addEventListener('scroll', update, {passive:true});
  addEventListener('resize', update);
  document.querySelectorAll('details').forEach(el => el.addEventListener('toggle', update));
  update();
})();
