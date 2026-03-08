const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const BASE_URL = process.env.BASE_URL || '<URL>';
const QUIZ_CODE = process.env.QUIZ_CODE || '<code>';
const PLAYERS = parseInt(process.env.PLAYERS || '20', 10);
const HEADLESS = process.env.HEADLESS !== 'false';
const AUTO_HOST = process.env.AUTO_HOST === '1';
const HOST_COUNTDOWN = parseInt(process.env.HOST_COUNTDOWN || '12', 10);
const JOIN_STAGGER_MS = parseInt(process.env.JOIN_STAGGER_MS || '120', 10);
const MAX_ANSWER_DELAY_MS = parseInt(process.env.MAX_ANSWER_DELAY_MS || '10000', 10);

async function hostFlow() {
  console.log('[host] starting automated host flow');
  const post = async (action) => {
    const url = `${BASE_URL}/api/host_action.php`;
    const body = new URLSearchParams({ action, code: QUIZ_CODE });
    try {
      const res = await fetch(url, { method: 'POST', body });
      const data = await res.json();
      console.log(`[host] action=${action} ->`, data);
      return data;
    } catch (err) {
      console.error('[host] error calling host_action', err);
    }
  };

  await post('start_quiz');
  await new Promise(r => setTimeout(r, 1000));
  await post('show_question');
  await new Promise(r => setTimeout(r, 1500));
  await post('show_answers');
  // Wait HOST_COUNTDOWN seconds for players to answer
  await new Promise(r => setTimeout(r, HOST_COUNTDOWN * 1000));
  await post('reveal');
  await new Promise(r => setTimeout(r, 2000));
  await post('show_standings');
  console.log('[host] automated host flow done');
}

async function startPlayer(browser, id) {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  const url = `${BASE_URL}/public/player.php?code=${encodeURIComponent(QUIZ_CODE)}&reset=1`;
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (err) {
    console.error(`[player ${id}] navigation to ${url} failed:`, err.message);
    try { await page.screenshot({ path: `tools/screenshot-player-nav-fail-${id}.png`, fullPage: true }); } catch(_) {}
    try { const html = await page.content(); require('fs').writeFileSync(`tools/page-player-nav-fail-${id}.html`, html); } catch(_) {}
    await page.close();
    return { id, error: 'navigation_failed', message: err.message };
  }

  const nickname = `Player-${String(id).padStart(2,'0')}`;
  // Fill nickname and click join
  try {
    await page.waitForSelector('#nickname', { timeout: 60000 });
  } catch (err) {
    console.error(`[player ${id}] Timeout waiting for #nickname on ${url}`);
    try { await page.screenshot({ path: `tools/screenshot-player-${id}.png`, fullPage: true }); } catch(_) {}
    try { const html = await page.content(); require('fs').writeFileSync(`tools/page-player-${id}.html`, html); } catch(_) {}
    await page.close();
    return { id, error: 'no_nickname_selector', url };
  }
  await page.evaluate((nick) => { document.getElementById('nickname').value = nick; }, nickname);
  await page.click('#join-btn');

  // Wait until joined: either waiting screen or question screen
  await page.waitForFunction(() => document.querySelector('#join-screen').classList.contains('hidden'));

  // Wait for answers to appear (buttons in #answers)
  console.log(`[player ${id}] joined as ${nickname}, waiting for answers phase`);
  try {
    await page.waitForFunction(() => document.querySelectorAll('#answers button').length > 0, { timeout: 0 });
  } catch (e) {
    console.error(`[player ${id}] timed out waiting for answers`);
    // keep page open for debugging but return as unanswered
    return { id, nickname, answered: false, page };
  }

  // Wait a random delay before answering to simulate human response time
  const answerDelay = Math.floor(Math.random() * (MAX_ANSWER_DELAY_MS + 1));
  console.log(`[player ${id}] waiting ${answerDelay}ms before answering`);
  await page.waitForTimeout(answerDelay);

  // Pick a random answer and click; capture the current question index
  const pick = await page.evaluate(() => {
    const qIndex = typeof window.currentQuestionIndex !== 'undefined' ? window.currentQuestionIndex : -1;
    const buttons = Array.from(document.querySelectorAll('#answers button'));
    const idx = buttons.length ? Math.floor(Math.random() * buttons.length) : -1;
    if (buttons[idx]) buttons[idx].click();
    return { qIndex, idx };
  });

  const chosen = pick.idx;
  const questionIndexAtAnswer = pick.qIndex;
  console.log(`[player ${id}] clicked answer ${chosen} (questionIndex=${questionIndexAtAnswer})`);

  // Determine immediate result (selected/correct if revealed yet)
  const immediate = await page.evaluate((qIndex) => {
    const buttons = Array.from(document.querySelectorAll('#answers button'));
    if (!buttons || buttons.length === 0) return { answered: true, correct: null };
    const sel = buttons.find(b => b.classList.contains('selected')) || buttons[qIndex];
    const correct = sel ? sel.classList.contains('correct') : null;
    return { answered: true, correct };
  }, chosen);

  // Create a finish promise that resolves when standings screen appears or timeout elapses
  const finishPromise = (async () => {
    try {
      // Wait up to 5 minutes for standings to appear
      await page.waitForFunction(() => document.getElementById('standings-screen') && !document.getElementById('standings-screen').classList.contains('hidden'), { timeout: 5 * 60 * 1000 });
    } catch (e) {
      // timeout or error
    }
    // capture final state for this player
    let final = {};
    try {
      final = await page.evaluate(() => {
        const myNick = (document.getElementById('player-name') && document.getElementById('player-name').textContent) || localStorage.getItem('quiz_nickname') || null;
        const standings = Array.from(document.querySelectorAll('#standings-list li')).map(li => li.textContent.trim());
        return { myNick, standings };
      });
    } catch (_) { final = {}; }
    try { await page.close(); } catch(_) {}
    return final;
  })();

  // Return after first answer but keep page alive via finishPromise
  return { id, nickname, chosen, questionIndex: questionIndexAtAnswer, ...immediate, finishPromise, page };
}

