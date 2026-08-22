import { SerpFeatureType, SerpDevice } from '@prisma/client';

export interface SerpQueryRequest {
  keyword: string;
  countryCode?: string; // Default: 'US'
  languageCode?: string; // Default: 'en'
  device?: SerpDevice; // Default: 'DESKTOP'
  locationCode?: string;
  targetDomain?: string; // e.g. "example.com"
}

export interface RawSerpFeatureItem {
  featureType: SerpFeatureType;
  position: number;
  title?: string;
  snippet?: string;
  targetUrl?: string;
  domain?: string;
  sourceUrls?: string[];
  pixelHeight?: number;
  pixelTop?: number;
  rawFeatureJson?: string;
}

export interface RawOrganicResult {
  position: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  displayUrl?: string;
  pixelTop?: number;
  pixelHeight?: number;
}

export interface RawSerpResponse {
  provider: string;
  keyword: string;
  device: SerpDevice;
  countryCode: string;
  languageCode: string;
  totalResults?: bigint;
  searchEngine: string;
  organicResults: RawOrganicResult[];
  features: RawSerpFeatureItem[];
  rawPayloadHash: string;
  rawJson?: string;
  retrievedAt: Date;
}

export interface ISerpProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  fetchSerp(req: SerpQueryRequest): Promise<RawSerpResponse>;
}
