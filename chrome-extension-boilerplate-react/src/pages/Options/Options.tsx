import React, { useState, useEffect } from 'react';
import './Options.css';

interface Props {
  title: string;
}

const Options: React.FC<Props> = ({ title }: Props) => {
  const [apiKey, setApiKey] = useState('');
  const [cbUrl, setCbUrl] = useState('');
  const [openAIAPIKey, setOpenAIAPIKey] = useState('');

  const handleSubmit = () => {
    chrome.storage.local.set({ apiKey }, () => {
      console.log('API Key is set to ' + apiKey);
    });
    chrome.storage.local.set({ cbUrl }, () => {
      console.log('Callback URL is set to ' + cbUrl);
    });
  };

  const fetchApiKeyAndCBURL = () => {
    chrome.storage.local.get(['apiKey'], (result) => {
      setApiKey(result.apiKey || '');
    });
    chrome.storage.local.get(['cbUrl'], (result) => {
      setCbUrl(result.cbUrl || '');
    });
  };

  const handleOpenAISubmit = () => {
    chrome.storage.local.set({ openAIAPIKey }, () => {
      console.log('API Key is set to ' + openAIAPIKey);
    });
  };

  const fetchOpenAIAPIKey = () => {
    chrome.storage.local.get(['openAIAPIKey'], (result) => {
      setOpenAIAPIKey(result.openAIAPIKey || '');
    });
  };

  useEffect(() => {
    fetchApiKeyAndCBURL();
    fetchOpenAIAPIKey();
  }, []);

  useEffect(() => {
    const arcCheckbox = document.getElementById('arcMode') as HTMLInputElement;

    const updateArcMode = (result: any) => {
      if (arcCheckbox) {
        arcCheckbox.checked = result.arcMode || false;
      }
    };

    const handleCheckboxChange = () => {
      if (arcCheckbox) {
        chrome.storage.sync.set({ arcMode: arcCheckbox.checked });
      }
    };

    chrome.storage.sync.get(['arcMode'], updateArcMode);

    if (arcCheckbox) {
      arcCheckbox.addEventListener('change', handleCheckboxChange);
    }

    return () => {
      if (arcCheckbox) {
        arcCheckbox.removeEventListener('change', handleCheckboxChange);
      }
    };
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
          placeholder={cbUrl}
        />
        <br />
        <br />
        <button type="submit">Save</button>
      </form>
      <form onSubmit={handleOpenAISubmit}>
        <label>OpenAI API Key (Optional)</label>
        <input
          type="text"
          value={openAIAPIKey}
          onChange={(e) => setOpenAIAPIKey(e.target.value)}
          placeholder={openAIAPIKey}
        />
        <br />
        <br />
        <button type="submit">Save OpenAI Key</button>
      </form>
      <label>
        <input type="checkbox" id="arcMode" />
        I’m using Arc Browser (use tab instead of side panel)
      </label>
    </div>
  );
};

export default Options;
