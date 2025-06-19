# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` - Build production extension (outputs to `build/` folder)
- `npm run start` - Start development server with hot reload
- `npm run prettier` - Format code using Prettier
- `NODE_ENV=production npm run build` - Build for Chrome Web Store submission

## Development Setup

1. Run `npm install` to install dependencies
2. Run `npm start` to start development server
3. Load extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked extension"
   - Select the `build` folder

## Chrome Extension Architecture

This is a Manifest V3 Chrome extension built with React 18 and Webpack 5. The extension provides YCB (Your Common Base) integration for saving and searching web content.

### Key Components

- **Background Script** (`src/pages/Background/index.js`) - Service worker handling context menus, API calls, and extension actions
- **Side Panel** (`src/pages/Panel/Panel.tsx`) - Search interface using MeiliSearch with InstantSearch
- **Options Page** (`src/pages/Options/Options.tsx`) - Configuration for API keys and settings
- **Content Script** (`src/pages/Content/index.js`) - Injected into web pages
- **Popup** (`src/pages/Popup/`) - Extension popup interface

### Extension Features

- **Context Menu Actions**: Save selected text, URLs, and images to YCB
- **Side Panel Search**: Search YCB content with highlighted results
- **Arc Browser Support**: Option to use popup windows instead of side panel
- **URL Caching**: Prevents duplicate uploads by caching uploaded URLs
- **Image Processing**: Handles image uploads and displays in search results

### API Integration

The extension integrates with multiple YCB backend endpoints:
- `https://yourcommonbase.com/backend/add` - Add content
- `https://yourcommonbase.com/backend/addURL` - Add URLs
- `https://yourcommonbase.com/backend/v2/addImage` - Add images
- `https://yourcommonbase.com/backend/search` - Search content
- MeiliSearch instance

### Webpack Configuration

Entry points are configured in `webpack.config.js`:
- `background`, `contentScript`, `devtools` - excluded from hot reload
- React components support TypeScript and hot reloading
- Assets are copied from `src/assets/` to build folder

### Storage

Uses Chrome Storage API:
- `chrome.storage.local` - API keys, URLs, cache data
- `chrome.storage.sync` - User preferences (Arc mode)

### Development Notes

- TypeScript support for `.ts` and `.tsx` files
- React Refresh enabled for development
- Content scripts require special handling (no hot reload)
- Secrets can be stored in `secrets.development.js` (gitignored)