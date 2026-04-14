function $(id) {
  return document.getElementById(id);
}

const masterResumeContextInput = $('master-resume-context-input');
const storyboardInput = $('storyboard-input');
const masterResumeContextStatus = $('master-resume-context-status');
const storyboardStatus = $('storyboard-status');
const promptProfileButtons = Array.from(document.querySelectorAll('[data-prompt-profile-id]'));
const llmProfileSelect = $('llm-profile-select');
const providerUrlRow = $('provider-url-row');
const providerUrlLabel = $('provider-url-label');
const providerUrlInput = $('provider-url-input');
const providerApiEndpointRow = $('provider-api-endpoint-row');
const providerApiEndpointInput = $('provider-api-endpoint-input');
const providerModelRow = $('provider-model-row');
const providerModelInput = $('provider-model-input');
const providerApiKeyRow = $('provider-api-key-row');
const providerApiKeyInput = $('provider-api-key-input');
const appUrlInput = $('app-url-input');
const apiUrlInput = $('api-url-input');
const resetLocalDataButton = $('reset-local-data-button');
const resetDefaultSettingsButton = $('reset-default-settings-button');
const historyList = $('history-list');
const historySearchInput = $('history-search-input');
const historySortField = $('history-sort-field');
const historySortDirection = $('history-sort-direction');
const historyPageSize = $('history-page-size');
const historyPrevPage = $('history-prev-page');
const historyNextPage = $('history-next-page');
const historyPageIndicator = $('history-page-indicator');

const PROMPT_FILE_DESCRIPTORS = [
  { templateName: 'prompt1', label: 'Prompt 1' },
  { templateName: 'prompt2', label: 'Prompt 2' },
  { templateName: 'prompt3', label: 'Prompt 3' },
  { templateName: 'systemPrompt', label: 'System prompt' },
];

const promptFileControls = Object.fromEntries(
  PROMPT_FILE_DESCRIPTORS.map(({ templateName, label }) => [
    templateName,
    {
      label,
      item: document.querySelector(`.prompt-file-item[data-template-name="${templateName}"]`),
      button: $(`prompt-file-button-${templateName}`),
      text: $(`prompt-file-text-${templateName}`),
      remove: $(`prompt-file-remove-${templateName}`),
      input: $(`prompt-file-input-${templateName}`),
    },
  ])
);

const historyUiState = {
  search: '',
  sortField: 'generatedAt',
  sortDirection: 'desc',
  pageSize: 50,
  page: 1,
};

let latestHistory = [];
let latestLlmSettings = null;
let latestPromptTemplateProfiles = null;
let providerSettingsSaveTimer = null;
let runtimeUrlsSaveTimer = null;

async function sendMessage(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function compareHistoryEntries(a, b, sortField, sortDirection) {
  const direction = sortDirection === 'asc' ? 1 : -1;

  if (sortField === 'company') {
    const left = (a?.company || '').toLowerCase();
    const right = (b?.company || '').toLowerCase();
    return left.localeCompare(right) * direction;
  }

  const leftTime = new Date(a?.generatedAt || 0).getTime();
  const rightTime = new Date(b?.generatedAt || 0).getTime();
  return (leftTime - rightTime) * direction;
}

function getVisibleHistory(history) {
  const search = historyUiState.search.trim().toLowerCase();
  const filtered = search
    ? history.filter((entry) => (entry?.title || '').toLowerCase().includes(search))
    : [...history];

  filtered.sort((left, right) =>
    compareHistoryEntries(left, right, historyUiState.sortField, historyUiState.sortDirection)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / historyUiState.pageSize));
  if (historyUiState.page > totalPages) {
    historyUiState.page = totalPages;
  }

  const start = (historyUiState.page - 1) * historyUiState.pageSize;
  const end = start + historyUiState.pageSize;

  return {
    totalItems: filtered.length,
    totalPages,
    items: filtered.slice(start, end),
  };
}

