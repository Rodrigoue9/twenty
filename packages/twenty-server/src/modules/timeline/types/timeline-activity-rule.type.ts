export const TIMELINE_ACTIVITY_RULE_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'restored',
  'linked',
  'unlinked',
] as const;

export type TimelineActivityRuleAction =
  (typeof TIMELINE_ACTIVITY_RULE_ACTIONS)[number];

// INHERITED, the read-time dual of MATERIALIZED, is not implemented yet.
export type TimelineActivityRuleResolution = 'MATERIALIZED';

export type TimelineActivityRule = {
  // MATERIALIZED: the object whose events trigger this rule
  objectMetadataId: string;
  // Relation field to walk from the object to the records receiving the entry.
  // null = the record itself
  relationFieldMetadataId: string | null;
  resolution: TimelineActivityRuleResolution;
  actions: TimelineActivityRuleAction[];
  // null = any field. Only applies to the `updated` action
  triggerFieldMetadataIds: string[] | null;
  // Supplies linkedRecordCachedName. null = the object label identifier
  labelFieldMetadataId: string | null;
  isActive: boolean;
};
