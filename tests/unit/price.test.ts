import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatKronerInput, formatPrice, MAX_PRICE_ORE, parseKroner } from "../../src/lib/price";

describe("parseKroner (kroner text → øre)", () => {
  const cases: [string, number][] = [
    ["1250", 125_000],
    ["1 250", 125_000],
    ["1 250,00", 125_000],
    ["1 250,00", 125_000],
    ["1.250", 125_000],
    ["1.250,5", 125_050],
    ["1250,50", 125_050],
    ["1250,5", 125_050],
    ["1250.50", 125_050],
    ["1250.5", 125_050],
    ["0", 0],
    ["0,99", 99],
    ["1.250.000", 125_000_000],
    ["kr 1.250,00", 125_000],
    ["1 250 kr.", 125_000],
    ["DKK 1250", 125_000],
    ["950,-", 95_000],
    ["  1 250,00  ", 125_000],
  ];
  for (const [input, ore] of cases) {
    it(`"${input}" → ${ore}`, () => assert.equal(parseKroner(input), ore));
  }

  for (const bad of [
    "",
    "   ",
    "abc",
    "-100",
    "1,2,3",
    "1,234",
    "12,345",
    "1.25.0",
    "1.2345",
    "1 25,00x",
    "1e5",
    "€100",
  ]) {
    it(`rejects "${bad}"`, () => assert.equal(parseKroner(bad), null));
  }

  it("rejects prices above the maximum", () => {
    assert.equal(parseKroner("10.000.000,00"), MAX_PRICE_ORE);
    assert.equal(parseKroner("10.000.000,01"), null);
  });
});

describe("formatKronerInput (øre → admin input)", () => {
  it("uses spaces for thousands and a decimal comma", () => {
    assert.equal(formatKronerInput(125_000), "1 250,00");
    assert.equal(formatKronerInput(125_050), "1 250,50");
    assert.equal(formatKronerInput(99), "0,99");
    assert.equal(formatKronerInput(1_250_000_000), "12 500 000,00");
  });

  it("round-trips through parseKroner", () => {
    for (const ore of [0, 1, 99, 100, 125_000, 125_050, 99_999_999]) {
      assert.equal(parseKroner(formatKronerInput(ore)), ore);
    }
  });
});

describe("formatPrice (public display)", () => {
  it("formats per locale and hides .00", () => {
    assert.match(formatPrice(125_000, "DKK", "da"), /^1\.250\s?kr\.$/);
    assert.match(formatPrice(125_050, "DKK", "da"), /^1\.250,50\s?kr\.$/);
    assert.match(formatPrice(125_000, "DKK", "en"), /1,250/);
  });
});
