import { capitalize } from '../utils/strings/capitalize';
import { isDefined } from '../utils/validation/isDefined';

// Metadata labels are authored as source messages with named placeholders, so
// the sentence reaches translators whole and the object label is substituted
// afterwards. This is the closed vocabulary those placeholders draw from --
// adding a name here is what makes it fillable, on the server and the client.
export const METADATA_LABEL_PLACEHOLDER_NAMES = [
  'objectLabel',
  'objectLabelSingular',
  'objectLabelPlural',
  'objectIcon',
] as const;

export type MetadataLabelPlaceholderName =
  (typeof METADATA_LABEL_PLACEHOLDER_NAMES)[number];

// The subset an object metadata can fill. objectLabel is deliberately absent:
// it follows the record selection, which only the client knows.
export const OBJECT_METADATA_LABEL_PLACEHOLDER_NAMES = [
  'objectLabelSingular',
  'objectLabelPlural',
  'objectIcon',
] as const satisfies readonly MetadataLabelPlaceholderName[];

export type MetadataLabelPlaceholderValues = Partial<
  Record<MetadataLabelPlaceholderName, string>
>;

export const getMetadataLabelPlaceholder = (
  name: MetadataLabelPlaceholderName,
): string => `{${name}}`;

// Lingui substitutes ICU arguments while translating and drops any it is not
// given, so translating with the placeholders as their own values is what keeps
// them in the output for the side that can actually resolve them -- page
// context labels are filled by the client, against whichever object page the
// user is on.
export const METADATA_LABEL_PLACEHOLDER_PASS_THROUGH: Record<
  MetadataLabelPlaceholderName,
  string
> = Object.fromEntries(
  METADATA_LABEL_PLACEHOLDER_NAMES.map((name) => [
    name,
    getMetadataLabelPlaceholder(name),
  ]),
) as Record<MetadataLabelPlaceholderName, string>;

// Object labels are shown capitalized wherever they appear, and a placeholder
// can land at the start of a label ("{objectLabelPlural}" alone, on the
// navigation command's short label), so the value carries the casing rather
// than each message trying to.
const capitalizeLabel = (label?: string | null): string | undefined =>
  isDefined(label) ? capitalize(label) : undefined;

// The values every filler derives from an object, so the same placeholder name
// means the same thing wherever it is filled -- the server resolving a
// navigation command against its target object, the client rendering a view
// name or a command against the page it is on.
export const buildObjectMetadataLabelPlaceholderValues = ({
  label,
  labelSingular,
  labelPlural,
  icon,
}: {
  label?: string | null;
  labelSingular?: string | null;
  labelPlural?: string | null;
  icon?: string | null;
}): MetadataLabelPlaceholderValues => ({
  objectLabel: capitalizeLabel(label),
  objectLabelSingular: capitalizeLabel(labelSingular),
  objectLabelPlural: capitalizeLabel(labelPlural),
  objectIcon: icon ?? undefined,
});

// Whether a message needs an object resolved before it can be filled. Callers
// gate a metadata read on this, so it asks about the whole vocabulary rather
// than one placeholder a caller happened to think of.
export const hasObjectMetadataLabelPlaceholder = (message: string): boolean =>
  OBJECT_METADATA_LABEL_PLACEHOLDER_NAMES.some((name) =>
    message.includes(getMetadataLabelPlaceholder(name)),
  );
