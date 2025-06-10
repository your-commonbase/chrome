import React, { useState, useEffect, useRef } from 'react';
import { useSearchBox } from 'react-instantsearch';

function CustomSearchBox({ handleSearchManual, clearSemanticResults, initialQuery, ...props }: { handleSearchManual: any; clearSemanticResults: any; initialQuery?: string }) {
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
              console.log('Input is focused:', document.activeElement === inputRef.current);
            }
          }, 100);
        } else {
          console.log('Input ref not available for focus');
        }
      } else if (message.action === 'updateSearchBox' && typeof message.query === 'string') {
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
          console.log('Document active element after focus:', document.activeElement);
          console.log('Input is focused:', document.activeElement === inputRef.current);
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
        placeholder="Search your knowledge base..."
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
    </div>
  );
}

export default CustomSearchBox;
