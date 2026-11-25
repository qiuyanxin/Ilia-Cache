"""Compare two running Ilia component catalogs in Chrome using fresh browser contexts."""

import argparse
import base64
import re
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
from xml.etree import ElementTree

from playwright.sync_api import expect, sync_playwright


SELECTORS = [
    ".sidebar", ".workspace", ".topbar", ".component-categories",
    "#component-search", ".component-grid",
]
COMPONENT_ID = "motion-prompt-001"
SEED_ROUTE = "**/ilia-ui/seed.json*"
UI_RELEASE_PATH = r"/ilia-ui/releases/[a-f0-9]{64}"
RUNTIME_ROUTE = re.compile(UI_RELEASE_PATH + r"/runtime\.mjs$")
PUBLIC_CHROME_ROUTE = re.compile(UI_RELEASE_PATH + r"/public-chrome\.mjs$")
SOUND_ID = "reactbits-sound-pebble"
SOUND_URL = "https://reactbits.dev/tools/sound-lab#sound=pebble"
VIDEO_ID = "reactbits-aurora"
DEEP_DETAIL_ID = "motion-prompt-240"
VIDEO_URL = "https://reactbits.dev/assets/video/aurora.webm"
VIDEO_POSTER_URL = "https://reactbits.dev/assets/video/aurora.webp"
OFFICIAL_FRAME_ID = 'designbookmark-exposure-slider'
OFFICIAL_FRAME_URL = 'https://smoothui.dev/preview/exposure-slider?embed=1'
# Synthetic test pattern generated with FFmpeg testsrc2, 16x16 at 12 fps for one second.
VIDEO_FIXTURE = Path(__file__).with_name("preview-fixtures") / "hover.webm"
POSTER_FIXTURE = Path(__file__).parents[1] / "public/motion-prompt-preview/posters/001.webp"
DRAFT_ID = "motion-prompt-059"


def restrict_requests(context, origin):
    expected = urlsplit(origin)
    context.route(
        "**/*",
        lambda route: route.continue_()
        if urlsplit(route.request.url).netloc == expected.netloc
        else route.abort(),
    )


def browser_page(browser, origin, width, height, reduced_motion="reduce"):
    page = browser.new_page(
        viewport={"width": width, "height": height},
        is_mobile=width < 500,
        has_touch=width < 500,
        reduced_motion=reduced_motion,
    )
    restrict_requests(page.context, origin)
    return page


def serve_test_preview(page, *, video=True):
    page.route(VIDEO_POSTER_URL, lambda route: route.fulfill(path=POSTER_FIXTURE, content_type="image/webp"))
    if video:
        page.route(VIDEO_URL, lambda route: route.fulfill(path=VIDEO_FIXTURE, content_type="video/webm"))


def read_catalog(page):
    expect(page.locator("#component-library .component-grid .component-tile").first).to_be_visible()
    page.evaluate("document.fonts.ready")
    return page.evaluate(
        """selectors => {
          const grid = document.querySelector('.component-grid').getBoundingClientRect();
          const boxes = selectors.map(selector => {
            const { x, y, width } = document.querySelector(selector).getBoundingClientRect();
            return [x, y, width].map(Math.round);
          });
          const cards = [...document.querySelectorAll('.component-tile')].map(card => {
            const thumb = card.querySelector('.component-thumb');
            const { x, y, width, height } = card.getBoundingClientRect();
            return [thumb.dataset.openComponent,
              [x - grid.x, y - grid.y, width, height, thumb.getBoundingClientRect().height].map(Math.round)];
          });
          return { boxes, cards, scrollWidth: document.documentElement.scrollWidth };
        }""",
        SELECTORS,
    )


def check_summary_layout(page):
    card = page.locator(f'.component-tile:has(.component-thumb[data-open-component="{COMPONENT_ID}"])')
    summary = card.locator("p").first
    height = card.evaluate("card => card.getBoundingClientRect().height")
    summary.evaluate('(node, text) => {node.textContent = text;}', '组件说明与个人备注 ' * 60)
    assert abs(card.evaluate("card => card.getBoundingClientRect().height") - height) <= 1
    return height


def check_catalog_media_fit(page, host):
    thumb = page.locator('.component-thumb[data-open-component="builtin-swipe-deck"]')
    assert thumb.evaluate("""thumb => {
      const { width, height } = thumb.getBoundingClientRect();
      return Math.abs(height - width * 9 / 16) < 1;
    }""")
    if host == "oss":
        page.wait_for_function("""() => {
          const thumb = document.querySelector('.component-thumb[data-open-component="builtin-swipe-deck"]');
          const frame = thumb.querySelector('iframe');
          if (!frame?.style.transform) return false;
          const outer = thumb.getBoundingClientRect(), inner = frame.getBoundingClientRect();
          return inner.left >= outer.left - 1 && inner.right <= outer.right + 1 &&
            inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
        }""")
    else:
        expect(thumb.locator(".component-source-preview")).to_be_attached()
    sound = page.locator('.component-thumb[data-open-component="reactbits-sound-pebble"]')
    assert sound.evaluate("""thumb => {
      const slot = thumb.getBoundingClientRect();
      const contents = [...thumb.querySelectorAll('.sound-preview > *')];
      return contents.length === 2 && contents.every(node => {
        const box = node.getBoundingClientRect();
        return box.height > 0 && box.top >= slot.top - 1 && box.bottom <= slot.bottom + 1;
      });
    }""")


def check_directory_updates(page, read_only):
    tiles = page.locator(".component-grid .component-tile")
    search = page.locator("#component-search")
    search.fill("aurora")
    expect(tiles).to_have_count(4)
    page.evaluate("window.iliaSearchNodes = [...document.querySelectorAll('.component-lane, .component-tile')]")
    search.fill("Ａｕｒｏｒａ")
    expect(tiles).to_have_count(4)
    assert page.evaluate("""() => [...document.querySelectorAll('.component-lane, .component-tile')]
        .every((node, index) => node === window.iliaSearchNodes[index])""")
    search.fill("")
    expect(tiles).to_have_count(850)

    viewport = page.viewport_size
    page.evaluate("window.iliaResizeNodes = [...document.querySelectorAll('.component-grid .component-tile')]")
    for width, lanes in [(900, 2), (390, 1), (viewport["width"], 3)]:
        page.set_viewport_size({"width": width, "height": viewport["height"]})
        expect(page.locator(".component-grid .component-lane")).to_have_count(lanes)
        expect(tiles).to_have_count(850)
        assert tiles.evaluate_all("nodes => nodes.every((node, index) => node === window.iliaResizeNodes[index])")

    if not read_only:
        cart = page.locator(".component-grid [data-cart-add]")
        marker = cart.first.locator("svg")
        expect(marker).to_have_count(1)
        cart.evaluate_all("buttons => { window.iliaCartIcons = buttons.map(b => b.firstElementChild); }")
        tiles.first.hover()
        cart.first.click()
        expect(cart.first).to_have_attribute("aria-pressed", "true")
        assert cart.evaluate_all("buttons => buttons.reduce((n, b, i) => n + (b.firstElementChild !== window.iliaCartIcons[i]), 0)") == 1
        cart.first.click()
        expect(cart.first).to_have_attribute("aria-pressed", "false")


def exercise_catalog(page, detail_url, read_only):
    unfiltered_gallery_url = page.url
    check_directory_updates(page, read_only)
    sidebar = page.locator(".sidebar")
    toggle = page.locator("#sidebar-collapse")
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(sidebar).to_have_class(re.compile(r"\bis-compact\b"))
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")

    page.keyboard.press("Control+k")
    search = page.locator("#component-search")
    expect(search).to_be_focused()
    page.locator('[data-source-filter="Motion Prompt"]').click()
    expect(page.locator(".component-grid .component-tile")).to_have_count(240)
    assert page.locator(".component-grid .component-thumb").evaluate_all(
        "cards => cards.every(card => /^motion-prompt-/.test(card.dataset.openComponent))"
    )
    page.locator('[data-source-filter="全部来源"]').click()
    search.fill("SquishSwitch")
    expect(search).to_be_focused()
    expect(page.locator(".component-grid .component-tile")).to_have_count(1)
    for query, count in [("image carousel", 21), ("图片轮播", 21), ("略微超出目标尺寸后回弹", 1), ("motion-prompt-059", 1)]:
        search.fill(query)
        expect(page.locator(".component-grid .component-tile")).to_have_count(count)
    expect(page.locator('.component-thumb[data-open-component="motion-prompt-059"]')).to_be_visible()

    search.fill("弹性入场")
    if read_only:
        page.wait_for_function("new URLSearchParams(location.search).get('q') === '弹性入场'")
    gallery_url = page.url
    filtered_detail_url = detail_url + ('?' + urlsplit(gallery_url).query if read_only else '')
    card = page.locator(f'.component-thumb[data-open-component="{COMPONENT_ID}"]')
    card.click()
    expect(page).to_have_url(filtered_detail_url)
    modal = page.locator("#component-dialog")
    expect(modal).to_be_visible()
    expect(modal.locator("iframe")).to_have_count(1)
    page.go_back()
    expect(page).to_have_url(gallery_url)
    expect(modal).not_to_be_visible()
    expect(modal.locator("iframe,video")).to_have_count(0)
    expect(search).to_have_value("弹性入场")
    expect(card).to_be_focused()
    page.go_forward()
    expect(page).to_have_url(filtered_detail_url)
    expect(modal).to_be_visible()
    modal.get_by_role("button", name="关闭组件详情").click()
    expect(page).to_have_url(gallery_url)
    expect(modal).not_to_be_visible()

    page.goto(filtered_detail_url, wait_until="domcontentloaded")
    page.reload(wait_until="domcontentloaded")
    dialog = page.locator("#component-dialog[open]")
    expect(dialog).to_be_visible()
    expect(dialog.locator('a[href$="#001"]')).to_be_visible()
    expect(dialog.locator("#component-edit")).to_have_count(0 if read_only else 1)
    iframe = dialog.locator('iframe[src*="/motion-prompt-preview/index.html"]')
    expect(iframe).to_have_attribute("sandbox", "allow-scripts")
    player = iframe.content_frame
    play = player.get_by_role("button", name="播放")
    expect(play).to_be_enabled()
    canvas = player.locator("canvas")
    frame = canvas.evaluate("canvas => canvas.toDataURL()")
    play.press("Space")
    expect(player.get_by_role("button", name="暂停")).to_be_visible()
    for _ in range(10):
        page.wait_for_timeout(100)
        if canvas.evaluate("canvas => canvas.toDataURL()") != frame:
            break
    else:
        raise AssertionError("The advertised preview did not animate")
    dialog.get_by_role("button", name="关闭组件详情").focus()
    page.keyboard.press("Escape")
    expect(page).to_have_url(gallery_url)
    expect(modal).not_to_be_visible()
    expect(modal.locator("iframe,video")).to_have_count(0)
    page.goto(detail_url.removesuffix(COMPONENT_ID) + SOUND_ID, wait_until="domcontentloaded")
    expect(dialog.locator(f'a[href="{SOUND_URL}"]').first).to_be_visible()
    sound = dialog.get_by_role("button", name="试听音效")
    if read_only:
        expect(sound).to_have_count(0)
    else:
        page.evaluate("""() => {
          const start = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function (...args) {
            if (this.buffer?.duration && this.context.state === 'running') window.iliaTestAudioStarted = true;
            return start.apply(this, args);
          };
        }""")
        sound.click()
        page.wait_for_function("window.iliaTestAudioStarted === true")

    serve_test_preview(page)
    page.goto(detail_url.removesuffix(COMPONENT_ID) + VIDEO_ID, wait_until="domcontentloaded")
    video = dialog.locator("video")
    expect(video).to_be_visible()
    assert video.evaluate("video => video.controls && !video.autoplay")
    video.evaluate("""video => {
      const pause = video.pause.bind(video);
      video.pause = () => { window.iliaTestVideoPaused = true; pause(); };
    }""")
    dialog.get_by_role("button", name="关闭组件详情").click()
    expect(page).to_have_url(unfiltered_gallery_url)
    expect(modal.locator("video")).to_have_count(0)
    assert page.evaluate("window.iliaTestVideoPaused === true")


def check_preview_playback(browser, origin, gallery_path):
    page = browser_page(browser, origin, 1440, 900, reduced_motion="no-preference")
    try:
        serve_test_preview(page)
        page.goto(origin + gallery_path, wait_until="domcontentloaded")
        search = page.locator("#component-search")
        search.fill(VIDEO_ID)
        card = page.locator(f'.component-thumb[data-open-component="{VIDEO_ID}"]')
        video = card.locator("video")
        poster = card.locator('img')
        expect(poster).to_have_attribute('src', VIDEO_POSTER_URL)
        poster.evaluate('img => { window.iliaCardPoster = img; }')
        expect(video).to_have_count(0)
        card.dispatch_event("pointerenter", {"pointerType": "touch"})
        expect(video).to_have_count(0)
        card.hover()
        expect(video).to_be_attached()
        assert video.evaluate("video => video.muted && !video.controls && video.preload === 'none'")
        video.evaluate('video => { window.iliaCardVideo = video; }')
        page.wait_for_function("!window.iliaCardVideo.paused && window.iliaCardVideo.currentTime > 0.08")
        expect(card.locator('[data-preview-playing]')).to_be_attached()
        assert page.locator('.component-grid video').count() == 1
        search.hover()
        expect(video).to_have_count(0)
        assert page.evaluate("window.iliaCardVideo.paused && !window.iliaCardVideo.hasAttribute('src')")
        card.hover()
        expect(card.locator('[data-preview-playing]')).to_be_attached()
        video.evaluate('video => { window.iliaCardVideo = video; }')
        page.emulate_media(reduced_motion="reduce")
        expect(video).to_have_count(0)
        assert page.evaluate("window.iliaCardVideo.paused && !window.iliaCardVideo.hasAttribute('src')")
        search.hover()
        card.hover()
        expect(video).to_have_count(0)
        assert poster.evaluate('img => img === window.iliaCardPoster')

        page.emulate_media(reduced_motion="no-preference")
        search.hover()
        card.hover()
        expect(card.locator('[data-preview-playing]')).to_be_attached()
        video.evaluate('video => { window.iliaCardVideo = video; }')
        card.press("Enter")
        dialog = page.locator("#component-dialog")
        expect(dialog).to_be_visible()
        assert page.evaluate("window.iliaCardVideo.paused")
        expect(video).to_have_count(0)
        detail = dialog.locator("video")
        assert detail.evaluate("video => video.controls && video.muted && video.loop")
        page.wait_for_function("document.querySelector('#component-dialog video').currentTime > 0.08")
        page.emulate_media(reduced_motion="reduce")
        page.wait_for_function("document.querySelector('#component-dialog video').paused")
        dialog.get_by_role("tab", name="参考素材").click()
        assert dialog.locator("video").evaluate("video => video.controls && video.paused && !video.autoplay")
    finally:
        page.close()


def check_preview_lifecycle(browser, origin, gallery_path, detail_path):
    page = browser_page(browser, origin, 1440, 900, reduced_motion='no-preference')
    try:
        serve_test_preview(page)
        page.goto(origin + gallery_path, wait_until='domcontentloaded')
        card = page.locator(f'.component-thumb[data-open-component="{VIDEO_ID}"]')
        card.hover()
        expect(card.locator('[data-preview-playing]')).to_be_attached()
        card.locator('video').evaluate("""video => {
          window.hoveringMedia = video;
          const card = video.closest('.component-thumb');
          // Some scrolls do not deliver a pointerleave to the card.
          document.addEventListener('pointerleave', event => {
            if (event.target === card) event.stopPropagation();
          }, true);
        }""")
        page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
        page.wait_for_function("""id => {
          const card = document.querySelector(`[data-open-component="${id}"].component-thumb`);
          return card.getBoundingClientRect().top >= innerHeight;
        }""", arg=VIDEO_ID)
        expect(card.locator('video')).to_have_count(0)
        assert page.evaluate("window.hoveringMedia.paused && !window.hoveringMedia.hasAttribute('src')")

        page.goto(origin + detail_path + VIDEO_ID, wait_until='domcontentloaded')
        dialog = page.locator('#component-dialog')
        video = dialog.locator('video')
        page.wait_for_function("""() => {
          const video = document.querySelector('#component-dialog video');
          return video && !video.paused && video.currentTime > 0.06;
        }""")
        # Headless Chromium exposes each page as visible, so drive its visibility event explicitly.
        page.evaluate("""() => {
          window.previewVisibility = hidden => {
            Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
            document.dispatchEvent(new Event('visibilitychange'));
          };
          window.previewVisibility(true);
        }""")
        assert video.evaluate('video => video.paused && !video.autoplay')
        video.evaluate('video => video.play().catch(() => {})')
        page.wait_for_function("document.querySelector('#component-dialog video').paused")
        page.evaluate('window.previewVisibility(false)')
        assert video.evaluate('video => video.paused && !video.autoplay')
        video.evaluate('video => video.play()')
        assert video.evaluate('video => !video.paused')

        dialog.get_by_role('tab', name='参考素材').click()
        video.evaluate('video => { video.muted = true; return video.play(); }')
        video.evaluate("""video => {
          addEventListener('pagehide', () => {
            sessionStorage.setItem('ilia-test-media-paused', String(video.paused));
          }, { once: true });
        }""")
        page.goto(origin + '/?preview-lifecycle-test=1', wait_until='commit')
        assert page.evaluate("sessionStorage.getItem('ilia-test-media-paused')") == 'true'
    finally:
        page.close()


def check_detail_video_tab_state(browser, origin, gallery_path):
    page = browser_page(browser, origin, 1440, 900, reduced_motion='no-preference')
    clip = VIDEO_FIXTURE.read_bytes()

    def serve_video(route):
        headers = {'accept-ranges': 'bytes', 'cache-control': 'no-store'}
        requested = re.fullmatch(r'bytes=(\d+)-(\d*)', route.request.headers.get('range', ''))
        if not requested:
            route.fulfill(body=clip, content_type='video/webm', headers=headers)
            return
        first, last = requested.groups()
        start = int(first)
        end = min(int(last) if last else len(clip) - 1, len(clip) - 1)
        headers['content-range'] = f'bytes {start}-{end}/{len(clip)}'
        route.fulfill(status=206, body=clip[start:end + 1], content_type='video/webm', headers=headers)

    try:
        serve_test_preview(page, video=False)
        page.route(VIDEO_URL, serve_video)
        page.goto(origin + gallery_path, wait_until='domcontentloaded')
        search = page.locator('#component-search')
        dialog = page.locator('#component-dialog')
        close = dialog.get_by_role('button', name='关闭组件详情', exact=True)

        def open_from_gallery(record):
            search.fill(record)
            card = page.locator(f'.component-title-control[data-open-component="{record}"]')
            expect(card).to_be_visible()
            previous = page.url
            card.press('Enter')
            expect(dialog).to_be_visible()
            return previous

        def return_to_gallery(url):
            close.click()
            expect(dialog).to_be_hidden()
            expect(page).to_have_url(url)

        gallery = open_from_gallery(VIDEO_ID)
        video = dialog.locator('video')
        preview = dialog.get_by_role('tab', name='预览', exact=True)
        references = dialog.get_by_role('tab', name='参考素材', exact=True)
        prompt = dialog.get_by_role('tab', name='提示词', exact=True)
        video.evaluate('''async video => {
          video.pause();
          await video.play();
          video.currentTime = 0.45;
          video.pause();
          video.muted = false;
        }''')
        page.wait_for_function("""() => {
          const video = document.querySelector('#component-dialog video');
          return video?.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - 0.45) < 0.05;
        }""")
        saved = video.evaluate('video => video.currentTime')

        def expect_preserved_video(tab):
            expect(dialog.get_by_role('tabpanel', name=tab, exact=True).locator('video')).to_be_visible()
            page.wait_for_function("""position => {
              const video = document.querySelector('#component-dialog video');
              return video?.readyState >= 1 && !video.seeking && video.paused && !video.muted &&
                Math.abs(video.currentTime - position) < 0.05;
            }""", arg=saved)

        references.press('Enter')
        expect_preserved_video('参考素材')
        prompt.press('Enter')
        expect(dialog.get_by_role('tabpanel', name='提示词', exact=True)).to_be_visible()
        expect(video).to_have_count(0)
        preview.press('Enter')
        expect_preserved_video('预览')

        pending = []

        def delay_video(route):
            pending.append(route)

        page.route(VIDEO_URL, delay_video)
        with page.expect_request(VIDEO_URL):
            references.press('Enter')
        expect(dialog.get_by_role('tabpanel', name='参考素材', exact=True)).to_be_visible()
        assert video.evaluate('video => video.readyState === HTMLMediaElement.HAVE_NOTHING')
        prompt.press('Enter')
        expect(video).to_have_count(0)
        page.unroute(VIDEO_URL, delay_video)
        for route in pending:
            route.abort()
        preview.press('Enter')
        expect_preserved_video('预览')

        return_to_gallery(gallery)
        other_gallery = open_from_gallery(COMPONENT_ID)
        expect(dialog.locator('[data-motion-player]')).to_be_attached()
        return_to_gallery(other_gallery)
        dialog.evaluate("""dialog => dialog.addEventListener('playing', event => {
          window.iliaFreshVideoTime = event.target.currentTime;
        }, { capture: true, once: true })""")
        open_from_gallery(VIDEO_ID)
        page.wait_for_function("""position => {
          const video = document.querySelector('#component-dialog video');
          return video?.autoplay && video.muted && !video.paused && window.iliaFreshVideoTime < position / 2;
        }""", arg=saved)
    finally:
        page.close()


