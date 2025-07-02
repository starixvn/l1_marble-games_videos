# How to Use scripts/convert.py

## Purpose

`convert.py` processes `.mp4` video files and their corresponding `.json` metadata files from an input directory, organizes them into an output directory, updates a `meta.json` file, and prints a summary.

## Requirements

- Python 3.x
- Input directory containing `.mp4` files and their corresponding `.json` metadata files (named the same as the video, but with `.json` extension)
- An existing `meta.json` file (should be a valid JSON object, e.g., `{}` if starting fresh)

## Usage

```sh
python scripts/convert.py <input_path> <output_path> <meta_path> <blender_version>
```

- `<input_path>`: Directory containing your `.mp4` and `.json` files.
- `<output_path>`: Directory where processed files will be stored.
- `<meta_path>`: Path to the `meta.json` file to update.
- `<blender_version>`: Version number to record in the metadata (integer).

## Example

Suppose you have:

- Input files in `\\ds925p.nexdev.net\paradigm\spinner_soccer_galaxy\Batch_2\output`
- Output directory at `\\ds925p.nexdev.net\paradigm\deployments\galaxy`
- A `meta.json` file in `.\meta.json` (create one with `{}` if it doesn't exist)
- Blender version is `2`

Run:

```sh
python scripts/convert.py \\ds925p.nexdev.net\paradigm\spinner_soccer_galaxy\Batch_2\output \\ds925p.nexdev.net\paradigm\deployments\galaxy .\meta_galaxy.json 2
```

## What it does

- Scans the input directory for `.mp4` files with matching `.json` metadata.
- For each new file, creates a hashed subdirectory in the output directory, copies the video and metadata, and updates `meta.json`.
- Prints a summary and writes a `summary.json` file.

## Notes

- If `meta.json` does not exist, create it with `{}` as its content.
- The script currently does not perform video conversion (the relevant line is commented out).
- The script will print "Done" when finished.
