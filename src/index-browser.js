import {setWindow} from './index.js';

// @ts-expect-error - globalThis in browser context is Window
setWindow(globalThis);

export * from './index.js';
