import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MESSAGE_MAX_LENGTH,
  messageBodySchema,
  withinEditWindow,
} from "../../src/lib/validation/messages";

describe("case messages", () => {
  it("trims, normalises line endings and keeps the text as typed (plain text)", () => {
    assert.equal(messageBodySchema.parse("  Hello\r\nworld  "), "Hello\nworld");
    // Markup is just text: it is stored as typed and rendered as text, never as HTML.
    assert.equal(messageBodySchema.parse("<b>bold</b> **x**"), "<b>bold</b> **x**");
  });

  it("refuses empty, too long and control characters", () => {
    assert.equal(messageBodySchema.safeParse("   ").success, false);
    assert.equal(messageBodySchema.safeParse("x".repeat(MESSAGE_MAX_LENGTH)).success, true);
    assert.equal(messageBodySchema.safeParse("x".repeat(MESSAGE_MAX_LENGTH + 1)).success, false);
    assert.equal(messageBodySchema.safeParse("bad\u0000byte").success, false);
    assert.equal(messageBodySchema.safeParse("bell\u0007").success, false);
    assert.equal(messageBodySchema.safeParse("tab\tand\nnewline").success, true);
    assert.equal(messageBodySchema.safeParse(42).success, false);
  });

  it("can be edited or deleted for 5 minutes only", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    assert.equal(withinEditWindow(new Date("2026-10-23T11:56:00Z"), now), true);
    assert.equal(withinEditWindow(new Date("2026-10-23T11:55:00Z"), now), true);
    assert.equal(withinEditWindow(new Date("2026-10-23T11:54:59Z"), now), false);
  });
});
