<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/ably.php';

$code     = $_POST['code'] ?? null;
$nickname = trim($_POST['nickname'] ?? '');

if (!$code || $nickname === '') {
    json_response(['error' => 'Missing code or nickname'], 400);
}

$quiz = get_quiz_by_code($code);
if (!$quiz) {
    json_response(['error' => 'Quiz not found'], 404);
}

$token = bin2hex(random_bytes(16));

try {
    $stmt = db()->prepare("INSERT INTO player (quiz_id, nickname, cookie_token) VALUES (?, ?, ?)");
    $stmt->execute([$quiz['id'], $nickname, $token]);
    // Notify hosts/presentations via Ably that a new player joined
    try {
        ably_publish("quiz-$code", "join", ['nickname' => $nickname, 'joinedAt' => date('c')]);
    } catch (Exception $e) {
        // non-fatal: don't break the join on notify failures
    }
} catch (PDOException $e) {
    json_response(['error' => 'Nickname already taken'], 400);
}

setcookie('quiz_player_token', $token, time() + 60*60*24*30, '/', '', false, true);

json_response(['status' => 'ok', 'token' => $token]);
