<?php
require_once __DIR__ . '/../config.php';
$code = $_GET['code'] ?? $DEFAULT_QUIZ_CODE;
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Kahootino Quiz</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.ably.io/lib/ably.min-1.js"></script>
</head>
<body class="player">
  <div id="app" data-code="<?php echo htmlspecialchars($code); ?>" data-ably-key="<?php echo htmlspecialchars($ABLY_CLIENT_KEY); ?>">
    <div id="join-screen">
      <h1>Kahootino Quiz</h1>
      <p>Dein Nickname:</p>
      <input type="text" id="nickname" maxlength="64" placeholder="Nickname" autofocus autocomplete="off">
      <button id="join-btn">Beitreten</button>
      <div id="join-error" class="error"></div>
    </div>

    <div id="waiting-screen" class="hidden">
      <h2>Warte auf den Start des Quiz...</h2>
      <p id="player-name"></p>
    </div>

    <div id="rejoined-screen" class="hidden">
      <h2>Warte bis das Quiz fortgesetzt wird...</h2>
      <p id="player-name"></p>
    </div>

    <div id="question-screen" class="hidden">
      <h2 id="question-text"></h2>
      <img id="question-image" class="hidden" alt="">
      <div id="answers"></div>
      <div id="countdown-container">
        <div id="countdown-bar"></div>
        <div id="countdown-text"></div>
      </div>
      <div id="answer-status"></div>
    </div>

    <div id="standings-screen" class="hidden">
      <h2>Rangliste</h2>
      <ol id="standings-list"></ol>
    </div>
  </div>

  <script src="js/player.js"></script>
</body>
</html>
