const app = document.getElementById('host-app');
const code = app.dataset.code;
const statusDiv = document.getElementById('host-status');
const questionsList = document.getElementById('questions-list');
const countdownSection = document.getElementById('countdown-section');
const countdownDisplay = document.getElementById('host-countdown');
const standingsSection = document.getElementById('standings-section');
const standingsList = document.getElementById('host-standings-list');

let questions = [];
let currentPhase = null;
let currentQuestionIndex = -1;
let countdownInterval = null;
let countdownEndTime = null;

// Fetch questions on load
async function loadQuestions() {
  try {
    const res = await fetch('../data/questions.json');
    const data = await res.json();
    questions = data.questions || [];
    console.log('Questions loaded:', questions.length);
  } catch (err) {
    console.error('Failed to load questions:', err);
  }
}

// Render all questions with highlighting for current
function renderQuestionsList() {
  console.log('Rendering questions. Current index:', currentQuestionIndex, 'Total questions:', questions.length);
  questionsList.innerHTML = '';
  questions.forEach((q, idx) => {
    const li = document.createElement('li');
    li.textContent = q.text || `Frage ${idx + 1}`;
    if (idx === currentQuestionIndex) {
      li.className = 'current-question';
      console.log('Applied current-question class to index:', idx);
    }
    questionsList.appendChild(li);
  });
}

// Handle form submission for host actions
document.querySelectorAll('button[data-action]').forEach(btn => {
  btn.addEventListener('click', () => hostAction(btn.dataset.action));
});

async function hostAction(action) {
  const res = await fetch('../api/host_action.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({action, code})
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    statusDiv.textContent = data.error || 'Fehler';
  } else {
    statusDiv.textContent = `Aktion: ${action} OK`;
  }
}

// Handle real-time state updates
function handleStateUpdate(data) {
  console.log('State update received:', data);
  currentPhase = data.phase;
  currentQuestionIndex = data.questionIndex !== undefined ? data.questionIndex : -1;
  console.log('Updated currentQuestionIndex to:', currentQuestionIndex);

  // Update question highlighting
  renderQuestionsList();

  // Handle countdown display
  if (data.phase === 'answers' && data.questionEndTime) {
    countdownEndTime = new Date(data.questionEndTime);
    const serverTime = new Date(data.serverTime);
    const remainingMs = countdownEndTime - serverTime;
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    startCountdown(remainingSeconds);
    countdownSection.classList.remove('hidden');
  } else {
    stopCountdown();
    countdownSection.classList.add('hidden');
  }

  // Handle standings display
  if (data.phase === 'standings' || data.phase === 'finished') {
    renderStandings(data.standings || []);
    standingsSection.classList.remove('hidden');
  } else {
    standingsSection.classList.add('hidden');
  }
}

function startCountdown(initialSeconds) {
  stopCountdown();
  let remaining = initialSeconds;

  const update = () => {
    countdownDisplay.textContent = `${remaining}s`;
    remaining--;
    if (remaining < 0) {
      stopCountdown();
    }
  };

  update();
  countdownInterval = setInterval(update, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function renderStandings(list) {
  standingsList.innerHTML = '';
  const sorted = [...list].sort((a, b) => b.score - a.score);
  sorted.forEach((p, idx) => {
    const li = document.createElement('li');
    li.textContent = `${p.nickname} – ${p.score} Punkte`;
    standingsList.appendChild(li);
  });
}

// Start real-time updates via Ably with SSE fallback
function startAbly() {
  const ablyKey = app.dataset.ablyKey;
  if (!ablyKey) {
    console.log('No Ably key, falling back to SSE');
    startSSE();
    return;
  }

  try {
    const client = new Ably.Realtime(ablyKey);
    const channel = client.channels.get('quiz-' + code);

    channel.subscribe('state', (msg) => {
      const data = msg.data;
      handleStateUpdate(data);
    });
  } catch (err) {
    console.error('Ably failed, falling back to SSE:', err);
    startSSE();
  }
}

function startSSE() {
  const url = '../api/state_sse.php?code=' + encodeURIComponent(code);
  const evt = new EventSource(url);

  evt.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleStateUpdate(data);
    } catch (err) {
      console.error('Failed to parse SSE data:', err);
    }
  };

  evt.onerror = () => {
    console.log('SSE connection lost, browser will retry automatically.');
  };
}

// Fetch initial state
async function fetchInitialState() {
  try {
    const res = await fetch('../api/state.php?code=' + encodeURIComponent(code));
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('Failed to fetch initial state:', data.error);
      return;
    }
    handleStateUpdate(data);
  } catch (err) {
    console.error('Error fetching initial state:', err);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  await fetchInitialState();
  startAbly();
});
