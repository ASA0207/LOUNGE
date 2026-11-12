/*
 * Lounge — interactive experience (vanilla JavaScript)
 * All inputs are local-only. There is no server, analytics, tracking, or form submission.
 */
(() => {
  'use strict';
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch {} }
  };
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} }
  };

  // 01 — cinematic entry, with keyboard-accessible skip and remembered session choice
  const entryScreen = $('#entryScreen');
  const mainContent = $('#main');
  const header = $('#siteHeader');
  let entryTimer;
  const setPageInert = (blocked) => {
    mainContent.inert = blocked;
    header.inert = blocked;
    $('#backTop').inert = blocked;
  };
  const exitEntry = () => {
    if (!body.classList.contains('entry-active')) return;
    session.set('lounge-entered', 'yes');
    body.classList.add('entry-exit');
    body.classList.remove('entry-active');
    entryScreen.setAttribute('aria-hidden', 'true');
    clearTimeout(entryTimer);
    entryTimer = window.setTimeout(() => {
      body.classList.remove('entry-exit', 'overlay-locked');
      setPageInert(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      $('#heroHeading').setAttribute('tabindex', '-1');
      $('#heroHeading').focus({ preventScroll: true });
    }, reducedMotion ? 0 : 1150);
  };
  if (session.get('lounge-entered') !== 'yes') {
    body.classList.add('entry-active', 'overlay-locked');
    setPageInert(true);
    entryScreen.setAttribute('aria-hidden', 'false');
    $('#enterButton').focus({ preventScroll: true });
  }
  $('#enterButton').addEventListener('click', exitEntry);
  $('#skipEntry').addEventListener('click', exitEntry);

  // 02 — theme preferences
  const applyTheme = (theme) => {
    const next = theme === 'champagne' ? 'champagne' : 'midnight';
    body.dataset.theme = next;
    $('#themeIcon').textContent = next === 'midnight' ? '☀' : '☾';
    $('#themeToggle').setAttribute('aria-label', next === 'midnight' ? '샴페인 밝은 테마로 바꾸기' : '미드나이트 어두운 테마로 바꾸기');
    $('meta[name="theme-color"]').content = next === 'midnight' ? '#07101b' : '#efe9dc';
    storage.set('lounge-theme', next);
  };
  applyTheme(storage.get('lounge-theme') || 'midnight');
  $('#themeToggle').addEventListener('click', () => applyTheme(body.dataset.theme === 'midnight' ? 'champagne' : 'midnight'));

  // 03 — responsive menu / scroll meter / active nav
  const menuToggle = $('#menuToggle');
  const mobileNav = $('#mobileNav');
  const setMenu = (open) => {
    const next = Boolean(open);
    menuToggle.classList.toggle('open', next);
    mobileNav.classList.toggle('open', next);
    menuToggle.setAttribute('aria-expanded', String(next));
    menuToggle.setAttribute('aria-label', next ? '메뉴 닫기' : '메뉴 열기');
    mobileNav.setAttribute('aria-hidden', String(!next));
    mobileNav.inert = !next;
  };
  setMenu(false);
  menuToggle.addEventListener('click', () => setMenu(!mobileNav.classList.contains('open')));
  $$('#mobileNav a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', event => {
    if (mobileNav.classList.contains('open') && !header.contains(event.target)) setMenu(false);
  });
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 35);
    $('#backTop').classList.toggle('shown', window.scrollY > 640);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    $('#scrollProgress').style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
  $('#backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }));
  $('#year').textContent = new Date().getFullYear();
  const navObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      $$('.desktop-nav a').forEach(link => link.classList.toggle('active', link.dataset.nav === id));
    });
  }, { rootMargin: '-38% 0px -55% 0px' }) : null;
  if (navObserver) ['about', 'requirements', 'rules', 'join', 'contacts'].forEach(id => navObserver.observe(document.getElementById(id)));

  // 04 — reveal on scroll, stagger cards without an animation library
  const reveals = $$('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) reveals.forEach(el => el.classList.add('is-visible'));
  else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
      });
    }, { threshold: .075, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach((el, i) => { if (el.classList.contains('feature-card') || el.classList.contains('contact-card')) el.style.transitionDelay = `${(i % 3) * 65}ms`; revealObserver.observe(el); });
  }
  if (!reducedMotion && window.matchMedia('(pointer:fine)').matches) {
    const artWrap = $('#heroArtWrap');
    $('.hero-stage').addEventListener('pointermove', event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const dx = (event.clientX - bounds.left) / bounds.width - .5;
      const dy = (event.clientY - bounds.top) / bounds.height - .5;
      artWrap.style.transform = `translate3d(${dx * 12}px,${dy * 10}px,0) rotateY(${dx * 5}deg)`;
    });
    $('.hero-stage').addEventListener('pointerleave', () => { artWrap.style.transform = ''; });
  }

  // 05 — lightweight toast and clipboard fallback for local file:// viewing
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
  }
  async function copyText(value, name = '내용') {
    const text = String(value);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      toast(`${name} 복사 완료 ✦`);
      return true;
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(field);
      field.focus(); field.select();
      let succeeded = false;
      try { succeeded = document.execCommand('copy'); } catch {}
      field.remove();
      if (succeeded) { toast(`${name} 복사 완료 ✦`); return true; }
      toast('브라우저에서 복사가 차단됐습니다. 내용을 직접 선택해 주세요.');
      return false;
    }
  }
  $$('[data-copy]').forEach(button => button.addEventListener('click', () => copyText(button.dataset.copy, button.dataset.copyLabel || '텍스트')));

  // 06 — eligibility checklist
  const eligibility = $$('.eligibility-check');
  const updateEligibility = () => {
    const count = eligibility.filter(input => input.checked).length;
    $('#checkCount').textContent = `${count} / 4`;
    $('#checkProgress').style.width = `${count / eligibility.length * 100}%`;
    $('#checkCaption').textContent = count === 4 ? '체크리스트 완료' : count === 0 ? '하나씩 확인해주세요' : '확인 중입니다';
    const status = $('#checkCompleteText');
    status.classList.toggle('complete', count === 4);
    status.textContent = count === 4 ? '✦ 기본 가입 요건을 확인했어요! 운영진에게 문의해 주세요.' : '체크를 마치면 다음 단계를 안내해 드려요.';
  };
  eligibility.forEach(input => input.addEventListener('change', updateEligibility));
  updateEligibility();

  // 07 — searchable, filterable accordion rules
  let currentFilter = 'all';
  const ruleCards = $$('.rule-card');
  const filters = $$('.filter-btn');
  const ruleSearch = $('#ruleSearch');
  const renderRules = () => {
    const query = ruleSearch.value.trim().toLocaleLowerCase('ko');
    let shown = 0;
    ruleCards.forEach(card => {
      const content = `${card.textContent} ${card.dataset.search || ''}`.toLocaleLowerCase('ko');
      const show = (currentFilter === 'all' || card.dataset.category === currentFilter) && (!query || content.includes(query));
      card.hidden = !show;
      if (show) shown++;
    });
    $('#ruleResult').textContent = `${shown}개의 규칙 표시 중`;
    $('#ruleEmpty').hidden = shown > 0;
    const visible = ruleCards.filter(card => !card.hidden);
    $('#expandAllRules').innerHTML = visible.length && visible.every(card => card.open) ? '모두 접기 <span aria-hidden="true">−</span>' : '모두 펼쳐보기 <span aria-hidden="true">＋</span>';
  };
  filters.forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    filters.forEach(other => { const active = other === button; other.classList.toggle('active', active); other.setAttribute('aria-pressed', String(active)); });
    renderRules();
  }));
  ruleSearch.addEventListener('input', renderRules);
  ruleCards.forEach(card => card.addEventListener('toggle', renderRules));
  $('#expandAllRules').addEventListener('click', () => {
    const visible = ruleCards.filter(card => !card.hidden);
    const expand = !visible.every(card => card.open);
    visible.forEach(card => { card.open = expand; });
    renderRules();
  });
  renderRules();

  // 08 — recruitment message composer: locally previewed, never transmitted
  const fields = {
    age: $('#formAge'), gender: $('#formGender'), level: $('#formLevel'),
    activity: $('#formActivity'), time: $('#formTime'),
    kakao: $('#canKakao'), discord: $('#canDiscord')
  };
  const safeVal = (field) => field.value.trim() || '미입력';
  const buildApplication = () => [
    '안녕하세요! Lounge 길드 가입 문의드립니다.',
    '',
    `나이: ${safeVal(fields.age)}`,
    `성별: ${safeVal(fields.gender)}`,
    `레벨: ${safeVal(fields.level)}`,
    `접속률: ${safeVal(fields.activity)}`,
    `접속 시간대: ${safeVal(fields.time)}`,
    `오픈채팅 가능 여부: ${fields.kakao.checked ? '가능' : '불가능'}`,
    `디스코드 가능 여부: ${fields.discord.checked ? '가능' : '불가능'}`,
    '',
    '확인 부탁드립니다. 감사합니다!'
  ].join('\n');
  const updatePreview = () => { $('#applicationPreview').textContent = buildApplication(); };
  $('#inquiryForm').addEventListener('input', updatePreview);
  $('#inquiryForm').addEventListener('change', updatePreview);
  $('#inquiryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    $$('input[required]', $('#inquiryForm')).forEach(input => input.classList.toggle('invalid', !input.value.trim()));
    const empty = $$('input[required]', $('#inquiryForm')).find(input => !input.value.trim());
    if (empty) { empty.focus(); toast('필수 문의 정보를 모두 입력해 주세요.'); return; }
    if (!fields.kakao.checked || !fields.discord.checked) {
      toast('Lounge는 오픈채팅과 디스코드 모두 참여 필수입니다.');
      return;
    }
    const done = await copyText(buildApplication(), '가입 문의 메시지');
    if (done) toast('문의 내용 복사 완료! 운영진에게 붙여넣어 주세요.');
  });
  updatePreview();

  // 09 — passcode: displayed publicly by choice of guild organizer
  let passVisible = false;
  $('#revealPass').addEventListener('click', () => {
    passVisible = !passVisible;
    $('#joinPassDisplay').textContent = passVisible ? '090809' : '••••••';
    $('#revealPass').setAttribute('aria-pressed', String(passVisible));
    $('#revealPass').setAttribute('aria-label', passVisible ? '비밀번호 숨기기' : '비밀번호 보기');
  });

  // 10 — polished souvenir card; PNG is generated locally using Canvas
  const passInput = $('#passName');
  const passDisplay = $('#passNameDisplay');
  const getNickname = () => passInput.value.trim().replace(/\s+/g, ' ').slice(0, 18) || 'RUNNER';
  passInput.addEventListener('input', () => { passDisplay.textContent = getNickname(); });
  const keepsakeCard = $('#keepsakeCard');
  if (!reducedMotion && window.matchMedia('(pointer:fine)').matches) {
    keepsakeCard.addEventListener('pointermove', event => {
      const r = keepsakeCard.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - .5;
      const y = (event.clientY - r.top) / r.height - .5;
      keepsakeCard.style.transform = `rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
    });
    keepsakeCard.addEventListener('pointerleave', () => keepsakeCard.style.transform = '');
  }
  function roundRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  function cardCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 960;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0a1724'); bg.addColorStop(.53, '#183442'); bg.addColorStop(1, '#07111c');
    roundRect(ctx, 4, 4, w - 8, h - 8, 38); ctx.fillStyle = bg; ctx.fill();
    const wash = ctx.createRadialGradient(1100, 180, 20, 1100, 180, 850);
    wash.addColorStop(0, '#59726666'); wash.addColorStop(1, '#59726600');
    roundRect(ctx, 4, 4, w - 8, h - 8, 38); ctx.fillStyle = wash; ctx.fill();
    // fine geometric arcs
    ctx.save(); ctx.strokeStyle = '#ecd5a145'; ctx.lineWidth = 2;
    for (const r of [300, 430, 560, 690]) { ctx.beginPath(); ctx.arc(1120, 640, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([6, 16]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(1120, 640, 495, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    // flecks using deterministic coordinates (reproducible card)
    const sparkles = [[212,242,6],[550,194,3],[1250,228,5],[1430,394,3],[993,670,4],[390,713,3],[1310,795,5],[770,380,3],[1050,170,4]];
    ctx.strokeStyle = '#f9e6b0b0'; ctx.lineWidth = 2;
    sparkles.forEach(([x, y, r]) => { ctx.beginPath(); ctx.moveTo(x - r * 2, y); ctx.lineTo(x + r * 2, y); ctx.moveTo(x, y - r * 2); ctx.lineTo(x, y + r * 2); ctx.stroke(); });
    // double line + corner accents
    ctx.lineWidth = 4; ctx.strokeStyle = '#dec188dd'; roundRect(ctx, 7, 7, w - 14, h - 14, 37); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#d9bd8466'; roundRect(ctx, 28, 28, w - 56, h - 56, 27); ctx.stroke();
    ctx.fillStyle = '#fae8be'; ctx.font = '800 51px Manrope, Arial, sans-serif'; ctx.fillText('LOUNGE', 104, 146);
    ctx.fillStyle = '#e8c78b'; ctx.font = '38px serif'; ctx.fillText('✦', 385, 142);
    ctx.fillStyle = '#e5c99b'; ctx.textAlign = 'right'; ctx.font = '700 20px Manrope, Arial, sans-serif'; ctx.fillText('AN INVITATION TO BELONG', 1483, 141);
    ctx.textAlign = 'center'; ctx.fillStyle = '#d4b87b22'; ctx.font = '360px Georgia, serif'; ctx.fillText('✳', 950, 650);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8d3ac'; ctx.font = '700 22px Manrope, Arial, sans-serif'; ctx.fillText('A PERSONAL MEMENTO FOR', 105, 642);
    const nick = getNickname();
    ctx.fillStyle = '#fff0ca'; ctx.font = `600 ${/[^\u0000-\u007f]/.test(nick) ? '93px "Noto Sans KR",sans-serif' : 'italic 105px "Playfair Display",Georgia,serif'}`;
    let displayNick = nick;
    while (displayNick.length > 1 && ctx.measureText(displayNick).width > 1380) displayNick = displayNick.slice(0, -1);
    if (displayNick !== nick) displayNick += '…';
    ctx.fillText(displayNick, 102, 773);
    ctx.beginPath(); ctx.strokeStyle = '#d3b6869c'; ctx.lineWidth = 2; ctx.moveTo(105, 820); ctx.lineTo(1493, 820); ctx.stroke();
    ctx.fillStyle = '#d2c19d'; ctx.font = '700 19px Manrope, Arial, sans-serif'; ctx.fillText('TALES RUNNER GUILD', 105, 870);
    ctx.textAlign = 'center'; ctx.fillText('LV.15 / THE LOUNGE', 836, 870);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e5c688'; ctx.font = '37px Georgia, serif'; ctx.fillText('◇', 1490, 877);
    return canvas;
  }
  $('#downloadPass').addEventListener('click', () => {
    try {
      const canvas = cardCanvas();
      const save = (url, objectURL) => {
        const anchor = document.createElement('a');
        anchor.href = url;
        const safeName = getNickname().replace(/[\\/:*?"<>|]/g, '').slice(0, 18) || 'RUNNER';
        anchor.download = `LOUNGE_방문카드_${safeName}.png`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        if (objectURL) setTimeout(() => URL.revokeObjectURL(objectURL), 30000);
        toast('Lounge 기념 카드가 생성되었어요 ✦');
      };
      if (canvas.toBlob) canvas.toBlob(blob => { if (blob) { const url = URL.createObjectURL(blob); save(url, true); } else save(canvas.toDataURL('image/png'), false); }, 'image/png');
      else save(canvas.toDataURL('image/png'), false);
    } catch (error) {
      console.error('card download failed', error);
      toast('이미지를 만들지 못했습니다. 다른 브라우저에서 시도해 주세요.');
    }
  });

  // 11 — ASA secret: type a → s → a (outside forms), then show animated celebration
  const easter = $('#easterOverlay');
  const confettiField = $('#confettiField');
  let previousFocus = null;
  let keySequence = '';
  let lastKeyTime = 0;
  const symbols = ['✦', '✧', '◆', '✳', '•', '❋'];
  const colors = ['#ffe6a3', '#e8ba7e', '#f3d8ea', '#b5d5e9', '#f8f0ca'];
  function burstConfetti() {
    confettiField.replaceChildren();
    const count = reducedMotion ? 18 : 110;
    for (let i = 0; i < count; i++) {
      const part = document.createElement('span');
      part.className = 'confetti-piece';
      part.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      part.style.setProperty('--x', `${Math.random() * 100}%`);
      part.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
      part.style.setProperty('--size', `${8 + Math.random() * 19}px`);
      part.style.setProperty('--delay', `${Math.random() * 2.3}s`);
      part.style.setProperty('--duration', `${2.4 + Math.random() * 3}s`);
      part.style.setProperty('--drift', `${(Math.random() - .5) * 260}px`);
      part.style.setProperty('--rotation', `${(Math.random() - .5) * 1000}deg`);
      confettiField.appendChild(part);
    }
  }
  const openEaster = () => {
    if (easter.classList.contains('show')) return;
    previousFocus = document.activeElement;
    $('#toast').classList.remove('show');
    burstConfetti();
    easter.classList.add('show');
    easter.setAttribute('aria-hidden', 'false');
    body.classList.add('overlay-locked');
    mainContent.inert = true; header.inert = true;
    $('#easterClose').focus({ preventScroll: true });
  };
  const closeEaster = () => {
    if (!easter.classList.contains('show')) return;
    easter.classList.remove('show');
    easter.setAttribute('aria-hidden', 'true');
    if (!body.classList.contains('entry-active')) { body.classList.remove('overlay-locked'); mainContent.inert = false; header.inert = false; }
    previousFocus?.focus?.({ preventScroll: true });
    setTimeout(() => confettiField.replaceChildren(), 600);
  };
  $('#easterClose').addEventListener('click', closeEaster);
  $('#easterX').addEventListener('click', closeEaster);
  easter.addEventListener('click', event => { if (event.target === easter) closeEaster(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeEaster(); setMenu(false); return; }
    if (body.classList.contains('entry-active') || easter.classList.contains('show')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const target = event.target;
    if (target && (target.closest?.('input,textarea,select,[contenteditable="true"]') || target.isContentEditable)) return;
    if (!/^[a-z]$/i.test(event.key)) { keySequence = ''; return; }
    const now = Date.now();
    if (now - lastKeyTime > 2400) keySequence = '';
    lastKeyTime = now;
    keySequence = (keySequence + event.key.toLowerCase()).slice(-3);
    if (keySequence === 'asa') { keySequence = ''; openEaster(); }
  });
  $('#eggHint').addEventListener('click', () => toast('키보드에서 A → S → A 를 연속으로 눌러보세요 ✨'));
  // Prevent scrolling when a full-screen overlay is open (including mobile devices)
  const dynamicStyle = document.createElement('style');
  dynamicStyle.textContent = 'body.overlay-locked{overflow:hidden}.no-js .reveal{opacity:1;transform:none}';
  document.head.appendChild(dynamicStyle);
})();