def check_preview_recovery(browser, origin, gallery_path):
    page = browser_page(browser, origin, 1440, 900, reduced_motion="no-preference")
    try:
        serve_test_preview(page, video=False)
        page.goto(origin + gallery_path, wait_until="domcontentloaded")
        search = page.locator("#component-search")
        search.fill(VIDEO_ID)
        card = page.locator(f'.component-thumb[data-open-component="{VIDEO_ID}"]')
        original_size = card.bounding_box()
        with page.expect_event('requestfailed', lambda request: request.url == VIDEO_URL):
            card.hover()
        expect(card.locator('video')).to_have_count(0)
        expect(card.locator("img")).to_be_visible()
        assert card.locator("img").evaluate("img => img.decode().then(() => img.naturalWidth > 0)")
        recovered_size = card.bounding_box()
        assert (original_size["width"], original_size["height"]) == (recovered_size["width"], recovered_size["height"])
        card.click()
        dialog = page.locator("#component-dialog")
        expect(dialog.locator("img.component-preview-poster")).to_be_visible()
        expect(dialog.get_by_role("link", name=re.compile(r"^打开组件来源"))).to_have_attribute("href", "https://reactbits.dev/backgrounds/aurora")
        dialog.get_by_role("button", name="关闭组件详情").click()
        expect(dialog.locator(".component-preview-poster")).to_have_count(0)
        expect(page).to_have_url(origin + gallery_path + (f"?q={VIDEO_ID}" if gallery_path == "/components" else ""))

        search.fill("reactbits-shape-grid")
        card = page.locator('.component-thumb[data-open-component="reactbits-shape-grid"]')
        card.scroll_into_view_if_needed()
        expect(card.get_by_text("预览暂时无法加载")).to_be_visible()
        card.click()
        expect(dialog.get_by_text("预览暂时无法加载")).to_be_visible()
        expect(dialog.get_by_role("link", name=re.compile(r"^打开组件来源"))).to_have_attribute("href", "https://reactbits.dev/backgrounds/shape-grid")
    finally:
        page.close()


def check_directory_video_loading(browser, origin, gallery_path, width):
    page = browser_page(browser, origin, width, 900)
    try:
        covers = set()
        clips = []

        def poster_response(route):
            covers.add(route.request.url)
            route.fulfill(path=POSTER_FIXTURE, content_type='image/webp')

        page.route(re.compile(r'^https://reactbits\.dev/assets/video/[^/]+\.(?:webp|png|jpg)$'), poster_response)
        page.on('request', lambda request: clips.append(request.url) if request.resource_type == 'media' else None)
        page.goto(origin + gallery_path, wait_until='domcontentloaded')
        grid = page.locator('#component-library .component-grid')
        cards = grid.locator('[data-card-video]')
        expect(cards.nth(199)).to_be_attached()
        page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        initial = len(covers)
        assert initial < 40, (width, initial)
        expect(grid.locator('video')).to_have_count(0)
        assert clips == []

        distant = cards.last.locator('img')
        expect(distant).to_have_attribute('loading', 'lazy')
        distant_url = distant.get_attribute('src')
        assert distant_url not in covers
        with page.expect_request(distant_url):
            distant.scroll_into_view_if_needed()
        assert distant.evaluate('img => img.decode().then(() => img.naturalWidth > 0)')
        expect(grid.locator('video')).to_have_count(0)
        assert clips == []
        return initial
    finally:
        page.close()


def check_touch_motion_preview(browser, origin, detail_path, width):
    page = browser_page(browser, origin, width, 844)
    try:
        for scene_id in (COMPONENT_ID, "motion-prompt-049"):
            page.goto(origin + detail_path + scene_id, wait_until="domcontentloaded")
            frame = page.frame_locator('#component-dialog iframe[src*="motion-prompt-preview/index.html"]')
            play = frame.get_by_role("button", name="播放")
            expect(play).to_be_enabled()
            assert play.evaluate("""button => {
              const footer = button.closest('footer');
              return footer.getBoundingClientRect().bottom <= innerHeight &&
                document.documentElement.scrollHeight === innerHeight;
            }"""), (width, scene_id)
            play.tap()
            expect(frame.get_by_role("button", name="暂停")).to_be_visible()
    finally:
        page.close()


def expect_motion_preview_unavailable(stage, poster, frame, source):
    expect(stage).to_have_attribute('data-motion-state', 'unavailable', timeout=8000)
    expect(stage.get_by_role('status')).to_contain_text('打开组件来源')
    expect(poster).to_be_visible()
    expect(frame).to_be_hidden()
    expect(source).to_have_attribute('href', 'https://showheyohtaki.github.io/motion-prompt/#001')
    expect(source).to_be_visible()


def check_motion_preview_loading(browser, origin, detail_path, width, fail=False, delay=False):
    page = browser_page(browser, origin, width, 900)
    try:
        if delay:
            page.clock.install()
        held = []
        pack = '**/motion-prompt-preview/packs/motion/pack.js'
        page.route(pack, lambda route: held.append(route))
        with page.expect_request(pack):
            page.goto(origin + detail_path + COMPONENT_ID, wait_until='commit')
        stage = page.locator('#component-dialog .component-motion-preview')
        poster = stage.locator('.component-static-motion img')
        frame = stage.locator('iframe')
        source = page.locator('#component-dialog [data-component-origin]')
        expect(stage).to_have_attribute('data-motion-state', 'loading')
        expect(poster).to_be_visible()
        assert poster.evaluate('img => img.decode().then(() => img.naturalWidth > 0)')
        expect(frame).to_be_hidden()
        before = stage.bounding_box()
        if delay:
            page.clock.fast_forward(5000)
            expect_motion_preview_unavailable(stage, poster, frame, source)
            assert stage.bounding_box() == before, (width, before, stage.bounding_box())
        if fail:
            held.pop().abort()
            expect_motion_preview_unavailable(stage, poster, frame, source)
        else:
            held.pop().continue_()
            expect(stage).to_have_attribute('data-motion-state', 'ready')
            expect(frame).to_be_visible()
            expect(poster).to_be_hidden()
            canvas = frame.content_frame.locator('canvas')
            expect(canvas).to_be_visible()
            assert canvas.evaluate('canvas => canvas.width === 539 && canvas.height === 208')
            expect(frame.content_frame.get_by_role('button', name='播放')).to_be_enabled()
        assert stage.bounding_box() == before, (width, fail, delay, before, stage.bounding_box())
    finally:
        page.close()


def check_motion_preview_document_failure(browser, origin, detail_path, width=390):
    page = browser_page(browser, origin, width, 900)
    try:
        player_url = re.compile(r'/motion-prompt-preview/index\.html(?:\?|$)')
        held = []
        page.route(player_url, lambda route: held.append(route))
        with page.expect_request(player_url):
            page.goto(origin + detail_path + COMPONENT_ID, wait_until='commit')
        detail = page.locator('#component-dialog')
        stage = detail.locator('.component-motion-preview')
        poster = stage.locator('.component-static-motion img')
        frame = stage.locator('[data-motion-player]')
        source = detail.locator('[data-component-origin]')
        expect(stage).to_have_attribute('data-motion-state', 'loading')
        expect(poster).to_be_visible()
        assert poster.evaluate('img => img.decode().then(() => img.naturalWidth > 0)')
        expect(frame).to_be_hidden()
        before = stage.bounding_box()
        source_before = source.bounding_box()
        with page.expect_response(lambda response: player_url.search(response.url) and response.status == 503):
            held.pop().fulfill(status=503, content_type='text/html', body='<h1>Preview unavailable</h1>')
        expect_motion_preview_unavailable(stage, poster, frame, source)
        assert stage.bounding_box() == before, (width, before, stage.bounding_box())
        assert source.bounding_box() == source_before, (width, source_before, source.bounding_box())
    finally:
        page.close()


def check_motion_preview_keyboard_and_pause(browser, origin, gallery_path):
    page = browser_page(browser, origin, 1440, 900, reduced_motion='no-preference')
    try:
        page.goto(origin + gallery_path, wait_until='domcontentloaded')
        page.locator('#component-search').fill(COMPONENT_ID)
        opener = page.locator(f'.component-title-control[data-open-component="{COMPONENT_ID}"]')
        expect(opener).to_be_visible()
        gallery_url = page.url
        opener.press('Enter')
        detail = page.locator('#component-dialog')
        frame = detail.locator('[data-motion-player]')
        player = frame.content_frame
        pause = player.get_by_role('button', name='暂停', exact=True)
        play = player.get_by_role('button', name='播放', exact=True)
        expect(pause).to_be_enabled()
        pause.press('Enter')
        expect(play).to_be_enabled()

        references = detail.get_by_role('tab', name='参考素材', exact=True)
        preview = detail.get_by_role('tab', name='预览', exact=True)
        references.press('Enter')
        expect(detail.get_by_role('tabpanel', name='参考素材')).to_be_visible()
        expect(frame).to_have_count(0)
        preview.press('Enter')
        expect(detail.get_by_role('tabpanel', name='预览')).to_be_visible()
        expect(play).to_be_enabled()
        paused_at = parse_qs(urlsplit(frame.get_attribute('src')).query).get('pausedAt', [])
        assert len(paused_at) == 1 and 0 <= float(paused_at[0]) < float('inf'), paused_at

        play.focus()
        expect(play).to_be_focused()
        page.keyboard.press('Escape')
        expect(detail).to_be_hidden()
        expect(frame).to_have_count(0)
        expect(page).to_have_url(gallery_url)
        expect(opener).to_be_focused()

        opener.press('Enter')
        expect(pause).to_be_enabled()
        assert 'pausedAt' not in parse_qs(urlsplit(frame.get_attribute('src')).query)
    finally:
        page.close()


def check_official_frame_preview(browser, origin, detail_path, width, readonly, denied=False):
    page = browser_page(browser, origin, width, 900)
    requested = []

    def serve_preview(route):
        requested.append(route.request.url)
        route.fulfill(status=200, content_type='text/html; charset=utf-8', headers={'x-frame-options': 'DENY'} if denied else {},
                      body='<button onclick="this.textContent=\'更新成功\'">预览示例</button>')

    try:
        page.context.route(OFFICIAL_FRAME_URL, serve_preview)
        detail_url = origin + detail_path + OFFICIAL_FRAME_ID
        stage = page.locator('#component-dialog .component-official-frame')
        launch = stage.get_by_role('link', name='打开交互预览', exact=True)
        separate = stage.get_by_role('link', name='在新标签页打开预览 ↗')
        if readonly:
            runtime = RUNTIME_ROUTE
            held = []
            page.route(runtime, lambda route: held.append(route))
            with page.expect_request(runtime):
                page.goto(detail_url, wait_until='commit')
            static = page.locator('#ilia-ssr .component-official-frame')
            static_launch = static.get_by_role('link', name='打开交互预览', exact=True)
            expect(static_launch).to_have_attribute('href', OFFICIAL_FRAME_URL)
            expect(static_launch).to_have_attribute('target', '_blank')
            expect(static.locator('iframe')).to_have_count(0)
            static_launch.focus()
            before = static.bounding_box()
            held.pop().continue_()
            expect(launch).to_be_focused()
            expect(static).to_have_count(0)
            after = stage.bounding_box()
            assert all(abs(after[prop] - before[prop]) <= 1 for prop in ('x', 'y', 'width', 'height')), (width, before, after)
        else:
            page.goto(detail_url, wait_until='domcontentloaded')
            expect(launch).to_be_visible()

        before = stage.bounding_box()
        expect(stage.locator('iframe')).to_have_count(0)
        expect(separate).to_have_attribute('href', OFFICIAL_FRAME_URL)
        assert requested == []
        opened_frame = (page.expect_event('requestfailed', lambda request: request.url == OFFICIAL_FRAME_URL)
                        if denied else page.expect_response(OFFICIAL_FRAME_URL))
        with opened_frame as frame_request:
            launch.press('Enter')
        if denied:
            assert frame_request.value.failure == 'net::ERR_BLOCKED_BY_RESPONSE'
        iframe = stage.locator('iframe')
        expect(iframe).to_have_attribute('sandbox', 'allow-scripts')
        expect(iframe).to_have_attribute('referrerpolicy', 'no-referrer')
        expect(stage.locator('.component-official-frame-canvas')).to_be_focused()
        expect(separate).to_be_visible()
        expect(page.locator('#component-dialog [data-component-origin]')).to_have_attribute(
            'href', 'https://smoothui.dev/docs/components/exposure-slider')
        assert stage.bounding_box() == before
        if denied:
            with page.context.expect_page() as opened:
                separate.click()
            preview = opened.value
            expect(preview).to_have_url(OFFICIAL_FRAME_URL)
            expect(preview.get_by_role('button', name='预览示例')).to_be_visible()
            preview.close()
        else:
            demo = iframe.content_frame.get_by_role('button', name='预览示例')
            demo.click()
            expect(iframe.content_frame.get_by_role('button', name='更新成功')).to_be_visible()
        page.get_by_role('button', name='关闭组件详情').click()
        expect(stage.locator('iframe')).to_have_count(0)
    finally:
        page.close()


def check_deep_detail_return(browser, origin, gallery_path, detail_path, width):
    page = browser_page(browser, origin, width, 900)
    gallery = origin + gallery_path
    detail = origin + detail_path + DEEP_DETAIL_ID
    try:
        page.goto(detail, wait_until="domcontentloaded")
        modal = page.locator("#component-dialog")
        close = modal.get_by_role("button", name="关闭组件详情")
        thumb = page.locator(f'.component-thumb[data-open-component="{DEEP_DETAIL_ID}"]')
        expect(modal).to_be_visible()
        assert page.evaluate('scrollY') < 10
        close.click()
        expect(page).to_have_url(gallery)
        expect(thumb).to_be_focused()
        expect(thumb).to_be_in_viewport(ratio=0.95)
        assert page.evaluate('scrollY') > 1000

        title = page.locator('.component-tile', has=thumb).locator('h3 button')
        title.scroll_into_view_if_needed()
        directory_top = page.evaluate('scrollY')
        title.click()
        expect(page).to_have_url(detail)
        expect(modal).to_be_visible()
        page.go_back(wait_until="commit")
        expect(page).to_have_url(gallery)
        expect(modal).not_to_be_visible()
        expect(title).to_be_focused()
        page.wait_for_function('top => Math.abs(scrollY - top) <= 1', arg=directory_top)

        page.go_forward(wait_until="commit")
        expect(page).to_have_url(detail)
        page.reload(wait_until="domcontentloaded")
        expect(modal).to_be_visible()
        close.click()
        expect(page).to_have_url(gallery)
        expect(thumb).to_be_focused()
        page.wait_for_function('top => Math.abs(scrollY - top) <= 1', arg=directory_top)
    finally:
        page.close()


def check_responsive_directory_anchor(browser, origin, gallery_path):
    for before, after, lanes, focused in (
        (699, 700, 2, True), (700, 699, 1, True),
        (1000, 1001, 3, False), (1001, 1000, 2, False),
    ):
        page = browser_page(browser, origin, before, 900)
        try:
            page.goto(origin + gallery_path, wait_until='domcontentloaded')
            grid = page.locator('#component-library .component-grid')
            cards = grid.locator('.component-tile')
            expect(cards).to_have_count(850)
            if focused:
                target = grid.locator(f'.component-title-control[data-open-component="{DEEP_DETAIL_ID}"]')
                target.focus()
            else:
                target = grid.locator('.component-lane').first.locator('.component-tile').nth(100)
            target.evaluate("""(node, offset) => {
              window.responsiveDirectoryAnchor = node;
              scrollBy({top: node.getBoundingClientRect().top - offset, behavior: 'instant'});
            }""", 180 if focused else 8)
            page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
            offset = target.evaluate('node => node.getBoundingClientRect().top')
            assert page.evaluate('scrollY') > 1000

            def order():
                return cards.evaluate_all("nodes => nodes.map(node => node.querySelector('.component-thumb').dataset.openComponent)")

            original_order = order()
            page.set_viewport_size({'width': after, 'height': 900})
            expect(grid.locator('.component-lane')).to_have_count(lanes)
            page.wait_for_function("""top => Math.abs(window.responsiveDirectoryAnchor.getBoundingClientRect().top - top) <= 1""",
                                   arg=offset)
            assert target.evaluate('node => node === window.responsiveDirectoryAnchor')
            assert order() == original_order
            if focused:
                expect(target).to_be_focused()
                expect(target).to_be_in_viewport()
        finally:
            page.close()


def check_directory_filter_restore(browser, origin, gallery_path, readonly):
    page = browser_page(browser, origin, 390, 900)
    try:
        base = origin + gallery_path
        page.goto(base, wait_until="domcontentloaded")
        search = page.locator("#component-search")
        results = page.locator(".component-grid .component-thumb")
        category = page.locator('[data-cc="图集与轮播"]')
        source = page.locator('[data-source-filter="Bencho"]')
        if not readonly:
            search.fill("元素弹跳着出现")
            expect(results).to_have_count(1)
            assert page.url == base
            assert page.evaluate("history.state.iliaDirectory.query") == "元素弹跳着出现"
        search.fill("对比")
        category.click()
        source.click()
        expect(search).to_have_value("对比")
        expect(results).to_have_count(1)
        expect(results.first).to_have_attribute("data-open-component", "4cbfeca4-e4db-402e-8b1f-a1aa0aa96012")
        filters = {"q": ["对比"], "category": ["图集与轮播"], "source": ["Bencho"]}
        filtered_url = page.url
        if readonly:
            assert parse_qs(urlsplit(filtered_url).query) == filters
        else:
            assert filtered_url == base
            assert page.evaluate("history.state.iliaDirectory.query") == "对比"
        page.reload(wait_until="domcontentloaded")
        expect(search).to_have_value("对比")
        command = page.locator('.command-search:has(#component-search)')
        expect(command.locator('.command-trigger')).to_have_attribute('aria-expanded', 'true')
        expect(command.get_by_role('button', name='清空输入')).to_have_css('opacity', '1')
        expect(category).to_have_attribute("aria-pressed", "true")
        expect(source).to_have_attribute("aria-pressed", "true")
        expect(results).to_have_count(1)
        results.first.click()
        modal = page.locator("#component-dialog")
        expect(modal).to_be_visible()
        if readonly:
            assert parse_qs(urlsplit(page.url).query) == filters
        else:
            assert urlsplit(page.url).query == '' and '对比' not in urlsplit(page.url).fragment
        page.reload(wait_until="domcontentloaded")
        expect(modal).to_be_visible()
        expect(search).to_have_value("对比")
        modal.get_by_role("button", name="关闭组件详情").click()
        expect(page).to_have_url(filtered_url)
        expect(results).to_have_count(1)
        expect(results.first).to_be_focused()
        if not readonly:
            page.locator('#navigation [data-view="all"]').click()
            expect(page).to_have_url(origin + '/#/websites')
            page.go_back()
            expect(page).to_have_url(base)
            expect(search).to_have_value("对比")
            expect(results).to_have_count(1)
    finally:
        page.close()


