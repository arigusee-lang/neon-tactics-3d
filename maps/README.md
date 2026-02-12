# Maps Directory

This directory is used to store map JSON files exported from the Dev Mode Map Editor.

## How to use:

1.  **Enable Dev Mode**: Set `isDevMode: true` in `gameService.ts` or use a dev toggle if available.
2.  **Edit Map**: Use the Map Editor tools to create your map layout and place units.
3.  **Export**: Click the "Export Map JSON" button in the Map Editor panel.
4.  **Save**: The file will be downloaded to your default Downloads folder (e.g., `map_export_123456789.json`).
5.  **Import**: Move the downloaded JSON file into this `maps` directory. 
    *   (Future implementation will load maps from here).
