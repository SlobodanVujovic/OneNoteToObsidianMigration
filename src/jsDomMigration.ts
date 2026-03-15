import jsdom from "jsdom";
import fs from "node:fs";
const { JSDOM } = jsdom;

type Item = {
  json: {
    data: string;
    noteTitle?: string;
    extractedText?: string;
  }
}

const item: Item = {
  json: {
    data: fs.readFileSync("input.html", "utf8"),
  },
};

const state = {
  cleanText: "",
};

function main() {
  let html = item.json.data || "";
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const body = document.body;

  extractTitle(document, item);

  orderOutlineContaiers(body)

  walker(body);











  // Clean up double newlines often caused by nested block elements
  // cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  item.json.extractedText = state.cleanText;
}

function extractTitle(document: Document, item: Item) {
  item.json.noteTitle = document.title;
}

function orderOutlineContaiers(body: HTMLElement) {
  const outlineContaiers = Array.from(body.children).filter(
    el => el.tagName === 'DIV' && el.getAttribute('style')?.includes('position:absolute')
  );

  const sortedContainers = outlineContaiers.sort((a, b) => getTopValue(a) - getTopValue(b));

  body.innerHTML = "";
  sortedContainers.forEach(container => {
    body.appendChild(container);
  });
}

function getTopValue(divElement: Element) {
  const style = divElement.getAttribute('style') || "";
  const match = style.match(/top:\s?(\d+)px/);
  
  return match ? parseInt(match[1]!, 10) : 0;
};

function walker(body: HTMLElement) {
  const containers = body.childNodes;

  containers.forEach(container => {
    const countainerWalker = document.createTreeWalker(container, 1 /* 1 = Show NodeFilter.SHOW_ELEMENT */);

    walk(countainerWalker)
  });
}

function walk(walker: TreeWalker) {
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      handleElementNode(currentNode as Element);
    } else if (currentNode.nodeType === Node.TEXT_NODE) {
      handleTextNode(currentNode as Text);
    }


    currentNode = walker.nextNode();
  }
}

function handleElementNode(elementNode: Element) {
  const currentTag = elementNode.tagName;

  switch (currentTag) {
    case "P": {
      handlePTag(elementNode as HTMLParagraphElement);
    }
  }
}

function handleTextNode(textNode: Text){
  console.log();
}

function handlePTag(pNode: HTMLParagraphElement) {
  walker(pNode);
}

const result = main();
fs.writeFileSync("output.json", JSON.stringify(result));
