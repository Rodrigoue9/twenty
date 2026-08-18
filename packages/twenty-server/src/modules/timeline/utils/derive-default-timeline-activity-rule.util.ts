import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type EffectiveTimelineActivityRule } from 'src/modules/timeline/types/effective-timeline-activity-rule.type';

const SELF_RULE_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'restored',
] as const;

// Every audit logged non system object records its own changes. Materialising
// this as a row per object would mean backfilling every object of every
// workspace, so it is derived and only overrides are persisted.
export const deriveDefaultTimelineActivityRule = (
  flatObjectMetadata: Pick<
    FlatObjectMetadata,
    'id' | 'nameSingular' | 'isAuditLogged' | 'isSystem'
  >,
): EffectiveTimelineActivityRule | undefined => {
  if (!flatObjectMetadata.isAuditLogged || flatObjectMetadata.isSystem) {
    return undefined;
  }

  return {
    objectMetadataId: flatObjectMetadata.id,
    objectNameSingular: flatObjectMetadata.nameSingular,
    relationFieldMetadataId: null,
    resolution: 'MATERIALIZED',
    actions: [...SELF_RULE_ACTIONS],
    triggerFieldMetadataIds: null,
    triggerFieldNames: null,
    labelFieldMetadataId: null,
    labelFieldName: null,
    isActive: true,
    targetShape: { kind: 'SELF' },
  };
};
