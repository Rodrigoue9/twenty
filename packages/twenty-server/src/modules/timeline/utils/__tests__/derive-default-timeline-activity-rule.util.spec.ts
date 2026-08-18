import { deriveDefaultTimelineActivityRule } from 'src/modules/timeline/utils/derive-default-timeline-activity-rule.util';

const buildFlatObjectMetadata = (
  overrides: Partial<{
    id: string;
    nameSingular: string;
    isAuditLogged: boolean;
    isSystem: boolean;
  }> = {},
) => ({
  id: 'company-object-id',
  nameSingular: 'company',
  isAuditLogged: true,
  isSystem: false,
  ...overrides,
});

describe('deriveDefaultTimelineActivityRule', () => {
  it('should derive a self rule for an audit logged non system object', () => {
    const rule = deriveDefaultTimelineActivityRule(buildFlatObjectMetadata());

    expect(rule).toEqual({
      objectMetadataId: 'company-object-id',
      objectNameSingular: 'company',
      relationFieldMetadataId: null,
      resolution: 'MATERIALIZED',
      actions: ['created', 'updated', 'deleted', 'restored'],
      triggerFieldMetadataIds: null,
      triggerFieldNames: null,
      labelFieldMetadataId: null,
      labelFieldName: null,
      isActive: true,
      targetShape: { kind: 'SELF' },
    });
  });

  it('should not derive a rule when the object is not audit logged', () => {
    expect(
      deriveDefaultTimelineActivityRule(
        buildFlatObjectMetadata({ isAuditLogged: false }),
      ),
    ).toBeUndefined();
  });

  it('should not derive a rule for a system object', () => {
    expect(
      deriveDefaultTimelineActivityRule(
        buildFlatObjectMetadata({ isSystem: true, nameSingular: 'noteTarget' }),
      ),
    ).toBeUndefined();
  });
});
