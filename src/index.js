import fs from "node:fs";

const item = {
  json: {
    data: fs.readFileSync("input.html", "utf8"),
  },
};

// TODO
// 1. Reorder-uj redosled kojim se izvrsavaju stvari u skripti
// 2. ul - bullet points
// 3. ol - numbered points
// 4. tekst markiran drugom bojom se ne detektuje
function main() {
  let html = item.json.data || "";

  extractTitle(html);

  // --- DESTROY THE HEAD SECTION ---
  // This completely deletes <head>, <title>, and <meta> tags so their text doesn't leak into your note
  html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");

  html = orderOutlineContaiers(html);

  // --- FLATTENS HTML ---
  // This completely flattens the HTML so the only line breaks will be the ones we manually add
  html = html.replace(/[\r\n]+/g, " ");

  html = defineCallouts(html);

  html = processImages(html);

  html = courierFontHandler(html);

  html = linksHandler(html);

  html = italicFontHandler(html);

  html = highlightedTextHandler(html);

  html = emptyLinesHandler(html);

  // Strip all remaining HTML tags (like <span>, <table>, <b>)
  let cleanText = html.replace(/<[^>]*>?/gm, "");

  // Decode standard HTML entities so characters render correctly
  cleanText = cleanText
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  cleanText = whitespaceRemoval(cleanText);

  // Find any multiple line breaks (\n) that happen right before a header (# )
  // and force them to collapse into a single line break so the header snaps to the text above it.
  cleanText = cleanText.replace(/\n+(?=# )/g, "\n");

  cleanText = headersHandler(cleanText);

  // --- REMOVE REDUNDANT "GENERAL" TITLE ---
  // If the very first thing in the text is the "# General" header, delete it
  // and any empty lines immediately following it.
  cleanText = cleanText.replace(/^\s*# General\n*/i, "");

  // --- SAVE ---
  // Save the final text back to the n8n item
  item.json.extractedText = cleanText;

  // TODO REMOVE BEFORE PASTING TO n8n. slvu
  return item;
}

function extractTitle(html) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  let noteTitle = titleMatch ? titleMatch[1].trim() : "Untitled Note";

  // Sanitize the title for file names
  noteTitle = noteTitle.replace(/[\\/:"*?<>|]/g, "-");
  noteTitle = noteTitle.replace(/[\s]/g, "_");

  item.json.noteTitle = noteTitle;
}

function orderOutlineContaiers(html) {
  let bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    let bodyInnerHtml = bodyMatch[1];
    // Split the body HTML right before any absolute-positioned div (container) begins
    let containers = bodyInnerHtml.split(
      /(?=<div[^>]*style="[^"]*position:\s*absolute[^"]*")/i,
    );

    let sortedContainers = containers
      .map((chunk) => {
        // Extract the top (Y) and left (X) pixel coordinates
        let topMatch = chunk.match(/top:\s*([0-9.]+)px/i);
        let leftMatch = chunk.match(/left:\s*([0-9.]+)px/i);

        return {
          html: chunk,
          top: topMatch ? parseFloat(topMatch[1]) : -1, // -1 keeps non-positioned elements at the very top
          left: leftMatch ? parseFloat(leftMatch[1]) : -1,
        };
      })
      .sort((a, b) => {
        // Sort them strictly Top-to-Bottom
        return a.top - b.top;
      });

    // Rebuild the HTML in the perfectly sorted order!
    let sortedBody = sortedContainers.map((c) => c.html).join("\n");
    html = html.replace(bodyInnerHtml, sortedBody);
  }
  return html;
}

function defineCallouts(html) {
  // Replace OneNote tags with Obsidian Callouts and remove their <p> tags completely.

  html = html.replace(
    /<p[^>]*data-tag="important"[^>]*>([\s\S]*?)<\/p>/gi,
    "> [!note]\n> $1\n\n",
  );
  html = html.replace(
    /<p[^>]*data-tag="critical"[^>]*>([\s\S]*?)<\/p>/gi,
    "> [!vazno] Important\n> $1\n\n",
  );
  html = html.replace(
    /<p[^>]*data-tag="idea"[^>]*>([\s\S]*?)<\/p>/gi,
    "> [!tip]\n> $1\n\n",
  );
  return html;
}

function processImages(html) {
  // Extract Images, generate Obsidian links, and save URLs for downloading
  item.json.imagesToDownload = [];

  // Safely capture the entire <img> tag even if attributes span multiple lines
  html = html.replace(/<img\b(?:[^>"]|"[^"]*")*>/gi, (match) => {
    // Extract ONLY the src URL
    let srcMatch = match.match(/src="([^"]+)"/i);
    let src = srcMatch ? srcMatch[1] : "";

    // Skip if there is no URL
    if (!src) return match;

    // Extract the image width
    let widthMatch = match.match(/width="([^"]+)"/i);
    let widthStr = widthMatch ? widthMatch[1] : "";

    // OneNote sometimes outputs decimals (like "326.5"). Obsidian prefers whole numbers.
    // We parse the number, round it, and optionally cap it at 800px so massive images don't break your screen.
    let finalWidth = "";
    if (widthStr) {
      let parsedWidth = Math.round(parseFloat(widthStr));
      finalWidth = `|${parsedWidth}`;
    }

    // Extract the OneNote resource ID for a clean filename
    let resIdMatch = src.match(/resources\/([^\/]+)\/\$value/i);
    let fileName = resIdMatch
      ? `img_${resIdMatch[1].substring(0, 12)}.png`
      : `img_${Math.floor(Math.random() * 10000)}.png`;

    // Save for the download loop
    item.json.imagesToDownload.push({
      url: src,
      fileName: fileName,
    });

    // Insert the clean Obsidian image link WITH the extracted width!
    // E.g., ![[img_0-991abce7.png|535]]
    return `![[${fileName}${finalWidth}]]\n`;
  });

  return html;
}

function courierFontHandler(html) {
  html = html.replace(
    // This looks for any span where the style contains "font-family:Courier New" (with or without quotes/spaces)
    /<span[^>]*style="[^"]*font-family:\s*'?Courier New'?[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (match, text) => {
      // Clean up any weird invisible line breaks OneNote might have forced inside the span
      let cleanCode = text.trim().replace(/\n/g, " ");

      // Wrap the text in backticks
      return `\`${cleanCode}\``;
    },
  );

  return html;
}

function linksHandler(html) {
  html = html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, attributes, text) => {
      let hrefMatch = attributes.match(/href="([^"]+)"/i);
      let url = hrefMatch ? hrefMatch[1] : "";
      let cleanText = text.replace(/\n/g, " ").trim();

      if (!url) return cleanText;

      let mdLink = `[${cleanText}](${url})`;

      let styleMatch = attributes.match(/style="([^"]+)"/i);
      if (styleMatch) {
        let style = styleMatch[1].toLowerCase();

        // Use temporary HTML tags instead of asterisks here!
        if (
          style.includes("font-style:italic") ||
          style.includes("font-style: italic")
        ) {
          mdLink = `<i>${mdLink}</i>`;
        }
      }
      return mdLink;
    },
  );

  return html;
}

