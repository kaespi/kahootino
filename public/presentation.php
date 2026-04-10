<?php
require_once __DIR__ . '/../config.php';
$code = $_GET['code'] ?? $DEFAULT_QUIZ_CODE;

// Collect all image paths for client-side preloading
$questions = load_questions();
$allImages = [];
foreach ($questions['intro_images'] ?? [] as $img) {
    $allImages[] = '../' . $img;
}
foreach ($questions['questions'] as $q) {
    foreach ($q['images'] ?? [] as $img) {
        $allImages[] = '../' . $img;
    }
    foreach ($q['answer_images'] ?? [] as $img) {
        $allImages[] = '../' . $img;
    }
}
$allImages = array_values(array_unique($allImages));
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Kahootino Quiz - Presentation</title>
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
  <style>
    html, body {
      height: 100%;
      margin: 0;
      overflow: hidden; /* force-hide page scrollbars for presentation mode */
    }
    /* Presentation layout: full viewport column, image area grows */
    #presentation-app {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      padding: 1rem 1.25rem;
      overflow: hidden;
    }

    #p-title {
      margin: 0 0 0.25rem 0;
      padding: 0;
      font-size: 1.6rem;
    }

    #p-question {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
    }

    .p-image-container {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    #p-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
      border-radius: 6px;
    }

    #p-image.hidden {
      display: none !important;
    }

    /* Answers and standings reserved area: allow answers to size naturally
       so we can measure their full height and shrink the image accordingly */
    #p-answers {
      margin: 0;
      padding-left: 1.25rem;
      max-height: none;
      overflow: visible;
    }

    #p-standings, #p-standings-title {
      margin: 0;
      padding: 0;
    }

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
  <div id="presentation-app" data-code="<?php echo htmlspecialchars($code); ?>" data-ably-key="<?php echo htmlspecialchars($ABLY_CLIENT_KEY); ?>" style="position:relative; height:100vh;">
    <h1 id="p-title">Kahootino Quiz</h1>
    <h2 id="p-question"></h2>
    <h2 id="p-standings-title" class="hidden">Rangliste</h2>
    <ol id="p-standings"></ol>
    <div class="p-image-container">
      <img id="p-image" class="hidden" alt="">
    </div>
    <ul id="p-answers"></ul>
  </div>

  <div id="participants-overlay"></div>

  <script>
    window.KAHOOTINO_IMAGES = <?php echo json_encode($allImages, JSON_UNESCAPED_SLASHES); ?>;
    window.KAHOOTINO_TITLE = <?php echo json_encode($questions['title'], JSON_UNESCAPED_SLASHES); ?>;
  </script>
  <script src="js/presentation.js"></script>
</body>
</html>
