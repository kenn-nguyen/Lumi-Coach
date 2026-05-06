"""PDF rendering utilities using headless Chromium."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Awaitable, NoReturn, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.async_api import (
    Browser,
    Error as PlaywrightError,
    Page,
    Playwright,
    async_playwright,
)


class PDFRenderError(Exception):
    """Custom exception for PDF rendering errors with helpful messages."""

    pass


_playwright = None
_browser: Optional[Browser] = None
_init_lock = asyncio.Lock()  # Lock to prevent race condition during initialization
_subprocess_lock = asyncio.Lock()
_subprocess_supported = True

_MM_TO_PX = 96 / 25.4
_FIT_ONE_PAGE_MAX_OVERFLOW_RATIO = 1.25
_FIT_ONE_PAGE_MIN_FILL_RATIO = 0.75
_FIT_ONE_PAGE_TARGET_RATIO = 0.995
_FIT_ONE_PAGE_MIN_VERTICAL_SCALE = (
    _FIT_ONE_PAGE_TARGET_RATIO / _FIT_ONE_PAGE_MAX_OVERFLOW_RATIO
)
_FIT_ONE_PAGE_MAX_VERTICAL_SCALE = _FIT_ONE_PAGE_TARGET_RATIO / _FIT_ONE_PAGE_MIN_FILL_RATIO
_FIT_ONE_PAGE_CANDIDATE_MODES = ("gentle", "balanced", "compact")
_PAGE_SIZE_MM = {
    "A4": {"width": 210.0, "height": 297.0},
    "Letter": {"width": 215.9, "height": 279.4},
}


async def init_pdf_renderer() -> None:
    """Initialize the Playwright browser instance.

    Uses asyncio.Lock to prevent race conditions when multiple
    concurrent requests try to initialize the browser simultaneously.
    """
    global _playwright, _browser

    # Fast path: already initialized
    if _browser is not None:
        return

    # Use lock to prevent race condition during initialization
    async with _init_lock:
        # Double-check after acquiring lock
        if _browser is not None:
            return
        _playwright = await async_playwright().start()
        _browser = await _launch_browser(_playwright)


def _resolve_pdf_format(page_size: str) -> str:
    format_map = {
        "A4": "A4",
        "LETTER": "Letter",
    }
    return format_map.get(page_size, "A4")


def _resolve_pdf_margins(margins: Optional[dict]) -> dict:
    if margins:
        return {
            "top": f"{margins.get('top', 10)}mm",
            "right": f"{margins.get('right', 10)}mm",
            "bottom": f"{margins.get('bottom', 10)}mm",
            "left": f"{margins.get('left', 10)}mm",
        }
    return {"top": "10mm", "right": "10mm", "bottom": "10mm", "left": "10mm"}


def _margin_mm(value: object, default: float = 10.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().lower()
        if text.endswith("mm"):
            text = text[:-2]
        try:
            return float(text)
        except ValueError:
            return default
    return default


def _printable_dimensions_px(pdf_format: str, pdf_margins: dict) -> dict[str, int]:
    page = _PAGE_SIZE_MM.get(pdf_format, _PAGE_SIZE_MM["A4"])
    left = _margin_mm(pdf_margins.get("left"))
    right = _margin_mm(pdf_margins.get("right"))
    top = _margin_mm(pdf_margins.get("top"))
    bottom = _margin_mm(pdf_margins.get("bottom"))
    width_mm = max(1.0, page["width"] - left - right)
    height_mm = max(1.0, page["height"] - top - bottom)
    return {
        "width": max(1, round(width_mm * _MM_TO_PX)),
        "height": max(1, round(height_mm * _MM_TO_PX)),
    }


def _should_attempt_fit_one_page(ratio: float) -> bool:
    return ratio > 1 and ratio <= _FIT_ONE_PAGE_MAX_OVERFLOW_RATIO


def _should_target_one_page(ratio: float) -> bool:
    return ratio >= _FIT_ONE_PAGE_MIN_FILL_RATIO and ratio <= _FIT_ONE_PAGE_MAX_OVERFLOW_RATIO


def _clamp_fit_one_page_vertical_scale(value: float) -> float:
    return min(
        _FIT_ONE_PAGE_MAX_VERTICAL_SCALE,
        max(_FIT_ONE_PAGE_MIN_VERTICAL_SCALE, value),
    )


def _url_with_fit_mode(url: str, mode: str) -> str:
    parts = urlsplit(url)
    params = dict(parse_qsl(parts.query, keep_blank_values=True))
    params["fitMode"] = mode
    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(params),
            parts.fragment,
        )
    )


async def _measure_resume_height_ratio(
    page: Page,
    selector: str,
    printable_height_px: int,
) -> float:
    content_height = await page.evaluate(
        """(selector) => {
            const element = document.querySelector(selector);
            if (!element) return 0;
            const rect = element.getBoundingClientRect();
            return Math.max(element.scrollHeight, rect.height);
        }""",
        selector,
    )
    if not isinstance(content_height, (int, float)) or printable_height_px <= 0:
        return 0.0
    return float(content_height) / float(printable_height_px)


async def _load_print_page(page: Page, url: str, selector: str) -> None:
    await page.goto(url, wait_until="networkidle")
    await page.wait_for_selector(selector)
    await page.evaluate("document.fonts.ready")


async def _apply_resume_vertical_scale(
    page: Page,
    selector: str,
    printable_height_px: int,
    current_ratio: float,
) -> None:
    if current_ratio <= 0:
        return

    target_floor = _FIT_ONE_PAGE_TARGET_RATIO - 0.005
    if target_floor <= current_ratio <= 1:
        return

    vertical_scale = _clamp_fit_one_page_vertical_scale(
        _FIT_ONE_PAGE_TARGET_RATIO / current_ratio
    )

    for _ in range(6):
        await page.evaluate(
            """({ selector, verticalScale }) => {
                const root = document.querySelector(selector);
                const body = root?.querySelector('.resume-body') ?? document.querySelector('.resume-body');
                if (!body) return;
                const styles = window.getComputedStyle(body);
                const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
                const toPx = (raw) => {
                    const value = String(raw || '').trim();
                    const number = parseFloat(value);
                    if (!Number.isFinite(number)) return 0;
                    if (value.endsWith('rem')) return number * rootFontSize;
                    return number;
                };
                if (!body.dataset.fitBaseSectionGap) {
                    body.dataset.fitBaseSectionGap = String(toPx(styles.getPropertyValue('--section-gap')));
                    body.dataset.fitBaseItemGap = String(toPx(styles.getPropertyValue('--item-gap')));
                    body.dataset.fitBaseLineHeight = String(parseFloat(styles.getPropertyValue('--line-height')) || 1);
                }
                const baseSectionGap = Number(body.dataset.fitBaseSectionGap) || 0;
                const baseItemGap = Number(body.dataset.fitBaseItemGap) || 0;
                const baseLineHeight = Number(body.dataset.fitBaseLineHeight) || 1;
                body.style.setProperty('--section-gap', `${baseSectionGap * verticalScale}px`);
                body.style.setProperty('--item-gap', `${baseItemGap * verticalScale}px`);
                body.style.setProperty('--line-height', String(baseLineHeight * verticalScale));
            }""",
            {"selector": selector, "verticalScale": vertical_scale},
        )
        await page.evaluate("document.fonts.ready")
        next_ratio = await _measure_resume_height_ratio(
            page,
            selector,
            printable_height_px,
        )
        if next_ratio <= 0:
            return

        if target_floor <= next_ratio <= 1:
            return

        next_vertical_scale = _clamp_fit_one_page_vertical_scale(
            vertical_scale * (_FIT_ONE_PAGE_TARGET_RATIO / next_ratio)
        )
        if abs(next_vertical_scale - vertical_scale) <= 0.001:
            return

        vertical_scale = next_vertical_scale


async def _calibrate_loaded_fit_one_page_layout(
    page: Page,
    selector: str,
    printable_height_px: int,
) -> None:
    current_ratio = await _measure_resume_height_ratio(
        page,
        selector,
        printable_height_px,
    )
    if not _should_target_one_page(current_ratio):
        return

    await _apply_resume_vertical_scale(
        page,
        selector,
        printable_height_px,
        current_ratio,
    )


async def _apply_fit_one_page_layout(
    page: Page,
    url: str,
    selector: str,
    printable_height_px: int,
) -> None:
    base_url = _url_with_fit_mode(url, "off")
    base_ratio = await _measure_resume_height_ratio(
        page,
        selector,
        printable_height_px,
    )
    if not _should_target_one_page(base_ratio):
        return

    if base_ratio <= 1:
        await _apply_resume_vertical_scale(page, selector, printable_height_px, base_ratio)
        return

    if not _should_attempt_fit_one_page(base_ratio):
        return

    best_fitting_mode: Optional[str] = None
    best_fitting_ratio = 0.0
    tightest_mode: Optional[str] = None
    tightest_ratio = sys.float_info.max

    for mode in _FIT_ONE_PAGE_CANDIDATE_MODES:
        await _load_print_page(page, _url_with_fit_mode(url, mode), selector)
        mode_ratio = await _measure_resume_height_ratio(
            page,
            selector,
            printable_height_px,
        )
        if mode_ratio > 0 and mode_ratio <= 1:
            if mode_ratio > best_fitting_ratio:
                best_fitting_mode = mode
                best_fitting_ratio = mode_ratio
        if mode_ratio > 0 and mode_ratio < tightest_ratio:
            tightest_mode = mode
            tightest_ratio = mode_ratio

    selected_mode = best_fitting_mode or tightest_mode
    selected_ratio = best_fitting_ratio if best_fitting_mode is not None else tightest_ratio

    if selected_mode is not None and selected_ratio < sys.float_info.max:
        await _load_print_page(page, _url_with_fit_mode(url, selected_mode), selector)
        await _apply_resume_vertical_scale(page, selector, printable_height_px, selected_ratio)
        return

    # If every compacting profile still spills, prefer the normal two-page layout.
    await _load_print_page(page, base_url, selector)


def _find_chromium_executable() -> Optional[str]:
    """Find system Chrome/Chromium/Edge executable across platforms."""
    if sys.platform == "win32":
        candidates = [
            Path(os.environ.get("PROGRAMFILES", "C:/Program Files"))
            / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)"))
            / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES", "C:/Program Files"))
            / "Microsoft/Edge/Application/msedge.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)"))
            / "Microsoft/Edge/Application/msedge.exe",
        ]
    elif sys.platform == "darwin":
        # macOS application paths
        candidates = [
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
        ]
    else:
        # Linux paths: standard locations, Snap, and Flatpak
        candidates = [
            Path("/usr/bin/google-chrome"),
            Path("/usr/bin/google-chrome-stable"),
            Path("/usr/bin/chromium"),
            Path("/usr/bin/chromium-browser"),
            Path("/usr/bin/microsoft-edge"),
            Path("/snap/bin/chromium"),
            Path("/var/lib/flatpak/exports/bin/com.google.Chrome"),
            Path("/var/lib/flatpak/exports/bin/org.chromium.Chromium"),
            Path(os.path.expanduser("~/.local/share/flatpak/exports/bin/com.google.Chrome")),
            Path(os.path.expanduser("~/.local/share/flatpak/exports/bin/org.chromium.Chromium")),
        ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


async def _launch_browser(playwright: Playwright) -> Browser:
    try:
        return await playwright.chromium.launch()
    except PlaywrightError as e:
        if "Executable doesn't exist" not in str(e):
            raise
        fallback_executable = _find_chromium_executable()
        if not fallback_executable:
            raise PDFRenderError(
                "Playwright browser executable is missing, and no system Chrome/Edge "
                "installation was found. Install Playwright browsers or install Chrome/Edge."
            ) from e
        return await playwright.chromium.launch(executable_path=fallback_executable)


async def _render_page_to_pdf(
    page: Page,
    url: str,
    selector: str,
    pdf_format: str,
    pdf_margins: dict,
    fit_one_page: bool,
    calibrate_fit_one_page: bool,
) -> bytes:
    printable_dimensions = _printable_dimensions_px(pdf_format, pdf_margins)
    await page.set_viewport_size(
        {
            "width": printable_dimensions["width"],
            "height": printable_dimensions["height"],
        }
    )
    await page.emulate_media(media="print")
    render_url = (
        _url_with_fit_mode(url, "off")
        if fit_one_page and selector == ".resume-print"
        else url
    )
    await _load_print_page(page, render_url, selector)

    if fit_one_page and selector == ".resume-print":
        await _apply_fit_one_page_layout(
            page,
            render_url,
            selector,
            printable_dimensions["height"],
        )
    elif calibrate_fit_one_page and selector == ".resume-print":
        await _calibrate_loaded_fit_one_page_layout(
            page,
            selector,
            printable_dimensions["height"],
        )

    return await page.pdf(
        format=pdf_format,
        print_background=True,
        margin=pdf_margins,
    )


async def _render_with_browser(
    browser: Browser,
    url: str,
    selector: str,
    pdf_format: str,
    pdf_margins: dict,
    fit_one_page: bool,
    calibrate_fit_one_page: bool,
) -> bytes:
    page: Page = await browser.new_page()
    try:
        return await _render_page_to_pdf(
            page,
            url,
            selector,
            pdf_format,
            pdf_margins,
            fit_one_page,
            calibrate_fit_one_page,
        )
    finally:
        await page.close()


def _run_in_new_loop(coro: Awaitable[bytes]) -> bytes:
    if sys.platform == "win32":
        from asyncio.windows_events import ProactorEventLoop

        loop = ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()

    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        finally:
            loop.close()
            asyncio.set_event_loop(None)


def _render_resume_pdf_sync(
    url: str,
    selector: str,
    pdf_format: str,
    pdf_margins: dict,
    fit_one_page: bool,
    calibrate_fit_one_page: bool,
) -> bytes:
    async def _run() -> bytes:
        async with async_playwright() as playwright:
            browser = await _launch_browser(playwright)
            try:
                return await _render_with_browser(
                    browser,
                    url,
                    selector,
                    pdf_format,
                    pdf_margins,
                    fit_one_page,
                    calibrate_fit_one_page,
                )
            finally:
                await browser.close()

    return _run_in_new_loop(_run())


async def _render_resume_pdf_in_thread(
    url: str,
    selector: str,
    pdf_format: str,
    pdf_margins: dict,
    fit_one_page: bool,
    calibrate_fit_one_page: bool,
) -> bytes:
    return await asyncio.to_thread(
        _render_resume_pdf_sync,
        url,
        selector,
        pdf_format,
        pdf_margins,
        fit_one_page,
        calibrate_fit_one_page,
    )


def _raise_playwright_error(error: PlaywrightError, url: str) -> NoReturn:
    error_msg = str(error)
    if "Executable doesn't exist" in error_msg:
        exe = sys.executable.replace("\\", "/")
        command = f"{exe} -m playwright install chromium"
        raise PDFRenderError(
            "Playwright browser executable is missing or out of date. "
            "Command shown for reference; quote the path if it contains spaces: "
            f"{command}"
        ) from error
    if "net::ERR_CONNECTION_REFUSED" in error_msg:
        raise PDFRenderError(
            f"Cannot connect to frontend for PDF generation. "
            f"Attempted URL: {url}. "
            f"Please ensure: 1) The frontend is running, "
            f"2) The FRONTEND_BASE_URL environment variable in the backend .env file "
            f"matches the URL where your frontend is accessible."
        ) from error
    raise PDFRenderError(f"PDF rendering failed: {error_msg}") from error


def _loop_supports_subprocess() -> bool:
    if sys.platform != "win32":
        return True
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return True
    return loop.__class__.__name__ == "ProactorEventLoop"


async def close_pdf_renderer() -> None:
    """Close the Playwright browser instance."""
    global _playwright, _browser
    if _browser is not None:
        await _browser.close()
        _browser = None
    if _playwright is not None:
        await _playwright.stop()
        _playwright = None


async def render_resume_pdf(
    url: str,
    page_size: str = "A4",
    selector: str = ".resume-print",
    margins: Optional[dict] = None,
    fit_one_page: bool = False,
    calibrate_fit_one_page: bool = False,
) -> bytes:
    """Render a URL to PDF bytes.

    Args:
        url: The URL to render (print route)
        page_size: Page size format - "A4" or "LETTER"
        selector: CSS selector to wait for before rendering (default: ".resume-print")
        margins: Page margins dict with top/right/bottom/left in mm (applied to every page)

    Note:
        Margins are applied via Playwright's PDF margins, ensuring they appear
        on every page (not just the first page like HTML padding would).
        When fit_one_page is enabled, the renderer chooses and calibrates the
        print layout. When calibrate_fit_one_page is enabled, the renderer keeps
        the loaded URL layout and only performs the final print-side
        spacing/line-height calibration.
    """
    global _subprocess_supported

    pdf_format = _resolve_pdf_format(page_size)
    pdf_margins = _resolve_pdf_margins(margins)

    if _browser is not None:
        try:
            return await _render_with_browser(
                _browser,
                url,
                selector,
                pdf_format,
                pdf_margins,
                fit_one_page,
                calibrate_fit_one_page,
            )
        except PlaywrightError as e:
            _raise_playwright_error(e, url)

    async with _subprocess_lock:
        subprocess_supported = _subprocess_supported
        if subprocess_supported and not _loop_supports_subprocess():
            _subprocess_supported = False
            subprocess_supported = False

    if subprocess_supported:
        try:
            await init_pdf_renderer()
        except NotImplementedError:
            async with _subprocess_lock:
                _subprocess_supported = False
            subprocess_supported = False
        except PlaywrightError as e:
            _raise_playwright_error(e, url)

    if not subprocess_supported:
        try:
            return await _render_resume_pdf_in_thread(
                url,
                selector,
                pdf_format,
                pdf_margins,
                fit_one_page,
                calibrate_fit_one_page,
            )
        except PlaywrightError as e:
            _raise_playwright_error(e, url)

    if _browser is None:
        raise PDFRenderError("PDF renderer failed to initialize.")

    try:
        return await _render_with_browser(
            _browser,
            url,
            selector,
            pdf_format,
            pdf_margins,
            fit_one_page,
            calibrate_fit_one_page,
        )
    except PlaywrightError as e:
        _raise_playwright_error(e, url)
