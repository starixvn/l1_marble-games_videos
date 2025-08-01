// Read all mp4 files in source path
// For each file, check if it has been converted
// If not, convert it
// If it has been converted, skip it

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { showProgress } = require("./progress");

function isAlreadyConverted(target, filename) {
  const fileDir = path.join(target, filename);
  const masterPlaylist = path.join(fileDir, `${filename}.m3u8`);

  return fs.existsSync(masterPlaylist);
}

function convertFile(filename, target) {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(target, filename);
    const filepath = path.join(outputDir, `${filename}.mp4`);
    const keyInfo = "keys/key.info";

    const command = [
      "ffmpeg",
      "-i",
      filepath,
      "-vf",
      "scale=1280:720",
      "-b:v",
      "2500k",
      "-b:a",
      "96k",
      "-force_key_frames",
      "expr:gte(t,n_forced*3)",
      "-hls_list_size",
      "0",
      "-hls_key_info_file",
      keyInfo,
      "-f",
      "hls",
      `${outputDir}/${filename}_720p.m3u8`,
      "-vf",
      "scale=426:240",
      "-b:v",
      "400k",
      "-b:a",
      "96k",
      "-force_key_frames",
      "expr:gte(t,n_forced*3)",
      "-hls_list_size",
      "0",
      "-hls_key_info_file",
      keyInfo,
      "-f",
      "hls",
      `${outputDir}/${filename}_240p.m3u8`,
    ];

    const ffmpeg = spawn(command[0], command.slice(1));

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        const masterFileArr = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          "#EXT-X-STREAM-INF:BANDWIDTH=744000",
          `${filename}_240p.m3u8`,
          "#EXT-X-STREAM-INF:BANDWIDTH=3894000",
          `${filename}_720p.m3u8`,
        ];
        const masterFilePath = path.join(outputDir, `${filename}.m3u8`);

        fs.writeFileSync(masterFilePath, masterFileArr.join("\n"));

        resolve();
      } else {
        reject(new Error(`ffmpeg process exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (error) => {
      const allFiles = fs.readdirSync(outputDir);

      allFiles.forEach((file) => {
        if (file.endsWith(".ts") || file.endsWith(".m3u8")) {
          fs.unlinkSync(path.join(outputDir, file));
        }
      });

      reject(new Error(`ffmpeg error: ${error.message}`));
    });
  });
}

function readAllFiles(source) {
  const files = fs.readdirSync(source, { recursive: true });

  return files.filter((file) => file.endsWith(".mp4"));
}

async function processVideos(target) {
  try {
    console.log(`\n🚀 Starting video processing for target: ${target}`);
    console.log(`📁 Scanning directory for MP4 files...`);

    // Read all mp4 files in source path
    const mp4Files = readAllFiles(target);

    if (mp4Files.length === 0) {
      console.log("❌ No MP4 files found in source directory");
      return;
    }

    console.log(`✅ Found ${mp4Files.length} MP4 files to process`);
    console.log(`\n🔄 Starting conversion process...\n`);

    let convertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < mp4Files.length; i++) {
      const filename = path.basename(mp4Files[i], ".mp4");

      if (isAlreadyConverted(target, filename)) {
        skippedCount++;
        showProgress(i + 1, mp4Files.length, `📊 Overall Progress`, 30);
        continue;
      }

      try {
        await convertFile(filename, target);

        convertedCount++;
      } catch (error) {
        console.error(`❌ Error converting ${filename}:`, error.message);
        errorCount++;
      }

      showProgress(i + 1, mp4Files.length, `📊 Overall Progress`, 30);
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`   ✅ Converted: ${convertedCount} files`);
    console.log(`   ⏭️  Skipped: ${skippedCount} files`);
    console.log(`   ❌ Errors: ${errorCount} files`);
    console.log(`   📁 Total processed: ${mp4Files.length} files`);
    console.log(`\n🎉 Video processing completed!`);
  } catch (error) {
    console.error("💥 Error processing videos:", error.message);
  }
}

const fileServer = "//ds925p.nexdev.net/paradigm";
const theme = process.argv[2];
const target = `${fileServer}/deployments/${theme}`;

if (!theme) {
  console.error("❌ Usage: node ffmpeg.js <theme>");
  console.error("   Example: node ffmpeg.js galaxy");
  process.exit(1);
}

console.log(`📁 File Server: ${fileServer}`);
console.log(`🎨 Theme: ${theme}`);
console.log(`🎯 Target: ${target}`);
console.log(`⏰ Started at: ${new Date().toLocaleString()}`);

processVideos(target);
