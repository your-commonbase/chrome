// ... existing code ...
import React, { useState, useEffect } from 'react';
import './Panel.css';

const Panel: React.FC = () => {
  const [query, setQuery] = useState('');

  // On mount, get the initial query from chrome.storage
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (
        message.action === 'updatePanelQuery' &&
        typeof message.query === 'string'
      ) {
        setQuery(message.query);
        // search
        handleSearchManual(message.query);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImage = async (id: string): Promise<string | undefined> => {
    console.log('Fetching image:', id);
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['apiKey'], async (result) => {
        const apiKey = result.apiKey;
  
        if (!apiKey) {
          setError('API key or URL not found.');
          setLoading(false);
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
          console.log(data.body);
          resolve(data.body.urls[id]);
        } catch (err: any) {
          setError(err.message || 'An error occurred');
          resolve(undefined);
        } finally {
          setLoading(false);
        }
      });
    });
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
            const imageUrl = await fetchImage(item.id);
            console.log('imageUrl:', imageUrl);
            item.image = imageUrl;
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
            item.image = await fetchImage(item.id);
          }
        }
        console.log(data);
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
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="search-button" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      <div className="results">
        <p>Results: {results.length}</p>
        {results.map((item) => (
          <div className="card" key={item.id}>
            <h4>{item.metadata?.title || 'No Title'}</h4>
            <p>Similarity: {item.similarity}</p>
            <p>
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
              <a
                href={item.metadata.author}
                target="_blank"
                rel="noopener noreferrer"
              >
                Author Link
              </a>
            )}
            {item.image && (
              <>
                <p>Image:</p>
                <img
                  src={item.image}
                  alt="image"
                  style={{ maxWidth: '100%' }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Panel;
