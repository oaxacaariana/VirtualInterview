const fs = require('fs');
const path = require('path');

/**
 * TODO: Implement proper resume parsing (PDF/DOCX) using a library like pdf-parse or mammoth.
 * Return clean text for scoring, preview, and storage. Keep the signature the same.
 */
async function parseResumeToText(filePath) {
  // Allow a local, gitignored override for experimentation: src/utils/resumeParser.local.js
  const localParserPath = path.join(__dirname, 'resumeParser.local.js');
  if (fs.existsSync(localParserPath)) {
    try {
      const { parseResumeToText: localParser } = require(localParserPath);
      if (typeof localParser === 'function') {
        return localParser(filePath);
      }
    } catch (err) {
      console.warn('Local resume parser found but failed to load, using stub:', err.message);
    }
  }

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
