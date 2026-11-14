export interface TLCEComponentManifest {
  id: string;
  version: string;
  apiVersion: string;
  styleEntry?: string;
  accessibility: {
    keyboardOperable: boolean;
    semanticRoot: boolean;
    accessibleNameRequired: boolean;
  };
}

export interface TLCEComponentDefinition<Props extends Record<string, unknown> = Record<string, unknown>> {
  manifest: TLCEComponentManifest;
  render(props: Props, document: Document): HTMLElement;
}

export type ComponentDisposer = () => void | Promise<void>;