def check_horizontal_filter_reveal(browser, origin, gallery_path, readonly):
    filters = {'category': '图表与图解', 'source': 'Motion Prompt'}
    base = origin + gallery_path
    selected = [
        f'[data-cc="{filters["category"]}"]',
        f'[data-source-filter="{filters["source"]}"]',
    ]
    defaults = ['[data-cc="浏览全部"]', '[data-source-filter="全部来源"]']

    def horizontal_offsets(page, choices):
        page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        offsets = []
        for choice in choices:
            geometry = choice.evaluate("""node => {
              const chip = node.closest('label') || node;
              const group = chip.closest('.component-categories, .component-source-filters');
              const item = chip.getBoundingClientRect(), bounds = group.getBoundingClientRect();
              const left = bounds.left + group.clientLeft;
              return { label: node.getAttribute('aria-label') || node.textContent.trim(),
                leftGap: item.left - left, rightGap: left + group.clientWidth - item.right, offset: group.scrollLeft };
            }""")
            assert geometry['leftGap'] >= -1 and geometry['rightGap'] >= -1, geometry
            offsets.append(geometry['offset'])
        return offsets

    page = browser_page(browser, origin, 390, 900)
    try:
        page.goto(base, wait_until='domcontentloaded')
        live = page.locator('#component-library')
        choices = [live.locator(selector) for selector in selected]
        original = [live.locator(selector) for selector in defaults]
        for choice in choices:
            choice.click()
            expect(choice).to_have_attribute('aria-pressed', 'true')
        expect(live.locator('.component-tile')).to_have_count(24)
        assert all(offset > 0 for offset in horizontal_offsets(page, choices))

        page.evaluate("scrollTo({ top: 0, behavior: 'instant' })")
        page.reload(wait_until='domcontentloaded')
        for choice in choices:
            expect(choice).to_have_attribute('aria-pressed', 'true')
        assert all(offset > 0 for offset in horizontal_offsets(page, choices))
        assert page.evaluate('scrollY') <= 1

        # Use real gallery/detail history entries while isolating app-driven vertical scroll.
        page.evaluate("history.scrollRestoration = 'manual'")
        tile = live.locator('.component-thumb').first
        tile.press('Enter')
        dialog = page.locator('#component-dialog')
        expect(dialog).to_be_visible()
        page.go_back(wait_until='commit')
        expect(dialog).to_be_hidden()
        page.evaluate("scrollTo({ top: 80, behavior: 'instant' })")
        top = page.evaluate('scrollY')
        assert top > 0

        clear = live.get_by_role('button', name='清除筛选', exact=True)
        clear.evaluate('node => node.focus({ preventScroll: true })')
        page.keyboard.press('Enter')
        for choice in original:
            expect(choice).to_have_attribute('aria-pressed', 'true')
        horizontal_offsets(page, original)
        assert abs(page.evaluate('scrollY') - top) <= 1

        page.go_forward(wait_until='commit')
        expect(dialog).to_be_visible()
        for choice in choices:
            expect(choice).to_have_attribute('aria-pressed', 'true')
        assert all(offset > 0 for offset in horizontal_offsets(page, choices))
        assert abs(page.evaluate('scrollY') - top) <= 1

        page.go_back(wait_until='commit')
        expect(dialog).to_be_hidden()
        for choice in original:
            expect(choice).to_have_attribute('aria-pressed', 'true')
        horizontal_offsets(page, original)
        assert abs(page.evaluate('scrollY') - top) <= 1
    finally:
        page.close()

    if not readonly:
        return
    page = browser_page(browser, origin, 390, 900)
    try:
        pending = []
        page.route(SEED_ROUTE, lambda route: pending.append(route))
        filtered = base + '?' + urlencode(filters)
        with page.expect_request(SEED_ROUTE):
            page.goto(filtered, wait_until='commit')
        fallback = page.locator('#ilia-ssr')
        radios = [fallback.get_by_role('radio', name=value, exact=True) for value in filters.values()]
        for option in radios:
            expect(option).to_be_checked()
        ssr_offsets = horizontal_offsets(page, radios)
        assert all(offset > 0 for offset in ssr_offsets)
        page.evaluate("scrollTo({ top: 80, behavior: 'instant' })")
        top = page.evaluate('scrollY')
        assert top > 0

        pending.pop().continue_()
        expect(fallback).to_have_count(0)
        expect(page).to_have_url(filtered)
        live = page.locator('#component-library')
        choices = [live.locator(selector) for selector in selected]
        for choice in choices:
            expect(choice).to_have_attribute('aria-pressed', 'true')
        live_offsets = horizontal_offsets(page, choices)
        assert all(abs(before - after) <= 1 for before, after in zip(ssr_offsets, live_offsets)), (ssr_offsets, live_offsets)
        after = page.evaluate('scrollY')
        assert abs(after - top) <= 1, (top, after)
    finally:
        page.close()


def check_directory_search_controls(browser, origin, gallery_path):
    page = browser_page(browser, origin, 390, 900, reduced_motion="no-preference")
    try:
        base = origin + gallery_path
        page.goto(base, wait_until="domcontentloaded")
        search = page.locator('#component-search')
        command = page.locator('.command-search:has(#component-search)')
        trigger = command.locator('.command-trigger')
        clear = command.locator('.t-clear-btn')
        tiles = page.locator('.component-grid .component-tile')
        category = page.locator('[data-cc="图集与轮播"]')
        source = page.locator('[data-source-filter="React Bits"]')
        heading = page.locator('#component-library h1')
        modal = page.locator('#component-dialog')
        expect(tiles).to_have_count(850)
        expect(trigger).to_have_attribute('aria-expanded', 'false')
        expect(clear).to_be_disabled()

        category.click()
        source.click()
        expect(tiles).to_have_count(15)
        page.locator('[data-dock="search"]').click()
        expect(search).to_be_focused()
        query = 'reactbits-accordion-gallery'
        initial_url = page.url
        search.evaluate('''input => {
          input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
          input.value = 'unfinished-search-composition';
          input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
        }''')
        expect(tiles).to_have_count(15)
        expect(page).to_have_url(initial_url)
        search.evaluate('''(input, completed) => {
          input.value = completed;
          input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        }''', query)
        card = page.locator(f'.component-thumb[data-open-component="{query}"]')
        card.click()
        expect(modal).to_be_visible()
        page.go_back(wait_until='commit')
        expect(modal).not_to_be_visible()
        expect(search).to_have_value(query)

        clear.click()
        expect(search).to_have_value('')
        expect(search).to_be_focused()
        expect(tiles).to_have_count(15)
        expect(command.locator('.t-clear')).to_have_class(re.compile(r'\bis-clearing\b'))
        no_match = 'zzilia-search-no-match'
        search.fill(no_match)
        expect(command.locator('.t-clear')).not_to_have_class(re.compile(r'\bis-clearing\b'))
        expect(search).to_have_value(no_match)
        expect(page.get_by_text('找不到符合条件的组件。', exact=True)).to_be_visible()
        clear.click()
        heading.focus()
        expect(command.locator('.t-clear')).not_to_have_class(re.compile(r'\bis-clearing\b'))
        expect(heading).to_be_focused()
        expect(trigger).to_have_attribute('aria-expanded', 'false')
        expect(category).to_have_attribute('aria-pressed', 'true')
        expect(source).to_have_attribute('aria-pressed', 'true')

        page.go_forward(wait_until='commit')
        expect(modal).to_be_visible()
        expect(search).to_have_value(query)
        expect(trigger).to_have_attribute('aria-expanded', 'true')
        expect(clear).to_be_enabled()
        expect(clear).to_have_css('opacity', '1')
        modal.get_by_role('button', name='关闭组件详情').click()
        expect(search).to_have_value('')
        expect(trigger).to_have_attribute('aria-expanded', 'false')
        expect(tiles).to_have_count(15)

        page.emulate_media(reduced_motion='reduce')
        search.fill(no_match)
        clear.click()
        expect(command.locator('.t-clear')).not_to_have_class(re.compile(r'\bis-clearing\b'))
        expect(tiles).to_have_count(15)
        expect(category).to_have_attribute('aria-pressed', 'true')
        expect(source).to_have_attribute('aria-pressed', 'true')
        search.fill(no_match)
        search.press('Escape')
        expect(trigger).to_be_focused()
        expect(tiles).to_have_count(15)
        search.fill(no_match)
        page.get_by_role('button', name='清除筛选').click()
        expect(page).to_have_url(base)
        expect(tiles).to_have_count(850)
        expect(heading).to_be_focused()
        expect(page.locator('[data-cc="浏览全部"]')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('[data-source-filter="全部来源"]')).to_have_attribute('aria-pressed', 'true')
    finally:
        page.close()


