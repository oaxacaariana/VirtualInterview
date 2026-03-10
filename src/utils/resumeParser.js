const fs = require('fs');
const path = require('path');

var rows = {}; // indexed by y-position

function printRow(y) {
  console.log((rows[y] || []).join(''));
}

function printRows() {
  Object.keys(rows) // => array of y-positions (type: float)
    .sort((y1, y2) => parseFloat(y1) - parseFloat(y2)) // sort float positions
    .forEach(printRow);
}

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
    // return buffer.toString('utf8');
    new PdfReader().parseFileItems(filePath, function (err, item) {
      if (err)
        console.error(err);
      else if (!item || item.page) {
        // end of file, or page
        printRows();
        rows = {}; // clear rows for next page
      }
      else if (item.text) {
        // accumulate text items into rows object, per line
        (rows[item.y] = rows[item.y] || []).push(item.text);
      }
    });
  } catch (error) {
    console.error('parseResumeToText failed:', error);
    return '';
  }
}

module.exports = { parseResumeToText };
