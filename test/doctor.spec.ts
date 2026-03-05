import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, test } from 'vitest';

import { runDoctor, runDoctorCommand } from '../src/commands/doctor.js';

describe('runDoctor', () => {
  test('passes JSON-only workflows without an OpenAI key when no image extraction is being validated', async () => {
    const result = await runDoctor({
      env: {},
      imageInputs: [],
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'OPENAI_API_KEY',
          status: 'pass',
        }),
      ])
    );
  });

  test('reports missing OpenAI credentials and missing local files', async () => {
    const result = await runDoctor({
      env: {},
      imageInputs: ['/tmp/does-not-exist.jpg', 'https://example.com/a.png'],
      reachabilityCheck: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'OPENAI_API_KEY',
          status: 'fail',
        }),
        expect.objectContaining({
          name: 'image:/tmp/does-not-exist.jpg',
          status: 'fail',
        }),
      ])
    );
  });

  test('can emit structured JSON for automation consumers', async () => {
    const result = await runDoctorCommand(
      {
        images: ['/tmp/does-not-exist.jpg'],
        output: 'json',
      },
      {
        env: {},
        reachabilityCheck: async () => true,
      }
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: false,
    });
  });

  test('fails whitespace-only API keys, directories, and unsupported local formats', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'crosslist-doctor-'));
    const heicPath = join(directory, 'sample.heic');
    writeFileSync(heicPath, 'not-a-real-heic');

    const result = await runDoctor({
      env: { OPENAI_API_KEY: '   ' },
      imageInputs: [directory, heicPath],
      reachabilityCheck: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'OPENAI_API_KEY',
          status: 'fail',
        }),
        expect.objectContaining({
          name: `image:${directory}`,
          status: 'fail',
        }),
        expect.objectContaining({
          name: `image:${heicPath}`,
          status: 'fail',
        }),
      ])
    );
  });
});
