import {
  getMetadataLabelPlaceholder,
  type MetadataLabelPlaceholderValues,
} from 'twenty-shared/i18n';

import { type ObjectMetadataOverrides } from 'src/engine/metadata-modules/object-metadata/types/object-metadata-overrides.type';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/utils/effective-entity-i18n-context.type';
import { resolveEffectiveEntityProperty } from 'src/engine/metadata-modules/utils/resolve-effective-entity-property.util';

type ViewNameObjectMetadata = {
  labelSingular: string;
  labelPlural: string;
  overrides?: ObjectMetadataOverrides | null;
};

const LABEL_PROPERTY_BY_PLACEHOLDER_NAME = {
  objectLabelSingular: 'labelSingular',
  objectLabelPlural: 'labelPlural',
} as const;

// A view name names its own object, and every placeholder resolved costs a
// catalog lookup per view, so only the ones the name actually carries are
// resolved.
export const buildViewNameObjectLabels = ({
  viewName,
  objectMetadata,
  i18nContext,
}: {
  viewName: string;
  objectMetadata: ViewNameObjectMetadata;
  i18nContext: EffectiveEntityI18nContext;
}): MetadataLabelPlaceholderValues =>
  Object.fromEntries(
    Object.entries(LABEL_PROPERTY_BY_PLACEHOLDER_NAME)
      .filter(([placeholderName]) =>
        viewName.includes(
          getMetadataLabelPlaceholder(
            placeholderName as keyof typeof LABEL_PROPERTY_BY_PLACEHOLDER_NAME,
          ),
        ),
      )
      .map(([placeholderName, property]) => [
        placeholderName,
        resolveEffectiveEntityProperty({
          metadataName: 'objectMetadata',
          baseValue: objectMetadata[property],
          overrides: objectMetadata.overrides ?? undefined,
          property,
          i18nContext,
        }),
      ]),
  );
