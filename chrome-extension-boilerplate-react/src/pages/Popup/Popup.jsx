import React from 'react';
import './Popup.css';

const Popup = () => {
  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  }

  // if on a page get page title and url from the current tab
  const getCurrentTab = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log(tabs[0].title, tabs[0].url);
    });
  }

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={openOptionsPage}>Open Options Page</button>
      </header>
    </div>
  );
};

export default Popup;
