const grid = document.querySelector('#projects');
const dialog = document.querySelector('#project-dialog');
const video = document.querySelector('#project-video');
let lastTrigger;
let currentProject = null;
let currentFilter = 'all';
let playbackRequest = 0;
const playbackStatus = document.querySelector('#playback-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const visiblePreviews = new Set();

// Idioma: ?lang=en no link, depois a escolha salva, depois o idioma do navegador.
function initialLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'en' || fromUrl === 'pt') return fromUrl;
  try { const saved = localStorage.getItem('portfolio-lang'); if (saved === 'en' || saved === 'pt') return saved; } catch {}
  return (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
let lang = initialLang();
function t(key, vars = {}) {
  const text = I18N[lang][key] ?? I18N.pt[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}
function field(p, name) { return (lang === 'en' && PROJECTS_EN[p.id]?.[name]) || p[name]; }
function applyStaticTexts() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]').content = t('meta.description');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
function setLang(next) {
  lang = next;
  try { localStorage.setItem('portfolio-lang', lang); } catch {}
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  applyStaticTexts(); buildContacts(); render(currentFilter);
  if (dialog.open && currentProject) fillProject(currentProject);
}

function playPreview(v) {
  if (reducedMotion.matches || document.hidden || dialog.open) return;
  if (!v.getAttribute('src')) v.src = v.dataset.preview;
  v.muted = true;
  v.play().then(() => { if (!v.paused) v.classList.add('playing'); }).catch(() => v.classList.remove('playing'));
}
function pausePreview(v) { v.pause(); v.classList.remove('playing'); }
// Descarrega a prévia que saiu de cena: vídeos parados continuavam ocupando memória e o Chrome fechava a aba.
function releasePreview(v) { pausePreview(v); if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } }
// Com mouse, a prévia toca só no card sob o cursor: vários vídeos ao mesmo tempo travavam a rolagem no PC.
const hoverPreviews = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const previewObserver = !hoverPreviews && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(({target, isIntersecting}) => {
    if (isIntersecting) { visiblePreviews.add(target); playPreview(target); }
    else { visiblePreviews.delete(target); releasePreview(target); }
  });
}, {threshold: 0.2}) : null;
function observePreviews() {
  document.querySelectorAll('.preview-video').forEach(v => {
    if (hoverPreviews) {
      const cover = v.closest('.project-cover');
      const start = () => { visiblePreviews.forEach(releasePreview); visiblePreviews.clear(); visiblePreviews.add(v); playPreview(v); };
      const stop = () => { visiblePreviews.delete(v); releasePreview(v); };
      cover.addEventListener('pointerenter', start); cover.addEventListener('focus', start);
      cover.addEventListener('pointerleave', stop); cover.addEventListener('blur', stop);
    }
    else if(previewObserver) previewObserver.observe(v);
    else if(v.closest('.hero-film')) {visiblePreviews.add(v); playPreview(v);}
  });
}
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(({target,isIntersecting}) => { if(isIntersecting) {target.classList.add('revealed');revealObserver.unobserve(target);} });
}, {threshold:0.08}) : null;
function observeReveals() {
  if(!revealObserver || reducedMotion.matches) return;
  document.querySelectorAll('.project-card,.section-heading,.about > div,.contact-row').forEach(el => {
    if (el.classList.contains('revealed')) return;
    el.classList.add('reveal'); revealObserver.observe(el);
  });
}
function render(filter = 'all') {
  currentFilter = filter;
  grid.querySelectorAll('.preview-video').forEach(v => {releasePreview(v); visiblePreviews.delete(v); previewObserver?.unobserve(v);});
  grid.querySelectorAll('.project-card').forEach(el => revealObserver?.unobserve(el));
  grid.replaceChildren();
  PROJECTS.filter(p => filter === 'all' || p.groups.includes(filter)).forEach((p, index) => {
    const client = field(p, 'client'), title = field(p, 'title');
    const article = document.createElement('article'); article.className = 'project-card';
    const button = document.createElement('button'); button.className = 'project-cover'; button.dataset.project = p.id; button.setAttribute('aria-label', t('card.watch', {client, title}));
    const img = document.createElement('img'); img.src = `assets/${p.id}.jpg`; img.alt = t('card.alt', {client}); img.loading = 'lazy'; img.width = 540; img.height = 960;
    const preview = document.createElement('video'); preview.className = 'preview-video'; preview.dataset.preview = `assets/${p.id}-preview.mp4`; preview.muted = true; preview.loop = true; preview.playsInline = true; preview.preload = 'none'; preview.tabIndex = -1; preview.setAttribute('aria-hidden','true');
    const play = document.createElement('span'); play.className = 'card-play'; play.textContent = '▶'; play.setAttribute('aria-hidden','true');
    const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = p.duration;
    const caption = document.createElement('span'); caption.className = 'cover-caption'; caption.textContent = t('card.caption');
    const rank = document.createElement('span'); rank.className = 'project-rank'; rank.textContent = String(index + 1).padStart(2, '0'); rank.setAttribute('aria-hidden', 'true');
    button.append(img, preview, play, duration, caption, rank);
    const info = document.createElement('div'); info.className = 'card-info';
    const label = document.createElement('p'); label.className = 'card-label'; label.textContent = field(p, 'label');
    const heading = document.createElement('h3'); heading.textContent = title;
    const credit = document.createElement('p'); credit.className = 'card-client'; credit.textContent = `${client} · ${field(p, 'role')}`;
    info.append(label,heading,credit); article.append(button,info); grid.append(article);
  });
  observePreviews(); observeReveals();
}

