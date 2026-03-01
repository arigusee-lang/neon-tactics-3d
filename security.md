# Multiplayer Security Notes

This file tracks known multiplayer trust issues that are distinct from ordinary gameplay bugs.

Current architecture note:
- The game no longer lets every client overwrite full state freely.
- However, the active simulation still runs on a designated authority peer, not on the server.
- Because of that, command payload validation still matters. Several action handlers trust client-provided IDs too much.

## Open Issues

### 1. Forged `SUICIDE_PROTOCOL` / `DRONE_DETONATE` against enemy units

Severity: High

Summary:
- A malicious client can send `SUICIDE_PROTOCOL` or `DRONE_DETONATE` with an enemy `unitId`.
- The server turn-gates the action but does not validate that the targeted unit belongs to the acting player.
- On the authority-side handler, ownership checks are skipped for remote execution.

Relevant code:
- [server.js](/C:/Users/artur/git/neon-tactics-3d/server.js#L233)
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts#L3414)
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts#L3452)

Impact:
- An attacker can force an opponent heavy or suicide drone to self-destruct.

Recommended fix:
- Validate on authority execution that the resolved unit:
- belongs to the acting player
- matches the expected unit type
- is legally usable this turn

### 2. Forged `MIND_CONTROL_BREAK` against opponent hacker

Severity: High

Summary:
- A malicious client can send `MIND_CONTROL_BREAK` with the enemy hacker's ID.
- The server only checks turn ownership of the socket, not ownership of the hacker unit referenced in payload.
- `breakMindControl()` does not verify unit type or ownership before severing the link.

Relevant code:
- [server.js](/C:/Users/artur/git/neon-tactics-3d/server.js#L233)
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts#L2316)
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts#L3012)

Impact:
- An attacker can cancel the opponent's active mind-control effect.

Recommended fix:
- Validate on authority execution that the hacker:
- belongs to the acting player
- is actually a `HACKER`
- currently has a valid linked target

### 3. Forged `FREEZE_TARGET` with invalid source unit

Severity: Medium-High

Summary:
- A malicious client can send `FREEZE_TARGET` using an arbitrary source unit ID.
- The server does not validate the source unit.
- `handleFreezeTarget()` only checks that source and target exist, then applies the freeze and deducts energy.

Relevant code:
- [server.js](/C:/Users/artur/git/neon-tactics-3d/server.js#L233)
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts#L2830)

Impact:
- An attacker can apply freeze through units that should not have that ability, or possibly through units that should not be able to act.

Recommended fix:
- Validate on authority execution that the source unit:
- belongs to the acting player
- is the correct unit type for the ability
- has enough energy
- is otherwise eligible to use the ability

### 4. Forged `TALENT_CHOOSE` outside current offered options

Severity: Medium

Summary:
- `TALENT_CHOOSE` currently resolves from current `talentChoices`, then falls back to the global `TALENT_POOL`.
- That means a client can choose a valid talent ID that was never actually offered.

Relevant code:
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts#L558)

Impact:
- A malicious client can bypass the talent draft and pick any talent directly.

Recommended fix:
- Remove the fallback to `TALENT_POOL`.
- Only allow selection from `this.state.talentChoices`.

## Priority

Suggested order:
1. `SUICIDE_PROTOCOL` / `DRONE_DETONATE`
2. `MIND_CONTROL_BREAK`
3. `FREEZE_TARGET`
4. `TALENT_CHOOSE`

## Long-Term Direction

These issues exist because authoritative execution still runs on a client peer.

The durable fix is:
1. Move gameplay command validation and execution into a shared simulation layer.
2. Run that simulation on the server.
3. Treat client payloads as intents, not trusted game facts.
