function $(id) {
  return document.getElementById(id);
}

const masterResumeContextInput = $('master-resume-context-input');
const storyboardInput = $('storyboard-input');
const prompt1TemplateInput = $('prompt1-template-input');
const prompt2TemplateInput = $('prompt2-template-input');
const prompt3TemplateInput = $('prompt3-template-input');
const masterResumeContextStatus = $('master-resume-context-status');
const storyboardStatus = $('storyboard-status');
const prompt1TemplateStatus = $('prompt1-template-status');
const prompt2TemplateStatus = $('prompt2-template-status');
const prompt3TemplateStatus = $('prompt3-template-status');
const chatGptUrlInput = $('chatgpt-url-input');
const saveChatGptUrlButton = $('save-chatgpt-url-button');
const appUrlInput = $('app-url-input');
const apiUrlInput = $('api-url-input');
const saveRuntimeUrlsButton = $('save-runtime-urls-button');
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

const historyUiState = {
  search: '',
  sortField: 'generatedAt',
  sortDirection: 'desc',
  pageSize: 50,
  page: 1,
};

let latestHistory = [];

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

function renderAssets(assets) {
  const masterContext = assets?.masterResumeContextAsset;
  const storyboard = assets?.storyboardAsset;
  const prompt1Template = assets?.prompt1TemplateAsset;
  const prompt2Template = assets?.prompt2TemplateAsset;
  const prompt3Template = assets?.prompt3TemplateAsset;
  const chatGptUrl = assets?.chatGptTargetUrl;
  const appUrl = assets?.appOrigin;
  const apiUrl = assets?.apiOrigin;
  masterResumeContextStatus.textContent = masterContext
    ? masterContext.filename
    : '';
  storyboardStatus.textContent = storyboard
    ? storyboard.filename
    : '';
  prompt1TemplateStatus.textContent = prompt1Template
    ? prompt1Template.filename
    : '';
  prompt2TemplateStatus.textContent = prompt2Template
    ? prompt2Template.filename
    : '';
  prompt3TemplateStatus.textContent = prompt3Template
    ? prompt3Template.filename
    : '';
  chatGptUrlInput.value = chatGptUrl || '';
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

function bindPromptTemplateUpload(inputNode, statusNode, templateName) {
  inputNode.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    await saveTextAsset(
      file,
      'SAVE_PROMPT_TEMPLATE',
      (selectedFile, content) => ({
        templateName,
        filename: selectedFile.name,
        content,
      }),
      statusNode,
      `Failed to save ${templateName} template.`
    );
  });
}

bindPromptTemplateUpload(prompt1TemplateInput, prompt1TemplateStatus, 'prompt1');
bindPromptTemplateUpload(prompt2TemplateInput, prompt2TemplateStatus, 'prompt2');
bindPromptTemplateUpload(prompt3TemplateInput, prompt3TemplateStatus, 'prompt3');

saveChatGptUrlButton.addEventListener('click', async () => {
  const url = chatGptUrlInput.value.trim();
  saveChatGptUrlButton.disabled = true;
  try {
    const response = await sendMessage('SAVE_CHATGPT_URL', { url });
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Failed to save ChatGPT URL.');
    }
    await refresh();
  } catch (error) {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to save ChatGPT URL.', error);
  } finally {
    saveChatGptUrlButton.disabled = false;
  }
});

saveRuntimeUrlsButton.addEventListener('click', async () => {
  const appUrl = appUrlInput.value.trim();
  const apiUrl = apiUrlInput.value.trim();
  saveRuntimeUrlsButton.disabled = true;
  try {
    const response = await sendMessage('SAVE_RUNTIME_URLS', { appUrl, apiUrl });
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Failed to save app URLs.');
    }
    await refresh();
  } catch (error) {
    console.error('[ResumeMatcherExt][AdminBoard] Failed to save app URLs.', error);
  } finally {
    saveRuntimeUrlsButton.disabled = false;
  }
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
    prompt1TemplateInput.value = '';
    prompt2TemplateInput.value = '';
    prompt3TemplateInput.value = '';
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
