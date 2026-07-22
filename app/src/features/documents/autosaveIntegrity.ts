export function hasNewerLocalSnapshot(requestSnapshot: string, latestSnapshot: string): boolean {
  return requestSnapshot !== latestSnapshot;
}
