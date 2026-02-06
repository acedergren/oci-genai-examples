export class ConfigFileAuthenticationDetailsProvider {
  constructor(
    public configPath?: string,
    public profile: string = 'DEFAULT'
  ) {}
}

export class InstancePrincipalsAuthenticationDetailsProvider {
  static builder(): {
    build: () => Promise<InstancePrincipalsAuthenticationDetailsProvider>;
  } {
    return {
      build: (): Promise<InstancePrincipalsAuthenticationDetailsProvider> =>
        Promise.resolve(new InstancePrincipalsAuthenticationDetailsProvider()),
    };
  }
}

export class ResourcePrincipalAuthenticationDetailsProvider {
  static builder(): {
    build: () => ResourcePrincipalAuthenticationDetailsProvider;
  } {
    return {
      build: (): ResourcePrincipalAuthenticationDetailsProvider =>
        new ResourcePrincipalAuthenticationDetailsProvider(),
    };
  }
}

export const Region = {
  EU_FRANKFURT_1: 'eu-frankfurt-1',
  EU_STOCKHOLM_1: 'eu-stockholm-1',
  US_ASHBURN_1: 'us-ashburn-1',
  fromRegionId: (regionId: string): { regionId: string } => ({ regionId }),
};
