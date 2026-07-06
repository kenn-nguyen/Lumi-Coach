// Panel CSS for the LinkedIn content-script UI, extracted out of
// linkedin-job.js so the ~78KB is not parsed/held on every LinkedIn tab.
// Loaded lazily (dynamic import) only when the floating panel is built
// (job pages). Interpolates only stable ID/layout constants passed in from
// linkedin-job.js, which remains the single source of truth for those IDs.
export function buildPanelStyles({
  ROOT_ID,
  LAUNCHER_ID,
  BOARD_ID,
  LAUNCHER_CLOSE_ID,
  LAUNCHER_LOCK_NOTICE_ID,
  LAUNCHER_ALERT_ID,
  BOARD_MINIMIZE_ID,
  ACCOUNT_DETAIL_ID,
  PROVIDER_WEB_INPUT_ID,
  PROVIDER_SELECT_ID,
  PROVIDER_MODEL_INPUT_ID,
  PROVIDER_API_KEY_INPUT_ID,
  PROVIDER_API_BASE_INPUT_ID,
  EDGE_PADDING,
  EDGE_GAP_TOTAL,
  WIDE_BOARD_WIDTH,
  RUN_BOARD_WIDTH,
}) {
  return `
    #${ROOT_ID} {
      position: fixed;
      left: auto;
      right: calc(env(safe-area-inset-right, 0px) + ${EDGE_PADDING}px);
      top: 50vh;
      z-index: 2147483647;
      display: grid;
      justify-items: start;
      width: auto;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1f2937;
      user-select: none;
      transition: left 180ms ease, top 180ms ease;
      will-change: left, top;
    }

    #${ROOT_ID}[data-hidden="true"] {
      display: none;
    }

    #${ROOT_ID} [hidden] {
      display: none !important;
    }

    #${ROOT_ID}[data-dragging="true"] {
      transition: none;
    }

    #${LAUNCHER_ID} {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 78px;
      height: 78px;
      border-radius: 26px;
      border: 1px solid rgba(255, 255, 255, 0.78);
      background:
        linear-gradient(180deg, rgba(211, 231, 247, 0.82), rgba(224, 237, 248, 0.78)),
        rgba(215, 231, 246, 0.72);
      box-shadow:
        -8px 18px 28px rgba(15, 23, 42, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(24px) saturate(145%);
      -webkit-backdrop-filter: blur(24px) saturate(145%);
      cursor: grab;
      transition: transform 140ms ease, box-shadow 140ms ease;
      overflow: visible;
    }

    #${LAUNCHER_ID}::before {
      content: '';
      position: absolute;
      width: 96px;
      height: 96px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 999px;
      background: conic-gradient(
        from 0deg at 50% 50%,
        rgba(59, 130, 246, 0) 0deg,
        rgba(59, 130, 246, 0) 220deg,
        rgba(56, 189, 248, 0.18) 265deg,
        rgba(96, 165, 250, 0.8) 312deg,
        rgba(125, 211, 252, 0.34) 344deg,
        rgba(59, 130, 246, 0) 360deg
      );
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
      opacity: 0;
      pointer-events: none;
      filter: drop-shadow(0 0 14px rgba(96, 165, 250, 0.28));
    }

    #${ROOT_ID}[data-running="true"][data-board-open="false"] #${LAUNCHER_ID}::before {
      opacity: 1;
      animation: resume-matcher-launcher-ring 1.4s linear infinite;
    }

    #${ROOT_ID}[data-board-open="true"] #${LAUNCHER_ID} {
      display: none;
    }

    #${LAUNCHER_ID}:hover {
      transform: translateY(-1px);
      box-shadow:
        -10px 20px 30px rgba(15, 23, 42, 0.1),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${ROOT_ID}[data-dock-side="left"] #${LAUNCHER_ID} {
      box-shadow:
        8px 18px 28px rgba(15, 23, 42, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.82);
    }

    #${ROOT_ID}[data-dock-side="left"] #${LAUNCHER_ID}:hover {
      box-shadow:
        10px 20px 30px rgba(15, 23, 42, 0.1),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${LAUNCHER_ID}:active {
      cursor: grabbing;
    }

    #${LAUNCHER_ID} img {
      display: block;
      width: 42px;
      height: 42px;
      object-fit: contain;
      pointer-events: none;
    }

    #${LAUNCHER_CLOSE_ID} {
      position: absolute;
      top: -8px;
      right: -8px;
      display: none;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.88);
      background: rgba(255, 255, 255, 0.92);
      color: rgba(0, 0, 0, 0.56);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      line-height: 1;
      padding: 0;
    }

    #${LAUNCHER_ID}:hover #${LAUNCHER_CLOSE_ID} {
      display: inline-flex;
    }

    #${LAUNCHER_ALERT_ID} {
      position: absolute;
      right: -6px;
      bottom: -6px;
      display: none;
      min-width: 22px;
      height: 22px;
      padding: 0 4px;
      border-radius: 999px;
      background: #ef4444;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      line-height: 22px;
      text-align: center;
      box-shadow: 0 8px 18px rgba(127, 29, 29, 0.22);
    }

    #${ROOT_ID}[data-alert="true"] #${LAUNCHER_ALERT_ID} {
      display: block;
    }

    #${LAUNCHER_LOCK_NOTICE_ID} {
      display: none;
      width: min(240px, calc(100vw - ${EDGE_GAP_TOTAL}px));
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.76);
      background:
        linear-gradient(180deg, rgba(255, 248, 250, 0.94), rgba(252, 241, 246, 0.92)),
        rgba(255, 247, 250, 0.9);
      box-shadow: 0 18px 30px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(24px) saturate(140%);
      -webkit-backdrop-filter: blur(24px) saturate(140%);
      color: #4a2232;
      pointer-events: none;
    }

    #${ROOT_ID}[data-launcher-lock-visible="true"] #${LAUNCHER_LOCK_NOTICE_ID} {
      display: block;
    }

    .resume-matcher-launcher-lock-notice__title {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.4;
    }

    .resume-matcher-launcher-lock-notice__detail {
      margin-top: 3px;
      font-size: 12px;
      line-height: 1.45;
      color: rgba(74, 34, 50, 0.78);
    }

    #${ROOT_ID}[data-dragging="true"][data-dock-preview="left"] #${BOARD_ID},
    #${ROOT_ID}[data-dragging="true"][data-dock-preview="left"] #${LAUNCHER_ID} {
      box-shadow:
        0 22px 42px rgba(15, 23, 42, 0.12),
        inset 3px 0 0 rgba(0, 122, 255, 0.16),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${ROOT_ID}[data-dragging="true"][data-dock-preview="right"] #${BOARD_ID},
    #${ROOT_ID}[data-dragging="true"][data-dock-preview="right"] #${LAUNCHER_ID} {
      box-shadow:
        0 22px 42px rgba(15, 23, 42, 0.12),
        inset -3px 0 0 rgba(0, 122, 255, 0.16),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${BOARD_ID} {
      display: none;
      grid-template-rows: auto 1fr;
      width: min(${RUN_BOARD_WIDTH}px, calc(100vw - ${EDGE_GAP_TOTAL}px));
      max-width: calc(100vw - ${EDGE_GAP_TOTAL}px);
      max-height: min(76vh, 680px);
      overflow: hidden;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.76);
      background:
        linear-gradient(180deg, rgba(211, 231, 247, 0.76), rgba(224, 237, 248, 0.72)),
        rgba(215, 231, 246, 0.64);
      box-shadow:
        -10px 24px 34px rgba(0, 0, 0, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(30px) saturate(150%);
      -webkit-backdrop-filter: blur(30px) saturate(150%);
    }

    #${ROOT_ID}[data-current-view="history"] #${BOARD_ID},
    #${ROOT_ID}[data-current-view="settings"] #${BOARD_ID},
    #${ROOT_ID}[data-onboarding-mode="true"] #${BOARD_ID} {
      width: min(${WIDE_BOARD_WIDTH}px, calc(100vw - ${EDGE_GAP_TOTAL}px));
    }

    #${ROOT_ID}[data-board-open="true"] #${BOARD_ID} {
      display: grid;
    }

    #${ROOT_ID}[data-dock-side="left"] #${BOARD_ID} {
      box-shadow:
        10px 24px 34px rgba(0, 0, 0, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.8);
    }

    .resume-matcher-board__header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.52);
      background:
        linear-gradient(to bottom, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.24)),
        rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.35);
      cursor: grab;
    }

    .resume-matcher-board__header:active {
      cursor: grabbing;
    }

    .resume-matcher-board__brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .resume-matcher-board__logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .resume-matcher-board__brand img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }

    .resume-matcher-board__brand-text {
      display: grid;
      gap: 0;
      min-width: 0;
      text-align: left;
    }

    .resume-matcher-board__brand-link {
      display: inline-flex;
      align-items: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }

    .resume-matcher-board__title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.05;
      color: rgba(0, 0, 0, 0.88);
      letter-spacing: -0.03em;
      white-space: nowrap;
    }

    .resume-matcher-board__subtitle { display: none; }

    .resume-matcher-board__header-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .resume-matcher-icon-button {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.68);
      background: rgba(255, 255, 255, 0.34);
      color: rgba(0, 0, 0, 0.64);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
      font: inherit;
      font-size: 0;
      opacity: 1;
      position: relative;
      transition:
        background 140ms ease,
        color 140ms ease,
        transform 140ms ease,
        border-color 140ms ease,
        box-shadow 140ms ease;
    }

    .resume-matcher-icon-button:hover {
      background: rgba(255, 255, 255, 0.52);
      border-color: rgba(255, 255, 255, 0.82);
      color: rgba(0, 0, 0, 0.84);
      transform: translateY(-0.5px);
    }

    .resume-matcher-icon-button:disabled,
    .resume-matcher-icon-button:disabled:hover {
      cursor: not-allowed;
      opacity: 0.42;
      transform: none;
      box-shadow: none;
    }

    .resume-matcher-icon-button svg,
    .resume-matcher-icon-button img,
    .resume-matcher-board__subtitle svg {
      width: 15px;
      height: 15px;
      display: block;
    }

    .resume-matcher-icon-button.is-active {
      color: rgba(0, 0, 0, 0.85);
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.78),
        rgba(255, 255, 255, 0.54)
      );
      border-color: rgba(255, 255, 255, 0.92);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.18),
        0 0 18px rgba(59, 130, 246, 0.22),
        0 8px 18px rgba(15, 23, 42, 0.08);
      transform: translateY(-0.5px);
      opacity: 1;
    }

    .resume-matcher-icon-button.is-active::after {
      content: "";
      position: absolute;
      inset: -3px;
      border-radius: 999px;
      border: 1px solid rgba(96, 165, 250, 0.42);
      box-shadow: 0 0 14px rgba(96, 165, 250, 0.14);
      pointer-events: none;
    }

    .resume-matcher-board__body {
      min-height: 0;
      overflow: auto;
      padding: 0;
      display: grid;
      gap: 0;
    }

    .resume-matcher-view {
      display: none;
      padding: 12px 14px 14px;
      gap: 12px;
    }

    .resume-matcher-view.is-active {
      display: grid;
    }

    .resume-matcher-section,
    .resume-matcher-history-item,
    .resume-matcher-settings-group {
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background: rgba(255, 255, 255, 0.56);
      backdrop-filter: blur(16px) saturate(140%);
      -webkit-backdrop-filter: blur(16px) saturate(140%);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
      padding: 12px;
    }

    .resume-matcher-run-shell {
      border-radius: 0;
      border: none;
      background: transparent;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      box-shadow: none;
      overflow: visible;
    }

    .resume-matcher-run-shell__body {
      padding: 0;
      display: grid;
      gap: 14px;
    }

    .resume-matcher-run-job {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .resume-matcher-source-toggle {
      display: inline-flex;
      gap: 6px;
      padding: 3px;
      border: 1px solid rgba(232, 206, 214, 0.86);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.74);
      width: fit-content;
    }

    .resume-matcher-source-toggle__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 11px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: rgba(108, 41, 64, 0.8);
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      transition:
        background-color 120ms ease,
        color 120ms ease,
        opacity 120ms ease;
    }

    .resume-matcher-source-toggle__button.is-active {
      background: linear-gradient(180deg, #9f254f 0%, #6f1b38 100%);
      color: #fff7fb;
    }

    .resume-matcher-source-toggle__button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .resume-matcher-profile-tabs {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
      width: fit-content;
      padding: 3px;
      border: 1px solid rgba(232, 206, 214, 0.86);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.74);
    }

    .resume-matcher-profile-tabs.is-compact {
      gap: 4px;
      padding: 2px;
    }

    .resume-matcher-profile-tabs.is-run-wide {
      max-width: 100%;
    }

    .resume-matcher-profile-tabs__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 26px;
      padding: 0 10px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: rgba(108, 41, 64, 0.8);
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 120ms ease,
        color 120ms ease,
        opacity 120ms ease;
    }

    .resume-matcher-profile-tabs__button.is-active {
      background: linear-gradient(180deg, #9f254f 0%, #6f1b38 100%);
      color: #fff7fb;
    }

    .resume-matcher-profile-tabs__button.is-disabled {
      opacity: 0.5;
    }

    .resume-matcher-profile-tabs__button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .resume-matcher-profile-tabs.is-run-wide .resume-matcher-profile-tabs__button {
      flex: 0 0 auto;
      min-width: 72px;
      min-height: 24px;
      padding: 0 8px;
      font-size: 10px;
    }

    .resume-matcher-run-style-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 2px;
    }

    .resume-matcher-run-style-label {
      color: rgba(88, 28, 52, 0.78);
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .resume-matcher-run-style-info-button {
      appearance: none;
      width: 22px;
      height: 22px;
      padding: 0;
      border-radius: 999px;
      border: 1px solid rgba(208, 160, 176, 0.9);
      background: rgba(255, 255, 255, 0.86);
      color: rgba(108, 41, 64, 0.88);
      font-size: 12px;
      font-weight: 800;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .resume-matcher-run-style-info-button:hover,
    .resume-matcher-run-style-info-button:focus-visible {
      border-color: rgba(152, 35, 72, 0.78);
      color: rgba(152, 35, 72, 0.92);
      outline: none;
    }

    #${ROOT_ID} {
      overflow: visible;
    }

    .resume-matcher-run-style-popup {
      position: absolute;
      top: 0;
      z-index: 12;
      width: min(420px, calc(100vw - 40px));
      max-height: min(78vh, 640px);
      overflow: auto;
      pointer-events: auto;
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(208, 160, 176, 0.9);
      background: rgba(255, 255, 255, 0.94);
      color: #4c1d2d;
      box-shadow:
        0 18px 32px rgba(127, 29, 63, 0.16),
        0 2px 6px rgba(127, 29, 63, 0.08);
    }

    .resume-matcher-run-style-popup[data-side="left"] {
      right: calc(100% + 12px);
      left: auto;
    }

    .resume-matcher-run-style-popup[data-side="right"] {
      left: calc(100% + 12px);
      right: auto;
    }

    .resume-matcher-run-style-popup[hidden] {
      display: none;
    }

    .resume-matcher-style-info__title {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.3;
      color: #4c1d2d;
    }

    .resume-matcher-style-info__stack {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-style-info__section {
      display: grid;
      gap: 4px;
    }

    .resume-matcher-style-info__section-title {
      font-size: 12px;
      font-weight: 800;
      line-height: 1.25;
      color: #6f1b38;
    }

    .resume-matcher-style-info__line,
    .resume-matcher-style-info__footer,
    .resume-matcher-run-style-hint {
      font-size: 11px;
      line-height: 1.45;
      color: rgba(88, 28, 52, 0.74);
    }

    .resume-matcher-style-info__footer,
    .resume-matcher-run-style-hint {
      color: rgba(88, 28, 52, 0.62);
    }

    .resume-matcher-run-job__title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.05em;
      color: rgba(17, 24, 39, 0.92);
      padding-right: 8px;
    }

    .resume-matcher-run-ready {
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      padding: 0;
      background: #34c759;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      box-shadow: 0 4px 10px rgba(52, 199, 89, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4);
    }

    .resume-matcher-run-ready svg {
      width: 14px;
      height: 14px;
    }

    .resume-matcher-run-ready.is-actionable {
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }

    .resume-matcher-run-ready.is-actionable:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(123, 52, 16, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.28);
    }

    .resume-matcher-run-ready.is-muted {
      background: rgba(255, 255, 255, 0.4);
      color: rgba(0, 0, 0, 0.6);
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.45);
    }

    .resume-matcher-run-ready.is-loading {
      background: rgba(14, 165, 233, 0.2);
      color: rgba(3, 105, 161, 0.96);
      box-shadow: 0 4px 10px rgba(14, 165, 233, 0.16), inset 0 1px 1px rgba(255,255,255,0.4);
    }

    .resume-matcher-run-ready.is-warning {
      background: rgba(255, 168, 48, 0.92);
      color: rgba(123, 52, 16, 0.98);
      box-shadow: 0 4px 10px rgba(234, 120, 21, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.28);
    }

    .resume-matcher-run-ready.is-error {
      background: rgba(255, 79, 79, 0.92);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(220, 38, 38, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.22);
    }

    .resume-matcher-run-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      line-height: 1.4;
      color: rgba(0, 0, 0, 0.72);
      margin-top: -4px;
    }

    .resume-matcher-run-meta strong {
      color: rgba(0, 0, 0, 0.85);
      font-weight: 600;
    }

    .resume-matcher-run-meta__bullet {
      color: rgba(0, 0, 0, 0.35);
      font-size: 10px;
    }

    .resume-matcher-onboarding {
      display: grid;
      gap: 14px;
      padding: 16px;
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(245, 248, 255, 0.92)),
        rgba(255, 255, 255, 0.6);
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.55);
    }

    .resume-matcher-onboarding__progress {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .resume-matcher-onboarding__progress-step {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .resume-matcher-onboarding__progress-bar {
      height: 4px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      overflow: hidden;
    }

    .resume-matcher-onboarding__progress-bar::after {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: rgba(148, 163, 184, 0.3);
      transform: scaleX(0.42);
      transform-origin: left center;
    }

    .resume-matcher-onboarding__progress-step.is-active .resume-matcher-onboarding__progress-bar::after,
    .resume-matcher-onboarding__progress-step.is-complete .resume-matcher-onboarding__progress-bar::after {
      transform: scaleX(1);
      background: linear-gradient(90deg, #8e2247, #c04e77);
    }

    .resume-matcher-onboarding__progress-label {
      min-width: 0;
      font-size: 11px;
      line-height: 1.25;
      color: rgba(0, 0, 0, 0.42);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resume-matcher-onboarding__progress-step.is-active .resume-matcher-onboarding__progress-label,
    .resume-matcher-onboarding__progress-step.is-complete .resume-matcher-onboarding__progress-label {
      color: #5b1a30;
    }

    .resume-matcher-onboarding__eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0, 0, 0, 0.48);
    }

    .resume-matcher-onboarding__title {
      font-size: 26px;
      line-height: 1.02;
      letter-spacing: -0.06em;
      font-weight: 700;
      color: rgba(17, 24, 39, 0.94);
    }

    .resume-matcher-onboarding__text,
    .resume-matcher-onboarding__list,
    .resume-matcher-onboarding__help {
      font-size: 14px;
      line-height: 1.45;
      color: rgba(0, 0, 0, 0.7);
      margin: 0;
    }

    .resume-matcher-onboarding__help--subtle {
      font-size: 12px;
      color: rgba(71, 85, 105, 0.82);
      font-style: italic;
    }

    .resume-matcher-onboarding__list {
      padding-left: 18px;
    }

    .resume-matcher-onboarding__badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(52, 199, 89, 0.14);
      color: rgba(22, 101, 52, 0.95);
      font-size: 13px;
      font-weight: 700;
    }

    .resume-matcher-onboarding__status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.76);
      color: rgba(17, 24, 39, 0.62);
    }

    .resume-matcher-onboarding__status-pill.is-required {
      background: rgba(249, 115, 22, 0.12);
      color: rgba(154, 52, 18, 0.94);
      border-color: rgba(249, 115, 22, 0.22);
    }

    .resume-matcher-onboarding__status-pill.is-optional {
      background: rgba(255, 255, 255, 0.76);
      color: rgba(17, 24, 39, 0.52);
    }

    .resume-matcher-onboarding__status-pill.is-complete {
      background: rgba(52, 199, 89, 0.14);
      color: rgba(22, 101, 52, 0.95);
      border-color: rgba(52, 199, 89, 0.18);
    }

    .resume-matcher-onboarding__row {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-onboarding__file {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-onboarding__file-top,
    .resume-matcher-onboarding__provider-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .resume-matcher-onboarding__label {
      font-size: 13px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.82);
      min-width: 0;
    }

    .resume-matcher-onboarding__status {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      min-width: 0;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resume-matcher-onboarding__link {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      color: rgba(0, 122, 255, 0.92);
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .resume-matcher-onboarding__link svg {
      width: 18px;
      height: 18px;
      display: block;
    }

    .resume-matcher-onboarding__provider-grid {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field input {
      min-height: 44px;
      padding: 10px 14px;
      border-radius: 14px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      font-size: 13px;
      line-height: 1.3;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select {
      padding-right: 38px;
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select:focus,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field input:focus {
      outline: none;
      border-color: rgba(152, 35, 72, 0.72);
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.14),
        inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select option {
      color: #4c1d2d;
      background: #ffffff;
    }

    .resume-matcher-onboarding__provider-note {
      margin: 0;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(15, 23, 42, 0.06);
      background: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      line-height: 1.4;
      color: rgba(17, 24, 39, 0.64);
    }

    .resume-matcher-onboarding__provider-note strong {
      color: rgba(17, 24, 39, 0.84);
    }

    .resume-matcher-onboarding__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .resume-matcher-field {
      display: grid;
      gap: 4px;
    }

    .resume-matcher-field label {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-run-shell .resume-matcher-field label {
      display: none;
    }

    .resume-matcher-run-shell .resume-matcher-field--notes label {
      display: block;
      color: rgba(88, 28, 52, 0.78);
      letter-spacing: 0.08em;
    }

    .resume-matcher-field input,
    .resume-matcher-field textarea,
    .resume-matcher-field select,
    .resume-matcher-file-display {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border-radius: 14px;
      border: 1px solid rgba(216, 206, 187, 0.96);
      background: #ffffff;
      color: #1f2937;
      padding: 11px 12px;
      font: inherit;
      font-size: 13px;
      line-height: 1.4;
    }

    .resume-matcher-field select,
    .resume-matcher-settings-item select {
      appearance: none;
      -webkit-appearance: none;
      background-image:
        linear-gradient(45deg, transparent 50%, rgba(71, 85, 105, 0.82) 50%),
        linear-gradient(135deg, rgba(71, 85, 105, 0.82) 50%, transparent 50%);
      background-position:
        calc(100% - 18px) calc(50% - 2px),
        calc(100% - 12px) calc(50% - 2px);
      background-size: 6px 6px, 6px 6px;
      background-repeat: no-repeat;
      padding-right: 34px;
      color: #1f2937;
    }

    .resume-matcher-field select option,
    .resume-matcher-settings-item select option {
      color: #1f2937;
      background: #ffffff;
    }

    .resume-matcher-field textarea {
      resize: none;
      overflow-y: hidden;
      min-height: 86px;
      padding-top: 14px;
      padding-bottom: 14px;
      line-height: 1.45;
    }

    .resume-matcher-run-shell .resume-matcher-field input,
    .resume-matcher-run-shell .resume-matcher-field textarea {
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.84);
      background: rgba(255, 255, 255, 0.72);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.03);
      color: rgba(0, 0, 0, 0.82);
    }

    .resume-matcher-field input::placeholder,
    .resume-matcher-field textarea::placeholder {
      color: rgba(0, 0, 0, 0.56);
    }

    .resume-matcher-field input:focus,
    .resume-matcher-field textarea:focus,
    .resume-matcher-field select:focus {
      outline: none;
      border-color: rgba(147, 197, 253, 0.95);
      box-shadow: 0 0 0 3px rgba(219, 234, 254, 0.8);
    }

    .resume-matcher-run-shell .resume-matcher-field input:focus,
    .resume-matcher-run-shell .resume-matcher-field textarea:focus {
      background: rgba(255, 255, 255, 0.84);
      border-color: rgba(0, 122, 255, 0.4);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .resume-matcher-run-shell .resume-matcher-field--notes textarea {
      border-color: rgba(208, 160, 176, 0.9);
      background: #ffffff;
      box-shadow:
        0 10px 22px rgba(127, 29, 63, 0.06),
        inset 0 1px 2px rgba(91, 26, 48, 0.03);
      color: #4c1d2d;
      caret-color: #982348;
    }

    .resume-matcher-run-shell .resume-matcher-field--notes textarea:hover {
      border-color: rgba(168, 85, 110, 0.88);
      box-shadow:
        0 12px 24px rgba(127, 29, 63, 0.08),
        inset 0 1px 2px rgba(91, 26, 48, 0.03);
    }

    .resume-matcher-run-shell .resume-matcher-field--notes textarea:focus {
      background: #ffffff;
      border-color: rgba(152, 35, 72, 0.78);
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.16),
        0 14px 28px rgba(127, 29, 63, 0.08);
    }

    .resume-matcher-run-manual-details {
      display: grid;
      gap: 8px;
      margin-top: 2px;
    }

    .resume-matcher-run-manual-details__toggle {
      justify-self: start;
    }

    .resume-matcher-run-manual-details__panel {
      display: grid;
      gap: 8px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.82);
      background: rgba(255, 252, 252, 0.62);
      padding: 10px;
    }

    .resume-matcher-run-manual-details__panel[hidden] {
      display: none;
    }

    .resume-matcher-run-shell .resume-matcher-field--manual-meta label {
      display: block;
      color: rgba(88, 28, 52, 0.72);
      letter-spacing: 0.08em;
    }

    .resume-matcher-run-shell .resume-matcher-run-manual-details__panel input {
      background: rgba(255, 255, 255, 0.84);
    }

    .resume-matcher-field__hint {
      font-size: 12px;
      line-height: 1.4;
      color: rgba(0, 0, 0, 0.62);
      margin-top: 4px;
    }

    .resume-matcher-file-row {
      display: block;
    }

    .resume-matcher-file-chip {
      min-height: 38px;
      border-radius: 999px;
      border: 1px solid rgba(216, 206, 187, 0.96);
      background: rgba(255, 255, 255, 0.86);
      padding: 0 6px 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.2;
    }

    .resume-matcher-file-chip.is-placeholder {
      color: #98a2b3;
    }

    .resume-matcher-file-chip__text {
      display: block;
      flex: 1 1 0%;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .resume-matcher-file-chip__actions {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
    }

    .resume-matcher-file-chip__action {
      width: 28px;
      min-width: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: #344054;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .resume-matcher-file-chip__action:hover {
      background: rgba(15, 23, 42, 0.06);
    }

    .resume-matcher-file-chip__action .resume-matcher-button__icon {
      width: 16px;
      height: 16px;
    }

    .resume-matcher-file-chip__icon-image {
      width: 14px;
      height: 14px;
      display: block;
      opacity: 0.82;
    }

    .resume-matcher-file-input {
      display: none;
    }

    .resume-matcher-file-display {
      min-height: 44px;
      display: flex;
      align-items: center;
      color: #1f2937;
    }

    .resume-matcher-file-display.is-placeholder {
      color: #98a2b3;
    }

    .resume-matcher-button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .resume-matcher-button {
      appearance: none;
      box-sizing: border-box;
      border: 1px solid rgba(216, 206, 187, 0.96);
      border-radius: 999px;
      background: #ffffff;
      color: #344054;
      padding: 10px 14px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
      min-height: 40px;
    }

    .resume-matcher-button__icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .resume-matcher-button__icon svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    .resume-matcher-button__icon--google {
      width: 13px;
      height: 13px;
    }

    .resume-matcher-button__icon--google svg {
      width: 13px;
      height: 13px;
    }

    .resume-matcher-button.is-primary {
      border-color: rgba(147, 197, 253, 0.96);
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
    }

    .resume-matcher-run-shell .resume-matcher-button {
      border-radius: 20px;
      min-height: 48px;
      padding: 0 18px;
      font-size: 14px;
    }

    .resume-matcher-run-shell .resume-matcher-button.is-primary {
      background: #007aff;
      border-color: rgba(0, 122, 255, 0.18);
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }

    .resume-matcher-run-shell .resume-matcher-button:not(.is-primary) {
      background: rgba(255, 255, 255, 0.72);
      border-color: rgba(255, 255, 255, 0.84);
      color: rgba(0, 0, 0, 0.82);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    }

    .resume-matcher-run-shell .resume-matcher-button-row {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: nowrap;
    }

    .resume-matcher-run-shell .resume-matcher-button-row.is-hidden {
      display: none;
    }

    .resume-matcher-run-shell .resume-matcher-button.is-primary {
      flex: 1;
    }

    .resume-matcher-run-cancel-row {
      display: flex;
      justify-content: center;
      margin-top: -4px;
    }

    .resume-matcher-run-cancel-row[hidden] {
      display: none;
    }

    .resume-matcher-run-cancel {
      appearance: none;
      border: 0;
      background: transparent;
      color: rgba(74, 35, 51, 0.78);
      font: inherit;
      font-size: 12px;
      line-height: 1.2;
      padding: 2px 0;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .resume-matcher-run-cancel:disabled {
      cursor: default;
      opacity: 0.55;
    }

    .resume-matcher-button.is-danger {
      color: #b42318;
    }

    .resume-matcher-button.is-quiet {
      border-color: transparent;
      background: transparent;
      color: rgba(74, 35, 51, 0.76);
      box-shadow: none;
      padding-left: 8px;
      padding-right: 8px;
    }

    .resume-matcher-button:disabled {
      cursor: default;
      opacity: 0.55;
      box-shadow: none;
    }

    #${ROOT_ID}[data-running="true"] .resume-matcher-field textarea:disabled,
    #${ROOT_ID}[data-running="true"] .resume-matcher-field input:disabled,
    #${ROOT_ID}[data-running="true"] .resume-matcher-field select:disabled {
      cursor: default;
      opacity: 0.78;
    }

    .resume-matcher-status-card {
      display: none;
      gap: 4px;
      color: #4a2333;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      line-height: 1.4;
    }

    .resume-matcher-status-card.is-visible {
      display: grid;
    }

    .resume-matcher-status-card[data-tone="error"] {
      background: rgba(255, 214, 214, 0.5);
      color: #a01f1f;
    }

    .resume-matcher-status-card[data-tone="running"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="success"] {
      background: rgba(167, 215, 193, 0.4);
      color: #1a5a38;
    }

    .resume-matcher-status-card[data-tone="blocked"] {
      background: rgba(252, 227, 200, 0.5);
      color: #7a4b1a;
    }

    .resume-matcher-status-card[data-tone="warning"] {
      background: rgba(252, 227, 200, 0.5);
      color: #7a4b1a;
    }

    .resume-matcher-status-card[data-tone="info"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="neutral"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="idle"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-title {
      font-size: 16px;
      font-weight: 700;
      color: inherit;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }

    .resume-matcher-status-detail {
      font-size: 14px;
      line-height: 1.4;
      color: inherit;
      opacity: 0.92;
      overflow-wrap: anywhere;
    }

    .resume-matcher-status-savelogs {
      display: inline;
      font-size: 13px;
      font-weight: 600;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
      opacity: 0.85;
    }

    .resume-matcher-status-savelogs:hover {
      opacity: 1;
    }

    .resume-matcher-status-spinner {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      border-radius: 999px;
      border: 2px solid rgba(74, 35, 51, 0.2);
      border-top-color: currentColor;
      animation: resume-matcher-spin 0.85s linear infinite;
    }

    @keyframes resume-matcher-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes resume-matcher-launcher-ring {
      to {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    .resume-matcher-history-list {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-history-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .resume-matcher-history-search {
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
    }

    .resume-matcher-history-search input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      height: 42px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.82);
      box-shadow:
        inset 0 1px 3px rgba(0, 0, 0, 0.02),
        0 10px 22px rgba(15, 23, 42, 0.04);
      color: rgba(0, 0, 0, 0.82);
      padding: 0 52px 0 16px;
      font: inherit;
      font-size: 13px;
      line-height: 1.3;
    }

    .resume-matcher-history-search input::placeholder {
      color: rgba(0, 0, 0, 0.56);
    }

    .resume-matcher-history-search input:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.92);
      border-color: rgba(0, 122, 255, 0.4);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .resume-matcher-history-filter {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      z-index: 1;
    }

    .resume-matcher-history-filter__button {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: none;
      background: rgba(248, 250, 252, 0.9);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: rgba(0, 0, 0, 0.72);
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
      padding: 0;
    }

    .resume-matcher-history-filter__button:hover {
      background: rgba(255, 255, 255, 0.98);
    }

    .resume-matcher-history-filter__button svg {
      width: 14px;
      height: 14px;
    }

    .resume-matcher-history-filter__menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 2;
      min-width: 132px;
      display: none;
      grid-template-columns: 1fr;
      gap: 4px;
      padding: 6px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.84);
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .resume-matcher-history-filter[data-open="true"] .resume-matcher-history-filter__menu {
      display: grid;
    }

    .resume-matcher-history-filter__option {
      appearance: none;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: #344054;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
    }

    .resume-matcher-history-filter__option:hover,
    .resume-matcher-history-filter__option.is-active {
      background: rgba(0, 122, 255, 0.1);
      color: #0b63ce;
    }

    .resume-matcher-history-item {
      display: grid;
      gap: 10px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.78);
      background: rgba(255, 255, 255, 0.68);
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.06);
      padding: 14px 16px;
    }

    .resume-matcher-history-item__top {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      gap: 6px;
      min-width: 0;
    }

    .resume-matcher-history-item__title,
    .resume-matcher-history-item__title-button {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
      color: #1f2937;
    }

    .resume-matcher-history-item__title-button {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      text-align: left;
      cursor: pointer;
      width: fit-content;
      max-width: 100%;
      text-wrap: balance;
    }

    .resume-matcher-history-item__title-button:hover {
      color: #0f4e99;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .resume-matcher-history-item__company {
      font-size: 12px;
      line-height: 1.35;
      color: #475467;
    }

    .resume-matcher-history-item__meta {
      font-size: 11px;
      line-height: 1.3;
      color: #667085;
    }

    .resume-matcher-history-item__footer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
    }

    .resume-matcher-history-item__actions {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      min-width: 0;
    }

    .resume-matcher-history-item__link {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      color: #1f6fe5;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
    }

    .resume-matcher-history-item__link:hover {
      text-decoration: underline;
    }

    .resume-matcher-history-item__delete {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      color: #a01f1f;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .resume-matcher-history-item__delete:hover {
      text-decoration: underline;
    }

    .resume-matcher-history-item__delete:disabled {
      cursor: wait;
      opacity: 0.55;
      text-decoration: none;
    }

    .resume-matcher-history-pagination {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
      color: #667085;
      font-size: 12px;
      font-weight: 600;
    }

    .resume-matcher-history-pagination button {
      appearance: none;
      width: 34px;
      height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.88);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.78);
      color: #344054;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    .resume-matcher-history-pagination button:disabled {
      opacity: 0.32;
      cursor: default;
    }

    .resume-matcher-history-pagination button svg {
      width: 16px;
      height: 16px;
    }

    .resume-matcher-history-pagination button:first-child {
      justify-self: start;
    }

    .resume-matcher-history-pagination button:last-child {
      justify-self: end;
    }

    .resume-matcher-history-pagination span {
      justify-self: center;
      font-size: 13px;
      color: #475467;
    }

    .resume-matcher-settings-stack {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-settings-group {
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background: rgba(255, 255, 255, 0.62);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
      padding: 10px 12px 12px;
    }

    .resume-matcher-settings-title {
      margin: 0 0 10px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-settings-health {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 36px;
      margin: -2px 0 8px;
      padding: 7px 10px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.56);
      background: rgba(255, 252, 252, 0.58);
      color: rgba(91, 26, 48, 0.82);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.25;
    }

    .resume-matcher-settings-health[data-state="ready"] {
      border-color: rgba(134, 239, 172, 0.36);
      background: rgba(240, 253, 244, 0.54);
      color: rgba(22, 101, 52, 0.9);
    }

    .resume-matcher-settings-row-card {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 10px 0;
      border-top: 1px solid rgba(226, 188, 200, 0.48);
    }

    .resume-matcher-settings-row-card:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .resume-matcher-settings-row-card__main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(92px, max-content);
      align-items: center;
      gap: 12px;
    }

    .resume-matcher-settings-row-card__copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .resume-matcher-settings-row-card__topline {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .resume-matcher-settings-row-card__title {
      min-width: 0;
      color: #4c1d2d;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.2;
    }

    .resume-matcher-settings-row-card__warning-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      color: rgba(146, 64, 14, 0.92);
      flex: 0 0 auto;
    }

    .resume-matcher-settings-row-card__warning-icon img,
    .resume-matcher-settings-row-card__warning-icon svg {
      width: 24px;
      height: 24px;
      display: block;
    }

    .resume-matcher-settings-row-card__value {
      min-width: 0;
      color: rgba(76, 29, 45, 0.9);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .resume-matcher-settings-row-card__detail {
      min-width: 0;
      color: rgba(79, 30, 45, 0.72);
      font-size: 12px;
      line-height: 1.38;
    }

    .resume-matcher-settings-row-card__detail--secondary {
      color: rgba(79, 30, 45, 0.56);
      font-size: 11px;
    }

    .resume-matcher-settings-row-card__detail a {
      color: rgba(142, 34, 71, 0.74);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .resume-matcher-secondary-link {
      font-weight: 600;
    }

    .resume-matcher-settings-row-card__actions {
      display: inline-flex;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: nowrap;
      gap: 6px;
      min-width: 92px;
    }

    .resume-matcher-settings-row-card__action-stack {
      display: grid;
      justify-items: end;
      gap: 4px;
      min-width: 92px;
    }

    .resume-matcher-settings-row-card__subtle-action {
      appearance: none;
      border: 0;
      background: transparent;
      color: rgba(122, 44, 66, 0.72);
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      line-height: 1.2;
      padding: 0;
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
      transition: color 0.16s ease, opacity 0.16s ease;
    }

    .resume-matcher-settings-row-card__subtle-action:hover,
    .resume-matcher-settings-row-card__subtle-action:focus-visible {
      color: rgba(142, 34, 71, 0.9);
      outline: none;
    }

    .resume-matcher-settings-row-card__subtle-action:disabled {
      cursor: default;
      opacity: 0.46;
      pointer-events: none;
    }

    .resume-matcher-settings-row-card__panel {
      display: grid;
      gap: 8px;
      border-radius: 14px;
      border: 1px solid rgba(231, 197, 207, 0.86);
      background: rgba(255, 252, 252, 0.78);
      padding: 10px;
    }

    .resume-matcher-settings-row-card__panel[hidden] {
      display: none;
    }

    .resume-matcher-settings-row-card__panel > select,
    .resume-matcher-settings-row-card__panel input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
      padding: 9px 11px;
      font: inherit;
      font-size: 13px;
      line-height: 1.35;
    }

    .resume-matcher-settings-row-card__panel > select {
      appearance: none;
      -webkit-appearance: none;
      background-image:
        linear-gradient(45deg, transparent 50%, rgba(91, 26, 48, 0.66) 50%),
        linear-gradient(135deg, rgba(91, 26, 48, 0.66) 50%, transparent 50%);
      background-position:
        calc(100% - 18px) calc(50% - 2px),
        calc(100% - 12px) calc(50% - 2px);
      background-size: 6px 6px, 6px 6px;
      background-repeat: no-repeat;
      padding-right: 34px;
    }

    .resume-matcher-settings-row-card__panel select:focus,
    .resume-matcher-settings-row-card__panel input:focus {
      outline: none !important;
      border-color: rgba(152, 35, 72, 0.64) !important;
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.12),
        inset 0 1px 2px rgba(91, 26, 48, 0.04) !important;
    }

    .resume-matcher-settings-status-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      border-radius: 999px;
      padding: 3px 7px;
      border: 1px solid rgba(203, 213, 225, 0.54);
      background: rgba(248, 250, 252, 0.58);
      color: rgba(71, 85, 105, 0.78);
      font-size: 9px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
    }

    .resume-matcher-settings-status-pill[data-tone="ready"],
    .resume-matcher-settings-status-pill[data-tone="saved"],
    .resume-matcher-settings-status-pill[data-tone="connected"] {
      border-color: rgba(134, 239, 172, 0.42);
      background: rgba(220, 252, 231, 0.5);
      color: rgba(22, 101, 52, 0.9);
    }

    .resume-matcher-settings-status-pill[data-tone="optional"] {
      border-color: rgba(251, 191, 36, 0.52);
      background: rgba(255, 251, 235, 0.74);
      color: rgba(146, 64, 14, 0.94);
    }

    .resume-matcher-settings-status-pill[data-tone="needed"],
    .resume-matcher-settings-status-pill[data-tone="error"] {
      border-color: rgba(252, 165, 165, 0.42);
      background: rgba(254, 242, 242, 0.62);
      color: rgba(153, 27, 27, 0.9);
    }

    .resume-matcher-settings-stack {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-settings-list {
      display: grid;
      gap: 12px;
    }

    .resume-matcher-settings-item {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .resume-matcher-settings-item__title {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-settings-item__title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .resume-matcher-settings-item__title-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 1px solid rgba(203, 213, 225, 0.92);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.9);
      color: #8e2247;
      cursor: pointer;
      transition:
        border-color 120ms ease,
        background-color 120ms ease,
        color 120ms ease,
        transform 120ms ease;
    }

    .resume-matcher-settings-item__title-action:hover:not(:disabled) {
      border-color: rgba(142, 34, 71, 0.3);
      background: rgba(255, 245, 248, 0.98);
      transform: translateY(-1px);
    }

    .resume-matcher-settings-item__title-action:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      transform: none;
    }

    .resume-matcher-settings-item__title-action svg {
      width: 12px;
      height: 12px;
    }

    .resume-matcher-settings-item__detail {
      font-size: 12px;
      line-height: 1.45;
      color: rgba(71, 85, 105, 0.86);
      margin-top: -2px;
    }

    .resume-matcher-settings-item__detail a {
      color: rgba(29, 78, 216, 0.92);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .resume-matcher-master-row {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-master-row__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .resume-matcher-master-row__copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .resume-matcher-master-row__filename {
      display: inline-block;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: bottom;
      white-space: nowrap;
    }

    .resume-matcher-master-row__actions {
      display: inline-flex;
      flex: 0 0 auto;
      gap: 6px;
    }

    .resume-matcher-master-row__panel {
      display: grid;
      gap: 8px;
      border-radius: 14px;
      border: 1px solid rgba(231, 197, 207, 0.9);
      background: rgba(255, 252, 252, 0.76);
      padding: 10px;
    }

    .resume-matcher-master-row__status {
      font-size: 11px;
      line-height: 1.35;
      color: rgba(71, 85, 105, 0.86);
    }

    .resume-matcher-settings-item__link {
      display: inline-flex;
      width: fit-content;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.3;
      color: rgba(154, 79, 103, 0.88);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .resume-matcher-settings-substack {
      display: grid;
      gap: 8px;
      padding-top: 2px;
    }

    .resume-matcher-settings-substack--compact {
      gap: 4px;
      padding-top: 0;
    }

    .resume-matcher-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .resume-matcher-settings-grid--single {
      grid-template-columns: minmax(0, 1fr);
    }

    .resume-matcher-settings-grid > .resume-matcher-field--full {
      grid-column: 1 / -1;
    }

    .resume-matcher-settings-row {
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    .resume-matcher-settings-row + .resume-matcher-settings-row {
      margin-top: 8px;
    }

    .resume-matcher-settings-row__label {
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-settings-row__body {
      min-width: 0;
      display: grid;
      gap: 6px;
    }

    .resume-matcher-settings-item .resume-matcher-file-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .resume-matcher-settings-item .resume-matcher-file-display,
    .resume-matcher-settings-item select,
    .resume-matcher-settings-item input {
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
      padding: 9px 11px;
      font-size: 12px;
    }

    .resume-matcher-settings-item input:focus,
    .resume-matcher-settings-item select:focus,
    .resume-matcher-settings-row input:focus,
    .resume-matcher-settings-row select:focus,
    .resume-matcher-secret-field input:focus {
      outline: none;
      border-color: rgba(152, 35, 72, 0.72);
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.14),
        inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-field[data-invalid="true"] input,
    .resume-matcher-field[data-invalid="true"] select,
    .resume-matcher-settings-item[data-invalid="true"] input,
    .resume-matcher-settings-item select[data-invalid="true"] {
      border-color: rgba(185, 28, 28, 0.84);
      background: rgba(254, 242, 242, 0.96);
      box-shadow:
        0 0 0 3px rgba(248, 113, 113, 0.16),
        inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-field[data-required-empty="true"] input,
    .resume-matcher-field[data-required-empty="true"] select,
    .resume-matcher-settings-item[data-required-empty="true"] input,
    .resume-matcher-settings-item select[data-required-empty="true"] {
      border-color: rgba(152, 35, 72, 0.58) !important;
      background: rgba(255, 247, 250, 0.98) !important;
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.12),
        inset 0 1px 2px rgba(91, 26, 48, 0.04) !important;
    }

    .resume-matcher-field[data-required-empty="true"] input::placeholder,
    .resume-matcher-settings-item[data-required-empty="true"] input::placeholder {
      color: rgba(152, 35, 72, 0.8);
      font-weight: 600;
      opacity: 1;
    }

    .resume-matcher-settings-item .resume-matcher-button,
    .resume-matcher-settings-group .resume-matcher-button {
      min-height: 36px;
      padding: 9px 12px;
      font-size: 12px;
    }

    .resume-matcher-google-connect {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      flex-wrap: nowrap;
    }

    .resume-matcher-google-button {
      min-height: 34px;
      padding: 7px 16px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .resume-matcher-settings-row .resume-matcher-file-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .resume-matcher-settings-row .resume-matcher-file-display,
    .resume-matcher-settings-row select,
    .resume-matcher-settings-row input {
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
      padding: 9px 11px;
      font-size: 12px;
    }

    .resume-matcher-secret-field {
      position: relative;
      display: grid;
      align-items: center;
    }

    .resume-matcher-secret-field input {
      padding-right: 42px !important;
    }

    .resume-matcher-secret-toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: rgba(111, 58, 76, 0.72);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
    }

    .resume-matcher-secret-toggle:hover {
      background: rgba(127, 29, 63, 0.08);
      color: rgba(91, 26, 48, 0.92);
    }

    .resume-matcher-secret-toggle:focus-visible {
      outline: none;
      background: rgba(127, 29, 63, 0.1);
      box-shadow: 0 0 0 3px rgba(168, 85, 110, 0.14);
      color: rgba(91, 26, 48, 0.92);
    }

    .resume-matcher-secret-toggle svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    .resume-matcher-settings-row .resume-matcher-button,
    .resume-matcher-settings-group .resume-matcher-button {
      min-height: 36px;
      padding: 9px 12px;
      font-size: 12px;
    }

    .resume-matcher-settings-row-card__actions .resume-matcher-button {
      min-width: 70px;
      min-height: 34px;
      padding: 8px 12px;
      font-size: 12px;
    }

    .resume-matcher-settings-row-card__actions .resume-matcher-google-button.is-quiet {
      min-width: 0;
      min-height: 30px;
      padding: 5px 6px;
      font-size: 11px;
      color: rgba(91, 26, 48, 0.66);
    }

    #${ACCOUNT_DETAIL_ID} {
      color: rgba(76, 29, 45, 0.78);
      font-weight: 500;
    }

    .resume-matcher-settings-row .resume-matcher-button-row {
      flex-wrap: nowrap;
    }

    .resume-matcher-inline-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: #667085;
      min-width: 0;
      min-height: 38px;
    }

    .resume-matcher-inline-action--compact {
      min-height: 30px;
    }

    .resume-matcher-checkbox {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      width: 0;
      height: 0;
    }

    .resume-matcher-inline-action__label {
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      color: rgba(91, 26, 48, 0.84);
    }

    .resume-matcher-toggle {
      position: relative;
      width: 38px;
      height: 22px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.36);
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.16);
      flex: 0 0 auto;
      transition: background 140ms ease;
    }

    .resume-matcher-toggle::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
      transition: transform 140ms ease;
    }

    .resume-matcher-checkbox:checked + .resume-matcher-toggle {
      background: rgba(37, 99, 235, 0.88);
    }

    .resume-matcher-checkbox:checked + .resume-matcher-toggle::after {
      transform: translateX(16px);
    }

    .resume-matcher-inline-action:focus-within .resume-matcher-toggle {
      box-shadow:
        inset 0 0 0 1px rgba(152, 35, 72, 0.28),
        0 0 0 3px rgba(168, 85, 110, 0.14);
    }

    .resume-matcher-advanced {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-advanced > summary {
      list-style: none;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-advanced > summary + * {
      margin-top: 2px;
    }

    .resume-matcher-advanced .resume-matcher-settings-group {
      border-color: rgba(255, 255, 255, 0.56);
      background: rgba(255, 255, 255, 0.48);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.04);
    }

    .resume-matcher-advanced-actions {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .resume-matcher-advanced-actions .resume-matcher-button {
      width: 100%;
      justify-content: center;
      min-height: 38px !important;
      padding: 8px 12px !important;
      font-size: 12px !important;
      line-height: 1 !important;
    }

    .resume-matcher-advanced-actions .resume-matcher-button:nth-child(3) {
      grid-column: 1 / -1;
    }

    @media (max-width: 360px) {
      .resume-matcher-advanced-actions {
        grid-template-columns: minmax(0, 1fr);
      }

      .resume-matcher-advanced-actions .resume-matcher-button:nth-child(3) {
        grid-column: auto;
      }
    }

    .resume-matcher-advanced > summary::-webkit-details-marker {
      display: none;
    }

    .resume-matcher-empty {
      font-size: 13px;
      line-height: 1.45;
      color: #667085;
      padding: 12px 0;
    }

    .resume-matcher-empty .resume-matcher-button {
      margin-top: 10px;
    }

    #${ROOT_ID} {
      color: #381622;
    }

    #${LAUNCHER_ID} {
      border-color: rgba(255, 234, 239, 0.88);
      background:
        linear-gradient(180deg, rgba(133, 35, 68, 0.94), rgba(98, 21, 50, 0.96)),
        rgba(117, 26, 57, 0.94);
      box-shadow:
        -10px 20px 30px rgba(64, 16, 34, 0.3),
        inset 0 1px 1px rgba(255, 243, 246, 0.34);
    }

    #${LAUNCHER_ID}::before {
      background: conic-gradient(
        from 0deg at 50% 50%,
        rgba(123, 29, 64, 0) 0deg,
        rgba(123, 29, 64, 0) 210deg,
        rgba(196, 74, 118, 0.18) 265deg,
        rgba(232, 120, 156, 0.76) 320deg,
        rgba(245, 192, 206, 0.28) 346deg,
        rgba(123, 29, 64, 0) 360deg
      );
      filter: drop-shadow(0 0 14px rgba(196, 74, 118, 0.28));
    }

    #${LAUNCHER_CLOSE_ID} {
      border-color: rgba(253, 226, 235, 0.92);
      background: rgba(255, 246, 248, 0.96);
      color: rgba(91, 26, 48, 0.74);
    }

    #${BOARD_ID} {
      border-color: rgba(255, 228, 236, 0.72);
      background:
        radial-gradient(circle at top right, rgba(138, 31, 68, 0.18), transparent 34%),
        linear-gradient(180deg, rgba(248, 237, 241, 0.97), rgba(242, 225, 231, 0.95)),
        rgba(243, 228, 233, 0.94);
      box-shadow:
        -12px 26px 36px rgba(76, 21, 41, 0.18),
        inset 0 1px 1px rgba(255, 246, 248, 0.86);
    }

    .resume-matcher-board__header {
      border-bottom-color: rgba(136, 34, 68, 0.14);
      background:
        linear-gradient(to bottom, rgba(110, 22, 54, 0.1), rgba(110, 22, 54, 0.04)),
        rgba(255, 248, 250, 0.62);
      box-shadow: inset 0 -1px 0 rgba(255, 231, 237, 0.66);
    }

    .resume-matcher-board__title,
    .resume-matcher-run-job__title {
      color: #3f1424;
    }

    .resume-matcher-board__brand img {
      filter: drop-shadow(0 4px 10px rgba(110, 22, 54, 0.18));
    }

    .resume-matcher-icon-button {
      border-color: rgba(255, 229, 236, 0.86);
      background: rgba(255, 247, 249, 0.58);
      color: rgba(91, 26, 48, 0.58);
      box-shadow: 0 6px 14px rgba(91, 26, 48, 0.04);
      opacity: 0.82;
    }

    .resume-matcher-icon-button:hover {
      background: rgba(255, 242, 246, 0.96);
      border-color: rgba(226, 171, 188, 0.92);
      color: rgba(91, 26, 48, 0.9);
      opacity: 1;
    }

    .resume-matcher-icon-button:disabled,
    .resume-matcher-icon-button:disabled:hover {
      background: rgba(255, 247, 249, 0.72);
      border-color: rgba(255, 229, 236, 0.72);
      color: rgba(91, 26, 48, 0.38);
    }

    .resume-matcher-icon-button.is-active {
      color: #5b1a30;
      background: linear-gradient(
        180deg,
        rgba(255, 250, 251, 0.98),
        rgba(247, 227, 234, 0.94)
      );
      border-color: rgba(205, 128, 155, 0.86);
      box-shadow:
        0 0 0 1px rgba(255, 244, 247, 0.24),
        0 0 18px rgba(162, 45, 84, 0.16),
        0 10px 22px rgba(91, 26, 48, 0.12);
      opacity: 1;
    }

    .resume-matcher-icon-button.is-active::after {
      border-color: rgba(170, 52, 91, 0.38);
      box-shadow: 0 0 14px rgba(170, 52, 91, 0.12);
    }

    #${BOARD_MINIMIZE_ID}.resume-matcher-icon-button {
      margin-left: 2px;
      background: rgba(255, 250, 251, 0.76);
      color: rgba(91, 26, 48, 0.72);
      opacity: 1;
    }

    .resume-matcher-section,
    .resume-matcher-history-item,
    .resume-matcher-settings-group,
    .resume-matcher-onboarding {
      border-color: rgba(255, 234, 239, 0.88);
      background: rgba(255, 249, 250, 0.74);
      box-shadow: 0 16px 30px rgba(91, 26, 48, 0.08);
    }

    .resume-matcher-run-shell {
      background: transparent;
      box-shadow: none;
    }

    .resume-matcher-job-meta,
    .resume-matcher-history-item__company,
    .resume-matcher-history-pagination span,
    .resume-matcher-settings-item__detail,
    .resume-matcher-empty,
    .resume-matcher-onboarding__text,
    .resume-matcher-onboarding__help,
    .resume-matcher-field__hint {
      color: rgba(79, 30, 45, 0.8);
    }

    .resume-matcher-status-title,
    .resume-matcher-status-detail {
      color: inherit;
    }

    .resume-matcher-run-ready {
      background: #7f1d3f;
      box-shadow: 0 8px 16px rgba(127, 29, 63, 0.26), inset 0 1px 1px rgba(255, 235, 241, 0.28);
    }

    .resume-matcher-run-ready.is-loading {
      background: rgba(127, 29, 63, 0.14);
      color: #7f1d3f;
      box-shadow: 0 8px 16px rgba(127, 29, 63, 0.12), inset 0 1px 1px rgba(255, 235, 241, 0.26);
    }

    .resume-matcher-field input,
    .resume-matcher-field textarea,
    .resume-matcher-field select,
    .resume-matcher-file-display,
    .resume-matcher-history-search input,
    .resume-matcher-history-filter__menu {
      border-color: rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
    }

    .resume-matcher-field input:hover,
    .resume-matcher-field textarea:hover,
    .resume-matcher-field select:hover,
    .resume-matcher-history-search input:hover,
    .resume-matcher-settings-item input:hover,
    .resume-matcher-settings-item select:hover,
    .resume-matcher-settings-row input:hover,
    .resume-matcher-settings-row select:hover,
    .resume-matcher-secret-field input:hover,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field input:hover,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field select:hover {
      border-color: rgba(205, 128, 155, 0.86);
      box-shadow: inset 0 1px 3px rgba(91, 26, 48, 0.05);
    }

    .resume-matcher-field input::placeholder,
    .resume-matcher-field textarea::placeholder,
    .resume-matcher-history-search input::placeholder {
      color: rgba(111, 58, 76, 0.58);
    }

    .resume-matcher-field input:focus,
    .resume-matcher-field textarea:focus,
    .resume-matcher-field select:focus,
    .resume-matcher-history-search input:focus {
      border-color: rgba(152, 35, 72, 0.72);
      box-shadow: 0 0 0 3px rgba(168, 85, 110, 0.14);
    }

    .resume-matcher-settings-row-card__panel select:focus,
    .resume-matcher-settings-row-card__panel input:focus,
    #${PROVIDER_SELECT_ID}:focus,
    #${PROVIDER_WEB_INPUT_ID}:focus,
    #${PROVIDER_API_BASE_INPUT_ID}:focus,
    #${PROVIDER_MODEL_INPUT_ID}:focus,
    #${PROVIDER_API_KEY_INPUT_ID}:focus {
      outline: none !important;
      border-color: rgba(152, 35, 72, 0.64) !important;
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.12),
        inset 0 1px 2px rgba(91, 26, 48, 0.04) !important;
    }

    .resume-matcher-field[data-invalid="true"] input,
    .resume-matcher-field[data-invalid="true"] select,
    .resume-matcher-settings-item[data-invalid="true"] input,
    .resume-matcher-settings-item select[data-invalid="true"] {
      border-color: rgba(185, 28, 28, 0.84);
      background: rgba(254, 242, 242, 0.96);
      box-shadow:
        0 0 0 3px rgba(248, 113, 113, 0.16),
        inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-field[data-required-empty="true"] input,
    .resume-matcher-field[data-required-empty="true"] select,
    .resume-matcher-settings-item[data-required-empty="true"] input,
    .resume-matcher-settings-item select[data-required-empty="true"] {
      border-color: rgba(152, 35, 72, 0.58) !important;
      background: rgba(255, 247, 250, 0.98) !important;
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.12),
        inset 0 1px 2px rgba(91, 26, 48, 0.04) !important;
    }

    .resume-matcher-field[data-required-empty="true"] input::placeholder,
    .resume-matcher-settings-item[data-required-empty="true"] input::placeholder {
      color: rgba(152, 35, 72, 0.8);
      font-weight: 600;
      opacity: 1;
    }

    .resume-matcher-run-shell .resume-matcher-field input,
    .resume-matcher-run-shell .resume-matcher-field textarea {
      border-color: rgba(237, 210, 219, 0.98);
      background: rgba(255, 251, 252, 0.9);
      color: #4c1d2d;
      box-shadow: inset 0 1px 3px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-file-chip {
      border-color: rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.92);
      color: #4c1d2d;
    }

    .resume-matcher-file-chip.is-placeholder {
      color: rgba(122, 92, 102, 0.84);
    }

    .resume-matcher-file-chip__action {
      color: #6c2940;
    }

    .resume-matcher-file-chip__action:hover {
      background: rgba(127, 29, 63, 0.08);
    }

    .resume-matcher-button {
      border-color: rgba(226, 188, 200, 0.98);
      background: rgba(255, 252, 252, 0.94);
      color: #5b1a30;
    }

    .resume-matcher-button.is-primary,
    .resume-matcher-run-shell .resume-matcher-button.is-primary {
      border-color: rgba(127, 29, 63, 0.9);
      background: linear-gradient(180deg, #8e2247, #691733);
      color: #fff8fa;
      box-shadow: 0 12px 24px rgba(105, 23, 51, 0.24);
    }

    .resume-matcher-run-shell .resume-matcher-button:not(.is-primary) {
      background: rgba(255, 250, 251, 0.9);
      border-color: rgba(234, 206, 215, 0.96);
      color: #5b1a30;
      box-shadow: 0 8px 18px rgba(91, 26, 48, 0.08);
    }

    .resume-matcher-button.is-danger {
      color: #b42318;
      border-color: rgba(248, 113, 113, 0.38);
      background: rgba(255, 247, 247, 0.92);
    }

    .resume-matcher-button.is-quiet {
      border-color: transparent;
      background: transparent;
      color: rgba(91, 26, 48, 0.72);
      box-shadow: none;
    }

    .resume-matcher-status-card[data-tone="running"] {
      background: rgba(255, 255, 255, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="success"] {
      background: rgba(167, 215, 193, 0.4);
      border-color: rgba(255, 255, 255, 0.6);
      color: #1a5a38;
    }

    .resume-matcher-status-card[data-tone="warning"] {
      background: rgba(252, 227, 200, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #7a4b1a;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
    }

    .resume-matcher-status-card[data-tone="blocked"] {
      background: rgba(252, 227, 200, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #7a4b1a;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
    }

    .resume-matcher-status-card[data-tone="error"] {
      background: rgba(255, 214, 214, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #a01f1f;
    }

    .resume-matcher-status-card[data-tone="info"],
    .resume-matcher-status-card[data-tone="neutral"],
    .resume-matcher-status-card[data-tone="idle"] {
      background: rgba(255, 255, 255, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #4a2333;
    }

    .resume-matcher-status-spinner {
      border-color: rgba(74, 35, 51, 0.2);
      border-top-color: currentColor;
    }

    .resume-matcher-settings-title,
    .resume-matcher-settings-item__title,
    .resume-matcher-settings-row__label,
    .resume-matcher-advanced > summary,
    .resume-matcher-onboarding__eyebrow,
    .resume-matcher-onboarding__label {
      color: rgba(108, 41, 64, 0.8);
    }

    .resume-matcher-settings-item__detail a,
    .resume-matcher-history-item__link,
    .resume-matcher-onboarding__link {
      color: #8e2247;
    }

    .resume-matcher-history-filter__button,
    .resume-matcher-history-pagination button {
      border-color: rgba(232, 206, 214, 0.86);
      background: rgba(255, 250, 251, 0.9);
      color: #5b1a30;
      box-shadow: inset 0 0 0 1px rgba(217, 180, 193, 0.12);
    }

    .resume-matcher-history-filter__option:hover,
    .resume-matcher-history-filter__option.is-active {
      background: rgba(142, 34, 71, 0.08);
      color: #8e2247;
    }

    .resume-matcher-onboarding__progress-bar {
      background: rgba(231, 197, 207, 0.74);
    }

    .resume-matcher-onboarding__progress-bar::after {
      background: linear-gradient(90deg, #8e2247, #c04e77);
    }

    .resume-matcher-onboarding__progress-label {
      color: rgba(91, 26, 48, 0.68);
    }

    .resume-matcher-onboarding__progress-step.is-active .resume-matcher-onboarding__progress-label,
    .resume-matcher-onboarding__progress-step.is-complete .resume-matcher-onboarding__progress-label {
      color: #5b1a30;
    }

    .resume-matcher-onboarding__provider-note {
      border-color: rgba(235, 209, 217, 0.92);
      background: rgba(255, 250, 251, 0.94);
      color: rgba(79, 30, 45, 0.82);
    }

    .resume-matcher-onboarding__help--subtle {
      color: rgba(108, 41, 64, 0.68);
      font-size: 11px;
    }

    .resume-matcher-toggle {
      background: rgba(180, 159, 167, 0.42);
      box-shadow: inset 0 0 0 1px rgba(167, 130, 143, 0.2);
    }

    .resume-matcher-checkbox:checked + .resume-matcher-toggle {
      background: rgba(127, 29, 63, 0.92);
    }

    @media (max-width: 520px) {
      #${ROOT_ID} {
        left: auto;
        right: ${EDGE_PADDING}px;
      }

      #${BOARD_ID} {
        width: calc(100vw - ${EDGE_GAP_TOTAL}px);
        max-width: calc(100vw - ${EDGE_GAP_TOTAL}px);
      }

      .resume-matcher-job-meta,
      .resume-matcher-readiness,
      .resume-matcher-settings-grid,
      .resume-matcher-settings-row {
        grid-template-columns: 1fr;
      }
    }
  `;
}
