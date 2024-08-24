console.log('This is the background page.');
console.log('Put the background scripts here.');

chrome.action.onClicked.addListener((tab) => {
  // get apiKey and cbUrl from storage
  chrome.storage.sync.get(['apiKey', 'cbUrl'], (result) => {
    const apiKey = result.apiKey;
    const cbUrl = result.cbUrl;
    if (result.apiKey && result.cbUrl) {
      // do nothing
    } else {
      console.log('apiKey and cbUrl are not set');
      // open options page
      chrome.runtime.openOptionsPage();
      return;
    }

    const tabTitle = tab.title;
    const tabUrl = tab.url;
    // get selection text TODO
    // chrome.scripting.executeScript({
    //     target: { tabId: tab.id },
    //     function: () => {
    //         return window.getSelection().toString();
    //     },
    //     }).then((selection) => {
    //     console.log('selection:', selection[0]);
    //     });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: yourScript,
      args: [apiKey, cbUrl, tabTitle, tabUrl],
    });
  });
});

async function yourScript(apiKey, cbUrl, tabTitle, tabUrl) {
  // post to https://api-gateway-electron.onrender.com/add
  const response = await fetch(
    'https://api-gateway-electron.onrender.com/add',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        dbPath: cbUrl,
        data: tabTitle,
        metadata: {
          title: tabTitle,
          author: tabUrl,
        },
      }),
    }
  );

  const data = await response.json();
  console.log(data);

  chrome.runtime.sendMessage({ action: 'setBadge' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setBadge') {
    chrome.action.setBadgeBackgroundColor({ color: '#008000' });
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);
  }
});
