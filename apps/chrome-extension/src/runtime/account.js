export function normalizeAccountIdentityValue(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function deriveAccountKeyFromUser(user) {
  const email = normalizeAccountIdentityValue(user?.email).toLowerCase();
  if (email) {
    return `email:${encodeURIComponent(email)}`;
  }

  const userId = normalizeAccountIdentityValue(user?.id);
  if (userId) {
    return `id:${encodeURIComponent(userId)}`;
  }

  return null;
}

export function areSameAccountUsers(leftUser, rightUser) {
  const leftKey = deriveAccountKeyFromUser(leftUser);
  const rightKey = deriveAccountKeyFromUser(rightUser);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function getCurrentAccountLabel(user) {
  const email = normalizeAccountIdentityValue(user?.email);
  if (email) return email;

  const name = normalizeAccountIdentityValue(user?.name);
  if (name) return name;

  return "Current account";
}
