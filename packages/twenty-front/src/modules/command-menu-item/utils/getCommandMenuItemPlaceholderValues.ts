import {
  buildObjectMetadataLabelPlaceholderValues,
  type MetadataLabelPlaceholderValues,
} from 'twenty-shared/i18n';
import { type CommandMenuContextApi } from 'twenty-shared/types';

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

// Command menu item labels that name an object are stored with placeholders and
// translated with them intact, because the object they name is the one whose
// page the user is on -- which only the client knows. objectLabel is the one
// the client alone can supply: it follows the selection, singular or plural.
export const getCommandMenuItemPlaceholderValues = (
  commandMenuContextApi: CommandMenuContextApi,
): MetadataLabelPlaceholderValues =>
  buildObjectMetadataLabelPlaceholderValues({
    label: commandMenuContextApi.objectMetadataLabel,
    labelSingular: readString(
      commandMenuContextApi.objectMetadataItem.labelSingular,
    ),
    labelPlural: readString(
      commandMenuContextApi.objectMetadataItem.labelPlural,
    ),
    icon: readString(commandMenuContextApi.objectMetadataItem.icon),
  });
