console.log('This is the background page.');
console.log('Put the background scripts here.');

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.sync.get(['apiKey', 'cbUrl', 'urlCache'], (result) => {
    const apiKey = result.apiKey;
    const cbUrl = result.cbUrl;
    const urlCache = result.urlCache || {};

    if (!apiKey || !cbUrl) {
      console.log('apiKey and cbUrl are not set');
      chrome.runtime.openOptionsPage();
      return;
    }

    function proceedWithPostRequest(tabTitle, tabUrl) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: addToYCB,
        args: [apiKey, cbUrl, tabTitle, tabUrl],
      });
    }

    const tabUrl = tab.url;

    let tabTitle = tab.title;

    if (tab.url.includes('twitter.com') || tab.url.includes('https://x.com')) {
      tabTitle = editTwitterString(tabTitle);
    }

    // Check if the URL is already in the cache
    if (urlCache[tabUrl]) {
      console.log('URL already visited, opening popup', urlCache[tabUrl]);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: openModal,
        args: [apiKey, cbUrl, tabTitle, tabUrl, urlCache[tabUrl]],
      });
      return;
    }

    // TODO does this break w comment flow?
    if (tab.url.includes('youtube.com')) {
      console.log('YouTube page detected');
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => {
            const channelNameElement =
              document.querySelector('ytd-channel-name a');
            return channelNameElement
              ? channelNameElement.textContent.trim()
              : null;
          },
        },
        (injectionResults) => {
          if (chrome.runtime.lastError) {
            console.error(
              'Script injection failed: ',
              chrome.runtime.lastError
            );
            proceedWithPostRequest(tabTitle, tabUrl);
            return;
          }

          const channelName = injectionResults[0]?.result;
          if (channelName) {
            tabTitle = `${tabTitle} | ${channelName}`;
          }

          proceedWithPostRequest(tabTitle, tabUrl);
        }
      );
    } else {
      proceedWithPostRequest(tabTitle, tabUrl);
    }
  });
});

// chrome.action.onClicked.addListener((tab) => {
//   // get apiKey and cbUrl from storage
//   chrome.storage.sync.get(['apiKey', 'cbUrl'], (result) => {
//     const apiKey = result.apiKey;
//     const cbUrl = result.cbUrl;
//     if (result.apiKey && result.cbUrl) {
//       // do nothing
//     } else {
//       console.log('apiKey and cbUrl are not set');
//       // open options page
//       chrome.runtime.openOptionsPage();
//       return;
//     }

//     let tabTitle = tab.title;

//     function proceedWithPostRequest(tabTitle, tabUrl) {
//       chrome.scripting.executeScript({
//         target: { tabId: tab.id },
//         function: addToYCB,
//         args: [apiKey, cbUrl, tabTitle, tabUrl],
//       });
//     }

//     // Edit the title to remove any t.co links if twitter
//     if (tab.url.includes('twitter.com') || tab.url.includes('https://x.com')) {
//       tabTitle = editTwitterString(tabTitle);
//     }

//     const tabUrl = tab.url;

//     // Check if the tab is a YouTube page
//     if (tab.url.includes('youtube.com')) {
//       console.log('YouTube page detected');

//       // Use chrome.scripting.executeScript to get the channel name
//       chrome.scripting.executeScript(
//         {
//           target: { tabId: tab.id },
//           func: () => {
//             // This code runs in the page context
//             const channelNameElement = document.querySelector('ytd-channel-name a');
//             return channelNameElement ? channelNameElement.textContent.trim() : null;
//           },
//         },
//         (injectionResults) => {
//           if (chrome.runtime.lastError) {
//             console.error('Script injection failed: ', chrome.runtime.lastError);
//             // Proceed without the channel name
//             proceedWithPostRequest(tabTitle, tabUrl);
//             return;
//           }

//           const channelName = injectionResults[0]?.result;
//           if (channelName) {
//             tabTitle = `${tabTitle} | ${channelName}`;
//           }

//           // Proceed with the POST request using the updated tabTitle
//           proceedWithPostRequest(tabTitle, tabUrl);
//         }
//       );
//     } else {
//       // Proceed with the POST request if not a YouTube page
//       proceedWithPostRequest(tabTitle, tabUrl);
//     }
//   });
// });

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

