<?php
// load credentials from config.local.php
require_once __DIR__ . '/config.local.php';

function db() {
    static $pdo = null;
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
    if ($pdo === null) {
        $pdo = new PDO(
            "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
            $DB_USER,
            $DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    }
    return $pdo;
}

function load_questions() {
    $json = file_get_contents(__DIR__ . '/data/questions.json');
    return json_decode($json, true);
}

function get_quiz_by_code($code) {
    $stmt = db()->prepare("SELECT * FROM quiz WHERE code = ?");
    $stmt->execute([$code]);
    return $stmt->fetch();
}

function json_response($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Build the state array used by state.php and state_sse.php
 */
function build_state_array($quiz, $token = null) {
    $questions = load_questions();
    $currentIndex = (int)$quiz['current_question'];
    $currentQuestion = null;

    if ($currentIndex >= 0 && $currentIndex < count($questions['questions'])) {
        $q = $questions['questions'][$currentIndex];
        $currentQuestion = [
            'text'             => $q['text'],
            'image'            => $q['image'],
            'answers'          => $q['answers'],
            'countdownSeconds' => (int)$q['countdownSeconds'],
            'correctIndex'     => (int)$q['correctIndex']
        ];
    }

    $player = null;
    $hasAnswered = false;

    if ($token) {
        $stmt = db()->prepare("SELECT * FROM player WHERE quiz_id = ? AND cookie_token = ?");
        $stmt->execute([$quiz['id'], $token]);
        $player = $stmt->fetch();

        if ($player && $currentIndex >= 0) {
            $stmt = db()->prepare("SELECT id FROM answer WHERE quiz_id = ? AND player_id = ? AND question_index = ?");
            $stmt->execute([$quiz['id'], $player['id'], $currentIndex]);
            $hasAnswered = (bool)$stmt->fetch();
        }
    }

    $standings = null;
    if (in_array($quiz['phase'], ['standings', 'finished'])) {
        $stmt = db()->prepare("SELECT nickname, score FROM player WHERE quiz_id = ? ORDER BY score DESC, created_at ASC");
        $stmt->execute([$quiz['id']]);
        $standings = $stmt->fetchAll();
    }

    return [
        'phase'             => $quiz['phase'],
        'questionIndex'     => $currentIndex,
        'question'          => $currentQuestion,
        'serverTime'        => date('c'),
        'questionStartTime' => $quiz['question_start_time'],
        'questionEndTime'   => $quiz['question_end_time'],
        'hasAnswered'       => $hasAnswered,
        'standings'         => $standings,
    ];
}
