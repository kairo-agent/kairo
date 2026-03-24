-- AlterEnum: Add organic variants for Facebook and Instagram
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'facebook_organic';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'instagram_organic';
