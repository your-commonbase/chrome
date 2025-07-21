console.log('This is the background page.');
console.log('Put the background scripts here.');

let isProcessing = false;

// Helper function to get base URL from storage with fallback
function getBaseUrl(callback) {
  chrome.storage.local.get(['baseUrl'], (result) => {
    const baseUrl = result.baseUrl || 'https://yourcommonbase.com';
    callback(baseUrl);
  });
}

function showToast(tabId, message, type = 'success') {
  chrome.scripting
    .executeScript({
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
      args: [message, type],
    })
    .catch((err) => {
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
      id: 'open-selected-text-in-ycb',
      title: 'Open in YCB',
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
      id: 'open-image-in-ycb',
      title: 'Open in YCB',
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

    chrome.contextMenus.create({
      id: 'save-youtube-timestamp-to-ycb',
      title: 'Save YouTube Timestamp to YCB',
      contexts: ['page'],
      documentUrlPatterns: ['https://www.youtube.com/watch?*'],
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
            showToast(
              tab.id,
              'Selected text saved to YCB successfully!',
              'success'
            );
          })
          .catch((err) => {
            console.error('Error uploading text:', err);
            showToast(tab.id, 'Failed to save text to YCB', 'error');
          });
      });
    });
  }
});

// Open selected text in YCB handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-selected-text-in-ycb') {
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
            return res.json();
          })
          .then((data) => {
            // Open the new entry in YCB dashboard
            chrome.tabs.create({
              url: `${baseUrl}/dashboard/entry/${data.id}`,
            });
            showToast(tab.id, 'Opened in YCB successfully!', 'success');
          })
          .catch((err) => {
            console.error('Error uploading text:', err);
            showToast(tab.id, 'Failed to open in YCB', 'error');
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
        url: `${baseUrl}/dashboard`,
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
  } else if (info.menuItemId === 'save-youtube-timestamp-to-ycb') {
    // Capture YouTube video frame at current timestamp
    captureYouTubeTimestamp(tab);
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
    chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Screenshot failed:', chrome.runtime.lastError);
          showToast(tab.id, 'Failed to capture screenshot', 'error');
          return;
        }

        // Store screenshot data temporarily with a unique key
        const screenshotId = Date.now().toString();
        chrome.storage.local.set(
          {
            [`screenshot_${screenshotId}`]: {
              imageData: dataUrl,
              tabInfo: {
                title: tab.title,
                url: tab.url,
                id: tab.id,
              },
            },
          },
          () => {
            // Open crop viewer window with screenshot ID in URL
            chrome.windows.create({
              url: chrome.runtime.getURL(`cropViewer.html?id=${screenshotId}`),
              type: 'popup',
              width: 900,
              height: 1000,
              focused: true,
            });
          }
        );
      }
    );
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

    chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Screenshot failed:', chrome.runtime.lastError);
          showToast(tab.id, 'Failed to capture screenshot', 'error');
          return;
        }

        const tabInfo = {
          title: tab.title,
          url: tab.url,
          id: tab.id,
        };

        uploadScreenshot(
          dataUrl,
          tabInfo,
          apiKey,
          'Screenshot of ' + tab.title
        ).catch((error) => {
          console.error('Failed to upload full screenshot:', error);
        });
      }
    );
  });
}

// Function to capture YouTube video frame at current timestamp
function captureYouTubeTimestamp(tab) {
  chrome.storage.local.get(['apiKey'], (result) => {
    const apiKey = result.apiKey;

    if (!apiKey) {
      showToast(tab.id, 'Please set API key in extension options', 'error');
      return;
    }

    // Execute script to get current timestamp and capture video frame
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        function: captureYouTubeVideoFrame,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.error('Script injection failed:', chrome.runtime.lastError);
          showToast(tab.id, 'Failed to capture video frame', 'error');
          return;
        }

        if (!results || !results[0] || !results[0].result) {
          showToast(tab.id, 'Failed to capture video frame', 'error');
          return;
        }

        const { timestamp, videoFrame, videoTitle, channelName, videoUrl } =
          results[0].result;

        if (!videoFrame) {
          showToast(tab.id, 'Failed to capture video frame', 'error');
          return;
        }

        // First get transcript, then upload with metadata
        getYouTubeTranscriptAtTimestamp(
          {
            timestamp,
            videoTitle,
            channelName,
            videoUrl,
            tabId: tab.id,
          },
          apiKey,
          videoFrame
        );
      }
    );
  });
}

