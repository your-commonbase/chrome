import React, { useEffect, useState } from 'react';
import './Popup.css';

const Popup = () => {
  const [message, setMessage] = useState('');
  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  }

  // // if on a page get page title and url from the current tab
  // const getCurrentTab = () => {
  //   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //     console.log(tabs[0].title, tabs[0].url);
  //   });
  // }

  // Listen for messages from the background script
  useEffect(() => {
    const handleMessage = (request, sender, sendResponse) => {
      if (request.action === 'openPopup') {
        setMessage(`URL already visited: ${request.url}`);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup listener on component unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={openOptionsPage}>Open Options Page</button>
        {message && <p>{message}</p>}
      </header>
    </div>
  );
};

export default Popup;