def check_legacy_website_routes(browser, website):
    context = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
    restrict_requests(context, website)
    page = context.new_page()
    try:
        for home, gallery in (('/', '/components'), ('/zh', '/zh/components')):
            for filters in (
                {'q': COMPONENT_ID},
                {'category': '动效与镜头'},
                {'source': 'Motion Prompt'},
                {'focus': 'search'},
                {'q': COMPONENT_ID, 'category': '动效与镜头', 'source': 'Motion Prompt', 'focus': 'search'},
            ):
                old_url = website + home + '?' + urlencode(filters)
                response = context.request.get(old_url, max_redirects=0)
                assert response.status in (301, 302, 307, 308), (old_url, response.status)
                location = urlsplit(response.headers['location'])
                assert location.path == gallery, (old_url, location)
                assert parse_qs(location.query) == {key: [value] for key, value in filters.items()}, location

            filters = {'q': COMPONENT_ID, 'source': 'Motion Prompt', 'tab': 'references'}
            old_detail = website + home + '?' + urlencode({'component': COMPONENT_ID, **filters})
            response = context.request.get(old_detail, max_redirects=0)
            assert response.status in (301, 302, 307, 308), (old_detail, response.status)
            location = urlsplit(response.headers['location'])
            assert location.path == gallery + '/' + COMPONENT_ID, (old_detail, location)
            assert parse_qs(location.query) == {key: [value] for key, value in filters.items()}, location
            page.goto(old_detail, wait_until='domcontentloaded')
            expect(page.locator('#ilia-ssr').get_by_role('link', name='参考素材')).to_have_attribute('aria-current', 'page')
            page.get_by_role('link', name='返回组件库').click()
            assert urlsplit(page.url).path == gallery
            assert parse_qs(urlsplit(page.url).query) == {'q': [COMPONENT_ID], 'source': ['Motion Prompt']}
            expect(page.locator('#ilia-ssr .component-thumb:visible')).to_have_count(1)

        sitemap = context.request.get(website + '/sitemap.xml')
        assert sitemap.ok
        entries = ElementTree.fromstring(sitemap.text())
        published = {urlsplit(node.text).path for node in entries.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
        assert {'/', '/components', '/components/' + COMPONENT_ID, '/switches',
                '/components/dark-mode-toggle', '/components/theme-toggle', '/mcp'} <= published
    finally:
        context.close()


def check_shareable_website_filters(browser, website):
    page = browser_page(browser, website, 1440, 900)
    try:
        filters = {"q": "对比", "category": "图集与轮播", "source": "Bencho"}
        search = page.locator("#component-search")
        results = page.locator(".component-grid .component-thumb")
        page.goto(website + "/zh/components?" + urlencode({**filters, "focus": "search"}), wait_until="domcontentloaded")
        expect(results).to_have_count(1)
        expect(search).to_have_value("对比")
        expect(search).to_be_focused()
        assert urlsplit(page.url).path == '/zh/components', page.url
        expect(page.locator('link[rel="canonical"]')).to_have_attribute("href", re.compile(r"^https?://[^?#]+/components$"))

        legacy = {**filters, "component": "reactbits-squish-switch"}
        page.goto(website + "/zh?" + urlencode(legacy), wait_until="domcontentloaded")
        modal = page.locator("#component-dialog")
        expect(modal).to_be_visible()
        expect(search).to_be_attached()
        modal.get_by_role("button", name="关闭组件详情").click()
        expect(page).to_have_url(website + "/zh/components?" + urlencode(filters))
        expect(modal).not_to_be_visible()
        assert urlsplit(page.url).path == '/zh/components' and parse_qs(urlsplit(page.url).query) == {
            key: [value] for key, value in filters.items()
        }
        expect(search).to_have_value("对比")
        expect(results).to_have_count(1)
        expect(page.locator('#component-library').get_by_role('heading', level=1)).to_be_focused()
        detail = website + "/zh/components/4cbfeca4-e4db-402e-8b1f-a1aa0aa96012?" + urlencode(filters)
        page.goto(detail, wait_until="domcontentloaded")
        expect(modal).to_be_visible()
        expect(search).to_be_attached()
        expect(page.locator('link[rel="canonical"]')).to_have_attribute("href", re.compile(r"/components/4cbfeca4-e4db-402e-8b1f-a1aa0aa96012$"))
        modal.get_by_role("button", name="关闭组件详情").click()
        expect(page).to_have_url(website + "/zh/components?" + urlencode(filters))
        expect(modal).not_to_be_visible()
        assert urlsplit(page.url).path == '/zh/components' and parse_qs(urlsplit(page.url).query).get('q') == ['对比']
        expect(results.first).to_be_focused()
    finally:
        page.close()


def check_server_directory(browser, website):
    category = "图集与轮播"
    filters = {"q": "对比", "category": category, "source": "Bencho"}
    gallery = website + "/zh/components"
    filtered_url = gallery + "?" + urlencode(filters)
    js_page = browser_page(browser, website, 390, 844)
    try:
        js_page.goto(gallery + "?" + urlencode({"category": category, "source": "Bencho"}), wait_until="domcontentloaded")
        interactive_cards = js_page.locator(".component-grid .component-thumb")
        expect(interactive_cards).to_have_count(2)
        interactive_ids = interactive_cards.evaluate_all("cards => cards.map(card => card.dataset.openComponent)")
    finally:
        js_page.close()

    context = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
    restrict_requests(context, website)
    page = context.new_page()
    try:
        fallback = page.locator("#ilia-ssr")
        search = fallback.get_by_role("searchbox", name="关键词")
        category_option = fallback.get_by_role("radio", name=category, exact=True)
        source_option = fallback.get_by_role("radio", name="Bencho", exact=True)
        links = fallback.locator('a.component-thumb:visible')
        page.goto(website + "/components", wait_until="domcontentloaded")
        expect(page.get_by_role("main")).to_have_id("ilia-ssr")
        expect(links).to_have_count(24)
        page.goto(gallery + "/", wait_until="domcontentloaded")
        assert page.locator('html').evaluate('node => node.scrollWidth') == 390
        category_option.check()
        source_option.check()
        fallback.get_by_role("button", name="筛选").click()
        expect(links).to_have_count(2)
        hrefs = links.evaluate_all('links => links.map(link => link.getAttribute("href"))')
        assert [urlsplit(href).path.removeprefix('/zh/components/') for href in hrefs] == interactive_ids, hrefs
        search.fill(filters["q"])
        fallback.get_by_role("button", name="筛选").click()
        page.wait_for_url(lambda url: urlsplit(url).path == '/zh/components' and
                          parse_qs(urlsplit(url).query) == {key: [value] for key, value in filters.items()})
        expect(search).to_have_value(filters["q"])
        expect(category_option).to_be_checked()
        expect(source_option).to_be_checked()
        expect(fallback.get_by_text("找到 1 个组件。", exact=True)).to_be_visible()
        expect(links).to_have_count(1)
        expect(page.locator('link[rel="canonical"]')).to_have_attribute("href", re.compile(r"^https?://[^?#]+/components$"))
        expected_id = "4cbfeca4-e4db-402e-8b1f-a1aa0aa96012"
        expect(links).to_have_attribute("href", "/zh/components/" + expected_id + "?" + urlencode(filters))
        title = links.get_attribute('aria-label').removeprefix('预览 ')
        fallback.get_by_role("link", name=title, exact=True).click()
        expect(fallback.get_by_role("heading", level=1)).to_have_text(title)
        expect(fallback.get_by_role("link", name=re.compile(r"^打开(组件来源|收录页)"))).to_have_attribute("href", re.compile(r"^https://"))
        fallback.get_by_role("link", name="返回组件库").click()
        expect(page).to_have_url(filtered_url)

        page.goto(gallery + "?q=unknown-component-bfbe45", wait_until="domcontentloaded")
        expect(fallback.get_by_text("找不到符合条件的组件。", exact=True)).to_be_visible()
        expect(links).to_have_count(0)
        fallback.get_by_role("link", name="清除筛选").click()
        expect(page).to_have_url(gallery)
        expect(links).to_have_count(24)
        page.goto(website + "/zh?component=reactbits-squish-switch&source=Unknown&q=Squish%00Switch", wait_until="domcontentloaded")
        expect(page.locator('link[rel="canonical"]')).to_have_attribute("href", re.compile(r"/components/reactbits-squish-switch$"))
        fallback.get_by_role("link", name="返回组件库").click()
        expect(page).to_have_url(gallery + "?q=SquishSwitch")
        expect(links).to_have_count(1)
        missing = page.goto(gallery + "/not-a-registered-entry?q=demo", wait_until="domcontentloaded")
        assert missing.status == 404
        expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex")
        expect(fallback.get_by_role("link", name="返回组件库")).to_have_attribute("href", "/zh/components?q=demo")
    finally:
        context.close()


def check_first_directory_paint(browser, website):
    def card_sizes(root):
        return root.locator('.component-tile:visible').evaluate_all("""cards => Object.fromEntries(cards.map(card => {
          const { x, y, width, height } = card.getBoundingClientRect();
          const grid = card.closest('.component-grid').getBoundingClientRect();
          const id = card.dataset.componentId || card.querySelector('.component-thumb').dataset.openComponent;
          return [id, [x, y - grid.y, width, height].map(Math.round)];
        }))""")

    def filter_sizes(root):
        return root.evaluate("""root =>
          ['.component-categories', '.component-source-filters'].map(selector => {
            const group = root.querySelector(selector);
            const rect = node => {
              const {x, y, width, height} = node.getBoundingClientRect();
              return [x, y, width, height].map(Math.round);
            };
            return [rect(group), [...group.querySelectorAll('button, label')].map(node => [
              node.querySelector('input')?.getAttribute('aria-label') ?? node.dataset.cc ?? node.dataset.sourceFilter,
              node.querySelector('small')?.textContent ?? '',
              rect(node)
            ])];
          })""")

    for width in (1440, 1001, 1000, 900, 700, 699, 390, 320):
        page = browser_page(browser, website, width, 900)
        try:
            pending = []
            page.route(SEED_ROUTE, lambda route: pending.append(route))
            with page.expect_request(SEED_ROUTE):
                page.goto(website + '/components', wait_until='commit')
            fallback = page.locator('#ilia-ssr')
            expect(fallback.locator('.component-tile:visible')).to_have_count(24)
            expect(fallback.locator('.component-tile')).to_have_count(52)
            expect(fallback.locator('.component-thumb:visible').first).to_have_attribute('href', '/components/motion-prompt-218')
            assert page.evaluate('document.documentElement.scrollWidth') == width
            initial = card_sizes(fallback)
            initial_filters = filter_sizes(fallback)
            initial_search = fallback.locator('#ilia-search').bounding_box()
            initial_top = fallback.locator('.component-grid').bounding_box()['y']
            scroll = fallback.locator('.component-source-filters').evaluate('node => { node.scrollLeft = 55; return node.scrollLeft; }')
            if width < 500:
                assert scroll > 0
            pending.pop().continue_()
            live = page.locator('#component-library')
            expect(live.locator('.component-tile')).to_have_count(850)
            expect(fallback).to_have_count(0)
            interactive = card_sizes(live)
            differences = [
                (id, size, interactive.get(id)) for id, size in initial.items()
                if id not in interactive or any(abs(a - b) > 1 for a, b in zip(size, interactive[id]))
            ]
            assert not differences, (width, differences[:4])
            live_top = live.locator('.component-grid').bounding_box()['y']
            assert abs(initial_top - live_top) <= 1, (width, initial_top, live_top)
            live_search = live.locator('.command-search').bounding_box()
            assert all(abs(initial_search[key] - live_search[key]) <= 1 for key in initial_search), (width, initial_search, live_search)
            live_sources = live.locator('.component-source-filters')
            assert abs(live_sources.evaluate('node => node.scrollLeft') - scroll) <= 1
            live_sources.evaluate('node => { node.scrollLeft = 0; }')
            for (before_group, before_options), (after_group, after_options) in zip(initial_filters, filter_sizes(live)):
                assert all(abs(a - b) <= 1 for a, b in zip(before_group, after_group)), (width, before_group, after_group)
                assert [option[:2] for option in before_options] == [option[:2] for option in after_options]
                for before, after in zip(before_options, after_options):
                    assert all(abs(a - b) <= 1 for a, b in zip(before[2], after[2])), (width, before, after)
        finally:
            page.close()

    page = browser_page(browser, website, 390, 900)
    try:
        pending = []
        page.route(SEED_ROUTE, lambda route: pending.append(route))
        with page.expect_request(SEED_ROUTE):
            page.goto(website + '/zh/components?q=toggle&source=React+Bits', wait_until='commit')
        fallback = page.locator('#ilia-ssr')
        search = fallback.get_by_role('searchbox', name='关键词')
        fallback.get_by_role('radio', name='图集与轮播', exact=True).check()
        search.fill('carousel')
        search.evaluate('input => input.setSelectionRange(1, 5, "forward")')
        pending.pop().continue_()
        live = page.locator('#component-library')
        live_search = live.locator('#component-search')
        expect(live_search).to_have_value('carousel')
        expect(live_search).to_be_focused()
        assert live_search.evaluate('input => [input.selectionStart, input.selectionEnd, input.selectionDirection]') == [1, 5, 'forward']
        expect(live.locator('[data-source-filter="React Bits"]')).to_have_attribute('aria-pressed', 'true')
        expect(live.locator('[data-cc="图集与轮播"]')).to_have_attribute('aria-pressed', 'true')
        expect(fallback).to_have_count(0)
        filters = {'q': ['carousel'], 'category': ['图集与轮播'], 'source': ['React Bits']}
        assert parse_qs(urlsplit(page.url).query) == filters
        thumbnail = live.locator('.component-thumb:visible').first
        thumbnail.click()
        expect(page.locator('#component-dialog')).to_be_visible()
        assert urlsplit(page.url).path.startswith('/zh/components/')
        assert parse_qs(urlsplit(page.url).query) == filters
        page.go_back(wait_until='commit')
        expect(page.locator('#component-dialog')).not_to_be_visible()
        expect(thumbnail).to_be_focused()
    finally:
        page.close()

    page = browser_page(browser, website, 390, 900)
    try:
        page.route(SEED_ROUTE, lambda route: route.fulfill(status=503, body='Unavailable'))
        page.goto(website + '/components', wait_until='domcontentloaded')
        fallback = page.locator('#ilia-ssr')
        expect(fallback.locator('[data-directory-load-status]')).to_contain_text('仍可使用本页的筛选和链接')
        expect(fallback.locator('.component-thumb:visible')).to_have_count(24)
        expect(fallback.get_by_role('button', name='筛选')).to_be_enabled()
    finally:
        page.close()


def check_directory_submit_handoff(browser, website):
    query_url = website + '/zh/components?' + urlencode({'q': COMPONENT_ID})
    for width in (320, 390, 1440):
        page = browser_page(browser, website, width, 900)
        try:
            pending = []
            page.route(SEED_ROUTE, lambda route: pending.append(route))
            with page.expect_request(SEED_ROUTE):
                page.goto(query_url, wait_until='commit')
            fallback = page.locator('#ilia-ssr')
            submit = fallback.get_by_role('button', name='筛选', exact=True)
            expect(submit).to_be_visible()
            box = submit.bounding_box()
            point = [box['x'] + box['width'] / 2, box['y'] + box['height'] / 2]
            hit_test = '(node, [x, y]) => node.contains(document.elementFromPoint(x, y))'
            assert submit.evaluate(hit_test, point), (width, point, 'First-paint submit is not hittable')
            page.mouse.move(*point)

            pending.pop().continue_()
            expect(fallback).to_have_count(0)
            live = page.locator('#component-library')
            clear = live.get_by_role('button', name='清空输入', exact=True)
            expect(clear).to_have_css('opacity', '1')
            assert not clear.evaluate(hit_test, point), (width, point, 'The old submit position now clears the query')
            page.mouse.click(*point)
            expect(live.locator('#component-search')).to_have_value(COMPONENT_ID)
            expect(live.locator('.component-tile')).to_have_count(1)
            expect(page).to_have_url(query_url)
        finally:
            page.close()

    page = browser_page(browser, website, 390, 900)
    try:
        pending = []
        page.route(SEED_ROUTE, lambda route: pending.append(route))
        with page.expect_request(SEED_ROUTE):
            page.goto(website + '/zh/components?source=Motion+Prompt', wait_until='commit')
        fallback = page.locator('#ilia-ssr')
        fallback.get_by_role('searchbox', name='关键词').fill(COMPONENT_ID)
        submit = fallback.get_by_role('button', name='筛选', exact=True)
        expect(submit).to_have_attribute('title', re.compile('筛选'))
        submit.focus()
        with page.expect_response(SEED_ROUTE) as seed:
            pending.pop().continue_()
        assert seed.value.ok
        page.wait_for_function("""() => performance.getEntriesByType('resource').some(entry =>
          new URL(entry.name).pathname.endsWith('/ilia-ui/seed.json'))""")
        page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(submit).to_be_focused()
        page.unroute(SEED_ROUTE)

        with page.expect_response(lambda response:
            response.request.resource_type == 'document' and response.request.frame == page.main_frame
        ) as submitted:
            page.keyboard.press('Enter')
        response = submitted.value
        assert response.ok and response.request.method == 'GET'
        assert urlsplit(response.url).path == '/zh/components'
        assert parse_qs(urlsplit(response.url).query) == {'q': [COMPONENT_ID], 'source': ['Motion Prompt']}
        live = page.locator('#component-library')
        expect(live.locator('#component-search')).to_have_value(COMPONENT_ID)
        expect(live.locator('[data-source-filter="Motion Prompt"]')).to_have_attribute('aria-pressed', 'true')
        expect(live.locator('.component-tile')).to_have_count(1)
    finally:
        page.close()


def check_directory_handoff_controls(browser, website):
    for scenario in ('composition', 'filter', 'category', 'card', 'title'):
        page = browser_page(browser, website, 390, 900)
        try:
            seed = SEED_ROUTE
            pending = []
            page.route(seed, lambda route: pending.append(route))
            with page.expect_request(seed):
                page.goto(website + '/zh/components', wait_until='commit')
            fallback = page.locator('#ilia-ssr')
            search = fallback.get_by_role('searchbox', name='关键词')
            card = fallback.locator('.component-thumb:visible').first
            if scenario == 'composition':
                page.locator('.action-dock a[data-dock="search"]').click()
                expect(page).to_have_url(website + '/zh/components#ilia-search')
                expect(search).to_be_focused()
                search.evaluate('''input => {
                  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
                  input.value = 'tan xing';
                  input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
                }''')
            elif scenario in ('filter', 'category'):
                name = '来源' if scenario == 'filter' else '组件分类'
                group = fallback.get_by_role('group' if scenario == 'filter' else 'navigation', name=name)
                group.locator('input:checked').focus()
            else:
                card_href = card.get_attribute('href')
                record = card_href.rsplit('/', 1)[1]
                trigger = card if scenario == 'card' else fallback.locator(f'[data-component-id="{record}"] .component-title-control')
                expect(trigger).to_have_attribute('href', card_href)
                trigger.focus()
            pending.pop().continue_()

            live = page.locator('#component-library')
            if scenario in ('composition', 'filter', 'category'):
                page.wait_for_function("performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/ilia-ui/seed.json'))")
                page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                expect(fallback).to_be_visible()
            if scenario == 'composition':
                expect(search).to_have_value('tan xing')
                search.evaluate('''input => {
                  input.value = '弹性入场';
                  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
                }''')
                expect(live.locator('#component-search')).to_have_value('弹性入场')
                expect(live.locator('#component-search')).to_be_focused()
                assert urlsplit(page.url).fragment == ''
                expect(live.locator(f'[data-open-component="{COMPONENT_ID}"].component-thumb')).to_be_visible()
            elif scenario in ('filter', 'category'):
                value = 'React Bits' if scenario == 'filter' else '图集与轮播'
                # The first click can immediately replace the native radio with its live button.
                group.get_by_role('radio', name=value, exact=True).click()
                selector = 'data-source-filter' if scenario == 'filter' else 'data-cc'
                button = live.locator(f'[{selector}="{value}"]')
                expect(button).to_have_attribute('aria-pressed', 'true')
                expect(button).to_be_focused()
                key = 'source' if scenario == 'filter' else 'category'
                assert parse_qs(urlsplit(page.url).query)[key] == [value]
            else:
                selector = '.component-thumb' if scenario == 'card' else '.component-title-control'
                button = live.locator(f'{selector}[data-open-component="{record}"]')
                expect(button).to_be_focused()
                button.press('Enter')
                expect(page).to_have_url(website + card_href)
                expect(page.locator('#component-dialog')).to_be_visible()
            expect(fallback).to_have_count(0)
        finally:
            page.close()


def check_directory_result_handoff(browser, website):
    for width in (320, 390, 1440):
        for query, kind, message in (
            ('ilia-no-match-empty-fixture', 'empty', '找不到符合条件的组件。'),
            (COMPONENT_ID, 'filtered', '找到 1 个组件。'),
        ):
            page = browser_page(browser, website, width, 900)
            try:
                pending = []
                page.route(SEED_ROUTE, lambda route: pending.append(route))
                with page.expect_request(SEED_ROUTE):
                    page.goto(website + '/zh/components?' + urlencode({'q': query, 'source': 'Motion Prompt'}), wait_until='commit')
                fallback = page.locator('#ilia-ssr')
                initial = fallback.locator(f'[data-directory-status="{kind}"]')
                expect(initial.get_by_role('status')).to_have_text(message)
                clear_link = initial.get_by_role('link', name='清除筛选')
                expect(clear_link).to_have_attribute('href', '/zh/components')
                clear_link.focus()
                history_length = page.evaluate('history.length')

                def geometry(panel):
                    return panel.evaluate("""panel => [panel, panel.querySelector('p'), panel.querySelector('[data-clear-directory]')]
                      .map(node => {
                        const {x, y, width, height} = node.getBoundingClientRect();
                        return [x, y, width, height];
                      })""")

                before = geometry(initial)
                pending.pop().continue_()
                live = page.locator('#component-library')
                result = live.locator(f'[data-directory-status="{kind}"]')
                clear_button = result.get_by_role('button', name='清除筛选')
                expect(clear_button).to_be_focused()
                expect(result.get_by_role('status')).to_have_text(message)
                after = geometry(result)
                assert all(abs(a - b) <= 1 for left, right in zip(before, after) for a, b in zip(left, right)), (width, kind, before, after)
                expect(live.locator('.component-tile')).to_have_count(0 if kind == 'empty' else 1)

                page.keyboard.press('Enter')
                expect(page).to_have_url(website + '/zh/components')
                expect(live.locator('.component-tile')).to_have_count(850)
                expect(live.locator('#component-search')).to_have_value('')
                expect(live.locator('[data-source-filter="全部来源"]')).to_have_attribute('aria-pressed', 'true')
                expect(live.get_by_role('heading', name='组件库', exact=True)).to_be_focused()
                assert page.evaluate('history.length') == history_length
            finally:
                page.close()


def check_first_component_detail(browser, website):
    def dimensions(panel, preview):
        return panel.evaluate("""(node, selector) => {
          const outer = node.getBoundingClientRect();
          const stage = node.querySelector(selector).getBoundingClientRect();
          return [outer.x, outer.y, outer.width, outer.height, stage.y - outer.y, stage.width, stage.height];
        }""", preview)

    for width in (320, 390, 1440):
        for record, source, static_preview, live_preview in [
            (COMPONENT_ID, 'https://showheyohtaki.github.io/motion-prompt/#001', '.component-static-motion', '.component-motion-preview iframe'),
            (SOUND_ID, SOUND_URL, '.component-static-preview', '.component-static-preview'),
        ]:
            page = browser_page(browser, website, width, 900)
            try:
                pending = []
                page.route(RUNTIME_ROUTE, lambda route: pending.append(route))
                with page.expect_request(RUNTIME_ROUTE):
                    page.goto(website + '/zh/components/' + record + '?source=React+Bits', wait_until='commit')
                fallback = page.locator('#ilia-ssr')
                panel = fallback.locator('.component-detail-panel')
                expect(panel).to_be_visible()
                expect(panel.get_by_role('heading', level=1)).to_be_visible()
                expect(panel.get_by_role('link', name='返回组件库')).to_have_attribute('href', '/zh/components?source=React+Bits')
                expect(panel.get_by_role('link', name='打开组件来源 ↗')).to_have_attribute('href', source)
                expect(page.locator('.topbar #add')).not_to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth') == width
                before = dimensions(panel, static_preview)
                static_origin = panel.get_by_role('link', name='打开组件来源 ↗')
                origin_width = static_origin.bounding_box()['width']
                static_origin.focus()
                pending.pop().continue_()
                live = page.locator('#component-dialog')
                expect(live.locator(live_preview)).to_be_visible()
                expect(fallback).to_have_count(0)
                after = dimensions(live, live_preview)
                assert all(abs(a - b) <= 1 for a, b in zip(before, after)), (width, record, before, after)
                origin = live.get_by_role('link', name='打开组件来源 ↗')
                expect(origin).to_have_attribute('href', source)
                expect(origin).to_be_focused()
                assert abs(origin.bounding_box()['width'] - origin_width) <= 1, width
            finally:
                page.close()

    for paused in (False, True):
        page = browser_page(browser, website, 390, 900)
        try:
            serve_test_preview(page)
            pending = []
            page.route(RUNTIME_ROUTE, lambda route: pending.append(route))
            with page.expect_request(RUNTIME_ROUTE):
                page.goto(website + '/components/' + VIDEO_ID, wait_until='commit')
            video = page.locator('#ilia-ssr video')
            assert video.evaluate('video => video.controls && !video.autoplay')
            video.evaluate('video => video.play()')
            page.wait_for_function("document.querySelector('#ilia-ssr video')?.currentTime > 0.08")
            start = video.evaluate('''(video, paused) => {
                if (paused) video.pause();
                video.focus();
                window.firstPaintVideo = video;
                return video.currentTime;
            }''', paused)
            pending.pop().continue_()
            dialog = page.locator('#component-dialog')
            expect(dialog.get_by_role('tab', name='提示词')).to_be_visible()
            expect(page.locator('#ilia-ssr')).to_have_count(0)
            live_video = dialog.locator('video')
            expect(live_video).to_be_focused()
            assert live_video.evaluate('video => video === window.firstPaintVideo')
            if paused:
                assert live_video.evaluate('video => video.paused')
                assert abs(live_video.evaluate('video => video.currentTime') - start) < 0.02
            else:
                assert not live_video.evaluate('video => video.paused')
                assert live_video.evaluate('video => video.currentTime') > 0
        finally:
            page.close()

def check_unplayed_video_audio_handoff(browser, website):
    page = browser_page(browser, website, 390, 900, reduced_motion='no-preference')
    try:
        serve_test_preview(page)
        held = []
        page.route(RUNTIME_ROUTE, lambda route: held.append(route))
        with page.expect_request(RUNTIME_ROUTE):
            page.goto(website + '/components/' + VIDEO_ID, wait_until='commit')
        fallback = page.locator('#ilia-ssr')
        original = fallback.locator('video')
        original.evaluate('''video => {
          video.volume = 0.31;
          video.muted = false;
          window.originalVideo = video;
        }''')
        fallback.locator('[data-component-origin]').focus()
        held.pop().continue_()
        dialog = page.locator('#component-dialog')
        video = dialog.locator('video')
        expect(dialog.locator('[data-component-origin]')).to_be_focused()
        assert video.evaluate('video => video === window.originalVideo')
        dialog.get_by_role('tab', name='提示词').press('Enter')
        expect(video).to_have_count(0)
        dialog.get_by_role('tab', name='预览').press('Enter')
        page.wait_for_function('''() => {
          const video = document.querySelector('#component-dialog video');
          return video?.readyState > 0 && video.paused && !video.autoplay && !video.muted &&
            video.currentTime === 0 && Math.abs(video.volume - 0.31) < 0.001;
        }''')
    finally:
        page.close()


def check_prompt_handoff(browser, website):
    for width, height in ((320, 460), (1440, 900)):
        page = browser_page(browser, website, width, height)
        try:
            held = []
            runtime = RUNTIME_ROUTE
            page.route(runtime, lambda route: held.append(route))
            with page.expect_request(runtime):
                page.goto(website + '/components/' + COMPONENT_ID + '?tab=prompt', wait_until='commit')
            static = page.locator('#ilia-ssr .component-detail-panel')
            input_box = static.get_by_role('textbox', name='提示词原文')
            expect(input_box).to_be_visible()
            input_box.evaluate("""input => {
              input.focus({preventScroll: true});
              input.setSelectionRange(32, 49, 'backward');
              input.scrollTop = 64;
              input.closest('.component-detail-panel').scrollTop = 108;
            }""")

            def state(panel):
                return panel.evaluate("""panel => {
                  const input = panel.querySelector('textarea');
                  const box = node => {
                    const {x, y, width, height} = node.getBoundingClientRect();
                    return [x, y, width, height];
                  };
                  return {
                    panel: box(panel), input: box(input), scroll: [panel.scrollTop, input.scrollTop],
                    selection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
                    padding: getComputedStyle(input).padding, value: input.value,
                  };
                }""")

            before = state(static)
            assert before['scroll'][1] > 0
            if width == 320:
                assert before['scroll'][0] > 0
            held.pop().continue_()
            dialog = page.locator('#component-dialog')
            expect(dialog.get_by_role('textbox', name='提示词原文')).to_be_focused()
            expect(dialog.get_by_role('button', name='复制提示词')).to_be_visible()
            after = state(dialog)
            for key in ('panel', 'input'):
                assert all(abs(a - b) <= 1 for a, b in zip(before[key], after[key])), (width, key, before[key], after[key])
            for key in ('scroll', 'selection', 'padding', 'value'):
                assert before[key] == after[key], (width, key, before[key], after[key])
        finally:
            page.close()


def check_detail_media_failure_layout(browser, website, width):
    shape = 'reactbits-shape-grid'
    for record, has_poster in ((shape, False), (VIDEO_ID, True), (VIDEO_ID, False)):
        page = browser_page(browser, website, width, 900)
        try:
            held = []
            held_images = []
            runtime = RUNTIME_ROUTE
            page.route(runtime, lambda route: held.append(route))
            if has_poster:
                serve_test_preview(page, video=False)
            if record == shape:
                page.route('https://reactbits.dev/og/backgrounds/shape-grid.jpg', lambda route: held_images.append(route), times=1)
            with page.expect_request(runtime):
                page.goto(website + '/components/' + record, wait_until='commit')
            static = page.locator('#ilia-ssr .component-detail-panel')
            live = page.locator('#component-dialog')

            def boxes(panel):
                return [panel.bounding_box(), panel.locator('.component-detail-media').bounding_box(),
                        panel.locator('[data-component-origin]').bounding_box()]

            def assert_same_layout(after, before):
                assert all(abs(before[i][prop] - after[i][prop]) <= 1
                           for i in range(len(before)) for prop in ('x', 'y', 'width', 'height')), (width, record, before, after)

            before = boxes(static)
            failure = 'img.component-preview-poster' if has_poster else '.component-preview-error'
            if record == VIDEO_ID:
                assert static.locator('video').evaluate('video => video.play().then(() => false, () => Boolean(video.error))')
            else:
                held_images.pop().abort()
                assert static.locator('img').evaluate('img => img.decode().then(() => false, () => img.naturalWidth === 0)')
            assert_same_layout(boxes(static), before)

            held.pop().continue_()
            expect(live.locator('.component-detail-media')).to_be_visible()
            assert_same_layout(boxes(live), before)
            if record == VIDEO_ID:
                clip = live.locator('video')
                if clip.count():
                    clip.evaluate('video => { video.play().catch(() => {}); }')
            expect(live.locator(failure)).to_be_visible()
            if has_poster:
                assert live.locator(failure).evaluate('img => img.decode().then(() => img.naturalWidth > 0)')
            assert_same_layout(boxes(live), before)
        finally:
            page.close()


def check_public_card_content_first_paint(browser, website):
    style_poster = 'https://showheyohtaki.github.io/motion-prompt/packs/artstyle/img/style-01.webp'
    shape_poster = 'https://reactbits.dev/og/backgrounds/shape-grid.jpg'
    cases = [
        (COMPONENT_ID, 'https://showheyohtaki.github.io/motion-prompt/#001', '/motion-prompt-preview/posters/001.webp'),
        ('motion-prompt-193', 'https://showheyohtaki.github.io/motion-prompt/#193', style_poster),
        ('reactbits-shape-grid', 'https://reactbits.dev/backgrounds/shape-grid', shape_poster),
        (VIDEO_ID, 'https://reactbits.dev/backgrounds/aurora', VIDEO_POSTER_URL),
        ('designbookmark-exposure-slider', 'https://smoothui.dev/docs/components/exposure-slider', '交互预览'),
        (SOUND_ID, SOUND_URL, '打开音效来源'),
        ('transitions-avatar-group-hover', 'https://transitions.dev/detail.html?t=avatar-group-hover', '在来源页查看预览'),
    ]
    metadata = """card => [
      card.querySelector('h3').textContent.trim(),
      card.querySelector('.component-summary').textContent,
      card.querySelector('.component-labels').textContent.trim(),
      card.querySelector('.component-source-name').title,
      getComputedStyle(card.querySelector('h3 > *')).fontWeight,
    ]"""

    def verify_card(card, record, source, preview):
        source_link = card.locator('a.component-source-name')
        expect(source_link).to_have_attribute('href', source)
        expect(source_link).to_have_attribute('rel', 'noopener noreferrer')
        if preview.startswith(('/', 'https://')):
            expected = re.compile(r'^' + UI_RELEASE_PATH + re.escape(preview) + '$') if preview.startswith('/') else preview
            expect(card.locator('.component-thumb img')).to_have_attribute('src', expected)
        else:
            expect(card.locator('.component-thumb').get_by_text(preview, exact=True)).to_be_visible()
        if record == SOUND_ID:
            expect(card.locator('.sound-preview svg')).to_be_visible()
            expect(card.locator('audio')).to_have_count(0)
        if record == VIDEO_ID:
            expect(card.locator('video')).to_have_count(0)

    for width in (390, 1440):
        page = browser_page(browser, website, width, 900)
        try:
            serve_test_preview(page)
            for poster in (style_poster, shape_poster):
                page.route(poster, lambda route: route.fulfill(path=POSTER_FIXTURE, content_type='image/webp'))
            pending = []
            page.route(SEED_ROUTE, lambda route: pending.append(route))
            for record, source, preview in cases:
                suffix = '?' + urlencode({'q': record})
                with page.expect_request(SEED_ROUTE):
                    page.goto(website + '/zh/components' + suffix, wait_until='commit')
                static = page.locator(f'#ilia-ssr [data-component-id="{record}"]')
                live = page.locator(f'#component-library .component-tile:has([data-open-component="{record}"])')
                expect(static).to_be_visible()
                expect(static.locator('a.component-thumb')).to_have_attribute('href', '/zh/components/' + record + suffix)
                verify_card(static, record, source, preview)
                initial = static.evaluate(metadata)
                static_top = page.locator('#ilia-ssr .component-grid').bounding_box()['y']
                pending.pop().continue_()
                expect(live).to_be_visible()
                assert abs(static_top - page.locator('#component-library .component-grid').bounding_box()['y']) <= 1, (width, record)
                assert live.evaluate(metadata) == initial, (width, record, initial)
                verify_card(live, record, source, preview)
        finally:
            page.close()


def check_sidebar_spring(browser, origin, path):
    page = browser_page(browser, origin, 1440, 980, reduced_motion="no-preference")
    try:
        page.goto(origin + path, wait_until="domcontentloaded")
        expect(page.locator("#sidebar-collapse")).to_be_visible()
        widths = page.evaluate("""async () => {
          const sidebar = document.querySelector('.sidebar');
          const width = () => sidebar.getBoundingClientRect().width;
          const samples = [width()];
          document.querySelector('#sidebar-collapse').click();
          let settledFrames = 0;
          do {
            await new Promise(requestAnimationFrame);
            const current = width();
            samples.push(current);
            settledFrames = Math.abs(current - 56) < 0.1 ? settledFrames + 1 : 0;
          } while (settledFrames < 3 && samples.length < 120);
          return samples;
        }""")
        assert abs(widths[0] - 160) <= 1 and all(abs(width - 56) < 0.1 for width in widths[-3:]), widths
        assert len({round(width) for width in widths if 57 < width < 159}) >= 3, widths
    finally:
        page.close()


def check_sidebar_keyboard_navigation(browser, origin, path, readonly):
    for width in (320, 390, 1440):
        page = browser_page(browser, origin, width, 900)
        try:
            page.goto(origin + path, wait_until='domcontentloaded')
            expect(page.locator('.dock-highlight')).to_be_visible()
            nav = page.locator('#navigation')
            link = nav.locator('[data-view="components"]')
            expect(link).to_have_attribute('aria-current', 'page')
            following = link.evaluate('node => node.nextElementSibling.dataset.view')
            link.evaluate('node => { window.componentNav = node; node.focus(); }')
            page.keyboard.press('Enter')
            expect(link).to_be_focused()
            assert link.evaluate('node => node === window.componentNav')
            page.keyboard.press('Tab')
            expect(nav.locator(f'[data-view="{following}"]')).to_be_focused()

            if not readonly:
                home = nav.locator('[data-view="home"]')
                home.focus()
                page.keyboard.press('Enter')
                expect(home).to_have_attribute('aria-current', 'page')
                expect(home).to_be_focused()
                expect(link).not_to_have_attribute('aria-current', 'page')
                link.focus()
                page.keyboard.press('Enter')
                expect(link).to_have_attribute('aria-current', 'page')
                expect(link).to_be_focused()
                assert link.evaluate('node => node === window.componentNav')
                if width == 1440:
                    page.wait_for_function("""() => {
                      const active = document.querySelector('#navigation [aria-current="page"]');
                      const highlight = document.querySelector('.sidebar-highlight');
                      return active && Math.abs(active.getBoundingClientRect().top - highlight.getBoundingClientRect().top) < 1;
                    }""")
        finally:
            page.close()


def check_compact_dock_targets(page):
    dock = page.locator('.action-dock')
    expect(dock.locator('[data-dock]')).to_have_count(4)
    layout = dock.evaluate("""dock => {
      const {left, right} = dock.getBoundingClientRect();
      return {scroll: [dock.scrollLeft, dock.scrollWidth - dock.clientWidth],
        targets: [...dock.querySelectorAll('[data-dock]')].map(button => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return { id: button.dataset.dock, width: box.width, height: box.height,
            inside: box.left >= left && box.right <= right,
            hit: hit === button || button.contains(hit), name: button.getAttribute('aria-label') };
        })};
    }""")
    assert layout['scroll'] == [0, 0], layout
    for target in layout['targets']:
        assert target['hit'] and target['inside'] and target['width'] >= 36 and target['height'] >= 44 and target['name'], layout


def check_compact_dock_actions(browser, origin, path, readonly):
    for width in (320, 390, 430, 480):
        page = browser_page(browser, origin, width, 900)
        try:
            page.goto(origin + path, wait_until='domcontentloaded')
            dock = page.locator('.action-dock')
            expect(dock.locator('.dock-highlight')).to_be_attached()

            def active(action):
                selected = dock.locator(':is([aria-pressed="true"], [data-selected="true"])')
                expect(selected).to_have_count(1)
                expect(selected).to_have_attribute('data-dock', action)

            def tap(action):
                button = dock.locator(f'[data-dock="{action}"]')
                box = button.bounding_box()
                page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)

            check_compact_dock_targets(page)
            active('components')
            tap('search')
            search = page.locator('#component-search')
            expect(search).to_be_focused()
            active('search')
            search.press('Escape')
            active('components')
            page.keyboard.press('Control+k')
            expect(search).to_be_focused()
            active('search')
            search.press('Escape')
            active('components')

            if readonly:
                tap('mcp')
                expect(page.get_by_role('heading', name='Ilia Cache MCP', exact=True)).to_be_visible()
                expect(dock.locator('.dock-highlight')).to_be_attached()
                active('mcp')
                check_compact_dock_targets(page)
                tap('switches')
                expect(page.get_by_role('heading', name='UI Switches', exact=True)).to_be_visible()
                expect(dock.locator('.dock-highlight')).to_be_attached()
                active('switches')
            else:
                capture = page.locator('#capture-dialog')
                cart = page.locator('.sidebar #project-cart')
                cart.tap()
                project_picker = page.locator('#project-dialog')
                expect(project_picker.get_by_role('heading', name='项目待选')).to_be_visible()
                project_picker.get_by_role('button', name='关闭待选区').tap()
                expect(project_picker).to_be_hidden()
                history_length = page.evaluate('history.length')
                tap('capture')
                expect(capture).to_be_visible()
                active('capture')
                page.keyboard.press('Escape')
                expect(capture).to_be_hidden()
                active('components')
                page.keyboard.press('Control+j')
                expect(capture).to_be_visible()
                active('capture')
                capture.get_by_role('button', name='关闭', exact=True).click()
                expect(capture).to_be_hidden()
                active('components')
                assert page.evaluate('history.length') == history_length
                tap('learn')
                expect(page).to_have_url(origin + '/#/learning')
                active('learn')
                page.go_back(wait_until='commit')
                active('components')
                page.go_forward(wait_until='commit')
                active('learn')
            tap('components')
            expect(search).to_be_visible()
            active('components')
            check_compact_dock_targets(page)
            if not readonly:
                page.locator('.sidebar #project-cart').focus()
            page.set_viewport_size({'width': 481, 'height': 900})
            label = dock.locator('[data-dock="components"] > span')
            expect(label).to_have_css('visibility', 'visible')
            assert label.bounding_box()['width'] > 20, 'The active label should expand after resizing'
            if not readonly:
                expect(page.locator('.topbar #project-cart')).to_be_focused()
            assert dock.evaluate('node => node.scrollWidth === node.clientWidth')
        finally:
            page.close()


