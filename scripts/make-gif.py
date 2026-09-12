"""
Renders the README demo GIFs.

Real terminal output, real ANSI colours — the frames are painted with Pillow and
assembled by ImageMagick. Regenerate with:

    python3 scripts/make-gif.py

Everything is self-contained so the README never depends on an external service.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont

# --- terminal theme ---------------------------------------------------------

BG = (22, 24, 30)          # editor background
TITLEBAR = (32, 35, 43)
FG = (214, 219, 229)       # default text
DIM = (110, 118, 134)
GREEN = (86, 209, 132)
RED = (240, 98, 106)
YELLOW = (229, 192, 123)
CYAN = (86, 182, 219)
BOLD = (240, 244, 252)
PROMPT = (86, 182, 219)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

SCALE = 2                 # render at 2x, then downscale for crisp text
FONT_SIZE = 14 * SCALE
LINE_H = int(FONT_SIZE * 1.45)
PAD_X = 18 * SCALE
PAD_TOP = 44 * SCALE     # room for the window chrome
PAD_BOTTOM = 16 * SCALE
COLS = 76

font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
font_bold = ImageFont.truetype(FONT_BOLD_PATH, FONT_SIZE)


# --- the script -------------------------------------------------------------
#
# A frame script: each entry is (text, colour, bold, delay_frames).
# `delay_frames` is how long the line stays alone before the next appears, which
# is what creates the "watching it work" feel.

@dataclass
class Line:
    text: str
    colour: tuple = FG
    bold: bool = False
    hold: int = 2
    typewriter: bool = False


PASS_SCRIPT = [
    Line("$ npx skillcheck check obra/superpowers", PROMPT, True, 16, typewriter=True),
    Line("", FG, False, 6),
    Line("  obra/superpowers", BOLD, True, 3),
    Line("  \u2714 SAFE TO SHIP   https://github.com/obra/superpowers", GREEN, True, 8),
    Line("", FG, False, 2),
    Line("  License   MIT", BOLD, True, 4),
    Line("  Keep the copyright notice in redistributions. Otherwise, do what you like.", DIM, False, 6),
    Line("", FG, False, 2),
    Line("  Spec      5/5 SKILL.md file(s) valid", BOLD, True, 4),
    Line("", FG, False, 2),
    Line("  Health    \u2605 285,595  \u00b7  25,555 forks  \u00b7  pushed 1d ago", BOLD, True, 5),
    Line("", FG, False, 2),
    Line("  Why", BOLD, True, 2),
    Line("    \u00b7 License is permissive: safe for commercial use.", FG, False, 4),
    Line("    \u00b7 SKILL.md is valid against the Agent Skills spec.", FG, False, 40),
]

FAIL_SCRIPT = [
    Line("$ npx skillcheck check anthropics/skills", PROMPT, True, 16, typewriter=True),
    Line("", FG, False, 6),
    Line("  anthropics/skills", BOLD, True, 3),
    Line("  \u2716 DO NOT SHIP   https://github.com/anthropics/skills", RED, True, 8),
    Line("", FG, False, 2),
    Line("  License   NO LICENSE", RED, True, 4),
    Line("  No LICENSE file found. With no license, copyright law defaults to ALL", DIM, False, 3),
    Line("  RIGHTS RESERVED \u2014 legally you may not copy, modify, redistribute or sell", DIM, False, 3),
    Line("  this, even though it is public on GitHub.", DIM, False, 8),
    Line("", FG, False, 2),
    Line("  Spec      4/5 SKILL.md file(s) valid  (3 issue(s))", BOLD, True, 4),
    Line("    error name-dir-mismatch template/SKILL.md: `name: template-skill`", YELLOW, False, 3),
    Line("          does not match its directory `template`.", YELLOW, False, 6),
    Line("", FG, False, 2),
    Line("  Health    \u2605 175,921  \u00b7  20,823 forks  \u00b7  pushed 2d ago", BOLD, True, 5),
    Line("", FG, False, 2),
    Line("  Why", BOLD, True, 2),
    Line("    \u00b7 No license: all rights reserved by default.", FG, False, 3),
    Line("    \u00b7 1 spec error(s) in SKILL.md: name-dir-mismatch", FG, False, 40),
]


def canvas_size(script: list[Line]) -> tuple[int, int]:
    return (COLS * (FONT_SIZE * 6 // 10) + PAD_X * 2,
            PAD_TOP + len(script) * LINE_H + PAD_BOTTOM)


def draw_chrome(draw: ImageDraw.ImageDraw, width: int, title: str) -> None:
    draw.rectangle([0, 0, width, 30 * SCALE], fill=TITLEBAR)
    for i, colour in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = (14 + i * 20) * SCALE
        draw.ellipse([cx - 5 * SCALE, 15 * SCALE - 5 * SCALE,
                      cx + 5 * SCALE, 15 * SCALE + 5 * SCALE], fill=colour)
    tb = draw.textbbox((0, 0), title, font=font)
    draw.text(((width - (tb[2] - tb[0])) // 2, 15 * SCALE - (tb[3] - tb[1]) // 2),
              title, font=font, fill=DIM)


def draw_line(draw: ImageDraw.ImageDraw, y: int, line: Line, chars: int | None = None) -> None:
    text = line.text if chars is None else line.text[:chars]
    if not text:
        return
    draw.text((PAD_X, y), text, font=font_bold if line.bold else font,
              fill=line.colour)


def cursor_x(draw: ImageDraw.ImageDraw, line: Line, chars: int) -> int:
    shown = line.text[:chars]
    bb = draw.textbbox((0, 0), shown, font=font_bold if line.bold else font)
    return PAD_X + (bb[2] - bb[0])


def render(script: list[Line], title: str, out_dir: str) -> str:
    width, height = canvas_size(script)
    frames: list[Image.Image] = []

    def frame(visible: int, partial: int | None = None, cursor_on: bool = True) -> Image.Image:
        img = Image.new("RGB", (width, height), BG)
        d = ImageDraw.Draw(img)
        draw_chrome(d, width, title)

        cy = PAD_TOP
        cx = PAD_X
        for i, line in enumerate(script):
            if i < visible:
                draw_line(d, cy, line)
                cx = cursor_x(d, line, len(line.text))
            elif i == visible and partial is not None:
                draw_line(d, cy, line, partial)
                cx = cursor_x(d, line, partial)
            cy += LINE_H

        if cursor_on:
            d.rectangle([cx, cy - LINE_H + 4 * SCALE,
                         cx + FONT_SIZE * 6 // 10, cy - 4 * SCALE], fill=FG)
        return img

    # Build the frame timeline.
    for i, line in enumerate(script):
        if line.typewriter:
            # Type the command out character by character.
            for n in range(1, len(line.text) + 1):
                frames.append(frame(i, n))
            frames.append(frame(i, len(line.text), cursor_on=False))
            frames.extend(frame(i, len(line.text), cursor_on=False) for _ in range(line.hold))
        else:
            frames.append(frame(i + 1, cursor_on=(i + 1 < len(script))))
            frames.extend(
                frame(i + 1, cursor_on=((i + 1) % 2 == 0) and (i + 1 < len(script)))
                for _ in range(line.hold)
            )

    # Hold the finished screen, with a blinking cursor, before looping.
    for k in range(30):
        frames.append(frame(len(script), cursor_on=(k % 2 == 0)))

    # Downscale for crispness and save each frame as a GIF.
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for idx, img in enumerate(frames):
        small = img.resize((width // SCALE, height // SCALE), Image.LANCZOS)
        p = os.path.join(out_dir, f"f{idx:04d}.gif")
        small.save(p, "GIF")
        paths.append(p)

    return paths[0] if paths else ""


def assemble(frames_dir: str, out_path: str, delay: int = 6) -> None:
    """Assemble PNG/GIF frames into an optimised animated GIF via ImageMagick."""
    subprocess.run(
        [
            "magick", "-delay", str(delay), "-loop", "0",
            os.path.join(frames_dir, "*.gif"),
            "-layers", "Optimize",
            out_path,
        ],
        check=True,
    )


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets = os.path.join(root, "docs", "assets")
    os.makedirs(assets, exist_ok=True)

    for name, script, title in [
        ("pass", PASS_SCRIPT, "skillcheck \u2014 safe to ship"),
        ("fail", FAIL_SCRIPT, "skillcheck \u2014 do not ship"),
    ]:
        tmp = os.path.join("/tmp", f"sc-frames-{name}")
        subprocess.run(["rm", "-rf", tmp], check=True)
        render(script, title, tmp)
        out = os.path.join(assets, f"demo-{name}.gif")
        assemble(tmp, out)
        subprocess.run(["rm", "-rf", tmp], check=True)
        size = os.path.getsize(out)
        print(f"wrote {out}  ({size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
