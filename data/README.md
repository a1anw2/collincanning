Local runtime data for Cannery (not committed to git).

```bash
cp data/.env.example data/.env
# Edit data/.env — set OPENROUTER_API_KEY and admin password
npm run db:init
```

- **`.env`** — secrets and config  
- **`cannery.db`** — SQLite database (created by `npm run db:init`)
