# Extension Run State + Red-Wine Theme Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the extension run experience calmer and clearer by disabling edits during active runs, rotating long-wait messaging, reskinning the extension to a red-wine palette, and shortening fallback copy.

**Architecture:** Keep the implementation local to the extension content script. Reuse the existing run-state/status-card model, but add a timed message rotator, read-only input behavior during runs, and palette changes in the injected stylesheet so backend/runtime contracts stay stable.

**Tech Stack:** Chrome extension content script, vanilla JS state machine, injected CSS, existing runtime/background messaging.

---
