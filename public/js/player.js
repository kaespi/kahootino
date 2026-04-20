const app = document.getElementById('app');
const code = app.dataset.code;

const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const rejoinedScreen = document.getElementById('rejoined-screen');
const questionScreen = document.getElementById('question-screen');
const standingsScreen = document.getElementById('standings-screen');

const nicknameInput = document.getElementById('nickname');
const joinBtn = document.getElementById('join-btn');
const joinError = document.getElementById('join-error');
const playerName = document.getElementById('player-name');

// Check for reset parameter
const params = new URLSearchParams(window.location.search);
if (params.get('reset') === '1') {
  localStorage.removeItem('quiz_nickname');
  localStorage.removeItem('quiz_player_token');
  localStorage.removeItem('quiz_code');
}

const questionText = document.getElementById('question-text');
const questionImage = document.getElementById('question-image');
const answersDiv = document.getElementById('answers');
const countdownContainer = document.getElementById('countdown-container');
const countdownBar = document.getElementById('countdown-bar');
const answerStatus = document.getElementById('answer-status');
const standingsList = document.getElementById('standings-list');

let token = getCookie('quiz_player_token') || null;
let currentQuestionIndex = -1;
let hasAnswered = false;
let countdownInterval = null;
let questionEndTime = null;
let totalQuestionTime = 0;
let lastRenderedQuestionIndex = -1;
// store selected answer per question index so selection survives phase updates
let selectedByQuestion = {};
let wakeLock = null;
let quizFinished = false;

function getCookie(name) {
  const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return m ? m.pop() : '';
}

function show(screen) {
  [joinScreen, waitingScreen, rejoinedScreen, questionScreen, standingsScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (err) {
      console.warn('Wake lock request failed:', err.message);
    }
  }
}

async function releaseWakeLock() {
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
    } catch (err) {
      console.warn('Wake lock release failed:', err.message);
    }
    wakeLock = null;
  }
}

// When the page becomes visible again (e.g. after screen off), re-acquire the wake
// lock and re-sync state in case any Ably messages were missed while hidden.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (wakeLock === null && !quizFinished && token) {
      requestWakeLock();
    }
    if (token) {
      fetchInitialState();
    }
  }
});

async function joinQuiz() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    joinError.textContent = 'Bitte Nickname eingeben.';
    return;
  }
  joinError.textContent = '';
  // Disable button to prevent double submits and show progress
  const prevBtnText = joinBtn.textContent;
  joinBtn.disabled = true;
  joinBtn.textContent = 'Beitreten...';

  let res;
  try {
    const fetchStart = Date.now();
    res = await fetch('../api/join.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({code, nickname})
    });
    console.log('[LAG] join.php fetch took ' + (Date.now() - fetchStart) + 'ms, status=' + res.status);
  } catch (err) {
    joinError.textContent = 'Beitritt fehlgeschlagen';
    joinBtn.disabled = false;
    joinBtn.textContent = prevBtnText;
    return;
  }

  const data = await res.json();
  if (!res.ok || data.error) {
    joinError.textContent = data.error || 'Beitritt fehlgeschlagen';
    joinBtn.disabled = false;
    joinBtn.textContent = prevBtnText;
    return;
  }
  token = data.token;
  // Store nickname and token in localStorage for persistence
  localStorage.setItem('quiz_nickname', nickname);
  localStorage.setItem('quiz_player_token', token);
  localStorage.setItem('quiz_code', code);
  playerName.textContent = nickname;
  requestWakeLock();
  await fetchInitialState();
  startAbly();
}

async function loadMe() {
  if (!token) return false;
  const fetchStart = Date.now();
  const res = await fetch('../api/me.php?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token), {
    headers: {'X-Quiz-Token': token}
  });
  const data = await res.json();
  console.log('[LAG] me.php fetch took ' + (Date.now() - fetchStart) + 'ms, status=' + res.status);
  if (!res.ok || data.error) {
    return false;
  }
  playerName.textContent = data.nickname;
  return true;
}

function startSSE() {
  const url = '../api/state_sse.php?code=' + encodeURIComponent(code);
  const evt = new EventSource(url);

  evt.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleStateUpdate(data);
  };

  evt.onerror = () => {
    console.log('SSE connection lost, browser will retry automatically.');
  };
}

