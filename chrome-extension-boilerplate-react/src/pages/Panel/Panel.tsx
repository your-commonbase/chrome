import React, { useState, useEffect } from 'react';
import './Panel.css';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import { InstantSearch, InfiniteHits } from 'react-instantsearch';
import CustomSearchBox from './CustomSearchBox';

// Helper function to get base URL from storage with fallback
const getBaseUrl = (): Promise<string> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['baseUrl'], (result) => {
      resolve(result.baseUrl || 'https://development.yourcommonbase.com');
    });
  });
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

const Hit = ({ hit, closeModalFn }: any) => {
  const [image, setImage] = useState<any | undefined>(undefined);

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

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const baseUrl = await getBaseUrl();
    chrome.tabs.create({
      url: `${baseUrl}/dashboard/entry/${hit.id}`,
    });
  };

  return (
    <div className="hit-container" onClick={handleClick}>
      <div className="hit-content">
        <div
          className="hit-text"
          dangerouslySetInnerHTML={{
            __html: hit._highlightResult.data.value.replace(
              /<em>/g, '<span class="hit-highlight">'
            ).replace(/<\/em>/g, '</span>'),
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
                href={hit.metadata.author}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={hit.metadata.author}
              >
                {(() => {
                  try {
                    const url = new URL(hit.metadata.author);
                    return url.hostname.replace('www.', '');
                  } catch {
                    return hit.metadata.author.length > 30 
                      ? hit.metadata.author.substring(0, 30) + '...' 
                      : hit.metadata.author;
                  }
                })()}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Panel: React.FC = () => {
  const [searchClient, setSearchClient] = useState<any | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const getToken = async (token: string) => {
    const baseUrl = await getBaseUrl();
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
            placeholder="Search your commonbase..."
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

  return (
    <div className="container">
      <div className="panel-header">
        <h1 className="panel-title">Your Commonbase</h1>
        <p className="panel-subtitle">Search from anywhere on your browser! Or, you can open your <a href="https://development.yourcommonbase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{color: 'white'}}>dashboard</a> and search from there.</p>
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
                  For real-time search-as-you-type functionality, upgrade to the Search tier in your YCB dashboard.
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
                      {results.length} semantic {results.length === 1 ? 'result' : 'results'}
                    </span>
                  </div>
                )}

                {/* Semantic search results */}
                {results.map((item) => (
                  <div
                    className="result-card"
                    key={item.id}
                    onClick={() => handleSemanticResultClick(item)}
                  >
                    <div className="result-similarity">
                      {Math.round(item.similarity * 100)}% match
                    </div>
                    <h3 className="result-title">
                      {item.metadata?.title || 'Untitled'}
                    </h3>
                    <div className="result-content">
                      {item.metadata?.ogDescription || item.data || 'No description available'}
                    </div>
                    
                    {item.metadata?.ogImages && item.metadata.ogImages.length > 0 && (
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
                                const url = new URL(item.metadata.author);
                                return url.hostname.replace('www.', '');
                              } catch {
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
                ))}
              </div>

              <InfiniteHits hitComponent={Hit} />
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
                {results.length} semantic {results.length === 1 ? 'result' : 'results'}
              </span>
            </div>
          )}

          {results.map((item) => (
            <div
              className="result-card"
              key={item.id}
              onClick={() => handleSemanticResultClick(item)}
            >
              <div className="result-similarity">
                {Math.round(item.similarity * 100)}% match
              </div>
              <h3 className="result-title">
                {item.metadata?.title || 'Untitled'}
              </h3>
              <div className="result-content">
                {item.metadata?.ogDescription || item.data || 'No description available'}
              </div>
              
              {item.metadata?.ogImages && item.metadata.ogImages.length > 0 && (
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
                          const url = new URL(item.metadata.author);
                          return url.hostname.replace('www.', '');
                        } catch {
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Panel;
