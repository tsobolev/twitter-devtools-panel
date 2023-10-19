//Log all requests
browser.devtools.network.onRequestFinished.addListener(handleRequestFinished);

const responseList = document.getElementById("response-list");
const downloadButton = document.getElementById("downloadAsJson");
const messagePattern = /[а-я] [а-я]/
const database = []



function handleRequestFinished(request) {
  let url = request.request.url
  if(/UserTweets/.test(url)){
    request.getContent().then(([content, mimeType]) => {
      console.log("MIME type: ", mimeType);
      // StoreRawContent 
      //browser.runtime.sendMessage({ action: 'storeData', data: content });

      //ParseRawContent
      parsePacket(content)
    });
  }
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


function extractDataFromItem(innerContent){
  let item = {} 
  const printObj = printJsonObj(innerContent)
  printObj.forEach((path) => {
    if(path.join('.')  == 'tweet_results.result.core.user_results.result.legacy.screen_name'){
      item['user'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.full_text'){
      item['text'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.note_tweet.note_tweet_results.result.text'){
      item['text_note'] == findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.quoted_status_result.result.legacy.full_text'){
      item['quoted'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.quoted_status_result.result.note_tweet.note_tweet_results.result.text'){
      item['quoted_full'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.quoted_status_result.result.core.user_results.result.legacy.screen_name'){
      item['quoted_user'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.created_at'){
      item['text_time'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.quoted_status_result.result.legacy.created_at'){
      item['quoted_time'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.in_reply_to_screen_name'){
      item['replay_to'] = findValueByPath(innerContent,path)
    }
    // retweet 
    if(path.join('.') == 'tweet_results.result.legacy.retweeted_status_result.result.core.user_results.result.legacy.screen_name'){
      item['retweet_from'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.retweeted_status_result.result.legacy.full_text'){
      item['retweet_text'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.retweeted_status_result.result.legacy.created_at'){
      item['retweet_time'] = findValueByPath(innerContent,path)
    }
    // quoted text inside retweet 
    if(path.join('.') == 'tweet_results.result.legacy.retweeted_status_result.result.quoted_status_result.result.legacy.full_text'){
      item['retweet_quoted'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.retweeted_status_result.result.quoted_status_result.result.legacy.created_at'){
      item['retweet_quoted_time'] = findValueByPath(innerContent,path)
    }
    if(path.join('.') == 'tweet_results.result.legacy.retweeted_status_result.result.quoted_status_result.result.core.user_results.result.legacy.screen_name'){
      item['retweet_quoted_user'] = findValueByPath(innerContent,path)
    }
  })
  return item
}

function parseSingleReply(innerContent){
  const p = document.createElement('p')
  p.classList.add('reply')
  let module = []
  let key = 0
  module[key] = extractDataFromItem(innerContent)
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
  for (const key in items){
    let innerContent = items[key].item.itemContent
    HTML += prepareDebugOutput(innerContent)
    module[key] = extractDataFromItem(innerContent)
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


function triggerDownload(){
  console.log('triggerDownload')
 browser.runtime.sendMessage({ action: 'download'});
}

downloadButton.addEventListener("click", triggerDownload);
