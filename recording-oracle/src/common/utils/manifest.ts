import { EncryptionUtils } from '@human-protocol/sdk';

import type { PGPConfigService } from '../config/pgp-config.service';
import { decryptJson, isFullPgpMessage } from './encryption';

export async function parseManifestContent(
  manifestContent: unknown,
  pgpConfigService: PGPConfigService,
): Promise<unknown> {
  if (
    typeof manifestContent === 'string' &&
    isFullPgpMessage(manifestContent)
  ) {
    return decryptJson(manifestContent, pgpConfigService);
  }

  const parsedContent =
    typeof manifestContent === 'string'
      ? JSON.parse(manifestContent)
      : manifestContent;

  return decryptManifestCredentials(parsedContent, pgpConfigService);
}

async function decryptManifestCredentials(
  content: unknown,
  pgpConfigService: PGPConfigService,
): Promise<unknown> {
  if (!content || typeof content !== 'object') {
    return content;
  }

  const manifest = content as {
    requirements?: Record<string, unknown>;
  };
  const encryptedCredentials = manifest.requirements?.xApiCredentials;

  if (
    typeof encryptedCredentials !== 'string' ||
    !EncryptionUtils.isEncrypted(encryptedCredentials)
  ) {
    return content;
  }

  return {
    ...manifest,
    requirements: {
      ...manifest.requirements,
      xApiCredentials: await decryptJson(
        encryptedCredentials,
        pgpConfigService,
      ),
    },
  };
}
