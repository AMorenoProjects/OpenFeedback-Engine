export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 1) return email;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  if (local.length <= 2) {
    return local[0] + "***" + domain;
  }

  return local[0] + "***" + local[local.length - 1] + domain;
}
