# kahootino

Interactive Quiz for Multiple Players

## Installation

The backend requires PHP and a MySQL database. Once that's available install with:

1. Configure your PHP backend in [config.local.php](config.local.php)
2. Add icons to folder [public/icons](./public/icons/) \
  Expected files: `favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png`, `site.webmanifest`
3. Define the questions for the quiz in [data/questions.json](./data/questions.json)
4. Upload `api`, `data`, `public` folders (and their contents) and `config.php` and `config.local.php`
5. Initialize the MySQL database using [db.sql](./db.sql)

## Running the quiz

After a successful installation, the quiz can be run. Three modes are available: host, presentation, player.

### Host mode

The host mode (accessed on the webserver at `.../public/host.php`) is used to control the quiz. That's
the quiz-operator. In host mode the operator chooses to step through the questions, reveals answers, etc.

### Presentation mode

The presentation mode (`.../public/presentation.php`) can be used to show on a screen visible to all participants
the quiz, namely the images. This is purely non-interactive.

### Player mode

Player mode (`.../public/player.php`) is meant for players joining the quiz. Once the quiz is started (i.e.
the host has reset the quiz), players can join with their nicknames. As soon as the operator has chosen to
show the answers they also pop-up on the players' screens. They select their answers before the countdown
expired.