// Function to capture video frame from YouTube page
function captureYouTubeVideoFrame() {
  try {
    const video = document.querySelector('video');
    if (!video) {
      throw new Error('No video element found');
    }

    const currentTime = video.currentTime;
    const videoTitle =
      document.querySelector(
        'h1.ytd-video-primary-info-renderer yt-formatted-string'
      )?.textContent ||
      document.querySelector('h1.title')?.textContent ||
      'YouTube Video';
    const channelName =
      document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
      document.querySelector('#channel-name')?.textContent?.trim() ||
      'Unknown Channel';

    // Create canvas to capture video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png');

    // Format timestamp for URL
    const timestampSeconds = Math.floor(currentTime);
    const timestampUrl = `${window.location.href}&t=${timestampSeconds}s`;

    return {
      timestamp: timestampSeconds,
      videoFrame: dataUrl,
      videoTitle,
      channelName,
      videoUrl: timestampUrl,
    };
  } catch (error) {
    console.error('Error capturing video frame:', error);
    return null;
  }
}

// Function to upload screenshot (returns Promise for async handling)
function uploadScreenshot(dataUrl, tabInfo, apiKey, title) {
  return new Promise((resolve, reject) => {
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'screenshot.png');
        formData.append(
          'metadata',
          JSON.stringify({
            title: title,
            author: tabInfo.url,
            type: 'image',
          })
        );

        getBaseUrl((baseUrl) => {
          fetch(`${baseUrl}/backend/v2/addImage`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          })
            .then((res) => {
              if (!res.ok) throw new Error('Upload failed');
              return res.json();
            })
            .then((data) => {
              console.log('Screenshot uploaded');
              chrome.runtime.sendMessage({ action: 'setBadge' });

              // Show toast if we have a tab ID
              if (tabInfo.id) {
                showToast(
                  tabInfo.id,
                  'Screenshot saved to YCB successfully!',
                  'success'
                );
              }

              resolve(data); // Return the response data including the ID
            })
            .catch((err) => {
              console.error('Error uploading screenshot:', err);

              // Show toast if we have a tab ID
              if (tabInfo.id) {
                showToast(
                  tabInfo.id,
                  'Failed to save screenshot to YCB',
                  'error'
                );
              }

              reject(err);
            });
        });
      })
      .catch(reject);
  });
}

// Function to upload YouTube video frame to YCB
function uploadYouTubeFrame(
  dataUrl,
  frameInfo,
  apiKey,
  transcriptAtTimestamp = null
) {
  return new Promise((resolve, reject) => {
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'youtube-frame.png');

        const metadata = {
          title: `${frameInfo.videoTitle} - Frame at ${formatTimestamp(
            frameInfo.timestamp
          )}`,
          author: frameInfo.videoUrl,
          type: 'image',
          timestamp: frameInfo.timestamp,
          channelName: frameInfo.channelName,
          videoTitle: frameInfo.videoTitle,
        };

        // Add transcript if available
        if (transcriptAtTimestamp) {
          metadata.transcriptAtTimestamp = transcriptAtTimestamp;
        }

        formData.append('metadata', JSON.stringify(metadata));

        getBaseUrl((baseUrl) => {
          fetch(`${baseUrl}/backend/v2/addImage`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          })
            .then((res) => {
              if (!res.ok) throw new Error('Upload failed');
              return res.json();
            })
            .then((data) => {
              console.log('YouTube frame uploaded:', data);

              // Show success toast
              if (frameInfo.tabId) {
                showToast(
                  frameInfo.tabId,
                  'Video frame saved to YCB successfully!',
                  'success'
                );
              }

              resolve(data);
            })
            .catch((err) => {
              console.error('Error uploading YouTube frame:', err);

              if (frameInfo.tabId) {
                showToast(
                  frameInfo.tabId,
                  'Failed to save video frame to YCB',
                  'error'
                );
              }

              reject(err);
            });
        });
      })
      .catch(reject);
  });
}

