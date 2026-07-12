import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pointToFloatingRect, resolveFloatingPosition, type FloatingRect } from "@/lib/floating-position";

const viewport = { width: 360, height: 640 };

function rect(left: number, top: number, width: number, height: number): FloatingRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

describe("resolveFloatingPosition", () => {
  it("keeps a bottom-start panel inside the right viewport edge", () => {
    const position = resolveFloatingPosition(
      rect(330, 120, 24, 24),
      { width: 240, height: 180 },
      { viewport, preferredWidth: 240, placement: "bottom", align: "start" },
    );

    assert.equal(position.left + position.width <= viewport.width - 8, true);
    assert.equal(position.left >= 8, true);
    assert.equal(position.placement, "bottom");
  });

  it("keeps a bottom-end panel inside the left viewport edge", () => {
    const position = resolveFloatingPosition(
      rect(4, 120, 24, 24),
      { width: 240, height: 180 },
      { viewport, preferredWidth: 240, placement: "bottom", align: "end" },
    );

    assert.equal(position.left >= 8, true);
    assert.equal(position.left + position.width <= viewport.width - 8, true);
  });

  it("shrinks a wide mobile panel to the available viewport width", () => {
    const position = resolveFloatingPosition(
      rect(120, 80, 32, 32),
      { width: 720, height: 220 },
      { viewport, preferredWidth: 720, placement: "bottom" },
    );

    assert.equal(position.width, viewport.width - 16);
    assert.equal(position.left, 8);
  });

  it("flips to the top when there is more usable room above", () => {
    const size = { width: 220, height: 180 };
    const position = resolveFloatingPosition(
      rect(180, 580, 32, 32),
      size,
      { viewport, preferredWidth: 220, placement: "bottom", align: "center" },
    );

    assert.equal(position.placement, "top");
    assert.equal(position.top + Math.min(size.height, position.maxHeight) <= 580, true);
  });

  it("clamps a virtual context-menu anchor near the lower-right corner", () => {
    const size = { width: 220, height: 260 };
    const position = resolveFloatingPosition(
      pointToFloatingRect({ x: 354, y: 632 }),
      size,
      { viewport, preferredWidth: 220, placement: "bottom", align: "start" },
    );

    assert.equal(position.left + position.width <= viewport.width - 8, true);
    assert.equal(position.top + Math.min(size.height, position.maxHeight) <= viewport.height - 8, true);
  });
});
