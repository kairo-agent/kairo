-- ============================================
-- KAIRO - pg_cron: Follow-up Due Notifications
-- Run this in Supabase SQL Editor AFTER the notifications table is created
-- ============================================

-- Step 1: Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Unschedule existing job (if updating)
-- SELECT cron.unschedule('create-followup-notifications');

-- Step 3: Create the function that generates follow-up notifications
-- Bell notifications are inserted directly (picked up by Supabase Realtime).
-- Email + Push are sent via pg_net HTTP call to the Vercel endpoint.
--
-- IMPORTANT: Replace <CRON_SECRET> with the actual value from Vercel env vars.
CREATE OR REPLACE FUNCTION create_followup_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_record RECORD;
  member_record RECORD;
  leads_payload jsonb := '[]'::jsonb;
  lead_entry jsonb;
BEGIN
  -- Find leads with follow-ups that are due (within last 5 minutes window)
  FOR lead_record IN
    SELECT l.id, l."firstName", l."lastName", l."projectId",
           l."nextFollowUpAt", p."organizationId"
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
    -- Build lead entry for the HTTP payload
    lead_entry := jsonb_build_object(
      'leadId', lead_record.id,
      'leadName', substring(lead_record."firstName" from 1 for 50),
      'projectId', lead_record."projectId",
      'organizationId', lead_record."organizationId",
      'scheduledAt', lead_record."nextFollowUpAt"
    );
    leads_payload := leads_payload || jsonb_build_array(lead_entry);

    -- Notify all project members with relevant roles (bell notification)
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

  -- If any follow-ups were found, call the API for email + push notifications
  -- URL and secret hardcoded (Supabase free tier cannot use ALTER DATABASE SET)
  IF jsonb_array_length(leads_payload) > 0 THEN
    PERFORM net.http_post(
      url := 'https://app.kairoagent.com/api/cron/followup-notify',
      body := jsonb_build_object('leads', leads_payload),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <CRON_SECRET>'
      )
    );
  END IF;
END;
$$;

-- Step 4: Schedule the job to run every minute
SELECT cron.schedule(
  'create-followup-notifications',
  '* * * * *',
  $$SELECT create_followup_notifications()$$
);

-- ============================================
-- To verify the job is scheduled:
-- SELECT * FROM cron.job;
--
-- To unschedule (if updating):
-- SELECT cron.unschedule('create-followup-notifications');
--
-- To test manually:
-- SELECT create_followup_notifications();
-- ============================================
