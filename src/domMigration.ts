import { JSDOM } from "jsdom";
import fs from "node:fs";

const Node = new JSDOM("").window.Node;

type Item = {
  json: {
    data: string;
    noteTitle?: string;
    extractedText?: string;
    imagesToDownload?: {
      url: string;
      fileName: string;
    }[];
  };
};

const item: Item = {
  json: {
    data: fs.readFileSync("input.html", "utf8"),
  },
};

let cleanText: string = "";

type MigrationState = {
  headerLevel: number; // 0 = not a header, 1-6 = h1-h6

  isLime: boolean; // Tracking ==lime== state
  isLimeStart: boolean;

  isHighlighted: boolean; // Tracking <mark style="background: #ff0000;">highlighted</mark> state
  isHighlightedStart: boolean;
  highlightedColor: string | null;

  isCodeFont: boolean; // Tracking <mark style="font-family:Courier New">code</mark> state
  isCodeFontStart: boolean;

  isColoredFont: boolean; // Tracking <mark style="color:white">colored-text</mark> state
  isColoredFontStart: boolean;
  coloredFontColor: string | null;

  shouldSkip: boolean;
};

const state: MigrationState = {
  headerLevel: 0,

  isLime: false,
  isLimeStart: false,

  isHighlighted: false,
  isHighlightedStart: false,
  highlightedColor: null,

  isCodeFont: false,
  isCodeFontStart: false,

  isColoredFont: false,
  isColoredFontStart: false,
  coloredFontColor: null,

  shouldSkip: false,
};

function resetState() {
  state.headerLevel = 0;

  state.isLime = false;
  state.isLimeStart = false;

  state.isHighlighted = false;
  state.isHighlightedStart = false;
  state.highlightedColor = null;

  state.isCodeFont = false;
  state.isCodeFontStart = false;

  state.isColoredFont = false;
  state.isColoredFontStart = false;
  state.coloredFontColor = null;

  state.shouldSkip = false;
}

function main() {
  let html = item.json.data || "";
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const body = document.body;

  extractTitle(document, item);

  orderOutlineContaiers(body);

  walk(body);

  // TODO Fill in. slvu
  item.json.imagesToDownload = [];

  item.json.extractedText = cleanText;
}

function extractTitle(document: Document, item: Item) {
  item.json.noteTitle = document.title;
}

function orderOutlineContaiers(body: HTMLElement) {
  const outlineContaiers = Array.from(body.children).filter(
    (el) =>
      el.tagName === "DIV" &&
      el.getAttribute("style")?.includes("position:absolute"),
  );

  const sortedContainers = outlineContaiers.sort(
    (a, b) => getTopValue(a) - getTopValue(b),
  );

  body.innerHTML = "";
  sortedContainers.forEach((container) => {
    body.appendChild(container);
  });
}

function getTopValue(divElement: Element) {
  const style = divElement.getAttribute("style") || "";
  const match = style.match(/top:\s?(\d+)px/);

  return match ? parseInt(match[1]!, 10) : 0;
}

// Idea is:
// 1. set state in opening methods of the pre-visit step,
// 2. add text with proper semantic (==, ``, <mark>) in handleTextNode() method based on current state,
// 3. set state in closing methods of the post-visit step and add closing semantic to text if required.
function walk(node: Node) {
  // Pre-visit
  if (node.nodeType === Node.ELEMENT_NODE) {
    openElement(node as Element);
  } else if (node.nodeType === Node.TEXT_NODE) {
    handleTextNode(node as Text);
  }

  if (!state.shouldSkip) {
    // Walk
    node.childNodes.forEach((child) => {
      walk(child);
    });
  }

  // Post-visit
  if (node.nodeType === Node.ELEMENT_NODE) {
    closeElement(node as Element);
  }
}

function openElement(elementNode: Element) {
  const currentTagName = elementNode.tagName;

  switch (currentTagName) {
    case "P": {
      openP(elementNode as HTMLParagraphElement);

      break;
    }
    case "SPAN": {
      openSpan(elementNode as HTMLSpanElement);

      break;
    }
  }
}

function openP(pNode: HTMLParagraphElement) {
  if (isGeneralHeader(pNode.textContent)) {
    state.shouldSkip = true;
    return;
  }
}

function isGeneralHeader(header: string): boolean {
  const regex = /\bGeneral$/;

  return regex.test(header);
}

