import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { STANDARD_TIMELINE_ACTIVITY_RULES } from 'src/modules/timeline/constants/standard-timeline-activity-rules.constant';
import { type EffectiveTimelineActivityRule } from 'src/modules/timeline/types/effective-timeline-activity-rule.type';
import { buildJunctionTargetShape } from 'src/modules/timeline/utils/build-junction-target-shape.util';
import { deriveDefaultTimelineActivityRule } from 'src/modules/timeline/utils/derive-default-timeline-activity-rule.util';

export type TimelineActivityRulesForEventBatch = {
  // Rules triggered by events on the batch object itself
  sourceRules: EffectiveTimelineActivityRule[];
  // Rules whose junction object is the batch object, so events on it are link
  // or unlink events for the rule
  junctionRules: EffectiveTimelineActivityRule[];
};

@Injectable()
export class TimelineActivityRuleResolverService {
  constructor(
    private readonly workspaceManyOrAllFlatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
  ) {}

  async getRulesForEventBatch({
    workspaceId,
    flatObjectMetadata,
  }: {
    workspaceId: string;
    flatObjectMetadata: FlatObjectMetadata;
  }): Promise<TimelineActivityRulesForEventBatch> {
    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatObjectMetadataMaps', 'flatFieldMetadataMaps'],
        },
      );

    const standardRules = this.buildStandardRules({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
    });

    const derivedSelfRule =
      deriveDefaultTimelineActivityRule(flatObjectMetadata);

    const sourceRules = [
      ...(isDefined(derivedSelfRule) ? [derivedSelfRule] : []),
      ...standardRules.filter(
        (rule) => rule.objectMetadataId === flatObjectMetadata.id,
      ),
    ];

    const junctionRules = standardRules.filter(
      (rule) =>
        rule.targetShape.kind === 'JUNCTION' &&
        rule.targetShape.junctionObjectMetadataId === flatObjectMetadata.id,
    );

    return { sourceRules, junctionRules };
  }

  private buildStandardRules({
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
  }: {
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  }): EffectiveTimelineActivityRule[] {
    return STANDARD_TIMELINE_ACTIVITY_RULES.map(
      (standardRule): EffectiveTimelineActivityRule | undefined => {
        const ruleFlatObjectMetadata = findFlatEntityByUniversalIdentifier({
          flatEntityMaps: flatObjectMetadataMaps,
          universalIdentifier: standardRule.objectUniversalIdentifier,
        });

        const relationFlatFieldMetadata = findFlatEntityByUniversalIdentifier({
          flatEntityMaps: flatFieldMetadataMaps,
          universalIdentifier: standardRule.relationFieldUniversalIdentifier,
        });

        if (
          !isDefined(ruleFlatObjectMetadata) ||
          !isDefined(relationFlatFieldMetadata)
        ) {
          return undefined;
        }

        const targetShape = buildJunctionTargetShape({
          relationFlatFieldMetadata,
          flatObjectMetadataMaps,
          flatFieldMetadataMaps,
        });

        if (!isDefined(targetShape)) {
          return undefined;
        }

        const triggerFlatFieldMetadatas =
          standardRule.triggerFieldUniversalIdentifiers
            ?.map((universalIdentifier) =>
              findFlatEntityByUniversalIdentifier({
                flatEntityMaps: flatFieldMetadataMaps,
                universalIdentifier,
              }),
            )
            .filter(isDefined) ?? null;

        const labelFlatFieldMetadata = isDefined(
          ruleFlatObjectMetadata.labelIdentifierFieldMetadataId,
        )
          ? findFlatEntityByIdInFlatEntityMaps({
              flatEntityId:
                ruleFlatObjectMetadata.labelIdentifierFieldMetadataId,
              flatEntityMaps: flatFieldMetadataMaps,
            })
          : undefined;

        return {
          objectMetadataId: ruleFlatObjectMetadata.id,
          objectNameSingular: ruleFlatObjectMetadata.nameSingular,
          relationFieldMetadataId: relationFlatFieldMetadata.id,
          resolution: 'MATERIALIZED',
          actions: standardRule.actions,
          triggerFieldMetadataIds:
            triggerFlatFieldMetadatas?.map(({ id }) => id) ?? null,
          triggerFieldNames:
            triggerFlatFieldMetadatas?.map(({ name }) => name) ?? null,
          labelFieldMetadataId: null,
          labelFieldName: labelFlatFieldMetadata?.name ?? null,
          isActive: true,
          targetShape,
        };
      },
    ).filter(isDefined);
  }
}
