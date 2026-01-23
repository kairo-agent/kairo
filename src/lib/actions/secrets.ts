'use server';

/**
 * Server Actions for Project Secrets Management
 *
 * Provides secure CRUD operations for encrypted secrets stored per project.
 * All operations are audited and require appropriate permissions.
 *
 * @see src/lib/crypto/secrets.ts for encryption implementation
 */

import { prisma } from '@/lib/supabase/server';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secrets';
import { getCurrentUser } from '@/lib/auth-helpers';
import { headers } from 'next/headers';

// Valid secret keys - extend as needed
export type SecretKey =
  | 'whatsapp_access_token'
  | 'whatsapp_phone_number_id'
  | 'whatsapp_business_account_id'
  | 'openai_api_key'
  | 'anthropic_api_key';

interface SetSecretResult {
  success: boolean;
  error?: string;
}

interface GetSecretResult {
  success: boolean;
  value?: string;
  error?: string;
}

interface HasSecretsResult {
  success: boolean;
  configured: Record<SecretKey, boolean>;
  error?: string;
}

/**
 * Stores an encrypted secret for a project
 *
 * @param projectId - The project to store the secret for
 * @param key - The secret key identifier
 * @param value - The plaintext secret value (will be encrypted)
 * @returns Success status
 */
export async function setProjectSecret(
  projectId: string,
  key: SecretKey,
  value: string
): Promise<SetSecretResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    // Verify user has admin access to this project
    const hasAccess = await verifyProjectAdminAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    // Encrypt the value
    const encrypted = encryptSecret(value);

    // Upsert the secret (update if exists, create if not)
    await prisma.projectSecret.upsert({
      where: {
        projectId_key: { projectId, key },
      },
      update: {
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        key,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
    });

    // Audit log
    await logSecretAccess(projectId, key, user.userId, 'write');

    return { success: true };
  } catch (error) {
    console.error('Failed to set project secret:', error);
    return { success: false, error: 'Error interno al guardar secreto' };
  }
}

/**
 * Retrieves and decrypts a project secret
 * INTERNAL USE ONLY - use with caution, never expose to client
 *
 * @param projectId - The project ID
 * @param key - The secret key identifier
 * @returns Decrypted secret value or null
 */
export async function getProjectSecret(
  projectId: string,
  key: SecretKey
): Promise<string | null> {
  try {
    const secret = await prisma.projectSecret.findUnique({
      where: {
        projectId_key: { projectId, key },
      },
    });

    if (!secret) {
      return null;
    }

    // Update last accessed timestamp (fire and forget)
    prisma.projectSecret.update({
      where: { id: secret.id },
      data: { lastAccessedAt: new Date() },
    }).catch(() => {
      // Ignore errors on timestamp update
    });

    // Audit log (system access, no user context)
    await logSecretAccess(projectId, key, null, 'read');

    return decryptSecret({
      encryptedValue: secret.encryptedValue,
      iv: secret.iv,
      authTag: secret.authTag,
    });
  } catch (error) {
    console.error('Failed to get project secret:', error);
    return null;
  }
}

/**
 * Retrieves a secret with user permission verification
 * Use this when the user explicitly requests to view a secret
 *
 * @param projectId - The project ID
 * @param key - The secret key identifier
 * @returns Result with decrypted value or error
 */
export async function getProjectSecretForUser(
  projectId: string,
  key: SecretKey
): Promise<GetSecretResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAdminAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    const value = await getProjectSecret(projectId, key);

    if (!value) {
      return { success: false, error: 'Secreto no encontrado' };
    }

    // Log user access
    await logSecretAccess(projectId, key, user.userId, 'read');

    return { success: true, value };
  } catch (error) {
    console.error('Failed to get project secret for user:', error);
    return { success: false, error: 'Error interno' };
  }
}

/**
 * Deletes a project secret
 *
 * @param projectId - The project ID
 * @param key - The secret key identifier
 * @returns Success status
 */
export async function deleteProjectSecret(
  projectId: string,
  key: SecretKey
): Promise<SetSecretResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAdminAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    await prisma.projectSecret.delete({
      where: {
        projectId_key: { projectId, key },
      },
    });

    await logSecretAccess(projectId, key, user.userId, 'delete');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete project secret:', error);
    return { success: false, error: 'Error interno al eliminar secreto' };
  }
}

/**
 * Checks which secrets are configured for a project
 * Does NOT expose secret values, only checks existence
 *
 * @param projectId - The project ID
 * @returns Map of secret keys to their configuration status
 */
export async function getProjectSecretsStatus(
  projectId: string
): Promise<HasSecretsResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, configured: {} as Record<SecretKey, boolean>, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAdminAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, configured: {} as Record<SecretKey, boolean>, error: 'Sin permisos' };
    }

    const secrets = await prisma.projectSecret.findMany({
      where: { projectId },
      select: { key: true },
    });

    const configuredKeys = new Set(secrets.map((s) => s.key));

    const allKeys: SecretKey[] = [
      'whatsapp_access_token',
      'whatsapp_phone_number_id',
      'whatsapp_business_account_id',
      'openai_api_key',
      'anthropic_api_key',
    ];

    const configured = {} as Record<SecretKey, boolean>;
    for (const key of allKeys) {
      configured[key] = configuredKeys.has(key);
    }

    return { success: true, configured };
  } catch (error) {
    console.error('Failed to get project secrets status:', error);
    return { success: false, configured: {} as Record<SecretKey, boolean>, error: 'Error interno' };
  }
}

/**
 * Bulk save multiple secrets at once
 *
 * @param projectId - The project ID
 * @param secrets - Map of key-value pairs to save
 * @returns Success status
 */
export async function setProjectSecrets(
  projectId: string,
  secrets: Partial<Record<SecretKey, string>>
): Promise<SetSecretResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No autorizado' };
    }

    const hasAccess = await verifyProjectAdminAccess(user.userId, projectId);
    if (!hasAccess) {
      return { success: false, error: 'Sin permisos para este proyecto' };
    }

    // Save each secret
    for (const [key, value] of Object.entries(secrets)) {
      if (value && value.trim() !== '') {
        const encrypted = encryptSecret(value);
        await prisma.projectSecret.upsert({
          where: {
            projectId_key: { projectId, key },
          },
          update: {
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            updatedAt: new Date(),
          },
          create: {
            projectId,
            key,
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
          },
        });
        await logSecretAccess(projectId, key, user.userId, 'write');
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to set project secrets:', error);
    return { success: false, error: 'Error interno al guardar secretos' };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Verifies if user has admin access to a project
 */
async function verifyProjectAdminAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is super admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'super_admin') {
    return true;
  }

  // Check project membership with admin role
  const membership = await prisma.projectMember.findFirst({
    where: {
      userId,
      projectId,
      role: { in: ['admin'] },
    },
  });

  return !!membership;
}

/**
 * Logs secret access for audit trail
 */
async function logSecretAccess(
  projectId: string,
  secretKey: string,
  userId: string | null,
  action: 'read' | 'write' | 'delete'
): Promise<void> {
  try {
    const headersList = await headers();

    await prisma.secretAccessLog.create({
      data: {
        projectId,
        secretKey,
        userId,
        action,
        ipAddress:
          headersList.get('x-forwarded-for') ||
          headersList.get('x-real-ip') ||
          null,
        userAgent: headersList.get('user-agent') || null,
      },
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log secret access:', error);
  }
}
