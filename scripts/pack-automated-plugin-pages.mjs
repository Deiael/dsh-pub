import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packAutomatedPluginPages } from './lib/pack-automated-plugin-pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const result = await packAutomatedPluginPages({ root });
  console.log(
    `Packed ${result.packed} automated plugin pages (${result.slugs} slugs) into shards; ${result.fileCount} static assets remain (limit ${result.fileLimit}).`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
