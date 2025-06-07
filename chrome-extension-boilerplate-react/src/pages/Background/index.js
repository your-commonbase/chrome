console.log('This is the background page.');
console.log('Put the background scripts here.');

let isProcessing = false;

// Helper function to get base URL from storage with fallback
function getBaseUrl(callback) {
  chrome.storage.local.get(['baseUrl'], (result) => {
    const baseUrl = result.baseUrl || 'https://development.yourcommonbase.com';
    callback(baseUrl);
  });
}

function showToast(tabId, message, type = 'success') {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: (message, type) => {
      // Create toast element
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999999;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
      `;
      
      // Add animation styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      
      toast.textContent = message;
      document.body.appendChild(toast);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (toast.parentNode) {
            document.body.removeChild(toast);
          }
          if (style.parentNode) {
            document.head.removeChild(style);
          }
        }, 300);
      }, 3000);
    },
    args: [message, type]
  }).catch(err => {
    console.error('Error showing toast:', err);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Clear existing context menus first
  chrome.contextMenus.removeAll(() => {
    // Create all context menu items
    chrome.contextMenus.create({
      id: 'open-side-panel-with-selection',
      title: 'Search YCB for: "%s"',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'save-selected-text-to-ycb',
      title: 'Save Selected Text to YCB',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'save-url-to-ycb',
      title: 'Save URL to YCB',
      contexts: ['link'],
    });

    chrome.contextMenus.create({
      id: 'open-side-panel',
      title: 'Open Side Panel',
      contexts: ['all'],
    });

    chrome.contextMenus.create({
      id: 'open-ycb-dashboard',
      title: 'Open YCB Dashboard',
      contexts: ['all'],
    });

    chrome.contextMenus.create({
      id: 'save-page-to-ycb',
      title: 'Save Page to YCB',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'save-image-to-ycb',
      title: 'Save Image to YCB',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: 'save-area-screenshot-to-ycb',
      title: 'Save Area Screenshot to YCB',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'save-full-screenshot-to-ycb',
      title: 'Save Full Screenshot to YCB',
      contexts: ['page'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-selected-text-to-ycb') {
    chrome.storage.local.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;

      if (!apiKey) {
        showToast(tab.id, 'Please set API key in extension options', 'error');
        return;
      }

      const clipboardText = info.selectionText;

      getBaseUrl((baseUrl) => {
        fetch(`${baseUrl}/backend/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            metadata: {
              title: tab.title,
              author: tab.url,
            },
            data: clipboardText,
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error('Upload failed');
            showToast(tab.id, 'Selected text saved to YCB successfully!', 'success');
          })
          .catch((err) => {
            console.error('Error uploading text:', err);
            showToast(tab.id, 'Failed to save text to YCB', 'error');
          });
      });
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-side-panel') {
    chrome.storage.sync.get(['arcMode'], ({ arcMode }) => {
      if (arcMode) {
        chrome.windows.create({
          url: chrome.runtime.getURL('panel.html'),
          type: 'popup',
          width: 400,
          height: 600,
          top: 100,
          left: 1000, // align to right like a side panel
          focused: true,
        });
      } else {
        chrome.sidePanel.setOptions({
          path: 'panel.html',
          enabled: true,
        });
        chrome.sidePanel.open({ tabId: tab.id });
        // Set focus flag in storage for the panel to check
        console.log('Setting focus flag for context menu');
        chrome.storage.local.set({ shouldFocusSearchBox: true });
      }
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-ycb-dashboard') {
    getBaseUrl((baseUrl) => {
      chrome.tabs.create({
        url: `${baseUrl}/dashboard`
      });
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-area-screenshot-to-ycb') {
    // Capture full screenshot and open crop viewer
    captureScreenshotForCropping(tab);
  } else if (info.menuItemId === 'save-full-screenshot-to-ycb') {
    // Capture full screenshot and upload directly
    captureFullScreenshot(tab);
  }
});

// Function to capture screenshot for cropping
function captureScreenshotForCropping(tab) {
  chrome.storage.local.get(['apiKey'], (result) => {
    const apiKey = result.apiKey;
    
    if (!apiKey) {
      showToast(tab.id, 'Please set API key in extension options', 'error');
      return;
    }

    // Capture the visible tab
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot failed:', chrome.runtime.lastError);
        showToast(tab.id, 'Failed to capture screenshot', 'error');
        return;
      }

      // Store screenshot data temporarily with a unique key
      const screenshotId = Date.now().toString();
      chrome.storage.local.set({
        [`screenshot_${screenshotId}`]: {
          imageData: dataUrl,
          tabInfo: {
            title: tab.title,
            url: tab.url,
            id: tab.id
          }
        }
      }, () => {
        // Open crop viewer window with screenshot ID in URL
        chrome.windows.create({
          url: chrome.runtime.getURL(`cropViewer.html?id=${screenshotId}`),
          type: 'popup',
          width: 900,
          height: 700,
          focused: true
        });
      });
    });
  });
}

