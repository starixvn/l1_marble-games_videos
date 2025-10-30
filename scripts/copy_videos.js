const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { showProgress } = require("./progress");

/**
 * Configuration for different copy modes
 */
const COPY_MODES = {
  pingoal: {
    hasChannels: true,
    requiresMetadata: false,
    fileTypes: [{ extension: ".mp4", prefix: "" }],
    parseGoal: (filename) => filename.split("_")[0],
    buildKey: (channel, goal) => `${channel}-${goal}`,
  },
  ultra_live: {
    hasChannels: false,
    requiresMetadata: true,
    fileTypes: [
      { extension: ".mp4", prefix: "" },
      { extension: ".json", prefix: "" },
      { extension: ".json", prefix: "event_" },
    ],
    parseGoal: (filename) => filename.split("_")[0],
    buildKey: (_, goal) => goal,
  },
  standard: {
    hasChannels: false,
    requiresMetadata: true,
    fileTypes: [
      { extension: ".mp4", prefix: "" },
      { extension: ".json", prefix: "" },
      { extension: ".json", prefix: "event_" },
    ],
    parseGoal: (filename) => filename.split("_")[0],
    buildKey: (_, goal) => goal,
  },
};

/**
 * Reads all MP4 files from a directory and groups them by goal sequence
 * @param {string} directoryPath - Path to the directory containing MP4 files
 * @param {Object} config - Copy mode configuration
 * @returns {Record<string, Array>} Object with goal sequences as keys and arrays of file objects as values
 */
function readAllFiles(directoryPath, config) {
  console.log(`📁 Scanning directory: ${directoryPath}`);
  const result = {};

  if (config.hasChannels) {
    return readChannelFiles(directoryPath, config);
  }

  const files = fs.readdirSync(directoryPath);
  const mp4Files = files.filter((f) => f.endsWith(".mp4"));
  let processedCount = 0;

  for (const file of mp4Files) {
    const goal = config.parseGoal(file);
    const key = config.buildKey(null, goal);

    // Check for required metadata
    if (config.requiresMetadata) {
      const metaFile = file.replace(".mp4", ".json");
      const metaPath = path.join(directoryPath, metaFile);

      if (!fs.existsSync(metaPath)) {
        console.warn(
          `⚠️  Warning: Cannot find metadata file ${metaFile} for ${file}`,
        );
        continue;
      }

      if (!result[key]) result[key] = [];
      result[key].push({ file, meta: metaFile });
    } else {
      if (!result[key]) result[key] = [];
      result[key].push({ file });
    }

    processedCount++;
    showProgress(processedCount, mp4Files.length, "Scanning files");
  }

  const totalFiles = Object.values(result).flat().length;
  console.log(
    `\n✅ Found ${Object.keys(result).length} goal sequences with ${totalFiles} video files`,
  );

  return result;
}

/**
 * Reads files organized by channels
 * @param {string} directoryPath - Path to the directory containing channel folders
 * @param {Object} config - Copy mode configuration
 * @returns {Record<string, Array>} Object with goal sequences as keys
 */
