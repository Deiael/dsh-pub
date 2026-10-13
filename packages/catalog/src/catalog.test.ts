import communitySources from './community.sources.json';
import ecosystemCatalog from './ecosystem.generated.json';
import excludedRepositoryPolicy from './excluded-repositories.json';
import catalog, { communityCatalog, getCatalogEntry } from './index.js';
import installableRegistry from '../../../apps/server/src/installable-slugs.generated.json';
import directorySnapshot from '../../../apps/dsh-plugin/src/client/catalog.generated.json';

const slugPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const installMetricSlug = (repository: string, directory: string) => {
  const url = new URL(repository);
  const repositorySlug = url.pathname.replace(/^\//, '').split('/').map(slugPart).join('--');
  const directorySlug = directory.split('/').map(slugPart).filter(Boolean).join('--');
  return directorySlug ? `${repositorySlug}--${directorySlug}` : repositorySlug;
};

describe('Harness catalog snapshot', () => {
  it('keeps Loader classification totals and bundle overlays distinct', () => {
    expect(catalog.totals).toMatchObject({
      packages: 219,
      plugins: 170,
      seams: 15,
      libraries: 34,
      bundles: 3,
      configurable: 105,
      client: 39,
    });
    expect(catalog.totals.plugins + catalog.totals.seams + catalog.totals.libraries).toBe(
      catalog.totals.packages,
    );
    expect(catalog.entries).toHaveLength(catalog.totals.packages);
    expect(catalog.entries.filter((entry) => entry.runtime.hostLoadable)).toHaveLength(170);
  });

  it('publishes stable required fields for every entry', () => {
    for (const entry of catalog.entries) {
      expect(entry.id).toBe(entry.name);
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.name).toMatch(/^@deepseek-ai\/dsh-/);
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(entry.license).toBeTruthy();
      expect(['plugin', 'bundle', 'seam', 'library']).toContain(entry.type);
      expect(entry.description.en).toBeTruthy();
      expect(entry.description.zh).toBeTruthy();
      expect(entry.source.commit).toBe(catalog.source.commit);
      expect(entry.source.directory).toMatch(/^packages\/[a-z0-9-]+\/[a-z0-9-]+$/);
      expect(entry.capabilities.tools).toEqual(expect.any(Array));
      expect(entry.capabilities.uiContributions).toEqual(expect.any(Array));
      expect(entry.capabilities.uiSlotsDeclared).toEqual(expect.any(Array));
      expect(entry.availability.profiles).toEqual(expect.any(Array));
      expect(entry.docs.readmePath).toMatch(/^packages\//);
      expect(entry.docs.readme.en).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/deepseek-ai\/deepseek-harness\//,
      );
      expect(entry.docs.readme.zh).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/deepseek-ai\/deepseek-harness\//,
      );
    }
    const shellEnv = catalog.entries.find((entry) => entry.name === '@deepseek-ai/dsh-shell-env');
    const uiPlan = catalog.entries.find(
      (entry) => entry.name === '@deepseek-ai/dsh-client-ui-plan',
    );
    expect(shellEnv?.docs.modelExperience.zh).not.toBe('');
    expect(shellEnv?.docs.limitations.zh).not.toBe('');
    expect(uiPlan?.docs.limitations.zh).not.toBe('');
  });

  it('keeps manifest-declared bundles as included profile layers, not install targets', () => {
    const installable = catalog.entries.filter((entry) => entry.distribution.installable);
    expect(installable).toHaveLength(0);
    const bundles = catalog.entries.filter((entry) => entry.type === 'bundle');
    expect(bundles.map((entry) => entry.name).sort()).toEqual([
      '@deepseek-ai/dsh-base',
      '@deepseek-ai/dsh-headless',
      '@deepseek-ai/dsh-web-app',
    ]);
    for (const entry of catalog.entries) {
      expect(entry.distribution.installable).toBe(false);
      expect(entry.distribution.mode).toBe('built-in');
      expect(entry.distribution).not.toHaveProperty('command');
      if (entry.type === 'bundle') {
        expect(entry.distribution.activation).toBe('profile-layer');
        expect(entry.distribution.note.en).toContain('does not prove');
        expect(entry.distribution.note.zh).toContain('不代表');
      } else {
        expect(entry.distribution).not.toHaveProperty('activation');
      }
    }
    expect(getCatalogEntry('base')?.availability.profiles).toEqual(['base', 'headless', 'web']);
    expect(getCatalogEntry('missing-plugin')).toBeUndefined();
  });

  it('keeps the community collection separate, pinned, and source-contract reviewed', () => {
    expect(communityCatalog.entries).toHaveLength(communitySources.entries.length);

    const sourceByCoordinate = new Map<string, (typeof communitySources.entries)[number]>();
    for (const source of communitySources.entries) {
      const key = `${source.repository}\0${source.directory}`;
      if (!sourceByCoordinate.has(key)) sourceByCoordinate.set(key, source);
    }

    const officialSlugs = new Set(catalog.entries.map((entry) => entry.slug));
    const communitySlugs = new Set<string>();
    const metricSlugs = new Set<string>();
    const violations: string[] = [];
    const totals = { reviewed: 0, submitted: 0, automated: 0, installable: 0 };

    for (const entry of communityCatalog.entries) {
      const source = sourceByCoordinate.get(
        `${entry.source.repository}\0${entry.source.directory}`,
      );
      if (!source) {
        violations.push(`${entry.slug}: missing pinned source`);
        continue;
      }
      if (!/^[a-f0-9]{40}$/.test(entry.source.commit)) {
        violations.push(`${entry.slug}: commit is not a 40-character SHA`);
      }
      if (entry.source.commit !== source.commit) {
        violations.push(`${entry.slug}: commit does not match source pin`);
      }
      if (entry.source.directory !== source.directory) {
        violations.push(`${entry.slug}: directory does not match source pin`);
      }
      if (entry.name !== source.packageName) {
        violations.push(`${entry.slug}: package name does not match source pin`);
      }
      const status = entry.provenance?.status;
      if (status === 'community-reviewed') totals.reviewed += 1;
      else if (status === 'community-submitted') totals.submitted += 1;
      else if (status === 'community-automated') totals.automated += 1;
      else violations.push(`${entry.slug}: provenance status ${String(status)}`);
      if (!entry.provenance?.statement.en.includes('security audit')) {
        violations.push(`${entry.slug}: English provenance omits security audit`);
      }
      if (!entry.provenance?.statement.zh.includes('安全审计')) {
        violations.push(`${entry.slug}: Chinese provenance omits 安全审计`);
      }
      if (
        entry.distribution.installable !== true ||
        entry.distribution.mode !== 'git-bundle' ||
        entry.distribution.activation !== 'profile-layer'
      ) {
        violations.push(`${entry.slug}: distribution is not an installable git bundle`);
      } else {
        totals.installable += 1;
      }
      if (officialSlugs.has(entry.slug)) {
        violations.push(`${entry.slug}: collides with an official catalog slug`);
      }
      if (communitySlugs.has(entry.slug)) {
        violations.push(`${entry.slug}: duplicate community slug`);
      }
      communitySlugs.add(entry.slug);
      metricSlugs.add(installMetricSlug(entry.source.repository, entry.source.directory));
    }

    expect(violations).toEqual([]);
    expect(communityCatalog.totals).toEqual(totals);
    expect(metricSlugs).toEqual(new Set(installableRegistry.slugs));

    expect(getCatalogEntry('dsh-genui')?.source.repository).toBe(
      'https://github.com/omdsh-dev/dsh-genui',
    );
    expect(getCatalogEntry('dsh-at-file')?.capabilities.uiContributions).toEqual([
      { slot: 'conversation.input.dock', id: 'at-file', component: 'FilesDock' },
      { slot: 'settings.section', id: 'at-file', component: 'AtFileSection' },
    ]);
    expect(getCatalogEntry('dsh-genui')?.capabilities).toMatchObject({
      tools: [{ name: 'render_ui' }, { name: 'validate_dsh_ui' }],
      uiContributions: [
        { slot: 'tool.call.toolview', id: 'render_ui', component: 'GenuiToolView' },
        { slot: 'conversation.input.dock', id: 'genui-panel', component: 'GenuiPanel' },
      ],
    });
    expect(getCatalogEntry('dsh-cc-tui')?.capabilities.uiContributions).toEqual([]);
    expect(getCatalogEntry('dsh-automation')?.capabilities).toMatchObject({
      tools: [
        { name: 'automation_create' },
        { name: 'automation_list' },
        { name: 'automation_update' },
        { name: 'automation_runs' },
        { name: 'automation_run_now' },
        { name: 'automation_delete' },
      ],
      uiContributions: [
        { slot: 'conversation.view', id: 'automation', component: 'AutomationView' },
      ],
    });
  });

  it('keeps publisher-delisted repositories out of generated catalog surfaces', () => {
    expect(excludedRepositoryPolicy.schemaVersion).toBe(1);
    expect(excludedRepositoryPolicy.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue: 112,
          repository: 'https://github.com/GooDAnDReaDY/dsh-fal-image-gen',
        }),
        expect.objectContaining({
          issue: 112,
          repository: 'https://github.com/GooDAnDReaDY/dsh-im-hub-media',
        }),
      ]),
    );

    const excluded = new Set(
      excludedRepositoryPolicy.repositories.map((entry) => entry.repository.toLocaleLowerCase()),
    );
    const catalogRepositories = [
      ...communityCatalog.entries.map((entry) => entry.source.repository),
      ...communitySources.entries.map((entry) => entry.repository),
      ...ecosystemCatalog.entries.map((entry) => entry.sourceRepository),
      ...directorySnapshot.entries.map((entry) => entry.repository),
    ];
    expect(
      catalogRepositories.some((repository) => excluded.has(repository.toLocaleLowerCase())),
    ).toBe(false);
    expect(installableRegistry.slugs).not.toContain('goodandready--dsh-fal-image-gen');
    expect(installableRegistry.slugs).not.toContain('goodandready--dsh-im-hub-media');
    expect(communityCatalog.entries.map((entry) => entry.slug)).not.toContain('dsh-fal-image-gen');
    expect(communityCatalog.entries.map((entry) => entry.slug)).not.toContain('dsh-im-hub-media');
    expect(getCatalogEntry('dsh-fal-image-gen')).toBeUndefined();
    expect(getCatalogEntry('dsh-im-hub-media')).toBeUndefined();
  });
});