function openModal(apiKey, cbUrl, tabTitle, tabUrl, parentId) {
  // Create a modal element
  const modal = document.createElement('div');
  modal.id = 'ycb-comment-modal';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = 'white';
  modal.style.padding = '20px';
  modal.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
  modal.style.zIndex = '1000';

  // Create a text box
  const textBox = document.createElement('textarea');
  textBox.type = 'text';
  textBox.placeholder = 'Add a comment...';
  textBox.style.width = '100%';
  textBox.style.height = '100px';

  async function addComment(
    apiKey,
    cbUrl,
    comment,
    tabTitle,
    tabUrl,
    parentId
  ) {
    console.log('Adding comment:', comment);

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
          data: comment,
          metadata: {
            title: tabTitle,
            author: tabUrl,
            parent_id: parentId,
          },
        }),
      }
    );

    const data = await response.json();
    console.log(data);

    return data;
  }

  async function getParentByID(apiKey, cbUrl, parentId) {
    console.log('Getting parent by ID:', parentId);

    // post to https://api-gateway-electron.onrender.com/add
    const response = await fetch(
      'https://api-gateway-electron.onrender.com/fetch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey,
          dbPath: cbUrl,
          id: parentId,
        }),
      }
    );

    const data = await response.json();
    console.log(data);

    if (data.length === 0) {
      console.log('No parent found with ID:', parentId);
      return null;
    }

    const parent = data;
    return parent;
  }

  async function updateParentId(apiKey, cbUrl, pdata, pmetadata, parentId) {
    console.log('Updating parentId:', parentId);

    // post to https://api-gateway-electron.onrender.com/add
    const response = await fetch(
      'https://api-gateway-electron.onrender.com/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey,
          dbPath: cbUrl,
          data: pdata,
          metadata: pmetadata,
          id: parentId,
        }),
      }
    );

    const data = await response.json();
    console.log(data);

    return data;
  }

  // Append the text box to the modal
  modal.appendChild(textBox);

  // Append the modal to the body
  document.body.appendChild(modal);

  // Close the modal when clicking outside of it
  // window.addEventListener('click', (event) => {
  //   if (event.target === modal) {
  //     document.body.removeChild(modal);
  //   }
  // });

  // escape key to close modal
  // document.addEventListener('keydown', (event) => {
  //   if (event.key === 'Escape') {
  //     const modal = document.getElementById('ycb-comment-modal');
  //     if (modal && modal.parentNode) {
  //       document.body.removeChild(modal);
  //     }
  //   }
  // });

  // Focus the text box when the modal is opened
  textBox.focus();

  // add a button to submit the form
  const submitButton = document.createElement('button');
  submitButton.textContent = 'Submit';
  submitButton.style.marginTop = '10px';
  submitButton.addEventListener('click', async () => {
    // Get the text from the text box
    const text = textBox.value;

    // Send the text to the background script
    console.log('Submitting comment:', text);

    // change button text to 'Submitting...'
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;

    // add comment
    const commentRes = await addComment(
      apiKey,
      cbUrl,
      text,
      tabTitle,
      tabUrl,
      parentId
    );
    const commentId = commentRes.id;
    // console.log('Comment added:', commentRes);

    // get parent by id
    const parent = await getParentByID(apiKey, cbUrl, parentId);
    console.log('Parent found:', parent);

    if (parent) {
      let metadata = parent.metadata;
      try {
        metadata = JSON.parse(parent.metadata);
      } catch (e) {
        console.log('Error parsing metadata:', e);
      }
      // append commentID to parent.metadata.alias_ids[] or create new array if it doesn't exist
      const newAliasIds = metadata.alias_ids || [];
      newAliasIds.push(commentId);
      metadata.alias_ids = newAliasIds;
      parent.metadata = JSON.stringify(metadata);

      console.log('Parent updated:', parent);

      // update parent id
      const updateRes = await updateParentId(
        apiKey,
        cbUrl,
        parent.data,
        metadata,
        parent.id
      );
      console.log('Parent updated:', updateRes);
    }

    // change button text back to 'Submit'
    submitButton.textContent = 'Submit';
    submitButton.disabled = false;

    // reset text box
    textBox.value = '';
  });
  modal.appendChild(submitButton);

  // close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.marginTop = '10px';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  modal.appendChild(closeButton);
}

async function addToYCB(apiKey, cbUrl, tabTitle, tabUrl) {
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

  // Store the URL and ID in the cache
  chrome.storage.sync.get(['urlCache'], (result) => {
    const urlCache = result.urlCache || {};
    urlCache[tabUrl] = data.id; // Assuming 'id' is the key in the response
    chrome.storage.sync.set({ urlCache });
  });

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
