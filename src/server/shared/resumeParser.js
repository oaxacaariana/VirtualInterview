/**
 * Resume parsing helper module.
 * Inputs: A resume file path pointing to a PDF or DOCX stored on disk.
 * Outputs: Best-effort extracted text used for previews, scoring, and interview context.
 */
const fs = require('fs');
const path = require('path');
const { PdfReader } = require("pdfreader");
const mammoth = require("mammoth");

async function parseResumeToText(filePath) {
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

  if (!fs.existsSync(filePath)) {
    console.warn(`Resume file not found at path: ${filePath}`);
    return "";
  }

  if (path.extname(filePath).toLowerCase() == ".pdf") {
    return new Promise((resolve, reject) => {
      let rows = {};

      function buildText() {
        return Object.keys(rows)
          .sort((a, b) => parseFloat(a) - parseFloat(b))
          .map(y => rows[y].join(' '))
          .join('\n');
      }

      new PdfReader().parseFileItems(filePath, (err, item) => {
        if (err) return reject(err);
        if (!item) {
          return resolve(buildText());
        }
        if (item.text) {
          (rows[item.y] = rows[item.y] || []).push(item.text);
        }
      });
    });
  }

  else if (path.extname(filePath).toLowerCase() == ".docx") {
    return mammoth.convertToHtml({ path: filePath })
      .then(result => {
      const html = result.value;
      return html;
    })
    .catch(error => {
      console.error("Mammoth failed:", error);
      return "";
    });
  }

  else {
    console.warn(`Unsupported resume file type: ${path.extname(filePath)} for file: ${filePath}`);
    return "";
  }
}

module.exports = { parseResumeToText };
