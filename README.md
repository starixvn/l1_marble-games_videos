# How to Use scripts/copy.js

## Requirements

- Node.js (version 12 or higher)
- Access to the network file server (`//ds925p.nexdev.net/paradigm`)
- Input directory containing `.mp4` files and their corresponding `.json` metadata files (named the same as the video, but with `.json` extension)

## Usage

```sh
node scripts/copy.js <theme> <blender_version>
```

- `<theme>`: The theme name (e.g., `galaxy`, `arsenal`, `manchester_united`)
- `<blender_version>`: Blender version number (e.g., `2`, `3.6`)

## File Structure

The script expects the following structure:

- Input: `//ds925p.nexdev.net/paradigm/resources/spinner_soccer_{theme}/Batch_{version}/output/`
- Output: `//ds925p.nexdev.net/paradigm/deployments/{theme}/`
- Metadata: `./themes/{theme}/meta.json`
- Summary: `./themes/{theme}/summary.json`
