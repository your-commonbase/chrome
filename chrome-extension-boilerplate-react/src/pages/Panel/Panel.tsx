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

  return (
    <div key={hit.id}>
      <div className="mx-2 mb-4 flex items-center justify-between">
        <div className="max-w-full overflow-visible whitespace-normal break-words">
          <span
            onClick={async (e) => {
              e.preventDefault();
              // open in a new tab (or use chrome.tabs.update to reuse the current one)
              const baseUrl = await getBaseUrl();
              chrome.tabs.create({
                url: `${baseUrl}/dashboard/entry/${hit.id}`,
              });
            }}
            style={{ color: 'white' }}
          >
            <div
              className="w-full max-w-full overflow-visible whitespace-normal break-words"
              style={{ maxWidth: '100%' }}
            >
              <span
                className="font-normal"
                dangerouslySetInnerHTML={{
                  __html: hit._highlightResult.data.value,
                }}
              />
            </div>
          </span>
          {image && image.id === hit.id && (
            <img src={image.image} alt="image" style={{ maxWidth: '100%' }} />
          )}
          {hit._highlightResult.metadata.author && (
            <>
              <span>Author: </span>
              <span
                className="font-normal text-gray-500 underline hover:text-blue-600"
                dangerouslySetInnerHTML={{
                  __html: hit._highlightResult.metadata.author.value,
                }}
                onClick={() => {
                  window.open(hit.metadata.author, '_blank');
                }}
              />
              <br />
            </>
          )}
          {hit._highlightResult.metadata.title && (
            <>
              <span>Title: </span>
              <span
                className="font-normal text-gray-500"
                dangerouslySetInnerHTML={{
                  __html: hit._highlightResult.metadata.title.value,
                }}
              />
            </>
          )}

          {/* <div className="text-sm text-gray-500">
            Created: {new Date(hit.created_at).toLocaleString()}
            {hit.created_at !== hit.updated_at && (
              <> | Last Updated: {new Date(hit.updated_at).toLocaleString()} </>
            )}
          </div> */}
        </div>
      </div>
      <hr className="my-4" />
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
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}
      >
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search YCB..."
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
        <button
          type="submit"
          disabled={isSearching || !localQuery.trim()}
          style={{
            padding: '0 1rem',
            borderRadius: '4px',
            background: isSearching ? '#666' : '#444',
            color: 'white',
            border: 'none',
            cursor: isSearching ? 'not-allowed' : 'pointer',
          }}
        >
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
            style={{
              padding: '0 0.5rem',
              borderRadius: '4px',
              background: '#eee',
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </form>
    );
  };

  return (
    <div className="container">
      <h1>Search YCB</h1>
      {loadingSearch && <p>Loading...</p>}
      {error && <div className="error">{error}</div>}

      {/* Show appropriate search interface based on token availability */}
      {!loadingSearch && (
        <>
          {tokenError ? (
            <>
              <AlternateSearchBox />
              {tokenError.includes(
                'Unauthorized - move to search or synthesis to use this'
              ) && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.5rem',
                  }}
                >
                  <span>
                    For Search as You Type, go to the Companion and join the
                    Search tier
                  </span>
                </div>
              )}
            </>
          ) : (
            <InstantSearch
              indexName="ycb_fts_staging"
              searchClient={searchClient}
            >
              <CustomSearchBox
                handleSearchManual={handleSearchManual}
                clearSemanticResults={clearSemanticResults}
                initialQuery={query}
              />
              <div className="results">
                {loading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: '16px 0',
                      color: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #333',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    ></div>
                    <span>Searching...</span>
                  </div>
                )}
                {results.length > 0 && <p>Results: {results.length}</p>}

                {/* Semantic search results */}
                {results.map((item) => (
                  <div className="card" key={item.id}>
                    <h4>{item.metadata?.title || 'No Title'}</h4>
                    <p>Similarity: {item.similarity}</p>
                    <p
                      onClick={async (e) => {
                        e.preventDefault();
                        const baseUrl = await getBaseUrl();
                        chrome.tabs.create({
                          url: `${baseUrl}/dashboard/entry/${item.id}`,
                        });
                      }}
                      style={{ color: 'white', textDecoration: 'underline' }}
                    >
                      {item.metadata?.ogDescription ||
                        item.data ||
                        'No Description'}
                    </p>
                    {item.metadata?.ogImages &&
                      item.metadata.ogImages.length > 0 && (
                        <img
                          src={item.metadata.ogImages[0]}
                          alt="og"
                          style={{ maxWidth: '100%' }}
                        />
                      )}
                    {item.metadata?.author && (
                      <span
                        className="font-normal text-gray-500 underline hover:text-blue-600"
                        onClick={async (e) => {
                          e.preventDefault();
                          const baseUrl = await getBaseUrl();
                          chrome.tabs.create({
                            url: `${baseUrl}/dashboard/entry/${item.id}`,
                          });
                        }}
                      >
                        Author Link
                      </span>
                    )}
                    {item.image && (
                      <>
                        <p>Image:</p>
                        <img
                          src={item.image}
                          alt=""
                          style={{ maxWidth: '100%' }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <InfiniteHits hitComponent={Hit} />
            </InstantSearch>
          )}
        </>
      )}

      {tokenError && (<div className="results">
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '16px 0',
              color: '#ffffff',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid #333',
                borderTop: '2px solid #fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            ></div>
            <span>Searching...</span>
          </div>
        )}
        {results.length > 0 && <p>Results: {results.length}</p>}

        {/* Semantic search results */}
        {results.map((item) => (
          <div className="card" key={item.id}>
            <h4>{item.metadata?.title || 'No Title'}</h4>
            <p>Similarity: {item.similarity}</p>
            <p
              onClick={async (e) => {
                e.preventDefault();
                const baseUrl = await getBaseUrl();
                chrome.tabs.create({
                  url: `${baseUrl}/dashboard/entry/${item.id}`,
                });
              }}
              style={{ color: 'white', textDecoration: 'underline' }}
            >
              {item.metadata?.ogDescription || item.data || 'No Description'}
            </p>
            {item.metadata?.ogImages && item.metadata.ogImages.length > 0 && (
              <img
                src={item.metadata.ogImages[0]}
                alt="og"
                style={{ maxWidth: '100%' }}
              />
            )}
            {item.metadata?.author && (
              <span
                className="font-normal text-gray-500 underline hover:text-blue-600"
                onClick={async (e) => {
                  e.preventDefault();
                  const baseUrl = await getBaseUrl();
                  chrome.tabs.create({
                    url: `${baseUrl}/dashboard/entry/${item.id}`,
                  });
                }}
              >
                Author Link
              </span>
            )}
            {item.image && (
              <>
                <p>Image:</p>
                <img src={item.image} alt="" style={{ maxWidth: '100%' }} />
              </>
            )}
          </div>
        ))}
      </div>)}

      {tokenError && !loadingSearch && (
        <span>
          For Search as You Type, go to the Companion and join the Search tier
        </span>
      )}
    </div>
  );
};

export default Panel;
