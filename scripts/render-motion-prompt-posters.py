"""Render component-specific thumbnails from the pinned upstream Canvas packs."""

from base64 import b64decode
from os import environ
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / "public" / "motion-prompt-preview"
PACKS = [
    "motion", "camera", "ui", "lp", "photo", "motion2",
    "lp2", "camera2", None, "diagram",
]
FRAMES = r"""name => {
  const { width, height, cycle, cells } = MotionPrompt.packs[name];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return cells.map(cell => {
    const snapshots = [0.4, 0.6, 0.25, 0.5, 0.75, 0.15, 0.9].map(fraction => {
      ctx.reset();
      cell(ctx, width, height, cycle * fraction);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 64) {
        if (pixels[i + 3]) colors.add(pixels[i] << 16 | pixels[i + 1] << 8 | pixels[i + 2]);
      }
      return { detail: colors.size, image: canvas.toDataURL('image/webp', 0.85) };
    });
    return snapshots.sort((a, b) => b.detail - a.detail);
  });
}"""


def render():
    """Render from local code only and fail if any entry has no distinct frame."""
    assets = {}
    seen = set()
    with sync_playwright() as playwright:
        channel = environ.get("ILIA_CHROMIUM_CHANNEL")
        browser = playwright.chromium.launch(channel=channel)
        page = browser.new_page()
        page.route("**/*", lambda route: route.abort())
        page.set_content("<!doctype html><html lang='en'></html>")
        page.add_script_tag(path=ROOT / "runtime.js")
        for offset, pack in enumerate(PACKS):
            if pack is None:
                continue
            page.add_script_tag(path=ROOT / "packs" / pack / "pack.js")
            scenes = page.evaluate(FRAMES, pack)
            if len(scenes) != 24:
                raise ValueError(f"{pack}: expected exactly 24 scenes")
            for index, frames in enumerate(scenes, 1):
                number = offset * 24 + index
                for frame in frames:
                    image = frame["image"]
                    if frame["detail"] > 3 and image.startswith("data:image/webp;base64,") and image not in seen:
                        assets[number] = b64decode(image.partition(",")[2], validate=True)
                        seen.add(image)
                        break
                else:
                    raise ValueError(f"{number:03d}: no distinct non-empty frame")
        browser.close()
    return assets


if __name__ == "__main__":
    snapshots = render()
    output = ROOT / "posters"
    output.mkdir(exist_ok=True)
    for number, image in snapshots.items():
        (output / f"{number:03d}.webp").write_bytes(image)
    print(f"Rendered {len(snapshots)} Motion Prompt component posters.")
