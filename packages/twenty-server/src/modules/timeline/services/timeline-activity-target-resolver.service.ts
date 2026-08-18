import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type EffectiveTimelineActivityRule } from 'src/modules/timeline/types/effective-timeline-activity-rule.type';

export type ResolvedTimelineActivityTarget = {
  targetObjectNameSingular: string;
  targetRecordId: string;
};

const readTargetFromJunctionRow = (
  junctionRow: Record<string, unknown>,
  rule: EffectiveTimelineActivityRule,
): ResolvedTimelineActivityTarget | undefined => {
  if (rule.targetShape.kind !== 'JUNCTION') {
    return undefined;
  }

  for (const { joinColumnName, targetObjectNameSingular } of rule.targetShape
    .junctionTargetJoinColumns) {
    const targetRecordId = junctionRow[joinColumnName];

    if (typeof targetRecordId === 'string' && targetRecordId.length > 0) {
      return { targetObjectNameSingular, targetRecordId };
    }
  }

  return undefined;
};

@Injectable()
export class TimelineActivityTargetResolverService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  // Source events: walk the junction in one batched query and return, per source
  // record, every record whose timeline receives an entry.
  async resolveTargetsBySourceRecordId({
    rule,
    sourceRecordIds,
    workspaceId,
  }: {
    rule: EffectiveTimelineActivityRule;
    sourceRecordIds: string[];
    workspaceId: string;
  }): Promise<Map<string, ResolvedTimelineActivityTarget[]>> {
    const targetsBySourceRecordId = new Map<
      string,
      ResolvedTimelineActivityTarget[]
    >();

    if (rule.targetShape.kind !== 'JUNCTION' || sourceRecordIds.length === 0) {
      return targetsBySourceRecordId;
    }

    const { junctionObjectNameSingular, junctionSourceJoinColumnName } =
      rule.targetShape;

    const junctionRows = await this.globalWorkspaceOrmManager.getRepository(
      workspaceId,
      junctionObjectNameSingular,
      { shouldBypassPermissionChecks: true },
    );

    const rows = await junctionRows.find({
      where: { [junctionSourceJoinColumnName]: In(sourceRecordIds) },
    });

    for (const row of rows) {
      const sourceRecordId = row[junctionSourceJoinColumnName];

      if (typeof sourceRecordId !== 'string') {
        continue;
      }

      const target = readTargetFromJunctionRow(row, rule);

      if (!isDefined(target)) {
        continue;
      }

      targetsBySourceRecordId.set(sourceRecordId, [
        ...(targetsBySourceRecordId.get(sourceRecordId) ?? []),
        target,
      ]);
    }

    return targetsBySourceRecordId;
  }

  // Link events: the junction row is the event payload, no query needed.
  resolveTargetFromJunctionRecord({
    rule,
    junctionRecord,
  }: {
    rule: EffectiveTimelineActivityRule;
    junctionRecord: Record<string, unknown> | undefined;
  }): ResolvedTimelineActivityTarget | undefined {
    if (!isDefined(junctionRecord)) {
      return undefined;
    }

    return readTargetFromJunctionRow(junctionRecord, rule);
  }

  async findLabelsByRecordId({
    rule,
    recordIds,
    workspaceId,
  }: {
    rule: EffectiveTimelineActivityRule;
    recordIds: string[];
    workspaceId: string;
  }): Promise<Map<string, string>> {
    const labelsByRecordId = new Map<string, string>();

    if (!isDefined(rule.labelFieldName) || recordIds.length === 0) {
      return labelsByRecordId;
    }

    const repository = await this.globalWorkspaceOrmManager.getRepository(
      workspaceId,
      rule.objectNameSingular,
      { shouldBypassPermissionChecks: true },
    );

    const records = await repository.find({ where: { id: In(recordIds) } });

    for (const record of records) {
      const label = record[rule.labelFieldName];

      if (typeof label === 'string') {
        labelsByRecordId.set(record.id, label);
      }
    }

    return labelsByRecordId;
  }
}
