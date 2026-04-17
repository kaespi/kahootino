<?php
require_once __DIR__ . '/../config.php';

$code  = $_GET['code'] ?? null;
$token = $_GET['token'] ?? null;
if (!$token) {
    $token = $_SERVER['HTTP_X_QUIZ_TOKEN'] ?? null;
}
if (!$token) {
    $token = $_COOKIE['quiz_player_token'] ?? null;
}

if (!$code) {
    json_response(['error' => 'Missing code'], 400);
}

$quiz = get_quiz_by_code($code);
if (!$quiz) {
    json_response(['error' => 'Quiz not found'], 404);
}

$state = build_state_array($quiz, $token);
json_response($state);
