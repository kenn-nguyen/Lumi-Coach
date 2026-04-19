function $(id) {
  return document.getElementById(id);
}

const helperTitle = $("helper-title");
const helperDetail = $("helper-detail");
const helperAuthStatus = $("helper-auth-status");
const helperResumeStatus = $("helper-resume-status");
const helperProviderStatus = $("helper-provider-status");
const helperStoryboardStatus = $("helper-storyboard-status");
const helperPrimaryAction = $("helper-primary-action");
const helperSecondaryAction = $("helper-secondary-action");
const openAppAction = $("open-app-action");
const openHistoryAction = $("open-history-action");

let latestState = null;

async function sendMessage(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

function formatChecklistStatus(item) {
  if (!item) return "Unknown";
  if (item.done) return "Ready";
  return item.optional ? "Optional" : "Required";
}

function getAppOrigin() {
  const appOrigin = latestState?.assets?.appOrigin;
  return (appOrigin || "https://som-career-coach-iota.vercel.app")
    .trim()
    .replace(/\/+$/, "");
}

function openWebApp() {
  window.open(getAppOrigin(), "_blank", "noopener,noreferrer");
}

function renderSummary(response) {
  latestState = response || null;
  const setupState = response?.setupState || null;
  const checklist = setupState?.checklist || [];
  const onboardingMode = setupState?.mode === "onboarding";

  helperTitle.textContent = onboardingMode
    ? "Continue on LinkedIn"
    : setupState?.title || "Open a LinkedIn job";
  helperDetail.textContent = onboardingMode
    ? "First-time onboarding happens in the LinkedIn board."
    : setupState?.detail ||
      "Use the LinkedIn board for recovery, scrape issues, and tailoring.";

  helperAuthStatus.textContent = formatChecklistStatus(
    checklist.find((item) => item.id === "auth"),
  );
  helperResumeStatus.textContent = formatChecklistStatus(
    checklist.find((item) => item.id === "resume"),
  );
  helperProviderStatus.textContent = formatChecklistStatus(
    checklist.find((item) => item.id === "provider"),
  );

  const storyboardItem = checklist.find((item) => item.id === "storyboard");
  helperStoryboardStatus.textContent = storyboardItem?.done ? "Added" : "Optional";

  helperPrimaryAction.textContent = "Open LinkedIn job";
  helperPrimaryAction.dataset.actionId = "continue_on_linkedin";

  if (setupState?.primaryAction?.id === "connect") {
    helperSecondaryAction.hidden = false;
    helperSecondaryAction.textContent = setupState.primaryAction.label;
    helperSecondaryAction.dataset.actionId = "connect";
  } else {
    helperSecondaryAction.hidden = true;
    helperSecondaryAction.textContent = "";
    helperSecondaryAction.dataset.actionId = "";
  }
}

async function refresh() {
  const response = await sendMessage("GET_STATE");
  if (!response?.ok) {
    helperTitle.textContent = "Extension helper";
    helperDetail.textContent = response?.error || "Unable to load extension state.";
    return;
  }
  renderSummary(response);
}

async function handleAction(actionId) {
  if (actionId === "continue_on_linkedin") {
    const response = await sendMessage("FOCUS_LINKEDIN_JOB_TAB");
    if (!response?.ok) {
      window.alert(response?.error || "Open a LinkedIn job page first.");
    }
    return;
  }

  if (actionId === "connect") {
    const response = await sendMessage("OPEN_SIGN_IN");
    if (!response?.ok) {
      window.alert(response?.error || "Unable to open Google sign-in.");
    }
  }
}

helperPrimaryAction?.addEventListener("click", async () => {
  await handleAction(helperPrimaryAction.dataset.actionId || "");
});

helperSecondaryAction?.addEventListener("click", async () => {
  await handleAction(helperSecondaryAction.dataset.actionId || "");
});

openAppAction?.addEventListener("click", () => {
  openWebApp();
});

openHistoryAction?.addEventListener("click", () => {
  openWebApp();
});

void refresh();
