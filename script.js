const grid = document.querySelector('#projects');
const dialog = document.querySelector('#project-dialog');
const video = document.querySelector('#project-video');
let lastTrigger;
let playbackRequest = 0;
const playbackStatus = document.querySelector('#playback-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const visiblePreviews = new Set();
function playPreview(v) {
  if (reducedMotion.matches || document.hidden || dialog.open) return;
  if (!v.getAttribute('src')) v.src = v.dataset.preview;
  v.muted = true;
  v.play().then(() => { if (!v.paused) v.classList.add('playing'); }).catch(() => v.classList.remove('playing'));
}
function pausePreview(v) { v.pause(); v.classList.remove('playing'); }
const previewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(({target, isIntersecting}) => {
    if (isIntersecting) { visiblePreviews.add(target); playPreview(target); }
    else { visiblePreviews.delete(target); pausePreview(target); }
  });
}, {threshold: 0.2}) : null;
function observePreviews() {
  document.querySelectorAll('.preview-video').forEach(v => {
    if(previewObserver) previewObserver.observe(v);
    else if(v.closest('.hero-film')) {visiblePreviews.add(v); playPreview(v);}
  });
}
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(({target,isIntersecting}) => { if(isIntersecting) {target.classList.add('revealed');revealObserver.unobserve(target);} });
}, {threshold:0.08}) : null;
function observeReveals() {
  if(!revealObserver || reducedMotion.matches) return;
  document.querySelectorAll('.project-card,.section-heading,.about > div,.contact-row').forEach(el => {
    el.classList.add('reveal'); revealObserver.observe(el);
  });
}
function render(filter = 'all') {
  grid.querySelectorAll('.preview-video').forEach(v => {pausePreview(v); visiblePreviews.delete(v); previewObserver?.unobserve(v);});
  grid.querySelectorAll('.project-card').forEach(el => revealObserver?.unobserve(el));
  grid.replaceChildren();
  PROJECTS.filter(p => filter === 'all' || p.groups.includes(filter)).forEach((p, index) => {
    const article = document.createElement('article'); article.className = 'project-card';
    const button = document.createElement('button'); button.className = 'project-cover'; button.dataset.project = p.id; button.setAttribute('aria-label', `Assistir ${p.client}: ${p.title}`);
    const img = document.createElement('img'); img.src = `assets/${p.id}.jpg`; img.alt = `Cena do projeto ${p.client}`; img.loading = 'lazy'; img.width = 540; img.height = 960;
    const preview = document.createElement('video'); preview.className = 'preview-video'; preview.dataset.preview = `assets/${p.id}-preview.mp4`; preview.muted = true; preview.loop = true; preview.playsInline = true; preview.preload = 'none'; preview.tabIndex = -1; preview.setAttribute('aria-hidden','true');
    const play = document.createElement('span'); play.className = 'card-play'; play.textContent = '▶'; play.setAttribute('aria-hidden','true');
    const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = p.duration;
    const caption = document.createElement('span'); caption.className = 'cover-caption'; caption.textContent = 'Assistir ao projeto ↗';
    const rank = document.createElement('span'); rank.className = 'project-rank'; rank.textContent = String(index + 1).padStart(2, '0'); rank.setAttribute('aria-hidden', 'true');
    button.append(img, preview, play, duration, caption, rank);
    const info = document.createElement('div'); info.className = 'card-info';
    const label = document.createElement('p'); label.className = 'card-label'; label.textContent = p.label;
    const title = document.createElement('h3'); title.textContent = p.title;
    const client = document.createElement('p'); client.className = 'card-client'; client.textContent = `${p.client} · ${p.role}`;
    info.append(label,title,client); article.append(button,info); grid.append(article);
  });
  observePreviews(); observeReveals();
}
function openProject(id, trigger) {
  const p = PROJECTS.find(p => p.id === id); if (!p) return;
  lastTrigger = trigger;
  document.querySelector('#dialog-title').textContent = p.title;
  document.querySelector('#dialog-category').textContent = p.client + ' / ' + p.label;
  document.querySelector('#dialog-description').textContent = p.description;
  document.querySelector('#dialog-role').textContent = p.role;
  document.querySelector('#dialog-format').textContent = `Vertical · ${p.duration}`;
  document.querySelector('#dialog-context').textContent = p.context || '';
  const projectContact = document.querySelector('#dialog-contact');
  projectContact.href = 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(`Olá, João! Vi seu portfólio e o projeto “${p.title}”. Gostaria de conversar sobre um trabalho de edição.`);
  video.src = `assets/${p.id}.mp4`; video.poster = `assets/${p.id}.jpg`;
  dialog.showModal(); document.body.classList.add('modal-open');
  visiblePreviews.forEach(pausePreview);
  const request = ++playbackRequest;
  video.muted = false;
  video.volume = 1;
  playbackStatus.textContent = 'Carregando vídeo…';
  // play() deve ocorrer dentro do clique para preservar a autorização de áudio.
  video.play().catch(() => {
    if (request === playbackRequest && dialog.open) playbackStatus.textContent = 'Toque em ▶ nos controles para iniciar o vídeo.';
  });
}
document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-project]'); if(trigger) openProject(trigger.dataset.project,trigger);
});
document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(x => {const active=x===b; x.classList.toggle('active',active); x.setAttribute('aria-pressed',String(active));}); render(b.dataset.filter);
}));
document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {if(e.target === dialog) {const r=dialog.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) dialog.close();}});
dialog.addEventListener('close', () => {++playbackRequest; playbackStatus.textContent = ''; video.pause(); video.removeAttribute('src'); video.load(); document.body.classList.remove('modal-open'); lastTrigger?.focus(); visiblePreviews.forEach(playPreview);});
document.addEventListener('visibilitychange', () => visiblePreviews.forEach(document.hidden ? pausePreview : playPreview));
reducedMotion.addEventListener('change', () => {visiblePreviews.forEach(reducedMotion.matches ? pausePreview : playPreview); if(reducedMotion.matches) document.querySelectorAll('.reveal').forEach(el => el.classList.add('revealed'));});
const links=[];
function addContact(label,url){const a=document.createElement('a');a.className='contact-link';a.textContent=label+' ↗';a.href=url;if(url.startsWith('https://wa.me/')) {a.classList.add('whatsapp-button');a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Conversar com João Victor no WhatsApp, abre em nova aba');} links.push(a);}
if(CONTACT.email) addContact(CONTACT.email, 'mailto:'+CONTACT.email);
if(CONTACT.whatsapp && /^\d+$/.test(CONTACT.whatsapp)) addContact('Conversar no WhatsApp','https://wa.me/'+CONTACT.whatsapp);
if(CONTACT.instagram && /^https:\/\/(www\.)?instagram\.com\//.test(CONTACT.instagram)) addContact('Instagram',CONTACT.instagram);
if(links.length) document.querySelector('#contact-links').replaceChildren(...links);
render();

document.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => { grid.scrollBy({left:Number(b.dataset.scroll)*Math.min(grid.clientWidth*.8,650),behavior:reducedMotion.matches?'instant':'smooth'}); }));

video.addEventListener('playing', () => { playbackStatus.textContent = ''; });
video.addEventListener('waiting', () => { if(dialog.open && !video.paused) playbackStatus.textContent = 'Carregando vídeo…'; });
video.addEventListener('error', () => { if(dialog.open) playbackStatus.textContent = 'Não foi possível carregar. Confira sua conexão e abra o projeto novamente.'; });
const filmWall = document.querySelector('.hero-wall');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { filmWall.classList.toggle('motion-paused', !entry.isIntersecting || document.hidden); }).observe(document.querySelector('#inicio'));
}
document.addEventListener('visibilitychange', () => { filmWall.classList.toggle('motion-paused', document.hidden || document.querySelector('#inicio').getBoundingClientRect().bottom <= 0); });
