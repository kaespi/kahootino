<?php
require_once __DIR__ . '/../config.php';

$code  = $_GET['code'] ?? null;
$token = $_GET['token'] ?? ($_COOKIE['quiz_player_token'] ?? null);

if (!$code) {
    header('Content-Type: text/event-stream');
    echo "event: error\n";
    echo "data: Missing code\n\n";
    flush();
    exit;
}

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', false);
while (ob_get_level() > 0) {
    ob_end_flush();
}
flush();
set_time_limit(0);

$lastHash = '';
$startTime = time();

while (true) {
    if (time() - $startTime > 55) {
        echo "event: ping\n";
        echo "data: keepalive\n\n";
        flush();
        break;
    }

    $quiz = get_quiz_by_code($code);
    if (!$quiz) {
        echo "event: error\n";
        echo "data: Quiz not found\n\n";
        flush();
        break;
    }

    $state = build_state_array($quiz, $token);
    $hash = md5(json_encode($state));

    if ($hash !== $lastHash) {
        echo "data: " . json_encode($state) . "\n\n";
        flush();
        $lastHash = $hash;
    }

    usleep(200000); // 200ms
    if (connection_aborted()) {
        break;
    }
}
