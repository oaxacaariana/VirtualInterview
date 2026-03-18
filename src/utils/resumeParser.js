const { Console } = require('console');
const fs = require('fs');
const path = require('path');
const { PdfReader } = require("pdfreader");
const mammoth = require("mammoth");

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

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.warn(`Resume file not found at path: ${filePath}`);
    return "";
  }

  // Check if file type is .pdf
  if (path.extname(filePath).toLowerCase() == ".pdf") {
    return new Promise((resolve, reject) => {
      let rows = {}; // Indexed by y-position

      // Function to build the output
      function buildText() {
        return Object.keys(rows)
          .sort((a, b) => parseFloat(a) - parseFloat(b))
          .map(y => rows[y].join(' '))
          .join('\n');
      }

      new PdfReader().parseFileItems(filePath, (err, item) => {
        if (err) return reject(err);
        if (!item) { // Done parsing
          return resolve(buildText());
        }
        if (item.text) {
          (rows[item.y] = rows[item.y] || []).push(item.text);
        }
      });
    });
  }

  // Check if file type is .docx
  else if (path.extname(filePath).toLowerCase() == ".docx") {
    return mammoth.convertToHtml({ path: filePath })
      .then(result => {
      const html = result.value;
      const messages = result.messages; //Optional warnings
      return html;
    })
    .catch(error => {
      console.error("Mammoth failed:", error);
      return "";
    });
  }

  // Fallback for unsupported file types
  else {
    console.warn(`Unsupported resume file type: ${path.extname(filePath)} for file: ${filePath}`);
    return "";
  }
}

module.exports = { parseResumeToText };