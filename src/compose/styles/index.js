import { ambient } from './ambient.js';
import { focus } from './focus.js';
import { garage } from './garage.js';
import { house } from './house.js';
import { lofi } from './lofi.js';
import { wave } from './wave.js';

export const styles = Object.fromEntries([focus, lofi, house, garage, wave, ambient].map((s) => [s.id, s]));
