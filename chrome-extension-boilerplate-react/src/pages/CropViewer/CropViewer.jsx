// Crop viewer functionality
let originalImageData = null;
let originalTabInfo = null;
let currentSelection = null;
let isDragging = false;
let isResizing = false;
let dragStart = { x: 0, y: 0 };
let resizeHandle = null;

// Initialize the crop viewer
document.addEventListener('DOMContentLoaded', () => {
  console.log('Crop viewer DOM loaded');
  console.log('Chrome APIs available:', !!window.chrome);
  console.log('Chrome storage available:', !!window.chrome?.storage);
  
  loadScreenshotData();
  setupEventListeners();
});

// Load screenshot data from storage
function loadScreenshotData() {
  console.log('Loading screenshot data...');
  
  // Get screenshot ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const screenshotId = urlParams.get('id');
  console.log('Screenshot ID from URL:', screenshotId);
  
  if (!screenshotId) {
    showError('No screenshot ID provided');
    return;
  }
  
  if (!window.chrome || !window.chrome.storage) {
    showError('Chrome APIs not available');
    return;
  }
  
  try {
    const storageKey = `screenshot_${screenshotId}`;
    chrome.storage.local.get([storageKey], (result) => {
      console.log('Storage result:', result);
      
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        showError('Failed to load screenshot: ' + chrome.runtime.lastError.message);
        return;
      }
      
      const screenshotData = result[storageKey];
      if (screenshotData) {
        const { imageData, tabInfo } = screenshotData;
        console.log('Found screenshot data, tabInfo:', tabInfo);
        console.log('Image data length:', imageData?.length);
        
        originalImageData = imageData;
        originalTabInfo = tabInfo;
        displayImage(imageData);
        // Clear the screenshot data after loading
        chrome.storage.local.remove([storageKey]);
      } else {
        console.log('No screenshot data found for ID:', screenshotId);
        showError('Screenshot data not found');
      }
    });
  } catch (error) {
    console.error('Error accessing storage:', error);
    showError('Error accessing storage: ' + error.message);
  }
}

// Display the image in the crop container
function displayImage(imageData) {
  const container = document.getElementById('cropContainer');
  const loading = document.getElementById('loading');
  
  try {
    const img = document.createElement('img');
    img.className = 'crop-image';
    img.style.userSelect = 'none';
    img.style.webkitUserSelect = 'none';
    img.style.mozUserSelect = 'none';
    img.style.msUserSelect = 'none';
    img.draggable = false;
    img.onload = () => {
      loading.style.display = 'none';
      
      // Create overlay for crop selection
      const overlay = document.createElement('div');
      overlay.className = 'crop-overlay';
      
      // Initialize default selection (centered square, 40% of smaller dimension)
      // Use natural dimensions for better accuracy across browsers
      const displayWidth = img.offsetWidth;
      const displayHeight = img.offsetHeight;
      console.log('Image display dimensions:', displayWidth, 'x', displayHeight);
      console.log('Image natural dimensions:', img.naturalWidth, 'x', img.naturalHeight);
      
      const minDimension = Math.min(displayWidth, displayHeight);
      const selectionSize = minDimension * 0.4; // Square selection
      const selectionX = (displayWidth - selectionSize) / 2;
      const selectionY = (displayHeight - selectionSize) / 2;
      
      currentSelection = {
        x: selectionX,
        y: selectionY,
        width: selectionSize,
        height: selectionSize
      };
      
      createSelectionUI(overlay);
      
      container.appendChild(img);
      container.appendChild(overlay);
      
      // Setup interaction after elements are in DOM
      setupImageInteraction(img, overlay);
      
      // Enable save button
      document.getElementById('saveBtn').disabled = false;
      
      updateSelection();
    };
    
    img.onerror = () => {
      showError('Failed to load screenshot');
    };
    
    img.src = imageData;
  } catch (error) {
    showError('Error displaying image: ' + error.message);
  }
}