// Helper function to format timestamp (seconds to mm:ss)
function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to get YouTube transcript at specific timestamp and upload frame
function getYouTubeTranscriptAtTimestamp(frameInfo, apiKey, videoFrame) {
  console.log('Starting transcript extraction for frame:', frameInfo);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      console.log('No active tab found');
      return;
    }

    console.log('Executing transcript extraction script on tab:', tabs[0].id);
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: extractTranscriptAtTimestamp,
        args: [frameInfo.timestamp],
      },
      (results) => {
        console.log('Script execution completed, results:', results);
        if (chrome.runtime.lastError) {
          console.error(
            'Transcript extraction failed:',
            chrome.runtime.lastError
          );
        }

        let transcriptAtTimestamp = null;

        // Extract transcript if available
        if (results && results[0] && results[0].result) {
          const { transcript, debug } = results[0].result;
          console.log('Transcript extraction result:', { transcript });
          if (debug) {
            console.log('Debug info:', debug);
          }
          if (transcript) {
            transcriptAtTimestamp = transcript;
          }
        } else {
          console.log('No transcript results:', results);
        }

        console.log('Final transcript to include:', transcriptAtTimestamp);

        // Upload the video frame with transcript in metadata
        uploadYouTubeFrame(
          videoFrame,
          frameInfo,
          apiKey,
          transcriptAtTimestamp
        );
      }
    );
  });
}

// Function to extract transcript at specific timestamp
function extractTranscriptAtTimestamp(targetTimestamp) {
  const debug = [];
  debug.push('=== TRANSCRIPT EXTRACTION STARTING ===');
  debug.push('Target timestamp: ' + targetTimestamp);
  debug.push('Current URL: ' + window.location.href);
  
  try {
    // Close cookie banner if exists
    document.querySelector('button[aria-label*=cookies]')?.click();

    // Click the "show transcript" button
    const transcriptBtn = document.querySelector(
      'ytd-video-description-transcript-section-renderer button'
    );
    if (!transcriptBtn) {
      debug.push('No transcript button found');
      return { transcript: '', channelName: 'Unknown Channel', debug };
    }

    debug.push('Transcript button found, clicking...');
    transcriptBtn.click();

    // Wait for transcript container to appear
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          debug.push('Looking for transcript segments...');
          // Get all transcript segments
          const transcriptSegments = Array.from(
            document.querySelectorAll(
              '#segments-container .ytd-transcript-segment-renderer'
            )
          );
          
          debug.push('Found transcript segments: ' + transcriptSegments.length);

          if (transcriptSegments.length === 0) {
            debug.push('No transcript segments found');
            resolve({ transcript: '', channelName: 'Unknown Channel', debug });
            return;
          }

          // Find the segment closest to our target timestamp
          let closestSegment = null;
          let closestDistance = Infinity;

          debug.push('Target timestamp: ' + targetTimestamp);
          transcriptSegments.forEach((segment, index) => {
            const timestampElement = segment.querySelector('.segment-timestamp');
            if (timestampElement) {
              const timestampText = timestampElement.textContent.trim();
              debug.push(`Segment ${index}: timestamp text "${timestampText}"`);
              
              // Parse timestamp format like "17:26" to seconds
              const timeParts = timestampText.split(':');
              let startSeconds = 0;
              if (timeParts.length === 2) {
                // MM:SS format
                startSeconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
              } else if (timeParts.length === 3) {
                // HH:MM:SS format
                startSeconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
              }
              
              const distance = Math.abs(startSeconds - targetTimestamp);
              debug.push(`Segment ${index}: ${startSeconds}s (distance: ${distance}s)`);

              if (distance < closestDistance) {
                closestDistance = distance;
                closestSegment = segment;
              }
            } else {
              debug.push(`Segment ${index}: No timestamp element found`);
            }
          });

          debug.push('Closest segment found: ' + (closestSegment ? 'YES' : 'NO') + ', distance: ' + closestDistance);

          let transcriptText = '';
          if (closestSegment) {
            // Get text from segments within ±10 seconds of target timestamp
            const timeWindow = 10; // seconds
            const startTime = targetTimestamp - timeWindow;
            const endTime = targetTimestamp + timeWindow;
            
            debug.push(`Extracting segments from ${startTime}s to ${endTime}s (±${timeWindow}s window)`);

            transcriptSegments.forEach((segment, index) => {
              const timestampElement = segment.querySelector('.segment-timestamp');
              if (timestampElement) {
                const timestampText = timestampElement.textContent.trim();
                const timeParts = timestampText.split(':');
                let segmentSeconds = 0;
                
                if (timeParts.length === 2) {
                  segmentSeconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
                } else if (timeParts.length === 3) {
                  segmentSeconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
                }
                
                // Include segments within the time window
                if (segmentSeconds >= startTime && segmentSeconds <= endTime) {
                  debug.push(`Including segment ${index} at ${segmentSeconds}s`);
                  
                  const textElement = segment.querySelector('yt-formatted-string.segment-text');
                  if (textElement) {
                    const text = textElement.textContent.trim();
                    debug.push('Extracted text: "' + text + '"');
                    transcriptText += text + ' ';
                  } else {
                    // Try alternative selector
                    const altTextElement = segment.querySelector('yt-formatted-string');
                    if (altTextElement) {
                      const altText = altTextElement.textContent.trim();
                      debug.push('Alternative text extraction: "' + altText + '"');
                      transcriptText += altText + ' ';
                    } else {
                      debug.push('No text element found in segment ' + index);
                    }
                  }
                }
              }
            });
          } else {
            debug.push('No closest segment found');
          }

          // Get channel name
          const channelElement = document.querySelector('ytd-channel-name');
          const channelName =
            channelElement?.textContent.trim().split('\n')[0] ||
            'Unknown Channel';

          const result = {
            transcript: transcriptText.trim(),
            channelName: channelName,
            debug: debug
          };
          
          debug.push('Final transcript: "' + transcriptText.trim() + '"');
          resolve(result);
        } catch (error) {
          debug.push('Error extracting transcript: ' + error.message);
          resolve({ transcript: '', channelName: 'Unknown Channel', debug });
        }
      }, 3000); // Wait 3 seconds for transcript to load
    });
  } catch (error) {
    debug.push('Error in extractTranscriptAtTimestamp: ' + error.message);
    return Promise.resolve({ transcript: '', channelName: 'Unknown Channel', debug });
  }
}

