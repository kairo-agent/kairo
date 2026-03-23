'use server';

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'media';
const MAX_AGE_HOURS = 24;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use service role for admin access to storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - MAX_AGE_HOURS);

    // Get all storage paths from agent_media — these are permanent and must NOT be deleted
    // FAILSAFE: If this query fails, abort cleanup entirely to prevent deleting protected files
    const { data: protectedRows, error: protectedError } = await supabase
      .from('agent_media')
      .select('storage_path');

    if (protectedError) {
      console.error('[Cleanup] ABORT — failed to fetch agent_media protected paths:', protectedError);
      return NextResponse.json(
        { error: 'Cannot proceed: failed to load protected paths from agent_media' },
        { status: 500 }
      );
    }

    if (!protectedRows) {
      console.error('[Cleanup] ABORT — agent_media query returned null (unexpected)');
      return NextResponse.json(
        { error: 'Cannot proceed: agent_media query returned null' },
        { status: 500 }
      );
    }

    const protectedPaths = new Set(
      protectedRows.map((r: { storage_path: string }) => r.storage_path)
    );
    console.log(`[Cleanup] Loaded ${protectedPaths.size} protected agent_media paths`);

    // List all files in bucket
    const { data: folders, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1000 });

    if (listError) {
      console.error('Error listing folders:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    let deletedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Iterate through project folders
    for (const folder of folders || []) {
      if (!folder.name) continue;

      // List files in each project folder recursively
      const oldFiles = await getOldFiles(supabase, folder.name, cutoffDate);

      // Filter out files that belong to agent_media (permanent)
      const filesToDelete = oldFiles.filter((path) => !protectedPaths.has(path));
      skippedCount += oldFiles.length - filesToDelete.length;

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filesToDelete);

        if (deleteError) {
          errors.push(`Error deleting files in ${folder.name}: ${deleteError.message}`);
        } else {
          deletedCount += filesToDelete.length;
        }
      }
    }

    console.log(`[Cleanup] Deleted ${deletedCount} files older than ${MAX_AGE_HOURS}h (skipped ${skippedCount} agent_media files)`);

    return NextResponse.json({
      success: true,
      deletedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getOldFiles(
  supabase: SupabaseClient,
  projectId: string,
  cutoffDate: Date
): Promise<string[]> {
  const oldFiles: string[] = [];

  // List year folders
  const { data: years } = await supabase.storage
    .from(BUCKET_NAME)
    .list(projectId, { limit: 100 });

  for (const year of years || []) {
    if (!year.name) continue;
    const yearPath = `${projectId}/${year.name}`;

    // List month folders
    const { data: months } = await supabase.storage
      .from(BUCKET_NAME)
      .list(yearPath, { limit: 100 });

    for (const month of months || []) {
      if (!month.name) continue;
      const monthPath = `${yearPath}/${month.name}`;

      // List files
      const { data: files } = await supabase.storage
        .from(BUCKET_NAME)
        .list(monthPath, { limit: 1000 });

      for (const file of files || []) {
        if (!file.name || !file.created_at) continue;

        const fileDate = new Date(file.created_at);
        if (fileDate < cutoffDate) {
          oldFiles.push(`${monthPath}/${file.name}`);
        }
      }
    }
  }

  return oldFiles;
}
