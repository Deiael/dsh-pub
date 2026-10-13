/** FNV-1a 32-bit. Keep identical to `scripts/lib/plugin-page-shards.mjs`. */
export const PLUGIN_PAGE_SHARD_COUNT = 64;

export const PLUGIN_PAGE_ASSET_PREFIX = '_plugin-pages';

export const PLUGIN_DETAIL_PATH_PATTERN = /^\/(en|zh)\/plugins\/([^/]+)\/?$/;

export function pluginPageShardIndex(
  slug: string,
  shardCount: number = PLUGIN_PAGE_SHARD_COUNT,
): number {
  let hash = 2166136261;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % shardCount;
}

export function packedPluginPageAssetPath(
  locale: string,
  shardIndex: number,
  shardCount: number = PLUGIN_PAGE_SHARD_COUNT,
): string {
  if (shardIndex < 0 || shardIndex >= shardCount) {
    throw new RangeError(`plugin page shard index ${shardIndex} is out of range`);
  }
  return `/${PLUGIN_PAGE_ASSET_PREFIX}/${locale}/${shardIndex}.json`;
}

export function parsePluginDetailPath(
  pathname: string,
): { locale: 'en' | 'zh'; slug: string } | undefined {
  const match = PLUGIN_DETAIL_PATH_PATTERN.exec(pathname);
  if (!match?.[1] || !match[2]) return undefined;
  return { locale: match[1] === 'zh' ? 'zh' : 'en', slug: match[2] };
}
