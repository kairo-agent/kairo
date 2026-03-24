-- AlterEnum: Add platform-specific values to LeadSource
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'facebook_ads';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'instagram_ads';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'tiktok_ads';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'tiktok_organic';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'google_ads';