def check_dock_spring(browser, origin, path):
    page = browser_page(browser, origin, 1440, 900, reduced_motion='no-preference')
    try:
        page.goto(origin + path, wait_until='domcontentloaded')
        expect(page.locator('.dock-highlight')).to_be_visible()
        page.wait_for_function("""() => {
          const selected = document.querySelector('.action-dock [data-dock="components"]');
          const highlight = document.querySelector('.dock-highlight');
          return highlight && Math.abs(highlight.getBoundingClientRect().x - selected.getBoundingClientRect().x) < 0.5;
        }""")
        result = page.evaluate("""async () => {
          const highlight = document.querySelector('.dock-highlight');
          const search = document.querySelector('.action-dock [data-dock="search"]');
          const x = node => node.getBoundingClientRect().x;
          const samples = [x(highlight)];
          search.click();
          for (let settled = 0; samples.length < 120 && settled < 3;) {
            await new Promise(requestAnimationFrame);
            samples.push(x(highlight));
            settled = Math.abs(samples.at(-1) - x(search)) < 0.5 ? settled + 1 : 0;
          }
          return {samples, end: x(search)};
        }""")
        samples, end = result['samples'], result['end']
        assert abs(samples[0] - end) >= 30 and abs(samples[-1] - end) < 0.5, result
        start = samples[0]
        assert len({round(x) for x in samples if end + 1 < x < start - 1}) >= 3, result
    finally:
        page.close()


def check_theme_before_directory(browser, origin, gallery_path, readonly):
    context = browser.new_context(viewport={'width': 390, 'height': 900}, is_mobile=True, has_touch=True,
                                  reduced_motion='reduce')
    restrict_requests(context, origin)
    controller = context.new_page()
    waiting = context.new_page()
    try:
        controller.goto(origin + gallery_path, wait_until='domcontentloaded')
        settings = controller.locator('#stack-settings')
        expect(settings).to_be_visible()
        pending = []
        seed = SEED_ROUTE if readonly else '**/seed.json'
        waiting.route(seed, lambda route: pending.append(route))
        with waiting.expect_request(seed):
            waiting.goto(origin + gallery_path, wait_until='commit')
        root = waiting.locator('html')
        expect(root).to_have_attribute('data-theme', 'dark')
        if readonly:
            expect(waiting.locator('#ilia-ssr .component-thumb').first).to_be_visible()
        expect(waiting.locator('#theme-controls iframe')).to_have_count(0)

        settings.click()
        controller.locator('[data-stack="theme"]').click()
        controller.locator('[data-theme-choice="light"]').click()
        expect(root).to_have_attribute('data-theme', 'light')
        assert len(pending) == 1
        expect(waiting.locator('#theme-controls iframe')).to_have_count(0)
        pending.pop().continue_()
        expect(waiting.frame_locator('#theme-controls iframe').get_by_role('switch')).to_have_attribute('aria-checked', 'true')
        expect(root).to_have_attribute('data-theme', 'light')
    finally:
        context.close()


def check_cached_directory_theme(browser, website):
    page = browser_page(browser, website, 1440, 900)
    try:
        page.add_init_script("""if (window === window.top) {
          addEventListener('pageshow', event => {
            if (!event.persisted) return;
            requestAnimationFrame(() => {
              window.restoredTheme = {
                theme: document.documentElement.dataset.theme,
                background: getComputedStyle(document.body).backgroundColor,
              };
            });
          });
          addEventListener('message', event => {
            const cord = document.querySelector('#theme-controls iframe');
            if (event.source === cord?.contentWindow && event.data?.type === 'test:cord-theme') {
              window.restoredCordTheme = event.data.checked;
            }
          });
        } else if (location.pathname.endsWith('/motion/pull-cord.html')) {
          // The browser can preserve the sandboxed frame while Playwright loses its frame handle.
          addEventListener('message', event => {
            if (event.source !== parent || event.data?.type !== 'motion:theme') return;
            requestAnimationFrame(() => parent.postMessage({
              type: 'test:cord-theme', checked: document.getElementById('grab')?.getAttribute('aria-checked'),
            }, '*'));
          });
        }""")
        gallery = website + '/zh/components?q=motion-prompt-001'
        page.goto(gallery, wait_until='domcontentloaded')
        search = page.locator('#component-search')
        expect(search).to_have_value(COMPONENT_ID)
        expect(page.frame_locator('#theme-controls iframe').get_by_role('switch')).to_have_attribute('aria-checked', 'false')
        dark_background = page.locator('body').evaluate('node => getComputedStyle(node).backgroundColor')
        page.locator('#navigation [data-view="switches"]').click()
        expect(page).to_have_url(website + '/zh/switches')
        page.locator('#stack-settings').click()
        page.locator('[data-stack="theme"]').click()
        page.locator('[data-theme-choice="light"]').click()
        page.locator('#stack-close').click()
        expect(page.locator('html')).to_have_attribute('data-theme', 'light')

        page.go_back(wait_until='commit')
        expect(page).to_have_url(gallery)
        page.wait_for_function("window.restoredTheme !== undefined")
        restored = page.evaluate('window.restoredTheme')
        assert restored['theme'] == 'light' and restored['background'] != dark_background, restored
        expect(search).to_have_value(COMPONENT_ID)
        page.wait_for_function("window.restoredCordTheme === 'true'")
    finally:
        page.close()


def check_workspace_theme(browser, origin, gallery_path, detail_path, width):
    mobile = width < 500
    context = browser.new_context(viewport={"width": width, "height": 900}, is_mobile=mobile, has_touch=mobile)
    restrict_requests(context, origin)
    page = context.new_page()
    root = page.locator("html")
    try:
        page.add_init_script("""if (window === window.top && !localStorage.getItem('ilia-design-theme')) {
          localStorage.setItem('ilia-design-theme', 'system');
        }""")
        page.goto(origin + gallery_path, wait_until="domcontentloaded")
        cord = page.locator(".topbar > #theme-controls iframe")
        frame = cord.content_frame
        grab = frame.get_by_role("switch")
        expect(root).to_have_attribute("data-theme", "dark")
        expect(grab).to_have_attribute("aria-checked", "false")
        expect(grab).to_have_css("transform", re.compile(r"^matrix\("))
        # Take coordinates after the spring has settled, before pressing the bead.
        grab.evaluate("""async node => {
          let last = NaN, stable = 0;
          for (let frame = 0; frame < 60 && stable < 3; frame++) {
            await new Promise(requestAnimationFrame);
            const y = node.getBoundingClientRect().y;
            stable = Math.abs(y - last) < 0.15 ? stable + 1 : 0;
            last = y;
          }
        }""")
        outer = cord.bounding_box()
        dimensions = cord.evaluate("node => [node.clientWidth, node.clientHeight]")
        bead = frame.locator(".theme-dark .bead").evaluate("node => node.getBoundingClientRect().toJSON()")
        x = outer["x"] + (bead["x"] + bead["width"] / 2) * outer["width"] / dimensions[0]
        y = outer["y"] + (bead["y"] + bead["height"] / 2) * outer["height"] / dimensions[1]
        if mobile:
            session = page.context.new_cdp_session(page)
            session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
            expect(grab).to_have_class(re.compile(r"\bis-held\b"))
            session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + 2, "y": y + 2, "id": 1}]})
            expect(root).to_have_attribute("data-theme", "dark")
            session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + 4, "y": y + 25, "id": 1}]})
        else:
            page.mouse.move(x, y)
            page.mouse.down()
            expect(grab).to_have_class(re.compile(r"\bis-held\b"))
            page.mouse.move(x, y + 3, steps=3)
            expect(root).to_have_attribute("data-theme", "dark")
            page.mouse.move(x + 4, y + 25, steps=8)
        expect(root).to_have_attribute("data-theme", "light")
        if mobile:
            session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        else:
            page.mouse.up()
        expect(grab).not_to_have_class(re.compile(r"\bis-held\b"))
        expect(grab).to_have_attribute("aria-checked", "true")
        grab.press("Enter")
        expect(root).to_have_attribute("data-theme", "dark")
        page.reload(wait_until="domcontentloaded")
        expect(root).to_have_attribute("data-theme", "dark")
        if mobile:
            return

        page.emulate_media(reduced_motion="reduce")
        page.locator("#stack-settings").click()
        page.locator('[data-stack="theme"]').click()
        stack = page.locator("#settings-stack")
        assert stack.evaluate("node => !node.getAnimations({subtree:true}).some(a => a.effect.target?.matches('.stack-content'))")
        light = stack.locator('[data-theme-choice="light"]')
        dark = stack.locator('[data-theme-choice="dark"]')
        expect(dark).to_have_attribute("aria-pressed", "true")
        page.evaluate("""() => {
          window.iliaCordNotices = 0;
          const cord = document.querySelector('.cord-window iframe');
          addEventListener('message', event => {
            if (event.source === cord.contentWindow && event.data?.type === 'ilia:theme') window.iliaCordNotices++;
          });
        }""")
        light.click()
        expect(light).to_be_focused()
        expect(grab).to_have_attribute("aria-checked", "true")
        dark.click()
        expect(grab).to_have_attribute("aria-checked", "false")
        page.wait_for_timeout(650)
        expect(root).to_have_attribute("data-theme", "dark")
        assert page.evaluate("window.iliaCordNotices") == 0

        detail = context.new_page()
        try:
            detail.emulate_media(color_scheme="light", reduced_motion="reduce")
            detail.goto(origin + detail_path + COMPONENT_ID, wait_until="domcontentloaded")
            player = detail.frame_locator("#component-dialog iframe")
            expect(player.locator("html")).to_have_attribute("data-theme", "dark")
            assert player.locator("html").evaluate("node => getComputedStyle(node).colorScheme") == "dark"
            canvas = player.locator("canvas")
            expect(player.get_by_role("button", name="播放")).to_be_enabled()
            still = canvas.evaluate("node => node.toDataURL()")
            light.click()
            expect(light).to_have_attribute("aria-pressed", "true")
            expect(detail.locator("html")).to_have_attribute("data-theme", "light")
            expect(player.locator("html")).to_have_attribute("data-theme", "light")
            assert player.locator("html").evaluate("node => getComputedStyle(node).colorScheme") == "light"
            assert canvas.evaluate("node => node.toDataURL()") == still
            detail.reload(wait_until="domcontentloaded")
            expect(detail.locator("html")).to_have_attribute("data-theme", "light")
            expect(player.locator("html")).to_have_attribute("data-theme", "light")
            detail.emulate_media(reduced_motion="no-preference")
            serve_test_preview(detail)
            detail.goto(origin + detail_path + VIDEO_ID, wait_until="domcontentloaded")
            video = detail.locator("#component-dialog video")
            expect(video).to_have_attribute("autoplay", "")
            detail.emulate_media(reduced_motion="reduce")
            expect(video).not_to_have_attribute("autoplay", "")
            assert video.evaluate("node => node.paused && node.controls")
        finally:
            detail.close()
    finally:
        context.close()


def check_reference_panel(browser, origin, detail_prefix, width, screenshots, host):
    page = browser_page(browser, origin, width, 900)
    try:
        serve_test_preview(page)
        page.goto(origin + detail_prefix + VIDEO_ID, wait_until="domcontentloaded")
        modal = page.get_by_role("dialog", name="极光背景")
        tabs = modal.get_by_role("tablist", name="组件详情")
        preview = tabs.get_by_role("tab", name="预览")
        references = tabs.get_by_role("tab", name="参考素材")
        preview.focus()
        page.keyboard.press("ArrowRight")
        expect(references).to_be_focused()
        expect(preview).to_have_attribute("aria-selected", "true")
        page.keyboard.press("Enter")
        expect(references).to_be_focused()
        expect(references).to_have_attribute("aria-selected", "true")
        panel = modal.get_by_role("tabpanel", name="参考素材")
        shared = panel.get_by_role("region", name="来源与参考素材")
        expect(shared.get_by_role("link", name="打开组件来源 ↗")).to_have_attribute(
            "href", "https://reactbits.dev/backgrounds/aurora"
        )
        expect(shared.get_by_text("David Haz", exact=True)).to_be_visible()
        expect(shared.locator("video")).to_have_attribute("src", VIDEO_URL)
        page.wait_for_function("document.querySelector('.component-reference-media video')?.readyState >= 1")
        expect(panel.get_by_role("region", name="本机素材候选")).to_have_count(1 if host == "oss" else 0)
        expect(modal.locator(".component-manage")).to_have_count(1 if host == "oss" else 0)
        if host == "oss":
            manage = modal.locator('summary[aria-label="更多操作"]')
            manage.click()
            expect(modal.get_by_role("button", name="编辑信息")).to_be_visible()
            manage.click()
        if screenshots and width in (1440, 390):
            modal.screenshot(path=screenshots / f"ilia-{host}-reference-{width}.png")
        boxes = modal.evaluate("""dialog => {
          const { x, y } = dialog.getBoundingClientRect();
          return ['.component-detail-heading', '.component-shared-actions', '.detail-tabs',
            '.component-references a', '.component-provenance', '.component-reference-media video'].map(selector => {
            const rect = dialog.querySelector(selector).getBoundingClientRect();
            return [rect.x - x, rect.y - y, rect.width, rect.height].map(Math.round);
          });
        }""")
        references.focus()
        page.keyboard.press("End")
        expect(tabs.get_by_role("tab", name="提示词")).to_be_focused()
        expect(references).to_have_attribute("aria-selected", "true")
        page.keyboard.press("Space")
        expect(modal.get_by_role("tabpanel", name="提示词")).to_be_visible()
        return boxes
    finally:
        page.close()