function renderHistory(history) {
  historyList.innerHTML = '';
  latestHistory = history || [];
  const { items, totalItems, totalPages } = getVisibleHistory(latestHistory);

  if (!totalItems) {
    historyList.innerHTML = '<div class="meta">No generated resumes yet.</div>';
    historyPageIndicator.textContent = 'Page 0 of 0';
    historyPrevPage.disabled = true;
    historyNextPage.disabled = true;
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item__title">${entry.title || 'Untitled role'}</div>
      <div class="history-item__company">${entry.company || 'Unknown company'}</div>
      <div class="history-item__meta">Generated: ${formatDate(entry.generatedAt)}</div>
      ${entry.datePosted ? `<div class="history-item__meta">Posted: ${entry.datePosted}</div>` : ''}
      <div class="history-item__meta">Status: ${entry.status}</div>
      <a class="history-item__link" data-preview-url="${entry.previewUrl}" href="#">Open Resume Preview</a>
    `;
    item.querySelector('.history-item__link')?.addEventListener('click', async (event) => {
      event.preventDefault();
      await sendMessage('OPEN_PREVIEW', { previewUrl: entry.previewUrl });
    });
    historyList.appendChild(item);
  });

  historyPageIndicator.textContent = `Page ${historyUiState.page} of ${totalPages}`;
  historyPrevPage.disabled = historyUiState.page <= 1;
  historyNextPage.disabled = historyUiState.page >= totalPages;
}

function ensureProfileOptions(settings) {
  const profiles = Object.values(settings?.profiles || {}).sort((left, right) =>
    (left?.label || '').localeCompare(right?.label || '', undefined, { sensitivity: 'base' })
  );
  const nextOptionMarkup = profiles
    .map((profile) => `<option value="${profile.id}">${profile.label}</option>`)
    .join('');

  if (llmProfileSelect.innerHTML !== nextOptionMarkup) {
    llmProfileSelect.innerHTML = nextOptionMarkup;
  }
}

function getActiveProfile(settings) {
  if (!settings?.activeProfileId || !settings?.profiles) {
    return null;
  }
  return settings.profiles[settings.activeProfileId] ?? null;
}

function renderLlmProfile(settings) {
  latestLlmSettings = settings || null;
  ensureProfileOptions(settings || {});
  const activeProfile = getActiveProfile(settings);
  if (!activeProfile) {
    llmProfileSelect.value = '';
    renderProviderSettings(null);
    return;
  }

  llmProfileSelect.value = activeProfile.id;
  renderProviderSettings(activeProfile);
}

function renderProviderSettings(profile) {
  const isWeb = profile?.mode === 'web_automation';
  const isApi = profile?.mode === 'api';

  const setRowVisible = (node, visible) => {
    if (!node) return;
    node.hidden = !visible;
    node.style.display = visible ? 'grid' : 'none';
  };

  setRowVisible(providerUrlRow, isWeb);
  setRowVisible(providerApiEndpointRow, isApi);
  setRowVisible(providerModelRow, isApi);
  setRowVisible(providerApiKeyRow, isApi);

  if (!profile) {
    providerUrlInput.value = '';
    providerApiEndpointInput.value = '';
    providerModelInput.value = '';
    providerApiKeyInput.value = '';
    providerUrlLabel.textContent = 'Provider URL';
    return;
  }

  if (isWeb) {
    providerUrlLabel.textContent = `${profile.vendor.charAt(0).toUpperCase()}${profile.vendor.slice(1)} URL`;
    providerUrlInput.value = profile.targetUrl || '';
    providerUrlInput.placeholder = profile.targetUrl || 'https://';
  } else {
    providerUrlInput.value = '';
  }

  if (isApi) {
    providerApiEndpointInput.value = profile.apiBaseUrl || '';
    providerApiEndpointInput.placeholder = profile.apiBaseUrl || 'https://api.example.com';
    providerModelInput.value = profile.model || '';
    providerModelInput.placeholder = profile.model || 'model-name';
    providerApiKeyInput.value = profile.apiKey || '';
    providerApiKeyInput.placeholder = 'sk-...';
  } else {
    providerApiEndpointInput.value = '';
    providerModelInput.value = '';
    providerApiKeyInput.value = '';
  }
}

function getActivePromptTemplateProfile(assets) {
  const promptTemplateProfiles = assets?.promptTemplateProfiles;
  if (!promptTemplateProfiles?.activeProfileId || !promptTemplateProfiles?.profiles) {
    return null;
  }
  return promptTemplateProfiles.profiles[promptTemplateProfiles.activeProfileId] ?? null;
}

function renderPromptProfileButtons(promptTemplateProfiles) {
  latestPromptTemplateProfiles = promptTemplateProfiles || null;
  const activeProfileId = promptTemplateProfiles?.activeProfileId ?? 'profile1';
  promptProfileButtons.forEach((button) => {
    const isActive = button.dataset.promptProfileId === activeProfileId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderPromptFileTiles(activePromptProfile) {
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label }) => {
    const controls = promptFileControls[templateName];
    if (!controls?.item || !controls.button || !controls.text || !controls.remove || !controls.input) {
      return;
    }

    const asset = activePromptProfile?.[`${templateName}TemplateAsset`] ?? null;
    const filename = asset?.filename?.trim() || '';
    controls.text.textContent = filename || '...upload';
    controls.button.title = filename || '';
    controls.item.classList.toggle('has-file', Boolean(filename));
    controls.item.classList.toggle('is-empty', !filename);
    controls.remove.hidden = !filename;
    controls.remove.setAttribute('aria-label', `Remove ${label} file`);
    controls.input.value = '';
  });
}

function getSelectedProfileDraft() {
  if (!latestLlmSettings?.profiles) return null;
  return latestLlmSettings.profiles[llmProfileSelect.value] ?? null;
}

function updateLocalProfileSettings(profileId, profileUpdates) {
  if (!latestLlmSettings?.profiles?.[profileId]) return;
  latestLlmSettings = {
    ...latestLlmSettings,
    activeProfileId: profileId,
    profiles: {
      ...latestLlmSettings.profiles,
      [profileId]: {
        ...latestLlmSettings.profiles[profileId],
        ...profileUpdates,
      },
    },
  };
}

async function persistProviderSelection(profileId) {
  const response = await sendMessage('SAVE_LLM_SETTINGS', {
    activeProfileId: profileId,
    profileUpdates: null,
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Failed to save provider selection.');
  }
  if (response.llmSettings) {
    latestLlmSettings = response.llmSettings;
  }
}

async function persistSelectedProviderSettings() {
  const activeProfile = getSelectedProfileDraft();
  if (!activeProfile) return;

  const profileUpdates = activeProfile.mode === 'web_automation'
    ? {
        targetUrl: providerUrlInput.value.trim(),
      }
    : {
        apiBaseUrl: providerApiEndpointInput.value.trim(),
        model: providerModelInput.value.trim(),
        apiKey: providerApiKeyInput.value.trim(),
      };

  updateLocalProfileSettings(activeProfile.id, profileUpdates);
  const response = await sendMessage('SAVE_LLM_SETTINGS', {
    activeProfileId: activeProfile.id,
    profileUpdates,
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Failed to save provider settings.');
  }
  if (response.llmSettings) {
    latestLlmSettings = response.llmSettings;
  }
}

function scheduleProviderSettingsSave() {
  if (providerSettingsSaveTimer) {
    window.clearTimeout(providerSettingsSaveTimer);
  }
  providerSettingsSaveTimer = window.setTimeout(() => {
    providerSettingsSaveTimer = null;
    persistSelectedProviderSettings().catch((error) => {
      console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave provider settings.', error);
      renderLlmProfile(latestLlmSettings);
    });
  }, 400);
}

async function persistRuntimeUrls() {
  const appUrl = appUrlInput.value.trim();
  const apiUrl = apiUrlInput.value.trim();
  const response = await sendMessage('SAVE_RUNTIME_URLS', { appUrl, apiUrl });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Failed to save app URLs.');
  }
}

function scheduleRuntimeUrlsSave() {
  if (runtimeUrlsSaveTimer) {
    window.clearTimeout(runtimeUrlsSaveTimer);
  }
  runtimeUrlsSaveTimer = window.setTimeout(() => {
    runtimeUrlsSaveTimer = null;
    persistRuntimeUrls().catch((error) => {
      console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave runtime URLs.', error);
      void refresh();
    });
  }, 400);
}

function renderAssets(assets) {
  const masterContext = assets?.masterResumeContextAsset;
  const storyboard = assets?.storyboardAsset;
  const activePromptProfile = getActivePromptTemplateProfile(assets);
  const appUrl = assets?.appOrigin;
  const apiUrl = assets?.apiOrigin;
  masterResumeContextStatus.textContent = masterContext
    ? masterContext.filename
    : '';
  storyboardStatus.textContent = storyboard
    ? storyboard.filename
    : '';
  renderPromptProfileButtons(assets?.promptTemplateProfiles);
  renderPromptFileTiles(activePromptProfile);
  renderLlmProfile(assets?.llmSettings);
  appUrlInput.value = appUrl || '';
  apiUrlInput.value = apiUrl || '';
}

async function refresh() {
  const response = await sendMessage('GET_STATE');
  if (!response?.ok) {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to load extension state.', response?.error ?? 'Unknown error');
    return;
  }
  renderAssets(response.assets);
  renderHistory(response.history);
}

function rerenderHistory() {
  renderHistory(latestHistory);
}

async function saveTextAsset(file, saveType, payloadBuilder, statusNode, errorMessage) {
  if (!file) return;
  statusNode.textContent = file.name;
  try {
    const content = await file.text();
    const response = await sendMessage(saveType, payloadBuilder(file, content));
    if (!response?.ok) {
      throw new Error(response?.error ?? errorMessage);
    }
    await refresh();
  } catch (error) {
    console.error('[ResumeMatcherExt][AdminBoard] Asset save failed.', {
      type: saveType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

masterResumeContextInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  await saveTextAsset(
    file,
    'SAVE_MASTER_RESUME_CONTEXT',
    (selectedFile, content) => ({
      filename: selectedFile.name,
      content,
    }),
    masterResumeContextStatus,
    'Failed to save local master resume context.'
  );
});

storyboardInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  await saveTextAsset(
    file,
    'SAVE_STORYBOARD',
    (selectedFile, content) => ({
      filename: selectedFile.name,
      content,
    }),
    storyboardStatus,
    'Failed to save storyboard.'
  );
});

promptProfileButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const profileId = button.dataset.promptProfileId;
    if (!profileId || latestPromptTemplateProfiles?.activeProfileId === profileId) {
      return;
    }
    const previousProfiles = latestPromptTemplateProfiles
      ? JSON.parse(JSON.stringify(latestPromptTemplateProfiles))
      : null;
    try {
      latestPromptTemplateProfiles = {
        ...(latestPromptTemplateProfiles || { profiles: {} }),
        activeProfileId: profileId,
      };
      renderPromptProfileButtons(latestPromptTemplateProfiles);
      const response = await sendMessage('SAVE_PROMPT_PROFILE_SELECTION', { profileId });
      if (!response?.ok) {
        throw new Error(response?.error ?? 'Failed to save prompt profile selection.');
      }
      await refresh();
    } catch (error) {
      console.error('[ResumeMatcherExt][AdminBoard] Failed to save prompt profile selection.', error);
      latestPromptTemplateProfiles = previousProfiles;
      renderPromptProfileButtons(latestPromptTemplateProfiles);
    }
  });
});

PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label }) => {
  const controls = promptFileControls[templateName];
  if (!controls?.button || !controls?.input || !controls?.remove) {
    return;
  }

  controls.button.addEventListener('click', () => {
    controls.input.click();
  });

  controls.input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const response = await sendMessage('SAVE_PROMPT_TEMPLATE', {
        templateName,
        promptProfileId: latestPromptTemplateProfiles?.activeProfileId ?? 'profile1',
        filename: file.name,
        content: await file.text(),
      });
      if (!response?.ok) {
        throw new Error(response?.error ?? `Failed to save ${label}.`);
      }
      await refresh();
    } catch (error) {
      console.error('[ResumeMatcherExt][AdminBoard] Failed to save prompt file.', {
        templateName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  controls.remove.addEventListener('click', async (event) => {
    event.stopPropagation();
    event.preventDefault();
    try {
      const response = await sendMessage('DELETE_PROMPT_TEMPLATE', {
        templateName,
        promptProfileId: latestPromptTemplateProfiles?.activeProfileId ?? 'profile1',
      });
      if (!response?.ok) {
        throw new Error(response?.error ?? `Failed to remove ${label}.`);
      }
      await refresh();
    } catch (error) {
      console.error('[ResumeMatcherExt][AdminBoard] Failed to remove prompt file.', {
        templateName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

llmProfileSelect.addEventListener('change', async () => {
  if (!latestLlmSettings?.profiles) return;
  const previousSettings = latestLlmSettings
    ? JSON.parse(JSON.stringify(latestLlmSettings))
    : null;
  const nextProfile = latestLlmSettings.profiles[llmProfileSelect.value];
  if (!nextProfile) return;
  try {
    updateLocalProfileSettings(nextProfile.id, {});
    latestLlmSettings = {
      ...latestLlmSettings,
      activeProfileId: nextProfile.id,
    };
    renderProviderSettings(nextProfile);
    await persistProviderSelection(nextProfile.id);
  } catch (error) {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to save provider selection.', error);
    latestLlmSettings = previousSettings;
    renderLlmProfile(latestLlmSettings);
  }
});
providerUrlInput.addEventListener('input', scheduleProviderSettingsSave);
providerApiEndpointInput.addEventListener('input', scheduleProviderSettingsSave);
providerModelInput.addEventListener('input', scheduleProviderSettingsSave);
providerApiKeyInput.addEventListener('input', scheduleProviderSettingsSave);
providerUrlInput.addEventListener('blur', () => {
  if (providerSettingsSaveTimer) {
    window.clearTimeout(providerSettingsSaveTimer);
    providerSettingsSaveTimer = null;
  }
  persistSelectedProviderSettings().catch((error) => {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave provider settings.', error);
    renderLlmProfile(latestLlmSettings);
  });
});
providerApiEndpointInput.addEventListener('blur', () => {
  if (providerSettingsSaveTimer) {
    window.clearTimeout(providerSettingsSaveTimer);
    providerSettingsSaveTimer = null;
  }
  persistSelectedProviderSettings().catch((error) => {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave provider settings.', error);
    renderLlmProfile(latestLlmSettings);
  });
});
providerModelInput.addEventListener('blur', () => {
  if (providerSettingsSaveTimer) {
    window.clearTimeout(providerSettingsSaveTimer);
    providerSettingsSaveTimer = null;
  }
  persistSelectedProviderSettings().catch((error) => {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave provider settings.', error);
    renderLlmProfile(latestLlmSettings);
  });
});
providerApiKeyInput.addEventListener('blur', () => {
  if (providerSettingsSaveTimer) {
    window.clearTimeout(providerSettingsSaveTimer);
    providerSettingsSaveTimer = null;
  }
  persistSelectedProviderSettings().catch((error) => {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave provider settings.', error);
    renderLlmProfile(latestLlmSettings);
  });
});

appUrlInput.addEventListener('input', scheduleRuntimeUrlsSave);
apiUrlInput.addEventListener('input', scheduleRuntimeUrlsSave);
appUrlInput.addEventListener('blur', () => {
  if (runtimeUrlsSaveTimer) {
    window.clearTimeout(runtimeUrlsSaveTimer);
    runtimeUrlsSaveTimer = null;
  }
  persistRuntimeUrls().catch((error) => {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave runtime URLs.', error);
    void refresh();
  });
});
apiUrlInput.addEventListener('blur', () => {
  if (runtimeUrlsSaveTimer) {
    window.clearTimeout(runtimeUrlsSaveTimer);
    runtimeUrlsSaveTimer = null;
  }
  persistRuntimeUrls().catch((error) => {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to autosave runtime URLs.', error);
    void refresh();
  });
});

resetLocalDataButton.addEventListener('click', async () => {
  resetLocalDataButton.disabled = true;
  try {
    const response = await sendMessage('RESET_LOCAL_DATA');
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Failed to reset local extension data.');
    }
    masterResumeContextInput.value = '';
    storyboardInput.value = '';
    PROMPT_FILE_DESCRIPTORS.forEach(({ templateName }) => {
      const controls = promptFileControls[templateName];
      if (controls?.input) {
        controls.input.value = '';
      }
    });
    await refresh();
  } catch (error) {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to reset local extension data.', error);
  } finally {
    resetLocalDataButton.disabled = false;
  }
});

resetDefaultSettingsButton.addEventListener('click', async () => {
  resetDefaultSettingsButton.disabled = true;
  try {
    const response = await sendMessage('RESET_DEFAULT_SETTINGS');
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Failed to reset extension settings.');
    }
    await refresh();
  } catch (error) {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to reset extension settings.', error);
  } finally {
    resetDefaultSettingsButton.disabled = false;
  }
});

historySearchInput.addEventListener('input', () => {
  historyUiState.search = historySearchInput.value || '';
  historyUiState.page = 1;
  rerenderHistory();
});

historySortField.addEventListener('change', () => {
  historyUiState.sortField = historySortField.value;
  historyUiState.page = 1;
  rerenderHistory();
});

historySortDirection.addEventListener('change', () => {
  historyUiState.sortDirection = historySortDirection.value;
  historyUiState.page = 1;
  rerenderHistory();
});

historyPageSize.addEventListener('change', () => {
  historyUiState.pageSize = Number(historyPageSize.value) || 50;
  historyUiState.page = 1;
  rerenderHistory();
});

historyPrevPage.addEventListener('click', () => {
  if (historyUiState.page <= 1) return;
  historyUiState.page -= 1;
  rerenderHistory();
});

historyNextPage.addEventListener('click', () => {
  historyUiState.page += 1;
  rerenderHistory();
});

chrome.storage.onChanged.addListener(() => {
  void refresh();
});

void refresh();
