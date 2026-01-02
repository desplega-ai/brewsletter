const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('api_url') || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5101';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5101';
};

const getApiKey = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('api_key') || '';
  }
  return '';
};

export function setApiConfig(url: string, key: string) {
  localStorage.setItem('api_url', url);
  localStorage.setItem('api_key', key);
}

export function clearApiConfig() {
  localStorage.removeItem('api_url');
  localStorage.removeItem('api_key');
}

export function getStoredConfig() {
  if (typeof window === 'undefined') {
    return { url: '', key: '' };
  }
  return {
    url: localStorage.getItem('api_url') || process.env.NEXT_PUBLIC_API_URL || '',
    key: localStorage.getItem('api_key') || '',
  };
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = getApiUrl();
  const key = getApiKey();

  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': key,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.details || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export async function generateApiKey(baseUrl: string, name?: string): Promise<{ apiKey: string; message: string }> {
  const response = await fetch(`${baseUrl}/api/auth/generate-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to generate API key');
  }

  return response.json();
}

export async function validateApiKey(): Promise<{ valid: boolean; name?: string }> {
  return fetchApi('/api/auth/validate');
}

// Newsletters
export interface Newsletter {
  id: number;
  agentmailId: string;
  fromAddress: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  topics: string[];
  isProcessed: boolean;
  createdAt: string;
  rawText?: string;
  rawHtml?: string;
  extractedContent?: any;
}

export interface NewsletterListResponse {
  data: Newsletter[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getNewsletters(page = 1, limit = 20, unprocessedOnly = false): Promise<NewsletterListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(unprocessedOnly && { unprocessed: 'true' }),
  });
  return fetchApi(`/api/newsletters?${params}`);
}

export async function getNewsletter(id: number): Promise<Newsletter> {
  return fetchApi(`/api/newsletters/${id}`);
}

export async function syncNewsletters(force = false): Promise<{ success: boolean; synced: number; updated?: number; skipped: number; message: string }> {
  return fetchApi('/api/newsletters/sync', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

export async function deleteNewsletter(id: number): Promise<{ success: boolean }> {
  return fetchApi(`/api/newsletters/${id}`, { method: 'DELETE' });
}

// Preferences
export interface Preferences {
  exists: boolean;
  deliveryEmail?: string;
  interests?: string[];
  formatPreference?: string;
  summaryLength?: string;
  includeLinks?: boolean;
  customPrompt?: string | null;
}

export async function getPreferences(): Promise<Preferences> {
  return fetchApi('/api/preferences');
}

export async function updatePreferences(prefs: {
  deliveryEmail: string;
  interests: string[];
  formatPreference: string;
  summaryLength: string;
  includeLinks: boolean;
  customPrompt?: string;
}): Promise<{ success: boolean }> {
  return fetchApi('/api/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
}

// Processing
export interface ProcessingStatus {
  isProcessing: boolean;
  processingId?: number;
  newsletterCount?: number;
  triggeredAt?: string;
  lastProcessing?: {
    id: number;
    status: string;
    newsletterCount: number;
    triggeredAt: string;
    completedAt: string | null;
    sentToEmail: string | null;
    errorMessage: string | null;
  };
}

export interface ProcessingHistoryItem {
  id: number;
  triggeredAt: string;
  completedAt: string | null;
  status: string;
  newsletterCount: number;
  sentToEmail: string | null;
  errorMessage: string | null;
  scheduleId?: number | null;
  scheduleName?: string | null;
}

export interface ProcessingHistory {
  data: ProcessingHistoryItem[];
}

export interface ProcessingDetail {
  id: number;
  triggeredAt: string;
  completedAt: string | null;
  status: string;
  newsletterCount: number;
  newsletterIds: number[];
  summaryHtml: string | null;
  summaryText: string | null;
  sentToEmail: string | null;
  agentmailSentId: string | null;
  errorMessage: string | null;
  scheduleId?: number | null;
  scheduleName?: string | null;
}

export async function generateSummary(newsletterIds?: number[], forceAll?: boolean, forceReprocess?: boolean): Promise<{ success: boolean; processingId: number; newsletterCount: number }> {
  return fetchApi('/api/processing/generate', {
    method: 'POST',
    body: JSON.stringify({ newsletterIds, forceAll, forceReprocess }),
  });
}

export async function getProcessingStatus(): Promise<ProcessingStatus> {
  return fetchApi('/api/processing/status');
}

export async function getProcessingHistory(limit = 10): Promise<ProcessingHistory> {
  return fetchApi(`/api/processing/history?limit=${limit}`);
}

// Schedules
export interface DigestSchedule {
  id: number;
  name: string;
  topics: string[];
  schedule: string;
  deliveryEmail: string;
  summaryLength: string;
  includeLinks: boolean;
  customPrompt: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
}

export interface ScheduleDefaults {
  deliveryEmail: string;
  summaryLength: string;
  includeLinks: boolean;
  interests: string[];
  customPrompt?: string | null;
}

export interface SchedulePreset {
  name: string;
  cron: string;
  description: string;
}

export async function getSchedules(): Promise<{ data: DigestSchedule[] }> {
  return fetchApi('/api/schedules');
}

export async function getSchedule(id: number): Promise<DigestSchedule> {
  return fetchApi(`/api/schedules/${id}`);
}

export async function createSchedule(schedule: {
  name: string;
  topics: string[];
  schedule: string;
  deliveryEmail: string;
  summaryLength?: string;
  includeLinks?: boolean;
  customPrompt?: string;
}): Promise<{ success: boolean; id: number; nextRunAt: string }> {
  return fetchApi('/api/schedules', {
    method: 'POST',
    body: JSON.stringify(schedule),
  });
}

export async function updateSchedule(id: number, schedule: Partial<{
  name: string;
  topics: string[];
  schedule: string;
  deliveryEmail: string;
  summaryLength: string;
  includeLinks: boolean;
  customPrompt: string;
  isActive: boolean;
}>): Promise<{ success: boolean }> {
  return fetchApi(`/api/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(schedule),
  });
}

export async function deleteSchedule(id: number): Promise<{ success: boolean }> {
  return fetchApi(`/api/schedules/${id}`, { method: 'DELETE' });
}

export async function getSchedulePresets(): Promise<{ presets: SchedulePreset[] }> {
  return fetchApi('/api/schedules/presets');
}

export async function getScheduleDefaults(): Promise<ScheduleDefaults> {
  return fetchApi('/api/schedules/defaults');
}

export async function triggerSchedule(id: number): Promise<{
  success: boolean;
  processingId: number;
  newsletterCount: number;
  message: string;
}> {
  return fetchApi(`/api/schedules/${id}/trigger`, { method: 'POST' });
}

export async function getScheduleHistory(id: number, limit = 10): Promise<{
  schedule: { id: number; name: string };
  data: ProcessingHistoryItem[];
}> {
  return fetchApi(`/api/schedules/${id}/history?limit=${limit}`);
}

export async function getProcessingDetail(id: number): Promise<ProcessingDetail> {
  return fetchApi(`/api/processing/${id}`);
}
