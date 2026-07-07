import * as botanical from '../styles/botanical.js';
import * as geometric from '../styles/geometric.js';
import * as textile from '../styles/textile.js';
import * as seasonal from '../styles/seasonal.js';
import * as commercial from '../styles/commercial.js';

export const STYLE_MODULES = { botanical, geometric, textile, seasonal, commercial };
export const FAMILY_IDS = Object.keys(STYLE_MODULES);
export const FAMILY_LIST = FAMILY_IDS.map((id) => STYLE_MODULES[id].FAMILY);
