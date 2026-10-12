import { describe, expect, it } from 'vitest';

import {
  MAX_BUNDLE_PATCHES,
  catalogBundlePatchPath,
  normalizeBundlePatchPaths,
} from './lib/bundle-patch.mjs';

class Rejected extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const normalizePath = (value: string) => {
  const input = value.trim().replace(/\/+$/g, '');
  if (
    !input ||
    input.startsWith('/') ||
    input.includes('..') ||
    input.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Rejected('invalid_path', 'Package path must be a safe relative repository path.');
  }
  return input;
};

const normalize = (value: unknown) =>
  normalizeBundlePatchPaths(value, {
    missingCode: 'invalid_manifest',
    missingMessage: 'package.json must declare dsh.bundle.patch.',
    normalizePath,
    reject: (code, message) => {
      throw new Rejected(code, message);
    },
  });

describe('bundle patch declaration', () => {
  it('accepts a single relative string and keeps the catalog shape as a string', () => {
    expect(normalize('./cordis.patch.yml')).toEqual(['cordis.patch.yml']);
    expect(catalogBundlePatchPath(normalize('cordis.patch.yml'))).toBe('cordis.patch.yml');
  });

  it('accepts a bounded array of relative paths', () => {
    expect(normalize(['./cordis.patch.yml', './presets/cordis.patch.yml'])).toEqual([
      'cordis.patch.yml',
      'presets/cordis.patch.yml',
    ]);
    expect(
      catalogBundlePatchPath(normalize(['./cordis.patch.yml', './presets/cordis.patch.yml'])),
    ).toEqual(['cordis.patch.yml', 'presets/cordis.patch.yml']);
  });

  it('keeps a one-entry array as a string in catalog output', () => {
    expect(catalogBundlePatchPath(normalize(['./cordis.patch.yml']))).toBe('cordis.patch.yml');
  });

  it('rejects an empty array', () => {
    expect(() => normalize([])).toThrowError(
      expect.objectContaining({
        code: 'invalid_manifest',
        message: 'dsh.bundle.patch must be a non-empty array of paths.',
      }),
    );
  });

  it('rejects an array longer than the bound', () => {
    const paths = Array.from(
      { length: MAX_BUNDLE_PATCHES + 1 },
      (_, index) => `patch-${index}.yml`,
    );
    expect(() => normalize(paths)).toThrowError(
      expect.objectContaining({
        code: 'invalid_manifest',
        message: `dsh.bundle.patch must contain at most ${MAX_BUNDLE_PATCHES} paths.`,
      }),
    );
  });

  it('rejects duplicate paths after normalization', () => {
    expect(() => normalize(['./cordis.patch.yml', 'cordis.patch.yml'])).toThrowError(
      expect.objectContaining({
        code: 'invalid_manifest',
        message: 'dsh.bundle.patch must not contain duplicate paths.',
      }),
    );
  });

  it('rejects a bad path inside an array', () => {
    expect(() => normalize(['./cordis.patch.yml', '../outside.yml'])).toThrowError(
      expect.objectContaining({ code: 'invalid_path' }),
    );
  });

  it('treats a missing declaration as the caller-supplied missing error', () => {
    expect(() => normalize(undefined)).toThrowError(
      expect.objectContaining({
        code: 'invalid_manifest',
        message: 'package.json must declare dsh.bundle.patch.',
      }),
    );
    expect(() => normalize('')).toThrowError(
      expect.objectContaining({
        code: 'invalid_manifest',
        message: 'package.json must declare dsh.bundle.patch.',
      }),
    );
  });
});
