<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/ably.php';


$action = $_POST['action'] ?? null;
$code   = $_POST['code'] ?? null;

if (!$action || !$code) {
    json_response(['error' => 'Missing action or code'], 400);
}

$quiz = get_quiz_by_code($code);
$questions = load_questions();
$qCount = count($questions['questions']);

if (!$quiz && $action !== 'init_quiz') {
    json_response(['error' => 'Quiz not found'], 404);
}

switch ($action) {
    case 'init_quiz':
        if (!$quiz) {
            $stmt = db()->prepare("INSERT INTO quiz (code, title) VALUES (?, ?)");
            $stmt->execute([$code, $questions['title']]);
        }
        json_response(['status' => 'ok']);
        break;

    case 'start_quiz':
        db()->beginTransaction();

        // Reset quiz state
        $stmt = db()->prepare("
            UPDATE quiz
            SET phase = 'waiting',
                current_question = -1,
                question_start_time = NULL,
                question_end_time = NULL
            WHERE id = ?
        ");
        $stmt->execute([$quiz['id']]);

        // Delete all answers
        $stmt = db()->prepare("DELETE FROM answer WHERE quiz_id = ?");
        $stmt->execute([$quiz['id']]);

        // Reset all scores
        $stmt = db()->prepare("DELETE FROM player WHERE quiz_id = ?");
        $stmt->execute([$quiz['id']]);

        db()->commit();

        // Update quiz array with new values
        $quiz['phase'] = 'waiting';
        $quiz['current_question'] = -1;
        $quiz['question_start_time'] = null;
        $quiz['question_end_time'] = null;

        $state = build_state_array($quiz);
        ably_publish("quiz-$code", "state", $state);


        json_response(['status' => 'ok']);
        break;


    case 'show_question':
        $nextIndex = $quiz['current_question'] + 1;
        if ($nextIndex >= $qCount) {
            json_response(['error' => 'No more questions'], 400);
        }

        $stmt = db()->prepare("
            UPDATE quiz
            SET phase = 'question',
                current_question = ?,
                question_start_time = NULL,
                question_end_time = NULL
            WHERE id = ?
        ");
        $stmt->execute([$nextIndex, $quiz['id']]);

        // Update quiz array with new values
        $quiz['phase'] = 'question';
        $quiz['current_question'] = $nextIndex;
        $quiz['question_start_time'] = null;
        $quiz['question_end_time'] = null;

        $state = build_state_array($quiz);
        ably_publish("quiz-$code", "state", $state);

        json_response(['status' => 'ok', 'questionIndex' => $nextIndex]);
        break;

    case 'show_answers':
        $questions = load_questions();
        $currentIndex = (int)$quiz['current_question'];
        $q = $questions['questions'][$currentIndex];
        $countdown = (int)$q['countdownSeconds'];

        $now = date('Y-m-d H:i:s');
        $endTime = date('Y-m-d H:i:s', strtotime("+$countdown seconds"));
        $stmt = db()->prepare("
            UPDATE quiz
            SET phase = 'answers',
                question_start_time = ?,
                question_end_time = ?
            WHERE id = ?
        ");
        $stmt->execute([$now, $endTime, $quiz['id']]);

        // Update quiz array with new values
        $quiz['phase'] = 'answers';
        $quiz['question_start_time'] = $now;
        $quiz['question_end_time'] = $endTime;

        $state = build_state_array($quiz);
        ably_publish("quiz-$code", "state", $state);

        json_response(['status' => 'ok']);
        break;

    case 'show_standings':
        $stmt = db()->prepare("UPDATE quiz SET phase = 'standings' WHERE id = ?");
        $stmt->execute([$quiz['id']]);

        // Update quiz array with new value
        $quiz['phase'] = 'standings';

        $state = build_state_array($quiz);
        ably_publish("quiz-$code", "state", $state);

        json_response(['status' => 'ok']);
        break;

    case 'finish_quiz':
        $stmt = db()->prepare("UPDATE quiz SET phase = 'finished' WHERE id = ?");
        $stmt->execute([$quiz['id']]);

        // Update quiz array with new value
        $quiz['phase'] = 'finished';

        $state = build_state_array($quiz);
        ably_publish("quiz-$code", "state", $state);

        json_response(['status' => 'ok']);
        break;

    default:
        json_response(['error' => 'Unknown action'], 400);
}
