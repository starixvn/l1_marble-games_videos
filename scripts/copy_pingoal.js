const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { showProgress } = require("./progress");

/**
 * Reads all MP4 files from a directory and groups them by goal sequence
 * @param {string} directoryPath - Path to the directory containing MP4 files
 * @returns {Record<string, [string, string][]>} Object with goal sequences as keys and arrays of [file, meta] pairs as values
 */
function readAllFiles(directoryPath) {
  console.log(`📁 Scanning directory: ${directoryPath}`);
  const result = {};

  const channels = fs.readdirSync(directoryPath);

  for (const channel of channels) {
    const files = fs.readdirSync(path.join(directoryPath, channel));
    const mp4Files = files.filter((f) => f.endsWith(".mp4"));

    let processedCount = 0;

    for (const file of mp4Files) {
      const goal = file.split("_")[0];
      const key = `${channel}-${goal}`;

      if (!result[key]) {
        result[key] = [];
      }

      result[key].push({ channel, file });
      processedCount++;
      showProgress(
        processedCount,
        mp4Files.length,
        `[${channel}] Scanning files`,
      );
    }
  }

  const totalFiles = Object.values(result).flat().length;
  console.log(
    `\n✅ Found ${
      Object.keys(result).length
    } goal sequences with ${totalFiles} video files`,
  );

  return result;
}

/**
 * Builds metadata structure for all files, avoiding duplicates
 * @param {Record<string, {channel: string, file: string}[]>} files - Files grouped by goal sequence
 * @param {Record<string, Array>} metadata - Existing metadata
 * @returns {Record<string, Array>} Updated metadata
 */
function buildMetadata(files, metadata) {
  console.log(`🔧 Building metadata`);

  const allFiles = Object.values(files).flat();
  let processedCount = 0;
  let skippedCount = 0;

  for (const [key, fileList] of Object.entries(files)) {
    if (!metadata[key]) {
      metadata[key] = [];
    }

    for (const data of fileList) {
      const { file, channel } = data;
      const existingFiles = new Set(
        metadata[key].map((f) => `${f.channel}_${f.filename}`),
      );

      if (existingFiles.has(`${channel}_${file}`)) {
        skippedCount++;
        continue;
      }

      const index = metadata[key].length;
      const result = file.split("_")[0];
      const newName = crypto
        .createHash("sha256")
        .update(`${key}-${index}`, "utf8")
        .digest("hex");
      const meta = {
        filename: file,
        channel: channel,
        new_name: newName,
        index: index,
        key: result,
      };

      metadata[key].push(meta);

      processedCount++;
      showProgress(processedCount, allFiles.length, "Building metadata");
    }
  }

  console.log(
    `\n✅ Metadata built successfully - ${processedCount} new entries, ${skippedCount} skipped`,
  );
  return metadata;
}

/**
 * Copies video and metadata files to the output directory
 * @param {string} inputFolder - Source directory
 * @param {string} outputFolder - Destination directory
 * @param {Object} meta - File metadata object
 */
function copyFile(inputFolder, outputFolder, meta) {
  const sources = [
    {
      source: path.join(inputFolder, meta.channel, meta.filename),
      extension: ".mp4",
      prefix: "",
    },
  ];
  const targetFolder = path.join(outputFolder, meta.channel, meta.new_name);

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  for (const { source, extension, prefix } of sources) {
    if (!fs.existsSync(source)) {
      continue;
    }

    const target = path.join(targetFolder, prefix + meta.new_name + extension);

    if (!fs.existsSync(target)) {
      fs.copyFileSync(source, target);
    }
  }
}

/**
 * Copies all files with progress tracking
 * @param {Record<string, Array>} metadata - Metadata containing file information
 * @param {string} inputPath - Input directory path
 * @param {string} outputPath - Output directory path
 */
function copyAllFiles(metadata, inputPath, outputPath) {
  let allFiles = Object.values(metadata).flat().length;
  let copiedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const key of Object.keys(metadata)) {
    for (const meta of metadata[key]) {
      try {
        copyFile(inputPath, outputPath, meta);
        copiedCount++;
      } catch (error) {
        errorCount++;
        console.warn(`⚠️  Error copying ${meta.filename}: ${error.message}`);
      }

      showProgress(copiedCount + errorCount, allFiles, "Copying files");
    }
  }

  console.log(
    `\n✅ Copying completed - ${copiedCount} successful, ${errorCount} errors, ${skippedCount} skipped`,
  );
}

