# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Express.js REST API written in TypeScript, backed by PostgreSQL via Prisma ORM. Implements auth (register, login, JWT access + refresh token rotation). No test framework, linter, or formatter is configured yet.

## Commands

```bash
# Development (hot-reload)
npm run dev

# Build and run production
npm run build
npm start

# Database (requires Docker)
docker compose up -d          # Start PostgreSQL on localhost:5433
npx prisma migrate dev        # Run migrations
npx prisma generate           # Regenerate Prisma client after schema changes
npx prisma studio             # Browse database in browser

# Type-check without emitting
npx tsc --noEmit
```

No test runner or lint command exists yet.

## Environment Variables

Defined in `.env` (not committed — copy from below). Prisma reads `DATABASE_URL` directly; the app loads the rest via `dotenv`.

```
PORT=3001
DATABASE_URL="postgresql://admin:admin123@localhost:5433/auth_db"
JWT_ACCESS_SECRET="<secret>"
JWT_REFRESH_SECRET="<secret>"
```

Docker Compose credentials: user `admin`, password `admin123`, database `auth_db`, host port **5433**.

## Architecture

**Layered request flow:** Route -> Zod validation middleware -> Controller -> Service -> Repository -> Prisma

- **Entry point:** `src/server.ts` -> dotenv, starts Express on PORT (default 3001)
- **App setup:** `src/app.ts` -> CORS, Helmet, JSON parsing, route mounting at `/api/auth`, error handler
- **Routes:** `src/routes/authRoutes.ts` -> attaches Zod validation + controller per endpoint
- **Controllers:** `src/controllers/` -> parse request, call service, send response; delegate errors via `next()`
- **Services:** `src/services/` -> business logic (duplicate checks, password hashing, token issuance); return sanitized data (no passwordHash)
- **Repositories:** `src/repositories/` -> thin Prisma query wrappers (exported functions, not classes)
- **Validation:** `src/validators/authValidator.ts` -> Zod schemas; `src/middleware/validate.ts` -> calls `schema.parse(req.body)`
- **Error handling:** `src/utils/errors.ts` -> `AppError` base class + `BadRequestError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`; `src/middleware/errorHandler.ts` -> catches ZodError (400), AppError (uses statusCode), unknown (500)
- **Database:** `src/config/prisma.ts` -> singleton PrismaClient; schema in `prisma/schema.prisma`

## API Endpoints

| Method | Path                   | Body                                              | Description             |
|--------|------------------------|----------------------------------------------------|-------------------------|
| POST   | `/api/auth/register`   | `{ firstName, lastName, email, password }`         | Create account          |
| POST   | `/api/auth/login`      | `{ email, password }`                              | Returns access + refresh tokens |
| POST   | `/api/auth/refresh`    | `{ refreshToken }`                                 | Rotate refresh token    |
| GET    | `/health`              | —                                                  | Health check            |

## Token Strategy

- Access token: JWT signed with `JWT_ACCESS_SECRET`, 15-minute expiry, payload `{ userid, role }`
- Refresh token: 40 random bytes (hex), SHA-256 hashed before storage in `RefreshToken` table; raw value sent to client
- On refresh: old token is revoked (`revoked=true`), new token pair issued (rotation)

## DTOs and Validation Types

Two parallel DTO definitions exist:
- `src/dto/` -> manual TypeScript interfaces (used as service-layer input types)
- `src/validators/authValidator.ts` -> Zod-inferred types (`RegisterDto`, `LoginDTO`, `RefreshDto`) exported alongside schemas

The login flow uses the Zod-inferred `LoginDTO` directly in the service; register uses the manual `RegisterDto` interface. When adding new endpoints, prefer Zod-inferred types to avoid drift.

## Key Decisions

- Express v5 (not v4) — native async error handling
- Zod v4 for request validation (imported from `"zod"`)
- bcryptjs (not bcrypt) for password hashing — both packages are installed but only bcryptjs is used
- PostgreSQL 16 via Docker Compose, host port **5433** (not default 5432)
- TypeScript strict mode, CommonJS output, ES2022 target
- Repositories use exported functions (not class-based pattern)
- All API responses follow `{ success: boolean, data?: ..., message?: ..., errors?: ... }` shape

## Prisma Schema (Models)

- **User:** `id` (UUID), `firstName`, `lastName`, `email` (unique + indexed), `passwordHash`, `role` (USER/ADMIN enum), `isActive`, timestamps
- **RefreshToken:** `id` (UUID), `token` (unique, stores SHA-256 hash), `revoked`, `expiresAt`, `userId` (cascade delete)
