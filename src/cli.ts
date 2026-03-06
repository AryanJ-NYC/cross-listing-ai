#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { runDoctorCommand } from './commands/doctor.js';
import { runGenerateCommand } from './commands/generate.js';

type CliDependencies = {
  runDoctorCommand?: typeof runDoctorCommand;
  runGenerateCommand?: typeof runGenerateCommand;
  setExitCode?: (value: number) => void;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
};

export function buildCli(dependencies: CliDependencies = {}) {
  const writeStdout = dependencies.stdout?.write.bind(dependencies.stdout) ?? process.stdout.write.bind(process.stdout);
  const writeStderr = dependencies.stderr?.write.bind(dependencies.stderr) ?? process.stderr.write.bind(process.stderr);
  const setExitCode = dependencies.setExitCode ?? ((value: number) => {
    process.exitCode = value;
  });
  const runGenerate = dependencies.runGenerateCommand ?? runGenerateCommand;
  const runDoctor = dependencies.runDoctorCommand ?? runDoctorCommand;
  const program = new Command();

  program
    .name('crosslist')
    .description('Generate cross-marketplace listing copy from hosted product images.')
    .version('1.0.0');

  program
    .command('generate')
    .description('Generate marketplace-ready listings from hosted image URLs or a JSON input file.')
    .option('--interactive', 'Run the seller review flow')
    .option('--images <images...>', 'Hosted image URLs')
    .option('--input <path>', 'Path to a JSON input file')
    .option('--marketplaces <marketplaces>', 'Comma-separated marketplaces')
    .option('--output <format>', 'text, json, or both')
    .option('--api-base-url <url>', 'Override the SatStash API base URL')
    .action(async (options) => {
      await runCommand(async () => {
        const result = await runGenerate(options);
        writeStdout(`${result.output}\n`);
        setExitCode(result.exitCode);
      }, writeStderr, setExitCode);
    });

  program
    .command('doctor')
    .description('Check runtime prerequisites for crosslist.')
    .argument('[images...]', 'Optional hosted image URLs to validate')
    .option('--images <images...>', 'Hosted image URLs')
    .option('--output <format>', 'text, json, or both', 'text')
    .option('--api-base-url <url>', 'Override the SatStash API base URL')
    .action(async (images: string[], options: { apiBaseUrl?: string; images?: string[]; output?: string }) => {
      await runCommand(async () => {
        const result = await runDoctor({
          apiBaseUrl: options.apiBaseUrl,
          images: [...images, ...(options.images ?? [])],
          output: options.output,
        });
        writeStdout(`${result.output}\n`);
        setExitCode(result.exitCode);
      }, writeStderr, setExitCode);
    });

  return program;
}

export async function runCli(argv = process.argv) {
  await buildCli().parseAsync(argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void runCli();
}

async function runCommand(
  action: () => Promise<void>,
  writeStderr: (chunk: string) => boolean,
  setExitCode: (value: number) => void
) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStderr(`Error: ${message}\n`);
    setExitCode(1);
  }
}
