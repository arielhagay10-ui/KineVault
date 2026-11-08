"""Original free-standing pull-up bar.

Metres, workshop Y-up. Shared dimensions come from src/lib/motion/pull-up-bar.ts.
A straight bar spans two uprights high enough for a dead hang with the feet off the floor.
The uprights stand outside the elbows' widest path. No third-party mesh, texture or branding.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_equipment as eq

source = (eq.ROOT / "src/lib/motion/pull-up-bar.ts").read_text()
bar = json.loads(source.split("export const pullUpBar = ", 1)[1].split(" as const;", 1)[0])
NAME = "pull-up-bar"
upright, base, height = bar["upright"], bar["base"], bar["height"]
x, size = upright["x"], upright["size"]

eq.new_scene()
eq.group("Static")
for sign in (-1, 1):
    eq.box("Base runner", (sign * x, .06, (base["front"] + base["back"]) / 2), (.11, .12, base["front"] - base["back"]))
    for z in (base["front"], base["back"]):
        eq.box("Floor shoe", (sign * x, .045, z), (.17, .09, .17), "rubber")
        eq.beam("Upright brace", (sign * x, .12, z * .8), (sign * x, 1.05, 0), .05)
    eq.beam("Upright", (sign * x, .1, 0), (sign * x, upright["top"], 0), size)
    eq.box("Upright cap", (sign * x, upright["top"] + .01, 0), (size + .015, .02, size + .015), "rubber", bevel=.004)
    eq.box("Bar bracket", (sign * x, height, 0), (size + .03, .12, size + .03), "iron", bevel=.006)
    eq.tube("Grip knurl", (sign * (bar["grip"] - .09), height, 0), (sign * (bar["grip"] + .09), height, 0), bar["radius"] + .002, "iron", sides=24)
eq.tube("Pull-up bar", (-x, height, 0), (x, height, 0), bar["radius"], "chrome", sides=24)

eq.export(NAME)
(eq.EVIDENCE / (NAME + "-export.json")).write_text(json.dumps(eq.stats[NAME], indent=2))
