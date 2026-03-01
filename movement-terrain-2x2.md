# 2x2 Terrain Movement Gap

## Problem

The recent ramp/elevation fix only covers 1x1 units.

Large units, especially 2x2 units such as `HEAVY_TANK`, still do not correctly respect uneven terrain, ramps, or mixed-height footprints during movement.

Today the code effectively treats a 2x2 move as valid if:

- every destination cell exists
- every destination cell is revealed
- every destination cell is unoccupied

That means a 2x2 unit can still move onto terrain configurations that should be illegal, including:

- a footprint spread across incompatible heights
- entering elevated ground without a valid ramp transition
- crossing a ramp/platform edge where only part of the footprint has legal support

## Current Code References

### Pathfinding skips terrain-edge checks for large units

In [utils/pathfinding.ts](./utils/pathfinding.ts), the new terrain traversal rule is only applied for `unitSize === 1`:

- `canTraverseTerrainEdge(...)` is imported and used at:
  - [utils/pathfinding.ts:108](./utils/pathfinding.ts#L108)

Current behavior:

- 1x1 units validate elevation/ramp transitions
- 2x2 units only use the old footprint collision checks

### Move validation also skips terrain-edge checks for large units

In [services/gameService.ts](./services/gameService.ts), the new validation helpers explicitly bypass terrain-edge validation for units larger than 1:

- occupancy / footprint validation:
  - [services/gameService.ts:4000](./services/gameService.ts#L4000)
- full move path validation:
  - [services/gameService.ts:4020](./services/gameService.ts#L4020)
- 1x1-only terrain edge check inside full path validation:
  - [services/gameService.ts:4042](./services/gameService.ts#L4042)
- per-step execution validation:
  - [services/gameService.ts:4052](./services/gameService.ts#L4052)
- 1x1-only terrain edge check inside step execution:
  - [services/gameService.ts:4062](./services/gameService.ts#L4062)

### Terrain semantics now exist, but only at single-tile edge level

The shared terrain traversal logic lives in:

- [utils/terrainTraversal.ts:14](./utils/terrainTraversal.ts#L14)
- [utils/terrainTraversal.ts:62](./utils/terrainTraversal.ts#L62)

That module currently answers:

- what direction a 1-tile step moves in
- what edge height a tile exposes on a given side
- whether one tile can traverse into another tile across a shared edge

It does not yet answer:

- whether an entire 2x2 footprint can move from one anchor position to another
- whether all exposed footprint edges line up to a valid shared surface

## Why This Is Still Broken

For a 2x2 unit, legal movement is not a single tile-edge question. It is a footprint transition question.

When a 2x2 unit moves one tile east, west, north, or south:

- two leading-edge cells are entering new tiles
- two trailing-edge cells are leaving old tiles
- the full 2x2 destination footprint must remain internally consistent

So a correct rule needs to validate:

- every destination cell exists and is occupiable
- every cell in the destination footprint is on a compatible final standing height
- every leading-edge tile transition is legal across the moved edge

Without that, a 2x2 unit can still “bridge” illegal terrain states.

## Suggested Implementation Approach

## 1. Extend the terrain traversal module with footprint-aware helpers

Add a helper in [utils/terrainTraversal.ts](./utils/terrainTraversal.ts) along these lines:

- `canTraverseFootprintEdge(fromAnchor, toAnchor, unitSize, terrain)`

For `unitSize === 2`, this helper should:

- determine move direction
- build the old footprint cells
- build the new footprint cells
- identify the leading-edge cells entering the new space
- for each leading-edge cell, validate the terrain edge transition against the corresponding previous-edge cell

This keeps terrain semantics centralized instead of duplicating them in pathfinding and game service.

## 2. Add a “standing height consistency” check for the full destination footprint

A 2x2 unit should not end a move with one quadrant supported at a different final standing height than the others.

Suggested helper:

- `getStandingHeight(tile)` or `getTileSurfaceProfile(tile)`
- `isFootprintStandingSurfaceValid(anchor, unitSize, terrain)`

For now, the practical rule can stay simple:

- every tile under the final 2x2 footprint must resolve to the same standing surface height

That is a strong first version and much easier to reason about than partial multi-height support.

## 3. Use the new helper in pathfinding

Update [utils/pathfinding.ts](./utils/pathfinding.ts) so neighbor expansion does:

- footprint occupancy checks
- footprint terrain-transition checks
- footprint standing-surface checks

This should replace the current `unitSize === 1` special case rather than layering more exceptions on top.

## 4. Use the same helper in move validation and step execution

Update [services/gameService.ts](./services/gameService.ts):

- [services/gameService.ts:4020](./services/gameService.ts#L4020)
- [services/gameService.ts:4052](./services/gameService.ts#L4052)

Both preview-time validation and execution-time validation should call the same footprint-aware traversal logic.

That avoids another mismatch where preview blocks a move but execution still allows it, or vice versa.

## Recommended Shape

Prefer a shared API like:

```ts
canTraverseUnitStep(fromAnchor, toAnchor, unitSize, terrain): boolean
isUnitFootprintSurfaceValid(anchor, unitSize, terrain): boolean
```

Then:

- `findPath()` uses both
- `isValidMovePath()` uses both
- `canCompleteMoveStep()` uses both

## Out of Scope For This Pass

These can wait until after the main 2x2 fix:

- special-case partial ramp occupancy rules
- animation tweaks for large units on slopes
- attack / LOS interactions with multi-height large-unit footprints
- AI movement over ramps for large neutral units

## Summary

The current 1x1 terrain fix is correct, but 2x2 units still use pre-fix movement assumptions.

The right next step is not more special casing in `gameService.ts`. The right step is to generalize terrain traversal in [utils/terrainTraversal.ts](./utils/terrainTraversal.ts) so both pathfinding and execution can evaluate footprint movement with one shared rule set.
