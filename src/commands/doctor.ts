import {
  type DoctorCheck,
  type DoctorResult,
  DoctorResultSchema,
  OutputFormatSchema,
  type OutputFormat,
} from '../core/crosslistCore.js';
import { resolveApiBaseUrl } from '../core/api.js';

export async function runDoctor(
  options: {
    apiSupportCheck?: (url: string) => Promise<boolean>;
    apiBaseUrl?: string;
    imageInputs?: string[];
    nodeVersion?: string;
    reachabilityCheck?: (url: string) => Promise<boolean>;
  } = {}
): Promise<DoctorResult> {
  const imageInputs = options.imageInputs ?? [];
  const apiSupportCheck = options.apiSupportCheck ?? defaultApiSupportCheck;
  const reachabilityCheck = options.reachabilityCheck ?? defaultReachabilityCheck;
  const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl);
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion(options.nodeVersion ?? process.versions.node));
  checks.push(await checkApiBaseUrl(apiBaseUrl, apiSupportCheck));

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
    apiBaseUrl?: string;
    images?: string[];
    output?: string;
  },
  dependencies: {
    apiSupportCheck?: (url: string) => Promise<boolean>;
    nodeVersion?: string;
    reachabilityCheck?: (url: string) => Promise<boolean>;
  } = {}
) {
  const result = await runDoctor({
    apiSupportCheck: dependencies.apiSupportCheck,
    apiBaseUrl: options.apiBaseUrl,
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

async function checkApiBaseUrl(
  apiBaseUrl: string,
  apiSupportCheck: (url: string) => Promise<boolean>
): Promise<DoctorCheck> {
  try {
    const url = new URL('/api/public/v1/openapi.json', apiBaseUrl).toString();
    const reachable = await apiSupportCheck(url);
    return {
      message: reachable
        ? 'Public API is reachable and exposes /crosslist/generate.'
        : 'Public API could not be reached or does not expose /crosslist/generate.',
      name: `api:${apiBaseUrl}`,
      status: reachable ? 'pass' : 'fail',
    };
  } catch {
    return {
      message: 'API base URL is invalid.',
      name: `api:${apiBaseUrl}`,
      status: 'fail',
    };
  }
}

async function checkImageInput(
  input: string,
  reachabilityCheck: (url: string) => Promise<boolean>
): Promise<DoctorCheck> {
  if (!/^https?:\/\//i.test(input)) {
    return {
      message: 'Image extraction is URL-only in v1. Provide a hosted image URL.',
      name: `image:${input}`,
      status: 'fail',
    };
  }

  const reachable = await reachabilityCheck(input);
  return {
    message: reachable ? 'Remote image URL is reachable.' : 'Remote image URL could not be reached.',
    name: `image:${input}`,
    status: reachable ? 'pass' : 'fail',
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

async function defaultReachabilityCheck(url: string) {
  const response = await fetch(url, { method: 'HEAD' }).catch(() => null);
  if (response?.ok) {
    return true;
  }

  const fallback = await fetch(url).catch(() => null);
  return fallback?.ok ?? false;
}

async function defaultApiSupportCheck(url: string) {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) {
    return false;
  }

  const body: any = await response.json().catch(() => null);
  return Boolean(body?.paths?.['/crosslist/generate']);
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
