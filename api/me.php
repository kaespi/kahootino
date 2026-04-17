<?php
require_once __DIR__ . '/../config.php';

$code  = $_GET['code'] ?? null;
$token = $_SERVER['HTTP_X_QUIZ_TOKEN'] ?? ($_COOKIE['quiz_player_token'] ?? null) ?? ($_GET['token'] ?? null);

if (!$code || !$token) {
    json_response(['error' => 'Missing code or token'], 400);
}

$quiz = get_quiz_by_code($code);
if (!$quiz) {
    json_response(['error' => 'Quiz not found'], 404);
}

$stmt = db()->prepare("SELECT * FROM player WHERE quiz_id = ? AND cookie_token = ?");
$stmt->execute([$quiz['id'], $token]);
$player = $stmt->fetch();

if (!$player) {
    json_response(['error' => 'Player not found'], 404);
}

json_response([
    'status'   => 'ok',
    'nickname' => $player['nickname'],
    'score'    => (int)$player['score'],
]);
