#!/usr/bin/env python3
"""The Rider launcher is the GRIDGO wordmark lockup, not the 3x3 mark.

Captain locked the home-screen tile as GRIDGO + RIDER on a black plate.
The committed rasters under assets/images/ are the source. This script
does not paint a 3x3 over them.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICON = ROOT / "assets" / "images" / "icon.png"


def main() -> None:
    if not ICON.is_file():
        raise SystemExit("assets/images/icon.png is missing")
    print("launcher is the committed GRIDGO RIDER lockup; not regenerating a 3x3")


if __name__ == "__main__":
    main()
