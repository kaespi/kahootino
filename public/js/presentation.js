const appP = document.getElementById('presentation-app');
const codeP = appP.dataset.code;

const qTitle = document.getElementById('p-title');
const qText = document.getElementById('p-question');
const qImage = document.getElementById('p-image');
const qVideo = document.getElementById('p-video');
const qAnswers = document.getElementById('p-answers');
const sTitle = document.getElementById('p-standings-title');
const sList = document.getElementById('p-standings');
const participantsOverlay = document.getElementById('participants-overlay');
const pImageContainer = document.querySelector('.p-image-container');

/** Returns true if the given file path is an MP4 video. */
function isVideo(src) {
  return /\.mp4$/i.test(src);
}

/**
 * Show an image or video in the presentation media slot.
 * Pass null/undefined to hide all media.
 */
function showMedia(src) {
  if (!src) {
    qImage.classList.add('hidden');
    qVideo.classList.add('hidden');
    qVideo.pause();
    qVideo.removeAttribute('src');
    return;
  }
  if (isVideo(src)) {
    qImage.classList.add('hidden');
    qVideo.classList.remove('hidden');
    qVideo.muted = true;
    qVideo.src = src;
    qVideo.load();
    qVideo.play().then(() => { qVideo.muted = false; }).catch(() => {});
  } else {
    qVideo.pause();
    qVideo.classList.add('hidden');
    qVideo.removeAttribute('src');
    qImage.src = src;
    qImage.classList.remove('hidden');
  }
}

// One-time activation overlay: clicking it gives the page user-gesture activation so
// Firefox allows unmuted audio on subsequent play() calls.
const activationOverlay = document.getElementById('activation-overlay');
if (activationOverlay) {
  activationOverlay.addEventListener('click', () => {
    activationOverlay.classList.add('hidden');
    // Unmute any video that is already playing
    if (qVideo && !qVideo.classList.contains('hidden') && qVideo.src) {
      qVideo.muted = false;
    }
  }, { once: true });
}

// map of nickname -> { left, top, rot, scale }
const participantsMap = {};
const participantsOrder = []; // preserve insertion order

function startSSEP() {
  const url = '../api/state_sse.php?code=' + encodeURIComponent(codeP);
  const evt = new EventSource(url);

  evt.onmessage = (event) => {
    const data = JSON.parse(event.data);
    renderPresentation(data);
  };

  evt.onerror = () => {
    console.log('SSE presentation connection lost, browser will retry.');
  };
}

function startAbly() {
  const ablyKey = appP.dataset.ablyKey;
  const client = new Ably.Realtime(ablyKey);
  const channel = client.channels.get('quiz-' + codeP);

  // --- Ably connection diagnostics ---
  client.connection.on(function(stateChange) {
    console.log('[LAG] Ably connection: ' + stateChange.previous + ' → ' + stateChange.current +
      (stateChange.reason ? ' (' + stateChange.reason.message + ')' : ''));
  });
  // --- end diagnostics ---

  channel.subscribe('state', (msg) => {
    const data = msg.data;
    renderPresentation(data);
  });
  // subscribe to join notifications
  channel.subscribe('join', (msg) => {
    try {
      handleJoin(msg.data);
    } catch (err) {
      console.error('Failed to handle presentation join message', err);
    }
  });
  // subscribe to host-triggered video replay command
  channel.subscribe('control', (msg) => {
    const action = msg.data && msg.data.action;
    if (!qVideo || qVideo.classList.contains('hidden')) return;
    if (action === 'replay') {
      qVideo.currentTime = 0;
      qVideo.play().catch(() => {});
    }
  });
}

