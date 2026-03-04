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
</head>
<body class="host">
  <div id="host-app" data-code="<?php echo htmlspecialchars($code); ?>" data-ably-key="<?php echo htmlspecialchars($ABLY_CLIENT_KEY); ?>">
    <h1>Kahootino Quiz - Host</h1>
    <p>Quiz-Code: <strong><?php echo htmlspecialchars($code); ?></strong></p>
    <p>Player-URL / QR: <code><?php echo htmlspecialchars("$URL_TO_QUIZ/public/player.php?code=$code"); ?></code></p>

    <div id="host-controls">
      <button data-action="start_quiz">Quiz starten (reset)</button>
      <button data-action="show_question">Nächste Frage anzeigen</button>
      <button data-action="show_answers">Antworten anzeigen</button>
      <button data-action="reveal">Richtige Antwort zeigen</button>
      <button data-action="show_standings">Rangliste anzeigen</button>
      <button data-action="finish_quiz">Quiz beenden</button>
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

  <script src="js/host.js"></script>
</body>
</html>
