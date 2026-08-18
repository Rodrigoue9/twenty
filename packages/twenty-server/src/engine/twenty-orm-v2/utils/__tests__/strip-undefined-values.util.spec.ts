import { stripUndefinedValues } from 'src/engine/twenty-orm-v2/utils/strip-undefined-values.util';

describe('stripUndefinedValues', () => {
  it('should drop undefined values and keep everything else', () => {
    expect(
      stripUndefinedValues({
        deletedAt: null,
        companyId: undefined,
        name: '',
        score: 0,
        isActive: false,
      }),
    ).toEqual({ deletedAt: null, name: '', score: 0, isActive: false });
  });

  it('should return an empty record unchanged', () => {
    expect(stripUndefinedValues({})).toEqual({});
  });
});
