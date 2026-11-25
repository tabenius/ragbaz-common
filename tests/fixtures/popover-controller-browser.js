import { createPopoverController } from '../../src/widgets/dom.js';

const trigger = document.querySelector('[data-trigger]');
const panel = document.querySelector('[data-panel]');
window.__controller = createPopoverController({ trigger, panel, label: 'Plain actions' });
