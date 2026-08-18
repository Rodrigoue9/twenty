import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';

// Lingui's generated-id scheme. Catalogs are emitted with `printLinguiId: true`,
// so a source string persisted in metadata can be hashed back into its catalog
// key at read time.
//
// The server, the application SDK and the front-component runtime must produce
// byte-identical ids: the SDK writes catalogs keyed by this hash at build time
// and the other two read them. Drift between any of them silently untranslates,
// so there is exactly one implementation, in pure JS so the sandboxed
// front-component worker can call it too.
const UNIT_SEPARATOR = String.fromCharCode(0x1f);

// A metadata read hashes every translatable property of every entity, and the
// same few thousand source strings recur across requests, so the hash is
// memoized. The cap bounds a workspace that mints unusual labels.
const MAX_CACHED_MESSAGE_IDS = 50_000;

const messageIdByCacheKey = new Map<string, string>();

const toBase64 = (bytes: Uint8Array): string =>
  typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('base64')
    : btoa(String.fromCharCode(...bytes));

export const generateMessageId = (message: string, context = ''): string => {
  const cacheKey = message + UNIT_SEPARATOR + (context || '');
  const cachedMessageId = messageIdByCacheKey.get(cacheKey);

  if (cachedMessageId !== undefined) {
    return cachedMessageId;
  }

  const messageId = toBase64(sha256(utf8ToBytes(cacheKey))).slice(0, 6);

  if (messageIdByCacheKey.size >= MAX_CACHED_MESSAGE_IDS) {
    messageIdByCacheKey.clear();
  }

  messageIdByCacheKey.set(cacheKey, messageId);

  return messageId;
};
