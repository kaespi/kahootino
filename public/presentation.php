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
</head>
<body class="presentation">
  <div id="presentation-app" data-code="<?php echo htmlspecialchars($code); ?>">
    <h1 id="p-title">Kahootino Quiz</h1>
    <h2 id="p-question"></h2>
    <img id="p-image" class="hidden" alt="">
    <ul id="p-answers"></ul>
    <h2 id="p-standings-title" class="hidden">Standings</h2>
    <ol id="p-standings"></ol>
  </div>

  <script src="js/presentation.js"></script>
</body>
</html>
