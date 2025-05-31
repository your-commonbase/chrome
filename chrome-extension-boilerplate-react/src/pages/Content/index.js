import { printLine } from './modules/print';

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "readClipboard") {
      navigator.clipboard.readText()
        .then(text => sendResponse({ text }))
        .catch(err => sendResponse({ error: err.message }));
      return true; // keep message channel open for async sendResponse
    }
  });

  