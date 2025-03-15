console.log('This is the background page.');
console.log('Put the background scripts here.');

let isProcessing = false





chrome.action.onClicked.addListener((tab) => {

  if (isProcessing) {
    console.log('Action is already in progress.');
    return;
  }

  isProcessing = true;
  console.log('Action started.');

  chrome.storage.local.get(['apiKey', 'cbUrl', 'urlCache', 'openAIAPIKey'], (result) => {
    const apiKey = result.apiKey;
    const cbUrl = result.cbUrl;
    const urlCache = result.urlCache || {};
    const openAIAPIKey = result.openAIAPIKey;

    if (!apiKey || !cbUrl) {
      console.log('apiKey and cbUrl are not set');
      chrome.runtime.openOptionsPage();
      isProcessing = false;
      return;
    }

    function proceedWithPostRequest(tabTitle, tabUrl, data, cacheTabUrl) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: addToYCB,
        args: [apiKey, cbUrl, tabTitle, tabUrl, data, cacheTabUrl],
      }, () => {
        isProcessing = false;
      });
    }

    function proceedWithPostRequestWithComment(tabTitle, tabUrl, data, cacheTabUrl, comment) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: addToYCBWithComment,
        args: [apiKey, cbUrl, tabTitle, tabUrl, data, cacheTabUrl, comment],
      }, () => {
        isProcessing = false;
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
      }, () => {
        isProcessing = false;
      });
      return;
    }

    // TODO does this break w comment flow?
    if (tab.url.includes('youtube.com')) {

      async function extractTranscript() {
        // close cookie banner if exists
        document.querySelector('button[aria-label*=cookies]')?.click();
      
        // click the "show transcript" button
        const transcriptBtn = document.querySelector('ytd-video-description-transcript-section-renderer button');
        if (!transcriptBtn) {
          console.log('no transcript button found');
          return;
        }
        transcriptBtn.click();
      
        // wait for transcript container to appear (adjust time as needed)
        await new Promise(resolve => setTimeout(resolve, 3000));
      
        // scrape transcript text
        const transcriptNodes = Array.from(document.querySelectorAll('#segments-container yt-formatted-string'));
        const transcriptText = transcriptNodes.map(node => node.textContent.trim()).join('\n');
      
        // send transcript back to background (if needed)
        chrome.runtime.sendMessage({ action: 'transcriptScraped', transcript: transcriptText });

        const channelElement = document.querySelector('ytd-channel-name');
        const channelName = channelElement?.textContent.trim().split('\n')[0];
        
        return {
          transcript: transcriptText,
          channelName: channelName,
        };
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractTranscript,
      }, async (transcript) => {
        if (chrome.runtime.lastError) {
          console.error('Script injection failed: ', chrome.runtime.lastError);
          return;
        }

        if (!transcript[0].result.transcript) {
          console.log('No transcript found');
          return;
        }

        console.log('transcript:', transcript);

        const openaiRes = await callOpenAI(openAIAPIKey, transcript[0].result.transcript, `You are a helpful assistant. You will be given a transcript of a video. Your task is to summarize the transcript in a concise and informative manner. Please ensure that the summary is accurate and relevant to the content of the video. Do not include any additional information or explanations. You are a glorified summarizer/teleprompter, so stay on topic. Use the channel name where appropriate, because it is the creators video. Channel name: ${transcript[0].result.channelName}`);

        console.log('transcript extracted');
        console.log('openaiRes:', openaiRes.choices[0].message.content);

        proceedWithPostRequestWithComment(
          tabTitle,
          tabUrl,
          `${tabTitle} | ${transcript[0].result.channelName}`,
          tabUrl,
          openaiRes.choices[0].message.content
        );
      });

      // chrome.scripting.executeScript(
      //   {
      //     target: { tabId: tab.id },
      //     func: () => {
      //       const channelNameElement =
      //         document.querySelector('ytd-channel-name a');
      //       return channelNameElement
      //         ? channelNameElement.textContent.trim()
      //         : null;
      //     },
      //   },
      //   (injectionResults) => {
      //     if (chrome.runtime.lastError) {
      //       console.error(
      //         'Script injection failed: ',
      //         chrome.runtime.lastError
      //       );
      //       // proceedWithPostRequest(tabTitle, tabUrl, tabTitle, tabUrl);
      //       return;
      //     }

      //     const channelName = injectionResults[0]?.result;
      //     if (channelName) {
      //       tabTitle = `${tabTitle} | ${channelName}`;
      //     }

      //     // proceedWithPostRequest(tabTitle, tabUrl, tabTitle, tabUrl);
      //   }
      // );

      


    } else if (tab.url.includes('open.spotify.com') || tab.url.includes('twitter.com') || tab.url.includes('https://x.com') || tab.url.includes('instagram.com')) {
      proceedWithPostRequest(tabTitle, tabUrl, tabTitle, tabUrl);
    }
    else { // TODO: same for tiktok ig spotify twitter
      // Capture the visible tab
      chrome.tabs.captureVisibleTab(null, {}, async function (image) {
        // Convert the image to a Blob
        const response = await fetch(image);
        const blob = await response.blob();

        // Create FormData and append the image Blob
        const formData = new FormData();
        formData.append('file', blob);

        // Upload the image
        const uploadResponse = await fetch(
          'https://commonbase-supabase-alpha.onrender.com/cf-images/upload',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          }
        );
        const uploadData = await uploadResponse.json();
        const pngUrl = `${uploadData.url}?format=png`;
        // Describe the image
        const describeResponse = await fetch(
          'https://commonbase-supabase-alpha.onrender.com/cf-images/describe',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: pngUrl }),
          }
        );
        const describeData = await describeResponse.json();

        // Proceed with the rest of your logic
        proceedWithPostRequest(
          'Image',
          pngUrl,
          `${describeData.data}\n\n[${tabTitle}](${tabUrl})`,
          tabUrl
        );
      });
    }
  });
});

