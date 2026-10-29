<?php
// Приём заявок с bielendaprint.com и отправка на почту.
// Разместить на хостинге ps.kz (Plesk) в корне поддомена form.bielendaprint.com.

const TO = 'info@bielendaprint.com';
const FROM = 'info@bielendaprint.com';
const ORIGINS = ['https://bielendaprint.com', 'https://www.bielendaprint.com', 'http://bielendaprint.com', 'http://www.bielendaprint.com'];
const RATE_LIMIT = 5;        // заявок
const RATE_WINDOW = 600;     // за 10 минут с одного IP

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
}
header('Content-Type: application/json; charset=utf-8');

function reply($ok, $message = '', $code = 200) {
    http_response_code($code);
    echo json_encode(['success' => $ok ? 'true' : 'false', 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') reply(true);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(false, 'Method not allowed', 405);
if (!in_array($origin, ORIGINS, true)) reply(false, 'Forbidden origin', 403);

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) reply(false, 'Bad request', 400);
if (!empty($data['_honey'])) reply(true); // бот: делаем вид, что всё хорошо

// Простое ограничение частоты по IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$rateFile = sys_get_temp_dir() . '/bielenda_rate_' . md5($ip);
$hits = array_filter(array_map('intval', @file($rateFile) ?: []), fn($t) => $t > time() - RATE_WINDOW);
if (count($hits) >= RATE_LIMIT) reply(false, 'Too many requests', 429);
$hits[] = time();
@file_put_contents($rateFile, implode("\n", $hits));

$clean = fn($v) => trim(mb_substr(str_replace(["\r", "\0"], '', (string)$v), 0, 3000));
$subject = $clean($data['_subject'] ?? 'Заявка с сайта bielendaprint.com');
$subject = str_replace("\n", ' ', mb_substr($subject, 0, 200));

$lines = [];
$replyTo = '';
foreach ($data as $k => $v) {
    if (!is_string($k) || $k === '' || $k[0] === '_' || is_array($v)) continue;
    $k = $clean($k); $v = $clean($v);
    if ($v === '') continue;
    $lines[] = $k . ': ' . $v;
    if (!$replyTo && filter_var($v, FILTER_VALIDATE_EMAIL)) $replyTo = $v;
}
if (!$lines) reply(false, 'Empty form', 400);
$lines[] = '';
$lines[] = 'IP: ' . $ip;
$lines[] = 'Время: ' . date('d.m.Y H:i');

$headers = [
    'From: =?UTF-8?B?' . base64_encode('Сайт Bielenda') . '?= <' . FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
if ($replyTo) $headers[] = 'Reply-To: ' . $replyTo;

$ok = mail(TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', implode("\n", $lines), implode("\r\n", $headers), '-f' . FROM);
$ok ? reply(true) : reply(false, 'mail() failed', 500);
