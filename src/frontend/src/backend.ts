// Stub backend - no-backend app (LocalStorage only)
// biome-ignore lint/suspicious/noExplicitAny: stub
export type backendInterface = Record<string, any>;

export interface CreateActorOptions {
  // biome-ignore lint/suspicious/noExplicitAny: stub
  agentOptions?: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: stub
  actorOptions?: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: stub
  agent?: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub
  processError?: (e: unknown) => never;
}

export class ExternalBlob {
  // biome-ignore lint/suspicious/noExplicitAny: stub
  onProgress?: (progress: any) => void;
  async getBytes(): Promise<Uint8Array> {
    return new Uint8Array();
  }
  static fromURL(_url: string): ExternalBlob {
    return new ExternalBlob();
  }
}

export const canisterId = "";

export const idlFactory = () => {};

export async function createActor(
  _canisterId: string,
  // biome-ignore lint/suspicious/noExplicitAny: stub
  _uploadFile: (file: ExternalBlob) => Promise<any>,
  // biome-ignore lint/suspicious/noExplicitAny: stub
  _downloadFile: (bytes: Uint8Array) => Promise<any>,
  _options?: CreateActorOptions,
): Promise<backendInterface> {
  return {};
}