function italicFontHandler(html) {
  html = html.replace(
    /<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (match, text) => {
      let cleanItalic = text.replace(/\n/g, " ");

      // Use temporary <i> tags
      return `<i>${cleanItalic}</i>`;
    },
  );

  // Merge touching tags together (e.g., </i><i> becomes nothing, joining the text)
  html = html.replace(/<\/i>\s*<i>/gi, "");
  // Now safely convert the clean blocks to Markdown asterisks!
  html = html.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");

  return html;
}

function highlightedTextHandler(html) {
  html = html.replace(
    // This looks for any span that has a background or background-color defined
    /<span[^>]*style="[^"]*(?:background-color|background):\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (match, color, text) => {
      // Clean up the extracted color string just in case OneNote added extra spaces
      color = color.trim().toLowerCase();
      // If the color is lime (or its hex equivalent), use Obsidian's native Markdown highlight
      if (color === "lime" || color === "#00ff00") {
        return `==${text}==`;
      }

      // For any other color, use the HTML <mark> tag to preserve the exact OneNote shade
      else {
        return `<mark style="background: ${color};">${text}</mark>`;
      }
    },
  );

  return html;
}

function emptyLinesHandler(html) {
  // Destroy rogue <br> tags that OneNote leaves dangling at the end of table cells or paragraphs
  html = html.replace(/<br[^>]*>\s*(?=<\/(td|p|div)>)/gi, "");

  // Headings get double line breaks so they stand out in Markdown
  html = html.replace(/<\/(h[1-6])>/gi, "\n");

  // Explicit <br> tags become single line breaks
  html = html.replace(/<br[^>]*>/gi, "\n");

  // Paragraphs, divs, lists, and tables get a single line break
  // (Notice we removed td and tr so 1x1 image tables don't generate massive gaps)
  html = html.replace(/<\/(p|div|li|table)>/gi, "\n");

  return html;
}

function whitespaceRemoval(cleanText) {
  cleanText = cleanText
    .split("\n")
    .map((line) => line.trim()) // Remove trailing/leading invisible spaces
    .join("\n"); // Join them back with normal single line breaks

  // Collapse 3 or more massive line breaks down to exactly 2 (standard Markdown spacing)
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n");

  return cleanText;
}

function headersHandler(cleanText) {
  // Handles plain text, Courier New (backticks), Bold/Italics, AND strips colors!

  cleanText = cleanText
    .split("\n")
    .map((line) => {
      let trimmedLine = line.trim();

      // Notice we added '=' to the first bracket! This catches cases where
      // you accidentally highlighted the "xh1" prefix too (e.g., ==xh1 Title==)
      let match = trimmedLine.match(/^([`*=>]*)(xh[1-6])(?:\s+|$)(.*)/i);

      if (match) {
        let formatting = match[1];
        let prefix = match[2];
        let restOfLine = match[3];

        let level = parseInt(prefix.toLowerCase().replace("xh", ""));
        let hashes = "#".repeat(level);

        // --- NEW: STRIP HIGHLIGHTS FROM HEADERS ---
        // 1. Wash off any == from the text
        restOfLine = restOfLine.replace(/==/g, "");
        // 2. Wash off any <mark> tags (for non-lime colors)
        restOfLine = restOfLine.replace(/<\/?mark[^>]*>/gi, "");
        // 3. Wash off any == that snuck into the front formatting
        formatting = formatting.replace(/=/g, "");

        // Rebuilds the clean Obsidian header
        return `${hashes} ${formatting}${restOfLine}`;
      }

      return line; // Leave non-header lines alone
    })
    .join("\n");

  return cleanText;
}

const result = main();
fs.writeFileSync("output.json", JSON.stringify(result));
