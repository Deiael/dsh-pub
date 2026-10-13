import {
  packedPluginPageAssetPath,
  parsePluginDetailPath,
  pluginPageShardIndex,
} from './plugin-page-shards.js';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

type PackedShard = Record<string, string>;

const shardCache = new Map<string, Promise<PackedShard | undefined>>();

const isPackedShard = (value: unknown): value is PackedShard => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((html) => typeof html === 'string');
};

const fetchPackedShard = async (
  assets: AssetsBinding,
  request: Request,
  locale: string,
  shardIndex: number,
): Promise<PackedShard | undefined> => {
  const target = new URL(packedPluginPageAssetPath(locale, shardIndex), request.url);
  const response = await assets.fetch(new Request(target));
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  return isPackedShard(body) ? body : undefined;
};

const loadPackedShard = (
  assets: AssetsBinding,
  request: Request,
  locale: string,
  shardIndex: number,
): Promise<PackedShard | undefined> => {
  const cacheKey = `${locale}:${shardIndex}`;
  const cached = shardCache.get(cacheKey);
  if (cached) return cached;
  const pending = fetchPackedShard(assets, request, locale, shardIndex).catch((error: unknown) => {
    shardCache.delete(cacheKey);
    throw error;
  });
  shardCache.set(cacheKey, pending);
  return pending;
};

export const clearPackedPluginPageCache = (): void => {
  shardCache.clear();
};

export const loadPackedPluginPage = async (
  assets: AssetsBinding,
  request: Request,
  locale: string,
  slug: string,
): Promise<string | undefined> => {
  const shard = await loadPackedShard(assets, request, locale, pluginPageShardIndex(slug));
  return shard?.[slug];
};

export const servePluginDetailPage = async (
  request: Request,
  assets: AssetsBinding,
): Promise<Response | undefined> => {
  const parsed = parsePluginDetailPath(new URL(request.url).pathname);
  if (!parsed) return undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;

  const asset = await assets.fetch(request);
  if (asset.status !== 404) return asset;

  let html: string | undefined;
  try {
    html = await loadPackedPluginPage(assets, request, parsed.locale, parsed.slug);
  } catch {
    return asset;
  }
  if (!html) return asset;

  return new Response(request.method === 'HEAD' ? null : html, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'text/html; charset=utf-8',
    },
    status: 200,
  });
};
