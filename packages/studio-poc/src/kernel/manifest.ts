export interface ExtensionManifest {
  id: string;
  version: string;
  engines: {
    loom: string;
    studio: string;
  };
  server?: {
    entry: string;
    capabilities?: {
      requires: string[];
    };
    contributes: {
      documentTypes?: string[];
      passes?: string[];
      rpc?: string[];
    };
  };
  client?: {
    bundle: string;
  };
}

export function parseManifest(json: any): ExtensionManifest {
  // In a real app, we'd use Zod or similar. For PoC, we just trust/cast.
  return json as ExtensionManifest;
}
