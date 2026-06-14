# Database Connection — How It All Works

This document explains how your Node.js API connects to the PostgreSQL database, step by step.

---

## The Big Picture

Your app uses **three layers** to talk to the database:

```
Your Code (TypeScript)
        ↓
   Prisma ORM (translates your code into SQL)
        ↓
   PostgreSQL (the actual database, running in Docker)
```

---

## Step 1: PostgreSQL Runs Inside Docker

Your database doesn't run directly on your computer. It runs inside a **Docker container** — think of it as a lightweight virtual machine.

### File: `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16              # Uses PostgreSQL version 16
    container_name: auth-postgres   # Name of the container
    environment:
      POSTGRES_USER: admin          # Database username
      POSTGRES_PASSWORD: admin123   # Database password
      POSTGRES_DB: auth_db          # Database name (created automatically)
    ports:
      - "5433:5432"                 # Maps port 5433 on YOUR machine → port 5432 inside Docker
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Saves data even if container restarts
```

### What each part means:

| Setting | What it does |
|---------|-------------|
| `image: postgres:16` | Downloads and uses the official PostgreSQL 16 image |
| `POSTGRES_USER` | Creates a database user called `admin` |
| `POSTGRES_PASSWORD` | Sets the password to `admin123` |
| `POSTGRES_DB` | Creates a database called `auth_db` when the container first starts |
| `ports: "5433:5432"` | PostgreSQL normally runs on port 5432. We map it to **5433** on your machine so it doesn't conflict with any other PostgreSQL installation |
| `volumes` | Without this, all your data would be lost every time the container stops. This saves it to disk |

### To start the database:

```bash
docker compose up -d
# -d means "detached" — it runs in the background
```

### To stop:

```bash
docker compose down
# Add -v flag to also delete the saved data (volumes)
```

---

## Step 2: The Connection String (DATABASE_URL)

Your app needs to know WHERE the database is and HOW to log in. This is done through a single string called **DATABASE_URL**.

### File: `.env`

```
DATABASE_URL="postgresql://admin:admin123@localhost:5433/auth_db"
```

### Breaking it down:

```
postgresql://admin:admin123@localhost:5433/auth_db
│            │     │         │         │    │
│            │     │         │         │    └── Database name
│            │     │         │         └── Port number (5433, matching docker-compose.yml)
│            │     │         └── Host (localhost = your own machine)
│            │     └── Password
│            └── Username
└── Protocol (type of database)
```

### Important:

- This URL must match EXACTLY what you set in `docker-compose.yml`
- If you change the port/user/password in Docker, you must also change this URL
- The `.env` file is loaded by `dotenv` in your code (see Step 4)

---

## Step 3: Prisma Reads the Connection String

Prisma is your **ORM** (Object-Relational Mapper). It lets you work with the database using TypeScript objects instead of writing raw SQL.

### File: `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"       // We're using PostgreSQL
  url      = env("DATABASE_URL") // Read the URL from .env file
}

generator client {
  provider = "prisma-client-js"  // Generate a TypeScript client we can import
}
```

### What `env("DATABASE_URL")` does:

1. Prisma looks for an environment variable named `DATABASE_URL`
2. It finds it in your `.env` file (because dotenv loads it)
3. It uses that URL to connect to PostgreSQL

---

## Step 4: Your Code Loads Environment Variables

### File: `src/server.ts`

```typescript
import dotenv from "dotenv";
dotenv.config(); // ← This loads ALL variables from .env into process.env
```

After `dotenv.config()` runs, you can access any `.env` variable:

```typescript
process.env.DATABASE_URL   // "postgresql://admin:admin123@localhost:5433/auth_db"
process.env.PORT           // "3001"
process.env.SECRET_KEY     // "Rahul_AI_Assistance"
```

> **Note:** There's a bug in your current `server.ts` — `dotenv.config()` is called AFTER `process.env.PORT` is read. It should be called first. This works by accident because PORT has a fallback (`|| 3001`), but other variables won't be available until `dotenv.config()` runs.

---

## Step 5: Using Prisma Client in Your Code

To actually talk to the database from your code, you create a **Prisma Client** instance:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Now you can do things like:
const user = await prisma.user.create({
  data: {
    firstName: "Rahul",
    lastName: "Kumar",
    email: "rahul@example.com",
    passwordHash: "hashed_password_here",
  },
});

// Find a user
const found = await prisma.user.findUnique({
  where: { email: "rahul@example.com" },
});
```

### How Prisma Client is generated:

When you run `npx prisma generate`, Prisma reads your `schema.prisma` file and generates TypeScript code inside `node_modules/@prisma/client`. This generated code knows about your User model, RefreshToken model, and all their fields.

---

## Step 6: Migrations — Creating Tables

Your `schema.prisma` defines WHAT tables should exist. **Migrations** actually CREATE them in the database.

### File: `prisma/migrations/20260613053111_init/migration.sql`

This file was auto-generated when you ran `npx prisma migrate dev`. It contains the raw SQL that was executed:

```sql
-- Creates the Role enum (USER or ADMIN)
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- Creates the User table
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    ...
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Creates the RefreshToken table with a foreign key to User
CREATE TABLE "public"."RefreshToken" (
    ...
    "userId" TEXT NOT NULL,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- Links RefreshToken → User (deleting a user deletes their tokens too)
ALTER TABLE "public"."RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE;
```

---

## The Complete Flow

Here's what happens when your app starts and makes a database call:

```
1. docker compose up -d
   → PostgreSQL starts inside Docker on port 5433

2. npm run dev
   → Node.js starts your server.ts

3. dotenv.config()
   → Reads .env file, loads DATABASE_URL into process.env

4. new PrismaClient()
   → Prisma reads DATABASE_URL from process.env
   → Opens a connection pool to PostgreSQL

5. prisma.user.findMany()
   → Prisma converts this to: SELECT * FROM "User"
   → Sends the SQL to PostgreSQL via the connection
   → PostgreSQL executes it and returns rows
   → Prisma converts rows back to TypeScript objects
   → You get an array of User objects
```

---

## Common Commands Reference

| Command | What it does |
|---------|-------------|
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL |
| `npx prisma migrate dev` | Create/run new migrations (after changing schema.prisma) |
| `npx prisma generate` | Regenerate the Prisma Client (after changing schema.prisma) |
| `npx prisma studio` | Open a visual database browser at http://localhost:5555 |
| `npx prisma db push` | Push schema changes without creating a migration file (for prototyping) |

---

## Common Errors and Fixes

### "Can't reach database server"

```
Error: P1001: Can't reach database server at `localhost:5433`
```

**Fix:** Your Docker container isn't running. Run `docker compose up -d`.

### "Database does not exist"

```
Error: P1003: Database `auth_db` does not exist
```

**Fix:** The container may have started without creating the DB. Run `docker compose down -v` then `docker compose up -d` to recreate it.

### "Authentication failed"

**Fix:** The username/password in your `.env` doesn't match `docker-compose.yml`. Make sure both have `admin` / `admin123`.

### "Migration failed"

**Fix:** Run `npx prisma migrate reset` to drop all tables and re-run all migrations. Warning: this deletes all data.