// TODO screenshot comment Function to poll for object metadata
function pollForMetadata(
  apiKey,
  platformId,
  maxAttempts = 10,
  intervalMs = 2000
) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      console.log(`Polling for metadata, attempt ${attempts}/${maxAttempts}`);

      try {
        const baseUrl = await new Promise((res) => {
          getBaseUrl((url) => res(url));
        });

        const response = await fetch(`${baseUrl}/backend/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            platformId: platformId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Fetch failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Polling response:`, data);

        // Check if metadata exists
        if (data && data.metadata) {
          console.log('Metadata found:', data.metadata);
          resolve(data);
          return;
        }

        // If no metadata and we've reached max attempts, fail
        if (attempts >= maxAttempts) {
          reject(
            new Error(
              `Metadata not found after ${maxAttempts} attempts (${
                (maxAttempts * intervalMs) / 1000
              }s)`
            )
          );
          return;
        }

        // Schedule next attempt
        setTimeout(poll, intervalMs);
      } catch (error) {
        console.error(`Polling attempt ${attempts} failed:`, error);

        // If we've reached max attempts, fail
        if (attempts >= maxAttempts) {
          reject(
            new Error(
              `Polling failed after ${maxAttempts} attempts: ${error.message}`
            )
          );
          return;
        }

        // Schedule next attempt
        setTimeout(poll, intervalMs);
      }
    };

    // Start polling immediately
    poll();
  });
}