function renderPresentation(data) {
  // --- Lag diagnostics ---
  const receiveTime = Date.now();
  if (data.publishedAt) {
    const publishMs = new Date(data.publishedAt).getTime();
    const latencyMs = receiveTime - publishMs;
    console.log('[LAG] Ably delivery latency: ' + latencyMs + 'ms (phase=' + data.phase + ')');
  }
  if (data.serverTime) {
    const serverMs = new Date(data.serverTime).getTime();
    const driftMs = receiveTime - serverMs;
    console.log('[LAG] Clock drift (client − server): ' + driftMs + 'ms');
  }
  console.log('[LAG] Presentation update: phase=' + data.phase);
  // --- end diagnostics ---

  // Show participants only during waiting phase
  if (data.phase === 'waiting') {
    showParticipantsOverlay(true);
    const title = data.quizTitle || window.KAHOOTINO_TITLE || 'Kahootino Quiz';
    qTitle.textContent = title;
    qText.textContent = '';
    qAnswers.innerHTML = '';
    sTitle.classList.add('hidden');
    sList.innerHTML = '';
    showMedia(null);
    return;
  }

  // Hide participants overlay for non-waiting phases
  if (data.phase !== 'waiting') {
    showParticipantsOverlay(false);
  }

  // Handle intro phase
  if (data.phase === 'intro') {
    qTitle.textContent = '';
    qText.textContent = '';
    qAnswers.innerHTML = '';
    sTitle.classList.add('hidden');
    sList.innerHTML = '';

    if (data.currentIntroImage) {
      showMedia('../' + data.currentIntroImage);
    } else {
      showMedia(null);
    }

    // Adjust media sizing for intro phase
    try {
      requestAnimationFrame(() => {
        if (!pImageContainer) return;
        pImageContainer.style.maxHeight = '';
        qImage.style.maxHeight = '';
        qVideo.style.maxHeight = '';
      });
    } catch (err) {
      console.error('Failed to adjust presentation image sizing', err);
    }
    return;
  }

  if (data.question && data.phase !== 'standings' && data.phase !== 'finished') {
    qText.textContent = data.question.text;

    // Decide which image to show in the top slot. If answer images exist
    // and we're in the answer/reveal phase, prefer an answer image so it
    // appears above the answers. Otherwise show the question image.
    const hasQuestionImages = data.question.images && data.question.images.length > 0;
    const hasAnswerImages = data.question.answerImages && data.question.answerImages.length > 0;

    if (hasAnswerImages && data.phase === 'reveal') {
      const ai = data.answerImageIndex || 0;
      const answerImageToShow = data.question.answerImages[ai] || data.question.answerImages[0];
      showMedia('../' + answerImageToShow);
    } else if (hasQuestionImages) {
      const qi = data.questionImageIndex || 0;
      const questionImageToShow = data.question.images[qi] || data.question.images[0];
      showMedia('../' + questionImageToShow);
    } else {
      showMedia(null);
    }

    qAnswers.innerHTML = '';

    // Only render answers if questionEndTime is set (answers are revealed)
    if (data.questionEndTime) {
      data.question.answers.forEach((a, idx) => {
        const li = document.createElement('li');
        li.textContent = a;

        // Mark correct answer in 'reveal' phase
        if ((data.phase === 'reveal') && data.question.correctIndex === idx) {
            li.style.color = 'yellow';
            li.style.fontWeight = 'bold';
            li.style.fontSize = '2.5rem';
        }

        if (data.phase === 'reveal') {
                if (data.question.correctIndex === idx) {
                li.style.color = 'yellow';
                li.style.fontWeight = 'bold';
            } else {
                li.classList.add('hidden');
            }
        }

        qAnswers.appendChild(li);
      });

      // Note: answer images are shown in the top `qImage` slot when available
      // during the answers/reveal phases. No need to append them again below.
    }

    // Adjust media sizing so answers fit vertically in the viewport
    try {
      // small delay to ensure DOM rendered sizes are available
      requestAnimationFrame(() => {
        if (!pImageContainer) return;
        if (data.phase === 'answers' || data.phase === 'reveal') {
          const headerHeight = (qTitle.offsetHeight || 0) + (qText.offsetHeight || 0) + 24; // padding
          const answersHeight = qAnswers.scrollHeight || 0;
          const standingsHeight = (sTitle.offsetHeight || 0) + (sList.scrollHeight || 0);
          const reserved = headerHeight + answersHeight + standingsHeight + 48; // extra padding
          const maxImagePx = Math.max(0, window.innerHeight - reserved);
          // leave at least 20vh for image if calculation fails
          const minPx = window.innerHeight * 0.2;
          pImageContainer.style.maxHeight = Math.max(minPx, maxImagePx) + 'px';
          // ensure the media element doesn't exceed the container
          qImage.style.maxHeight = '100%';
          qVideo.style.maxHeight = '100%';
        } else {
          pImageContainer.style.maxHeight = '';
          qImage.style.maxHeight = '';
          qVideo.style.maxHeight = '';
        }
      });
    } catch (err) {
      console.error('Failed to adjust presentation image sizing', err);
    }

    // Update title with image progress indicator
    qTitle.textContent = `Frage ${data.questionIndex + 1}`;
  } else {
    qText.textContent = '';
    qAnswers.innerHTML = '';
    showMedia(null);
  }

  if (data.phase === 'standings' || data.phase === 'finished') {
    qTitle.textContent = '';
    sTitle.classList.remove('hidden');
    sList.innerHTML = '';
    // Only show top 10 on the presentation screen
    const tops = (data.standings || []).slice(0, 10);
    tops.forEach((p, idx) => {
      const li = document.createElement('li');
      li.textContent = `${idx + 1}. ${p.nickname} – ${p.score} Punkte`;
      sList.appendChild(li);
    });
    // Ensure the top media is hidden when showing standings
    try {
      showMedia(null);
      if (pImageContainer) pImageContainer.style.maxHeight = '';
      qImage.style.maxHeight = '';
      qVideo.style.maxHeight = '';
    } catch (err) {
      // ignore
    }
  } else {
    sTitle.classList.add('hidden');
    sList.innerHTML = '';
  }
}