function startAbly() {
  const ablyKey = app.dataset.ablyKey;
  const client = new Ably.Realtime(ablyKey);
  const channel = client.channels.get('quiz-' + code);

  // --- Ably connection diagnostics ---
  client.connection.on(function(stateChange) {
    console.log('[LAG] Ably connection: ' + stateChange.previous + ' → ' + stateChange.current +
      (stateChange.reason ? ' (' + stateChange.reason.message + ')' : ''));
  });
  // --- end diagnostics ---

  channel.subscribe('state', (msg) => {
    const data = msg.data;
    handleStateUpdate(data);
  });
}

async function fetchInitialState() {
  try {
    const headers = token ? {'X-Quiz-Token': token} : {};
    const res = await fetch('../api/state.php?code=' + encodeURIComponent(code), {headers});
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('Failed to fetch initial player state:', data.error || res.status);
      show(waitingScreen);
      return false;
    }
    handleStateUpdate(data);
    return true;
  } catch (err) {
    console.error('Error fetching initial player state:', err);
    show(waitingScreen);
    return false;
  }
}

async function handleStateUpdate(data) {
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
  console.log('[LAG] State update received: phase=' + data.phase + ', questionIndex=' + data.questionIndex);
  // --- end diagnostics ---

  currentQuestionIndex = data.questionIndex;
  hasAnswered = data.hasAnswered;
  questionEndTime = data.questionEndTime ? new Date(data.questionEndTime) : null;

  // Restore the previously selected answer from the server (survives page reload)
  if (data.selectedAnswerIndex != null) {
    selectedByQuestion[data.questionIndex] = data.selectedAnswerIndex;
  }

  if (data.phase === 'waiting' || data.phase === 'intro') {
    show(waitingScreen);
    stopCountdown();
  } else if (data.phase === 'question') {
    renderQuestion(data.question, data.serverTime, data.questionEndTime, data.phase, data.questionImageIndex, data.answerImageIndex, data.showImagesToPlayers);
    show(questionScreen);
    stopCountdown();
  } else if (data.phase === 'answers') {
    lastRenderedQuestionIndex = -1;
    renderQuestion(data.question, data.serverTime, data.questionEndTime, data.phase, data.questionImageIndex, data.answerImageIndex, data.showImagesToPlayers);
    show(questionScreen);
  } else if (data.phase === 'reveal') {
    renderQuestion(data.question, data.serverTime, data.questionEndTime, data.phase, data.questionImageIndex, data.answerImageIndex, data.showImagesToPlayers);
    show(questionScreen);
    stopCountdown();
  } else if (data.phase === 'standings' || data.phase === 'finished') {
    show(standingsScreen);
    stopCountdown();
    if (data.phase === 'finished') {
      quizFinished = true;
      await releaseWakeLock();
    }
    if (data.standings && data.standings.length > 0) {
      renderStandings(data.standings);
    } else {
      // Standings missing from push message – clear stale data and fetch from server
      standingsList.innerHTML = '';
      fetchInitialState();
    }
  }
}