// Function to add a comment linked to a screenshot
function addCommentToScreenshot(apiKey, comment, tabInfo, parentId) {
  return new Promise((resolve, reject) => {
    if (!parentId) {
      reject(new Error('No parent ID provided for comment'));
      return;
    }

    getBaseUrl((baseUrl) => {
      fetch(`${baseUrl}/backend/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          data: comment,
          metadata: {
            title: `Comment on screenshot: ${tabInfo.title}`,
            author: tabInfo.url,
          },
          parent_id: parentId,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Comment upload failed');
          console.log(res);
          return res.json();
        })
        .then((data) => {
          console.log('Comment added to screenshot');
          resolve(data);
        })
        .catch((err) => {
          console.error('Error adding comment to screenshot:', err);
          reject(err);
        });
    });
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
            return res.json();
          })
          .then((data) => {
            if (data.isDuplicate) {
              console.log('URL is duplicate, showing comment modal');
              // Inject the modal script with the duplicate URL's ID as parent
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: openModal,
                args: [
                  apiKey,
                  baseUrl, // Using baseUrl as cbUrl since they're equivalent in this context
                  `Comment on: ${url}`,
                  url,
                  data.id, // Use the returned ID as parent_id
                  '', // Empty default text
                ],
              });
            } else {
              console.log('URL uploaded successfully');
              chrome.runtime.sendMessage({ action: 'setBadge' });
              showToast(tab.id, 'URL saved to YCB successfully!', 'success');
            }
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
            return fetch(`${baseUrl}/backend/v2/addImage`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              body: formData,
            })
              .then((res) => {
                if (!res.ok) throw new Error('Upload failed');
                console.log('Image uploaded');
                chrome.runtime.sendMessage({ action: 'setBadge' });
                showToast(
                  tab.id,
                  'Image saved to YCB successfully!',
                  'success'
                );
              })
              .catch((err) => {
                console.error('Error uploading image:', err);
                showToast(tab.id, 'Failed to save image to YCB', 'error');
              });
          });
        });
    });
  }
});

// Open image in YCB handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-image-in-ycb') {
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
            return fetch(`${baseUrl}/backend/v2/addImage`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              body: formData,
            })
              .then((res) => {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
              })
              .then((data) => {
                // Open the new entry in YCB dashboard
                chrome.tabs.create({
                  url: `${baseUrl}/dashboard/entry/${data.id}`,
                });
                showToast(tab.id, 'Opened in YCB successfully!', 'success');
              })
              .catch((err) => {
                console.error('Error uploading image:', err);
                showToast(tab.id, 'Failed to open in YCB', 'error');
              });
          });
        });
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
                chrome.tabs
                  .sendMessage(panelTab.id, {
                    action: 'updatePanelQuery',
                    query: selectedText,
                  })
                  .catch((err) => {
                    console.log(
                      'Message failed, panel will use storage instead:',
                      err
                    );
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
          chrome.runtime
            .sendMessage({
              action: 'updatePanelQuery',
              query: selectedText,
            })
            .catch((err) => {
              console.log(
                'No panel to receive message yet, will use storage:',
                err
              );
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
        showToast(
          tab.id,
          'Please set API key and CB URL in extension options',
          'error'
        );
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
  // Remove existing modal if it exists
  const existingOverlay = document.getElementById('ycb-modal-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'ycb-modal-overlay';
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(0, 0, 0, 0.7) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 999999 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 20px !important;
    animation: ycb-fadeIn 0.2s ease !important;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.id = 'ycb-comment-modal';
  modal.style.cssText = `
    background: #2a2a2a !important;
    border-radius: 12px !important;
    padding: 24px !important;
    width: 100% !important;
    max-width: 500px !important;
    max-height: 80vh !important;
    overflow-y: auto !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2) !important;
    color: #ffffff !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    border: none !important;
    outline: none !important;
    text-decoration: none !important;
    position: relative !important;
    animation: ycb-slideIn 0.3s ease !important;
  `;

  // Add CSS animations
  if (!document.getElementById('ycb-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'ycb-modal-styles';
    style.textContent = `
      @keyframes ycb-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ycb-slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Create modal title
  const title = document.createElement('h3');
  title.style.cssText = `
    font-size: 18px !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    margin: 0 0 8px 0 !important;
    padding: 0 !important;
    border: none !important;
    font-family: inherit !important;
    line-height: 1.4 !important;
  `;
  title.textContent = 'Add Comment';

  // Create subtitle
  const subtitle = document.createElement('p');
  subtitle.style.cssText = `
    font-size: 14px !important;
    color: rgba(255, 255, 255, 0.7) !important;
    margin: 0 0 16px 0 !important;
    padding: 0 !important;
    border: none !important;
    font-family: inherit !important;
    line-height: 1.5 !important;
  `;
  subtitle.textContent = `Commenting on: ${tabTitle}`;

  // Create view link
  const viewContainer = document.createElement('div');
  viewContainer.style.cssText = `
    margin: 0 0 16px 0 !important;
    padding: 0 !important;
    border: none !important;
  `;

  // Create text box
  const textBox = document.createElement('textarea');
  textBox.style.cssText = `
    width: 100% !important;
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 8px !important;
    color: #ffffff !important;
    padding: 12px !important;
    font-family: inherit !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    resize: vertical !important;
    min-height: 100px !important;
    box-sizing: border-box !important;
    transition: border-color 0.2s !important;
    margin: 0 0 20px 0 !important;
    outline: none !important;
  `;
  textBox.placeholder = 'Add your comment...';
  textBox.value = defaultText;

  // Focus styles for textarea
  textBox.addEventListener('focus', () => {
    textBox.style.borderColor = '#3b82f6 !important';
    textBox.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1) !important';
  });
  textBox.addEventListener('blur', () => {
    textBox.style.borderColor = 'rgba(255, 255, 255, 0.15) !important';
    textBox.style.boxShadow = 'none !important';
  });

  // Prevent clicks on modal content from closing the modal
  modal.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Close modal when clicking overlay
  overlay.addEventListener('click', () => {
    overlay.remove();
    const styles = document.getElementById('ycb-modal-styles');
    if (styles) styles.remove();
  });

  // Add view link after getting base URL
  chrome.storage.local.get(['baseUrl'], (result) => {
    const baseUrl = result.baseUrl || 'https://yourcommonbase.com';
    const href = `${baseUrl}/dashboard/entry/${parentId}`;
    const a = document.createElement('a');
    a.style.cssText = `
      color: #60a5fa !important;
      text-decoration: none !important;
      font-size: 14px !important;
      font-family: inherit !important;
      transition: color 0.2s ease !important;
      display: inline-block !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      background: none !important;
    `;
    a.href = href;
    a.target = '_blank';
    a.textContent = 'View in YCB Dashboard';
    a.addEventListener('mouseover', () => {
      a.style.color = '#3b82f6 !important';
      a.style.textDecoration = 'underline !important';
    });
    a.addEventListener('mouseout', () => {
      a.style.color = '#60a5fa !important';
      a.style.textDecoration = 'none !important';
    });
    viewContainer.appendChild(a);
  });

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
        resolve(result.baseUrl || 'https://yourcommonbase.com');
      });
    });

    // post to backend/add
    const response = await fetch(`${baseUrlResult}/backend/add`, {
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
    });

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

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex !important;
    gap: 12px !important;
    justify-content: flex-end !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
  `;

  // Create submit button
  const submitButton = document.createElement('button');
  submitButton.style.cssText = `
    padding: 10px 20px !important;
    background: #3b82f6 !important;
    border: none !important;
    border-radius: 8px !important;
    color: white !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    font-family: inherit !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin: 0 !important;
    outline: none !important;
    text-decoration: none !important;
    box-sizing: border-box !important;
  `;
  submitButton.textContent = 'Add Comment';

  // Submit button hover effect
  submitButton.addEventListener('mouseover', () => {
    if (!submitButton.disabled) {
      submitButton.style.background = '#2563eb !important';
    }
  });
  submitButton.addEventListener('mouseout', () => {
    if (!submitButton.disabled) {
      submitButton.style.background = '#3b82f6 !important';
    }
  });

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.style.cssText = `
    padding: 10px 20px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 8px !important;
    color: rgba(255, 255, 255, 0.8) !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    font-family: inherit !important;
    margin: 0 !important;
    outline: none !important;
    text-decoration: none !important;
    box-sizing: border-box !important;
  `;
  closeButton.textContent = 'Cancel';

  // Close button hover effect
  closeButton.addEventListener('mouseover', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.15) !important';
    closeButton.style.color = '#ffffff !important';
  });
  closeButton.addEventListener('mouseout', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.1) !important';
    closeButton.style.color = 'rgba(255, 255, 255, 0.8) !important';
  });

  // Submit button click handler
  submitButton.addEventListener('click', async () => {
    const text = textBox.value.trim();

    if (!text) {
      // Show error state briefly
      textBox.style.borderColor = '#ef4444 !important';
      setTimeout(() => {
        textBox.style.borderColor = 'rgba(255, 255, 255, 0.15) !important';
      }, 2000);
      return;
    }

    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.style.background = 'rgba(255, 255, 255, 0.1) !important';
    submitButton.style.cursor = 'not-allowed !important';
    submitButton.innerHTML = `
      <div style="
        width: 14px !important;
        height: 14px !important;
        border: 2px solid rgba(255, 255, 255, 0.2) !important;
        border-top: 2px solid #ffffff !important;
        border-radius: 50% !important;
        animation: ycb-spin 1s linear infinite !important;
        margin-right: 6px !important;
      "></div>
      Adding...
    `;

    // Add spin animation if not already added
    if (!document.getElementById('ycb-spin-styles')) {
      const spinStyle = document.createElement('style');
      spinStyle.id = 'ycb-spin-styles';
      spinStyle.textContent = `
        @keyframes ycb-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(spinStyle);
    }

    try {
      await addComment(apiKey, cbUrl, text, tabTitle, tabUrl, parentId);
      // Close modal on success
      overlay.remove();
      const styles = document.getElementById('ycb-modal-styles');
      if (styles) styles.remove();
      const spinStyles = document.getElementById('ycb-spin-styles');
      if (spinStyles) spinStyles.remove();
    } catch (error) {
      console.error('Error adding comment:', error);
      // Reset button on error
      submitButton.disabled = false;
      submitButton.style.background = '#3b82f6 !important';
      submitButton.style.cursor = 'pointer !important';
      submitButton.textContent = 'Add Comment';

      // Show error state
      textBox.style.borderColor = '#ef4444 !important';
      setTimeout(() => {
        textBox.style.borderColor = 'rgba(255, 255, 255, 0.15) !important';
      }, 3000);
    }
  });

  // Close button click handler
  closeButton.addEventListener('click', () => {
    overlay.remove();
    const styles = document.getElementById('ycb-modal-styles');
    if (styles) styles.remove();
  });

  // Escape key to close modal
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      const styles = document.getElementById('ycb-modal-styles');
      if (styles) styles.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Ctrl+Enter to submit
  textBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitButton.click();
    }
  });

  // Append elements to modal
  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(viewContainer);
  modal.appendChild(textBox);

  buttonContainer.appendChild(closeButton);
  buttonContainer.appendChild(submitButton);
  modal.appendChild(buttonContainer);

  // Append modal to overlay and overlay to body
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus the text box
  setTimeout(() => textBox.focus(), 100);
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
        resolve(result.baseUrl || 'https://yourcommonbase.com');
      });
    });

    // post to backend/addURL
    const response = await fetch(`${baseUrlResult}/backend/addURL`, {
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
    });

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
  } else if (message.action === 'captureYouTubeTimestamp') {
    // Handle YouTube timestamp capture from side panel
    chrome.tabs.get(message.tabId, (tab) => {
      if (tab.url && tab.url.includes('youtube.com/watch')) {
        captureYouTubeTimestamp(tab);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Not a YouTube video page' });
      }
    });
    return true; // Required for async response
  } else if (message.action === 'uploadCroppedScreenshot') {
    // Handle cropped screenshot upload
    const { imageData, tabInfo, comment } = message;

    chrome.storage.local.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;

      if (!apiKey) {
        sendResponse({ success: false, error: 'API key not found' });
        return;
      }

      try {
        console.log('Uploading cropped screenshot with comment:', comment);
        uploadScreenshot(
          imageData,
          tabInfo,
          apiKey,
          `Area screenshot of ${tabInfo.title}`
        )
          .then((screenshotResponse) => {
            console.log('Screenshot upload response:', screenshotResponse);

            // Always send success response immediately to close the window
            sendResponse({ success: true });

            // If there's a comment, add it as a linked entry in the background
            if (comment && comment.trim()) {
              console.log(
                'Adding comment to screenshot with parent ID:',
                screenshotResponse?.id
              );
              console.log(
                'Window can now close - comment will be processed in background'
              );

              // Process comment in background after delay
              setTimeout(() => {
                addCommentToScreenshot(
                  apiKey,
                  comment,
                  tabInfo,
                  screenshotResponse?.id
                )
                  .then((commentResponse) => {
                    console.log(
                      'Comment added successfully in background:',
                      commentResponse
                    );
                    // Optionally show a toast notification that comment was added
                    if (tabInfo.id) {
                      showToast(
                        tabInfo.id,
                        'Screenshot comment added successfully!',
                        'success'
                      );
                    }
                  })
                  .catch((error) => {
                    console.error(
                      'Failed to add comment in background:',
                      error
                    );
                    // Optionally show error toast
                    if (tabInfo.id) {
                      showToast(
                        tabInfo.id,
                        'Failed to add screenshot comment',
                        'error'
                      );
                    }
                  });
              }, 60000);
            } else {
              console.log('No comment provided, screenshot upload complete');
            }
          })
          .catch((error) => {
            console.error('Screenshot upload failed:', error);
            sendResponse({ success: false, error: error.message });
          });
      } catch (error) {
        console.error('Error in uploadCroppedScreenshot handler:', error);
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
        url: `${baseUrl}/dashboard`,
      });
    });
  }
});
