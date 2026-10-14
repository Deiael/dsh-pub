/** FNV-1a 32-bit. Keep identical to `apps/server/src/plugin-page-shards.ts`. */
export const PLUGIN_PAGE_SHARD_COUNT = 64;
export const PLUGIN_PAGE_ASSET_PREFIX = '_plugin-pages';
export const WORKERS_STATIC_ASSET_FILE_LIMIT = 20_000;
export const WORKERS_STATIC_ASSET_FILE_SIZE_LIMIT = 25 * 1024 * 1024;

export function pluginPageShardIndex(slug, shardCount = PLUGIN_PAGE_SHARD_COUNT) {
  let hash = 2166136261;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % shardCount;
}

export function packedPluginPageAssetPath(
  locale,
  shardIndex,
  shardCount = PLUGIN_PAGE_SHARD_COUNT,
) {
  if (shardIndex < 0 || shardIndex >= shardCount) {
    throw new RangeError(`plugin page shard index ${shardIndex} is out of range`);
  }
  return `/${PLUGIN_PAGE_ASSET_PREFIX}/${locale}/${shardIndex}.json`;
}
