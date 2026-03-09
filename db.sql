CREATE DATABASE <db_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE <db_name>;

CREATE TABLE quiz (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  current_question INT DEFAULT -1,
  phase ENUM('waiting','question','answers','standings','finished') NOT NULL DEFAULT 'waiting',
  question_start_time DATETIME NULL,
  question_end_time DATETIME NULL,
  question_image_index INT DEFAULT 0,
  answer_image_index INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  nickname VARCHAR(64) NOT NULL,
  cookie_token VARCHAR(64) NOT NULL,
  score INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (quiz_id, nickname),
  UNIQUE (cookie_token),
  FOREIGN KEY (quiz_id) REFERENCES quiz(id)
);

CREATE TABLE answer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  player_id INT NOT NULL,
  question_index INT NOT NULL,
  chosen_option INT NOT NULL,
  is_correct TINYINT(1) NOT NULL,
  time_ms INT NOT NULL,
  points INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (quiz_id, player_id, question_index),
  FOREIGN KEY (quiz_id) REFERENCES quiz(id),
  FOREIGN KEY (player_id) REFERENCES player(id)
);