/**
 * Generates a summary of the metadata
 * @param {Record<string, Array>} metadata - The metadata object
 * @returns {Record<string, number>} Summary with goal sequences and their counts
 */
function generateSummary(metadata) {
  console.log(`📊 Generating summary...`);

  const result = {};
  let totalCount = 0;

  const entries = Object.values(metadata)
    .flat()
    .reduce((acc, curr) => {
      if (acc[curr.channel]) {
        if (acc[curr.channel][curr.key]) {
          acc[curr.channel][curr.key].push(curr);
        } else {
          acc[curr.channel][curr.key] = [curr];
        }
      } else {
        acc[curr.channel] = {
          [curr.key]: [curr],
        };
      }

      return acc;
    }, {});

  for (const [channel, meta] of Object.entries(entries)) {
    if (!result[channel]) {
      result[channel] = {};
    }

    for (const [goal, files] of Object.entries(meta)) {
      const count = files.length;

      result[channel][goal] = count;

      totalCount += count;
    }
  }

  console.log(
    `📈 Summary: ${totalCount} total files across ${
      Object.keys(result).length
    } goal sequences`,
  );

  // Log breakdown
  Object.entries(result).forEach(([goal, count]) => {
    console.log(`   • ${goal}: ${count} files`);
  });

  return result;
}

/**
 * Loads or creates metadata file
 * @param {string} metaPath - Path to metadata file
 * @returns {Object} Metadata object
 */
function loadMetadata(metaPath) {
  if (!fs.existsSync(metaPath)) {
    console.log(`📝 Creating new metadata file: ${metaPath}`);
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify({}, null, 4));
    return {};
  }

  console.log(`📖 Loading existing metadata from: ${metaPath}`);
  return JSON.parse(fs.readFileSync(metaPath, "utf8"));
}

/**
 * Main execution function
 */
function main() {
  const theme = process.argv[2];

  if (!theme) {
    console.error("❌ Error: Missing required arguments");
    console.error("Usage: node copy_pingoal.js <theme>");
    console.error("Example: node copy_pingoal.js soccerpingoal");
    process.exit(1);
  }

  console.log(`🎬 Starting video conversion for theme: ${theme}`);
  console.log("=".repeat(60));

  // Configuration
  const fileServer = "//ds925p.nexdev.net/paradigm";
  const inputPath = `${fileServer}/resources/${theme}`;
  const outputPath = `${fileServer}/deployments/${theme}`;
  const metaPath = `./themes/${theme}/meta.json`;
  const summaryPath = `./themes/${theme}/summary.json`;

  console.log(`📂 Input path: ${inputPath}`);
  console.log(`📂 Output path: ${outputPath}`);
  console.log(`📄 Metadata path: ${metaPath}`);

  // Step 1: Read all files
  console.log("\n🔍 Step 1: Reading input files...");
  const files = readAllFiles(inputPath);

  // Step 2: Load metadata
  console.log("\n📖 Step 2: Loading metadata...");
  let metadata = loadMetadata(metaPath);

  // // Step 3: Build metadata
  console.log("\n🔧 Step 3: Building metadata...");
  metadata = buildMetadata(files, metadata);

  // // Step 4: Save metadata
  console.log("\n💾 Step 4: Saving metadata...");
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 4));
  console.log(`✅ Metadata saved to: ${metaPath}`);

  // // Step 5: Copy files
  console.log("\n📋 Step 5: Copying files...");
  copyAllFiles(metadata, inputPath, outputPath);

  // // Step 6: Generate and save summary
  console.log("\n📊 Step 6: Generating summary...");
  const summary = generateSummary(metadata);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 4));
  console.log(`✅ Summary saved to: ${summaryPath}`);

  console.log("\n" + "=".repeat(60));
  console.log(`🎉 Conversion completed successfully!`);
  console.log(
    `📊 Total files processed: ${Object.values(metadata).flat().length}`,
  );
}

// Run the main function
main();
