# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Express.js REST API written in TypeScript, backed by PostgreSQL via Prisma ORM. Auth system (registration) is implemented; login, token refresh, and protected routes are not yet built.

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
```

## Architecture

**Layered request flow:** Route → Zod validation middleware → Controller → Service → Repository → Prisma

- **Entry point:** `src/server.ts` → loads env via dotenv, starts Express on PORT (default 3001)
- **App setup:** `src/app.ts` → Express instance with CORS, Helmet, JSON parsing, error handler, route mounting at `/api/auth`
- **Routes:** `src/routes/` → define endpoints and attach validation + controller
- **Controllers:** `src/controllers/` → parse request, call service, send response; delegate errors to `next()`
- **Services:** `src/services/` → business logic (duplicate checks, password hashing); return sanitized data (no passwordHash)
- **Repositories:** `src/repositories/` → thin Prisma query wrappers (exported functions, not classes)
- **Validation:** `src/validators/` → Zod schemas; `src/middleware/validate.ts` → middleware that calls `schema.parse(req.body)` (throws ZodError on failure)
- **DTOs:** `src/dto/` → TypeScript interfaces for service-layer input; Zod-inferred types in validators
- **Error handling:** `src/utils/errors.ts` → `AppError` base class with subclasses (`BadRequestError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`); `src/middleware/errorHandler.ts` → catches ZodError (400), AppError (uses statusCode), and unknown errors (500)
- **Database:** `src/config/prisma.ts` → singleton PrismaClient; schema in `prisma/schema.prisma`
- **Health check:** `GET /health` defined inline in `app.ts`

## Key Decisions

- Express v5 (not v4) — uses native async error handling
- Zod for request validation (Zod v4, imported from `"zod"`)
- bcryptjs (not bcrypt) for password hashing; jsonwebtoken for JWT (access + refresh token pattern planned)
- PostgreSQL 16 via Docker Compose, mapped to host port **5433** (not default 5432)
- TypeScript strict mode, CommonJS output, ES2022 target
- Repositories use exported functions (not class-based pattern)
- All API responses follow `{ success: boolean, data?: ..., message?: ..., errors?: ... }` shape
