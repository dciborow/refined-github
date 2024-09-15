import {observe} from '../helpers/selector-observer';
import {switchAccountIfNecessary} from '../helpers/account-utils';

function init(): void {
  observe('.account-selector', switchAccountIfNecessary);
}

void features.add({
  id: __filebasename,
  include: [
    pageDetect.isPR
  ],
  init
});
