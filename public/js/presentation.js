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
    if (imageProgress) {
      qTitle.textContent = `Frage ${data.questionIndex + 1}${imageProgress}`;
    } else {
      qTitle.textContent = `Frage ${data.questionIndex + 1}`;
    }
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
