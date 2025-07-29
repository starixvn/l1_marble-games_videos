const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
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
 * Counts total files in a directory recursively
 * @param {string} sourceDir - Source directory
 * @param {string} currentPath - Current path being processed
 * @returns {number} Total number of files
 */
function countFilesRecursively(sourceDir, currentPath = "") {
  let fileCount = 0;

  try {
    const items = fs.readdirSync(path.join(sourceDir, currentPath));

    for (const item of items) {
      const fullPath = path.join(sourceDir, currentPath, item);
      const relativePath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively count files in subdirectories
        fileCount += countFilesRecursively(sourceDir, relativePath);
      } else {
        fileCount++;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  Warning: Error reading directory ${path.join(
        sourceDir,
        currentPath,
      )}: ${error.message}`,
    );
  }

  return fileCount;
}

/**
 * Recursively copies all files from source to destination with flattened structure
 * @param {string} sourceDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string} currentPath - Current path being processed
 * @param {number} totalFiles - Total number of files to copy
 * @param {number} processedFiles - Number of files already processed
 * @returns {number} Number of files copied
 */
function copyFilesRecursively(
  sourceDir,
  destDir,
  currentPath = "",
  totalFiles = 0,
  processedFiles = 0,
) {
  let fileCount = 0;

  try {
    const items = fs.readdirSync(path.join(sourceDir, currentPath));

    for (const item of items) {
      const fullPath = path.join(sourceDir, currentPath, item);
      const relativePath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively copy subdirectories
        const subCount = copyFilesRecursively(
          sourceDir,
          destDir,
          relativePath,
          totalFiles,
          processedFiles + fileCount,
        );
        fileCount += subCount;
      } else {
        // Copy file to flattened structure
        const destPath = path.join(destDir, item);

        // If file already exists, add a unique suffix
        let finalDestPath = destPath;
        let counter = 1;
        while (fs.existsSync(finalDestPath)) {
          const ext = path.extname(item);
          const name = path.basename(item, ext);
          finalDestPath = path.join(destDir, `${name}_${counter}${ext}`);
          counter++;
        }

        fs.copyFileSync(fullPath, finalDestPath);
        fileCount++;

        // Show progress
        if (totalFiles > 0) {
          showProgress(processedFiles + fileCount, totalFiles, "Copying files");
        }
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  Warning: Error reading directory ${path.join(
        sourceDir,
        currentPath,
      )}: ${error.message}`,
    );
  }

  return fileCount;
}

/**
 * Creates a temporary directory with a unique name
 * @param {string} theme - Theme name for the temp directory
 * @param {string} deploymentPath - Base deployment path
 * @returns {string} Path to the temporary directory
 */
function createTempDirectory(theme, deploymentPath) {
  const tempDir = path.join(deploymentPath, `temp_${theme}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Removes a directory and all its contents recursively
 * @param {string} dirPath - Path to the directory to remove
 */
function removeDirectoryRecursively(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      removeDirectoryRecursively(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }

  fs.rmdirSync(dirPath);
}

/**
 * Creates a zip file from a directory
 * @param {string} sourceDir - Directory to zip
 * @param {string} zipPath - Path for the output zip file
 */
function createZipFile(sourceDir, zipPath) {
  try {
    // Use PowerShell's Compress-Archive on Windows
    const command = `powershell -command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    execSync(command, { stdio: "inherit" });
    console.log(`✅ Zip file created: ${zipPath}`);
  } catch (error) {
    console.error(`❌ Error creating zip file: ${error.message}`);
    throw error;
  }
}

/**
 * Main execution function
 */
function main() {
  const theme = process.argv[2];

  if (!theme) {
    console.error("❌ Error: Missing required argument");
    console.error("Usage: node zip.js <theme>");
    console.error("Example: node zip.js arsenal");
    process.exit(1);
  }

  console.log(`📦 Starting zip creation for theme: ${theme}`);
  console.log("=".repeat(60));

  // Configuration
  const fileServer = "//ds925p.nexdev.net/paradigm";
  const deploymentPath = `${fileServer}/deployments/${theme}`;
  const archivedPath = `${fileServer}/deployments/archived`;
  const tempDir = createTempDirectory(theme, `${fileServer}/deployments`);
  const zipFileName = `${theme}.zip`;
  const zipPath = path.join(archivedPath, zipFileName);
  const finalZipPath = path.join(archivedPath, zipFileName);

  console.log(`📂 Deployment path: ${deploymentPath}`);
  console.log(`📁 Temporary directory: ${tempDir}`);
  console.log(`📦 Zip file: ${zipPath}`);
  console.log(`📦 Final zip file: ${finalZipPath}`);

  try {
    // Step 1: Count total files first
    console.log("\n📊 Step 1: Counting files...");
    const totalFiles = countFilesRecursively(deploymentPath);
    console.log(`📈 Found ${totalFiles} files to process`);

    // Step 2: Copy all files to temp directory with flattened structure
    console.log("\n📋 Step 2: Copying files to temporary directory...");
    const fileCount = copyFilesRecursively(
      deploymentPath,
      tempDir,
      "",
      totalFiles,
      0,
    );
    console.log(`\n✅ Copied ${fileCount} files to temporary directory`);

    // Step 3: Create zip file
    console.log("\n🗜️  Step 3: Creating zip file...");
    createZipFile(tempDir, zipPath);

    // Step 4: Ensure archived directory exists
    console.log("\n📋 Step 4: Ensuring archived directory exists...");
    if (!fs.existsSync(archivedPath)) {
      fs.mkdirSync(archivedPath, { recursive: true });
    }
    console.log(`✅ Archived directory ready: ${archivedPath}`);

    // Step 5: Clean up temporary files
    console.log("\n🧹 Step 5: Cleaning up temporary files...");
    removeDirectoryRecursively(tempDir);
    console.log("✅ Temporary files cleaned up");

    console.log("\n" + "=".repeat(60));
    console.log(`🎉 Zip creation completed successfully!`);
    console.log(`📦 Zip file: ${zipPath}`);
    console.log(`📊 Total files processed: ${fileCount}`);
  } catch (error) {
    console.error(`\n❌ Error during zip creation: ${error.message}`);

    // Clean up on error
    console.log("\n🧹 Cleaning up on error...");
    if (fs.existsSync(tempDir)) {
      removeDirectoryRecursively(tempDir);
    }

    process.exit(1);
  }
}

// Run the main function
main();