// Function to capture full screenshot (fallback)
function captureFullScreenshot(tab) {
  chrome.storage.local.get(['apiKey'], (result) => {
    const apiKey = result.apiKey;
    
    if (!apiKey) {
      showToast(tab.id, 'Please set API key in extension options', 'error');
      return;
    }

    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot failed:', chrome.runtime.lastError);
        showToast(tab.id, 'Failed to capture screenshot', 'error');
        return;
      }

      const tabInfo = {
        title: tab.title,
        url: tab.url,
        id: tab.id
      };

      uploadScreenshot(dataUrl, tabInfo, apiKey, 'Screenshot of ' + tab.title)
        .catch((error) => {
          console.error('Failed to upload full screenshot:', error);
        });
    });
  });
}


// Function to upload screenshot (returns Promise for async handling)
function uploadScreenshot(dataUrl, tabInfo, apiKey, title) {
  return new Promise((resolve, reject) => {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const formData = new FormData();
        formData.append('file', blob, 'screenshot.png');
        formData.append(
          'metadata',
          JSON.stringify({
            title: title,
            author: tabInfo.url,
            type: 'image'
          })
        );

        getBaseUrl((baseUrl) => {
          fetch(
            `${baseUrl}/backend/v2/addImage`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              body: formData,
            }
          )
            .then((res) => {
              if (!res.ok) throw new Error('Upload failed');
              console.log('Screenshot uploaded');
              chrome.runtime.sendMessage({ action: 'setBadge' });
              
              // Show toast if we have a tab ID
              if (tabInfo.id) {
                showToast(tabInfo.id, 'Screenshot saved to YCB successfully!', 'success');
              }
              
              resolve();
            })
            .catch((err) => {
              console.error('Error uploading screenshot:', err);
              
              // Show toast if we have a tab ID
              if (tabInfo.id) {
                showToast(tabInfo.id, 'Failed to save screenshot to YCB', 'error');
              }
              
              reject(err);
            });
        });
      })
      .catch(reject);
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-url-to-ycb') {
    chrome.storage.local.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;
      const url = info.linkUrl;

      if (!apiKey) {
        showToast(tab.id, 'Please set API key in extension options', 'error');
        return;
      }

      getBaseUrl((baseUrl) => {
        fetch(`${baseUrl}/backend/addURL`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            url: url,
            metadata: {
              title: tab.title,
              author: tab.url,
            },
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error('Upload failed');
            console.log('URL uploaded');
            chrome.runtime.sendMessage({ action: 'setBadge' });
            showToast(tab.id, 'URL saved to YCB successfully!', 'success');
          })
          .catch((err) => {
            console.error('Error uploading URL:', err);
            showToast(tab.id, 'Failed to save URL to YCB', 'error');
          });
      });
    });
  }
});


chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-image-to-ycb') {
    chrome.storage.local.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;
      
      if (!apiKey) {
        showToast(tab.id, 'Please set API key in extension options', 'error');
        return;
      }

      fetch(info.srcUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const formData = new FormData();
          formData.append('file', blob, 'image.jpg');
          formData.append(
            'metadata',
            JSON.stringify({
              title: 'Image',
              author: tab.url,
            })
          );

          getBaseUrl((baseUrl) => {
            return fetch(
              `${baseUrl}/backend/v2/addImage`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                },
                body: formData,
              }
            )
              .then((res) => {
                if (!res.ok) throw new Error('Upload failed');
                console.log('Image uploaded');
                chrome.runtime.sendMessage({ action: 'setBadge' });
                showToast(tab.id, 'Image saved to YCB successfully!', 'success');
              })
              .catch((err) => {
                console.error('Error uploading image:', err);
                showToast(tab.id, 'Failed to save image to YCB', 'error');
              });
          });
        })
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-side-panel-with-selection' && tab.id) {
    const selectedText = info.selectionText || '';
    
    // Get arc mode setting synchronously to avoid losing user gesture
    chrome.storage.sync.get(['arcMode'], ({ arcMode }) => {
      // Store the query for the panel to pick up
      chrome.storage.local.set({ panelQuery: selectedText });
      
      if (arcMode) {
        chrome.windows.create(
          {
            url: chrome.runtime.getURL('panel.html'),
            type: 'popup',
            width: 400,
            height: 600,
            top: 100,
            left: 1000, // align to right like a side panel
            focused: true,
          },
          (newWindow) => {
            // Wait for the tab to be ready
            const panelTab = newWindow.tabs && newWindow.tabs[0];
            if (panelTab && panelTab.id) {
              // Give the panel a moment to load (optional, but sometimes necessary)
              setTimeout(() => {
                chrome.tabs.sendMessage(panelTab.id, {
                  action: 'updatePanelQuery',
                  query: selectedText,
                }).catch(err => {
                  console.log('Message failed, panel will use storage instead:', err);
                });
              }, 500); // 500ms delay, adjust as needed
            }
          }
        );
      } else {
        chrome.sidePanel.setOptions({
          path: 'panel.html',
          enabled: true,
        });
        chrome.sidePanel.open({ tabId: tab.id });
        
        // Send message to update existing panel (if already open) and store for new panels
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'updatePanelQuery',
            query: selectedText,
          }).catch(err => {
            console.log('No panel to receive message yet, will use storage:', err);
          });
        }, 100); // Short delay to ensure panel context is ready
        
        console.log('Panel opened, query stored and message sent');
      }
    });
  }
});

// Function to handle saving page to YCB (shared by action click and context menu)
function savePageToYCB(tab) {
  if (isProcessing) {
    console.log('Action is already in progress.');
    return;
  }

  isProcessing = true;
  console.log('Action started.');

  chrome.storage.local.get(
    ['apiKey', 'cbUrl', 'urlCache', 'openAIAPIKey'],
    (result) => {
      const apiKey = result.apiKey;
      const cbUrl = result.cbUrl;
      const urlCache = result.urlCache || {};
      const openAIAPIKey = result.openAIAPIKey;

      if (!apiKey || !cbUrl) {
        console.log('apiKey and cbUrl are not set');
        showToast(tab.id, 'Please set API key and CB URL in extension options', 'error');
        chrome.runtime.openOptionsPage();
        isProcessing = false;
        return;
      }

      function proceedWithPostRequest(tabTitle, tabUrl, data, cacheTabUrl) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            function: addToYCB,
            args: [apiKey, cbUrl, tabTitle, tabUrl, data, cacheTabUrl],
          },
          () => {
            isProcessing = false;
          }
        );
      }

      function proceedWithPostRequestWithComment(
        tabTitle,
        tabUrl,
        data,
        cacheTabUrl,
        comment
      ) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            function: addToYCBWithComment,
            args: [apiKey, cbUrl, tabTitle, tabUrl, data, cacheTabUrl, comment],
          },
          () => {
            isProcessing = false;
          }
        );
      }

      const tabUrl = tab.url;
      let tabTitle = tab.title;

      if (
        tab.url.includes('twitter.com') ||
        tab.url.includes('https://x.com')
      ) {
        tabTitle = editTwitterString(tabTitle);
      }

      // Check if the URL is already in the cache
      if (urlCache[tabUrl]) {
        // Inject script to get selected text
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: () => window.getSelection().toString(),
          },
          (results) => {
            let selectedText = '';
            if (results && results[0] && results[0].result) {
              selectedText = results[0].result;
            }
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id },
                function: openModal,
                args: [
                  apiKey,
                  cbUrl,
                  tabTitle,
                  tabUrl,
                  urlCache[tabUrl],
                  selectedText,
                ],
              },
              () => {
                isProcessing = false;
              }
            );
          }
        );
        return;
      }

      // TODO does this break w comment flow? tab.url.includes('youtube.com')
      if (false) {
        async function extractTranscript() {
          // close cookie banner if exists
          document.querySelector('button[aria-label*=cookies]')?.click();

          // click the "show transcript" button
          const transcriptBtn = document.querySelector(
            'ytd-video-description-transcript-section-renderer button'
          );
          if (!transcriptBtn) {
            console.log('no transcript button found');
            return;
          }
          transcriptBtn.click();

          // wait for transcript container to appear (adjust time as needed)
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // scrape transcript text
          const transcriptNodes = Array.from(
            document.querySelectorAll('#segments-container yt-formatted-string')
          );
          const transcriptText = transcriptNodes
            .map((node) => node.textContent.trim())
            .join('\n');

          // send transcript back to background (if needed)
          // chrome.runtime.sendMessage({ action: 'transcriptScraped', transcript: transcriptText });

          const channelElement = document.querySelector('ytd-channel-name');
          const channelName = channelElement?.textContent.trim().split('\n')[0];

          return {
            transcript: transcriptText,
            channelName: channelName,
          };
        }

        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            function: extractTranscript,
          },
          async (transcript) => {
            if (chrome.runtime.lastError) {
              console.error(
                'Script injection failed: ',
                chrome.runtime.lastError
              );
              return;
            }

            if (!transcript[0].result.transcript) {
              console.log('No transcript found');
              return;
            }

            console.log('transcript:', transcript);

            const openaiRes = await callOpenAI(
              openAIAPIKey,
              transcript[0].result.transcript,
              `You are a helpful assistant. You will be given a transcript of a video. Your task is to summarize the transcript in a concise and informative manner. Please ensure that the summary is accurate and relevant to the content of the video. Do not include any additional information or explanations. You are a glorified summarizer/teleprompter, so stay on topic. Use the channel name where appropriate, because it is the creators video. Channel name: ${transcript[0].result.channelName}`
            );

            console.log('transcript extracted');
            console.log('openaiRes:', openaiRes.choices[0].message.content);

            proceedWithPostRequestWithComment(
              tabTitle,
              tabUrl,
              `${tabTitle} | ${transcript[0].result.channelName}`,
              tabUrl,
              openaiRes.choices[0].message.content
            );
          }
        );
      } else {
        proceedWithPostRequest(tabTitle, tabUrl, tabTitle, tabUrl);
      }
    }
  );
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-page-to-ycb') {
    savePageToYCB(tab);
  }
});

