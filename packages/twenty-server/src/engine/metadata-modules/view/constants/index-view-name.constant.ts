import { msg } from '@lingui/core/macro';

import { i18nLabel } from 'src/engine/workspace-manager/twenty-standard-application/utils/i18n-label.util';

// The name every INDEX view is minted with, as a source message: the sentence
// reaches translators whole and the object label is substituted at read time.
export const INDEX_VIEW_NAME = i18nLabel(msg`All {objectLabelPlural}`);