// Começa a baixar o vídeo completo quando o mouse para sobre o projeto, para ele abrir sem espera.
function warmVideo(id) {
  if (dialog.open || !PROJECTS.some(p => p.id === id)) return;
  const src = `assets/${id}.mp4`;
  if (video.getAttribute('src') === src) return;
  video.preload = 'auto'; video.poster = `assets/${id}.jpg`; video.src = src;
}
// Se o mouse sai sem clicar, o vídeo é descarregado para não acumular memória.
function coolVideo() { if (!dialog.open && video.getAttribute('src')) { video.removeAttribute('src'); video.load(); } }
let warmTimer, coolTimer;
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const trigger = e.target.closest('[data-project]');
  clearTimeout(warmTimer);
  if (trigger) { clearTimeout(coolTimer); warmTimer = setTimeout(() => warmVideo(trigger.dataset.project), 250); }
});
document.addEventListener('pointerout', e => {
  if (e.pointerType !== 'mouse' || !e.target.closest('[data-project]') || e.relatedTarget?.closest?.('[data-project]')) return;
  clearTimeout(warmTimer); clearTimeout(coolTimer); coolTimer = setTimeout(coolVideo, 1500);
});
document.addEventListener('focusin', e => { const trigger = e.target.closest('[data-project]'); if (trigger) warmVideo(trigger.dataset.project); });

