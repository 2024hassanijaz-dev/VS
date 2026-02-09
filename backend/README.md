# Moodle Leaderboard Backend

This Node.js service fetches leaderboard data from Moodle Web Services and exposes it at `/api/leaderboard`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` based on `.env.example` and set your Moodle token.

3. Start the server:

```bash
npm start
```

## Environment variables

- `PORT`: Server port (default 3000)
- `MOODLE_BASE_URL`: Moodle base URL (e.g. https://leaguesofcode.space)
- `MOODLE_TOKEN`: Web services token
- `CACHE_TTL_SECONDS`: Cache duration (default 600 = 10 minutes)
- `LOGO_FOLDER`: Local logo folder, defaults to `public/logos`
- `USE_MOCK`: If `true`, returns mock data even if Moodle is unavailable

## Notes

- School is mapped to Moodle category.
- Task completed = passed quiz attempt.
- Logos should be named by category shortname (recommended).

