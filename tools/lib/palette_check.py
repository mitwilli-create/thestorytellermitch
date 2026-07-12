#!/usr/bin/env python3
# Palette check: source still vs. candidate poster frame. Same method as
# output/motion-groundwork/REVIEW.md — PIL, 200px thumbnail, R-B warm-cast
# delta, HSV saturation delta, HSV value (brightness) delta. Flags: warm
# cast if |warmDelta|>8, oversaturated if |satDelta|>15, brightness drift
# if |valDelta|>20. Usage: _palette_check.py <source.jpg> <candidate.jpg>
import sys
import json
from PIL import Image


def stats(path):
    im = Image.open(path).convert("RGB").resize((200, 112))
    hsv = im.convert("HSV")
    px_rgb = list(im.getdata())
    px_hsv = list(hsv.getdata())
    n = len(px_rgb)
    r_mean = sum(p[0] for p in px_rgb) / n
    b_mean = sum(p[2] for p in px_rgb) / n
    s_mean = sum(p[1] for p in px_hsv) / n
    v_mean = sum(p[2] for p in px_hsv) / n
    return {"warm": r_mean - b_mean, "sat": s_mean / 255 * 100, "val": v_mean / 255 * 100}


def main():
    src, cand = sys.argv[1], sys.argv[2]
    s_src, s_cand = stats(src), stats(cand)
    warm_d = s_cand["warm"] - s_src["warm"]
    sat_d = s_cand["sat"] - s_src["sat"]
    val_d = s_cand["val"] - s_src["val"]
    flags = []
    if abs(warm_d) > 8:
        flags.append("warm cast")
    if abs(sat_d) > 15:
        flags.append("oversaturated" if sat_d > 0 else "undersaturated")
    if abs(val_d) > 20:
        flags.append("brightness drift")
    result = {
        "warmDelta": round(warm_d, 2),
        "satDelta": round(sat_d, 2),
        "valDelta": round(val_d, 2),
        "flags": flags or ["clean"],
        "pass": len(flags) == 0,
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
