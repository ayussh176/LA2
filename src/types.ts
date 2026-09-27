export interface TrainInfo {
  number: string;
  name?: string;
}

export interface ParsedNotice {
  train: TrainInfo;
  station: string;
  expectedTime: string;
  reason?: string;
}

export interface ParseNoticeRequest {
  notice: string;
}

export interface BulkParseNoticeRequest {
  notices: string[];
}

export interface BulkParseNoticeResponse {
  results: ParsedNotice[];
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface ServerConfig {
  port: number;
  x402Network: string;
  x402PayTo: string;
  parsePrice: string;
  bulkPrice: string;
  facilitatorUrl: string;
}

export interface BuyerConfig {
  buyerPrivateKey: string;
  apiBaseUrl: string;
}
