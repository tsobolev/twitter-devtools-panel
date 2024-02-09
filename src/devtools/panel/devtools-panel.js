const responseList = document.getElementById("response-list");
const downloadButton = document.getElementById("downloadAsJson");
const clearAfterDownloadCheckbox = document.getElementById("clearAfterDownload")
const captureRawCheckbox = document.getElementById("captureRaw")
const captureParsedCheckbox = document.getElementById("captureParsed")
const downloadRawButton = document.getElementById("downloadRawJson")

const database = []

const databaseName = 'twitterLoggerDatabase'
const parsedBlocksStore = 'rawPacketsStore'
const rawBlocksStore = 'trueRawStore'


function handleRequestFinished(request) {
  let url = request.request.url
  const url_object = new URL(url)
  const paramsObject = {};
  url_object.searchParams.forEach((value, key) => {
    paramsObject[key] = JSON.parse(value);
  });

  if(/UserTweets/.test(url)){
    request.getContent().then(([content, mimeType]) => {
      if(captureRawCheckbox.checked){
        printPacketStat(content,url)
        browser.runtime.sendMessage({ action: 'storeRawData', data: {content: JSON.parse(content), url: paramsObject } });
      }
      if(captureParsedCheckbox.checked){
        parsePacket(content)
      }
    });
  }else if(/SearchTimeline/.test(url)){
    request.getContent().then(([content, mimeType]) => {
      if(captureRawCheckbox.checked){
        printPacketStat(content,url)
        browser.runtime.sendMessage({ action: 'storeRawData', data: {content: JSON.parse(content), url: paramsObject } });
      }
      if(captureParsedCheckbox.checked){
        parseSearch(content)
      }
    });   
  }
}

function parseSearch(content){
  const json = JSON.parse(content)
  const instructions = json.data.search_by_raw_query.search_timeline.timeline.instructions
  instructions.forEach((instruction)=>{
    if(instruction.entries){
      //database.push(...parseModules(instruction.entries))
      const packet = parseModules(instruction.entries)
      packet.forEach(data => {
        browser.runtime.sendMessage({ action: 'storeData', data: data });
      })
    }
  })

}

function parsePacket(content){
  const json = JSON.parse(content)
  // logPathesForPacket(json,messagePattern)
  // Packet may contain instructions
  const instructions = json.data.user.result.timeline_v2.timeline.instructions
  instructions.forEach((instruction)=>{
    if(instruction.entries){
      //database.push(...parseModules(instruction.entries))
      const packet = parseModules(instruction.entries)
      packet.forEach(data => {
        browser.runtime.sendMessage({ action: 'storeData', data: data });
      })
    }
  })
  console.log(database)
}

function parseModules(replies){
  let modules = []
  for(const key in replies){
    // console.log(key)
    let content = replies[key].content
    // console.log(content)
    let entryType = content.entryType
    if (entryType == 'TimelineTimelineItem'){
      modules.push(parseSingleReply(content.itemContent))
    } else if (entryType == 'TimelineTimelineModule'){
      modules.push(parseMultiReply(content.items))
    } else {
      parseUnknownReply(content)
    }
  }
  return modules
}

function printJsonObj(obj, currentPath = [], alphaPaths = []) {
  for (const key in obj) {
    if (typeof obj[key] === 'object' || Array.isArray(obj[key])) {
      printJsonObj(obj[key], [...currentPath, key], alphaPaths);
    }else{
      alphaPaths.push([...currentPath, key]);
    }
  }
  return alphaPaths
}

function prepareDebugOutput(obj){
  let text = ''
  alphaPaths = printJsonObj(obj)
  alphaPaths.forEach((path) => {
    text = text + "<div class='path'>" + path.join(".") + "</div>\n"

    // console.log(path.at(-1))
    // console.log(path)
    const fields = ['full_text','screen_name']
    if(fields.indexOf(path.at(-1)) > -1){
      text = text + "<div class='only'>" + findValueByPath(obj,path) + "</div>\n"
    }else{
      text = text + "<div class='value'>" + findValueByPath(obj,path) + "</div>\n"
    }
     })
  return text
}

function findValueByPath(obj, path) {
  return path.reduce((acc, key) => (acc && acc[key] ? acc[key] : null), obj);
}

const itemMapKeys = {
  'tweet_results.result.core.user_results.result.legacy.screen_name':'user',
  'tweet_results.result.legacy.full_text':'text',
  'tweet_results.result.note_tweet.note_tweet_results.result.text':'text_note',
  //'tweet_results.result.views.count':'text_views',
  'tweet_results.result.legacy.created_at':'text_time',
  'tweet_results.result.quoted_status_result.result.legacy.full_text':'quoted',
  'tweet_results.result.quoted_status_result.result.note_tweet.note_tweet_results.result.text':'quoted_full',
  'tweet_results.result.quoted_status_result.result.core.user_results.result.legacy.screen_name':'quoted_user',
  'tweet_results.result.quoted_status_result.result.legacy.created_at':'quoted_time',
  'tweet_results.result.legacy.in_reply_to_screen_name':'replay_to',
  //retweet
  'tweet_results.result.legacy.retweeted_status_result.result.core.user_results.result.legacy.screen_name':'retweet_from',
  'tweet_results.result.legacy.retweeted_status_result.result.legacy.full_text':'retweet_text',
  'tweet_results.result.legacy.retweeted_status_result.result.legacy.created_at':'retweet_time',
  //tetweet quoted
  'tweet_results.result.legacy.retweeted_status_result.result.quoted_status_result.result.legacy.full_text':'retweet_quoted',
  'tweet_results.result.legacy.retweeted_status_result.result.quoted_status_result.result.legacy.created_at':'retweet_quoted_time',
  'tweet_results.result.legacy.retweeted_status_result.result.quoted_status_result.result.core.user_results.result.legacy.screen_name':'retweet_quoted_user',
}