function readChannelFiles(directoryPath, config) {
  const result = {};
  const channels = fs.readdirSync(directoryPath);

  for (const channel of channels) {
    const channelPath = path.join(directoryPath, channel);
    if (!fs.statSync(channelPath).isDirectory()) continue;

    const files = fs.readdirSync(channelPath);
    const mp4Files = files.filter((f) => f.endsWith(".mp4"));
    let processedCount = 0;

    for (const file of mp4Files) {
      const goal = config.parseGoal(file);
      const key = config.buildKey(channel, goal);

      if (!result[key]) result[key] = [];
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
    `\n✅ Found ${Object.keys(result).length} goal sequences with ${totalFiles} video files`,
  );

  return result;
}

/**
 * Builds metadata structure for all files, avoiding duplicates
 * @param {Record<string, Array>} files - Files grouped by goal sequence
 * @param {Record<string, Array>} metadata - Existing metadata
 * @param {string} version - Version identifier (optional)
 * @param {Object} config - Copy mode configuration
 * @returns {Record<string, Array>} Updated metadata
 */
function buildMetadata(files, metadata, version, config) {
  const versionInfo = version ? ` for version: ${version}` : "";
  console.log(`🔧 Building metadata${versionInfo}`);

  const allFiles = Object.values(files).flat();
  let processedCount = 0;
  let skippedCount = 0;

  for (const [key, fileList] of Object.entries(files)) {
    if (!metadata[key]) {
      metadata[key] = [];
    }

    for (const fileData of fileList) {
      // Build unique identifier for duplicate checking
      const uniqueId = version
        ? `${version}_${fileData.file}`
        : config.hasChannels
          ? `${fileData.channel}_${fileData.file}`
          : fileData.file;

      const existingFiles = new Set(
        metadata[key].map((f) =>
          f.version
            ? `${f.version}_${f.filename}`
            : f.channel
              ? `${f.channel}_${f.filename}`
              : f.filename,
        ),
      );

      if (existingFiles.has(uniqueId)) {
        skippedCount++;
        continue;
      }

      const index = metadata[key].length;
      const goal = config.parseGoal(fileData.file);
      const newName = crypto
        .createHash("sha256")
        .update(`${key}-${index}`, "utf8")
        .digest("hex");

      const metaEntry = {
        filename: fileData.file,
        new_name: newName,
        index: index,
        key: goal,
      };

      if (version) metaEntry.version = version;
      if (fileData.channel) metaEntry.channel = fileData.channel;
      if (fileData.meta) metaEntry.meta = fileData.meta;

      metadata[key].push(metaEntry);

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
 * @param {Object} config - Copy mode configuration
 */
function copyFile(inputFolder, outputFolder, meta, config) {
  const sources = [];

  // Determine source path based on whether channels are used
  const basePath = meta.channel
    ? path.join(inputFolder, meta.channel)
    : inputFolder;

  // Add MP4 file
  sources.push({
    source: path.join(basePath, meta.filename),
    extension: ".mp4",
    prefix: "",
  });

  // Add metadata files if required
  if (config.requiresMetadata && meta.meta) {
    sources.push({
      source: path.join(basePath, meta.meta),
      extension: ".json",
      prefix: "",
    });
    sources.push({
      source: path.join(basePath, `event_${meta.meta}`),
      extension: ".json",
      prefix: "event_",
    });
  }

  // Create target folder
  const targetFolder = meta.channel
    ? path.join(outputFolder, meta.channel, meta.new_name)
    : path.join(outputFolder, meta.new_name);

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Copy all files
  for (const { source, extension, prefix } of sources) {
    if (!fs.existsSync(source)) continue;

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
 * @param {Object} config - Copy mode configuration
 */
function copyAllFiles(metadata, inputPath, outputPath, config) {
  const allFiles = Object.values(metadata).flat();
  let copiedCount = 0;
  let errorCount = 0;

  for (const key of Object.keys(metadata)) {
    for (const meta of metadata[key]) {
      try {
        copyFile(inputPath, outputPath, meta, config);
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
 * @param {Object} config - Copy mode configuration
 * @returns {Record<string, number>} Summary with goal sequences and their counts
 */
function generateSummary(metadata, config) {
  console.log(`📊 Generating summary...`);

  let result = {};
  let totalCount = 0;

  // For pingoal mode, organize by channel
  if (config.hasChannels) {
    const entries = Object.values(metadata)
      .flat()
      .reduce((acc, curr) => {
        if (!acc[curr.channel]) {
          acc[curr.channel] = {};
        }
        if (!acc[curr.channel][curr.key]) {
          acc[curr.channel][curr.key] = [];
        }
        acc[curr.channel][curr.key].push(curr);
        return acc;
      }, {});

    for (const [channel, goals] of Object.entries(entries)) {
      if (!result[channel]) {
        result[channel] = {};
      }
      for (const [goal, files] of Object.entries(goals)) {
        result[channel][goal] = files.length;
        totalCount += files.length;
      }
    }
  } else {
    // Standard mode: count by goal sequence
    for (const [goalSequence, files] of Object.entries(metadata)) {
      result[goalSequence] = files.length;
      totalCount += files.length;
    }
  }

  console.log(
    `📈 Summary: ${totalCount} total files across ${Object.keys(result).length} ${config.hasChannels ? "channels" : "goal sequences"}`,
  );

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
 * Validates and parses command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed configuration
 */
function parseArguments(args) {
  const mode = args[2];
  const theme = args[3];
  const version = args[4];

  if (!mode || !COPY_MODES[mode]) {
    console.error("❌ Error: Invalid or missing mode");
    console.error(
      "Usage: node copy_videos.js <mode> <theme> [blender_version]",
    );
    console.error("Modes: pingoal, ultra_live, standard");
    console.error("Examples:");
    console.error("  node copy_videos.js pingoal soccerpingoal");
    console.error("  node copy_videos.js ultra_live galaxy 3.6");
    console.error("  node copy_videos.js standard galaxy 3.6");
    process.exit(1);
  }

  if (!theme) {
    console.error("❌ Error: Missing theme argument");
    process.exit(1);
  }

  if (mode !== "pingoal" && !version) {
    console.error(
      "❌ Error: Blender version required for ultra_live and standard modes",
    );
    process.exit(1);
  }

  return { mode, theme, version };
}

/**
 * Builds file paths based on mode and theme
 * @param {string} mode - Copy mode
 * @param {string} theme - Theme name
 * @param {string} version - Version identifier (optional)
 * @returns {Object} Paths object
 */
function buildPaths(mode, theme, version) {
  const fileServer = "//ds925p.nexdev.net/paradigm";

  switch (mode) {
    case "pingoal":
      return {
        inputPath: `${fileServer}/resources/${theme}`,
        outputPath: `${fileServer}/deployments/${theme}`,
        metaPath: `./themes/${theme}/meta.json`,
        summaryPath: `./themes/${theme}/summary.json`,
      };

    case "ultra_live":
      return {
        inputPath: `${fileServer}/resources/spinner_soccer_${theme}/Batch_${version}/ultra_live/output`,
        outputPath: `${fileServer}/deployments/ultra_live_${theme}`,
        metaPath: `./themes/ultra_live_${theme}/meta.json`,
        summaryPath: `./themes/ultra_live_${theme}/summary.json`,
      };

    case "standard":
      return {
        inputPath: `${fileServer}/resources/spinner_soccer_${theme}/Batch_${version}/output`,
        outputPath: `${fileServer}/deployments/${theme}`,
        metaPath: `./themes/${theme}/meta.json`,
        summaryPath: `./themes/${theme}/summary.json`,
      };

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

/**
 * Main execution function
 */
function main() {
  // Parse arguments
  const { mode, theme, version } = parseArguments(process.argv);
  const config = COPY_MODES[mode];

  const versionInfo = version ? `, Blender version: ${version}` : "";
  console.log(
    `🎬 Starting video conversion\n   Mode: ${mode}\n   Theme: ${theme}${versionInfo}`,
  );
  console.log("=".repeat(60));

  // Build paths
  const { inputPath, outputPath, metaPath, summaryPath } = buildPaths(
    mode,
    theme,
    version,
  );

  console.log(`📂 Input path: ${inputPath}`);
  console.log(`📂 Output path: ${outputPath}`);
  console.log(`📄 Metadata path: ${metaPath}`);

  // Step 1: Read all files
  console.log("\n🔍 Step 1: Reading input files...");
  const files = readAllFiles(inputPath, config);

  // Step 2: Load metadata
  console.log("\n📖 Step 2: Loading metadata...");
  let metadata = loadMetadata(metaPath);

  // Step 3: Build metadata
  console.log("\n🔧 Step 3: Building metadata...");
  metadata = buildMetadata(files, metadata, version, config);

  // Step 4: Save metadata
  console.log("\n💾 Step 4: Saving metadata...");
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 4));
  console.log(`✅ Metadata saved to: ${metaPath}`);

  // Step 5: Copy files
  console.log("\n📋 Step 5: Copying files...");
  copyAllFiles(metadata, inputPath, outputPath, config);

  // Step 6: Generate and save summary
  console.log("\n📊 Step 6: Generating summary...");
  const summary = generateSummary(metadata, config);
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
