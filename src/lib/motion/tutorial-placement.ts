export type TutorialBox = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };
export type TutorialDirection = "left" | "right" | "up" | "down";
export type TutorialMascotPlacement = TutorialBox & { direction: TutorialDirection };

// Finger positions in the supplied, unmirrored artwork, as fractions of each square.
const fingers = { left: { x: .09, y: .425 }, right: { x: .89, y: .425 }, up: { x: .735, y: .155 }, down: { x: .747, y: .733 } };
const overlaps = (a: TutorialBox, b: TutorialBox) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

export function placeTutorialMascot(target: TutorialBox, size: Size, viewport: Size, panel?: TutorialBox): TutorialMascotPlacement | null {
  const margin = 12, gap = 12;
  const vertical: TutorialDirection = target.top + target.height + size.height + gap <= viewport.height - margin ? "up" : "down";
  const horizontal: TutorialDirection = target.left + target.width / 2 > viewport.width / 2 ? "right" : "left";
  const oppositeVertical = vertical === "up" ? "down" : "up";
  const oppositeHorizontal = horizontal === "left" ? "right" : "left";
  const directions: TutorialDirection[] = target.width > size.width * 2
    ? [vertical, oppositeVertical, horizontal, oppositeHorizontal]
    : [horizontal, vertical, oppositeVertical, oppositeHorizontal];
  for (const scale of [1, .8, .6]) {
    const width = size.width * scale, height = size.height * scale;
    for (const direction of directions) {
      const finger = fingers[direction];
      let left = target.left + target.width / 2 - finger.x * width;
      let top = target.top + target.height / 2 - finger.y * height;
      if (direction === "up") top = target.top + target.height + gap;
      if (direction === "down") top = target.top - height - gap;
      if (direction === "left") left = target.left + target.width + gap;
      if (direction === "right") left = target.left - width - gap;
      // Only clamp along the side, preserving the gap between Kine and the target.
      if (direction === "up" || direction === "down") left = Math.max(margin, Math.min(left, viewport.width - width - margin));
      else top = Math.max(margin, Math.min(top, viewport.height - height - margin));
      const box = { left, top, width, height };
      if (left < margin || top < margin || left + width > viewport.width - margin || top + height > viewport.height - margin || overlaps(box, target) || (panel && overlaps(box, panel))) continue;
      return { ...box, direction };
    }
  }
  return null;
}
