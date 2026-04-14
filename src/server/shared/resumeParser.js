/**
 * Resume parsing helper module.
 * Inputs: A resume file path pointing to a PDF or DOCX stored on disk.
 * Outputs: Best-effort extracted text used for previews, scoring, and interview context.
 */
const fs = require('fs');
const path = require('path');
const mammoth = require("mammoth");

async function parseResumeToText(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Resume file not found at path: ${filePath}`);
    return "";
  }

  if (path.extname(filePath).toLowerCase() == ".pdf") {
    try {
      const pdfBuffer = fs.readFileSync(filePath);
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: pdfBuffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text || "";
    } catch (error) {
      console.error("PDF parsing failed:", error);
      return "";
    }
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
