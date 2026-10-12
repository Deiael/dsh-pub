export const MAX_BUNDLE_PATCHES = 8;

const isBlank = (value) => typeof value !== 'string' || !value.trim();

const stripLeadingDotSlash = (value) => value.trim().replace(/^\.\//, '');

export const catalogBundlePatchPath = (paths) => (paths.length === 1 ? paths[0] : [...paths]);

export function normalizeBundlePatchPaths(
  value,
  { missingCode, missingMessage, normalizePath, reject },
) {
  if (typeof value === 'string') {
    if (!value.trim()) reject(missingCode, missingMessage);
    return [normalizePath(stripLeadingDotSlash(value))];
  }

  if (!Array.isArray(value)) {
    reject(missingCode, missingMessage);
  }

  if (value.length === 0) {
    reject('invalid_manifest', 'dsh.bundle.patch must be a non-empty array of paths.');
  }

  if (value.length > MAX_BUNDLE_PATCHES) {
    reject(
      'invalid_manifest',
      `dsh.bundle.patch must contain at most ${MAX_BUNDLE_PATCHES} paths.`,
    );
  }

  if (value.some((entry) => typeof entry !== 'string')) {
    reject('invalid_manifest', 'dsh.bundle.patch array entries must be strings.');
  }

  if (value.some(isBlank)) {
    reject('invalid_manifest', 'dsh.bundle.patch array entries must be non-empty strings.');
  }

  const paths = value.map((entry) => normalizePath(stripLeadingDotSlash(entry)));
  if (new Set(paths).size !== paths.length) {
    reject('invalid_manifest', 'dsh.bundle.patch must not contain duplicate paths.');
  }
  return paths;
}