def check_workspace_copy(browser, origin, detail_path, width):
    page = browser_page(browser, origin, width, 620)
    try:
        page.add_init_script("""(() => {
          window.copyFixture = { mode: 'modern', attempts: [], successes: 0 };
          const fixture = window.copyFixture;
          Object.defineProperty(navigator, 'clipboard', {value: {async writeText(text) {
            fixture.attempts.push(['modern', text]);
            if (fixture.mode !== 'modern') throw new DOMException('Denied', 'NotAllowedError');
          }}});
          document.execCommand = action => {
            const field = document.activeElement;
            fixture.attempts.push(['legacy', field.value?.slice(field.selectionStart, field.selectionEnd)]);
            return action === 'copy' && fixture.mode === 'legacy';
          };
          document.addEventListener('ilia:copied', () => fixture.successes++);
        })();""")
        page.goto(origin + detail_path + COMPONENT_ID, wait_until='domcontentloaded')
        detail = page.locator('#component-dialog')
        agent = detail.get_by_role('button', name='复制给 Agent')
        manual = page.get_by_role('dialog', name='复制内容')

        agent.press('Enter')
        page.wait_for_function('window.copyFixture.successes === 1')
        payload = page.evaluate('window.copyFixture.attempts[0][1]')
        assert 'motion-prompt-001' in payload
        expect(manual).to_have_count(0)

        page.evaluate("window.copyFixture.mode = 'legacy'")
        agent.press('Enter')
        page.wait_for_function('window.copyFixture.successes === 2')
        assert page.evaluate('window.copyFixture.attempts.slice(-2)') == [['modern', payload], ['legacy', payload]]
        expect(agent).to_be_focused()
        expect(manual).to_have_count(0)

        page.evaluate("window.copyFixture.mode = 'denied'")

        def open_manual(trigger, value):
            trigger.press('Enter')
            field = manual.get_by_role('textbox', name='待复制文本')
            expect(field).to_be_focused()
            expect(field).to_have_value(value)
            assert field.evaluate('node => node.readOnly && node.selectionStart === 0 && node.selectionEnd === node.value.length')
            assert page.evaluate('window.copyFixture.successes') == 2

        open_manual(agent, payload)
        box = manual.bounding_box()
        assert box['x'] > 0 and box['x'] + box['width'] < width, box
        page.keyboard.press('Escape')
        expect(manual).to_have_count(0)
        expect(agent).to_be_focused()
        expect(detail).to_be_visible()

        detail.get_by_role('tab', name='提示词').click()
        prompt = detail.get_by_role('textbox', name='提示词原文').input_value()
        assert prompt
        prompt_button = detail.get_by_role('button', name='复制提示词')
        open_manual(prompt_button, prompt)
        manual.get_by_role('button', name='关闭').click()
        expect(manual).to_have_count(0)
        expect(prompt_button).to_be_focused()

        detail.get_by_role('tab', name='源码').click()
        source = detail.locator('.source-code')
        expect(source).to_be_visible()
        source_button = detail.get_by_role('button', name='复制当前文件')
        open_manual(source_button, source.text_content())
        page.keyboard.press('Escape')
        expect(manual).to_have_count(0)
        expect(source_button).to_be_focused()
        return [round(box[prop]) for prop in ('x', 'y', 'width', 'height')]
    finally:
        page.close()


def check_prompt_draft(browser, origin):
    page = browser_page(browser, origin, 320, 900)
    try:
        waiting = []
        package_route = f"**/api/component-package?id={DRAFT_ID}"
        page.route(package_route, lambda route: waiting.append(route))
        with page.expect_request(package_route):
            page.goto(origin + "/#/components/" + DRAFT_ID, wait_until="domcontentloaded")
        dialog = page.locator("#component-dialog")
        dialog.get_by_role("tab", name="提示词").click()
        prompt = dialog.locator("#saved-component-prompt")
        draft = "未保存的提示词草稿"
        prompt.fill(draft)
        assert len(waiting) == 1, "The source package request was not held"
        with page.expect_response(package_route) as response:
            waiting[0].continue_()
        assert response.value.ok
        expect(prompt).to_be_focused()
        expect(prompt).to_have_value(draft)
        dialog.get_by_role("tab", name="源码").click()
        expect(dialog.locator(".source-files button").first).to_be_visible()
        dialog.get_by_role("tab", name="提示词").click()
        expect(prompt).to_have_value(draft)
        heights = dialog.get_by_role("tab").evaluate_all("nodes => nodes.map(node => node.getBoundingClientRect().height)")
        assert len(heights) == 4 and len(set(heights)) == 1 and heights[0] < 48, heights
    finally:
        page.close()


def check_source_file_reader(browser, origin, detail_path, width):
    page = browser_page(browser, origin, width, 780)
    try:
        page.add_init_script("""Object.defineProperty(navigator, 'clipboard', {
          value: { async writeText(text) { window.copiedSourceFile = text; } },
        });""")
        page.goto(origin + detail_path + COMPONENT_ID, wait_until='domcontentloaded')
        dialog = page.locator('#component-dialog')
        source = dialog.get_by_role('tab', name='源码')
        source.click()
        files = dialog.get_by_role('group', name='源码文件')
        original = files.get_by_role('button', name=f'{COMPONENT_ID}.txt', exact=True)
        license_file = files.get_by_role('button', name='LICENSE', exact=True)
        code = dialog.locator('.source-code')
        expect(original).to_have_attribute('aria-pressed', 'true')
        expect(code).to_have_attribute('aria-label', f'{COMPONENT_ID}.txt 源码')
        initial = code.evaluate('node => { node.scrollLeft = 160; node.scrollTop = 120; return [node.scrollLeft, node.scrollTop]; }')
        assert initial[0] > 0 and initial[1] > 0, (width, initial)

        license_file.press('Enter')
        expect(license_file).to_be_focused()
        expect(license_file).to_have_attribute('aria-pressed', 'true')
        expect(original).to_have_attribute('aria-pressed', 'false')
        expect(code).to_have_attribute('aria-label', 'LICENSE 源码')
        assert code.evaluate('node => [node.scrollLeft, node.scrollTop]') == [0, 0]
        expect(code).to_contain_text('MIT License')

        copy = dialog.get_by_role('button', name='复制当前文件')
        copy.press('Enter')
        assert page.evaluate('window.copiedSourceFile') == code.text_content()
        page.keyboard.press('Tab')
        expect(dialog.get_by_role('region', name='LICENSE 源码')).to_be_focused()
        assert page.evaluate('document.documentElement.scrollWidth') == width
        return round(code.bounding_box()['width'])
    finally:
        page.close()


def check_source_package_lifecycle(browser, origin, gallery_path, readonly):
    page = browser_page(browser, origin, 390, 900)
    other_id = "motion-prompt-002"

    def package_path(record):
        return (f"**/ilia-ui/packages/{record}.json*" if readonly
                else f"**/api/component-package?id={record}")

    def card(record):
        return page.locator(f'.component-thumb[data-open-component="{record}"]')

    try:
        first_path = package_path(COMPONENT_ID)
        other_path = package_path(other_id)
        held = []
        page.route(first_path, lambda route: held.append(route))
        page.route(other_path, lambda route: route.fulfill(status=503), times=1)
        page.goto(origin + gallery_path, wait_until="domcontentloaded")
        page.locator('[data-source-filter="Motion Prompt"]').click()
        gallery_url = page.url
        dialog = page.locator("#component-dialog")
        source = dialog.get_by_role("tab", name="源码")
        close = dialog.get_by_role("button", name="关闭组件详情")
        copy_agent = dialog.get_by_role("button", name="复制给 Agent")

        with page.expect_request(first_path):
            card(COMPONENT_ID).click()
        source.click()
        expect(dialog.get_by_role("status")).to_have_text("正在加载源码…")
        expect(copy_agent).to_be_disabled()
        close.click()
        expect(page).to_have_url(gallery_url)
        expect(dialog).not_to_be_visible()
        card(COMPONENT_ID).click()
        source.click()
        expect(dialog.get_by_role("status")).to_have_text("正在加载源码…")
        assert len(held) == 1, "Reopening the same component issued a second package request"

        close.click()
        expect(page).to_have_url(gallery_url)
        expect(dialog).not_to_be_visible()
        card(other_id).click()
        source.click()
        retry = dialog.get_by_role("button", name="重试加载源码")
        expect(retry).to_be_visible()
        retry.focus()
        with page.expect_response(first_path) as response:
            held[0].continue_()
        assert response.value.ok
        expect(retry).to_be_focused()
        expect(dialog.get_by_role("button", name=f"{COMPONENT_ID}.txt")).to_have_count(0)

        with page.expect_response(other_path) as response:
            retry.click()
        assert response.value.ok
        expect(dialog.get_by_role("button", name=f"{other_id}.txt")).to_be_visible()
        expect(copy_agent).to_be_enabled()
        close.click()
        expect(page).to_have_url(gallery_url)
        expect(dialog).not_to_be_visible()
        card(COMPONENT_ID).click()
        source.click()
        expect(dialog.get_by_role("button", name=f"{COMPONENT_ID}.txt")).to_be_visible()
        assert len(held) == 1, "Reopening a loaded component missed the cache"
    finally:
        page.close()


def check_component_detail_tab_links(browser, origin, gallery_path, readonly):
    page = browser_page(browser, origin, 390, 900)
    try:
        page.goto(origin + gallery_path, wait_until='domcontentloaded')
        search = page.locator('#component-search')
        search.fill(COMPONENT_ID)
        card = page.locator(f'.component-thumb[data-open-component="{COMPONENT_ID}"]')
        expect(card).to_be_visible()
        if readonly:
            page.wait_for_function(f"new URLSearchParams(location.search).get('q') === '{COMPONENT_ID}'")
        gallery = page.url
        card.click()
        dialog = page.locator('#component-dialog')
        expect(dialog).to_be_visible()
        canonical = page.locator('link[rel="canonical"]')
        if readonly:
            component_canonical = re.compile(r'/components/' + COMPONENT_ID + '$')
            expect(canonical).to_have_attribute('href', component_canonical)
            expect(page.locator('meta[property="og:url"]')).to_have_attribute('content', component_canonical)
        history_length = page.evaluate('history.length')
        dialog.get_by_role('tab', name='参考素材').click()
        references = page.url
        assert 'tab=references' in references
        assert page.evaluate('history.length') == history_length
        if readonly:
            expect(canonical).to_have_attribute('href', component_canonical)
        panel = dialog.get_by_role('tabpanel', name='参考素材')
        expect(panel.get_by_text('Shohei Ohtaki')).to_be_visible()

        page.reload(wait_until='domcontentloaded')
        expect(page).to_have_url(references)
        expect(panel).to_be_visible()
        page.go_back(wait_until='commit')
        expect(page).to_have_url(gallery)
        expect(dialog).not_to_be_visible()
        expect(search).to_have_value(COMPONENT_ID)
        if readonly:
            expect(canonical).to_have_attribute('href', re.compile(r'^https?://[^/]+/$'))
        page.go_forward(wait_until='commit')
        expect(page).to_have_url(references)
        expect(panel).to_be_visible()
        if readonly:
            expect(canonical).to_have_attribute('href', component_canonical)

        dialog.get_by_role('tab', name='源码').click()
        source = page.url
        assert 'tab=source' in source
        page.reload(wait_until='domcontentloaded')
        expect(dialog.get_by_role('tabpanel', name='源码').get_by_role('button', name='LICENSE')).to_be_visible()
        dialog.get_by_role('tab', name='预览', exact=True).click()
        assert 'tab=' not in page.url
        if readonly:
            assert parse_qs(urlsplit(page.url).query) == {'q': [COMPONENT_ID]}
        else:
            restricted = origin + '/#/components/' + VIDEO_ID
            page.goto(restricted + '?tab=references', wait_until='commit')
            expect(panel).to_be_visible()
            page.goto(restricted + '?tab=source', wait_until='commit')
            expect(dialog.get_by_role('tabpanel', name='预览')).to_be_visible()
            expect(dialog.get_by_role('tab', name='源码')).to_have_count(0)
    finally:
        page.close()


