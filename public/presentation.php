<?php
require_once __DIR__ . '/../config.php';
$code = $_GET['code'] ?? $DEFAULT_QUIZ_CODE;
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Kahootino Quiz - Presentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.ably.io/lib/ably.min-1.js"></script>
  <style>
    #participants-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }
    .participant-badge {
      position: absolute;
      display: inline-block;
      background: rgba(255,255,255,0.95);
      color: #222;
      padding: 10px 14px;
      font-size: 1.1rem;
      border-radius: 999px;
      font-weight: 700;
      box-shadow: 0 6px 14px rgba(0,0,0,0.18);
      transform: translate(-50%, -50%);
      white-space: nowrap;
      pointer-events: auto;
      user-select: none;
    }
  </style>
</head>
<body class="presentation">
  <div id="presentation-app" data-code="<?php echo htmlspecialchars($code); ?>" data-ably-key="<?php echo htmlspecialchars($ABLY_CLIENT_KEY); ?>" style="position:relative; min-height:100vh;">
    <h1 id="p-title">Kahootino Quiz</h1>
    <h2 id="p-question"></h2>
    <img id="p-image" class="hidden" alt="">
    <ul id="p-answers"></ul>
    <h2 id="p-standings-title" class="hidden">Rangliste</h2>
    <ol id="p-standings"></ol>
  </div>

  <div id="participants-overlay"></div>

  <script src="js/presentation.js"></script>
</body>
</html>
