const app = document.getElementById('app');
const code = app.dataset.code;

const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const questionScreen = document.getElementById('question-screen');
const standingsScreen = document.getElementById('standings-screen');

const nicknameInput = document.getElementById('nickname');
const joinBtn = document.getElementById('join-btn');
const joinError = document.getElementById('join-error');
const playerName = document.getElementById('player-name');

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

function getCookie(name) {
  const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return m ? m.pop() : '';
}

function show(screen) {
  [joinScreen, waitingScreen, questionScreen, standingsScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

async function joinQuiz() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    joinError.textContent = 'Bitte Nickname eingeben.';
    return;
  }
  joinError.textContent = '';
  const res = await fetch('../api/join.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({code, nickname})
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    joinError.textContent = data.error || 'Beitritt fehlgeschlagen';
    return;
  }
  token = data.token;
  playerName.textContent = nickname;
  show(waitingScreen);
  startAbly();
}

async function loadMe() {
  if (!token) return false;
  const res = await fetch('../api/me.php?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token));
  const data = await res.json();
  if (!res.ok || data.error) {
    return false;
  }
  playerName.textContent = data.nickname;
  return true;
}

function startSSE() {
  const url = '../api/state_sse.php?code=' + encodeURIComponent(code) + (token ? '&token=' + encodeURIComponent(token) : '');
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

  channel.subscribe('state', (msg) => {
    const data = msg.data;
    handleStateUpdate(data);
  });
}

function handleStateUpdate(data) {
  currentQuestionIndex = data.questionIndex;
  hasAnswered = data.hasAnswered;
  questionEndTime = data.questionEndTime ? new Date(data.questionEndTime) : null;

  if (data.phase === 'waiting') {
    show(waitingScreen);
    stopCountdown();
  } else if (data.phase === 'question') {
    renderQuestion(data.question, data.serverTime, data.questionEndTime, data.phase);
    show(questionScreen);
    stopCountdown();
  } else if (data.phase === 'answers') {
    lastRenderedQuestionIndex = -1;
    renderQuestion(data.question, data.serverTime, data.questionEndTime, data.phase);
    show(questionScreen);
  } else if (data.phase === 'reveal') {
    renderQuestion(data.question, data.serverTime, data.questionEndTime, data.phase);
    answerStatus.textContent = 'Richtige Antwort:';
    show(questionScreen);
    stopCountdown();
  } else if (data.phase === 'standings' || data.phase === 'finished') {
    renderStandings(data.standings || []);
    show(standingsScreen);
    stopCountdown();
  }
}

function renderQuestion(q, serverTime, endTime, phase) {
  if (!q) return;
  questionText.textContent = q.text;
  if (q.image && !endTime) {
    questionImage.src = '../' + q.image;
    questionImage.classList.remove('hidden');
  } else {
    questionImage.classList.add('hidden');
  }
  answersDiv.innerHTML = '';

  // Only render answer buttons if endTime is set (answers should be visible)
  if (endTime) {
    q.answers.forEach((ans, idx) => {
      const btn = document.createElement('button');
      btn.textContent = ans;
      btn.disabled = hasAnswered || phase === 'reveal';
      btn.addEventListener('click', () => submitAnswer(idx));

      // Mark correct answer in reveal phase
      if (phase === 'reveal' && idx === q.correctIndex) {
        btn.style.backgroundColor = '#90EE90';
        btn.style.fontWeight = 'bold';
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
    startCountdown(remaining);
  }
}

async function submitAnswer(idx) {
  if (hasAnswered) return;
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
  if (!res.ok || data.error) {
    answerStatus.textContent = data.error || 'Antwort konnte nicht gesendet werden.';
    return;
  }
  hasAnswered = true;
  Array.from(answersDiv.querySelectorAll('button')).forEach(b => b.disabled = true);
}

function renderStandings(list) {
  standingsList.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.nickname} – ${p.score} Punkte`;
    standingsList.appendChild(li);
  });
}

function startCountdown(seconds) {
  if (seconds <= 0) {
    if (countdownContainer) {
      countdownContainer.classList.add('hidden');
    }
    return;
  }
  if (countdownInterval) return; // Already running
  if (!countdownBar || !countdownContainer) return;
  totalQuestionTime = seconds;
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

(async function init() {
  if (token) {
    const ok = await loadMe();
    if (ok) {
      show(waitingScreen);
      startAbly();
      return;
    }
  }
  show(joinScreen);
})();
