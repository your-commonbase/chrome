import React, { useState, useEffect, useRef } from 'react';
import { useSearchBox } from 'react-instantsearch';

function CustomSearchBox({
  handleSearchManual,
  clearSemanticResults,
  initialQuery,
  ...props
}: {
  handleSearchManual: any;
  clearSemanticResults: any;
  initialQuery?: string;
}) {
  const { query, refine, clear } = useSearchBox(props);
  const [localQuery, setLocalQuery] = useState(query);
  const [isSearching, setIsSearching] = useState(false);
  const initialQueryProcessed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // keep localQuery in sync if InstantSearch changes it
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Handle initial query from parent component
  useEffect(() => {
    if (initialQuery && initialQuery !== localQuery) {
      console.log('Setting initial query:', initialQuery);
      setLocalQuery(initialQuery);
      refine(initialQuery);
      initialQueryProcessed.current = true;
    }
  }, [initialQuery, refine]);

  // Check for focus flag on component mount and handle focus
  useEffect(() => {
    // Check if we should focus on mount
    chrome.storage.local.get(['shouldFocusSearchBox'], (result) => {
      if (result.shouldFocusSearchBox && inputRef.current) {
        console.log('Focusing search box from storage flag');
        // Small delay to ensure the input is properly rendered
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            console.log('Search box focused successfully');
          } else {
            console.log('Input ref not available for focus');
          }
        }, 200);
        // Clear the flag after using it
        chrome.storage.local.remove(['shouldFocusSearchBox']);
      }
    });

    // Also listen for runtime messages as backup
    const handleMessage = (message: any) => {
      console.log('Received message:', message);
      if (message.action === 'focusSearchBox') {
        console.log('Attempting to focus search box from message');
        console.log('Input ref current:', inputRef.current);
        if (inputRef.current) {
          // Try multiple methods to ensure focus works
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              inputRef.current.click(); // Also try click to ensure focus
              console.log('Focus and click attempted');
              console.log('Document active element:', document.activeElement);
              console.log(
                'Input is focused:',
                document.activeElement === inputRef.current
              );
            }
          }, 100);
        } else {
          console.log('Input ref not available for focus');
        }
      } else if (
        message.action === 'updateSearchBox' &&
        typeof message.query === 'string'
      ) {
        console.log('Updating search box with new query:', message.query);
        // Clear and replace the search box text
        setLocalQuery(message.query);
        refine(message.query); // Trigger InstantSearch

        // Also focus the input
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Additional polling mechanism to check for focus flag
  useEffect(() => {
    const pollForFocus = () => {
      chrome.storage.local.get(['shouldFocusSearchBox'], (result) => {
        if (result.shouldFocusSearchBox && inputRef.current) {
          console.log('Focusing search box from polling');
          console.log('Input ref available:', !!inputRef.current);
          inputRef.current.focus();
          inputRef.current.click(); // Also try click
          console.log('Focus and click attempted from polling');
          console.log(
            'Document active element after focus:',
            document.activeElement
          );
          console.log(
            'Input is focused:',
            document.activeElement === inputRef.current
          );
          chrome.storage.local.remove(['shouldFocusSearchBox']);
        }
      });
    };

    // Poll every 100ms for up to 2 seconds
    const pollInterval = setInterval(pollForFocus, 100);
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.currentTarget.value;
    setLocalQuery(newVal);
    refine(newVal); // update Meili results as you type
  };

  const onSearchClick = async () => {
    setIsSearching(true);
    try {
      // 1) trigger Meili search
      refine(localQuery);
      // 2) run semantic search and prepend those results
      await handleSearchManual(localQuery);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="search-box">
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={onInputChange}
        placeholder="Find anything you've ever saved..."
        tabIndex={1}
        autoFocus={false}
        className="search-input"
      />
      <button
        type="button"
        onClick={onSearchClick}
        disabled={isSearching}
        className="search-button"
      >
        {isSearching && <div className="loading-spinner"></div>}
        {isSearching ? 'Searching...' : 'Search'}
      </button>
      {localQuery && (
        <button
          type="button"
          onClick={() => {
            clear();
            setLocalQuery('');
            initialQueryProcessed.current = false; // Reset so initial query can work again
            if (clearSemanticResults) {
              clearSemanticResults();
            }
          }}
          className="clear-button"
        >
          Clear
        </button>
      )}
      {localQuery && (
        <button
          type="button"
          onClick={() => {
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
              localQuery
            )}`;
            chrome.tabs.create({ url: googleSearchUrl });
          }}
          className="google-search-button"
          title="Search Google"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px', // Optional: adds space between the icon and text
            width: '100%', // Ensures the button takes full width if needed
            padding: '10px', // Adjust padding as needed
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>
      )}
    </div>
  );
}

export default CustomSearchBox;
