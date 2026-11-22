'use strict';
const menuButton = document.querySelector('.menu-toggle');
const pageToc = document.querySelector('.page-toc');
const sectionLinks = [...document.querySelectorAll('#section-nav a')];
const sections = sectionLinks.map(link => document.querySelector(link.hash));
const compactNavigation = window.matchMedia('(max-width: 1099px)');
function closeContents(restoreFocus = false) {
  pageToc.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(expanded));
  pageToc.classList.toggle('open', expanded);
});
sectionLinks.forEach(link => link.addEventListener('click', () => {
  closeContents(compactNavigation.matches);
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && pageToc.classList.contains('open')) {
    closeContents(true);
  }
});
document.addEventListener('click', event => {
  if (!pageToc.contains(event.target) && !menuButton.contains(event.target)) closeContents();
});
document.addEventListener('focusin', event => {
  if (!pageToc.contains(event.target) && !menuButton.contains(event.target)) closeContents();
});
compactNavigation.addEventListener('change', () => closeContents());
let contentsFrame = 0;
function updateCurrentSection() {
  contentsFrame = 0;
  const readingLine = document.querySelector('.site-header').getBoundingClientRect().bottom + 40;
  let current = sections[0];
  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= readingLine) current = section;
  });
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = sections.at(-1);
  sectionLinks.forEach(link => {
    if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function scheduleContentsUpdate() {
  if (!contentsFrame) contentsFrame = requestAnimationFrame(updateCurrentSection);
}
window.addEventListener('scroll', scheduleContentsUpdate, {passive: true});
window.addEventListener('resize', scheduleContentsUpdate);
window.addEventListener('hashchange', scheduleContentsUpdate);
if ('ResizeObserver' in window) new ResizeObserver(scheduleContentsUpdate).observe(document.querySelector('#main'));
updateCurrentSection();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function initDemoNavigation({trackId, previousId, nextId, positionId}) {
  const track = document.querySelector(`#${trackId}`);
  if (!track) return;
  const cards = [...track.querySelectorAll('.demo-card')];
  const previous = document.querySelector(`#${previousId}`);
  const next = document.querySelector(`#${nextId}`);
  const position = document.querySelector(`#${positionId}`);
  function step() {
    return cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
  }
  function update() {
    const max = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
    const index = Math.min(cards.length, Math.round(track.scrollLeft / step()) + 1);
    position.textContent = `${index} / ${cards.length}`;
  }
  function scrollTo(left) {
    track.scrollTo({left, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => scrollTo(track.scrollLeft - step()));
  next.addEventListener('click', () => scrollTo(track.scrollLeft + step()));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    const positions = {ArrowLeft: track.scrollLeft - step(), ArrowRight: track.scrollLeft + step(), Home: 0, End: track.scrollWidth};
    if (event.key in positions) { event.preventDefault(); scrollTo(positions[event.key]); }
  });
  track.addEventListener('scroll', update, {passive: true});
  window.addEventListener('resize', update);
  update();
}
initDemoNavigation({trackId: 'demo-track', previousId: 'demo-prev', nextId: 'demo-next', positionId: 'demo-position'});
initDemoNavigation({trackId: 'extra-demo-track', previousId: 'extra-demo-prev', nextId: 'extra-demo-next', positionId: 'extra-demo-position'});
const allVideos = [...document.querySelectorAll('video')];
allVideos.forEach(video => video.addEventListener('play', () => {
  allVideos.forEach(other => { if (other !== video) other.pause(); });
}));
const projectFilm = document.querySelector('.project-film-player');
const demoVideos = allVideos.filter(video => video !== projectFilm);

// Some static hosts ignore byte-range requests. Native video controls then
// report a successful seek before the decoder falls back to the old position.
// Probe the host on the first seek and fetch a local copy only when needed.
function installDemoSeekRecovery(video) {
  let pending = null;
  let verifyTimer = 0;
  let localCopy = null;
  let blobURL = null;
  let rangeSupport = null;
  let latestTarget = null;

  const sourceURL = () => {
    const source = video.currentSrc || video.querySelector('source')?.src;
    if (!source) throw Error('Video source is unavailable');
    const url = new URL(source, window.location.href);
    url.hash = '';
    return url;
  };

  const waitForMetadata = () => new Promise((resolve, reject) => {
    if (video.readyState >= 1) { resolve(); return; }
    const onMetadata = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(video.error || Error('Video metadata failed')); };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onMetadata, {once: true});
    video.addEventListener('error', onError, {once: true});
  });

  const loadLocalCopy = async target => {
    if (blobURL) return;
    if (!localCopy) localCopy = (async () => {
      const response = await fetch(sourceURL());
      if (!response.ok) throw Error(`Video download: HTTP ${response.status}`);
      blobURL = URL.createObjectURL(await response.blob());
      const wasPlaying = !video.paused;
      const playbackRate = video.playbackRate;
      video.pause();
      video.src = blobURL;
      video.load();
      await waitForMetadata();
      const desired = latestTarget ?? target;
      latestTarget = null;
      pending = null;
      video.currentTime = Math.min(desired, video.duration || desired);
      video.playbackRate = playbackRate;
      if (wasPlaying) await video.play();
    })();
    try {
      await localCopy;
    } catch (error) {
      localCopy = null;
      if (blobURL) URL.revokeObjectURL(blobURL);
      blobURL = null;
      throw error;
    }
  };

  const hasRangeSupport = async () => {
    if (rangeSupport !== null) return rangeSupport;
    const source = sourceURL();
    if (!/^https?:$/.test(source.protocol)) return true;
    rangeSupport = fetch(source, {method: 'HEAD', cache: 'no-store'})
      .then(response => response.headers.get('Accept-Ranges')?.toLowerCase().includes('bytes') ?? false)
      .catch(() => true);
    return rangeSupport;
  };

  const recoverUnsupportedRange = async target => {
    if (blobURL || await hasRangeSupport()) return;
    await loadLocalCopy(target);
  };

  const verifySeek = () => {
    verifyTimer = 0;
    if (pending === null || video.seeking) return;
    const target = pending;
    pending = null;
    if (Math.abs(video.currentTime - target) <= .35) return;
    loadLocalCopy(target).catch(error => console.warn('Demo video seek recovery failed:', error));
  };

  video.addEventListener('seeking', () => {
    pending = video.currentTime;
    latestTarget = pending;
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(verifySeek, 1200);
    recoverUnsupportedRange(pending).catch(error => console.warn('Demo video seek recovery failed:', error));
  });
  video.addEventListener('seeked', () => {
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(verifySeek, 0);
  });
}
demoVideos.forEach(installDemoSeekRecovery);
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting && !entry.target.paused && !entry.target.seeking && !document.fullscreenElement) entry.target.pause();
  });
}, {threshold: 0}) : null;
if (observer) demoVideos.forEach(v => observer.observe(v));
if (projectFilm) {
  const shell = projectFilm.closest('.film-shell');
  const bar = shell.querySelector('.film-controls');
  const seek = bar.querySelector('input');
  const stamp = bar.querySelector('time');
  const ending = shell.querySelector('.film-ending');
  const command = name => bar.querySelector(`[data-command="${name}"]`);
  let scrubbing = false, pending = null, resume = false, verifyTimer;
  let localCopy = null, blobURL = null;
  const clock = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  const refresh = () => {
    if (!Number.isFinite(projectFilm.duration)) return;
    seek.max = projectFilm.duration;
    if (!scrubbing && pending === null) seek.value = projectFilm.currentTime;
    stamp.textContent = clock(seek.valueAsNumber);
    seek.setAttribute('aria-valuetext', `${stamp.textContent} / ${clock(projectFilm.duration)}`);
    ending.hidden = !projectFilm.ended;
    const name = projectFilm.ended ? 'Replay' : projectFilm.paused ? 'Play' : 'Pause';
    command('play').textContent = {Replay:'↺', Play:'▶', Pause:'Ⅱ'}[name];
    command('play').setAttribute('aria-label', name);
    command('play').title = name;
    command('sound').setAttribute('aria-label', projectFilm.muted ? 'Unmute' : 'Mute');
    command('sound').title = projectFilm.muted ? 'Unmute' : 'Mute';
    command('sound').style.opacity = projectFilm.muted ? '.55' : '1';
  };
  const toggle = () => {
    if (projectFilm.ended) projectFilm.currentTime = 0;
    if (projectFilm.paused) projectFilm.play().catch(console.warn);
    else projectFilm.pause();
  };
  command('play').onclick = toggle;
  projectFilm.onclick = toggle;
  command('sound').onclick = () => { projectFilm.muted = !projectFilm.muted; };
  if (shell.requestFullscreen) command('fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen();
  else if (projectFilm.webkitEnterFullscreen) command('fullscreen').onclick = () => projectFilm.webkitEnterFullscreen();
  else command('fullscreen').hidden = true;
  const finishSeek = () => {
    if (pending === null || scrubbing || projectFilm.seeking || Math.abs(projectFilm.currentTime - pending) > .25) return;
    clearTimeout(verifyTimer);
    pending = null;
    if (resume && !projectFilm.ended) projectFilm.play().catch(console.warn);
    refresh();
  };
  // A static host may serve the whole file with HTTP 200 even for byte-range
  // requests. Decode the same file locally if the requested position won't stick.
  const ensureLocalCopy = async () => {
    const url = new URL(projectFilm.currentSrc);
    if (!/^https?:$/.test(url.protocol) || blobURL) return;
    if (!localCopy) localCopy = (async () => {
      url.hash = '';
      const response = await fetch(url);
      if (!response.ok) throw Error(`Film download: HTTP ${response.status}`);
      const bytes = await response.blob();
      blobURL = URL.createObjectURL(new Blob([bytes], {type:url.pathname.endsWith('.webm') ? 'video/webm' : 'video/mp4'}));
      projectFilm.addEventListener('loadedmetadata', () => {
        if (pending !== null && !scrubbing) applySeek();
      }, {once:true});
      projectFilm.src = blobURL;
    })();
    await localCopy;
  };
  const applySeek = () => {
    clearTimeout(verifyTimer);
    if (pending === null || projectFilm.readyState < 1) return;
    projectFilm.currentTime = pending;
    finishSeek();
    if (pending !== null) verifyTimer = setTimeout(() => {
      finishSeek();
      if (pending !== null && !scrubbing) ensureLocalCopy().catch(error => {
        localCopy = null; pending = null; refresh(); console.warn(error);
      });
    }, 1500);
  };
  projectFilm.addEventListener('seeked', finishSeek);
  const beginDrag = () => {
    if (scrubbing) return;
    if (pending === null) resume = !projectFilm.paused;
    scrubbing = true;
    clearTimeout(verifyTimer);
    projectFilm.pause();
  };
  const commit = () => {
    if (!scrubbing) return;
    pending = seek.valueAsNumber;
    scrubbing = false;
    applySeek();
  };
  seek.onpointerdown = event => { beginDrag(); seek.setPointerCapture(event.pointerId); };
  seek.oninput = () => { beginDrag(); ending.hidden = true; stamp.textContent = clock(seek.valueAsNumber); };
  seek.onchange = commit;
  seek.onlostpointercapture = commit;
  seek.onpointerup = commit;
  for (const name of ['loadedmetadata','durationchange','timeupdate','ended','play','pause','seeked','volumechange']) projectFilm.addEventListener(name, refresh);
  refresh();
  bar.hidden = false;
  projectFilm.controls = false;
  // Both source URLs specify the Overview start via #t=4. Calling play() also
  // starts loading on devices that defer media events until playback is requested.
  let needsPlayback = true, firstStart = true;
  const onVisibility = visible => {
    if (!visible) {
      if (!projectFilm.paused && !document.fullscreenElement) {
        needsPlayback = true;
        projectFilm.pause();
      }
      return;
    }
    if (!needsPlayback || projectFilm.ended) return;
    needsPlayback = false;
    if (firstStart) {
      firstStart = false;
      resume = true;
      pending = 4;
      if (projectFilm.readyState >= 1) {
        applySeek();
        projectFilm.play().catch(console.warn);
      }
      else projectFilm.addEventListener('loadedmetadata', () => {
        if (pending !== null && !scrubbing) {
          applySeek();
          projectFilm.play().catch(console.warn);
        }
      }, {once:true});
      return;
    }
    projectFilm.play().catch(error => {
      if (error.name === 'AbortError' || error.name === 'NotAllowedError') return;
      console.warn('Project film playback failed:', error);
    });
  };
  if (observer) new IntersectionObserver(([entry]) => onVisibility(entry.isIntersecting)).observe(projectFilm);
  else onVisibility(true);
}
const results = {
  pretraining: {title: 'Pretraining performance', metric: 'Mean simulation success rate (%)', description: 'Each model checkpoint is evaluated over 21,430 episodes in total across six simulation settings spanning three simulators. The curve reports the unweighted mean of the six setting-specific success rates.', image: 'assets/figures/pretraining-curve.svg?v=holobrain-0.5', alt: 'Figure 11: mean simulation success rate over training steps from 50k to 300k. Final scores: HoloBrain-0.5-Continuous, 49.71%; HoloBrain-0.5-Discrete, 56.77%; HoloBrain-0.5-Continuous (D-Init.), 56.65%.', note: 'Figure 11 from the technical report. D-Init. denotes the continuous model initialized from the discrete model.'},
  fewshot: {title: 'Few-shot post-training', description: 'Seven real-robot tasks, with 200 demonstration trajectories per task. Values are the averages reported in Table 2.', rows: [['π₀',68.08],['π₀.₅',86.25],['HoloBrain-0',85.32],['HoloBrain-0.5-Continuous',94.52],['HoloBrain-0.5-Discrete',69.74],['HoloBrain-0.5-Continuous (D-Init.)',90.53]], note: 'The discrete model’s average decreases from 87.76% before fine-tuning to 69.74% afterward. The current discrete model is not well suited to few-shot post-training; this degradation is a subject for future study.'},
  multitask: {title: 'Multi-task post-training', description: 'Approximately 300 hours of post-training data from Piper and Piper-X, spanning 38 training tasks. Evaluation covers 11 tasks. Table 3.', rows: [['π₀',62.60],['π₀.₅',69.41],['H-0.5-Cont. (D-Init.)',79.07]], note: 'The continuous model has the highest mean score in this setting, while the strongest model varies by task. The full report includes all task-level results.'},
  crossEmbodiment: {title: 'Zero-shot cross-embodiment transfer', description: 'Zero-shot transfer of five tasks from Piper to Piper-X. The evaluated task–embodiment combinations are absent from pretraining and post-training data.', rows: [['π₀',27.64],['π₀.₅',17.44],['H-0.5-Cont. (D-Init.)',63.28]], note: 'Piper-X is a seen embodiment through other tasks. This setting tests transfer to unseen task–embodiment combinations without demonstrations of the evaluated tasks on Piper-X.'},
  morphologyAdaptation: {title: 'Adaptation to different robot morphologies', description: 'Each robot has its own task set. Within each experiment, both models were trained on the same demonstrations and evaluated on the same tasks.', groups: [
    {caption: 'Franka Panda · 5 tabletop tasks', rows: [['π₀.₅',85.00],['H-0.5-Cont. (D-Init.)',89.20]]},
    {caption: 'Mobile dual-arm · 3 tasks', rows: [['π₀.₅',73.83],['H-0.5-Cont. (D-Init.)',92.94]]},
    {caption: 'Unitree G1 · 3 humanoid tasks', rows: [['π₀.₅',11.00],['H-0.5-Cont. (D-Init.)',70.24]]}
  ], note: 'On the mobile dual-arm robot, HoloBrain scored 97.62% on pressing an elevator button, 89.69% on placing a basket, and 91.50% on hanging a garment. The π₀.₅ baseline scored 80.00%, 62.50%, and 79.00%, respectively.'}
};
function selectResult(button) {
  const result = results[button.dataset.result];
  document.querySelectorAll('[data-result]').forEach(b => {
    b.setAttribute('aria-selected', String(b === button)); b.tabIndex = b === button ? 0 : -1;
  });
  document.querySelector('#result-panel').setAttribute('aria-labelledby', button.id);
  document.querySelector('#result-title').textContent = result.title;
  document.querySelector('#result-metric').textContent = result.metric || 'Average progress score (%)';
  document.querySelector('#result-description').textContent = result.description;
  document.querySelector('#result-note').textContent = result.note;
  const scale = document.querySelector('#result-panel > .chart-scale');
  scale.hidden = Boolean(result.image || result.groups);
  const chart = document.querySelector('#result-chart'); chart.replaceChildren();
  if (result.image) {
    const link = document.createElement('a'); link.className = 'curve-link'; link.href = result.image; link.target = '_blank'; link.rel = 'noopener';
    const image = document.createElement('img'); image.className = 'pretraining-curve'; image.src = result.image; image.alt = result.alt; image.width = 1040; image.height = 498;
    const caption = document.createElement('span'); caption.className = 'curve-caption'; caption.textContent = 'Open full-size figure ↗';
    link.append(image, caption); chart.append(link);
    return;
  }
  if (result.groups) {
    const groups = document.createElement('div'); groups.className = 'score-groups';
    for (const group of result.groups) {
      const figure = document.createElement('figure');
      const caption = document.createElement('figcaption'); caption.textContent = group.caption;
      figure.append(caption); appendScoreRows(figure, group.rows);
      const axis = scale.cloneNode(true); axis.hidden = false; figure.append(axis);
      groups.append(figure);
    }
    chart.append(groups);
  } else {
    appendScoreRows(chart, result.rows);
  }
}
function appendScoreRows(chart, rows) {
  rows.forEach(([name, value]) => {
    const row = document.createElement('div'); row.className = 'score-row';
    const label = document.createElement('span'); label.className = 'score-name'; label.textContent = name;
    const track = document.createElement('div'); track.className = 'bar-track'; track.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('span'); bar.className = 'score-bar' + (name.startsWith('HoloBrain') || name.startsWith('H-0.5-') ? ' ours' : '');
    const score = document.createElement('span'); score.className = 'score-value';
    if (typeof value === 'number') { bar.style.width = value + '%'; score.textContent = value.toFixed(2); }
    else { score.textContent = value; }
    if (typeof value === 'number') track.append(bar);
    row.append(label, track, score); chart.append(row);
  });
}
const tabs = [...document.querySelectorAll('[data-result]')];
tabs.forEach((button, index) => {
  button.addEventListener('click', () => selectResult(button));
  button.addEventListener('keydown', e => {
    let target;
    if (e.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
    if (e.key === 'ArrowLeft') target = tabs[(index + tabs.length - 1) % tabs.length];
    if (e.key === 'Home') target = tabs[0];
    if (e.key === 'End') target = tabs[tabs.length - 1];
    if (target) { e.preventDefault(); target.focus(); selectResult(target); }
  });
});
document.querySelector('#copy-citation').addEventListener('click', async () => {
  const text = document.querySelector('#bibtex').textContent;
  let copied = false;
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(text); copied = true; } } catch (_) {}
  if (!copied) {
    const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.left = '-9999px';
    document.body.append(field); field.select(); copied = document.execCommand('copy'); field.remove();
  }
  document.querySelector('#copy-status').textContent = copied ? 'Citation copied.' : 'Select the citation text to copy it.';
  document.querySelector('#copy-citation').focus();
});
