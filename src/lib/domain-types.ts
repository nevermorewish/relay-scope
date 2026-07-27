export type UpstreamType = 'SUB2API' | 'NEW_API' | 'OPENAI_COMPATIBLE';
export type UpstreamStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
export type IncidentType =
  | 'BALANCE_LOW'
  | 'LATENCY_HIGH'
  | 'UNAVAILABLE'
  | 'AVAILABILITY_LOW'
  | 'TEST_FAILED'
  | 'PRICE_CHANGED'
  | 'STATUS_CHANGED'
  | 'CREDENTIAL_INVALID'
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE';
