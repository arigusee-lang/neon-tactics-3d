# Maps Directory

This directory stores JSON maps loaded by the game at startup.

## Map Metadata

Each map JSON can now include:

```json
{
  "description": "Optional text shown in the map picker.",
  "players": 2,
  "mode": "duel"
}
```

`players` supports:

- `2`
- `3`
- `4`
- `"dev"` for maps that should stay out of multiplayer and only appear in solo/dev flows

If `players` is omitted, the game currently defaults it to `2`.

`mode` supports:

- `"duel"`
- `"team_2v1"`
- `"team_2v2"`
- `"ffa"`

Each map should define exactly one mode. If `mode` is omitted, the game currently falls back to:

- `duel` for 2-player maps
- `team_2v1` for 3-player maps
- `team_2v2` for 4-player maps

## Core Map Shape

```json
{
  "description": "Optional text",
  "players": 2,
  "mode": "duel",
  "mapSize": { "x": 12, "y": 12 },
  "mapOrigin": { "x": 10, "z": 10 },
  "deletedTiles": [],
  "terrain": {},
  "units": [],
  "collectibles": []
}
```

`description` is optional. `players` is optional in old files, but new exports should include it.
