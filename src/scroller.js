console.log('scroller loaded')

const scrollerSequences = [[3,47.5,46,62,64.5,94.5,22,2.5],[5.5,35,30.5,34.5,32.5,38,39.5,67,25.5,20,11.5,2.5],[58,32.5,101.5,62.5,75,61.5,46.5,18.5],[1.5,30,33.5,41.5,60,53,50.5,37.5,26,8.5],[6,9,64,113.5,55.5,45,44.5,43.5,34,40,1],[0.5,5,20,31,37.5,96.5,50,39.5,40.5,41,38,29,20.5,7],[0.5,5.5,30.5,65,48,100.5,49.5,98,34,20,4.5],[4,21.5,16,24.5,26,56,69,33,29,35,33,32.5,27,22.5,16,10,1],[10.5,73,123.5,39,41,24,30.5,0.5],[0.5,16.5,91,52.5,98.5,66.5,16.5],[5.5,62.5,87.5,53,45.5,41,27.5,17,2.5],[9.5,14.5,28,75.5,48.5,49.5,44,34,25.5,12,1],[3,40,57.5,37.5,122.5,33,42,6.5],[2.5,9,18,29,32,40,91.5,100,20],[3,8.5,36.5,61,47,48.5,64.5,71,57.5,42,16.5],[1,6.5,10.5,19,27.5,72.5,52.5,40,73.5,25,12.5,1.5]]
let lastYposition = 0;
let endReached = false;
let temp = 700;

function getRandomInteger(min, max) {
 return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomScroll() {
  if(endReached){
    endReached = false
    return
  }
  const sequence = scrollerSequences[getRandomInteger(0,scrollerSequences.length - 1)]
  let index = 0;

  function scrollStep() {
    if (index < sequence.length) {
      const distance = sequence[index++]
      const delay = getRandomInteger(16,17)
      setTimeout(() => {
        window.scroll(0,window.scrollY+distance);
        scrollStep();
      }, delay);
    }else{
      if(lastYposition == window.scrollY){
        endReached = true;
        console.log('endReached')
      }else{
        lastYposition = window.scrollY
      }
    }
  }
  scrollStep();
  setTimeout(() => {
    randomScroll();
  }, getRandomInteger(temp*0.9,temp*1.1));
}

function handleMessage(request, sender, sendResponse) {
  if (request.action === 'scrollToEnd') {
    console.log('scrollToEnd message')
    temp = request.wheelDelay
    randomScroll();
  }else{
    console.log('another message')
  }
} 

browser.runtime.onMessage.addListener(handleMessage);