// chrome.action.onClicked.addListener((tab) => {
//   // get apiKey and cbUrl from storage
//   chrome.storage.local.get(['apiKey', 'cbUrl'], (result) => {
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

  // add a href to https://ycb-companion.onrender.com/dashboard/entry/{parentId}
  const href = `https://ycb-companion.onrender.com/dashboard/entry/${parentId}`;
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.textContent = 'View in YCB Companion';
  modal.appendChild(a);

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

async function callOpenAI(apiKey, prompt, systemMessage = 'You are a helpful assistant.') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'developer',
          content: systemMessage,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  console.log(data);

  return data;
}

async function addToYCB(
  apiKey,
  cbUrl,
  tabTitle,
  tabUrl,
  inputData,
  cacheTabUrl
) {
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
        data: inputData,
        metadata: {
          title: tabTitle,
          author: tabUrl,
        },
      }),
    }
  );

  const data = await response.json();

  // Store the URL and ID in the cache
  chrome.storage.local.get(['urlCache'], (result) => {
    const urlCache = result.urlCache || {};
    urlCache[cacheTabUrl] = data.id; // Assuming 'id' is the key in the response
    chrome.storage.local.set({ urlCache });
  });

  chrome.runtime.sendMessage({ action: 'setBadge' });
}

async function addToYCBWithComment(
  apiKey,
  cbUrl,
  tabTitle,
  tabUrl,
  inputData,
  cacheTabUrl,
  comment
) {
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
        data: inputData,
        metadata: {
          title: tabTitle,
          author: tabUrl,
        },
      }),
    }
  );

  const data = await response.json();

  const id = data.id;
  console.log('id:', id);

  // post to https://api-gateway-electron.onrender.com/add
  const response2 = await fetch(
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
          parent_id: id,
          title: tabTitle,
          author: tabUrl,
        },
      }),
    }
  );

  const data2 = await response2.json();
  const id2 = data2.id;

  // post to https://api-gateway-electron.onrender.com/update
  const response3 = await fetch(
    'https://api-gateway-electron.onrender.com/update',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        dbPath: cbUrl,
        data: inputData,
        metadata: {
          alias_ids: [id2],
          title: tabTitle,
          author: tabUrl,
        },
        id: id,
      }),
    }
  );

  // Store the URL and ID in the cache
  chrome.storage.local.get(['urlCache'], (result) => {
    const urlCache = result.urlCache || {};
    urlCache[cacheTabUrl] = data.id; // Assuming 'id' is the key in the response
    chrome.storage.local.set({ urlCache });
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
