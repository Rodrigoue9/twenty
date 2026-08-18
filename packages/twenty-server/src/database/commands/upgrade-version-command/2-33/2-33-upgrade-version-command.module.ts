import { Module } from '@nestjs/common';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { MigrateCommandMenuItemLabelsToPlaceholdersCommand } from 'src/database/commands/upgrade-version-command/2-33/2-33-workspace-command-1787064853000-migrate-command-menu-item-labels-to-placeholders.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';

@Module({
  imports: [
    ApplicationModule,
    WorkspaceCacheModule,
    WorkspaceIteratorModule,
    WorkspaceMigrationModule,
  ],
  providers: [MigrateCommandMenuItemLabelsToPlaceholdersCommand],
})
export class V2_33_UpgradeVersionCommandModule {}
