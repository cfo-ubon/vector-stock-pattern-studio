// Build 030 Part 2, Module 15 — Cloud AI Provider Boundary. For this
// build, ALL AI CEO behavior (Modules 1-13) works entirely through local,
// deterministic logic. This file defines the interface a future cloud
// provider (OpenAI, Claude, Gemini, a local model, a custom provider)
// would implement, and nothing more:
//  - No network call is ever made from this module.
//  - No API key is embedded in the browser bundle or hardcoded anywhere.
//  - No key is ever written into a `.vspsb` backup —
//    `appBackupFormat.ts`'s `APP_BACKUP_SETTINGS_KEYS` list has no
//    provider-key entry, and this module never calls into the backup
//    subsystem at all.
//  - `getActiveCloudAiProvider` always returns `null` in this build; a
//    future build wiring a real provider replaces only that one resolver,
//    never any of Modules 1-13's own local logic.

export type CloudAiProviderId = 'openai' | 'anthropic' | 'gemini' | 'local-model' | 'custom';

export interface CloudAiProviderConfig {
  providerId: CloudAiProviderId;
  /** Never persisted by this application in this build — the boundary
   * interface only. A real future implementation would source this from a
   * runtime-only, non-persisted input, never from localStorage/IndexedDB/
   * the bundle. */
  apiKey?: string;
  model?: string;
}

export interface CloudAiCompletionRequest {
  prompt: string;
  context: Record<string, unknown>;
}

export interface CloudAiCompletionResponse {
  text: string;
  providerId: CloudAiProviderId;
}

/** The interface a real cloud provider integration would implement.
 * Deliberately unimplemented in this build — see the module header. */
export interface CloudAiProvider {
  readonly id: CloudAiProviderId;
  complete(request: CloudAiCompletionRequest): Promise<CloudAiCompletionResponse>;
}

export class NoCloudAiProviderConnectedError extends Error {
  constructor() {
    super('No cloud AI provider is connected. Local deterministic AI CEO behavior remains fully active.');
    this.name = 'NoCloudAiProviderConnectedError';
  }
}

/** Always `null` in this build — see module header. */
export function getActiveCloudAiProvider(): CloudAiProvider | null {
  return null;
}

export function isCloudAiProviderConnected(): boolean {
  return getActiveCloudAiProvider() !== null;
}
