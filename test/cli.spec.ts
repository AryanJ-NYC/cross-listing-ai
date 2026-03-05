import { describe, expect, test } from 'vitest';

import { buildCli } from '../src/cli.js';

describe('cli', () => {
  test('registers generate and doctor commands', () => {
    const program = buildCli();

    expect(program.commands.map((command) => command.name())).toEqual(['generate', 'doctor']);
  });

  test('prints a friendly error and sets exitCode when a command handler throws', async () => {
    let stderr = '';
    let stdout = '';
    let exitCode = 0;

    const program = buildCli({
      runGenerateCommand: async () => {
        throw new Error('Invalid marketplaces: nope');
      },
      setExitCode: (value) => {
        exitCode = value;
      },
      stderr: {
        write: (chunk: string) => {
          stderr += chunk;
          return true;
        },
      },
      stdout: {
        write: (chunk: string) => {
          stdout += chunk;
          return true;
        },
      },
    });

    await program.parseAsync(['node', 'crosslist', 'generate', '--images', 'demo.jpg']);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid marketplaces: nope');
    expect(stdout).toBe('');
  });
});
