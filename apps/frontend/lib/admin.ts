export const ADMIN_EMAILS = new Set(['kenn.nguyen@aya.yale.edu']);

export function isAdminEmail(email: string | null | undefined): boolean {
  return email ? ADMIN_EMAILS.has(email) : false;
}
