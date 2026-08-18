import { InjectRepository } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { isFieldMetadataSettingsOfType } from 'src/engine/metadata-modules/field-metadata/utils/is-field-metadata-settings-of-type.util';
import { getMetadataFlatEntityMapsKey } from 'src/engine/metadata-modules/flat-entity/utils/get-metadata-flat-entity-maps-key.util';
import { getMetadataRelatedMetadataNames } from 'src/engine/metadata-modules/flat-entity/utils/get-metadata-related-metadata-names.util';
import { getMetadataSerializedRelationNames } from 'src/engine/metadata-modules/flat-entity/utils/get-metadata-serialized-relation-names.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationRunnerService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/services/workspace-migration-runner.service';

// The junction target points at one member of the target morph. Consumers expand
// the whole morph group from it, so any member identifies the polymorphic edge.
const ACTIVITY_JUNCTIONS = [
  {
    label: 'note.noteTargets',
    junctionRelationFieldUniversalIdentifier:
      STANDARD_OBJECTS.note.fields.noteTargets.universalIdentifier,
    junctionTargetFieldUniversalIdentifier:
      STANDARD_OBJECTS.noteTarget.fields.targetPerson.universalIdentifier,
  },
  {
    label: 'task.taskTargets',
    junctionRelationFieldUniversalIdentifier:
      STANDARD_OBJECTS.task.fields.taskTargets.universalIdentifier,
    junctionTargetFieldUniversalIdentifier:
      STANDARD_OBJECTS.taskTarget.fields.targetPerson.universalIdentifier,
  },
] as const;

@RegisteredWorkspaceCommand('2.32.0', 1786800000000)
@Command({
  name: 'upgrade:2-32:backfill-activity-targets-junction-target',
  description:
    'Backfill the junction target field id on note.noteTargets and task.taskTargets for workspaces provisioned before it was declared, so activity targets are recognised as junction relations.',
})
export class BackfillActivityTargetsJunctionTargetCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationRunnerService: WorkspaceMigrationRunnerService,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { flatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatFieldMetadataMaps',
      ]);

    let hasBackfilledAny = false;

    for (const {
      label,
      junctionRelationFieldUniversalIdentifier,
      junctionTargetFieldUniversalIdentifier,
    } of ACTIVITY_JUNCTIONS) {
      const junctionRelationFlatFieldMetadata =
        flatFieldMetadataMaps.byUniversalIdentifier[
          junctionRelationFieldUniversalIdentifier
        ];

      if (!isDefined(junctionRelationFlatFieldMetadata)) {
        this.logger.log(
          `No ${label} field for workspace ${workspaceId}, skipping`,
        );

        continue;
      }

      const currentSettings = junctionRelationFlatFieldMetadata.settings;

      if (
        !isFieldMetadataSettingsOfType(
          currentSettings,
          FieldMetadataType.RELATION,
        )
      ) {
        this.logger.warn(
          `${label} has no relation settings for workspace ${workspaceId}, skipping`,
        );

        continue;
      }

      if (isDefined(currentSettings.junctionTargetFieldId)) {
        this.logger.log(
          `${label} junction target already set for workspace ${workspaceId}, skipping`,
        );

        continue;
      }

      const junctionTargetFlatFieldMetadata =
        flatFieldMetadataMaps.byUniversalIdentifier[
          junctionTargetFieldUniversalIdentifier
        ];

      if (!isDefined(junctionTargetFlatFieldMetadata)) {
        this.logger.warn(
          `No junction target field for ${label} in workspace ${workspaceId}, skipping`,
        );

        continue;
      }

      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Backfilling ${label} junction target for workspace ${workspaceId}`,
      );

      if (isDryRun) {
        continue;
      }

      await this.fieldMetadataRepository.update(
        { id: junctionRelationFlatFieldMetadata.id, workspaceId },
        {
          settings: {
            ...currentSettings,
            junctionTargetFieldId: junctionTargetFlatFieldMetadata.id,
          },
        },
      );

      hasBackfilledAny = true;
    }

    if (!hasBackfilledAny) {
      return;
    }

    const fieldMetadataRelatedNames = [
      'fieldMetadata',
      ...getMetadataRelatedMetadataNames('fieldMetadata'),
      ...getMetadataSerializedRelationNames('fieldMetadata'),
      'index',
    ] as const;
    const allFlatEntityMapsKeys = [
      ...new Set(fieldMetadataRelatedNames.map(getMetadataFlatEntityMapsKey)),
    ];

    await this.workspaceMigrationRunnerService.invalidateCache({
      allFlatEntityMapsKeys,
      workspaceId,
    });
  }
}
