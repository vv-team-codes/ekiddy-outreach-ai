export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  mode?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface CustomerPersona {
  role: string;
  painPoints: string[];
  goals: string[];
}

export interface SuggestedSegment {
  name: string;
  description: string;
  rationale: string;
}

export interface GeneratedEmailResult {
  subject: string;
  openingLine: string;
  body: string;
  cta: string;
  followUpMessage: string;
  aiMode: 'live' | 'demo';
  aiProvider: string;
  aiModel: string;
}
