import {JSDOM} from 'jsdom';
import {setWindow} from './index.js';

const {window} = new JSDOM('');
setWindow(window);

export * from './index.js';
