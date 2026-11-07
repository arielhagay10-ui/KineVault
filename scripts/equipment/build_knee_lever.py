"""Original seated knee-lever machines: leg extension.

Metres, workshop Y-up. Shared dimensions come from src/lib/motion/knee-lever.ts.
The Lever group turns about the seated knee axis; Weights rises with travel.
No third-party mesh, texture, branding or anatomy is included.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_equipment as eq

source = (eq.ROOT / "src/lib/motion/knee-lever.ts").read_text()
knee = json.loads(source.split("export const kneeLever = ", 1)[1].split(" as const;", 1)[0])
recline = math.radians(knee["reclineDegrees"])


def along(origin, direction, distance):
    return tuple(o + d * distance for o, d in zip(origin, direction))


def frame():
    """Seat, reclined back pad, side handles, stack tower and the left pivot post."""
    eq.new_scene()
    for part in ("Static", "Weights", "Lever"):
        eq.group(part)
    eq.feet(.5, 1.05, -1.05)
    eq.beam("Front crossmember", (-.5, .1, 1.05), (.5, .1, 1.05))
    eq.beam("Seat base tie", (-.5, .1, .2), (.5, .1, .2))

    seat_center, seat_size = knee["seat"]["center"], knee["seat"]["size"]
    seat_bottom = seat_center[1] - seat_size[1] / 2
    eq.box("Seat cushion", seat_center, seat_size, "pad", bevel=.035)
    eq.box("Seat pan", (0, seat_bottom - .012, seat_center[2]), (seat_size[0] - .06, .024, seat_size[2] - .06), "frame")
    eq.beam("Seat pedestal", (0, .1, .2), (0, seat_bottom - .02, .2), .1)
    eq.beam("Seat bearer", (0, seat_bottom - .065, -.2), (0, seat_bottom - .065, .5), .085)
    eq.beam("Seat front tie", (-.25, seat_bottom - .065, .5), (.5, seat_bottom - .065, .5), .07)

    # Back pad and its spine share the recline; the spine stands on the seat bearer and a rear brace.
    back_center, back_size = knee["back"]["center"], knee["back"]["size"]
    up = (0, math.cos(recline), math.sin(recline))
    normal = (0, -math.sin(recline), math.cos(recline))
    pad = eq.box("Back cushion", back_center, back_size, "pad", bevel=.04)
    pad.rotation_euler[0] = recline
    plate_center = along(back_center, normal, -(back_size[2] / 2 + .0125))
    plate = eq.box("Back pad backing", plate_center, (back_size[0] - .06, back_size[1] - .08, .025), "frame")
    plate.rotation_euler[0] = recline
    spine_axis = along(plate_center, normal, -.06)
    spine_low, spine_high = along(spine_axis, up, -.52), along(spine_axis, up, .3)
    eq.beam("Backrest spine", spine_low, spine_high, .085)
    for offset in (-.25, .2):
        eq.beam("Back pad bracket", along(spine_axis, up, offset), along(plate_center, up, offset), .06)
    eq.beam("Backrest foot", (0, seat_bottom - .065, -.2), spine_low, .085)
    eq.beam("Rear brace", (0, .1, -.87), along(spine_axis, up, -.05), .075)

    # Neutral handles sit beside the hips on posts tied under the seat.
    hx, hy, hz = knee["handle"]
    eq.beam("Handle crossbar", (-hx, seat_bottom - .065, hz - .06), (hx, seat_bottom - .065, hz - .06), .06)
    for sign in (-1, 1):
        eq.beam("Handle post", (sign * hx, seat_bottom - .065, hz - .06), (sign * hx, hy - .02, hz - .06), .05)
        eq.tube("Side handle", (sign * hx, hy, hz - .1), (sign * hx, hy, hz + .13), .025, "rubber", sides=24)
        eq.tube("Handle stem", (sign * hx, hy - .03, hz - .06), (sign * hx, hy, hz - .06), .02, "chrome")
        eq.tube("Handle end cap", (sign * hx, hy, hz + .13), (sign * hx, hy, hz + .15), .028, "chrome")

    # Selectorized stack behind the back pad; its cable runs inside the base and pivot post.
    eq.beam("Rear crossmember", (-.5, .1, -1.05), (.5, .1, -1.05))
    for sign in (-1, 1):
        eq.beam("Tower upright", (sign * .3, .1, -1.05), (sign * .3, 2.55, -1.05), .09)
    eq.beam("Tower head", (-.3, 2.55, -1.05), (.3, 2.55, -1.05), .09)
    eq.box("Tower shroud", (0, 1.33, -1.115), (.6, 2.4, .02), "frame")
    eq.weight_stack(0, -1.0, .2, knee["weights"])
    for y in (.14, 2.5):
        eq.box("Guide plate", (0, y, -1.02), (.66, .04, .26), "frame")

    # Bearing post on the figure's left; the lever hub turns inside its housing.
    py, pz = knee["pivot"]
    eq.beam("Pivot post", (.5, .1, pz), (.5, py - .06, pz), .09)
    eq.beam("Pivot post brace", (.5, seat_bottom - .065, .5), (.5, py - .1, pz - .02), .07)
    eq.tube("Bearing housing", (.45, py, pz), (.56, py, pz), .075, "iron", sides=24)
    eq.tube("Pivot bolt", (.56, py, pz), (.59, py, pz), .025, "chrome", sides=6)


def shin_lever(pad_side):
    """Lever arm, range plate and roller pad, modelled at the hanging (0 degree) angle."""
    pad = knee["pad"]
    py, pz = knee["pivot"]
    offset = pad["offset"] * pad_side
    eq.tube("Lever hub", (.36, 0, 0), (.45, 0, 0), .085, "iron", "Lever", 24)
    eq.tube("Range plate", (.34, 0, 0), (.36, 0, 0), .13, "frame", "Lever", 32)
    eq.beam("Lever arm", (.40, 0, 0), (.40, -pad["along"], offset), .07, parent="Lever")
    eq.beam("Cam arm", (.40, 0, 0), (.40, .14, -.06), .06, parent="Lever")
    eq.tube("Cable cam", (.37, .14, -.06), (.43, .14, -.06), .06, "rubber", "Lever", 24)
    half = pad["width"] / 2
    eq.tube("Pad axle", (-half - .03, -pad["along"], offset), (.42, -pad["along"], offset), .02, "chrome", "Lever")
    eq.tube("Roller pad", (-half, -pad["along"], offset), (half, -pad["along"], offset), pad["radius"], "pad", "Lever", 32)
    for x in (-half - .012, half):
        eq.tube("Roller end cap", (x, -pad["along"], offset), (x + .012, -pad["along"], offset), pad["radius"] * .8, "chrome", "Lever", 32)
    eq.groups["Lever"].location = eq.xyz((0, py, pz))
    eq.groups["Lever"].rotation_euler[0] = math.radians(knee["startDegrees"])


def build(name):
    frame()
    shin_lever(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(eq.EVIDENCE / (name + ".blend")))
    eq.export(name)
    (eq.EVIDENCE / (name + "-export.json")).write_text(json.dumps(eq.stats[name], indent=2))


if __name__ == "__main__":
    selected = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["leg-extension-machine"]
    for slug in selected:
        build(slug)
