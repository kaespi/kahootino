# Kahootino Agents Guide

This AGENTS.md file provides comprehensive guidance for coding AI agents working with this codebase.

## Project

This project, Kahootino, is a live interactive multiplayer quiz to be played in the browser.
It's inspired by Kahoot.

## Project Structure

- **Technology:**
  - Backend: PHP and MySQL database
  - Frontend: HTML, CSS, and Javascript
  - Service for SSE (server-sent events): [Ably](https://www.ably.com)
- **File Structure:**
  - `/api`: Backend endpoints
  - `/data`: Quiz data (questions, images)
  - `/public`: Frontend (host, presentation, player)

## Game Play

During the quiz there are three roles:

- **Host:** the host operates the quiz and advances between questions, answers, and standings
- **Presentation:** the presentation mode is for visualizing the quiz to a broad audience, e.g.
  using a projector, TV, ...
- **Player:** participants of the quiz

### Play Sequence

1. Host starts the quiz
2. Players join on their phone by choosing their unique nicknames
3. Host advances to the next question (which is introduced with text and images)
4. Host advances to the answers, which displays on players' browsers the answers they can select and a countdown starts
5. After the countdown has ended no more answers are accepted
6. Host advances to reveal the correct answer
7. Host advances to the standings

The steps 3-7 then repeat as many times as there are questions.

### General Remarks

- The faster the correct answer is submitted to more points a player receives
- The player's frontend shall be such that he can immeditaly re-enter the game had he closed and re-opend the browser or reloaded the page
