<?php
require_once __DIR__ . '/../config.php';

function ably_publish($channel, $event, $data) {
    global $ABLY_API_KEY;

    $payload = json_encode([
        'name' => $event,
        'data' => $data
    ]);

    $ch = curl_init("https://rest.ably.io/channels/$channel/messages");
    curl_setopt($ch, CURLOPT_USERPWD, $ABLY_API_KEY);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);
}
