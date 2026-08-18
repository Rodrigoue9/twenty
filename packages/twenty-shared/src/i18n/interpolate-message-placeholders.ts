import { isDefined } from '../utils/validation/isDefined';

const PLACEHOLDER_REGEX = /\{(\w+)\}/g;

// The single substitution step for every message that carries named
// placeholders: metadata labels, view names, command menu item labels and app
// front component messages alike. Placeholders the caller cannot fill -- absent
// from the values, or present with nothing resolved -- are left as written, so
// a message can be translated by whoever owns the catalog and filled later by
// whoever owns the values.
export const interpolateMessagePlaceholders = (
  message: string,
  values?: Record<string, string | number | undefined>,
): string => {
  if (!isDefined(values)) {
    return message;
  }

  return message.replace(PLACEHOLDER_REGEX, (placeholder, name: string) => {
    const value = values[name];

    return isDefined(value) ? String(value) : placeholder;
  });
};