// Create selection UI elements
function createSelectionUI(overlay) {
  // Selection box
  const selection = document.createElement('div');
  selection.className = 'crop-selection';
  selection.id = 'cropSelection';
  
  // Resize handles
  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
  handles.forEach(position => {
    const handle = document.createElement('div');
    handle.className = `crop-handle ${position}`;
    handle.dataset.position = position;
    selection.appendChild(handle);
  });
  
  overlay.appendChild(selection);
}

// Setup image interaction
function setupImageInteraction(img, overlay) {
  console.log('Setting up image interaction...');
  const selection = document.getElementById('cropSelection');
  console.log('Selection element:', selection);
  
  if (!selection) {
    console.error('Selection element not found!');
    return;
  }
  
  // Mouse down on overlay (start new selection)
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) {
      startNewSelection(e, img);
    }
  });
  
  // Mouse down on selection (start dragging)
  selection.addEventListener('mousedown', (e) => {
    if (e.target === selection) {
      startDragging(e);
    } else if (e.target.classList.contains('crop-handle')) {
      startResizing(e, e.target.dataset.position);
    }
  });
  
  // Mouse move
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleDragging(e, img);
    } else if (isResizing) {
      handleResizing(e, img);
    }
  });
  
  // Mouse up
  document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
  });
}

// Start new selection
function startNewSelection(e, img) {
  const rect = img.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  currentSelection = {
    x: x,
    y: y,
    width: 0,
    height: 0
  };
  
  isDragging = true;
  dragStart = { x: x, y: y };
  updateSelection();
}

// Start dragging selection
function startDragging(e) {
  isDragging = true;
  dragStart = {
    x: e.clientX - currentSelection.x,
    y: e.clientY - currentSelection.y
  };
}

// Start resizing selection
function startResizing(e, handle) {
  isResizing = true;
  resizeHandle = handle;
  dragStart = { x: e.clientX, y: e.clientY };
}

// Handle dragging
function handleDragging(e, img) {
  const rect = img.getBoundingClientRect();
  
  if (isDragging && currentSelection.width === 0) {
    // Creating new selection
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    currentSelection.width = Math.abs(x - dragStart.x);
    currentSelection.height = Math.abs(y - dragStart.y);
    currentSelection.x = Math.min(x, dragStart.x);
    currentSelection.y = Math.min(y, dragStart.y);
  } else if (isDragging) {
    // Moving existing selection
    currentSelection.x = e.clientX - dragStart.x;
    currentSelection.y = e.clientY - dragStart.y;
    
    // Constrain to image bounds
    currentSelection.x = Math.max(0, Math.min(currentSelection.x, rect.width - currentSelection.width));
    currentSelection.y = Math.max(0, Math.min(currentSelection.y, rect.height - currentSelection.height));
  }
  
  updateSelection();
}

// Handle resizing
function handleResizing(e, img) {
  if (!isResizing) return;
  
  const rect = img.getBoundingClientRect();
  const deltaX = e.clientX - dragStart.x;
  const deltaY = e.clientY - dragStart.y;
  
  let newSelection = { ...currentSelection };
  
  switch (resizeHandle) {
    case 'nw':
      newSelection.x += deltaX;
      newSelection.y += deltaY;
      newSelection.width -= deltaX;
      newSelection.height -= deltaY;
      break;
    case 'ne':
      newSelection.y += deltaY;
      newSelection.width += deltaX;
      newSelection.height -= deltaY;
      break;
    case 'sw':
      newSelection.x += deltaX;
      newSelection.width -= deltaX;
      newSelection.height += deltaY;
      break;
    case 'se':
      newSelection.width += deltaX;
      newSelection.height += deltaY;
      break;
    case 'n':
      newSelection.y += deltaY;
      newSelection.height -= deltaY;
      break;
    case 's':
      newSelection.height += deltaY;
      break;
    case 'w':
      newSelection.x += deltaX;
      newSelection.width -= deltaX;
      break;
    case 'e':
      newSelection.width += deltaX;
      break;
  }
  
  // Ensure minimum size and bounds
  newSelection.width = Math.max(20, newSelection.width);
  newSelection.height = Math.max(20, newSelection.height);
  newSelection.x = Math.max(0, Math.min(newSelection.x, rect.width - newSelection.width));
  newSelection.y = Math.max(0, Math.min(newSelection.y, rect.height - newSelection.height));
  
  currentSelection = newSelection;
  dragStart = { x: e.clientX, y: e.clientY };
  updateSelection();
}

