import { stat } from 'node:fs/promises';

import { isSupportedLocalImagePath } from '../core/providers/openai.js';
import {
  type DoctorCheck,
  type DoctorResult,
  DoctorResultSchema,
  OutputFormatSchema,
  type OutputFormat,
} from '../core/schemas.js';

export async function runDoctor(options: {
  env?: NodeJS.ProcessEnv;
  imageInputs?: string[];
  nodeVersion?: string;
  reachabilityCheck?: (url: string) => Promise<boolean>;
} = {}): Promise<DoctorResult> {
  const env = options.env ?? process.env;
  const imageInputs = options.imageInputs ?? [];
  const reachabilityCheck = options.reachabilityCheck ?? defaultReachabilityCheck;
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion(options.nodeVersion ?? process.versions.node));
  checks.push(checkOpenAIKey(env.OPENAI_API_KEY, imageInputs.length > 0));

  for (const input of imageInputs) {
    checks.push(await checkImageInput(input, reachabilityCheck));
  }

  const result = {
    checks,
    humanReadable: checks
      .map((check) => `[${check.status.toUpperCase()}] ${check.name}: ${check.message}`)
      .join('\n'),
    ok: checks.every((check) => check.status === 'pass'),
  };

  return DoctorResultSchema.parse(result);
}

export async function runDoctorCommand(
  options: {
    images?: string[];
    output?: string;
  },
  dependencies: {
    env?: NodeJS.ProcessEnv;
    nodeVersion?: string;
    reachabilityCheck?: (url: string) => Promise<boolean>;
  } = {}
) {
  const result = await runDoctor({
    env: dependencies.env,
    imageInputs: options.images,
    nodeVersion: dependencies.nodeVersion,
    reachabilityCheck: dependencies.reachabilityCheck,
  });
  const requestedOutput = OutputFormatSchema.parse(options.output ?? 'text');

  return {
    exitCode: result.ok ? 0 : 1,
    output: formatOutput(result, requestedOutput),
    result,
  };
}

async function checkImageInput(
  input: string,
  reachabilityCheck: (url: string) => Promise<boolean>
): Promise<DoctorCheck> {
  if (/^https?:\/\//i.test(input)) {
    const reachable = await reachabilityCheck(input);
    return {
      message: reachable ? 'Remote image URL is reachable.' : 'Remote image URL could not be reached.',
      name: `image:${input}`,
      status: reachable ? 'pass' : 'fail',
    };
  }

  const details = await stat(input).catch(() => null);
  if (!details) {
    return {
      message: 'Local image file was not found.',
      name: `image:${input}`,
      status: 'fail',
    };
  }

  if (!details.isFile()) {
    return {
      message: 'Local image path must point to a file, not a directory.',
      name: `image:${input}`,
      status: 'fail',
    };
  }

  if (!isSupportedLocalImagePath(input)) {
    return {
      message: 'Local image must use .jpg, .jpeg, .png, or .webp.',
      name: `image:${input}`,
      status: 'fail',
    };
  }

  return {
    message: 'Local image file exists and uses a supported format.',
    name: `image:${input}`,
    status: 'pass',
  };
}

function checkNodeVersion(version: string): DoctorCheck {
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
  return {
    message: major >= 20 ? 'Node version is supported.' : 'Node 20 or newer is required.',
    name: 'node',
    status: major >= 20 ? 'pass' : 'fail',
  };
}

function checkOpenAIKey(value: string | undefined, required: boolean): DoctorCheck {
  const configured = Boolean(value?.trim());

  if (!required && !configured) {
    return {
      message: 'OPENAI_API_KEY is optional for JSON-only workflows and required for image extraction.',
      name: 'OPENAI_API_KEY',
      status: 'pass',
    };
  }

  return {
    message: configured ? 'OPENAI_API_KEY is configured.' : 'OPENAI_API_KEY is missing.',
    name: 'OPENAI_API_KEY',
    status: configured ? 'pass' : 'fail',
  };
}

async function defaultReachabilityCheck(url: string) {
  const response = await fetch(url, { method: 'HEAD' }).catch(() => null);
  if (response?.ok) {
    return true;
  }

  const fallback = await fetch(url).catch(() => null);
  return fallback?.ok ?? false;
}

function formatOutput(result: DoctorResult, requestedOutput: OutputFormat) {
  if (requestedOutput === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (requestedOutput === 'text') {
    return result.humanReadable;
  }

  return `${result.humanReadable}\n\nJSON:\n${JSON.stringify(result, null, 2)}`;
}