function renderQuestion(q, serverTime, endTime, phase, questionImageIndex = 0, answerImageIndex = 0, showImagesToPlayers = true) {
  if (!q) return;
  questionText.textContent = q.text;

  // Show question image only during 'question' phase and if showImagesToPlayers is true
  if (phase === 'question' && q.images && q.images.length > 0 && showImagesToPlayers) {
    const imageToShow = q.images[questionImageIndex] || q.images[0];
    questionImage.src = '../' + imageToShow;
    questionImage.classList.remove('hidden');
    // ensure visible even if inline styles existed
    questionImage.style.display = '';
  } else {
    // explicitly hide the question image to avoid leftover visibility
    questionImage.classList.add('hidden');
    questionImage.style.display = 'none';
  }

  // Show answer image only during 'reveal' phase if showImagesToPlayers is true
  let answerImageToShow = null;
  if (q.answerImages && q.answerImages.length > 0 && showImagesToPlayers && phase === 'reveal') {
    answerImageToShow = q.answerImages[answerImageIndex] || q.answerImages[0];
  }

  answersDiv.innerHTML = '';

  // Only render answer buttons if endTime is set (answers should be visible)
  if (endTime) {
    // If we're in the reveal phase and an answer image exists, place it above the answers
    if (answerImageToShow && phase === 'reveal') {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'answer-image';
      imgContainer.style.marginBottom = '0.75rem';
      const img = document.createElement('img');
      img.src = '../' + answerImageToShow;
      img.alt = '';
      imgContainer.appendChild(img);
      answersDiv.appendChild(imgContainer);
    }

    q.answers.forEach((ans, idx) => {
      const btn = document.createElement('button');
      btn.textContent = ans;
      btn.className = 'answer-button';
      btn.dataset.index = idx;
      btn.disabled = hasAnswered || phase === 'reveal';

      // restore selected state for this question if present
      if (selectedByQuestion[currentQuestionIndex] === idx) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        if (hasAnswered || phase === 'reveal') return;
        // mark selection immediately in the UI
        Array.from(answersDiv.querySelectorAll('button')).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedByQuestion[currentQuestionIndex] = idx;
        submitAnswer(idx);
      });

      // mark correct/wrong in reveal phase
      if (phase === 'reveal') {
        if (idx === q.correctIndex) {
          btn.classList.add('correct');
        }
        if (selectedByQuestion[currentQuestionIndex] != null && selectedByQuestion[currentQuestionIndex] === idx && idx !== q.correctIndex) {
          btn.classList.add('wrong');
        }
      }

      answersDiv.appendChild(btn);
    });
  }

  answerStatus.textContent = hasAnswered ? 'Antwort abgegeben.' : '';

  if (serverTime && endTime && currentQuestionIndex !== lastRenderedQuestionIndex) {
    lastRenderedQuestionIndex = currentQuestionIndex;
    const serverNow = new Date(serverTime);
    const end = new Date(endTime);
    let remaining = Math.max(0, Math.floor((end - serverNow) / 1000));
    // --- Countdown drift diagnostics ---
    const clientNow = new Date();
    const clientRemaining = Math.max(0, Math.floor((end - clientNow) / 1000));
    const driftSec = remaining - clientRemaining;
    console.log('[LAG] Countdown: server says ' + remaining + 's remaining, client clock says ' + clientRemaining + 's (drift=' + driftSec + 's)');
    // --- end diagnostics ---
    startCountdown(remaining, q.countdownSeconds);
  }
}

async function submitAnswer(idx) {
  if (hasAnswered) return;
  const fetchStart = Date.now();
  const res = await fetch('../api/answer.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      code,
      token,
      questionIndex: currentQuestionIndex,
      chosenOption: idx
    })
  });
  const data = await res.json();
  const fetchDuration = Date.now() - fetchStart;
  console.log('[LAG] answer.php fetch took ' + fetchDuration + 'ms, status=' + res.status + (data.duration_ms ? ', server processing=' + data.duration_ms + 'ms' : ''));
  if (!res.ok || data.error) {
    answerStatus.textContent = data.error || 'Antwort konnte nicht gesendet werden.';
    return;
  }
  hasAnswered = true;
  Array.from(answersDiv.querySelectorAll('button')).forEach(b => b.disabled = true);
}

