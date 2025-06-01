import React, { useState, useEffect } from 'react';
import { useSearchBox } from 'react-instantsearch';

function CustomSearchBox({ handleSearchManual, ...props }: { handleSearchManual: any }) {
  const { query, refine, clear } = useSearchBox(props);
  const [localQuery, setLocalQuery] = useState(query);

  // keep localQuery in sync if InstantSearch changes it
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const onInputChange = (e) => {
    const newVal = e.currentTarget.value;
    setLocalQuery(newVal);
    refine(newVal); // update Meili results as you type
  };

  const onSearchClick = () => {
    // 1) trigger Meili search
    refine(localQuery);
    // 2) run semantic search and prepend those results
    handleSearchManual(localQuery);
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
        style={{
          padding: '0 1rem',
          borderRadius: '4px',
          background: '#444',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        search
      </button>
      {query && (
        <button
          type="button"
          onClick={() => {
            clear();
            setLocalQuery('');
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
