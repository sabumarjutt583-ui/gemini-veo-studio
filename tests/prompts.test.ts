import { describe, it, expect } from "vitest";
import {
  parseTxtPrompts,
  parseCsvPrompts,
  titleFromText,
} from "@main/services/prompt.service";

describe("parseTxtPrompts", () => {
  it("handles the 'Prompt N:' marker format", () => {
    const raw = [
      "Prompt 1: Create a realistic cinematic video of a Korean countryside village.",
      "",
      "Prompt 2: Create a beautiful autumn landscape with natural lighting.",
      "Prompt 3: Create a realistic old Korean traditional house.",
    ].join("\n");
    const out = parseTxtPrompts(raw);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Create a realistic cinematic video of a Korean countryside village.");
    expect(out[1]).toBe("Create a beautiful autumn landscape with natural lighting.");
  });

  it("handles blank-line separated blocks", () => {
    const raw = "A first prompt.\n\nA second prompt, wrapped\nover two lines.\n\nThird.";
    const out = parseTxtPrompts(raw);
    expect(out).toEqual([
      "A first prompt.",
      "A second prompt, wrapped over two lines.",
      "Third.",
    ]);
  });

  it("falls back to one prompt per non-empty line", () => {
    const raw = "line one\nline two\n\nline three";
    // No markers, multiple non-blank lines, only one blank-separated block:
    // "line one\nline two" is one block, "line three" is another -> 2.
    const out = parseTxtPrompts("line one\nline two\n\nline three");
    expect(out).toEqual(["line one line two", "line three"]);
  });
});

describe("parseCsvPrompts", () => {
  it("reads a title,prompt_text column", () => {
    const raw = "title,prompt_text\nMy video,A cat walks in the rain\nOther,A dog runs\n";
    const out = parseCsvPrompts(raw);
    expect(out).toEqual(["A cat walks in the rain", "A dog runs"]);
  });

  it("handles quoted fields with commas", () => {
    const raw = 'prompt_text\n"a cinematic shot, with rain"\nsimple text\n';
    const out = parseCsvPrompts(raw);
    expect(out).toEqual(["a cinematic shot, with rain", "simple text"]);
  });

  it("reads a single-column csv without a header keyword", () => {
    const raw = "A prompt here\nAnother prompt\n";
    const out = parseCsvPrompts(raw);
    expect(out).toEqual(["A prompt here", "Another prompt"]);
  });
});

describe("titleFromText", () => {
  it("truncates long titles with an ellipsis", () => {
    expect(titleFromText("a".repeat(100))).toHaveLength(51);
    expect(titleFromText("a".repeat(100)).endsWith("…")).toBe(true);
  });
  it("normalizes whitespace", () => {
    expect(titleFromText("  a   b  ")).toBe("a b");
  });
});
