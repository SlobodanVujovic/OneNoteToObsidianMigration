import jsdom from "jsdom";
import fs from "node:fs";
const { JSDOM } = jsdom;

const item = {
  json: {
    data: fs.readFileSync("input.html", "utf8"),
  },
};

function main() {
  let html = item.json.data || "";
  const dom = new JSDOM(html);
  const document = dom.window.document;

  let cleanText = "";
  // Start the crawl at the body
  cleanText = translateNode(document.body);
  // Clean up double newlines often caused by nested block elements
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  item.json.extractedText = cleanText;
}

// Recursive "Walker"
function translateNode(node) {
  let result = "";

  node.childNodes.forEach((child) => {
    // Node Type 3 is Text
    if (child.nodeType === 3) {
      result += child.textContent;
    }
    // Node Type 1 is an Element (div, p, span, etc.)
    else if (child.nodeType === 1) {
      const tagName = child.tagName.toLowerCase();

      switch (tagName) {
        case "h1":
          result += `\n# ${translateNode(child)}\n`;
          break;
        case "h2":
          result += `\n## ${translateNode(child)}\n`;
          break;
        case "strong":
        case "b":
          result += `**${translateNode(child)}**`;
          break;
        case "em":
        case "i":
          result += `*${translateNode(child)}*`;
          break;
        case "p":
          result += `\n\n${translateNode(child)}\n\n`;
          break;
        case "a":
          const href = child.getAttribute("href") || "";
          result += `[${translateNode(child)}](${href})`;
          break;
        case "ul":
          result += `\n${translateNode(child)}\n`;
          break;
        case "li":
          result += `* ${translateNode(child)}\n`;
          break;
        default:
          // If tag is unknown, just process its children (keep the text)
          result += translateNode(child);
      }
    }
  });
  return result;
}

const result = main();
fs.writeFileSync("output.json", JSON.stringify(result));
