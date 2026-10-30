import { broken } from './broken.js';
import { deep } from './deep.js';
import { melodic } from './melodic.js';
import { slow } from './slow.js';

export const styles = Object.fromEntries([melodic, deep, broken, slow].map((s) => [s.id, s]));
