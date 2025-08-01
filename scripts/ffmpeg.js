// After copy files, we will run script ffmpeg.js to convert video to HLS format
// File info is in meta.json

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Convert video file to HLS format with multiple resolutions
 * @param {string} filename - The filename for the output
 * @param {string} filepath - Path to the input video file
 * @param {string} output_path - Path to the output directory
 * @returns {Promise<void>}
 */
function convertFile(filename, filepath, output_path) {
  return new Promise((resolve, reject) => {
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
      "/keys/key.info",
      "-f",
      "hls",
      `${output_path}/${filename}/${filename}_720p.m3u8`,
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
      "/keys/key.info",
      "-f",
      "hls",
      `${output_path}/${filename}/${filename}_240p.m3u8`,
    ];

    const ffmpeg = spawn(command[0], command.slice(1));

    ffmpeg.stdout.on("data", (data) => {
      console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.log(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        // Create master playlist file
        const masterFileArr = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          "#EXT-X-STREAM-INF:BANDWIDTH=744000",
          `${filename}_240p.m3u8`,
          "#EXT-X-STREAM-INF:BANDWIDTH=3894000",
          `${filename}_720p.m3u8`,
        ];
        const masterFile = masterFileArr.join("\n");

        const masterFilePath = path.join(
          output_path,
          filename,
          `${filename}.m3u8`,
        );
        fs.writeFileSync(masterFilePath, masterFile);

        console.log(`Conversion completed for ${filename}`);
        resolve();
      } else {
        reject(new Error(`ffmpeg process exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`ffmpeg error: ${error.message}`));
    });
  });
}

/**
 * Convert multiple files using the convertFile function
 * @param {Array} files - Array of file objects with filename, filepath, and output_path
 * @returns {Promise<void>}
 */
async function convertFiles(files) {
  for (const file of files) {
    try {
      await convertFile(file.filename, file.filepath, file.output_path);
    } catch (error) {
      console.error(`Error converting ${file.filename}:`, error.message);
    }
  }
}

module.exports = {
  convertFile,
  convertFiles,
};
