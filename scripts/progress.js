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

module.exports = {
  showProgress,
};
