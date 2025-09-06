# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `pnpm dev` - Start development server with turbopack
- `pnpm build` - Build production application
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint checks

### Database Commands
- `pnpm db:generate` - Generate database schema migrations
- `pnpm db:migrate` - Apply database migrations
- `pnpm db:studio` - Open Drizzle Studio for database management
- `pnpm db:push` - Push schema changes to database

### Analysis and Docker
- `pnpm analyze` - Bundle analysis with webpack-bundle-analyzer
- `pnpm docker:build` - Build Docker image

## Tech Stack & Architecture

### Core Technologies
- **Next.js 15** with App Router and TypeScript
- **Tailwind CSS** with Shadcn UI components
- **Drizzle ORM** with PostgreSQL database
- **NextAuth.js** for authentication (Google, GitHub, One-tap)
- **next-intl** for internationalization (en/zh locales)
- **Stripe** for payment processing

### Key Architecture Patterns

#### Multi-language Support
- Locale-based routing with `src/app/[locale]/` structure
- Page-specific translations in `src/i18n/pages/`
- Global messages in `src/i18n/messages/`

#### Authentication Flow
- NextAuth.js configuration in `src/auth/config.ts`
- Support for multiple providers (Google, GitHub, One-tap)
- Custom JWT and session handling with user persistence

#### Database Layer
- Drizzle ORM with PostgreSQL (7 tables: users, orders, credits, apikeys, posts, affiliates, feedbacks)
- Migrations in `src/db/migrations/`
- Schema definitions in `src/db/schema.ts`
- Database config loads from `.env.development`, `.env.local`, and `.env`
- Key business logic: credit system, affiliate program (20% commission), API key management

#### API Structure
- Route handlers in `src/app/api/`
- Text-to-image generation with FAL API (`src/app/api/text2image/route.ts`)
- Stripe payment integration
- Database operations for users, orders, credits

#### AI SDK Integration
- Custom AI SDK providers in `src/aisdk/` with modular provider pattern
- Kling provider: complete implementation with JWT authentication
- Video generation: text-to-video with async polling (30-second intervals)
- Image generation: FAL API with Flux Pro model, 5-minute timeout with 60 attempts
- Extensible provider system with TypeScript interfaces

#### Route Group Architecture
- `(admin)` - Admin dashboard with user/order/content management, requires admin email whitelist
- `(default)` - Public and authenticated pages with header/footer layout
  - `(console)` - Nested user dashboard for credits, orders, API keys, requires authentication
- `(legal)` - Legal pages (privacy, terms) with MDX content, no locale routing
- Middleware handles 2 locales (en/zh) with "as-needed" prefix strategy

### Component Organization
- **blocks/**: Landing page sections (hero, features, pricing, etc.)
- **ui/**: Reusable Shadcn UI components
- **dashboard/**: Admin dashboard components
- **console/**: User console components

### Business Logic
- **models/**: Data models and database operations
- **services/**: Business logic layer
- **types/**: TypeScript definitions organized by feature

## Environment Setup

Required environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth.js secret
- `FAL_KEY` - For text-to-image and image-to-image API (not in .env.example but required)
- `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` - For Kling video generation provider (not in .env.example but required)
- `STRIPE_*` - Payment processing keys (PUBLIC_KEY, PRIVATE_KEY, WEBHOOK_SECRET)
- `AUTH_GOOGLE_*` / `AUTH_GITHUB_*` - OAuth provider credentials
- `STORAGE_*` - AWS S3 compatible storage configuration
- `NEXT_PUBLIC_*` - Analytics (Google Analytics, OpenPanel, Plausible) and app configuration
- `ADMIN_EMAILS` - Comma-separated list of admin email addresses

## Development Workflow

1. Copy `.env.example` to `.env.development`
2. Configure database and external service credentials
3. Run `pnpm db:generate` and `pnpm db:migrate` for database setup
4. Use `pnpm dev` for development with hot reload
5. Test payment flows require Stripe webhook configuration

## Special Features

### AI Generation Features
- **Text-to-Image**: Integrated with FAL API (Flux Pro model)
- **Image-to-Image**: Enhancement and transformation capabilities
- **Video Generation**: Kling provider for text-to-video generation
- Async task processing with polling for all generation types
- Located in `src/app/api/text2image/route.ts` and `src/aisdk/`

### Admin Dashboard
- User management, order tracking, feedback system
- Located in `src/app/[locale]/(admin)/`

### Internationalization
- 2 supported locales: en, zh (configured for 9 locales in middleware but only 2 implemented)
- Dynamic locale detection with "as-needed" prefix strategy
- SEO-friendly alternate language links
- Separate translation files for different page sections
- Middleware excludes API routes, static files, and legal pages from locale handling

## Testing

Currently no testing framework is configured. To add testing:
- Consider Jest or Vitest for unit testing
- Consider Playwright or Cypress for E2E testing
- Add test scripts to package.json

## Coding Standards

From `.cursorrules`:
- Use functional React components in CamelCase
- Prefer React Context for state management
- Use sonner for toast notifications
- Maintain consistent internationalization structure
- Keep components modular and reusable
- Follow responsive design with Tailwind CSS and Shadcn UI