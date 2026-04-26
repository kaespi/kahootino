<?php
require_once __DIR__ . '/../config.php';
$code = $_GET['code'] ?? $DEFAULT_QUIZ_CODE;
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Kahootino Quiz - Host</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.ably.io/lib/ably.min-1.js"></script>
  <!-- Favicon and PWA links -->
  <link rel="icon" href="icons/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
  <link rel="manifest" href="icons/site.webmanifest">
  <meta name="theme-color" content="#ffffff">
</head>
<body class="host">
  <div id="host-app" data-code="<?php echo htmlspecialchars($code); ?>" data-ably-key="<?php echo htmlspecialchars($ABLY_CLIENT_KEY); ?>">
    <h1>Kahootino Quiz - Host</h1>
    <p>Quiz-Code: <strong><?php echo htmlspecialchars($code); ?></strong></p>
    <p>Player-URL / QR: <code><?php echo htmlspecialchars("$URL_TO_QUIZ/public/player.php?code=$code"); ?></code></p>

    <div id="host-controls">
      <button data-action="show_question">Nächste Frage anzeigen</button>
      <button data-action="show_answers">Antworten anzeigen</button>
      <button data-action="reveal">Richtige Antwort zeigen</button>
      <button data-action="show_standings">Rangliste anzeigen</button>
    </div>

    <div id="intro-controls" class="hidden">
      <button data-action="start_intro">Intro starten</button>
      <button data-action="open_for_joining">Zum Beitreten öffnen</button>
    </div>

    <div id="participants-section">
      <h2>Teilnehmer (<span id="participants-count">0</span>)</h2>
      <ul id="participants-list"></ul>
    </div>

    <div id="image-navigation-section" class="hidden">
      <div id="intro-image-nav" class="image-nav-group hidden">
        <h3>Intro-Bilder</h3>
        <div class="image-nav-controls">
          <button id="prev-intro-image" data-action="prev_intro_image" class="image-nav-btn disabled">← Vorheriges Bild</button>
          <span id="intro-image-counter" class="image-counter">Bild 1 von 1</span>
          <button id="next-intro-image" data-action="next_intro_image" class="image-nav-btn disabled">Nächstes Bild →</button>
        </div>
      </div>

      <div id="question-image-nav" class="image-nav-group hidden">
        <h3>Fragen-Bilder</h3>
        <div class="image-nav-controls">
          <button id="prev-question-image" data-action="prev_question_image" class="image-nav-btn disabled">← Vorheriges Bild</button>
          <span id="question-image-counter" class="image-counter">Bild 1 von 1</span>
          <button id="next-question-image" data-action="next_question_image" class="image-nav-btn disabled">Nächstes Bild →</button>
        </div>
      </div>

      <div id="answer-image-nav" class="image-nav-group hidden">
        <h3>Antwort-Bilder</h3>
        <div class="image-nav-controls">
          <button id="prev-answer-image" data-action="prev_answer_image" class="image-nav-btn disabled">← Vorheriges Bild</button>
          <span id="answer-image-counter" class="image-counter">Bild 1 von 1</span>
          <button id="next-answer-image" data-action="next_answer_image" class="image-nav-btn disabled">Nächstes Bild →</button>
        </div>
      </div>

      <div id="video-controls-group" class="image-nav-group hidden">
        <h3>Video-Steuerung</h3>
        <div class="image-nav-controls">
          <button id="replay-video-btn" data-action="replay_video" class="image-nav-btn">↺ Nochmal</button>
        </div>
      </div>
    </div>

    <div id="host-status"></div>

    <div id="host-content">
      <section id="questions-section">
        <h2>Fragen</h2>
        <ol id="questions-list"></ol>
      </section>

      <section id="countdown-section" class="hidden">
        <h2>Zeit verbleibend</h2>
        <div id="host-countdown" class="host-countdown">-</div>
      </section>

      <section id="standings-section" class="hidden">
        <h2>Rangliste</h2>
        <ol id="host-standings-list"></ol>
      </section>
    </div>
  </div>

  <div id="host-controls2">
    <button data-action="start_quiz">Quiz starten (reset)</button>
    <button data-action="finish_quiz">Quiz beenden</button>
  </div>

  <script src="js/debug-overlay.js"></script>
  <script src="js/host.js"></script>
</body>
</html>
