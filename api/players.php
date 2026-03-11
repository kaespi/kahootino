<?php
require_once __DIR__ . '/../config.php';

$code = $_GET['code'] ?? null;

if (!$code) {
    json_response(['error' => 'Missing code'], 400);
}

$quiz = get_quiz_by_code($code);
if (!$quiz) {
    json_response(['error' => 'Quiz not found'], 404);
}

$stmt = db()->prepare("SELECT nickname, created_at FROM player WHERE quiz_id = ? ORDER BY created_at ASC");
$stmt->execute([$quiz['id']]);
$players = $stmt->fetchAll();

json_response(['players' => $players]);
