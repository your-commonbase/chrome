import React, { useState, useEffect } from 'react';
import './Panel.css';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import { InstantSearch, InfiniteHits } from 'react-instantsearch';
import CustomSearchBox from './CustomSearchBox';

const fetchImage = async (id: string): Promise<any | undefined> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiKey'], async (result) => {
      const apiKey = result.apiKey;

      if (!apiKey) {
        resolve(undefined);
        return;
      }

      try {
        const resp = await fetch(
          `https://development.yourcommonbase.com/backend/fetchImagesByIDs`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              ids: [id],
            }),
          }
        );
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
            onClick={(e) => {
              e.preventDefault();
              // open in a new tab (or use chrome.tabs.update to reuse the current one)
              chrome.tabs.create({
                url: `https://development.yourcommonbase.com/dashboard/entry/${hit.id}`,
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
            <img
              src={image.image}
              alt="image"
              style={{ maxWidth: '100%' }}
            />
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
  

  const getToken = async (token: string) => {
    const resp = await fetch(`https://development.yourcommonbase.com/backend/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await resp.json();
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
        } catch (err: any) {
          setError(err.message || 'failed to fetch token');
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
        setQuery(message.query);
        // search
        handleSearchManual(message.query);
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
        const response = await fetch(
          `https://development.yourcommonbase.com/backend/search`,
          {
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
          }
        );

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
        const response = await fetch(
          `https://development.yourcommonbase.com/backend/search`,
          {
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
          }
        );

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

  return (
    <div className="container">
      <h1>Search YCB</h1>
      { loadingSearch && <p>Loading...</p> }
      {error && <div className="error">{error}</div>}
      <div className="results">
        {loading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            margin: '16px 0',
            color: '#ffffff'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #333',
              borderTop: '2px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span>Searching...</span>
          </div>
        )}
        {results.length > 0 && <p>Results: {results.length}</p>}
        
      </div>
      { !loadingSearch && (
        <InstantSearch indexName="ycb_fts_staging" searchClient={searchClient}>
        {/* <SearchBox queryHook={queryHook} /> */}
        <CustomSearchBox handleSearchManual={handleSearchManual} clearSemanticResults={clearSemanticResults} initialQuery={query} />
        {results.map((item) => (
          <div className="card" key={item.id}>
            <h4>{item.metadata?.title || 'No Title'}</h4>
            <p>Similarity: {item.similarity}</p>
            <p
            onClick={(e) => {
              e.preventDefault();
              // open in a new tab (or use chrome.tabs.update to reuse the current one)
              chrome.tabs.create({
                url: `https://development.yourcommonbase.com/dashboard/entry/${item.id}`,
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
                onClick={(e) => {
                  e.preventDefault();
                  // open in a new tab (or use chrome.tabs.update to reuse the current one)
                  chrome.tabs.create({
                    url: `https://development.yourcommonbase.com/dashboard/entry/${item.id}`,
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
        <InfiniteHits hitComponent={Hit} />
      </InstantSearch>
      )}
      <span>For Search as You Type, go to the Companion and join the Search tier</span>
    </div>
  );
};

export default Panel;