const counterMapKeys = {
  'tweet_results.result.views.count':'text_views'
}

function extractDataFromItem(innerContent){
  let item = {}
  let counter = {}
  const printObj = printJsonObj(innerContent)
  printObj.forEach((path) => {
    let usefulItemKey = itemMapKeys[path.join('.')]
    if(usefulItemKey){
      item[usefulItemKey] = findValueByPath(innerContent,path)
    }
    let usefulCounterKey = counterMapKeys[path.join('.')]
    if(usefulCounterKey){
      counter[usefulCounterKey] = findValueByPath(innerContent,path)
    }
  })
  return {'item':item,'counter':counter}
}

function parseSingleReply(innerContent){
  const p = document.createElement('p')
  p.classList.add('reply')
  let module = []
  let counters = []
  let key = 0
  //module[key] = extractDataFromItem(innerContent)
  const itemsWithCounters = extractDataFromItem(innerContent)
  module[key] = itemsWithCounters['item']
  const HTML = prepareDebugOutput(innerContent)
  p.innerHTML = "<h3>single</h3>"+
  `<div class="only"><pre>${JSON.stringify(module,null,2)}</pre></div>`+
  `<div class="debug">${HTML}</div>` 
  responseList.appendChild(p)
  return module
}

function parseMultiReply(items){
  const p = document.createElement('p')
  p.classList.add('module')
  let HTML = ''
  let module = []
  let counters = []
  for (const key in items){
    let innerContent = items[key].item.itemContent
    HTML += prepareDebugOutput(innerContent)
    // module[key] = extractDataFromItem(innerContent)
    const itemsWithCounters = extractDataFromItem(innerContent)
    module[key] = itemsWithCounters['item']

  }
  p.innerHTML = `<h3>module</h3>`+
  `<div class="only"><pre>${JSON.stringify(module,null,2)}</pre></div>`+
  `<div class="debug">${HTML}</div>`
  responseList.appendChild(p)
  return module
}

function parseUnknownReply(replyContent){
  const p = document.createElement('p')
  p.classList.add('unknown')
  p.innerHTML = "<h3>unknown</h3>"+ 
  `<div class="debug">${prepareDebugOutput(replyContent)}</div>`
  responseList.appendChild(p)
}

function printPacketStat(packet,url){
  console.log(url)
  const p = document.createElement('p')
  p.classList.add('unknown')
  p.innerHTML = "<h3>DataPacket</h3>"+
  decodeURI(url)+
  `<div class="debug">${Object.keys(packet).length}</div>`
  responseList.appendChild(p)
}

function getAllData(callback, storage, isClearFlag) {
  const dbPromise = indexedDB.open(databaseName);
  dbPromise.onsuccess = event => {
    console.log('isClearFlag',isClearFlag)

    const db = event.target.result;
    const transaction = db.transaction(storage, 'readwrite');
    const objectStore = transaction.objectStore(storage);

    const data = [];
    objectStore.openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        data.push(cursor.value);
        cursor.continue();
      } else {
        callback(data);
        if(isClearFlag){
          // Make a request to clear all the data out of the object store
          const objectStoreRequest = objectStore.clear();

          objectStoreRequest.onsuccess = (event) => {
            // report the success of our request
            console.log("Storage cleared by BKGND successfully")
          }
        }
      }
    };
  };
}

function downloadJsonFile(jsonData, filename) {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(url);
}

function downloadParsedJson(){
  console.log('downloadParsedJson')
  //browser.runtime.sendMessage({ action: 'download'});
  getAllData(data => {
    const jsonData = JSON.stringify(data);

    // Trigger the download
    downloadJsonFile(jsonData,'parsedjson.json');
  }, parsedBlocksStore, clearAfterDownloadCheckbox.checked);
}
function downloadRawJson(){
  console.log('downloadRawJson')
  //browser.runtime.sendMessage({ action: 'download'});
  getAllData(data => {
    const jsonData = JSON.stringify(data);

    // Trigger the download
    downloadJsonFile(jsonData,'rawjson.json');
  }, rawBlocksStore, clearAfterDownloadCheckbox.checked);
}

function toggleDebug() {
  var debugCheckbox = document.getElementById('debugToggle');
  var debugClass = document.querySelector('.debug');
  
  // Check if the checkbox is checked
  if (debugCheckbox.checked) {
    console.log('visible')
    debugClass.style.display = 'block';
    debugClass.style.visibility = 'visible';
  } else {
    console.log('hide')
    debugClass.style.display = 'none';
    debugClass.style.visibility = 'hidden';
  }
}

console.log('on page script loaded')
// Attach the toggleDebug function to the checkbox's change event
document.getElementById('debugToggle').addEventListener('change', toggleDebug);
downloadButton.addEventListener("click", downloadParsedJson);
downloadRawButton.addEventListener("click", downloadRawJson);

// Retrieve the saved state from storage
browser.storage.sync.get("captureRawState", (result) => {
  if (result.captureRawState) {
    captureRawCheckbox.checked = result.captureRawState;
  }
});
browser.storage.sync.get("captureParsedState", (result) => {
  if (result.captureParsedState) {
    captureParsedCheckbox.checked = result.captureParsedState;
  }
});

// Save the checkbox state when it changes
captureRawCheckbox.addEventListener("change", () => {
  browser.storage.sync.set({ "captureRawState": captureRawCheckbox.checked });
});
captureParsedCheckbox.addEventListener("change", () => {
  browser.storage.sync.set({ "captureParsedState": captureParsedCheckbox.checked});
});

//Log all requests
browser.devtools.network.onRequestFinished.addListener(handleRequestFinished);
