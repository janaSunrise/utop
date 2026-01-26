# UTop

A cleaner way to check your VIT academics. Logs into VTOP on your behalf and presents your data in a modern, fast interface.

## Features

- **Attendance** — See your attendance percentages at a glance, with warnings for low attendance
- **Marks** — View CAT, quiz, and assignment scores across all courses
- **Grades** — Semester-wise grade history with SGPA/CGPA tracking
- **Curriculum** — Track your degree progress by category
- **Profile** — Your academic info, proctor details, and more

## Prerequisites

- [Bun](https://bun.sh) (v1.0+) or Node.js 18+

## Running locally

```bash
bun install
bun dev
```

Then open [localhost:3000](http://localhost:3000).

## How it works

Your VTOP credentials are used to create an authenticated session. The app scrapes VTOP pages and parses the HTML to extract your data. Sessions are encrypted and stored as cookies — nothing is saved on any server.

## LICENSE

MIT License. See LICENSE file for details.

## Disclaimer

This is an unofficial project. Use at your own discretion. Your credentials are only used to authenticate with VTOP and are not stored or transmitted elsewhere.
