const appP = document.getElementById('presentation-app');
const codeP = appP.dataset.code;

const qTitle = document.getElementById('p-title');
const qText = document.getElementById('p-question');
const qImage = document.getElementById('p-image');
const qAnswers = document.getElementById('p-answers');
const sTitle = document.getElementById('p-standings-title');
const sList = document.getElementById('p-standings');
const participantsOverlay = document.getElementById('participants-overlay');

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
}

function renderPresentation(data) {
  // Show participants only during waiting phase
  if (data.phase === 'waiting') {
    showParticipantsOverlay(true);
  } else {
    showParticipantsOverlay(false);
  }
  if (data.question && data.phase !== 'standings' && data.phase !== 'finished') {
    qText.textContent = data.question.text;

    // Show question image with progress indicator
    let imageProgress = '';
    if (data.question.images && data.question.images.length > 0 && data.showImagesToPlayers && data.phase !== 'standings' && data.phase !== 'finished') {
      const imageIndex = data.questionImageIndex || 0;
      const imageToShow = data.question.images[imageIndex] || data.question.images[0];
      qImage.src = '../' + imageToShow;
      qImage.classList.remove('hidden');

      // Add progress indicator if multiple images
      if (data.question.images.length > 1) {
        imageProgress = ` (Bild ${imageIndex + 1}/${data.question.images.length})`;
      }
    } else {
      qImage.classList.add('hidden');
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
        }

        qAnswers.appendChild(li);
      });

      // Add answer images below the answers if available (only in reveal phase)
      if (data.phase === 'reveal' && data.question.answerImages && data.question.answerImages.length > 0 && data.showImagesToPlayers) {
        const answerImageIndex = data.answerImageIndex || 0;
        const answerImageToShow = data.question.answerImages[answerImageIndex] || data.question.answerImages[0];

        const imgContainer = document.createElement('div');
        imgContainer.style.marginTop = '1rem';
        const img = document.createElement('img');
        img.src = '../' + answerImageToShow;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '4px';

        let answerImageProgress = '';
        if (data.question.answerImages.length > 1) {
          answerImageProgress = `Bild ${answerImageIndex + 1}/${data.question.answerImages.length}`;
          imgContainer.textContent = answerImageProgress;
          imgContainer.appendChild(img);
        } else {
          imgContainer.appendChild(img);
        }
        qAnswers.appendChild(imgContainer);
      }
    }

    // Update title with image progress indicator
    qTitle.textContent = `Frage ${data.questionIndex + 1}`;
  } else {
    qText.textContent = '';
    qAnswers.innerHTML = '';
    qImage.classList.add('hidden');
  }

  if (data.phase === 'standings' || data.phase === 'finished') {
    sTitle.classList.remove('hidden');
    sList.innerHTML = '';
    // Only show top 10 on the presentation screen
    const tops = (data.standings || []).slice(0, 10);
    tops.forEach((p, idx) => {
      const li = document.createElement('li');
      li.textContent = `${idx + 1}. ${p.nickname} – ${p.score} Punkte`;
      sList.appendChild(li);
    });
  } else {
    sTitle.classList.add('hidden');
    sList.innerHTML = '';
  }
}

startAbly();


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
    if (participants.length === 0) {
      fetchPlayers();
    } else {
      renderParticipants();
    }
  }
}

// Initialize participants on load
fetchPlayers();
