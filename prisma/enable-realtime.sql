-- ============================================
-- KAIRO - Enable Supabase Realtime for Messages
-- Run this script in Supabase SQL Editor
-- ============================================

-- Enable Realtime for the messages table
-- This allows listening to INSERT, UPDATE, and DELETE events

-- Option 1: Add table to existing publication (if supabase_realtime exists)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- If the above fails, try creating a new publication:
-- DROP PUBLICATION IF EXISTS supabase_realtime;
-- CREATE PUBLICATION supabase_realtime FOR TABLE messages;

-- Verify the publication includes the messages table
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================
-- Also enable for conversations table (for future use)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ============================================
-- Enable RLS (Row Level Security) policies for Realtime
-- Note: Supabase Realtime respects RLS policies
-- ============================================

-- For messages table - allow authenticated users to see messages
-- from conversations they have access to (through project membership)
-- This is a simplified policy; adjust based on your security requirements

-- First, check if RLS is enabled on messages
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'messages';

-- If RLS is not enabled and you want to enable it:
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Verify Realtime configuration
-- ============================================
SELECT * FROM pg_publication_tables WHERE tablename = 'messages';
