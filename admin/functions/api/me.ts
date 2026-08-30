import type { Persona } from '../../src/lib/personas';

interface FunctionEnv {
  IROA_ADMIN_PERSONAS_JSON?: string;
}

interface FunctionContext {
  request: Request;
  env: FunctionEnv;
}

interface MeResponse {
  accessVerified: boolean;
  persona: Persona;
}

function personaMap(raw: string | undefined): Readonly<Record<string, Persona>> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, Persona> = {};
    for (const [email, persona] of Object.entries(parsed)) {
      if (persona === 'super_admin' || persona === 'treasury' || persona === 'compliance' || persona === 'read_only') {
        result[email.trim().toLowerCase()] = persona;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export async function onRequestGet({ request, env }: FunctionContext): Promise<Response> {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim().toLowerCase() ?? '';
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
  const accessVerified = Boolean(email && assertion);
  const personas = personaMap(env.IROA_ADMIN_PERSONAS_JSON);
  const body: MeResponse = {
    accessVerified,
    persona: accessVerified ? (personas[email] ?? 'read_only') : 'read_only',
  };
  return new Response(JSON.stringify(body), {
    status: accessVerified ? 200 : 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}
