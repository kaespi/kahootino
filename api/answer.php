<?php
require_once __DIR__ . '/../config.php';

// timing start for performance measurement
$request_start = microtime(true);

function timed_json_response($data, $status = 200) {
    global $request_start;
    $data['duration_ms'] = (int)round((microtime(true) - $request_start) * 1000);
    json_response($data, $status);
}

$code          = $_POST['code'] ?? null;
$token         = $_POST['token'] ?? ($_COOKIE['quiz_player_token'] ?? null);
$questionIndex = isset($_POST['questionIndex']) ? (int)$_POST['questionIndex'] : null;
$chosenOption  = isset($_POST['chosenOption']) ? (int)$_POST['chosenOption'] : null;

if (!$code || !$token || $questionIndex === null || $chosenOption === null) {
    timed_json_response(['error' => 'Fehlende Parameter'], 400);
}

$quiz = get_quiz_by_code($code);
if (!$quiz) {
    timed_json_response(['error' => 'Quiz nicht gefunden'], 404);
}

if ($quiz['phase'] !== 'answers') {
    timed_json_response(['error' => 'Antworten werden derzeit nicht akzeptiert'], 400);
}

// use high-resolution current time so scoring isn't quantized to seconds
$now = microtime(true);
$end = $quiz['question_end_time'] ? strtotime($quiz['question_end_time']) : null;
$questionStart = $quiz['question_start_time'] ? strtotime($quiz['question_start_time']) : null;

if ($questionStart === null || $end === null || $now > $end) {
    timed_json_response(['error' => 'Zeit abgelaufen'], 400);
}

// fetch only id to reduce payload and parsing
$stmt = db()->prepare("SELECT id FROM player WHERE quiz_id = ? AND cookie_token = ?");
$stmt->execute([$quiz['id'], $token]);
$playerId = $stmt->fetchColumn();
if (!$playerId) {
    timed_json_response(['error' => 'Spieler nicht gefunden'], 404);
}

$questions = load_questions();
if (!isset($questions['questions'][$questionIndex])) {
    timed_json_response(['error' => 'Ungültiger Fragenindex'], 400);
}
$q = $questions['questions'][$questionIndex];

$isCorrect = ($chosenOption === (int)$q['correctIndex']) ? 1 : 0;

$elapsedMs   = max(0, ($now - $questionStart) * 1000);
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
        $playerId,
        $questionIndex,
        $chosenOption,
        $isCorrect,
        (int)round($elapsedMs),
        $points
    ]);

    if ($points > 0) {
        $stmt = db()->prepare("UPDATE player SET score = score + ? WHERE id = ?");
        $stmt->execute([$points, $playerId]);
    }

    db()->commit();
} catch (PDOException $e) {
    db()->rollBack();
    // MySQL duplicate key = SQLSTATE 23000
    if ($e->getCode() === '23000') {
        timed_json_response(['error' => 'Bereits beantwortet'], 400);
    }
    timed_json_response(['error' => 'Antwort konnte nicht gespeichert werden'], 500);
} catch (Exception $e) {
    db()->rollBack();
    timed_json_response(['error' => 'Antwort konnte nicht gespeichert werden'], 500);
}

timed_json_response(['status' => 'ok', 'points' => $points, 'isCorrect' => (bool)$isCorrect]);
