import { describe, expect, it } from "vitest";
import { hasNewerLocalSnapshot } from "../../app/src/features/documents/autosaveIntegrity";

describe("rapport autosave response integrity", () => {
  it("accepts a response when the local snapshot is unchanged", () => {
    expect(hasNewerLocalSnapshot("snapshot-a", "snapshot-a")).toBe(false);
  });

  it("rejects a stale response after text changed during the request", () => {
    expect(hasNewerLocalSnapshot("snapshot-a", "snapshot-b")).toBe(true);
  });

  it("rejects a stale response after a signature changed during the request", () => {
    const before = JSON.stringify({ text: "Arbeit erledigt", signature: "data:image/png;base64,old" });
    const after = JSON.stringify({ text: "Arbeit erledigt", signature: "data:image/png;base64,new" });
    expect(hasNewerLocalSnapshot(before, after)).toBe(true);
  });

  it("keeps detecting the latest snapshot across repeated changes", () => {
    expect(hasNewerLocalSnapshot("snapshot-a", "snapshot-c")).toBe(true);
    expect(hasNewerLocalSnapshot("snapshot-b", "snapshot-c")).toBe(true);
  });
});
