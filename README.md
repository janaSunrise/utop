<div align="center">

# UTop

A modern, faster alternative to VTOP. A cleaner way to check your VIT academics.

</div>

---

UTop gives you a clean, fast interface to access your VIT academic data. It authenticates with VTOP on your behalf and presents your information in a modern UI — no more wrestling with slow load times and clunky navigation.

## Features

| Feature | Description |
|---------|-------------|
| **Attendance** | View attendance percentages at a glance with low-attendance warnings |
| **Marks** | Check CAT, quiz, and assignment scores across all courses |
| **Grades** | Semester-wise grade history with SGPA/CGPA tracking |
| **Curriculum** | Track degree progress organized by category |
| **Profile** | Academic info, proctor details, and more |

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) v1.0+ or Node.js 18+

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

Open [localhost:3000](http://localhost:3000) and log in with your VTOP credentials.

## How It Works

1. You enter your VTOP credentials
2. UTop creates an authenticated session with VTOP
3. Pages are scraped and parsed into structured data
4. Data is displayed in a clean, responsive UI

**Privacy:** Sessions are encrypted and stored as cookies. Nothing is saved on any server. Your credentials are only used to authenticate with VTOP.

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **UI:** React 19, Tailwind CSS 4
- **Data Fetching:** TanStack Query
- **Parsing:** Cheerio

## License

MIT. see [LICENSE](LICENSE) for details.

---

<sub>
This is an unofficial project and is not affiliated with VIT University. This is an
unofficial project. Use at your own discretion. Your credentials are only used to
authenticate with VTOP and are not stored or transmitted elsewhere.
</sub>
