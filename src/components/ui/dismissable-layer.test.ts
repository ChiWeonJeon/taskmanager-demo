import assert from "node:assert/strict";
import test from "node:test";
import { DismissableLayerStack } from "@/components/ui/dismissable-layer";

test("DismissableLayerStack tracks only the topmost active layer", () => {
  const stack = new DismissableLayerStack();

  stack.add({ id: "panel", closeOnEscape: true });
  stack.add({ id: "confirm", closeOnEscape: true });

  assert.equal(stack.isTop("panel"), false);
  assert.equal(stack.isTop("confirm"), true);

  stack.remove("confirm");

  assert.equal(stack.isTop("panel"), true);
});

test("DismissableLayerStack replaces duplicate layer ids", () => {
  const stack = new DismissableLayerStack();

  stack.add({ id: "panel", closeOnEscape: true });
  stack.add({ id: "panel", closeOnEscape: false });

  assert.deepEqual(stack.top(), { id: "panel", closeOnEscape: false });
});
