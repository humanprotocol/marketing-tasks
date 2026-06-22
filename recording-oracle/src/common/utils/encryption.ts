import { Encryption } from '@human-protocol/sdk';

import type { PGPConfigService } from '../config/pgp-config.service';
import { ErrorStorage } from '../constants/errors';
import { ServerError } from '../errors';

export const isFullPgpMessage = (content: string): boolean => {
  const trimmedContent = content.trim();

  return (
    trimmedContent.startsWith('-----BEGIN PGP MESSAGE-----') &&
    trimmedContent.endsWith('-----END PGP MESSAGE-----')
  );
};

export async function decryptJson(
  encryptedContent: string,
  pgpConfigService: PGPConfigService,
): Promise<unknown> {
  try {
    const privateKey = pgpConfigService.privateKey;
    if (!privateKey) {
      throw new ServerError(ErrorStorage.UnableDecryptManifest);
    }
    const encryption = await Encryption.build(
      privateKey,
      pgpConfigService.passphrase,
    );

    const decryptedData = await encryption.decrypt(encryptedContent);
    return JSON.parse(Buffer.from(decryptedData).toString());
  } catch {
    throw new ServerError(ErrorStorage.UnableDecryptManifest);
  }
}
