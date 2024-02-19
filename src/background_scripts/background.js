console.log('background started')

// Open or create an IndexedDB database
const databaseName = 'twitterLoggerDatabase'
const parsedBlocksStore = 'rawPacketsStore'
const rawBlocksStore = 'trueRawStore'
// don't forget to increment version if structure has been changed
const dbVersion = 6
const dbPromise = indexedDB.open(databaseName, dbVersion);

// Define the structure of database
dbPromise.onupgradeneeded = event => {
  console.log('new version of database!')
  const db = event.target.result;
  if(event.oldVersion < 2){
    db.createObjectStore(parsedBlocksStore, {autoIncrement: true})
  }
  db.createObjectStore(rawBlocksStore, {autoIncrement: true})
};

function handleMessage(request, sender, sendResponse) {
  if (request.action === 'storeData') {
    // generate Hash from data
    generateHash(request.data).then(hash => {
      // if hash is uniq, data will be appened to database
      storeData(request.data,parsedBlocksStore,hash);
    });

  }else if(request.action === 'storeRawData'){
    // just put raw object to store
    console.log('storeRawData request')
    storeData(request.data,rawBlocksStore,false)

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
    /**
    When we receive the message, execute the given script in the given
    tab.
    */
    browser.tabs.executeScript(
      request.tabId, 
      {
        code: request.script
      });
  }
}

function storeData(data,storage,hash){
  // Generate a hash for the data
  //generateHash(data).then(hash => {
    // Open the IndexedDB database
    const dbPromise = indexedDB.open(databaseName);
    if(hash === false){
      dbPromise.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction(storage, 'readwrite');
        const objectStore = transaction.objectStore(storage);

        const request = objectStore.add(data);
        console.log('rawPacket stored in DB')
        transaction.oncomplete = () => {
          console.log('transaction complete')
        }
      }
    }else{
      dbPromise.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction(storage, 'readwrite');
        const objectStore = transaction.objectStore(storage);

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
          console.log('transaction complete');
        };
      };
    }
  //});
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
  const dbPromise = indexedDB.open(databaseName);
  dbPromise.onsuccess = event => {
    const db = event.target.result;
    const transaction = db.transaction(parsedBlocksStore, 'readonly');
    const objectStore = transaction.objectStore(parsedBlocksStore);

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

browser.contextMenus.create({
  id: "scrollTab",
  title: "Scroll Tab",
  contexts: ["all"]
});


browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "scrollTab") {
    browser.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
      // console.log(tabs)
      // Execute script to scroll the active tab
        try{
          const injectResult = await browser.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['scroller.js']
          });
          console.log('inject success',injectResult)
        }catch{
          console.log('inject error')
        }
      browser.storage.sync.get("wheelDelayInput", (result) => {
        if (result.wheelDelayInput) {
          //wheelDelayInput.value = result.wheelDelayInput;
          browser.tabs.sendMessage(tabs[0].id, { action: "scrollToEnd", wheelDelay: result.wheelDelayInput });
        }else{
          browser.tabs.sendMessage(tabs[0].id, { action: "scrollToEnd", wheelDelay: 700 });
        }
      })

    });
  }
});