(async () => {
  console.log(`Simulator starting: ${PLAYERS} players -> ${BASE_URL} (code=${QUIZ_CODE})`);
  if (AUTO_HOST) console.log('AUTO_HOST enabled: simulator will advance quiz phases automatically');

  const browser = await puppeteer.launch({ headless: HEADLESS, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  if (AUTO_HOST) {
    // Start host flow in parallel after a short delay so players can join
    setTimeout(() => hostFlow(), 2000);
  }

  const results = [];
  const concurrency = Math.min(10, PLAYERS);

  // Helper to run a batch of player ids with concurrency
  async function runBatch(ids) {
    const idQueue = ids.slice();
    const workers = Array.from({ length: Math.min(concurrency, ids.length) }).map(async () => {
      while (idQueue.length > 0) {
        const i = idQueue.shift();
        // Stagger joins to avoid bursts
        await new Promise(r => setTimeout(r, JOIN_STAGGER_MS));
        try {
          const r = await startPlayer(browser, i);
          results.push(r);
          // collect finish promises so we can wait for full-flow later
          if (r && r.finishPromise) finishPromises.push(r.finishPromise);
        } catch (err) {
          console.error('player error', err);
        }
      }
    });
    await Promise.all(workers);
  }

  const firstBatchSize = Math.min(PLAYERS, Math.ceil(PLAYERS / 2));
  const firstIds = Array.from({ length: firstBatchSize }, (_, i) => i + 1);
  const secondIds = Array.from({ length: Math.max(0, PLAYERS - firstBatchSize) }, (_, i) => firstBatchSize + i + 1);

  console.log(`[sim] launching first batch: players 1..${firstBatchSize}`);
  const finishPromises = [];
  await runBatch(firstIds);

  // Verify first batch answered first question (questionIndex === 0)
  const answeredFirst = results.filter(r => r.questionIndex === 0 && r.answered).length;
  if (answeredFirst < firstBatchSize) {
    console.warn(`[sim] only ${answeredFirst}/${firstBatchSize} players in first batch answered question 0; proceeding to launch rest anyway`);
  } else {
    console.log(`[sim] all ${firstBatchSize} players answered the first question`);
  }

  if (secondIds.length > 0) {
    console.log(`[sim] launching second batch: players ${firstBatchSize + 1}..${PLAYERS}`);
    await runBatch(secondIds);
  }

  // Wait for all players to reach end (standings) or timeout
  if (finishPromises.length > 0) {
    console.log('[sim] waiting for players to reach standings...');
    try {
      await Promise.all(finishPromises.map(p => Promise.race([p, new Promise(r => setTimeout(r, 30 * 1000))])));
    } catch (_) {}
  }

  await browser.close();

  const answered = results.filter(r => r.answered).length;
  const correct = results.filter(r => r.correct === true).length;
  console.log('--- Summary ---');
  console.log('Total players:', PLAYERS);
  console.log('Answered:', answered);
  console.log('Correct:', correct);
  console.log('Details:', results);

  process.exit(0);
})();
