import { type TimelineActivityRule } from 'src/modules/timeline/types/timeline-activity-rule.type';

export type TimelineActivityRuleTargetJoinColumn = {
  joinColumnName: string;
  targetObjectMetadataId: string;
  targetObjectNameSingular: string;
};

export type TimelineActivityRuleTargetShape =
  | { kind: 'SELF' }
  | {
      kind: 'JUNCTION';
      junctionObjectMetadataId: string;
      junctionObjectNameSingular: string;
      // Column on the junction object pointing back at the rule object, e.g. noteId
      junctionSourceJoinColumnName: string;
      // Columns on the junction object pointing at the records receiving the
      // entry. More than one when the junction target is a morph relation
      junctionTargetJoinColumns: TimelineActivityRuleTargetJoinColumn[];
    };

export type EffectiveTimelineActivityRule = TimelineActivityRule & {
  objectNameSingular: string;
  // Field name backing linkedRecordCachedName, resolved from
  // labelFieldMetadataId or from the object label identifier
  labelFieldName: string | null;
  // Diff keys gating the `updated` action, resolved from triggerFieldMetadataIds
  triggerFieldNames: string[] | null;
  targetShape: TimelineActivityRuleTargetShape;
};
