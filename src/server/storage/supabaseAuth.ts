/**
 * Headers for Supabase's REST APIs with the server's key. Older projects have a service_role JWT, which goes in
 * both headers; newer ones have a secret key (sb_secret_…), which is not a JWT: it goes in `apikey` only, and
 * Supabase's gateway turns it into a service-role token itself.
 */
export function supabaseKeyHeaders(key: string): Record<string, string> {
  const isJwt = key.split(".").length === 3;
  return isJwt ? { authorization: `Bearer ${key}`, apikey: key } : { apikey: key };
}
