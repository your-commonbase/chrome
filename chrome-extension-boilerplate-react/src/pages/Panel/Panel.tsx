import React, { useState, useEffect, useRef } from 'react';
import './Panel.css';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import { InstantSearch, InfiniteHits } from 'react-instantsearch';
import CustomSearchBox from './CustomSearchBox';

// Helper function to get base URL from storage with fallback
const getBaseUrl = (): Promise<string> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['baseUrl'], (result) => {
      resolve(result.baseUrl || 'https://yourcommonbase.com');
    });
  });
};

// Helper function to resolve URLs that might start with "/"
const resolveUrl = async (url: string): Promise<string> => {
  if (url.startsWith('/')) {
    const baseUrl = await getBaseUrl();
    return `${baseUrl}${url}`;
  }
  return url;
};

const fetchImage = async (id: string): Promise<any | undefined> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiKey'], async (result) => {
      const apiKey = result.apiKey;

      if (!apiKey) {
        resolve(undefined);
        return;
      }

      try {
        const baseUrl = await getBaseUrl();
        const resp = await fetch(`${baseUrl}/backend/fetchImagesByIDs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            ids: [id],
          }),
        });
        const data = await resp.json();
        resolve({ id, image: data.body.urls[id] });
      } catch (err: any) {
        resolve(undefined);
      } finally {
      }
    });
  });
};

const Hit = ({ hit, onAddComment }: any) => {
  const [image, setImage] = useState<any | undefined>(undefined);
  const [resolvedAuthorUrl, setResolvedAuthorUrl] = useState<string>('');

  useEffect(() => {
    const fetchAndSetImage = async () => {
      if (hit.metadata.type && hit.metadata.type === 'image') {
        const imageUrl = await fetchImage(hit.id);
        setImage(imageUrl);
      }
    };
    fetchAndSetImage();
  }, [
    hit.metadata.type,
    hit.id,
    hit.metadata.type === 'image',
    hit.image,
    fetchImage,
  ]);

  useEffect(() => {
    const resolveAuthorUrl = async () => {
      if (hit.metadata.author) {
        const resolved = await resolveUrl(hit.metadata.author);
        setResolvedAuthorUrl(resolved);
      }
    };
    resolveAuthorUrl();
  }, [hit.metadata.author]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const baseUrl = await getBaseUrl();
    chrome.tabs.create({
      url: `${baseUrl}/dashboard/entry/${hit.id}`,
    });
  };

  return (
    <div className="hit-container">
      <div className="hit-content" onClick={handleClick}>
        <div
          className="hit-text"
          dangerouslySetInnerHTML={{
            __html: hit._highlightResult.data.value
              .replace(/<em>/g, '<span class="hit-highlight">')
              .replace(/<\/em>/g, '</span>'),
          }}
        />

        {image && image.id === hit.id && (
          <div className="result-image">
            <img src={image.image} alt="Attachment" />
          </div>
        )}

        <div className="result-metadata">
          {hit._highlightResult.metadata.title && (
            <div className="result-meta-item">
              <span className="result-meta-label">Title:</span>
              <span
                className="result-meta-value"
                dangerouslySetInnerHTML={{
                  __html: hit._highlightResult.metadata.title.value,
                }}
              />
            </div>
          )}

          {hit._highlightResult.metadata.author && (
            <div className="result-meta-item">
              <span className="result-meta-label">Source:</span>
              <a
                className="result-meta-link"
                href={resolvedAuthorUrl || hit.metadata.author}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={resolvedAuthorUrl || hit.metadata.author}
              >
                {(() => {
                  try {
                    const urlToDisplay =
                      resolvedAuthorUrl || hit.metadata.author;

                    // Check if URL contains yourcommonbase.com
                    if (urlToDisplay.includes('yourcommonbase.com')) {
                      return 'Your Commonbase';
                    }

                    const url = new URL(urlToDisplay);
                    return url.hostname.replace('www.', '');
                  } catch {
                    const urlToDisplay =
                      resolvedAuthorUrl || hit.metadata.author;

                    // Check if URL contains yourcommonbase.com (for relative URLs)
                    if (urlToDisplay.includes('yourcommonbase.com')) {
                      return 'Your Commonbase';
                    }

                    return urlToDisplay.length > 30
                      ? urlToDisplay.substring(0, 30) + '...'
                      : urlToDisplay;
                  }
                })()}
              </a>
            </div>
          )}
        </div>
      </div>

      <button
        className="add-comment-btn"
        onClick={(e) => {
          e.stopPropagation();
          const title =
            hit._highlightResult?.metadata?.title?.value ||
            hit.data?.substring(0, 50) + '...' ||
            'Untitled';
          const author = hit.metadata?.author || '';
          onAddComment(hit.id, title, author);
        }}
        title="Add comment"
      >
        +
      </button>
    </div>
  );
};

const Panel: React.FC = () => {
  const [searchClient, setSearchClient] = useState<any | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [selectedEntryTitle, setSelectedEntryTitle] = useState<string>('');
  const [selectedEntryAuthor, setSelectedEntryAuthor] = useState<string>('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [quickAddText, setQuickAddText] = useState<string>('');
  const [isQuickAdding, setIsQuickAdding] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [randomRecord, setRandomRecord] = useState<any>(null);
  const [randomRecordImage, setRandomRecordImage] = useState<string | null>(
    null
  );
  const [storyKey, setStoryKey] = useState<number>(0); // Key to restart CSS animation
  const [isLoadingRandomRecord, setIsLoadingRandomRecord] =
    useState<boolean>(false);
  const [theBaseUrl, setTheBaseUrl] = useState<string>('');
  const [hideRandomEntry, setHideRandomEntry] = useState<boolean>(false);
  const [activeTabs, setActiveTabs] = useState<chrome.tabs.Tab[]>([]);
  const [currentActiveTab, setCurrentActiveTab] =
    useState<chrome.tabs.Tab | null>(null);
  const [isAddingTab, setIsAddingTab] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [isUploadingLikedVideos, setIsUploadingLikedVideos] = useState<boolean>(false);
  const [likedVideosProgress, setLikedVideosProgress] = useState<{ current: number; total: number; currentTitle: string }>({ current: 0, total: 0, currentTitle: '' });
  const [skipCount, setSkipCount] = useState<string>('0');
  const [stopIndex, setStopIndex] = useState<string>('');
  const shouldStopUploadRef = useRef<boolean>(false);
  const [isUploadingIgSaved, setIsUploadingIgSaved] = useState<boolean>(false);
  const [igSavedProgress, setIgSavedProgress] = useState<{ current: number; total: number; currentTitle: string }>({ current: 0, total: 0, currentTitle: '' });
  const [igSkipCount, setIgSkipCount] = useState<string>('0');
  const [igStopIndex, setIgStopIndex] = useState<string>('');
  const shouldStopIgUploadRef = useRef<boolean>(false);

  const getToken = async (token: string) => {
    const baseUrl = await getBaseUrl();
    setTheBaseUrl(baseUrl);
    const resp = await fetch(`${baseUrl}/backend/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await resp.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.token;
  };

  useEffect(() => {
    chrome.storage.local.get(['hideRandomEntry'], (result) => {
      setHideRandomEntry(result.hideRandomEntry || false);
    });
  }, []);

  useEffect(() => {
    const fetchTabs = () => {
      chrome.tabs.query({}, (tabs) => {
        setActiveTabs(tabs);
        // Find the current active tab
        const activeTab = tabs.find((tab) => tab.active);
        setCurrentActiveTab(activeTab || null);
      });
    };

    fetchTabs();

    const tabUpdateListener = () => {
      fetchTabs();
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    chrome.tabs.onCreated.addListener(tabUpdateListener);
    chrome.tabs.onRemoved.addListener(tabUpdateListener);
    chrome.tabs.onActivated.addListener(tabUpdateListener);

    return () => {
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      chrome.tabs.onCreated.removeListener(tabUpdateListener);
      chrome.tabs.onRemoved.removeListener(tabUpdateListener);
      chrome.tabs.onActivated.removeListener(tabUpdateListener);
    };
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    chrome.storage.local.get(['apiKey'], async (result) => {
      const apiKey = result.apiKey;
      if (!apiKey) {
        setError('api key not found');
        setLoading(false);
        return;
      }

      const setupClient = async () => {
        try {
          const token = await getToken(apiKey);
          const { searchClient: msClient } = instantMeiliSearch(
            'https://meili-i59l.onrender.com',
            token,
            { placeholderSearch: false }
          );
          setSearchClient(msClient);
          setLoadingSearch(false);
          setTokenError(null);
        } catch (err: any) {
          console.log('Token error:', err.message);
          setTokenError(err.message || 'failed to fetch token');
          setLoadingSearch(false);
        }
      };

      // initial setup
      await setupClient();
      // refresh every 60s
      intervalId = setInterval(setupClient, 60_000);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const [query, setQuery] = useState('');

  // On mount, get the initial query from chrome.storage and set up message listener
  useEffect(() => {
    // Check for initial query from storage
    chrome.storage.local.get(['panelQuery'], (result) => {
      if (result.panelQuery) {
        setQuery(result.panelQuery);
        handleSearchManual(result.panelQuery);
        // Clear the stored query after using it
        chrome.storage.local.remove(['panelQuery']);
      }
    });

    const handleMessage = (message: any) => {
      if (
        message.action === 'updatePanelQuery' &&
        typeof message.query === 'string'
      ) {
        // Clear existing results first
        clearSemanticResults();

        // Set new query (this will trigger CustomSearchBox update)
        setQuery(message.query);

        // Trigger semantic search with new query
        handleSearchManual(message.query);

        // Send message to CustomSearchBox to update its input and trigger InstantSearch
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'updateSearchBox',
            query: message.query,
          });
        }, 50);
      }
      console.log('Message received:', message);
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSemanticResults = () => {
    setResults([]);
    setError(null);
  };

  const handleSearchManual = async (query: string) => {
    setLoading(true);
    setError(null);

    // Get API keys and URLs from chrome.storage.local
    chrome.storage.local.get(['apiKey'], async (result) => {
      const apiKey = result.apiKey;

      if (!apiKey) {
        setError('API key or URL not found.');
        setLoading(false);
        return;
      }

      try {
        const baseUrl = await getBaseUrl();
        const response = await fetch(`${baseUrl}/backend/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            text: query,
            matchLimit: 5,
            matchThreshold: 0.35,
          }),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        for (const item of data) {
          if (item.metadata.type && item.metadata.type === 'image') {
            const imageData = await fetchImage(item.id);
            item.image = imageData?.image;
          }
        }
        setResults(data || []);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Get API keys and URLs from chrome.storage.local
    chrome.storage.local.get(['apiKey'], async (result) => {
      const apiKey = result.apiKey;

      if (!apiKey) {
        setError('API key or URL not found.');
        setLoading(false);
        return;
      }

      try {
        const baseUrl = await getBaseUrl();
        const response = await fetch(`${baseUrl}/backend/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            text: query,
            matchLimit: 5,
            matchThreshold: 0.35,
          }),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        for (const item of data) {
          if (item.metadata.type && item.metadata.type === 'image') {
            const imageData = await fetchImage(item.id);
            item.image = imageData?.image;
          }
        }
        setResults(data || []);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    });
  };

  // Alternate search box component for when InstantSearch is unavailable
  const AlternateSearchBox = () => {
    const [localQuery, setLocalQuery] = useState(query);
    const [isSearching, setIsSearching] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!localQuery.trim()) return;

      setIsSearching(true);
      try {
        await handleSearchManual(localQuery);
      } finally {
        setIsSearching(false);
      }
    };

    return (
      <div className="search-container">
        <form onSubmit={handleSubmit} className="search-box">
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Find anything you've ever saved..."
            className="search-input"
          />
          <button
            type="submit"
            disabled={isSearching || !localQuery.trim()}
            className="search-button"
          >
            {isSearching && <div className="loading-spinner"></div>}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {localQuery && (
            <button
              type="button"
              onClick={() => {
                setLocalQuery('');
                setQuery('');
                clearSemanticResults();
              }}
              className="clear-button"
            >
              Clear
            </button>
          )}
        </form>
      </div>
    );
  };

  const handleSemanticResultClick = async (item: any) => {
    const baseUrl = await getBaseUrl();
    chrome.tabs.create({
      url: `${baseUrl}/dashboard/entry/${item.id}`,
    });
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddComment = (
    entryId: string,
    entryTitle: string,
    entryAuthor: string = ''
  ) => {
    setSelectedEntryId(entryId);
    setSelectedEntryTitle(entryTitle);
    setSelectedEntryAuthor(entryAuthor);
    setShowCommentModal(true);
  };

  const submitComment = async (comment: string) => {
    if (!comment.trim()) {
      showToast('Comment cannot be empty', 'error');
      return;
    }

    try {
      // Get API key from storage
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        showToast('API key not found. Please check your settings.', 'error');
        return;
      }

      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/backend/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result.apiKey}`,
        },
        body: JSON.stringify({
          data: comment,
          metadata: {
            title: `Comment on: ${selectedEntryTitle}`,
            author: selectedEntryAuthor || window.location.href,
          },
          parent_id: selectedEntryId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      showToast('Comment added successfully!', 'success');
      setShowCommentModal(false);
      setSelectedEntryId('');
      setSelectedEntryTitle('');
      setSelectedEntryAuthor('');
    } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Failed to add comment. Please try again.', 'error');
    }
  };

  // Helper function to get YouTube timestamp and create timestamped URL
  const getYouTubeTimestamp = async (
    subtractSeconds: number = 0
  ): Promise<string | null> => {
    try {
      if (!currentActiveTab?.url?.includes('youtube.com/watch')) {
        return null;
      }

      // Get current timestamp from the active YouTube tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentActiveTab.id! },
        func: (subtract: number) => {
          try {
            const video = document.querySelector('video') as HTMLVideoElement;
            if (!video) return null;

            let currentTime = Math.floor(video.currentTime);

            // Subtract the specified seconds, but don't go below 0
            currentTime = Math.max(0, currentTime - subtract);

            const minutes = Math.floor(currentTime / 60);
            const seconds = currentTime % 60;
            const timestamp = `${minutes}:${seconds
              .toString()
              .padStart(2, '0')}`;

            // Get current URL and add timestamp parameter
            const url = new URL(window.location.href);
            url.searchParams.set('t', `${currentTime}s`);

            return { timestamp, url: url.toString() };
          } catch (error) {
            return null;
          }
        },
        args: [subtractSeconds],
      });

      const result = results[0]?.result as {
        timestamp?: string;
        url?: string;
      } | null;
      if (result?.timestamp && result?.url) {
        return `[${result.timestamp}](${result.url})`;
      }

      return null;
    } catch (error) {
      // Silently fail as requested
      return null;
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddText.trim()) {
      showToast('Please enter some text to add', 'error');
      return;
    }

    setIsQuickAdding(true);

    try {
      // Get API key from storage
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        showToast('API key not found. Please check your settings.', 'error');
        return;
      }

      // Check for [-Ns] pattern in the comment to subtract seconds from timestamp
      let subtractSeconds = 0;
      let cleanedText = quickAddText;

      // Match pattern like [-10s], [-15s], etc.
      const timestampPattern = /\[-(\d+)s\]/g;
      const matches = Array.from(quickAddText.matchAll(timestampPattern));

      if (matches.length > 0) {
        // Use the last match if multiple are found
        const lastMatch = matches[matches.length - 1];
        subtractSeconds = parseInt(lastMatch[1], 10);

        // Remove all [-Ns] patterns from the text
        cleanedText = quickAddText.replace(timestampPattern, '').trim();
      }

      // Get YouTube timestamp if applicable
      const timestampLink = await getYouTubeTimestamp(subtractSeconds);

      // Append timestamp to comment data if available
      const commentData = timestampLink
        ? `${cleanedText}\n\n${timestampLink}`
        : cleanedText;

      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/backend/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result.apiKey}`,
        },
        body: JSON.stringify({
          data: commentData,
          metadata: {
            title: currentActiveTab?.title || 'From Chrome Extension',
            author: currentActiveTab?.url || '',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add text');
      }

      showToast('Text added to YCB successfully!', 'success');
      setQuickAddText('');
    } catch (error) {
      console.error('Error adding text:', error);
      showToast('Failed to add text. Please try again.', 'error');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    // Check if it's an image file
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    setIsUploadingImage(true);

    try {
      // Get API key from storage
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        showToast('API key not found. Please check your settings.', 'error');
        return;
      }

      const baseUrl = await getBaseUrl();
      const formData = new FormData();
      formData.append('file', file);
      formData.append(
        'metadata',
        JSON.stringify({
          title: `Image from Chrome Extension: ${file.name}`,
          type: 'image',
        })
      );

      const response = await fetch(`${baseUrl}/backend/v2/addImage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${result.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      showToast('Image uploaded to YCB successfully!', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast('Failed to upload image. Please try again.', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const fetchRandomRecord = async () => {
    setIsLoadingRandomRecord(true);

    try {
      // Get API key from storage
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        console.log('No API key found for random record fetch');
        return;
      }

      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/backend/random`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result.apiKey}`,
        },
        body: JSON.stringify({
          count: 1,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch random record');
      }

      const data = await response.json();
      if (data && data.length > 0) {
        const record = data[0];
        setRandomRecord(record);

        // If it's an image record, fetch the image
        if (record.metadata?.type === 'image') {
          const imageData = await fetchImage(record.id);
          setRandomRecordImage(imageData?.image || null);
        } else {
          setRandomRecordImage(null);
        }

        // Reset CSS animation by changing key
        setStoryKey((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching random record:', error);
    } finally {
      setIsLoadingRandomRecord(false);
    }
  };

  // Initialize random record and set up 30-second cycle
  useEffect(() => {
    if (!hideRandomEntry) {
      fetchRandomRecord(); // Initial fetch

      const interval = setInterval(() => {
        fetchRandomRecord();
      }, 30000 * 2 * 5); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [hideRandomEntry]);

  // No more JavaScript progress bar animation - using pure CSS instead

  const handleRandomRecordClick = async () => {
    if (!randomRecord) return;

    const baseUrl = await getBaseUrl();
    chrome.tabs.create({
      url: `${baseUrl}/dashboard/entry/${randomRecord.id}`,
    });
  };

  const handleSwitchToTab = async (tab: chrome.tabs.Tab) => {
    if (!tab.id) return;

    try {
      // Switch to the tab
      await chrome.tabs.update(tab.id, { active: true });
      // Switch to the window containing the tab
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (error) {
      console.error('Error switching to tab:', error);
      showToast('Failed to switch to tab.', 'error');
    }
  };

  const handleAddTab = async (tab: chrome.tabs.Tab) => {
    if (!tab.url || !tab.id) return;

    setIsAddingTab((prev) => ({ ...prev, [tab.id!.toString()]: true }));

    try {
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        showToast('API key not found. Please check your settings.', 'error');
        return;
      }

      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/backend/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result.apiKey}`,
        },
        body: JSON.stringify({
          data: tab.title || 'Untitled',
          metadata: {
            title: tab.title || 'Untitled',
            author: tab.url,
          },
          "duplicate_check": {
              "fields": {
                  "metadata": {
                      "author": tab.url
                  }
              }
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add tab');
      }

      showToast('Tab added to YCB successfully!', 'success');
    } catch (error) {
      console.error('Error adding tab:', error);
      showToast('Failed to add tab to YCB. Please try again.', 'error');
    } finally {
      setIsAddingTab((prev) => ({ ...prev, [tab.id!.toString()]: false }));
    }
  };

  const handleUploadLikedVideos = async () => {
    if (!currentActiveTab?.url?.includes('youtube.com/playlist?list=LL')) {
      showToast('Please navigate to YouTube Liked Videos page first', 'error');
      return;
    }

    setIsUploadingLikedVideos(true);
    shouldStopUploadRef.current = false;
    setLikedVideosProgress({ current: 0, total: 0, currentTitle: 'Collecting videos...' });

    try {
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        showToast('API key not found. Please check your settings.', 'error');
        return;
      }

      // Extract all video URLs and titles from the current page and auto-paginate
      const extractResults = await chrome.scripting.executeScript({
        target: { tabId: currentActiveTab.id! },
        func: () => {
          return new Promise((resolve) => {
            const videos = [];
            let hasMoreContent = true;
            let attempts = 0;
            const maxAttempts = 50;

            // Function to extract video data from current viewport
            const extractCurrentVideos = () => {
              const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
              const currentVideos = [];
              
              videoElements.forEach((element) => {
                const linkElement = element.querySelector('a#video-title');
                const channelElement = element.querySelector('ytd-channel-name a, #channel-name a');
                
                if (linkElement) {
                  const href = linkElement.href;
                  const title = linkElement.textContent?.trim() || 'Unknown Title';
                  const channelName = channelElement?.textContent?.trim() || 'Unknown Channel';
                  
                  if (href && href.includes('/watch?v=')) {
                    const existingVideo = currentVideos.find(v => v.url === href);
                    if (!existingVideo) {
                      currentVideos.push({ url: href, title, channelName });
                    }
                  }
                }
              });
              
              return currentVideos;
            };

            // Function to scroll and wait for new content
            const scrollAndWait = (callback) => {
              const beforeCount = extractCurrentVideos().length;
              
              // Scroll to bottom of the page
              window.scrollTo(0, document.body.scrollHeight);
              
              // Wait for new content to load
              setTimeout(() => {
                const afterCount = extractCurrentVideos().length;
                callback(afterCount > beforeCount);
              }, 3000); // Increased wait time for YouTube's lazy loading
            };

            // Initial extraction
            const initialVideos = extractCurrentVideos();
            videos.push(...initialVideos);

            // Auto-paginate by scrolling
            const processNext = () => {
              if (!hasMoreContent || attempts >= maxAttempts) {
                resolve({
                  videos: videos,
                  totalFound: videos.length,
                  pagesScrolled: attempts
                });
                return;
              }

              scrollAndWait((foundNewContent) => {
                if (foundNewContent) {
                  const newVideos = extractCurrentVideos();
                  newVideos.forEach(video => {
                    const existing = videos.find(v => v.url === video.url);
                    if (!existing) {
                      videos.push(video);
                    }
                  });
                } else {
                  hasMoreContent = false;
                }
                
                attempts++;
                
                // Continue processing
                setTimeout(processNext, 500); // Increased delay between scroll attempts
              });
            };

            // Start processing
            processNext();
          });
        },
      });

      const extractResult = extractResults[0].result;
      if (!extractResult || extractResult.videos.length === 0) {
        showToast('No liked videos found on this page', 'error');
        return;
      }

      const skipVideos = parseInt(skipCount) || 0;
      const stopAt = parseInt(stopIndex) || extractResult.videos.length;
      const endIndex = Math.min(stopAt, extractResult.videos.length);
      const videosToProcess = extractResult.videos.slice(skipVideos, endIndex);
      
      const rangeText = stopIndex 
        ? `Processing videos ${skipVideos + 1} to ${endIndex}...`
        : skipVideos > 0 
          ? `Skipping first ${skipVideos} videos...` 
          : 'Starting upload...';
      
      setLikedVideosProgress({ 
        current: 0, 
        total: videosToProcess.length, 
        currentTitle: rangeText
      });

      const baseUrl = await getBaseUrl();
      let successCount = 0;
      let duplicateCount = 0;

      // Upload videos one by one
      for (let i = 0; i < videosToProcess.length; i++) {
        // Check if user wants to stop
        if (shouldStopUploadRef.current) {
          showToast('Upload stopped by user', 'error');
          break;
        }

        const video = videosToProcess[i];
        const actualVideoNumber = skipVideos + i + 1;
        const videoData = `${video.title} - ${video.channelName}`;
        
        setLikedVideosProgress({ 
          current: i + 1, 
          total: videosToProcess.length, 
          currentTitle: `#${actualVideoNumber}: ${video.title}` 
        });

        try {
          const response = await fetch(`${baseUrl}/backend/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${result.apiKey}`,
            },
            body: JSON.stringify({
              data: videoData,
              metadata: {
                title: videoData,
                author: video.url,
              },
              "duplicate_check": {
                  "fields": {
                      "metadata": {
                          "author": video.url
                      }
                  }
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.isDuplicate) {
              console.log('Duplicate video skipped:', videoData, video.url);
              duplicateCount++;
            } else {
              console.log('Video uploaded successfully:', videoData, video.url);
              successCount++;
            }
          } else {
            console.error(`Failed to upload video "${videoData}":`, response.statusText);
            if (response.status === 429) {
              showToast('Rate limited. Waiting longer between requests...', 'error');
            }
          }
        } catch (error) {
          console.error(`Error uploading video "${videoData}":`, error);
        }

        // Longer delay between requests to avoid rate limiting (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!shouldStopUploadRef.current) {
        showToast(
          `Upload complete! ${successCount} new videos added, ${duplicateCount} duplicates skipped`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error uploading liked videos:', error);
      showToast('Failed to upload liked videos. Please try again.', 'error');
    } finally {
      setIsUploadingLikedVideos(false);
      shouldStopUploadRef.current = false;
      setLikedVideosProgress({ current: 0, total: 0, currentTitle: '' });
    }
  };

  const handleStopUpload = () => {
    shouldStopUploadRef.current = true;
  };

  const handleUploadIgSaved = async () => {
    if (!currentActiveTab?.url?.includes('instagram.com') || !currentActiveTab?.url?.includes('/saved/')) {
      showToast('Please navigate to Instagram Saved Posts page first', 'error');
      return;
    }

    setIsUploadingIgSaved(true);
    shouldStopIgUploadRef.current = false;
    setIgSavedProgress({ current: 0, total: 0, currentTitle: 'Collecting saved posts...' });

    try {
      const result = await new Promise<{ apiKey?: string }>((resolve) => {
        chrome.storage.local.get(['apiKey'], resolve);
      });

      if (!result.apiKey) {
        showToast('API key not found. Please check your settings.', 'error');
        return;
      }

      // Extract all saved post data from the current page and auto-paginate
      const extractResults = await chrome.scripting.executeScript({
        target: { tabId: currentActiveTab.id! },
        func: () => {
          return new Promise((resolve) => {
            const posts = [];
            let hasMoreContent = true;
            let attempts = 0;
            const maxAttempts = 50;

            // Function to extract post data from current viewport
            const extractCurrentPosts = () => {
              const postElements = document.querySelectorAll('article img[alt], a img[alt]');
              const currentPosts = [];
              
              postElements.forEach((element) => {
                const img = element;
                const postLink = img.closest('a');
                
                if (img && postLink) {
                  const alt = img.getAttribute('alt');
                  const href = postLink.href;
                  
                  if (alt && href && href.includes('/p/')) {
                    const existingPost = currentPosts.find(p => p.url === href);
                    if (!existingPost) {
                      currentPosts.push({ url: href, alt: alt.trim() });
                    }
                  }
                }
              });
              
              return currentPosts;
            };

            // Function to scroll and wait for new content
            const scrollAndWait = (callback) => {
              const beforeCount = extractCurrentPosts().length;
              
              // Scroll to bottom of the page
              window.scrollTo(0, document.body.scrollHeight);
              
              // Wait for new content to load
              setTimeout(() => {
                const afterCount = extractCurrentPosts().length;
                callback(afterCount > beforeCount);
              }, 3000);
            };

            // Initial extraction
            const initialPosts = extractCurrentPosts();
            posts.push(...initialPosts);

            // Auto-paginate by scrolling
            const processNext = () => {
              if (!hasMoreContent || attempts >= maxAttempts) {
                resolve({
                  posts: posts,
                  totalFound: posts.length,
                  pagesScrolled: attempts
                });
                return;
              }

              scrollAndWait((foundNewContent) => {
                if (foundNewContent) {
                  const newPosts = extractCurrentPosts();
                  newPosts.forEach(post => {
                    const existing = posts.find(p => p.url === post.url);
                    if (!existing) {
                      posts.push(post);
                    }
                  });
                } else {
                  hasMoreContent = false;
                }
                
                attempts++;
                
                // Continue processing
                setTimeout(processNext, 500);
              });
            };

            // Start processing
            processNext();
          });
        },
      });

      const extractResult = extractResults[0].result;
      if (!extractResult || extractResult.posts.length === 0) {
        showToast('No saved posts found on this page', 'error');
        return;
      }

      const skipPosts = parseInt(igSkipCount) || 0;
      const stopAt = parseInt(igStopIndex) || extractResult.posts.length;
      const endIndex = Math.min(stopAt, extractResult.posts.length);
      const postsToProcess = extractResult.posts.slice(skipPosts, endIndex);
      
      const rangeText = igStopIndex 
        ? `Processing posts ${skipPosts + 1} to ${endIndex}...`
        : skipPosts > 0 
          ? `Skipping first ${skipPosts} posts...` 
          : 'Starting upload...';
      
      setIgSavedProgress({ 
        current: 0, 
        total: postsToProcess.length, 
        currentTitle: rangeText
      });

      const baseUrl = await getBaseUrl();
      let successCount = 0;
      let duplicateCount = 0;

      // Upload posts one by one
      for (let i = 0; i < postsToProcess.length; i++) {
        // Check if user wants to stop
        if (shouldStopIgUploadRef.current) {
          showToast('Upload stopped by user', 'error');
          break;
        }

        const post = postsToProcess[i];
        const actualPostNumber = skipPosts + i + 1;
        
        setIgSavedProgress({ 
          current: i + 1, 
          total: postsToProcess.length, 
          currentTitle: `#${actualPostNumber}: ${post.alt}` 
        });

        // Add glow border to currently processing post
        chrome.scripting.executeScript({
          target: { tabId: currentActiveTab.id! },
          func: (postUrl) => {
            // Inject glow styles if not already present
            if (!document.getElementById('ig-glow-styles')) {
              const style = document.createElement('style');
              style.id = 'ig-glow-styles';
              style.textContent = `
                .ig-processing-glow {
                  position: relative;
                  border: 3px solid #e1306c !important;
                  border-radius: 12px !important;
                  box-shadow: 0 0 20px rgba(225, 48, 108, 0.6), 
                              0 0 40px rgba(225, 48, 108, 0.4),
                              inset 0 0 20px rgba(225, 48, 108, 0.1) !important;
                  animation: igGlowPulse 2s infinite !important;
                  z-index: 9999 !important;
                }
                
                @keyframes igGlowPulse {
                  0%, 100% { 
                    box-shadow: 0 0 20px rgba(225, 48, 108, 0.6), 
                                0 0 40px rgba(225, 48, 108, 0.4),
                                inset 0 0 20px rgba(225, 48, 108, 0.1);
                  }
                  50% { 
                    box-shadow: 0 0 30px rgba(225, 48, 108, 0.8), 
                                0 0 60px rgba(225, 48, 108, 0.6),
                                inset 0 0 30px rgba(225, 48, 108, 0.2);
                  }
                }
              `;
              document.head.appendChild(style);
            }

            // Remove previous glow
            const previousGlow = document.querySelector('.ig-processing-glow');
            if (previousGlow) {
              previousGlow.classList.remove('ig-processing-glow');
            }

            // Find the current post and add glow
            try {
              const links = document.querySelectorAll('a[href*="/p/"]');
              for (const link of links) {
                if (link.href === postUrl) {
                  // Find the closest article container or the link itself
                  const container = link.closest('article') || link;
                  container.classList.add('ig-processing-glow');
                  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  break;
                }
              }
            } catch (error) {
              console.log('Could not find Instagram post for glow effect:', error);
            }
          },
          args: [post.url],
        }).catch(err => console.log('Could not add glow effect:', err));

        try {
          const response = await fetch(`${baseUrl}/backend/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${result.apiKey}`,
            },
            body: JSON.stringify({
              data: post.alt,
              metadata: {
                title: 'Instagram Saved',
                author: post.url,
              },
              "duplicate_check": {
                  "fields": {
                      "metadata": {
                          "author": post.url
                      }
                  }
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.isDuplicate) {
              console.log('Duplicate Instagram post skipped:', post.alt, post.url);
              duplicateCount++;
            } else {
              console.log('Instagram post uploaded successfully:', post.alt, post.url);
              successCount++;
            }
          } else {
            console.error(`Failed to upload Instagram post "${post.alt}":`, response.statusText);
            if (response.status === 429) {
              showToast('Rate limited. Waiting longer between requests...', 'error');
            }
          }
        } catch (error) {
          console.error(`Error uploading Instagram post "${post.alt}":`, error);
        }

        // Remove glow effect from current post
        chrome.scripting.executeScript({
          target: { tabId: currentActiveTab.id! },
          func: () => {
            const currentGlow = document.querySelector('.ig-processing-glow');
            if (currentGlow) {
              currentGlow.classList.remove('ig-processing-glow');
            }
          },
        }).catch(err => console.log('Could not remove glow effect:', err));

        // Delay between requests to avoid rate limiting (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!shouldStopIgUploadRef.current) {
        showToast(
          `Upload complete! ${successCount} new posts added, ${duplicateCount} duplicates skipped`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error uploading Instagram saved posts:', error);
      showToast('Failed to upload Instagram saved posts. Please try again.', 'error');
    } finally {
      setIsUploadingIgSaved(false);
      shouldStopIgUploadRef.current = false;
      setIgSavedProgress({ current: 0, total: 0, currentTitle: '' });
    }
  };

  const handleStopIgUpload = () => {
    shouldStopIgUploadRef.current = true;
  };

  // Check if current tab is YouTube liked videos page
  const isYouTubeLikedVideosPage = currentActiveTab?.url?.includes('youtube.com/playlist?list=LL');
  // Check if current tab is Instagram saved posts page
  const isInstagramSavedPage = currentActiveTab?.url?.includes('instagram.com') && currentActiveTab?.url?.includes('/saved/');

  return (
    <div className="container">
      <div className="panel-header">
        <h1 className="panel-title">Your Commonbase</h1>
        <p className="panel-subtitle">
          Search from anywhere on your browser! Or, you can open your{' '}
          <a
            href={`${theBaseUrl}/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'white' }}
          >
            Companion from here!
          </a>
        </p>

        {/* YouTube Liked Videos Upload Section */}
        {isYouTubeLikedVideosPage && (
          <div className="youtube-upload-section">
            {/* Skip Videos Input */}
            {!isUploadingLikedVideos && (
              <div className="skip-videos-container">
                <div className="range-inputs-row">
                  <div className="range-input-group">
                    <label className="skip-videos-label">
                      Start at position:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999999"
                      value={skipCount}
                      onChange={(e) => setSkipCount(e.target.value)}
                      className="skip-videos-input"
                      placeholder="0"
                    />
                  </div>
                  <div className="range-input-group">
                    <label className="skip-videos-label">
                      Stop at position (optional):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      value={stopIndex}
                      onChange={(e) => setStopIndex(e.target.value)}
                      className="skip-videos-input"
                      placeholder="All videos"
                    />
                  </div>
                </div>
                <span className="skip-videos-help">
                  Start: 200, Stop: 250 = Process videos #201 to #250
                </span>
              </div>
            )}
            
            <div className="youtube-buttons-container">
              <button
                className="youtube-upload-btn"
                onClick={handleUploadLikedVideos}
                disabled={isUploadingLikedVideos}
              >
                {isUploadingLikedVideos ? (
                  <>
                    <div className="loading-spinner"></div>
                    Uploading {likedVideosProgress.current}/{likedVideosProgress.total} videos...
                  </>
                ) : (
                  'Upload All Liked Videos to YCB'
                )}
              </button>
              {isUploadingLikedVideos && (
                <button
                  className="youtube-stop-btn"
                  onClick={handleStopUpload}
                >
                  Stop
                </button>
              )}
            </div>
            {isUploadingLikedVideos && (
              <div className="upload-progress">
                {likedVideosProgress.currentTitle && (
                  <div className="current-video-title">
                    <span className="current-video-label">Processing:</span>
                    <span className="current-video-text">{likedVideosProgress.currentTitle}</span>
                  </div>
                )}
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: likedVideosProgress.total > 0 
                        ? `${(likedVideosProgress.current / likedVideosProgress.total) * 100}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  {likedVideosProgress.current} / {likedVideosProgress.total} videos processed
                </span>
              </div>
            )}
          </div>
        )}

        {/* Instagram Saved Posts Upload Section */}
        {isInstagramSavedPage && (
          <div className="instagram-upload-section">
            {/* Skip Posts Input */}
            {!isUploadingIgSaved && (
              <div className="skip-videos-container">
                <div className="range-inputs-row">
                  <div className="range-input-group">
                    <label className="skip-videos-label">
                      Start at position:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999999"
                      value={igSkipCount}
                      onChange={(e) => setIgSkipCount(e.target.value)}
                      className="skip-videos-input"
                      placeholder="0"
                    />
                  </div>
                  <div className="range-input-group">
                    <label className="skip-videos-label">
                      Stop at position (optional):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      value={igStopIndex}
                      onChange={(e) => setIgStopIndex(e.target.value)}
                      className="skip-videos-input"
                      placeholder="All posts"
                    />
                  </div>
                </div>
                <span className="skip-videos-help">
                  Start: 50, Stop: 100 = Process posts #51 to #100 (count from 1)
                </span>
              </div>
            )}
            
            <div className="instagram-buttons-container">
              <button
                className="instagram-upload-btn"
                onClick={handleUploadIgSaved}
                disabled={isUploadingIgSaved}
              >
                {isUploadingIgSaved ? (
                  <>
                    <div className="loading-spinner"></div>
                    Uploading {igSavedProgress.current}/{igSavedProgress.total} posts...
                  </>
                ) : (
                  'Upload All Saved Posts to YCB'
                )}
              </button>
              {isUploadingIgSaved && (
                <button
                  className="instagram-stop-btn"
                  onClick={handleStopIgUpload}
                >
                  Stop
                </button>
              )}
            </div>
            {isUploadingIgSaved && (
              <div className="upload-progress">
                {igSavedProgress.currentTitle && (
                  <div className="current-video-title">
                    <span className="current-video-label">Processing:</span>
                    <span className="current-video-text">{igSavedProgress.currentTitle}</span>
                  </div>
                )}
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: igSavedProgress.total > 0 
                        ? `${(igSavedProgress.current / igSavedProgress.total) * 100}%` 
                        : '0%'
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  {igSavedProgress.current} / {igSavedProgress.total} posts processed
                </span>
              </div>
            )}
          </div>
        )}

        {/* Active Tabs Section */}
        <div className="tabs-section">
          <h3 className="section-title">Active Tabs</h3>
          <div className="tabs-list">
            {activeTabs.map((tab) => (
              <div
                key={tab.id}
                className="tab-item"
                onClick={() => handleSwitchToTab(tab)}
              >
                <div className="tab-favicon">
                  <img
                    src={
                      tab.favIconUrl ||
                      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMiIgZmlsbD0iIzMzMzMzMyIvPgo8L3N2Zz4K'
                    }
                    alt=""
                    className="tab-favicon-img"
                    onError={(e) => {
                      e.currentTarget.src =
                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMiIgZmlsbD0iIzMzMzMzMyIvPgo8L3N2Zz4K';
                    }}
                  />
                </div>
                <div className="tab-info">
                  <span className="tab-title">{tab.title || 'Untitled'}</span>
                  <span className="tab-url">
                    {tab.url
                      ? (() => {
                          try {
                            return new URL(tab.url).hostname;
                          } catch {
                            return tab.url.length > 30
                              ? tab.url.substring(0, 30) + '...'
                              : tab.url;
                          }
                        })()
                      : ''}
                  </span>
                </div>
                {!tab.url?.includes('yourcommonbase.com') && (
                  <button
                    className="add-tab-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTab(tab);
                    }}
                    disabled={isAddingTab[tab.id?.toString() || ''] || false}
                    title="Add tab to YCB"
                  >
                    {isAddingTab[tab.id?.toString() || ''] ? '...' : '+'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Random Record Story */}
        {!hideRandomEntry && randomRecord && (
          <div className="random-story-container" key={storyKey}>
            <div className="story-progress-bar">
              <div className="story-progress-fill"></div>
            </div>
            <div className="story-content" onClick={handleRandomRecordClick}>
              {isLoadingRandomRecord ? (
                <div className="story-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading random record...</span>
                </div>
              ) : (
                <>
                  {randomRecordImage && (
                    <div className="story-image">
                      <img src={randomRecordImage} alt="Random record" />
                    </div>
                  )}
                  <div className="story-text">
                    <h4 className="story-title">
                      {randomRecord.metadata?.title || 'Untitled'}
                    </h4>
                    <p className="story-data">
                      {randomRecord.data?.length > 150
                        ? randomRecord.data.substring(0, 150) + '...'
                        : randomRecord.data || 'No content available'}
                    </p>
                    {randomRecord.metadata?.author && (
                      <span className="story-source">
                        {(() => {
                          try {
                            const url = randomRecord.metadata.author;
                            if (url.includes('yourcommonbase.com')) {
                              return 'Your Commonbase';
                            }
                            const urlObj = new URL(url);
                            return urlObj.hostname.replace('www.', '');
                          } catch {
                            return randomRecord.metadata.author.length > 25
                              ? randomRecord.metadata.author.substring(0, 25) +
                                  '...'
                              : randomRecord.metadata.author;
                          }
                        })()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Quick Add Input */}
        <div className="quick-add-container">
          <div className="quick-add-input-group">
            <textarea
              className="quick-add-input"
              placeholder={
                currentActiveTab?.title
                  ? `What does ${currentActiveTab.title} make you think about?`
                  : 'What are you thinking about?'
              }
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleQuickAdd();
                }
              }}
            />
            <button
              className="quick-add-button"
              onClick={handleQuickAdd}
              disabled={isQuickAdding || !quickAddText.trim()}
            >
              {isQuickAdding ? (
                <>
                  <div className="loading-spinner"></div>
                  Adding...
                </>
              ) : (
                'Add to YCB'
              )}
            </button>
          </div>

          {/* Quick Add Image */}
          {/* <div className="quick-add-image-container">
            <input
              type="file"
              id="imageUpload"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <button
              className="quick-add-image-button"
              onClick={() => document.getElementById('imageUpload')?.click()}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <>
                  <div className="loading-spinner"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                  </svg>
                  Take a Picture, It'll Last Longer
                </>
              )}
            </button>
          </div> */}
        </div>
      </div>

      {loadingSearch && (
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <span>Initializing search...</span>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Show appropriate search interface based on token availability */}
      {!loadingSearch && (
        <>
          {tokenError ? (
            <>
              <AlternateSearchBox />
              {tokenError.includes(
                'Unauthorized - move to search or synthesis to use this'
              ) && (
                <div className="notice-message">
                  For real-time search-as-you-type functionality, upgrade to the
                  Search tier in your YCB dashboard.
                </div>
              )}
            </>
          ) : (
            <InstantSearch
              indexName="ycb_fts_staging"
              searchClient={searchClient}
            >
              <div className="search-container">
                <CustomSearchBox
                  handleSearchManual={handleSearchManual}
                  clearSemanticResults={clearSemanticResults}
                  initialQuery={query}
                />
              </div>

              <div className="results-section">
                {loading && (
                  <div className="loading-message">
                    <div className="loading-spinner"></div>
                    <span>Searching...</span>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="results-header">
                    <span className="results-count">
                      {results.length} semantic{' '}
                      {results.length === 1 ? 'result' : 'results'}
                    </span>
                  </div>
                )}

                {/* Semantic search results */}
                {results.map((item) => (
                  <div className="result-card" key={item.id}>
                    <div
                      className="result-clickable"
                      onClick={() => handleSemanticResultClick(item)}
                    >
                      <div className="result-similarity">
                        {Math.round(item.similarity * 100)}% match
                      </div>
                      <h3 className="result-title">
                        {item.metadata?.title || 'Untitled'}
                      </h3>
                      <div className="result-content">
                        {item.metadata?.ogDescription ||
                          item.data ||
                          'No description available'}
                      </div>

                      {item.metadata?.ogImages &&
                        item.metadata.ogImages.length > 0 && (
                          <div className="result-image">
                            <img
                              src={item.metadata.ogImages[0]}
                              alt="Preview"
                            />
                          </div>
                        )}

                      {item.image && (
                        <div className="result-image">
                          <img src={item.image} alt="Attachment" />
                        </div>
                      )}

                      <div className="result-metadata">
                        {item.metadata?.author && (
                          <div className="result-meta-item">
                            <span className="result-meta-label">Source:</span>
                            <span
                              className="result-meta-value"
                              title={item.metadata.author}
                            >
                              {(() => {
                                try {
                                  // Check if URL contains yourcommonbase.com
                                  if (
                                    item.metadata.author.includes(
                                      'yourcommonbase.com'
                                    )
                                  ) {
                                    return 'Your Commonbase';
                                  }

                                  const url = new URL(item.metadata.author);
                                  return url.hostname.replace('www.', '');
                                } catch {
                                  // Check if URL contains yourcommonbase.com (for relative URLs)
                                  if (
                                    item.metadata.author.includes(
                                      'yourcommonbase.com'
                                    )
                                  ) {
                                    return 'Your Commonbase';
                                  }

                                  return item.metadata.author.length > 30
                                    ? item.metadata.author.substring(0, 30) +
                                        '...'
                                    : item.metadata.author;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="add-comment-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddComment(
                          item.id,
                          item.metadata?.title || 'Untitled',
                          item.metadata?.author || ''
                        );
                      }}
                      title="Add comment"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>

              <InfiniteHits
                hitComponent={(props: any) => (
                  <Hit {...props} onAddComment={handleAddComment} />
                )}
              />
            </InstantSearch>
          )}
        </>
      )}

      {/* Semantic results for non-InstantSearch mode */}
      {tokenError && (
        <div className="results-section">
          {loading && (
            <div className="loading-message">
              <div className="loading-spinner"></div>
              <span>Searching...</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="results-header">
              <span className="results-count">
                {results.length} semantic{' '}
                {results.length === 1 ? 'result' : 'results'}
              </span>
            </div>
          )}

          {results.map((item) => (
            <div className="result-card" key={item.id}>
              <div
                className="result-clickable"
                onClick={() => handleSemanticResultClick(item)}
              >
                <div className="result-similarity">
                  {Math.round(item.similarity * 100)}% match
                </div>
                <h3 className="result-title">
                  {item.metadata?.title || 'Untitled'}
                </h3>
                <div className="result-content">
                  {item.metadata?.ogDescription ||
                    item.data ||
                    'No description available'}
                </div>

                {item.metadata?.ogImages &&
                  item.metadata.ogImages.length > 0 && (
                    <div className="result-image">
                      <img src={item.metadata.ogImages[0]} alt="Preview" />
                    </div>
                  )}

                {item.image && (
                  <div className="result-image">
                    <img src={item.image} alt="Attachment" />
                  </div>
                )}

                <div className="result-metadata">
                  {item.metadata?.author && (
                    <div className="result-meta-item">
                      <span className="result-meta-label">Source:</span>
                      <span
                        className="result-meta-value"
                        title={item.metadata.author}
                      >
                        {(() => {
                          try {
                            // Check if URL contains yourcommonbase.com
                            if (
                              item.metadata.author.includes(
                                'yourcommonbase.com'
                              )
                            ) {
                              return 'Your Commonbase';
                            }

                            const url = new URL(item.metadata.author);
                            return url.hostname.replace('www.', '');
                          } catch {
                            // Check if URL contains yourcommonbase.com (for relative URLs)
                            if (
                              item.metadata.author.includes(
                                'yourcommonbase.com'
                              )
                            ) {
                              return 'Your Commonbase';
                            }

                            return item.metadata.author.length > 30
                              ? item.metadata.author.substring(0, 30) + '...'
                              : item.metadata.author;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="add-comment-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddComment(
                    item.id,
                    item.metadata?.title || 'Untitled',
                    item.metadata?.author || ''
                  );
                }}
                title="Add comment"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCommentModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Comment</h3>
            <p className="modal-subtitle">
              Commenting on: {selectedEntryTitle}
            </p>
            <textarea
              className="modal-textarea"
              placeholder="Add your comment..."
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  submitComment((e.target as HTMLTextAreaElement).value);
                }
              }}
            />
            <div className="modal-buttons">
              <button
                className="modal-btn modal-btn-secondary"
                onClick={() => setShowCommentModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-primary"
                onClick={(e) => {
                  const textarea = e.currentTarget.parentElement
                    ?.previousElementSibling as HTMLTextAreaElement;
                  submitComment(textarea?.value || '');
                }}
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
};

export default Panel;
