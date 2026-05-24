export function normalizeSecretValue(value) {
  return String(value || "").trim();
}

export function maskSecret(value) {
  const normalized = normalizeSecretValue(value);
  if (!normalized) return "";
  if (normalized.length <= 6) {
    return `${normalized.slice(0, 1)}...${normalized.slice(-1)}`;
  }
  return `${normalized.slice(0, 3)}...${normalized.slice(-3)}`;
}

export function shouldEndSecretEdit(draftValue, savedValue) {
  const normalizedDraft = normalizeSecretValue(draftValue);
  if (!normalizedDraft) {
    return true;
  }
  return normalizedDraft === normalizeSecretValue(savedValue);
}

export function getProviderSecretInputPresentation({
  savedValue,
  draftValue,
  isEditing,
}) {
  if (isEditing) {
    return {
      type: "password",
      readOnly: false,
      placeholder: "API key",
      value: draftValue || "",
    };
  }

  if (normalizeSecretValue(savedValue)) {
    return {
      type: "password",
      readOnly: true,
      placeholder: "Saved API key. Focus to replace.",
      value: "",
    };
  }

  return {
    type: "password",
    readOnly: false,
    placeholder: "API key required",
    value: "",
  };
}

export function getProviderSecretHint({ savedValue, isEditing }) {
  if (isEditing) {
    return "";
  }

  const normalizedSaved = normalizeSecretValue(savedValue);
  if (!normalizedSaved) {
    return "";
  }

  const tailLength = Math.min(4, normalizedSaved.length);
  return `Saved API key ending in ${normalizedSaved.slice(-tailLength)}. Focus to replace.`;
}
