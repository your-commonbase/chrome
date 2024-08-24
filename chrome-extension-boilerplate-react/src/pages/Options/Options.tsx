import React, { useState, useEffect } from 'react';
import './Options.css';

interface Props {
  title: string;
}

const Options: React.FC<Props> = ({ title }: Props) => {
  const [apiKey, setApiKey] = useState('');
  const [cbUrl, setCbUrl] = useState('');

  const handleSubmit = () => {
    chrome.storage.sync.set({ apiKey }, () => {
      console.log('API Key is set to ' + apiKey);
    });
    chrome.storage.sync.set({ cbUrl }, () => {
      console.log('Callback URL is set to ' + cbUrl);
    });
  };

  const fetchApiKeyAndCBURL = () => {
    chrome.storage.sync.get(['apiKey'], (result) => {
      setApiKey(result.apiKey || '');
    });
    chrome.storage.sync.get(['cbUrl'], (result) => {
      setCbUrl(result.cbUrl || '');
    });
  }

  useEffect(() => {
    fetchApiKeyAndCBURL();
  }, []);

  return (
    <div className="OptionsContainer">
      <form onSubmit={handleSubmit}>
        <label>API Key </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={apiKey}
        />
        <br />
        <br />
        <label>Commonbase URL </label>
        <input
          type="text"
          value={cbUrl}
          onChange={(e) => setCbUrl(e.target.value)}
          placeholder={cbUrl}/>
        <br />
        <br />
        <button type="submit">Save</button>
      </form>
    </div>
  );
};

export default Options;