def check_website_detail_tab_fallback(browser, website):
    context = browser.new_context(java_script_enabled=False, viewport={'width': 320, 'height': 900})
    restrict_requests(context, website)
    page = context.new_page()
    try:
        base = website + '/zh/components/' + COMPONENT_ID
        page.goto(website + '/zh?component=' + COMPONENT_ID + '&q=demo&tab=references', wait_until='domcontentloaded')
        assert urlsplit(page.url).path == urlsplit(base).path
        assert parse_qs(urlsplit(page.url).query) == {'q': ['demo'], 'tab': ['references']}
        fallback = page.locator('#ilia-ssr')
        expect(fallback.get_by_role('link', name='参考素材')).to_have_attribute('aria-current', 'page')
        expect(fallback.get_by_role('region', name='来源与参考素材').get_by_text('Shohei Ohtaki')).to_be_visible()
        expect(page.locator('link[rel="canonical"]')).to_have_attribute('href', re.compile(r'/components/' + COMPONENT_ID + '$'))
        fallback.get_by_role('link', name='提示词').click()
        expect(page).to_have_url(base + '?q=demo&tab=prompt')
        expect(fallback.get_by_role('textbox', name='提示词原文')).not_to_have_value('')
        fallback.get_by_role('link', name='源码', exact=True).click()
        expect(page).to_have_url(base + '?q=demo&tab=source')
        expect(fallback.get_by_role('link', name='下载公开源码 JSON')).to_have_attribute(
            'href', re.compile(rf'^/ilia-ui/packages/{COMPONENT_ID}\.json\?v=[a-f0-9]{{64}}$')
        )
        expect(fallback.get_by_role('listitem').filter(has_text='LICENSE')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth') == 320
    finally:
        context.close()

    page = browser_page(browser, website, 390, 900)
    try:
        held = []
        runtime = RUNTIME_ROUTE
        page.route(runtime, lambda route: held.append(route))
        with page.expect_request(runtime):
            page.goto(website + f'/components/{VIDEO_ID}?tab=source', wait_until='commit')
        fallback = page.locator('#ilia-ssr')
        expect(fallback.get_by_role('link', name='预览', exact=True)).to_have_attribute('aria-current', 'page')
        expect(fallback.get_by_role('link', name='源码', exact=True)).to_have_count(0)
        prompt_tab = fallback.get_by_role('link', name='提示词', exact=True)
        prompt_tab.focus()
        held.pop().continue_()
        dialog = page.locator('#component-dialog')
        expect(dialog.get_by_role('tabpanel', name='预览')).to_be_visible()
        expect(dialog.get_by_role('tab', name='提示词')).to_be_focused()
        expect(dialog.get_by_role('tab', name='源码')).to_have_count(0)
    finally:
        page.close()


def check_source_and_reference_handoff(browser, website):
    for width in (320, 390, 1440):
        for tab in ('source', 'references'):
            page = browser_page(browser, website, width, 900)
            try:
                runtime = RUNTIME_ROUTE
                package = f'**/ilia-ui/packages/{COMPONENT_ID}.json*'
                held_runtime, held_package = [], []
                page.route(runtime, lambda route: held_runtime.append(route))
                page.route(package, lambda route: held_package.append(route))
                with page.expect_request(runtime):
                    page.goto(website + '/zh/components/' + COMPONENT_ID + '?tab=' + tab, wait_until='commit')
                fallback = page.locator('#ilia-ssr')
                selector = '[data-source-download]' if tab == 'source' else '[data-reference-origin]'
                initial = fallback.locator(selector)
                expect(initial).to_be_visible()
                href = initial.get_attribute('href')
                initial.focus()
                first = fallback.locator('.component-detail-panel').bounding_box()
                with page.expect_request(package):
                    held_runtime.pop().continue_()
                dialog = page.locator('#component-dialog')
                control = dialog.locator(selector)
                expect(control).to_be_focused()
                expect(control).to_have_attribute('href', href)
                after = dialog.bounding_box()
                assert all(abs(first[prop] - after[prop]) <= 1 for prop in ('x', 'y', 'width', 'height')), (width, tab, first, after)
                if tab == 'source':
                    expect(dialog.get_by_role('listitem').filter(has_text='LICENSE')).to_be_visible()
                    expect(dialog.get_by_role('status')).to_have_text('正在加载源码…')
                    control.evaluate('link => { window.activeSourceDownload = link; }')
                    with page.expect_response(package) as response:
                        held_package.pop().continue_()
                    assert response.value.ok
                    expect(dialog.get_by_role('button', name='LICENSE')).to_be_visible()
                    expect(dialog.get_by_role('button', name='复制当前文件')).to_be_visible()
                    expect(control).to_be_focused()
                    assert control.evaluate('link => link === window.activeSourceDownload')
                    expect(control).to_have_attribute('download', '')
                else:
                    held_package.pop().continue_()
                    expect(dialog.locator('[data-component-origin]')).not_to_be_focused()
            finally:
                page.close()


def check_detail_bootstrap(browser, website):
    scenarios = (
        ('ready', 'Pop-in', True),
        ('failed', 'Pop-in', True),
        ('failed', 'motion-prompt-049', False),
        ('pending', 'Pop-in', True),
        ('pending', 'motion-prompt-049', False),
    )
    for state, query, shows_component in scenarios:
        page = browser_page(browser, website, 390, 900)
        try:
            held = []
            if state == 'failed':
                page.route(SEED_ROUTE, lambda route: route.fulfill(status=503, body='Unavailable'))
            else:
                page.route(SEED_ROUTE, lambda route: held.append(route))
            filters = '?' + urlencode({'q': query, 'source': 'Motion Prompt'})
            gallery = website + '/zh/components' + filters
            detail = website + '/zh/components/' + COMPONENT_ID + filters
            with page.expect_request(SEED_ROUTE):
                page.goto(detail, wait_until='commit')
            dialog = page.locator('#component-dialog')
            live = page.locator('#component-library')
            close = dialog.get_by_role('button', name='关闭组件详情')
            expect(dialog.locator('.component-motion-preview[data-motion-state="ready"]')).to_be_visible()
            expect(live).to_be_hidden()
            if shows_component and state != 'pending':
                payload = page.locator('#ilia-detail-data').evaluate(
                    'script => ({data: JSON.parse(script.textContent), length: script.textContent.length})')
                assert payload['data']['record']['id'] == COMPONENT_ID
                assert 'resources' not in payload['data'] and payload['length'] < 12000

                dialog.get_by_role('tab', name='参考素材').click()
                expect(dialog.get_by_text('Shohei Ohtaki')).to_be_visible()
                dialog.get_by_role('tab', name='源码').click()
                expect(dialog.get_by_role('button', name='LICENSE')).to_be_visible()
                dialog.get_by_role('tab', name='提示词').click()
                prompt = dialog.get_by_role('textbox', name='提示词原文')
                expect(prompt).not_to_have_value('')
                expect(dialog.get_by_role('button', name='复制提示词')).to_be_visible()
                prompt.focus()
                prompt.evaluate('node => { window.activePrompt = node; node.setSelectionRange(0, 5); }')

            history_size = page.evaluate('history.length')
            if state == 'ready':
                assert len(held) == 1
                held.pop().continue_()
                expect(live.locator('.component-tile').nth(1)).to_be_attached()
                assert prompt.evaluate('node => node === window.activePrompt && node.selectionEnd === 5')
                expect(prompt).to_be_focused()
                close.press('Enter')
                expect(page).to_have_url(gallery)
                expect(live.locator('#component-search')).to_have_value(query)
                expect(live.locator('[data-source-filter="Motion Prompt"]')).to_have_attribute('aria-pressed', 'true')
                assert page.evaluate('history.length') == history_size
                continue

            if state == 'pending':
                assert len(held) == 1
            with page.expect_request(SEED_ROUTE):
                with page.expect_response(lambda response: response.url == gallery and response.request.resource_type == 'document'):
                    close.press('Enter')
            expect(page).to_have_url(gallery)
            assert page.evaluate('history.length') == history_size
            fallback = page.locator('#ilia-ssr')
            search = fallback.get_by_role('searchbox', name='关键词')
            expect(search).to_have_value(query)
            expect(fallback.get_by_role('radio', name='Motion Prompt', exact=True)).to_be_checked()
            card = fallback.locator(f'[data-component-id="{COMPONENT_ID}"]')
            if shows_component:
                thumbnail = card.locator('.component-thumb')
                expect(thumbnail).to_be_in_viewport(ratio=0.6)
                expect(thumbnail).to_be_focused()
            else:
                expect(card).to_have_count(0)
                expect(search).to_be_focused()

            if state == 'failed':
                expect(fallback.locator('[data-directory-load-status]')).to_contain_text('仍可使用本页的筛选和链接')
                if shows_component:
                    page.keyboard.press('Enter')
                    expect(page).to_have_url(detail)
                    expect(dialog).to_be_visible()
                else:
                    search.evaluate('node => node.setSelectionRange(node.value.length, node.value.length)')
                    page.keyboard.type('x')
                    expect(search).to_have_value(query + 'x')
                    expect(page).to_have_url(gallery)
            else:
                assert len(held) == 2
                detail_seed, gallery_seed = held
                detail_seed.abort()
                if shows_component:
                    page.keyboard.press('Tab')
                    expect(card.locator('.component-title-control')).to_be_focused()
                else:
                    search.evaluate("node => node.setSelectionRange(2, 8, 'forward')")
                gallery_seed.continue_()
                expect(fallback).to_have_count(0)
                expect(page).to_have_url(gallery)
                assert page.evaluate('history.length') == history_size
                live_search = live.locator('#component-search')
                expect(live_search).to_have_value(query)
                expect(live.locator('[data-source-filter="Motion Prompt"]')).to_have_attribute('aria-pressed', 'true')
                if shows_component:
                    title = live.locator(f'.component-title-control[data-open-component="{COMPONENT_ID}"]')
                    expect(title).to_be_focused()
                    page.keyboard.press('Enter')
                    expect(page).to_have_url(detail)
                    expect(dialog).to_be_visible()
                else:
                    expect(live_search).to_be_focused()
                    assert live_search.evaluate('node => [node.selectionStart, node.selectionEnd]') == [2, 8]
        finally:
            page.close()


def check_public_snapshot_revisions(browser, website):
    page = browser_page(browser, website, 390, 900)
    try:
        current = page.request.get(website + '/ilia-ui/seed.json').json()
        expected_revision = current[0]['catalogRevision']
        stale_revision = '0' * 64
        assert expected_revision != stale_revision
        stale = [record for record in current if record['id'] != COMPONENT_ID]
        stale[0] = {**stale[0], 'catalogRevision': stale_revision}
        page.route(SEED_ROUTE, lambda route: route.fulfill(json=stale))

        package_route = f'**/ilia-ui/packages/{COMPONENT_ID}.json*'
        page.route(package_route, lambda route: route.fulfill(json={
            'id': COMPONENT_ID,
            'revision': stale_revision,
            'files': [{'name': 'old-fixture.txt', 'content': 'Previous release fixture'}],
        }), times=1)

        filters = '?q=Pop-in&source=Motion+Prompt'
        gallery = website + '/zh/components' + filters
        detail = website + '/zh/components/' + COMPONENT_ID + filters + '&tab=source'
        with page.expect_response(SEED_ROUTE) as seed, page.expect_response(package_route) as package:
            page.goto(detail, wait_until='commit')
        assert parse_qs(urlsplit(seed.value.url).query) == {'v': [expected_revision]}
        boot = page.locator('#ilia-detail-data').evaluate('node => JSON.parse(node.textContent).record')
        assert boot['sourceRevision'] != stale_revision
        assert parse_qs(urlsplit(package.value.url).query) == {'v': [boot['sourceRevision']]}

        dialog = page.locator('#component-dialog')
        retry = dialog.get_by_role('button', name='重试加载源码')
        expect(retry).to_be_visible()
        download = dialog.get_by_role('link', name='下载公开源码 JSON')
        expect(download).to_have_attribute('href', urlsplit(package.value.url).path + '?' + urlsplit(package.value.url).query)
        download.evaluate('link => { window.retrySourceDownload = link; }')
        expect(dialog.get_by_role('button', name='old-fixture.txt')).to_have_count(0)
        with page.expect_response(package_route) as fresh:
            retry.click()
        assert fresh.value.json()['revision'] == boot['sourceRevision']
        expect(dialog.get_by_role('button', name='LICENSE')).to_be_visible()
        assert download.evaluate('link => link === window.retrySourceDownload')
        expect(page.locator('#component-library')).to_be_hidden()

        dialog.get_by_role('tab', name='提示词').click()
        expect(dialog.get_by_role('textbox', name='提示词原文')).to_have_value(boot['prompt'])
        with page.expect_response(lambda response: response.url == gallery and response.request.resource_type == 'document'):
            dialog.get_by_role('button', name='关闭组件详情').click()
        expect(page).to_have_url(gallery)
        fallback = page.locator('#ilia-ssr')
        expect(fallback.locator('[data-directory-load-status]')).to_contain_text('仍可使用本页的筛选和链接')
        expect(fallback.get_by_role('searchbox', name='关键词')).to_have_value('Pop-in')
        expect(fallback.get_by_role('radio', name='Motion Prompt', exact=True)).to_be_checked()
        expect(fallback.locator(f'a[href*="/components/{COMPONENT_ID}"]').first).to_be_visible()
    finally:
        page.close()


def check_component_document_metadata(browser, origin, gallery_path, readonly):
    page = browser_page(browser, origin, 390, 900)

    def head(current):
        return current.evaluate('''() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content,
          shareTitle: document.querySelector('meta[property="og:title"]')?.content,
          shareDescription: document.querySelector('meta[property="og:description"]')?.content,
          canonical: document.querySelector('link[rel="canonical"]')?.href,
          shareUrl: document.querySelector('meta[property="og:url"]')?.content,
        })''')

    try:
        page.goto(origin + gallery_path, wait_until='domcontentloaded')
        search = page.locator('#component-search')
        expect(search).to_be_attached()
        gallery = head(page)
        search.fill(COMPONENT_ID)
        page.locator(f'.component-thumb[data-open-component="{COMPONENT_ID}"]').click()
        modal = page.locator('#component-dialog')
        expect(modal).to_be_visible()
        detail = head(page)
        assert detail['title'] == 'Pop-in – UI Component | Ilia Cache'
        modal.get_by_role('tab', name='参考素材').click()
        assert head(page) == detail

        if readonly:
            context = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 900})
            restrict_requests(context, origin)
            try:
                direct = context.new_page()
                direct.goto(origin + '/zh/components/' + COMPONENT_ID + '?q=demo&tab=references', wait_until='domcontentloaded')
                assert head(direct) == detail
                assert detail['shareTitle'] == detail['title']
                assert detail['shareDescription'] == detail['description']
                assert detail['shareUrl'] == detail['canonical']
                assert urlsplit(detail['canonical']).path == '/components/' + COMPONENT_ID
                assert urlsplit(detail['canonical']).query == ''
                assert detail['description'] != gallery['description']
            finally:
                context.close()

        page.reload(wait_until='domcontentloaded')
        expect(modal.get_by_role('tabpanel', name='参考素材')).to_be_visible()
        assert head(page) == detail
        page.go_back(wait_until='commit')
        expect(modal).not_to_be_visible()
        expect(search).to_have_value(COMPONENT_ID)
        assert head(page) == gallery
        page.go_forward(wait_until='commit')
        expect(modal.get_by_role('tabpanel', name='参考素材')).to_be_visible()
        assert head(page) == detail

        path = '/components/' if readonly else '/#/components/'
        page.goto(origin + path + COMPONENT_ID + '?tab=references', wait_until='domcontentloaded')
        expect(modal).to_be_visible()
        modal.get_by_role('button', name='关闭组件详情').click()
        expect(modal).not_to_be_visible()
        expect(page).to_have_url(origin + gallery_path)
        assert head(page) == gallery
    finally:
        page.close()


def check_legacy_component_media(browser, origin):
    page = browser_page(browser, origin, 1440, 900)
    page.set_default_timeout(10000)
    host = 'https://example.org'
    video = host + '/legacy.webm?version=2'
    broken_video = host + '/broken.webm'
    poster = host + '/legacy-cover.webp'
    old_path = '/previews/home-reactbits.jpg'
    data_image = 'data:image/webp;base64,' + base64.b64encode(POSTER_FIXTURE.read_bytes()).decode()
    entries = {
        'video': {'media': [{'type': 'image', 'url': host + '/first.webp'}, {'url': video, 'poster': poster}]},
        'broken-video': {'media': [{'type': 'video', 'url': broken_video, 'poster': poster}]},
        'images': {'media': [{'type': 'image', 'url': host + '/' + name + '.webp'}
                             for name in ('logo', 'first', 'second', 'third')]},
        'old-path': {'preview': old_path},
        'old-base64': {'preview': data_image},
        'broken-image': {'media': [{'type': 'image', 'url': host + '/broken.webp'}]},
    }
    records = [dict(id='legacy-fixture-' + key, name='旧格式测试 ' + key, url=host + '/components/' + key,
                    kind='案例', caseType='组件', category='组件', componentCategory='卡片', tags=[], **fields)
               for key, fields in entries.items()]
    ids = [record['id'] for record in records]
    library = dict(version=1, resources=records, lessons=[], componentCart=ids,
                   projects=[dict(id='legacy-project', name='旧收藏测试项目', type='网页', componentIds=ids)])
    requested_videos = []

    def serve_media(route):
        request = route.request.url
        if urlsplit(request).path.endswith('.webm'):
            requested_videos.append(request)
        if request in (broken_video, host + '/broken.webp'):
            route.abort()
        elif request == video:
            route.fulfill(path=VIDEO_FIXTURE, content_type='video/webm')
        else:
            route.fulfill(path=POSTER_FIXTURE, content_type='image/webp')

    def thumb(key):
        return page.locator(f'.component-thumb[data-open-component="legacy-fixture-{key}"]')

    def check_stills(get_thumb):
        expect(get_thumb('images').locator('img')).to_have_count(2)
        expect(get_thumb('images').locator('img').first).to_have_attribute('src', host + '/first.webp')
        expect(get_thumb('old-path').locator('img')).to_have_attribute('src', old_path)
        assert get_thumb('old-base64').locator('img').get_attribute('src') == data_image
        expect(get_thumb('broken-image').locator('.component-preview-error')).to_be_visible()

    try:
        page.route('**/api/library', lambda route: route.fulfill(json=library if route.request.method == 'GET' else {'ok': True}))
        page.route(host + '/**', serve_media)
        page.goto(origin + '/#/components', wait_until='domcontentloaded')
        page.locator('#component-search').fill('旧格式测试')
        check_stills(thumb)
        expect(thumb('video').locator('[data-card-video] img')).to_have_attribute('src', poster)
        thumb('video').hover()
        expect(page.locator('.component-grid video')).to_have_count(0)
        assert not requested_videos

        page.emulate_media(reduced_motion='no-preference')
        page.mouse.move(1, 1)
        thumb('video').hover()
        expect(thumb('video').locator('[data-preview-playing]')).to_be_visible()
        expect(page.locator('.component-grid video')).to_have_count(1)
        thumb('video').press('Enter')
        dialog = page.locator('#component-dialog')
        expect(page.locator('.component-grid video')).to_have_count(0)
        player = dialog.get_by_label('旧格式测试 video', exact=True)
        expect(player).to_be_visible()
        assert player.evaluate('node => node.controls && node.paused && !node.autoplay')
        player.evaluate('node => node.play()')
        page.wait_for_function('document.querySelector("#component-dialog video")?.currentTime > 0.06')
        dialog.get_by_role('button', name='关闭组件详情').click()
        expect(page).to_have_url(origin + '/#/components')
        page.emulate_media(reduced_motion='reduce')

        thumb('broken-video').press('Enter')
        expect(dialog.locator('.component-preview-poster')).to_have_attribute('src', poster)
        expect(dialog.locator('video')).to_have_count(0)
        expect(dialog.locator('[data-component-origin]')).to_have_attribute('href', host + '/components/broken-video')
        dialog.get_by_role('button', name='关闭组件详情').click()
        expect(page).to_have_url(origin + '/#/components')

        page.locator('#navigation [data-view="projects"]').click()
        page.locator('[data-project="legacy-project"]').click()
        def project_thumb(scope, key):
            return page.locator(f'{scope} [data-project-preview="legacy-fixture-{key}"]')
        check_stills(lambda key: project_thumb('#projects-page', key))
        project = project_thumb('#projects-page', 'video')
        expect(project.locator('img')).to_have_attribute('src', poster)
        expect(project.locator('video')).to_have_count(0)
        project.press('Enter')
        expect(player).to_be_visible()
        dialog.get_by_role('button', name='关闭组件详情').click()
        expect(dialog).not_to_be_visible()
        page.locator('#project-pending').click()
        check_stills(lambda key: project_thumb('#project-dialog', key))
        cart = project_thumb('#project-dialog', 'video')
        expect(cart.locator('img')).to_have_attribute('src', poster)
        expect(cart.locator('video')).to_have_count(0)
        cart.press('Enter')
        expect(player).to_be_visible()

        page.goto(origin + '/#/components', wait_until='domcontentloaded')
        if dialog.is_visible():
            page.keyboard.press('Escape')
        page.reload(wait_until='domcontentloaded')
        page.locator('#component-search').fill('旧格式测试')
        check_stills(thumb)
    finally:
        page.close()


def check_local_reference_candidate(browser, origin):
    page = browser_page(browser, origin, 390, 900)
    source = 'https://example.com/components/ilia-reference-demo'
    video = 'https://example.com/media/ilia-reference-demo.webm'
    poster = 'https://example.com/media/ilia-reference-demo.webp'
    try:
        page.route(poster, lambda route: route.fulfill(path=POSTER_FIXTURE, content_type='image/webp'))
        page.route(video, lambda route: route.fulfill(path=VIDEO_FIXTURE, content_type='video/webm'))
        page.goto(origin + '/#/components', wait_until='domcontentloaded')
        page.locator('#add-component').click()
        dialog = page.locator('#component-dialog')
        dialog.get_by_text('粘贴链接', exact=True).click()
        dialog.get_by_role('textbox', name='组件名称').fill('参考素材流程测试组件')
        dialog.get_by_role('textbox', name='原网页链接').fill(source)
        dialog.get_by_role('button', name='保存组件').click()
        expect(page).to_have_url(re.compile(r'/#/components/[a-z0-9-]+$'))
        detail = page.url
        record_id = detail.rsplit('/', 1)[-1]
        response = page.request.post(origin + '/api/component-records', headers={'Origin': origin}, data={
            'action': 'addCandidate', 'id': record_id, 'candidate': {
                'kind': 'video', 'url': video, 'poster': poster, 'sourcePageUrl': source,
                'width': 360, 'height': 640, 'label': '手机端演示',
            },
        })
        assert response.ok, response.text()

        dialog.get_by_role('button', name='查看参考素材').click()
        refresh = dialog.get_by_role('button', name='刷新候选')
        refresh_url = f'**/api/component-records?id={record_id}'
        page.route(refresh_url, lambda route: route.fulfill(status=503, json={'error': '测试暂不可用'}), times=1)
        refresh.press('Enter')
        expect(dialog.get_by_role('status')).to_contain_text('测试暂不可用')
        expect(refresh).to_be_focused()
        refresh.press('Enter')
        candidate = dialog.locator('.component-reference-item').filter(has_text='手机端演示')
        expect(candidate.locator('video')).to_have_attribute('poster', poster)
        expect(refresh).to_be_focused()
        candidate.get_by_role('button', name='用作预览').press('Enter')
        expect(dialog.locator('[data-current-reference]')).to_be_focused()
        dialog.get_by_role('tab', name='预览', exact=True).click()
        selected = dialog.locator('.component-detail-media')
        expect(selected.locator('video')).to_have_attribute('poster', poster)
        assert selected.evaluate("node => Number(getComputedStyle(node).getPropertyValue('--detail-media-ratio'))") == 360 / 640

        page.reload(wait_until='domcontentloaded')
        expect(dialog.locator('.component-detail-media video')).to_have_attribute('poster', poster)
        dialog.get_by_role('button', name='关闭组件详情').click()
        expect(page).to_have_url(origin + '/#/components')
        card = page.locator(f'.component-thumb[data-open-component="{record_id}"]')
        expect(card.locator('img')).to_have_attribute('src', poster)
        expect(card.locator('video')).to_have_count(0)
    finally:
        page.close()


def check_home_page(browser, oss, website, screenshots=None):
    def geometry(page):
        return page.evaluate("""() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect();
          const box = ({ x, y, width, height }) => [x, y, width, height];
          const index = rect('.home-index');
          const rights = rect('.home-rights');
          const notice = rect('.home-rights h2');
          const card = rect('.home-index > :first-child');
          const cardStyle = getComputedStyle(document.querySelector('.home-index > :first-child'));
          const cardMetrics = [card.x, card.y, parseFloat(cardStyle.minHeight),
            parseFloat(cardStyle.paddingTop), parseFloat(cardStyle.paddingLeft)];
          if (matchMedia('(max-width: 699px)').matches) cardMetrics.push(card.width);
          return [box(rect('.home-hero')), box(rect('.home-hero h1')), [index.x, index.y, index.width],
            cardMetrics, [rights.x, rights.width, rights.y - index.bottom],
            [notice.x, notice.y - rights.y, notice.width, notice.height]];
        }""")

    for width in (320, 1440):
        local = browser_page(browser, oss, width, 900)
        try:
            local.goto(oss + '/', wait_until='domcontentloaded')
            hero = local.locator('.home-hero')
            expect(hero).to_be_visible()
            local.evaluate('document.fonts.ready')
            heading = hero.get_by_role('heading', level=1).inner_text()
            local_geometry = geometry(local)
            expect(hero.get_by_role('button', name='打开页面库')).to_be_visible()
            hero.get_by_role('button', name=re.compile(r'^浏览组件库')).click()
            expect(local).to_have_url(oss + '/#/components')
            expect(local.locator('#component-library')).to_be_visible()
        finally:
            local.close()

        context = browser.new_context(java_script_enabled=False, viewport={'width': width, 'height': 900},
                                      is_mobile=width < 500, has_touch=width < 500)
        restrict_requests(context, website)
        public = context.new_page()
        try:
            for prefix in ('', '/zh'):
                home = prefix or '/'
                gallery = prefix + '/components'
                response = public.goto(website + home, wait_until='load')
                assert response.status == 200 and response.request.redirected_from is None
                hero = public.locator('.home-hero')
                expect(hero.get_by_role('heading', level=1)).to_have_text(heading, use_inner_text=True)
                public.evaluate('document.fonts.ready')
                public_geometry = geometry(public)
                assert all(abs(a - b) <= 2 for left, right in zip(local_geometry, public_geometry)
                           for a, b in zip(left, right)), (width, home, local_geometry, public_geometry)
                assert public.evaluate('document.documentElement.scrollWidth') == width
                expect(public.locator('link[rel="canonical"]')).to_have_attribute(
                    'href', re.compile(r'^https?://[^?#]+/$'))
                components = hero.get_by_role('link', name=re.compile(r'^浏览组件库'))
                fonts = hero.get_by_role('link', name='打开字体库', exact=True)
                expect(components).to_have_attribute('href', gallery)
                expect(fonts).to_have_attribute('href', prefix + '/fonts')
                index_links = public.locator('.home-index > a')
                expect(index_links).to_have_count(2)
                expect(index_links.first).to_have_attribute('href', gallery)
                expect(index_links.last).to_have_attribute('href', prefix + '/fonts')
                if screenshots and not prefix:
                    public.screenshot(path=screenshots / f'ilia-home-{width}.png')
                components.click()
                expect(public).to_have_url(website + gallery)
                expect(public.locator('#ilia-ssr .component-thumb:visible').first).to_be_visible()
                expect(public.locator('.sidebar .brand')).to_have_attribute('href', home)
                public.go_back(wait_until='domcontentloaded')
                expect(public).to_have_url(website + home)
                fonts.click()
                expect(public).to_have_url(website + prefix + '/fonts')
                expect(public.get_by_role('heading', name='字体库', exact=True, level=1)).to_be_visible()
        finally:
            context.close()