chrome.action.onClicked.addListener((tab) => {
  savePageToYCB(tab);
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

function openModal(
  apiKey,
  cbUrl,
  tabTitle,
  tabUrl,
  parentId,
  defaultText = ''
) {
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

  // add a href to dashboard/entry/{parentId}
  chrome.storage.local.get(['baseUrl'], (result) => {
    const baseUrl = result.baseUrl || 'https://development.yourcommonbase.com';
    const href = `${baseUrl}/dashboard/entry/${parentId}`;
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.textContent = 'View in YCB Companion';
    modal.appendChild(a);
  });

  // Create a text box
  const textBox = document.createElement('textarea');
  textBox.type = 'text';
  textBox.placeholder = 'Add a comment...';
  textBox.style.width = '100%';
  textBox.style.height = '100px';
  textBox.value = defaultText; // <-- pre-fill with defaultText

  async function addComment(
    apiKey,
    cbUrl,
    comment,
    tabTitle,
    tabUrl,
    parentId
  ) {
    console.log('Adding comment:', comment);

    // get base URL from storage
    const baseUrlResult = await new Promise((resolve) => {
      chrome.storage.local.get(['baseUrl'], (result) => {
        resolve(result.baseUrl || 'https://development.yourcommonbase.com');
      });
    });

    // post to backend/add
    const response = await fetch(
      `${baseUrlResult}/backend/add`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          data: comment,
          metadata: {
            title: tabTitle,
            author: tabUrl,
          },
          parent_id: parentId,
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
    // const commentId = commentRes.id;
    // console.log('Comment added:', commentRes);

    // get parent by id
    // const parent = await getParentByID(apiKey, cbUrl, parentId);
    // console.log('Parent found:', parent);

    // if (parent) {
    //   let metadata = parent.metadata;
    //   try {
    //     metadata = JSON.parse(parent.metadata);
    //   } catch (e) {
    //     console.log('Error parsing metadata:', e);
    //   }
    //   // append commentID to parent.metadata.alias_ids[] or create new array if it doesn't exist
    //   const newAliasIds = metadata.alias_ids || [];
    //   newAliasIds.push(commentId);
    //   metadata.alias_ids = newAliasIds;
    //   parent.metadata = JSON.stringify(metadata);

    //   console.log('Parent updated:', parent);

    //   // update parent id
    //   const updateRes = await updateParentId(
    //     apiKey,
    //     cbUrl,
    //     parent.data,
    //     metadata,
    //     parent.id
    //   );
    //   console.log('Parent updated:', updateRes);
    // }

    // // change button text back to 'Submit'
    // submitButton.textContent = 'Submit';
    // submitButton.disabled = false;

    // // reset text box
    // textBox.value = '';

    // close the modal
    document.body.removeChild(modal);
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

async function callOpenAI(
  apiKey,
  prompt,
  systemMessage = 'You are a helpful assistant.'
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
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
  try {
    // get base URL from storage
    const baseUrlResult = await new Promise((resolve) => {
      chrome.storage.local.get(['baseUrl'], (result) => {
        resolve(result.baseUrl || 'https://development.yourcommonbase.com');
      });
    });

    // post to backend/addURL
    const response = await fetch(
      `${baseUrlResult}/backend/addURL`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: tabUrl,
          metadata: {
            title: tabTitle,
            author: tabUrl,
          },
        }),
      }
    );

    if (!response.ok) throw new Error('Upload failed');

    const data = await response.json();

    if (data.isDuplicate) {
      console.log('URL already exists in YCB');
      showToastInPage('URL already exists in YCB', 'warning');
      return;
    }

    // Store the URL and ID in the cache
    chrome.storage.local.get(['urlCache'], (result) => {
      const urlCache = result.urlCache || {};
      urlCache[cacheTabUrl] = data.id; // Assuming 'id' is the key in the response
      chrome.storage.local.set({ urlCache });
    });

    chrome.runtime.sendMessage({ action: 'setBadge' });
    
    // Show success toast
    showToastInPage('Page saved to YCB successfully!', 'success');
  } catch (error) {
    console.error('Error saving page:', error);
    showToastInPage('Failed to save page to YCB', 'error');
  }
}

function showToastInPage(message, type = 'success') {
  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    max-width: 300px;
    word-wrap: break-word;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    }, 300);
  }, 3000);
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
  try {
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

    if (!response.ok) throw new Error('Upload failed');

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

    if (!response2.ok) throw new Error('Comment upload failed');

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
    
    // Show success toast
    showToastInPage('Page with summary saved to YCB successfully!', 'success');
  } catch (error) {
    console.error('Error saving page with comment:', error);
    showToastInPage('Failed to save page to YCB', 'error');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setBadge') {
    chrome.action.setBadgeBackgroundColor({ color: '#008000' });
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);
  } else if (message.action === 'uploadCroppedScreenshot') {
    // Handle cropped screenshot upload
    const { imageData, tabInfo } = message;
    
    chrome.storage.local.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;
      
      if (!apiKey) {
        sendResponse({ success: false, error: 'API key not found' });
        return;
      }

      try {
        uploadScreenshot(imageData, tabInfo, apiKey, `Area screenshot of ${tabInfo.title}`)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    
    return true; // Keep message channel open for async response
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    // Get the current active tab first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab) return;
      
      chrome.storage.sync.get(['arcMode'], ({ arcMode }) => {
        if (arcMode) {
          chrome.windows.create({
            url: chrome.runtime.getURL('panel.html'),
            type: 'popup',
            width: 400,
            height: 600,
            top: 100,
            left: 1000, // align to right like a side panel
            focused: true,
          });
        } else {
          chrome.sidePanel.setOptions({
            path: 'panel.html',
            enabled: true,
          });
          chrome.sidePanel.open({ tabId: currentTab.id });
          // Set focus flag in storage for the panel to check
          console.log('Setting focus flag for keyboard shortcut');
          chrome.storage.local.set({ shouldFocusSearchBox: true });
        }
      });
    });
  } else if (command === 'open-ycb-dashboard') {
    getBaseUrl((baseUrl) => {
      chrome.tabs.create({
        url: `${baseUrl}/dashboard`
      });
    });
  }
});
