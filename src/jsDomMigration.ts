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

type MigrationState = {
  cleanText: string;
  headerLevel: number; // 0 = not a header, 1-6 = h1-h6
  isHighlighted: boolean; // Tracking ==highlight== state
  shouldSkip: boolean;
};

const state: MigrationState = {
  cleanText: "",
  headerLevel: 0,
  isHighlighted: false,
  shouldSkip: false,
};

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

  // Clean up double newlines often caused by nested block elements
  // cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  item.json.extractedText = state.cleanText;
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

function walk(node: Node) {
  // Pre-visit
  if (node.nodeType === Node.ELEMENT_NODE) {
    openElement(node as Element);
  } else if (node.nodeType === Node.TEXT_NODE) {
    handleTextNode(node as Text);
  }

  if (state.shouldSkip) {
    return;
  }

  // Walk
  node.childNodes.forEach((child) => {
    walk(child);
  });

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
  state.headerLevel = 0;
  state.shouldSkip = false;

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
  // If this is header, skip style check.
  if (state.headerLevel > 0) {
    return;
  }

  const style = spanNode.getAttribute("style") || "";
  const isLime =
    style.includes("background-color:lime") ||
    style.includes("background-color:#00ff00") ||
    style.includes("background:lime") ||
    style.includes("background:#00ff00");
  if (isLime && !state.isHighlighted) {
    state.cleanText += "==";

    state.isHighlighted = true;
  }
}

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
    state.cleanText += "#".repeat(headerLevel) + " " + header;
  } else {
    state.cleanText += text.replace(/[\r\n\t]+/g, "");
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
  state.cleanText += "\n\n";
}

function closeSpan(element: HTMLSpanElement) {
  const style = element.getAttribute("style") || "";
  const isLime =
    style.includes("background-color:lime") ||
    style.includes("background-color:#00ff00") ||
    style.includes("background:lime") ||
    style.includes("background:#00ff00");

  // Close highlight only if the NEXT sibling isn't also a lime span.
  // This is the trick for "merging" ==highlights==.
  if (isLime && state.isHighlighted) {
    const nextSibling = element.nextSibling as HTMLElement;
    const nextSiblingStyle = nextSibling?.getAttribute?.("style") || "";
    const isNextSiblingLime =
      nextSiblingStyle.includes("background-color:lime") ||
      nextSiblingStyle.includes("background-color:#00ff00") ||
      nextSiblingStyle.includes("background:lime") ||
      nextSiblingStyle.includes("background:#00ff00");

    if (!isNextSiblingLime) {
      state.cleanText += "==";
      state.isHighlighted = false;
    }
  }
}

main();
fs.writeFileSync("output.md", JSON.stringify(item.json.extractedText));
