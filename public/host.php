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
</head>
<body class="host">
  <h1>Kahootino Quiz - Host</h1>
  <p>Quiz-Code: <strong><?php echo htmlspecialchars($code); ?></strong></p>
  <p>Player-URL / QR: <code><?php echo htmlspecialchars("$URL_TO_QUIZ/public/player.php?code=$code"); ?></code></p>

  <div>
    <button data-action="start_quiz">Quiz starten (reset)</button>
    <button data-action="show_question">Nächste Frage anzeigen</button>
    <button data-action="show_answers">Antworten anzeigen</button>
    <button data-action="reveal">Richtige Antwort zeigen</button>
    <button data-action="show_standings">Rangliste anzeigen</button>
    <button data-action="finish_quiz">Quiz beenden</button>
  </div>

  <div id="host-status"></div>

  <script>
    const HOST_CODE = "<?php echo htmlspecialchars($code); ?>";
  </script>
  <script src="js/host.js"></script>
</body>
</html>
