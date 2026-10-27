import { readFile } from 'node:fs/promises';
const status = JSON.parse(await readFile(process.argv[2], 'utf8'));
process.exit(Date.now() - status.at < 60000 && status.encoderAlive && status.encoded.seconds > 0 ? 0 : 1);
