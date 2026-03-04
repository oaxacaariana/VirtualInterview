const fs = require('fs');

/**
 * TODO: Implement proper resume parsing (PDF/DOCX) using a library like pdf-parse or mammoth.
 * Return clean text for scoring, preview, and storage. Keep the signature the same.
 */
async function parseResumeToText(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    // Placeholder: plain UTF-8 read (works only for text-based files)
    return buffer.toString('utf8');
  } catch (error) {
    console.error('parseResumeToText failed:', error);
    return '';
  }
}

module.exports = { parseResumeToText };
