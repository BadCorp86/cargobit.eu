# CargoBit PostgreSQL Preview Setup

Use this when local admin workflows should persist real records instead of using preview fallbacks.

## One-command setup

```bash
npm run db:local:sync
```

The command:

- creates a local PostgreSQL database named `cargobit_dev` when it does not exist,
- updates only `DATABASE_URL` in `.env`,
- runs `prisma db push`,
- seeds `dispute_1` with a real transport, payment, dispute messages and attachment metadata.

## Default connection

```bash
postgresql://<mac-user>@localhost:5432/cargobit_dev?schema=public
```

Override when needed:

```bash
CARGOBIT_LOCAL_DB=cargobit_dev npm run db:local:sync
CARGOBIT_LOCAL_DB_USER=postgres npm run db:local:sync
```

## Test URL

```text
http://localhost:3001/admin/disputes/dispute_1
```

After changing `.env`, restart the local Next.js dev server so it picks up the new database URL.
