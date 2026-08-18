import { Injectable } from '@nestjs/common';

import { type ObjectRecordBaseEvent } from 'twenty-shared/database-events';
import { FieldMetadataType, type ObjectRecord } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { getFlatFieldsFromFlatObjectMetadata } from 'src/engine/api/graphql/workspace-schema-builder/utils/get-flat-fields-for-flat-object-metadata.util';
import { type DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { InjectObjectMetadataRepository } from 'src/engine/object-metadata-repository/object-metadata-repository.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { parseEventNameOrThrow } from 'src/engine/workspace-event-emitter/utils/parse-event-name';
import { TimelineActivityRepository } from 'src/modules/timeline/repositories/timeline-activity.repository';
import { TimelineActivityRuleResolverService } from 'src/modules/timeline/services/timeline-activity-rule-resolver.service';
import { TimelineActivityTargetResolverService } from 'src/modules/timeline/services/timeline-activity-target-resolver.service';
import { TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';
import { type EffectiveTimelineActivityRule } from 'src/modules/timeline/types/effective-timeline-activity-rule.type';
import { type TimelineActivityPayload } from 'src/modules/timeline/types/timeline-activity-payload';
import { type TimelineActivityRuleAction } from 'src/modules/timeline/types/timeline-activity-rule.type';

// An event on the junction object is a change to the link, not to the linked
// record. `updated` covers a junction row being repointed at another target.
const JUNCTION_EVENT_ACTIONS: Partial<
  Record<DatabaseEventAction, TimelineActivityRuleAction>
> = {
  created: 'linked',
  restored: 'linked',
  updated: 'linked',
  deleted: 'unlinked',
};

const SOURCE_EVENT_ACTIONS: Partial<
  Record<DatabaseEventAction, TimelineActivityRuleAction>
> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  restored: 'restored',
};

@Injectable()
export class TimelineActivityService {
  constructor(
    @InjectObjectMetadataRepository(TimelineActivityWorkspaceEntity)
    private readonly timelineActivityRepository: TimelineActivityRepository,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workspaceManyOrAllFlatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly timelineActivityRuleResolverService: TimelineActivityRuleResolverService,
    private readonly timelineActivityTargetResolverService: TimelineActivityTargetResolverService,
  ) {}

  async upsertEvents({
    events,
    name,
    objectMetadata,
    workspaceId,
  }: WorkspaceEventBatch<ObjectRecordBaseEvent>) {
    if (!isDefined(workspaceId)) {
      return;
    }

    const { action } = parseEventNameOrThrow(name);

    const { sourceRules, junctionRules } =
      await this.timelineActivityRuleResolverService.getRulesForEventBatch({
        workspaceId,
        flatObjectMetadata: objectMetadata,
      });

    if (sourceRules.length === 0 && junctionRules.length === 0) {
      return;
    }

    const eventsWithoutPositionDiff =
      await this.excludePositionFieldsFromEventsDiff({
        events,
        objectMetadata,
        workspaceId,
      });

    const payloads =
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const collectedPayloads: TimelineActivityPayload[] = [];

          for (const rule of sourceRules) {
            collectedPayloads.push(
              ...(await this.buildPayloadsForSourceRule({
                rule,
                events: eventsWithoutPositionDiff,
                action,
                workspaceId,
              })),
            );
          }

          for (const rule of junctionRules) {
            collectedPayloads.push(
              ...(await this.buildPayloadsForJunctionRule({
                rule,
                events: eventsWithoutPositionDiff,
                action,
                workspaceId,
              })),
            );
          }

          return collectedPayloads;
        },
        buildSystemAuthContext(workspaceId),
      );

    if (payloads.length === 0) {
      return;
    }

    const payloadsByObjectSingularName = payloads.reduce(
      (acc, payload) => {
        const objectSingularName = payload.objectSingularName;

        if (!isDefined(objectSingularName)) {
          return acc;
        }

        acc[objectSingularName] = [...(acc[objectSingularName] ?? []), payload];

        return acc;
      },
      {} as Record<string, TimelineActivityPayload[]>,
    );

    for (const objectSingularName in payloadsByObjectSingularName) {
      await this.timelineActivityRepository.upsertTimelineActivities({
        objectSingularName,
        workspaceId,
        payloads: payloadsByObjectSingularName[objectSingularName],
      });
    }
  }

  private ruleMatchesEvent({
    rule,
    ruleAction,
    event,
  }: {
    rule: EffectiveTimelineActivityRule;
    ruleAction: TimelineActivityRuleAction;
    event: ObjectRecordBaseEvent;
  }): boolean {
    if (!rule.isActive || !rule.actions.includes(ruleAction)) {
      return false;
    }

    if (ruleAction !== 'updated' || !isDefined(rule.triggerFieldNames)) {
      return true;
    }

    const diff = event.properties.diff;

    if (!isDefined(diff)) {
      return false;
    }

    return rule.triggerFieldNames.some((fieldName) =>
      isDefined((diff as Record<string, unknown>)[fieldName]),
    );
  }

  private async buildPayloadsForSourceRule({
    rule,
    events,
    action,
    workspaceId,
  }: {
    rule: EffectiveTimelineActivityRule;
    events: ObjectRecordBaseEvent[];
    action: DatabaseEventAction;
    workspaceId: string;
  }): Promise<TimelineActivityPayload[]> {
    const ruleAction = SOURCE_EVENT_ACTIONS[action];

    if (!isDefined(ruleAction)) {
      return [];
    }

    const matchingEvents = events.filter((event) =>
      this.ruleMatchesEvent({ rule, ruleAction, event }),
    );

    if (matchingEvents.length === 0) {
      return [];
    }

    if (rule.targetShape.kind === 'SELF') {
      return matchingEvents.map((event) => ({
        name: `${rule.objectNameSingular}.${action}`,
        objectSingularName: rule.objectNameSingular,
        recordId: event.recordId,
        workspaceMemberId: event.workspaceMemberId,
        properties: event.properties,
      }));
    }

    const targetsBySourceRecordId =
      await this.timelineActivityTargetResolverService.resolveTargetsBySourceRecordId(
        {
          rule,
          sourceRecordIds: matchingEvents.map((event) => event.recordId),
          workspaceId,
        },
      );

    return matchingEvents.flatMap((event) =>
      (targetsBySourceRecordId.get(event.recordId) ?? []).map((target) => ({
        name: `linked-${rule.objectNameSingular}.${action}`,
        objectSingularName: target.targetObjectNameSingular,
        recordId: target.targetRecordId,
        workspaceMemberId: event.workspaceMemberId,
        linkedRecordId: event.recordId,
        linkedObjectMetadataId: rule.objectMetadataId,
        linkedRecordCachedName: this.readLabelFromEvent({ rule, event }),
        properties: event.properties,
      })),
    );
  }

  private readLabelFromEvent({
    rule,
    event,
  }: {
    rule: EffectiveTimelineActivityRule;
    event: ObjectRecordBaseEvent;
  }): string | undefined {
    if (!isDefined(rule.labelFieldName)) {
      return undefined;
    }

    const label = (event.properties.after as ObjectRecord | undefined)?.[
      rule.labelFieldName
    ];

    return typeof label === 'string' ? label : undefined;
  }

  private async buildPayloadsForJunctionRule({
    rule,
    events,
    action,
    workspaceId,
  }: {
    rule: EffectiveTimelineActivityRule;
    events: ObjectRecordBaseEvent[];
    action: DatabaseEventAction;
    workspaceId: string;
  }): Promise<TimelineActivityPayload[]> {
    const ruleAction = JUNCTION_EVENT_ACTIONS[action];

    if (
      !isDefined(ruleAction) ||
      !rule.isActive ||
      !rule.actions.includes(ruleAction) ||
      rule.targetShape.kind !== 'JUNCTION'
    ) {
      return [];
    }

    const { junctionSourceJoinColumnName } = rule.targetShape;

    const eventsWithJunctionRecord = events
      .map((event) => {
        const junctionRecord = event.properties.after as
          | ObjectRecord
          | undefined;

        const target =
          this.timelineActivityTargetResolverService.resolveTargetFromJunctionRecord(
            { rule, junctionRecord },
          );

        const sourceRecordId = junctionRecord?.[junctionSourceJoinColumnName];

        if (!isDefined(target) || typeof sourceRecordId !== 'string') {
          return undefined;
        }

        return { event, target, sourceRecordId };
      })
      .filter(isDefined);

    if (eventsWithJunctionRecord.length === 0) {
      return [];
    }

    const labelsByRecordId =
      await this.timelineActivityTargetResolverService.findLabelsByRecordId({
        rule,
        recordIds: eventsWithJunctionRecord.map(
          ({ sourceRecordId }) => sourceRecordId,
        ),
        workspaceId,
      });

    return eventsWithJunctionRecord
      .filter(({ sourceRecordId }) => labelsByRecordId.has(sourceRecordId))
      .map(({ event, target, sourceRecordId }) => ({
        name: `linked-${rule.objectNameSingular}.${action}`,
        objectSingularName: target.targetObjectNameSingular,
        recordId: target.targetRecordId,
        workspaceMemberId: event.workspaceMemberId,
        linkedRecordId: sourceRecordId,
        linkedObjectMetadataId: rule.objectMetadataId,
        linkedRecordCachedName: labelsByRecordId.get(sourceRecordId),
        properties: {},
      }));
  }

  // Position changes reach other consumers (SSE, webhooks, workflows) but render
  // blank in the timeline, so exclude them to avoid empty activity rows.
  private async excludePositionFieldsFromEventsDiff({
    events,
    objectMetadata,
    workspaceId,
  }: {
    events: ObjectRecordBaseEvent[];
    objectMetadata: FlatObjectMetadata;
    workspaceId: string;
  }): Promise<ObjectRecordBaseEvent[]> {
    const someEventHasDiff = events.some((event) =>
      isDefined(event.properties.diff),
    );

    if (!someEventHasDiff) {
      return events;
    }

    const { flatFieldMetadataMaps } =
      await this.workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatFieldMetadataMaps'],
        },
      );

    const positionFieldNames = new Set(
      getFlatFieldsFromFlatObjectMetadata(objectMetadata, flatFieldMetadataMaps)
        .filter((field) => field.type === FieldMetadataType.POSITION)
        .map((field) => field.name),
    );

    if (positionFieldNames.size === 0) {
      return events;
    }

    return events.map((event) => {
      const diff = event.properties.diff;

      if (!isDefined(diff)) {
        return event;
      }

      const diffWithoutPositionFields = Object.fromEntries(
        Object.entries(diff).filter(
          ([fieldName]) => !positionFieldNames.has(fieldName),
        ),
      );

      return {
        ...event,
        properties: { ...event.properties, diff: diffWithoutPositionFields },
      };
    });
  }
}
