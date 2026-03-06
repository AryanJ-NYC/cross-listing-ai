import { afterEach, describe, expect, test, vi } from 'vitest';

import { runDoctor, runDoctorCommand } from '../src/commands/doctor.js';

describe('runDoctor', () => {
  afterEach(() => {
    delete process.env.CROSSLIST_API_BASE_URL;
  });

  test('passes when the public API is reachable and no images are being checked', async () => {
    const result = await runDoctor({
      apiBaseUrl: 'https://satstash.test',
      apiSupportCheck: async () => true,
      reachabilityCheck: async () => true,
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'node',
          status: 'pass',
        }),
        expect.objectContaining({
          name: 'api:https://satstash.test',
          status: 'pass',
        }),
      ])
    );
  });

  test('reports unreachable APIs and local file inputs as failures', async () => {
    const result = await runDoctor({
      apiBaseUrl: 'https://satstash.test',
      imageInputs: ['/tmp/item.jpg', 'https://example.com/a.png'],
      apiSupportCheck: async () => false,
      reachabilityCheck: async (url) => url === 'https://example.com/a.png',
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api:https://satstash.test',
          status: 'fail',
        }),
        expect.objectContaining({
          name: 'image:/tmp/item.jpg',
          status: 'fail',
        }),
      ])
    );
  });

  test('can emit structured JSON for automation consumers', async () => {
    const result = await runDoctorCommand(
      {
        apiBaseUrl: 'https://satstash.test',
        images: ['/tmp/does-not-exist.jpg'],
        output: 'json',
      },
      {
        apiSupportCheck: async () => true,
        reachabilityCheck: async () => true,
      }
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: false,
    });
  });

  test('prefers the explicit API base URL over the environment variable', async () => {
    process.env.CROSSLIST_API_BASE_URL = 'https://env.example';
    const seenUrls: string[] = [];

    await runDoctor({
      apiBaseUrl: 'https://flag.example',
      apiSupportCheck: async (url) => {
        seenUrls.push(url);
        return true;
      },
      reachabilityCheck: async (url) => {
        return true;
      },
    });

    expect(seenUrls[0]).toContain('https://flag.example/api/public/v1/openapi.json');
  });

  test('fails invalid API base URLs cleanly', async () => {
    const result = await runDoctor({
      apiBaseUrl: 'not a url',
      apiSupportCheck: vi.fn(),
      reachabilityCheck: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api:not a url',
          status: 'fail',
        }),
      ])
    );
  });

  test('fails when the public API docs are reachable but the crosslist route is missing', async () => {
    const result = await runDoctor({
      apiBaseUrl: 'https://satstash.test',
      apiSupportCheck: async () => false,
      reachabilityCheck: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api:https://satstash.test',
          status: 'fail',
        }),
      ])
    );
  });
});