// Update selection display
function updateSelection() {
  const selection = document.getElementById('cropSelection');
  if (selection && currentSelection) {
    selection.style.left = currentSelection.x + 'px';
    selection.style.top = currentSelection.y + 'px';
    selection.style.width = currentSelection.width + 'px';
    selection.style.height = currentSelection.height + 'px';
  }
}

// Setup event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  const cancelBtn = document.getElementById('cancelBtn');
  const saveBtn = document.getElementById('saveBtn');
  
  console.log('Cancel button:', cancelBtn);
  console.log('Save button:', saveBtn);
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      console.log('Cancel clicked');
      window.close();
    });
  } else {
    console.error('Cancel button not found');
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      console.log('Save clicked');
      saveCroppedImage();
    });
  } else {
    console.error('Save button not found');
  }
}

// Save cropped image
function saveCroppedImage() {
  if (!currentSelection || !originalImageData || !originalTabInfo) {
    showError('Missing data for saving');
    return;
  }
  
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    // Create canvas for cropping
    const img = document.querySelector('.crop-image');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Calculate scale factor between displayed image and original
    // Use offsetWidth/Height instead of getBoundingClientRect for better accuracy
    const displayWidth = img.offsetWidth;
    const displayHeight = img.offsetHeight;
    const scaleX = img.naturalWidth / displayWidth;
    const scaleY = img.naturalHeight / displayHeight;
    
    console.log('Cropping calculation:');
    console.log('Display size:', displayWidth, 'x', displayHeight);
    console.log('Natural size:', img.naturalWidth, 'x', img.naturalHeight);
    console.log('Scale factors:', scaleX, scaleY);
    console.log('Selection:', currentSelection);
    
    // Set canvas size to cropped area
    canvas.width = currentSelection.width * scaleX;
    canvas.height = currentSelection.height * scaleY;
    
    // Create image from original data
    const originalImg = new Image();
    originalImg.onload = () => {
      // Draw cropped portion
      ctx.drawImage(
        originalImg,
        currentSelection.x * scaleX, // source x
        currentSelection.y * scaleY, // source y
        currentSelection.width * scaleX, // source width
        currentSelection.height * scaleY, // source height
        0, // dest x
        0, // dest y
        canvas.width, // dest width
        canvas.height // dest height
      );
      
      // Convert to data URL and send to background
      const croppedDataUrl = canvas.toDataURL('image/png');
      
      // Get the comment from the textarea
      const commentBox = document.getElementById('commentBox');
      const comment = commentBox ? commentBox.value.trim() : '';
      
      console.log('Sending cropped screenshot with comment:', comment);
      console.log('Tab info:', originalTabInfo);
      
      chrome.runtime.sendMessage({
        action: 'uploadCroppedScreenshot',
        imageData: croppedDataUrl,
        tabInfo: originalTabInfo,
        comment: comment // Include the optional comment
      });
      
      // Close window immediately - background processing will continue
      window.close();
    };
    
    originalImg.onerror = () => {
      showError('Failed to process original image');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to YCB';
    };
    
    originalImg.src = originalImageData;
    
  } catch (error) {
    showError('Error processing image: ' + error.message);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to YCB';
  }
}

// Show error message
function showError(message) {
  const container = document.getElementById('cropContainer');
  container.innerHTML = `<div class="error">${message}</div>`;
}