startAbly();

// Keep Image objects alive in a persistent array so the browser retains them in memory cache
const _preloadedImages = (window.KAHOOTINO_IMAGES || []).map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

// Preload videos by creating hidden <video preload="auto"> elements kept alive in memory.
// This ensures the browser fetches and buffers video content before it is needed.
const _preloadedVideos = (window.KAHOOTINO_VIDEOS || []).map(src => {
  const vid = document.createElement('video');
  vid.preload = 'auto';
  vid.muted = true;
  vid.src = src;
  vid.style.display = 'none';
  document.body.appendChild(vid);
  return vid;
});

// Fetch current players on load and render them (preserve positions)
async function fetchPlayers() {
  try {
    const res = await fetch('../api/players.php?code=' + encodeURIComponent(codeP));
    const data = await res.json();
    if (!res.ok || data.error) return;
    const list = (data.players || []).map(p => p.nickname);
    list.forEach(nick => ensureParticipant(nick));
    renderParticipants();
  } catch (err) {
    console.error('Error fetching players for presentation:', err);
  }
}

function handleJoin(data) {
  if (!data || !data.nickname) return;
  ensureParticipant(data.nickname);
  renderParticipants();
}

function ensureParticipant(nick) {
  if (!nick) return;
  if (participantsMap[nick]) return;
  // Assign a stable random position and style properties on first sight
  const left = Math.random() * 90 + 5; // 5% - 95%
  const top = Math.random() * 80 + 10; // 10% - 90% (avoid very top)
  const rot = (Math.random() * 20) - 10;
  const scale = 0.95 + Math.random() * 0.25;
  participantsMap[nick] = { left, top, rot, scale };
  participantsOrder.push(nick);
  // limit total stored participants to avoid memory growth
  const maxStored = 1000;
  if (participantsOrder.length > maxStored) {
    const removed = participantsOrder.shift();
    delete participantsMap[removed];
  }
}

function renderParticipants() {
  if (!participantsOverlay) return;
  const max = 200;
  participantsOverlay.innerHTML = '';
  // render in insertion order, but cap to last `max` entries
  const toRender = participantsOrder.slice(-max);
  toRender.forEach(nick => {
    const props = participantsMap[nick];
    if (!props) return;
    const el = document.createElement('div');
    el.className = 'participant-badge';
    el.textContent = nick;
    el.style.left = props.left + '%';
    el.style.top = props.top + '%';
    el.style.transform = `translate(-50%, -50%) rotate(${props.rot}deg) scale(${props.scale})`;
    participantsOverlay.appendChild(el);
  });
}

function showParticipantsOverlay(show) {
  if (!participantsOverlay) return;
  participantsOverlay.style.display = show ? 'block' : 'none';
  if (show) {
    // ensure participants are rendered
    if (participantsOrder.length === 0) {
      fetchPlayers();
    } else {
      renderParticipants();
    }
  }
}

// Initialize participants on load
fetchPlayers();
