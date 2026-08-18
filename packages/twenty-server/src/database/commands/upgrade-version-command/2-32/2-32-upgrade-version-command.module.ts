import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { AddCalendarEventSummaryTabCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1786609782000-add-calendar-event-summary-tab.command';
import { AddWorkspaceMemberUiScaleFieldCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1786700000000-add-workspace-member-ui-scale-field.command';
import { BackfillActivityTargetsJunctionTargetCommand } from 'src/database/commands/upgrade-version-command/2-32/2-32-workspace-command-1786800000000-backfill-activity-targets-junction-target.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceMigrationRunnerModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/workspace-migration-runner.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FieldMetadataEntity]),
    ApplicationModule,
    WorkspaceCacheModule,
    WorkspaceIteratorModule,
    WorkspaceMigrationModule,
    WorkspaceMigrationRunnerModule,
  ],
  providers: [
    AddCalendarEventSummaryTabCommand,
    AddWorkspaceMemberUiScaleFieldCommand,
    BackfillActivityTargetsJunctionTargetCommand,
  ],
})
export class V2_32_UpgradeVersionCommandModule {}
