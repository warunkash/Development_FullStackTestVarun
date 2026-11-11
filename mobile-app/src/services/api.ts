/**
 * Stub for the real backend integration. The current app runs entirely on
 * services/mockAI.ts and local AsyncStorage so it can be demoed without any
 * infrastructure. Wiring up the FastAPI backend described in the product
 * spec means pointing API_BASE_URL at it and replacing call sites in
 * context/AuthContext.tsx and context/ConsultationContext.tsx with the
 * fetch calls below (or a generated client).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to use the live backend.');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// Example endpoints matching the FastAPI backend design in the product spec:
export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; doctor: unknown }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  transcribeAudio: (audioUri: string) =>
    request<{ transcript: string }>('/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioUri }),
    }),
  generateSOAP: (transcript: string) =>
    request<{ soap: unknown }>('/ai/soap', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),
  suggestICD10: (transcript: string) =>
    request<{ suggestions: unknown[] }>('/ai/icd10', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),
  exportFHIR: (consultationId: string) => request<unknown>(`/consultations/${consultationId}/fhir`),
};
