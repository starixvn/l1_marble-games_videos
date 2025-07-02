# How to Use scripts/check_file.py

## Purpose

`check_file.py` processes `.mp4` video files and their corresponding `.json` metadata files from an input directory, organizes them into an output directory, updates a `meta.json` file, and prints a summary.

## Requirements

- Python 3.x
- Input directory containing `.mp4` files and their corresponding `.json` metadata files (named the same as the video, but with `.json` extension)
- An existing `meta.json` file (should be a valid JSON object, e.g., `{}` if starting fresh)

## Usage

```sh
python scripts/check_file.py <input_path> <output_path>
```

- `<input_path>`: Directory containing your `.mp4` and `.json` files.
- `<output_path>`: Directory where processed files will be stored.
- The script expects a `meta.json` file in the current working directory.

## Example

Suppose you have:

- Input files in `\\ds925p.nexdev.net\paradigm\spinner_soccer_galaxy\Batch_2\output`
- Output directory at `\\ds925p.nexdev.net\paradigm\upload_galaxy`
- A `meta.json` file in `D:\Task\Streaming\Marble Football\videos\` (create one with `{}` if it doesn't exist)

Run:

```sh
cd D:\Task\Streaming\Marble Football\videos
python scripts/check_file.py input output
```

## What it does

- Scans the input directory for `.mp4` files with matching `.json` metadata.
- For each new file, creates a hashed subdirectory in the output directory, copies the video and metadata, and updates `meta.json`.
- Prints a summary and writes a `summary.json` file.

## Notes

- If `meta.json` does not exist, create it with `{}` as its content.
- The script currently does not perform video conversion (the relevant line is commented out).
- The script will print "Done" when finished.