function openSpan(spanNode: HTMLSpanElement) {
  // Check style if this is not header.
  if (state.headerLevel == 0) {
    const isHighlightColorLime = isLime(spanNode);
    if (isHighlightColorLime) {
      if (!state.isLime) {
        state.isLimeStart = true;
      } else {
        state.isLimeStart = false;
      }

      state.isLime = true;
    }

    const highlightColor = getHighlightColor(spanNode);
    if (highlightColor && !isHighlightColorLime) {
      if (!state.isHighlighted || state.highlightedColor !== highlightColor) {
        state.isHighlightedStart = true;
      } else {
        state.isHighlightedStart = false;
      }

      state.isHighlighted = true;
      state.highlightedColor = highlightColor;
    }
  }
}

function isLime(spanNode: HTMLSpanElement): boolean {
  const style = spanNode.getAttribute("style") || "";

  const isLime =
    style.includes("background-color:lime") ||
    style.includes("background-color:#00ff00") ||
    style.includes("background:lime") ||
    style.includes("background:#00ff00");

  return isLime;
}

function getHighlightColor(spanNode: HTMLSpanElement): string | null {
  const style = spanNode.getAttribute("style") || "";

  const match = style.match(/background-color\s*:\s*([^;]+)/i);

  if (match) {
    return match[1]!.trim(); // Returns the actual color value (e.g., "red", "#ff0000", "rgb(255,0,0)")
  }

  return null;
}

// Valid: ==`Void`==
// Not-valid: `==Void==` => First we need to check Courier New and then style.

// Valid: <mark style="background: #ff0000;">Void</mark>
// Valid: <mark style="background: #ff0000;font-family:Courier New">struktura</mark> => When we use <mark> for highlighting, we must also use it for font setup if needed
// Not-valid: <mark style="background: #ff0000;">`Void`</mark>
// Not-valid: `<mark style="background: #ff0000;">Void</mark>`
function handleTextNode(textNode: Text) {
  let text = textNode.textContent || "";

  // If "text" is empty, but it contains only whitespace character, skip it.
  if (text.trim() === "" && (text.includes("\n") || text.includes("\t"))) {
    return;
  }

  const headerInstruction = text.match(/^x(h[1-6])\s*(.*)/i);
  if (headerInstruction) {
    const headerLevel = parseInt(headerInstruction[1]!.substring(1), 10);
    const header = headerInstruction[2]!.trim();

    state.headerLevel = headerLevel;
    cleanText += "#".repeat(headerLevel) + " " + header;
  } else {
    if (state.isLimeStart) {
      cleanText += "==";
    }

    if (state.isHighlightedStart) {
      cleanText += `<mark style="background: ${state.highlightedColor}">`;
    }

    if(state.highlightedColor){
      text = text.replace(/<-/g, "&larr;");
      text = text.replace(/\^-/g, "&uarr;");
      text = text.replace(/v-/g, "&darr;");
    }

    cleanText += text.replace(/[\r\n\t]+/g, "");
  }
}

function closeElement(element: Element) {
  const currentTagName = element.tagName;

  switch (currentTagName) {
    case "P": {
      closeP();

      break;
    }
    case "SPAN": {
      closeSpan(element as HTMLSpanElement);

      break;
    }
  }
}

function closeP() {
  cleanText += "\n";

  resetState();
}

function closeSpan(element: HTMLSpanElement) {
  // Close highlight only if the NEXT sibling isn't also a lime span.
  // This is the trick for "merging" ==highlights==.
  if (state.isLime) {
    const nextSibling = element.nextSibling as HTMLElement;

    if (!nextSibling || !isLime(nextSibling)) {
      cleanText += "==";
      state.isLime = false;
      state.isLimeStart = false;
    }
  }

  if (state.isHighlighted) {
    const nextSibling = element.nextSibling as HTMLElement;

    if (!nextSibling) {
      cleanText += "</mark>";
      state.isHighlighted = false;
      state.isHighlightedStart = false;
      state.highlightedColor = null;
    } else {
      const nextSpanHighlightedColor = getHighlightColor(nextSibling);
      if (
        !nextSpanHighlightedColor ||
        (nextSpanHighlightedColor &&
          nextSpanHighlightedColor !== state.highlightedColor)
      ) {
        cleanText += "</mark>";
        state.isHighlighted = false;
        state.isHighlightedStart = false;
        state.highlightedColor = null;
      }
    }
  }
}

main();
fs.writeFileSync("output.md", JSON.stringify(item.json.extractedText));
