-- ============================================
-- KAIRO - pg_cron: Follow-up Due Notifications
-- Run this in Supabase SQL Editor AFTER the notifications table is created
-- ============================================

-- Step 1: Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Create the function that generates follow-up notifications
CREATE OR REPLACE FUNCTION create_followup_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_record RECORD;
  member_record RECORD;
BEGIN
  -- Find leads with follow-ups that are due (within last 5 minutes window)
  FOR lead_record IN
    SELECT l.id, l."firstName", l."lastName", l."projectId",
           p."organizationId"
    FROM leads l
    JOIN projects p ON l."projectId" = p.id
    WHERE l."nextFollowUpAt" <= NOW()
      AND l."nextFollowUpAt" > NOW() - INTERVAL '5 minutes'
      AND l."archivedAt" IS NULL
      AND NOT EXISTS (
        -- Idempotency: don't create duplicate notifications
        SELECT 1 FROM notifications n
        WHERE (n.metadata->>'leadId')::text = l.id
          AND n.type = 'follow_up_due'
          AND n."createdAt" > NOW() - INTERVAL '10 minutes'
      )
  LOOP
    -- Notify all project members with relevant roles
    FOR member_record IN
      SELECT pm."userId"
      FROM project_members pm
      WHERE pm."projectId" = lead_record."projectId"
        AND pm.role IN ('admin', 'manager', 'agent')
    LOOP
      INSERT INTO notifications ("id", "userId", "organizationId", "projectId", "type", "title", "message", "metadata", "source", "expiresAt", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        member_record."userId",
        lead_record."organizationId",
        lead_record."projectId",
        'follow_up_due',
        'Seguimiento pendiente',
        'Tienes un seguimiento programado con ' || substring(lead_record."firstName" from 1 for 50),
        jsonb_build_object(
          'leadId', lead_record.id,
          'leadName', substring(lead_record."firstName" from 1 for 50)
        ),
        'pg_cron',
        NOW() + INTERVAL '30 days',
        NOW()
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Step 3: Schedule the job to run every minute
SELECT cron.schedule(
  'create-followup-notifications',
  '* * * * *',
  $$SELECT create_followup_notifications()$$
);

-- ============================================
-- To verify the job is scheduled:
-- SELECT * FROM cron.job;
--
-- To unschedule:
-- SELECT cron.unschedule('create-followup-notifications');
--
-- To test manually:
-- SELECT create_followup_notifications();
-- ============================================
