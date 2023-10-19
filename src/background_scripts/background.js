console.log('background started')

// Open or create an IndexedDB database
const dbPromise = indexedDB.open('twitterLoggerDatabase', 2);

// Define the structure of your database (create object stores, etc.)
dbPromise.onupgradeneeded = event => {
  const db = event.target.result;
  // db.createObjectStore('rawPacketsStore', { keyPath: 'id' });
  db.createObjectStore('rawPacketsStore', {autoIncrement: true})
};


/**
When we receive the message, execute the given script in the given
tab.
*/
function handleMessage(request, sender, sendResponse) {
  if (request.action === 'storeData') {
    const data = request.data;

    // Generate a hash for the data
    generateHash(data).then(hash => {
      // Open the IndexedDB database
      const dbPromise = indexedDB.open('twitterLoggerDatabase');

      dbPromise.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction('rawPacketsStore', 'readwrite');
        const objectStore = transaction.objectStore('rawPacketsStore');

        // Check if data with the same hash already exists
        const request = objectStore.getKey(hash);

        request.onsuccess = event => {
          if (event.target.result === hash) {
            console.log('Duplicate data with the same hash. Not added to the database.');
          } else {
            // Add the data to the object store with the hash as the key
            console.log('Module stored in DB')
            objectStore.add(data, hash);
          }
        };

        transaction.oncomplete = () => {
          console.log('oncomplete');
        };
      };
    });
  }else if(request.action == 'download'){
    getAllData(data => {
      const jsonData = JSON.stringify(data);

      // Trigger the download
      downloadJsonFile(jsonData);
    });
  }else{
    // devtools panel
    if (sender.url != browser.runtime.getURL("/devtools/panel/panel.html")) {
      return;
    }

    browser.tabs.executeScript(
      request.tabId, 
      {
        code: request.script
      });
  }
}

async function generateHash(object) {
  const data = JSON.stringify(object);
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function getAllData(callback) {
  const dbPromise = indexedDB.open('twitterLoggerDatabase');
  dbPromise.onsuccess = event => {
    const db = event.target.result;
    const transaction = db.transaction('rawPacketsStore', 'readonly');
    const objectStore = transaction.objectStore('rawPacketsStore');

    const data = [];
    objectStore.openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        data.push(cursor.value);
        cursor.continue();
      } else {
        callback(data);
      }
    };
  };
}
function downloadJsonFile(jsonData) {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'tweetDatabase.json';
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(url);
}
/**
Listen for messages from our devtools panel.
*/
browser.runtime.onMessage.addListener(handleMessage); 


