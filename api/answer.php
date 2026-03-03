<?php
require_once __DIR__ . '/../config.php';

$code          = $_POST['code'] ?? null;
$token         = $_POST['token'] ?? ($_COOKIE['quiz_player_token'] ?? null);
$questionIndex = isset($_POST['questionIndex']) ? (int)$_POST['questionIndex'] : null;
$chosenOption  = isset($_POST['chosenOption']) ? (int)$_POST['chosenOption'] : null;

if (!$code || !$token || $questionIndex === null || $chosenOption === null) {
    json_response(['error' => 'Missing parameters'], 400);
}

$quiz = get_quiz_by_code($code);
if (!$quiz) {
    json_response(['error' => 'Quiz not found'], 404);
}

if ($quiz['phase'] !== 'answers') {
    json_response(['error' => 'Not accepting answers now'], 400);
}

$now = new DateTimeImmutable('now');
$end = $quiz['question_end_time'] ? new DateTimeImmutable($quiz['question_end_time']) : null;
$start = $quiz['question_start_time'] ? new DateTimeImmutable($quiz['question_start_time']) : null;

if (!$start || !$end || $now > $end) {
    json_response(['error' => 'Time is up'], 400);
}

$stmt = db()->prepare("SELECT * FROM player WHERE quiz_id = ? AND cookie_token = ?");
$stmt->execute([$quiz['id'], $token]);
$player = $stmt->fetch();
if (!$player) {
    json_response(['error' => 'Player not found'], 404);
}

// prevent double answer
$stmt = db()->prepare("SELECT id FROM answer WHERE quiz_id = ? AND player_id = ? AND question_index = ?");
$stmt->execute([$quiz['id'], $player['id'], $questionIndex]);
if ($stmt->fetch()) {
    json_response(['error' => 'Already answered'], 400);
}

$questions = load_questions();
if (!isset($questions['questions'][$questionIndex])) {
    json_response(['error' => 'Invalid question index'], 400);
}
$q = $questions['questions'][$questionIndex];

$isCorrect = ($chosenOption === (int)$q['correctIndex']) ? 1 : 0;

$elapsedMs   = ($now->getTimestamp() - $start->getTimestamp()) * 1000;
$totalMs     = ((int)$q['countdownSeconds']) * 1000;
$remainingMs = max(0, $totalMs - $elapsedMs);

$maxPoints = (int)$q['maxPoints'];
$points = $isCorrect ? (int)floor($maxPoints * ($remainingMs / $totalMs)) : 0;

db()->beginTransaction();
try {
    $stmt = db()->prepare("
        INSERT INTO answer (quiz_id, player_id, question_index, chosen_option, is_correct, time_ms, points)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $quiz['id'],
        $player['id'],
        $questionIndex,
        $chosenOption,
        $isCorrect,
        $elapsedMs,
        $points
    ]);

    if ($points > 0) {
        $stmt = db()->prepare("UPDATE player SET score = score + ? WHERE id = ?");
        $stmt->execute([$points, $player['id']]);
    }

    db()->commit();
} catch (Exception $e) {
    db()->rollBack();
    json_response(['error' => 'Failed to save answer'], 500);
}

json_response(['status' => 'ok', 'points' => $points, 'isCorrect' => (bool)$isCorrect]);
