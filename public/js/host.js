const app = document.getElementById('host-app');
const code = app.dataset.code;
const statusDiv = document.getElementById('host-status');
const questionsList = document.getElementById('questions-list');
const countdownSection = document.getElementById('countdown-section');
const countdownDisplay = document.getElementById('host-countdown');
const standingsSection = document.getElementById('standings-section');
const standingsList = document.getElementById('host-standings-list');
const imageNavSection = document.getElementById('image-navigation-section');
const questionImageNav = document.getElementById('question-image-nav');
const answerImageNav = document.getElementById('answer-image-nav');
const participantsSection = document.getElementById('participants-section');
const participantsList = document.getElementById('participants-list');
const participantsCount = document.getElementById('participants-count');

let questions = [];
let currentPhase = null;
let currentQuestionIndex = -1;
let currentQuestionImageIndex = 0;
let currentAnswerImageIndex = 0;
let countdownInterval = null;
let countdownEndTime = null;
let participants = [];

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
  currentQuestionImageIndex = data.questionImageIndex !== undefined ? data.questionImageIndex : 0;
  currentAnswerImageIndex = data.answerImageIndex !== undefined ? data.answerImageIndex : 0;
  console.log('Updated currentQuestionIndex to:', currentQuestionIndex);
  console.log('Updated image indices - question:', currentQuestionImageIndex, 'answer:', currentAnswerImageIndex);

  // Update question highlighting
  renderQuestionsList();

  // Update image navigation UI
  updateImageNavigationUI();

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

// Update image navigation UI visibility and button states
function updateImageNavigationUI() {
  // Show/hide image navigation section
  if (currentPhase === 'question' || currentPhase === 'reveal') {
    imageNavSection.classList.remove('hidden');
  } else {
    imageNavSection.classList.add('hidden');
    return;
  }

  // Get current question to access image arrays
  if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) {
    questionImageNav.classList.add('hidden');
    answerImageNav.classList.add('hidden');
    return;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const questionImages = currentQuestion.images || [];
  const answerImages = currentQuestion.answer_images || [];

  // Update question image navigation
  if (currentPhase === 'question' && questionImages.length > 0) {
    questionImageNav.classList.remove('hidden');
    updateImageNavButtons('question', currentQuestionImageIndex, questionImages.length);
  } else {
    questionImageNav.classList.add('hidden');
  }

  // Update answer image navigation (available during reveal phase)
  if (currentPhase === 'reveal' && answerImages.length > 0) {
    answerImageNav.classList.remove('hidden');
    updateImageNavButtons('answer', currentAnswerImageIndex, answerImages.length);
  } else {
    answerImageNav.classList.add('hidden');
  }
}

// Update button states and counter text for image navigation
function updateImageNavButtons(type, currentIndex, totalImages) {
  const counter = document.getElementById(`${type}-image-counter`);
  const prevBtn = document.getElementById(`prev-${type}-image`);
  const nextBtn = document.getElementById(`next-${type}-image`);

  // Update counter text
  counter.textContent = `Bild ${currentIndex + 1} von ${totalImages}`;

  // Update button states
  if (currentIndex === 0) {
    prevBtn.classList.add('disabled');
    prevBtn.disabled = true;
  } else {
    prevBtn.classList.remove('disabled');
    prevBtn.disabled = false;
  }

  if (currentIndex === totalImages - 1) {
    nextBtn.classList.add('disabled');
    nextBtn.disabled = true;
  } else {
    nextBtn.classList.remove('disabled');
    nextBtn.disabled = false;
  }
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
      // subscribe to join notifications
      channel.subscribe('join', (msg) => {
        try {
          handleJoin(msg.data);
        } catch (err) {
          console.error('Failed to handle join message', err);
        }
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
    // Also fetch current participants list
    try {
      await fetchPlayers();
    } catch (err) {
      console.error('Failed to fetch players:', err);
    }
  } catch (err) {
    console.error('Error fetching initial state:', err);
  }
}

async function fetchPlayers() {
  try {
    const res = await fetch('../api/players.php?code=' + encodeURIComponent(code));
    const data = await res.json();
    if (!res.ok || data.error) return;
    participants = (data.players || []).map(p => p.nickname);
    renderParticipants();
  } catch (err) {
    console.error('Error fetching players:', err);
  }
}

function handleJoin(data) {
  if (!data || !data.nickname) return;
  addParticipant(data.nickname);
}

function addParticipant(nick) {
  if (!nick) return;
  if (participants.indexOf(nick) !== -1) return;
  participants.push(nick);
  renderParticipants();
}

function renderParticipants() {
  if (!participantsList || !participantsCount) return;
  participantsList.innerHTML = '';
  participants.forEach(nick => {
    const li = document.createElement('li');
    li.textContent = nick;
    participantsList.appendChild(li);
  });
  participantsCount.textContent = participants.length;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Attach click handlers to all action buttons
  document.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => hostAction(btn.dataset.action));
  });

  await loadQuestions();
  await fetchInitialState();
  startAbly();
});
