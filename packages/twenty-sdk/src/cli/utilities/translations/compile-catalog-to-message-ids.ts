import { generateMessageId } from 'twenty-shared/i18n';

import { parseTranslationCatalogKey } from '@/sdk/front-component/translations/message';

// Authoring files are keyed by a readable context-and-message pair so a
// translator can read them. Everything that resolves at runtime -- the server
// against the manifest, the front-component worker against its bundled catalog
// -- looks up by message id, so both compile through here rather than each
// re-deriving it.
export const compileCatalogToMessageIds = ({
  catalog,
  onCollision,
}: {
  catalog: Record<string, string>;
  onCollision?: (args: {
    messageId: string;
    keptKey: string;
    droppedKey: string;
  }) => void;
}): Record<string, string> => {
  const compiled: Record<string, string> = {};
  const keyByMessageId = new Map<string, string>();

  for (const [key, translation] of Object.entries(catalog)) {
    if (typeof translation !== 'string' || translation.length === 0) {
      continue;
    }

    const { message, context } = parseTranslationCatalogKey(key);
    const messageId = generateMessageId(message, context);
    const collidingKey = keyByMessageId.get(messageId);

    if (collidingKey !== undefined && collidingKey !== key) {
      onCollision?.({ messageId, keptKey: key, droppedKey: collidingKey });
    }

    keyByMessageId.set(messageId, key);
    compiled[messageId] = translation;
  }

  return compiled;
};