function renderStandings(list) {
  standingsList.innerHTML = '';

  if (!list || list.length === 0) return;

  const total = list.length;
  const topCount = Math.min(3, total);

  // Compute competition-style ranks: equal scores share the same rank,
  // next rank equals the (1-based) index of the next player (i+1)
  const ranks = new Array(total);
  for (let i = 0; i < total; i++) {
    if (i > 0 && list[i].score === list[i - 1].score) {
      ranks[i] = ranks[i - 1];
    } else {
      ranks[i] = i + 1;
    }
  }

  // Determine current player's nickname (from DOM or localStorage)
  const myNick = (playerName && playerName.textContent) || localStorage.getItem('quiz_nickname') || null;
  const myIdx = myNick ? list.findIndex(p => p.nickname === myNick) : -1;

  // Build set of indices to display: always top 3, plus personal slice if available
  const idxSet = new Set();
  for (let i = 0; i < topCount; i++) idxSet.add(i);

  if (myIdx !== -1) {
    const pStart = Math.max(0, myIdx - 2);
    const pEnd = Math.min(total - 1, myIdx + 2);
    for (let i = pStart; i <= pEnd; i++) idxSet.add(i);
  } else {
    // If current player unknown, ensure at least 5 entries by showing more after top
    for (let i = topCount; i < Math.min(total, 5); i++) idxSet.add(i);
  }

  // Ensure at least 5 entries are shown when possible
  let indices = Array.from(idxSet).sort((a, b) => a - b);
  let last = indices.length ? indices[indices.length - 1] : -1;
  while (indices.length < Math.min(5, total)) {
    const next = last + 1;
    if (next >= total) break;
    idxSet.add(next);
    indices = Array.from(idxSet).sort((a, b) => a - b);
    last = indices[indices.length - 1];
  }

  // Render with separators for gaps > 1 and trailing '...' if there are undisplayed entries
  indices = Array.from(idxSet).sort((a, b) => a - b);
  let prev = -1;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    if (prev !== -1 && i - prev > 1) {
      const sep = document.createElement('li');
      sep.className = 'standings-sep';
      sep.textContent = '...';
      standingsList.appendChild(sep);
    }
    const p = list[i];
    const li = document.createElement('li');
    if (i === myIdx) li.className = 'you-standing';
    li.textContent = `${ranks[i]}. ${p.nickname} – ${p.score} Punkte`;
    standingsList.appendChild(li);
    prev = i;
  }

  const lastDisplayed = indices.length ? indices[indices.length - 1] : -1;
  if (lastDisplayed < total - 1) {
    const sep = document.createElement('li');
    sep.className = 'standings-sep';
    sep.textContent = '...';
    standingsList.appendChild(sep);
  }
}

function startCountdown(seconds, total) {
  if (seconds <= 0) {
    if (countdownContainer) {
      countdownContainer.classList.add('hidden');
    }
    return;
  }
  if (countdownInterval) return; // Already running
  if (!countdownBar || !countdownContainer) return;
  totalQuestionTime = (total && total > 0) ? total : seconds;
  countdownContainer.classList.remove('hidden');
  countdownBar.style.width = '100%';
  let remaining = seconds;
  updateCountdownDisplay(remaining);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      updateCountdownDisplay(remaining);
      Array.from(answersDiv.querySelectorAll('button')).forEach(b => b.disabled = true);
      stopCountdown();
    } else {
      updateCountdownDisplay(remaining);
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (countdownContainer) {
    countdownContainer.classList.add('hidden');
  }
}

function updateCountdownDisplay(sec) {
  if (!countdownBar) return;
  const percentage = totalQuestionTime > 0 ? (sec / totalQuestionTime) * 100 : 0;
  countdownBar.style.width = percentage + '%';
  countdownBar.textContent = sec > 0 ? `${sec}s` : 'Zeit abgelaufen';
}

joinBtn.addEventListener('click', joinQuiz);
// Submit when pressing Enter in the nickname field
nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    joinQuiz();
  }
});

(async function init() {
  // Check localStorage first for persisted session
  const storedToken = localStorage.getItem('quiz_player_token');
  const storedNickname = localStorage.getItem('quiz_nickname');
  const storedCode = localStorage.getItem('quiz_code');

  if (storedToken && storedCode === code) {
    token = storedToken;
    const ok = await loadMe();
    if (ok) {
      requestWakeLock();
      show(rejoinedScreen); // explicit loading state while fetching current game phase
      let stateFetched = false;
      let retries = 0;
      while (!stateFetched && retries < 5) {
        stateFetched = await fetchInitialState();
        if (!stateFetched) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      startAbly();
      return;
    }
    // If loadMe failed, clear stored session and show join screen
    localStorage.removeItem('quiz_player_token');
    localStorage.removeItem('quiz_nickname');
    localStorage.removeItem('quiz_code');
  }

  // Fallback to cookie-based token
  if (token) {
    const ok = await loadMe();
    if (ok) {
      requestWakeLock();
      await fetchInitialState();
      startAbly();
      return;
    }
  }
  show(joinScreen);
})();
