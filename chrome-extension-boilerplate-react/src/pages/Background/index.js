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

    let tabTitle = tab.title;

    function proceedWithPostRequest(tabTitle, tabUrl) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: yourScript,
        args: [apiKey, cbUrl, tabTitle, tabUrl],
      });
    }

    // Edit the title to remove any t.co links if twitter
    if (tab.url.includes('twitter.com') || tab.url.includes('https://x.com')) {
      tabTitle = editTwitterString(tabTitle);
    }

    const tabUrl = tab.url;

    

    // Check if the tab is a YouTube page
    if (tab.url.includes('youtube.com')) {
      console.log('YouTube page detected');
    
      // Use chrome.scripting.executeScript to get the channel name
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => {
            // This code runs in the page context
            const channelNameElement = document.querySelector('ytd-channel-name a');
            return channelNameElement ? channelNameElement.textContent.trim() : null;
          },
        },
        (injectionResults) => {
          if (chrome.runtime.lastError) {
            console.error('Script injection failed: ', chrome.runtime.lastError);
            // Proceed without the channel name
            proceedWithPostRequest(tabTitle, tabUrl);
            return;
          }
    
          const channelName = injectionResults[0]?.result;
          if (channelName) {
            tabTitle = `${tabTitle} | ${channelName}`;
          }
    
          // Proceed with the POST request using the updated tabTitle
          proceedWithPostRequest(tabTitle, tabUrl);
        }
      );
    } else {
      // Proceed with the POST request if not a YouTube page
      proceedWithPostRequest(tabTitle, tabUrl);
    }
  });
});

function editTwitterString(twitterString) {
  // Match the pattern: username on X: "content" / X
  const match = twitterString.match(/^(.+?) on X: "(.*)" \/ X$/);
  if (!match) {
    // If the string doesn't match the expected pattern, return it as is
    return twitterString;
  }
  const username = match[1].trim();
  let content = match[2].trim();

  // Remove any t.co links from the content
  content = content.replace(/https:\/\/t\.co\/\S+/g, '').trim();

  // If content is empty after removing links, set it to 'Untitled Twitter Video'
  if (!content) {
    content = 'Untitled Twitter Video';
  }

  // Return the formatted string
  return `${content} (Twitter/${username})`;
}


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