def check_guide_chrome(browser, website, screenshots=None):
    def geometry(page):
        return page.evaluate("""() => ['.sidebar', '.workspace', '.topbar', '.cord-window'].map(selector => {
          const { x, y, width } = document.querySelector(selector).getBoundingClientRect();
          return [x, y, width].map(Math.round);
        })""")

    for width in (1440, 390):
        page = browser_page(browser, website, width, 900)
        errors = []
        auth_requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: auth_requests.append(request.url)
                if urlsplit(request.url).path.startswith("/api/auth/") else None)
        page.on("console", lambda message: errors.append(message.text)
                if message.type == "error" and "hydrat" in message.text.lower() else None)
        try:
            page.goto(website + "/components", wait_until="domcontentloaded")
            expect(page.locator(".action-dock")).to_be_visible()
            page.locator("#stack-settings").click()
            page.locator('[data-stack="theme"]').click()
            page.locator('[data-theme-choice="light"]').click()
            page.locator("#stack-close").click()
            gallery = geometry(page)
            page.locator('[data-dock="switches"]').click()
            expect(page).to_have_url(website + "/switches")
            expect(page.get_by_role("heading", name="UI Switches", exact=True)).to_be_visible()
            expect(page.locator('#navigation [data-view="switches"]')).to_have_attribute("aria-current", "page")
            expect(page.locator('[data-dock="switches"]')).to_have_attribute("data-selected", "true")
            expect(page.locator("html")).to_have_attribute("data-theme", "light")
            assert gallery == geometry(page), (width, gallery, geometry(page))
            assert page.evaluate("document.documentElement.scrollWidth") == width
            if screenshots:
                page.screenshot(path=screenshots / f"ilia-switches-{width}.png")

            page.get_by_role("link", name=re.compile("Dark Mode Toggle UI")).click()
            expect(page).to_have_url(website + "/components/dark-mode-toggle")
            switch = page.frame_locator("#icon-switch iframe").get_by_role("button", name="Dark mode")
            expect(switch).to_have_attribute("aria-pressed", "false")
            switch.click()
            expect(switch).to_have_attribute("aria-pressed", "true")
            expect(page.locator("html")).to_have_attribute("data-theme", "light")
            expect(page.locator(".action-dock")).to_be_visible()
            if width == 1440:
                page.context.grant_permissions(["clipboard-read", "clipboard-write"])
                example = page.locator("#icon-switch")
                example.get_by_text("View code", exact=True).click()
                example.get_by_role("button", name="Copy HTML").click()
                expect(example.get_by_role("button", name="Copied")).to_be_visible()
                page.emulate_media(color_scheme="dark")
                page.get_by_role("link", name=re.compile("Try a theme toggle")).click()
                expect(page).to_have_url(website + "/components/theme-toggle")
                system_demo = page.frame_locator("#system-selector iframe")
                expect(system_demo.get_by_role("combobox")).to_have_value("system")
                expect(system_demo.locator(".theme-demo")).to_have_attribute("data-theme", "dark")
                expect(page.locator("html")).to_have_attribute("data-theme", "light")

            page.locator('#navigation [data-view="mcp"]').click()
            expect(page).to_have_url(website + "/mcp")
            expect(page.locator('#navigation [data-view="mcp"]')).to_have_attribute("aria-current", "page")
            expect(page.get_by_role("heading", name="Ilia Cache MCP", exact=True)).to_be_visible()
            grab = page.frame_locator(".cord-window iframe").get_by_role("switch")
            expect(grab).to_have_attribute("aria-checked", "true")
            grab.press("Enter")
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")
            if width == 1440:
                page.locator("#sidebar-collapse").focus()
                page.keyboard.press("Control+k")
            else:
                page.locator('[data-dock="search"]').click()
            expect(page).to_have_url(website + "/components?focus=search")
            expect(page.locator("#component-search")).to_be_focused()
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")
            assert not errors, errors
            assert not auth_requests, auth_requests
        finally:
            page.close()

    context = browser.new_context(java_script_enabled=False)
    restrict_requests(context, website)
    page = context.new_page()
    try:
        for path, heading in [
            ("/switches", "UI Switches"), ("/components/dark-mode-toggle", "Dark Mode Toggle UI"),
            ("/components/theme-toggle", "Theme Toggle"), ("/mcp", "Ilia Cache MCP"),
        ]:
            response = page.goto(website + path, wait_until="domcontentloaded")
            assert response.status == 200
            expect(page.get_by_role("heading", name=heading, exact=True, level=1)).to_be_visible()
            expect(page.locator('link[rel="canonical"]')).to_have_attribute("href", re.compile(re.escape(path) + "$"))
            expect(page.locator('#navigation a[data-view="components"]')).to_have_attribute("href", "/components")
    finally:
        context.close()


def check_public_navigation_first_paint(browser, website):
    geometry = """() => ['.sidebar', '#navigation a[data-view]', '.topbar', '.action-dock', '.cord-window'].map(selector => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return [x, y, width, height];
    })"""
    for width, path, active, compact in [
        (320, '/zh/components', 'components', False), (430, '/zh/components', 'components', False),
        (1440, '/zh/components', 'components', False), (1440, '/zh/components', 'components', True),
        (320, '/zh', 'home', False), (390, '/zh/fonts', 'fonts', False),
        (390, '/zh/switches', 'switches', False), (480, '/zh/mcp', 'mcp', False),
        (1440, '/zh/mcp', 'mcp', False),
    ]:
        page = browser_page(browser, website, width, 900)
        try:
            if compact:
                page.add_init_script("localStorage.setItem('ilia-sidebar-compact', 'true')")
            delayed = SEED_ROUTE if active == 'components' else PUBLIC_CHROME_ROUTE
            pending = []
            page.route(delayed, lambda route: pending.append(route))
            with page.expect_request(delayed):
                page.goto(website + path, wait_until='commit')
            navigation = page.locator('#navigation')
            for item in ('home', 'components', 'fonts', 'switches', 'mcp'):
                expect(navigation.locator(f'a[data-view="{item}"]')).to_have_count(1)
            expect(navigation.locator(f'a[data-view="{active}"]')).to_have_attribute('aria-current', 'page')
            expect(page.locator('.sidebar .brand')).to_have_attribute('href', '/zh')
            expect(page.locator('.sidebar #export, .sidebar #import')).to_have_count(0)
            search = page.locator('.action-dock a[data-dock="search"]')
            expect(search).to_have_attribute('href', '/zh/components#ilia-search' if active == 'components' else '/zh/components?focus=search')
            assert page.evaluate('document.documentElement.scrollWidth') == width
            if width <= 480:
                check_compact_dock_targets(page)
            before = page.evaluate(geometry)
            search.evaluate('link => { window.iliaPrepaintSearch = link; link.focus(); }')
            expect(search).to_be_focused()
            pending.pop().continue_()
            expect(page.locator('.dock-highlight')).to_be_attached()
            expect(page.locator('#stack-settings')).to_be_attached()
            assert search.evaluate('link => link === window.iliaPrepaintSearch')
            expect(search).to_be_focused()
            after = page.evaluate(geometry)
            assert all(abs(a - b) <= 2 for left, right in zip(before, after) for a, b in zip(left, right)), (width, path, compact, before, after)
            if width <= 480:
                check_compact_dock_targets(page)
        finally:
            page.close()

    context = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 900})
    restrict_requests(context, website)
    page = context.new_page()
    try:
        page.goto(website + '/zh/components?source=React+Bits', wait_until='domcontentloaded')
        page.locator('.action-dock a[data-dock="search"]').click()
        expect(page).to_have_url(website + '/zh/components?source=React+Bits#ilia-search')
        expect(page.locator('#ilia-search')).to_be_visible()
        page.locator('.action-dock a[data-dock="switches"]').click()
        expect(page).to_have_url(website + '/zh/switches')
        page.locator('#navigation a[data-view="mcp"]').click()
        expect(page).to_have_url(website + '/zh/mcp')
        page.locator('.action-dock a[data-dock="search"]').click()
        expect(page).to_have_url(website + '/zh/components?focus=search')
        expect(page.locator('#ilia-search')).to_be_visible()
    finally:
        context.close()

    page = browser_page(browser, website, 390, 900)
    try:
        page.route(PUBLIC_CHROME_ROUTE, lambda route: route.fulfill(status=503, body='Unavailable'))
        with page.expect_response(lambda response: PUBLIC_CHROME_ROUTE.search(response.url) and response.status == 503):
            page.goto(website + '/zh/switches', wait_until='domcontentloaded')
        expect(page.locator('.dock-highlight')).to_have_count(0)
        page.locator('.action-dock a[data-dock="mcp"]').click()
        expect(page).to_have_url(website + '/zh/mcp')
        expect(page.get_by_role('heading', name='Ilia Cache MCP', exact=True)).to_be_visible()
    finally:
        page.close()


def check_website_ui_release(browser, website):
    page = browser_page(browser, website, 1440, 900)
    requests = set()
    page.on('request', lambda request: requests.add(urlsplit(request.url).path))
    try:
        page.goto(website + '/components', wait_until='domcontentloaded')
        expect(page.locator('#component-library')).to_be_visible()
        entry = page.locator('script[src$="/runtime.mjs"]').get_attribute('src')
        root = entry.rsplit('/', 1)[0]
        assert re.fullmatch(UI_RELEASE_PATH, root)

        def check_styles():
            styles = page.locator('link[rel="stylesheet"][href^="/ilia-ui/"]').evaluate_all(
                "links => links.map(link => link.getAttribute('href'))")
            assert len(styles) == 6 and all(path.startswith(root + '/') for path in styles), styles

        check_styles()
        page.goto(website + '/components/' + COMPONENT_ID, wait_until='domcontentloaded')
        motion = page.locator('#component-dialog .component-motion-preview[data-motion-state="ready"]')
        expect(motion).to_be_visible()
        expect(motion.locator('iframe')).to_have_attribute(
            'src', root + '/motion-prompt-preview/index.html?pack=motion&id=001')
        expect(motion.locator('img')).to_have_attribute('src', root + '/motion-prompt-preview/posters/001.webp')
        check_styles()
        page.goto(website + '/zh/switches', wait_until='domcontentloaded')
        expect(page.locator('.dock-highlight')).to_be_attached()
        check_styles()
        expected = {
            'runtime.mjs', 'public-chrome.mjs', 'component-workspace-ui.mjs', 'component-detail-chrome.mjs',
            'workspace-dock.mjs', 'motion/pull-cord.html', 'interface.css', 'motion-prompt-preview/player.css',
            'motion-prompt-preview/player.js', 'motion-prompt-preview/packs/motion/pack.js',
        }
        for path in expected:
            assert root + '/' + path in requests, path
        owned_assets = [path for path in requests if path.startswith('/ilia-ui/') and not path.endswith('.json')]
        assert all(path.startswith(root + '/') for path in owned_assets), owned_assets
    finally:
        page.close()


def compare(browser, oss, website, screenshots):
    catalogs = [("oss", oss, "/#/components"), ("website", website, "/components")]
    check_home_page(browser, oss, website, screenshots)
    check_legacy_website_routes(browser, website)
    print("The shared home layout and component links work without JavaScript; old directory and detail URLs retain their locale and parameters")
    for width, height in [(1440, 980), (900, 850), (390, 844), (320, 844)]:
        results = {}
        pages = []
        for name, origin, path in catalogs:
            page = browser_page(browser, origin, width, height)
            page.goto(origin + path, wait_until="domcontentloaded")
            results[name] = read_catalog(page)
            check_catalog_media_fit(page, name)
            page.evaluate("document.documentElement.dataset.theme = 'light'")
            assert read_catalog(page) == results[name], f"{name} geometry changed when switching to light"
            page.evaluate("document.documentElement.dataset.theme = 'dark'")
            if screenshots:
                page.screenshot(path=screenshots / f"ilia-{name}-{width}.png")
            pages.append((name, origin, page))
        local = results["oss"]
        public = results["website"]
        assert local["scrollWidth"] == public["scrollWidth"] == width, results.keys()
        assert local["boxes"] == public["boxes"], (local["boxes"], public["boxes"])
        local_cards, public_cards = local["cards"], public["cards"]
        assert [row[0] for row in local_cards] == [row[0] for row in public_cards], (
            "The two catalogs have different IDs or ordering. Use a fresh OSS library."
        )
        disagreements = [(left, right) for left, right in zip(local_cards, public_cards) if left != right]
        assert not disagreements, f"{len(disagreements)} card positions or sizes differ: {disagreements[:8]}"
        summary_heights = [check_summary_layout(page) for _, _, page in pages]
        assert abs(summary_heights[0] - summary_heights[1]) <= 1, summary_heights
        print(f"{width}px: identical sizes and positions for {len(local_cards)} cards in both themes; stable summary footprint")
        for name, origin, page in pages:
            if width == 1440:
                detail_path = "/#/components/" if name == "oss" else "/components/"
                exercise_catalog(page, origin + detail_path + COMPONENT_ID, name == "website")
            page.close()
    for name, origin, path in catalogs:
        check_sidebar_spring(browser, origin, path)
        check_sidebar_keyboard_navigation(browser, origin, path, name != 'oss')
        check_compact_dock_actions(browser, origin, path, name != 'oss')
        check_dock_spring(browser, origin, path)
        check_preview_playback(browser, origin, path)
        check_preview_lifecycle(browser, origin, path, '/#/components/' if name == 'oss' else '/components/')
        check_detail_video_tab_state(browser, origin, path)
        check_preview_recovery(browser, origin, path)
        for width in (390, 1440):
            requests = check_directory_video_loading(browser, origin, path, width)
            print(f"{name} {width}px: {requests} React Bits covers near initial viewport and no unplayed video requests")
        detail_path = "/#/components/" if name == "oss" else "/components/"
        for width in (320, 390):
            check_touch_motion_preview(browser, origin, detail_path, width)
        for width in (320, 390, 1440):
            check_motion_preview_loading(browser, origin, detail_path, width)
        check_motion_preview_loading(browser, origin, detail_path, 390, fail=True)
        check_motion_preview_loading(browser, origin, detail_path, 390, delay=True)
        check_motion_preview_document_failure(browser, origin, detail_path)
        check_motion_preview_keyboard_and_pause(browser, origin, path)
        check_official_frame_preview(browser, origin, detail_path, 390, name == 'website', denied=True)
        check_official_frame_preview(browser, origin, detail_path, 1440, name == 'website')
        for width in (390, 1440):
            check_deep_detail_return(browser, origin, path, detail_path, width)
    print("Both hosts paused hover video during navigation and motion changes, and recovered failed media with a poster or source link")
    print("Both detail video players preserve position, pause and mute across tabs and start fresh in a new detail")
    print("Motion Prompt previews fit their canvas and touch controls without nested scrolling at 320px and 390px on both hosts")
    print("Both detail views keep the Motion Prompt poster until a rendered frame and preserve the preview size if loading fails")
    print("Both Motion Prompt players restore keyboard focus on Escape, preserve a manual pause across tabs, and recover after a late pack")
    print("Approved external previews match across first paint and both hosts, and remain openable when framing is denied")
    print("Sidebar spring moved through intermediate widths on both hosts")
    print("Both catalogs preserved filters and focus through detail back, forward and close")
    print("Both hosts reveal the card after a direct detail link and preserve scroll when returning through history after reload")
    print("Equivalent queries, viewport changes and a local cart edit preserved existing card nodes")
    check_directory_filter_restore(browser, oss, "/#/components", False)
    check_directory_filter_restore(browser, website, "/components", True)
    check_horizontal_filter_reveal(browser, oss, "/#/components", False)
    check_horizontal_filter_reveal(browser, website, "/components", True)
    print("Both catalogs reveal horizontal filters after clear, reload and history without moving the page")
    for _, origin, path in catalogs:
        check_responsive_directory_anchor(browser, origin, path)
        check_directory_search_controls(browser, origin, path)
    print("Both catalogs preserve visible cards, keyboard focus and card order across responsive lane changes")
    print("Both catalogs commit input method searches once confirmed, restore controls from history and recover empty results")
    check_shareable_website_filters(browser, website)
    print("Directory filters survive reload in both hosts and can be shared on the website, including localized and legacy URLs")
    check_server_directory(browser, website)
    print("Website filters, local detail links and return navigation work with JavaScript disabled and match interactive results")
    check_first_directory_paint(browser, website)
    check_directory_submit_handoff(browser, website)
    check_directory_handoff_controls(browser, website)
    check_directory_result_handoff(browser, website)
    print("Website first paint matches live filters and card positions and preserves draft filters, scroll, focus and active composition")
    check_public_card_content_first_paint(browser, website)
    print("Static and live cards present the same metadata and approved previews for seven representative public components")
    check_first_component_detail(browser, website)
    check_unplayed_video_audio_handoff(browser, website)
    check_prompt_handoff(browser, website)
    print("Direct detail first paint matches interactive sizing and retains source focus and video playback through the handoff")
    print("Prompt detail keeps its text field geometry, selection and scroll position when JavaScript takes over")
    for width in (320, 390, 1440):
        check_detail_media_failure_layout(browser, website, width)
    print("Website detail, media stage and source position stay stable through an image or video failure before and after handoff")
    for width in (1440, 390, 320):
        local = check_reference_panel(browser, oss, "/#/components/", width, screenshots, "oss")
        public = check_reference_panel(browser, website, "/components/", width, screenshots, "website")
        assert local == public, (width, local, public)
        print(f"{width}px: matching shared detail layout, references and tab keyboard controls")
    for width in (390, 1440):
        local_copy = check_workspace_copy(browser, oss, '/#/components/', width)
        website_copy = check_workspace_copy(browser, website, '/components/', width)
        assert local_copy == website_copy, (width, local_copy, website_copy)
    print('Both hosts share clipboard success, manual fallback, layout, and return focus for component, prompt and source copy')
    check_prompt_draft(browser, oss)
    print("Local unsaved prompt survived package loading and tab switches")
    for width in (320, 1440):
        local_code = check_source_file_reader(browser, oss, '/#/components/', width)
        public_code = check_source_file_reader(browser, website, '/components/', width)
        assert local_code == public_code, (width, local_code, public_code)
    print('Both source readers reset file scroll, expose selected files and keep code reachable by keyboard')
    for name, origin, path in catalogs:
        check_source_package_lifecycle(browser, origin, path, name != "oss")
        check_component_detail_tab_links(browser, origin, path, name != "oss")
        check_component_document_metadata(browser, origin, path, name != "oss")
    check_website_detail_tab_fallback(browser, website)
    check_source_and_reference_handoff(browser, website)
    check_detail_bootstrap(browser, website)
    check_public_snapshot_revisions(browser, website)
    print("Both source panels deduplicate in-flight requests, isolate details and retry failed packages")
    print("Component tab links survive reload and history, with playable source policy protected before and after enhancement")
    print("Browser titles and website share metadata follow the same component and gallery routes as the first paint")
    print("A direct website detail works while the full directory is pending or unavailable, with filters and focus preserved")
    print("Stale website directory and package responses leave the current component and filters intact")
    for name, origin, path in catalogs:
        detail_path = "/#/components/" if name == "oss" else "/components/"
        check_theme_before_directory(browser, origin, path, name != 'oss')
        for width in (1440, 393):
            check_workspace_theme(browser, origin, path, detail_path, width)
    print("Both hosts passed cord drag, keyboard, theme persistence, preview sync and reduced motion")
    check_guide_chrome(browser, website, screenshots)
    check_public_navigation_first_paint(browser, website)
    check_website_ui_release(browser, website)
    print("Localized navigation works before scripts load and keeps the same focused links after enhancement")
    check_sidebar_spring(browser, website, "/switches")
    print("Hosted guides share the chrome layout, theme, search, sidebar spring and render their content without JavaScript")
    check_local_reference_candidate(browser, oss)
    print("A saved link opens an addressable local detail, persists a selected video poster and renders it on the card")
    check_legacy_component_media(browser, oss)
    print('Saved legacy media shares card playback and recovery, remains readable after reload, and keeps project covers')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oss", required=True, help="Local OSS app origin")
    parser.add_argument("--website", required=True, help="Running website origin")
    parser.add_argument("--screenshots", type=Path, help="Optional output directory")
    parser.add_argument("--channel", default="chrome", help="Playwright browser channel")
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel=args.channel, headless=True)
        try:
            compare(browser, args.oss.rstrip("/"), args.website.rstrip("/"), args.screenshots)
        finally:
            browser.close()
        browser = playwright.chromium.launch(channel=args.channel, headless=True,
                                             ignore_default_args=['--disable-back-forward-cache'])
        try:
            check_cached_directory_theme(browser, args.website.rstrip("/"))
            print("The cached website directory reused the current theme on its first restored frame")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
