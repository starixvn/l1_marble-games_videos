# How to Use scripts/copy.js

Copy in rendered folder to deployments

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

# How to use scripts/ffmpeg.js

## Overview

The `ffmpeg.js` script is a Node.js utility that automatically converts MP4 video files to HLS (HTTP Live Streaming) format with multiple quality levels and encryption. It's designed to process video files in bulk, converting them to streaming-ready formats for web delivery.

## Usage

### Basic Command

```bash
node scripts/ffmpeg.js <theme>
```

### Parameters

- `<theme>` (required): The theme/directory name to process videos for
  - Must be a valid theme directory under `//ds925p.nexdev.net/paradigm/deployments/`
  - Examples: `galaxy`, `epl_ars`, `epl_che`, `epl_liv`, `epl_mci`, `epl_mun`, `epl_tot`, `youtube`

## Output Structure

For each processed video file, the script creates:

```
target/deployments/theme/filename/
├── filename.m3u8          # Master playlist file
├── filename_720p.m3u8     # 720p quality playlist
├── filename_240p.m3u8     # 240p quality playlist
├── filename_720p.ts       # 720p video segments
├── filename_240p.ts       # 240p video segments
└── filename.mp4           # Original source file
```
