import React, { useState, useEffect, useRef } from 'react';
import { useSearchBox } from 'react-instantsearch';

function CustomSearchBox({ handleSearchManual, clearSemanticResults, initialQuery, ...props }: { handleSearchManual: any; clearSemanticResults: any; initialQuery?: string }) {
  const { query, refine, clear } = useSearchBox(props);
  const [localQuery, setLocalQuery] = useState(query);
  const [isSearching, setIsSearching] = useState(false);
  const initialQueryProcessed = useRef(false);

  // keep localQuery in sync if InstantSearch changes it
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Handle initial query from parent component
  useEffect(() => {
    if (initialQuery && !initialQueryProcessed.current) {
      setLocalQuery(initialQuery);
      refine(initialQuery);
      initialQueryProcessed.current = true;
    }
  }, [initialQuery, refine]);

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
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        type="text"
        value={localQuery}
        onChange={onInputChange}
        placeholder="Search"
        style={{
          flex: 1,
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #ccc',
        }}
      />
      <button
        type="button"
        onClick={onSearchClick}
        disabled={isSearching}
        style={{
          padding: '0 1rem',
          borderRadius: '4px',
          background: isSearching ? '#666' : '#444',
          color: 'white',
          border: 'none',
          cursor: isSearching ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {isSearching && (
          <div style={{
            width: '12px',
            height: '12px',
            border: '1px solid #333',
            borderTop: '1px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        )}
        {isSearching ? 'searching...' : 'search'}
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
          style={{
            padding: '0 0.5rem',
            borderRadius: '4px',
            background: '#eee',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          clear
        </button>
      )}
    </div>
  );
}

export default CustomSearchBox;
