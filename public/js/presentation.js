const appP = document.getElementById('presentation-app');
const codeP = appP.dataset.code;

const qTitle = document.getElementById('p-title');
const qText = document.getElementById('p-question');
const qImage = document.getElementById('p-image');
const qAnswers = document.getElementById('p-answers');
const sTitle = document.getElementById('p-standings-title');
const sList = document.getElementById('p-standings');

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
}

function renderPresentation(data) {
  if (data.question && data.phase !== 'standings' && data.phase !== 'finished') {
    qText.textContent = data.question.text;
    if (data.question.image && data.phase !== 'standings' && data.phase !== 'finished') {
      qImage.src = '../' + data.question.image;
      qImage.classList.remove('hidden');
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
    }
  } else {
    qText.textContent = '';
    qAnswers.innerHTML = '';
    qImage.classList.add('hidden');
  }

  if (data.phase === 'standings' || data.phase === 'finished') {
    sTitle.classList.remove('hidden');
    sList.innerHTML = '';
    (data.standings || []).forEach((p, idx) => {
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
