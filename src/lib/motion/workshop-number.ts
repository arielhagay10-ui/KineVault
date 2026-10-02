export function parseWorkshopNumber(text: string, min = -Infinity, max = Infinity): number | null {
  const normalized = text.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0)).replace(/\u066c/g, "").replace(/[\u066b,]/g, ".");
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function incrementWorkshopNumber(value: number, change: number, min = -Infinity, max = Infinity): number {
  return Math.max(min, Math.min(max, Number((value + change).toPrecision(12))));
}
