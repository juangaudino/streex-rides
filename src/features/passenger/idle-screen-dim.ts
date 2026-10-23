export function resolveIdleScreenTap(isDimmed: boolean) {
  return isDimmed ? { dimmed: false, resume: false } : { dimmed: false, resume: true };
}
