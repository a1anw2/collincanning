# Cannery Implementation Plan

Implemented per [docs/executive-sim-plan.md](../docs/executive-sim-plan.md) with gap fills for orchestrator, broker, reactions, mentions, virtualization, and `GET /api/workspace/active`.

See full plan history in the Cursor plans folder. **Status: implemented.**

## Quick start

```bash
cp .env.example .env   # OPENROUTER_API_KEY required
npm install && npm run db:init
npm run dev
```

- Viewer: http://localhost:5173
- Admin: http://localhost:5173/admin (basic auth from `.env`)
