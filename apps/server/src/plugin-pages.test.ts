import { afterEach, describe, expect, it } from 'vitest';

import { packedPluginPageAssetPath, pluginPageShardIndex } from './plugin-page-shards.js';
import { clearPackedPluginPageCache, servePluginDetailPage } from './plugin-pages.js';

afterEach(() => {
  clearPackedPluginPageCache();
});

const html = (body: string, status = 200) =>
  new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status });

const assetsFor = (pages: Record<string, Response | (() => Response)>) => ({
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    const match = pages[path];
    if (!match) return html('not found', 404);
    return typeof match === 'function' ? match() : match.clone();
  },
});

describe('packed automated plugin pages', () => {
  it('passes prerendered official pages through unchanged', async () => {
    const assets = assetsFor({
      '/en/plugins/dsh-genui/': html('official genui'),
    });
    const response = await servePluginDetailPage(
      new Request('https://dsh.pub/en/plugins/dsh-genui/'),
      assets,
    );
    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe('official genui');
  });

  it('reconstructs packed automated pages when the individual HTML file is absent', async () => {
    const slug = 'open-sea-skin';
    const shardPath = packedPluginPageAssetPath('zh', pluginPageShardIndex(slug));
    const assets = assetsFor({
      [shardPath]: new Response(JSON.stringify({ [slug]: '<p>目录摘要</p>' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    });
    const response = await servePluginDetailPage(
      new Request('https://dsh.pub/zh/plugins/open-sea-skin/'),
      assets,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    await expect(response?.text()).resolves.toContain('目录摘要');
  });

  it('keeps the static 404 when a plugin slug is neither prerendered nor packed', async () => {
    const assets = assetsFor({});
    const response = await servePluginDetailPage(
      new Request('https://dsh.pub/en/plugins/missing-plugin/'),
      assets,
    );
    expect(response?.status).toBe(404);
    await expect(response?.text()).resolves.toBe('not found');
  });

  it('ignores non-detail routes so the catalog listing stays an asset fetch', async () => {
    const response = await servePluginDetailPage(
      new Request('https://dsh.pub/en/plugins/'),
      assetsFor({}),
    );
    expect(response).toBeUndefined();
  });
});
