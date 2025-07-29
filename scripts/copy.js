const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Simple progress bar utility
 * @param {number} current - Current progress value
 * @param {number} total - Total value
 * @param {string} label - Label for the progress bar
 * @param {number} width - Width of the progress bar
 */
function showProgress(current, total, label = "Progress", width = 30) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((width * current) / total);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);
  process.stdout.write(
    `\r${label}: [${bar}] ${percentage}% (${current}/${total})`,
  );

  if (current === total) {
    process.stdout.write("\n");
  }
}

/**
 * Reads all MP4 files from a directory and groups them by goal sequence
 * @param {string} directoryPath - Path to the directory containing MP4 files
 * @returns {Record<string, [string, string][]>} Object with goal sequences as keys and arrays of [file, meta] pairs as values
 */
function readAllFiles(directoryPath) {
  console.log(`📁 Scanning directory: ${directoryPath}`);

  const files = fs.readdirSync(directoryPath);
  const mp4Files = files.filter((f) => f.endsWith(".mp4"));
  const result = {};
  let processedCount = 0;

  for (const file of mp4Files) {
    const goal = file.split("_")[0];
    const goalMeta = file.replace(".mp4", ".json");
    const metaPath = path.join(directoryPath, goalMeta);

    if (!fs.existsSync(metaPath)) {
      console.warn(
        `⚠️  Warning: Cannot find metadata file ${goalMeta} for ${file}`,
      );
      continue;
    }

    if (!result[goal]) {
      result[goal] = [];
    }

    result[goal].push([file, goalMeta]);
    processedCount++;
    showProgress(processedCount, mp4Files.length, "Scanning files");
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
 * @param {Record<string, [string, string][]>} files - Files grouped by goal sequence
 * @param {Record<string, Array>} metadata - Existing metadata
 * @param {string} version - Blender version
 * @returns {Record<string, Array>} Updated metadata
 */
function buildMetadata(files, metadata, version) {
  console.log(`🔧 Building metadata for version: ${version}`);

  const allFiles = Object.values(files).flat();
  let processedCount = 0;
  let skippedCount = 0;

  for (const [goalSequence, fileList] of Object.entries(files)) {
    if (!metadata[goalSequence]) {
      metadata[goalSequence] = [];
    }

    for (const [file, meta] of fileList) {
      const existingFiles = new Set(
        metadata[goalSequence].map((f) => `${f.version}_${f.filename}`),
      );

      if (existingFiles.has(`${version}_${file}`)) {
        skippedCount++;
        continue;
      }

      const index = metadata[goalSequence].length;
      const newName = crypto
        .createHash("sha256")
        .update(`${goalSequence}-${index}`, "utf8")
        .digest("hex");

      metadata[goalSequence].push({
        filename: file,
        version: version,
        meta: meta,
        new_name: newName,
        index: index,
      });

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
    { source: path.join(inputFolder, meta.filename), extension: ".mp4" },
    { source: path.join(inputFolder, meta.meta), extension: ".json" },
  ];

  const targetFolder = path.join(outputFolder, meta.new_name);

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  for (const { source, extension } of sources) {
    if (!fs.existsSync(source)) {
      continue;
    }

    const target = path.join(targetFolder, meta.new_name + extension);

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
  const allFiles = Object.values(metadata).flat();
  let copiedCount = 0;
  let errorCount = 0;

  console.log(`📋 Copying ${allFiles.length} files to output directory...`);

  for (const goalSequence of Object.keys(metadata)) {
    for (const meta of metadata[goalSequence]) {
      try {
        copyFile(inputPath, outputPath, meta);
        copiedCount++;
      } catch (error) {
        errorCount++;
        console.warn(`⚠️  Error copying ${meta.filename}: ${error.message}`);
      }

      showProgress(copiedCount + errorCount, allFiles.length, "Copying files");
    }
  }

  console.log(
    `\n✅ Copying completed - ${copiedCount} successful, ${errorCount} errors`,
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

  for (const [goalSequence, files] of Object.entries(metadata)) {
    const count = files.length;
    result[goalSequence] = count;
    totalCount += count;
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
  const blenderVersion = process.argv[3];

  if (!theme || !blenderVersion) {
    console.error("❌ Error: Missing required arguments");
    console.error("Usage: node copy.js <theme> <blender_version>");
    console.error("Example: node copy.js galaxy 3.6");
    process.exit(1);
  }

  console.log(
    `🎬 Starting video conversion for theme: ${theme}, Blender version: ${blenderVersion}`,
  );
  console.log("=".repeat(60));

  // Configuration
  const fileServer = "//ds925p.nexdev.net/paradigm";
  const inputPath = `${fileServer}/resources/spinner_soccer_${theme}/Batch_${blenderVersion}/output`;
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

  // Step 3: Build metadata
  console.log("\n🔧 Step 3: Building metadata...");
  metadata = buildMetadata(files, metadata, blenderVersion);

  // Step 4: Save metadata
  console.log("\n💾 Step 4: Saving metadata...");
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 4));
  console.log(`✅ Metadata saved to: ${metaPath}`);

  // Step 5: Copy files
  console.log("\n📋 Step 5: Copying files...");
  copyAllFiles(metadata, inputPath, outputPath);

  // Step 6: Generate and save summary
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
