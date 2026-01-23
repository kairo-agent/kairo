-- Add timezone and locale fields to organizations
-- These are the organization defaults that users inherit

ALTER TABLE "organizations" ADD COLUMN "defaultTimezone" TEXT NOT NULL DEFAULT 'America/Lima';
ALTER TABLE "organizations" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'es-PE';

-- Add timezone and locale fields to users (nullable = use org default or browser)
ALTER TABLE "users" ADD COLUMN "timezone" TEXT;
ALTER TABLE "users" ADD COLUMN "locale" TEXT;

-- Remove timezone/language from preferences JSON since they're now separate columns
-- Note: This doesn't modify the preferences column, just documents that new users
-- will have simplified preferences (theme, displayCurrency only)