function fillProject(p) {
  const title = field(p, 'title');
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-category').textContent = field(p, 'client') + ' / ' + field(p, 'label');
  document.querySelector('#dialog-description').textContent = field(p, 'description');
  document.querySelector('#dialog-role').textContent = field(p, 'role');
  document.querySelector('#dialog-format').textContent = t('format.vertical', {duration: p.duration});
  document.querySelector('#dialog-context').textContent = field(p, 'context') || '';
  document.querySelector('#dialog-contact').href = 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(t('whatsapp.project', {title}));
}
function openProject(id, trigger) {
  const p = PROJECTS.find(p => p.id === id); if (!p) return;
  lastTrigger = trigger; currentProject = p; clearTimeout(coolTimer);
  fillProject(p);
  const src = `assets/${p.id}.mp4`;
  // Se o vídeo já começou a carregar no passar do mouse, aproveita o que já veio.
  if (video.getAttribute('src') !== src) { video.preload = 'auto'; video.poster = `assets/${p.id}.jpg`; video.src = src; }
  dialog.showModal(); document.body.classList.add('modal-open');
  visiblePreviews.forEach(pausePreview);
  const request = ++playbackRequest;
  video.muted = false;
  video.volume = 1;
  playbackStatus.textContent = video.readyState >= 3 ? '' : t('status.loading');
  // play() deve ocorrer dentro do clique para preservar a autorização de áudio.
  video.play().catch(() => {
    if (request === playbackRequest && dialog.open) playbackStatus.textContent = t('status.tap');
  });
}
document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-project]'); if(trigger) openProject(trigger.dataset.project,trigger);
});
document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(x => {const active=x===b; x.classList.toggle('active',active); x.setAttribute('aria-pressed',String(active));}); render(b.dataset.filter);
}));
document.querySelector('.lang-toggle').addEventListener('click', () => setLang(lang === 'en' ? 'pt' : 'en'));
document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {if(e.target === dialog) {const r=dialog.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) dialog.close();}});
dialog.addEventListener('close', () => {++playbackRequest; currentProject = null; playbackStatus.textContent = ''; video.pause(); video.removeAttribute('src'); video.load(); document.body.classList.remove('modal-open'); lastTrigger?.focus(); visiblePreviews.forEach(playPreview);});
document.addEventListener('visibilitychange', () => visiblePreviews.forEach(document.hidden ? pausePreview : playPreview));
reducedMotion.addEventListener('change', () => {visiblePreviews.forEach(reducedMotion.matches ? pausePreview : playPreview); if(reducedMotion.matches) document.querySelectorAll('.reveal').forEach(el => el.classList.add('revealed'));});
function buildContacts() {
  const links = [];
  const addContact = (label, url) => {const a=document.createElement('a');a.className='contact-link';a.textContent=label+' ↗';a.href=url;if(url.startsWith('https://wa.me/')) {a.classList.add('whatsapp-button');a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',t('contact.whatsappLabel'));} links.push(a);};
  if(CONTACT.email) addContact(CONTACT.email, 'mailto:'+CONTACT.email);
  if(CONTACT.whatsapp && /^\d+$/.test(CONTACT.whatsapp)) addContact(t('contact.whatsapp'),'https://wa.me/'+CONTACT.whatsapp);
  if(CONTACT.instagram && /^https:\/\/(www\.)?instagram\.com\//.test(CONTACT.instagram)) addContact('Instagram',CONTACT.instagram);
  if(links.length) document.querySelector('#contact-links').replaceChildren(...links);
}
applyStaticTexts();
buildContacts();
render();

document.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => { grid.scrollBy({left:Number(b.dataset.scroll)*Math.min(grid.clientWidth*.8,650),behavior:reducedMotion.matches?'instant':'smooth'}); }));

video.addEventListener('playing', () => { playbackStatus.textContent = ''; });
video.addEventListener('waiting', () => { if(dialog.open && !video.paused) playbackStatus.textContent = t('status.loading'); });
video.addEventListener('error', () => { if(dialog.open) playbackStatus.textContent = t('status.error'); });
const filmWall = document.querySelector('.hero-wall');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { filmWall.classList.toggle('motion-paused', !entry.isIntersecting || document.hidden); }).observe(document.querySelector('#inicio'));
}
document.addEventListener('visibilitychange', () => { filmWall.classList.toggle('motion-paused', document.hidden || document.querySelector('#inicio').getBoundingClientRect().bottom <= 0); });
// Pausa as esteiras enquanto a página rola, para a rolagem não disputar quadros com elas.
let scrollIdle;
window.addEventListener('scroll', () => { filmWall.classList.add('scrolling'); clearTimeout(scrollIdle); scrollIdle = setTimeout(() => filmWall.classList.remove('scrolling'), 180); }, {passive: true});
