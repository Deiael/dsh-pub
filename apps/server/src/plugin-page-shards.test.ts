import { describe, expect, it } from 'vitest';

import {
  packedPluginPageAssetPath,
  parsePluginDetailPath,
  pluginPageShardIndex,
  PLUGIN_PAGE_SHARD_COUNT,
} from './plugin-page-shards.js';

describe('plugin page shard coordinates', () => {
  it('maps slugs onto a stable shard range', () => {
    for (const slug of ['open-sea-skin', 'dsh-genui', 'web-app', 'a']) {
      expect(pluginPageShardIndex(slug)).toBeGreaterThanOrEqual(0);
      expect(pluginPageShardIndex(slug)).toBeLessThan(PLUGIN_PAGE_SHARD_COUNT);
    }
    expect(packedPluginPageAssetPath('en', 0)).toBe('/_plugin-pages/en/0.json');
  });

  it('parses bilingual plugin detail paths and ignores listing and API routes', () => {
    expect(parsePluginDetailPath('/en/plugins/open-sea-skin/')).toEqual({
      locale: 'en',
      slug: 'open-sea-skin',
    });
    expect(parsePluginDetailPath('/zh/plugins/open-sea-skin')).toEqual({
      locale: 'zh',
      slug: 'open-sea-skin',
    });
    expect(parsePluginDetailPath('/en/plugins/')).toBeUndefined();
    expect(parsePluginDetailPath('/api/plugins')).toBeUndefined();
    expect(parsePluginDetailPath('/en/')).toBeUndefined();
  });
});
