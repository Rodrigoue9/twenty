export const stripUndefinedValues = <T extends Record<string, unknown>>(
  record: T,
): T =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as T;
