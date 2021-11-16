const localURL = 'http://127.0.0.1:5000'; // ! temp url
const MAX_RECENT_DOWNLOADS = 16;
const DOWNLOAD_RETRY_INTV = 10 * 1000;
// const AUDIO_TIMEOUT_MS = 10 * 1000;
// const KEEP_ALIVE_INV_MS = 5 * 1000;
var dlProcessed = []; // list of processed completed download events
var dlRetried = {}; // number of reattempts of failed download event
var initiated = false;

function reqListener() {
  addonConfig = JSON.parse(this.responseText);
}
var addonConfigReq = new XMLHttpRequest();
var addonConfig = new Object;
addonConfigReq.onload = reqListener
addonConfigReq.open('GET', 'prefs/config.json');
addonConfigReq.send();

var audio_stream = document.createElement('audio');

const SOUND_NAME_TO_FILE = {
  bell: 'bell.ogg',
  ding: 'ding.oga',
  pop: 'pop.oga'
}

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/InterruptReason
const SOLVABLE_ERR = [
  browser.downloads.InterruptReason.NETWORK_FAILED,
  browser.downloads.InterruptReason.NETWORK_TIMEOUT,
  browser.downloads.InterruptReason.NETWORK_DISCONNECTED,
  browser.downloads.InterruptReason.NETWORK_SERVER_DOWN,
  browser.downloads.InterruptReason.CRASH
]

function onError(err) {
  console.log(`error = ${err}`);
}

function init() {
  notifServerDlding();
  checkConfigVer;
  // keepAlive()
}

` // Experimental feature
function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, s));
}

async function keepAlive() {
  while (true) {
    reqServer('alive')
    await sleep(KEEP_ALIVE_INV_MS)
  }
}
`

function loadPrefs(callback) {
  browser.storage.local.get()
    .then((result) => {
      var prefs = Object();
      if (!initiated) {
        for (const key in addonConfig) {
          prefs[key] = addonConfig[key].defaultValue;
        }
        initiated = true;
      }
      for (const key in result) {
        prefs[key] = result[key];
      }
      callback(prefs)
    }, onError)
}

function checkConfigVer(prefs) {
  prefsUpdates = {
    1: function (prefs) {
      // 1: initial version, do nothing
      prefs.config_version = 1;
    },
    2: function (prefs) {
      // 2: Reserved for next version
      prefs.config_version = 2;
    },
  };

  if (addonConfig === {}) {
    window.setTimeout(checkConfigVer, 10);
  } else if (prefs == undefined) {
    window.setTimeout(() => loadPrefs(checkConfigVer), 10);
  } else {
    let defaultVer = addonConfig.config_version.defaultValue;
    let currentVer = prefs.config_version;
    while (currentVer++ < defaultVer) {
      prefsUpdates[currentVer](prefs);
    }
    browser.storage.local.set(prefs)
  }
}

function getDlding(callback) {
  downloading = 0;
  browser.downloads.search({})
    .then((downloads) => {
      for (const download of downloads) {
        if (download.state != browser.downloads.State.COMPLETE &&
          download.state != browser.downloads.State.INTERRUPTED) {
          downloading++;
        }
      }
      callback(downloading)
    }, onError)
}

function notifSound(prefs) {
  target = prefs.notif_sound.toLowerCase();
  if (target == 'none');
  else if (SOUND_NAME_TO_FILE.hasOwnProperty(target)) {
    audio_stream.src = browser.runtime.getURL('assets/' + SOUND_NAME_TO_FILE[target]);
    audio_stream.play();
  } else {
    console.log("Sound file not found");
  }
}

function notify(summary, body) {
  loadPrefs((prefs) => {
    let id = body.toString() + '--notif'
    browser.notifications.create(id, {
      'type': 'basic',
      'title': summary.toString(),
      'message': body
    });
    setTimeout(() => browser.notifications.clear(id), prefs.notif_timeout);
    notifSound(prefs);
  });
}

function hashDlObject(a, b) {
  let s = a + b;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function dlRecorded(download) {
  let hash = hashDlObject(download.id.toString(), download.startTime);
  if (dlProcessed.length > MAX_RECENT_DOWNLOADS) {
    dlProcessed.splice(0, MAX_RECENT_DOWNLOADS - 2);
  }
  if (dlProcessed.indexOf(hash) == -1) {
    dlProcessed.push(hash);
    return false;
  }
  return true;
}

function onDlChange(download) {
  browser.downloads.search({ 'id': download.id })
    .then((download_list) => {
      download = download_list[0]
      message = `"onDlChange": {"filename":"${download.filename}","url":"${download.url}","state":"${download.state}","error":"${download.error}"}`;
      console.log(message);
      logging(message);
      if (download.state == browser.downloads.State.COMPLETE) { // Completed event
        if (!dlRecorded(download)) { // Ignore if recorded
          onDlCompleted(download);
        }
      } else if (download.state == browser.downloads.State.INTERRUPTED) { // Interrupted event
        // retryDownload(download); //! Problematic
      }
    }, onError);
}

function onDlCompleted(download) {
  delete dlRetried[hashDlObject(download.url, download.filename)];
  notifServerDlding();
  shutdown();
}

//! prefs in local storage deleted after download restarted
//! Restarted download's filename does not include extension
//! HTML Complete did not download assets
function retryDownload(download) {
  // Firefox does not support retry download using browser.download.resume
  // Only able to restart download
  // https://discourse.mozilla.org/t/browser-downloads-resume-is-not-the-same-as-retry/75057  
  if (SOLVABLE_ERR.includes(download.error)) {
    console.log(`retrying download:`);
    console.log(download);
    let hash = hashDlObject(download.url, download.filename);
    loadPrefs((prefs) => {
      console.log('retryDownload');
      console.log(prefs);
      if (prefs.retry) {
        if (!dlRetried.hasOwnProperty(hash)) {
          dlRetried[hash] = 1;
        } else if (dlRetried[hash] <= prefs.max_retries) {
          dlRetried[hash]++;
        } else {
          console.log(`max retries attempted`);
          if (!dlRecorded(download)) {
            onDlCompleted(download);
          }
          return;
        }
        console.log(`download retried: ${dlRetried[hash]}`);
        setTimeout(() => {
          console.log('timeout finished\nrestarting download');
          browser.downloads.download({
            "url": download.url,
            "incognito": download.incognito,
            "conflictAction": "overwrite"
          });
        }, DOWNLOAD_RETRY_INTV);
      }
    });
  } else {
    console.log(`Unsolvable download: ${download}`);
    if (!dlRecorded(download)) {
      onDlCompleted(download);
    }
  }
}

function shutdown() {
  loadPrefs((prefs) => {
    getDlding((downloading) => {
      if (downloading <= 0) {
        if (prefs.shutdown_option !== 'None') {
          reqServer('req', prefs.shutdown_option.toLowerCase(), prefs.buffer)
          logging(`"shutdown": {"option":"${prefs.shutdown_option.toLowerCase()}","buffer":"${prefs.buffer}"}`)
        }
      } else { // New download event started
        reqServer('req', 'abort')
        logging(`"shutdown": "aborted"`)
      }
    });
  });
}

function notifServerDlding() {
  getDlding((downloading) => {
    message = `"Current downloading events": "${downloading}"`;
    reqServer('req', 'notif', message);
    logging(message);
  })
}

function logging(message) {
  browser.storage.local.get('logging')
    .then((result) => {
      if (result.logging) {
        reqServer('log', req = '', message = `{"source": "main.js",${message}}`);
      }
    })

}

function reqServer(typ, req = '', message = '') {
  var xhr = new XMLHttpRequest();
  xhr.onload = () => {
    if (xhr.readyState === xhr.DONE) {
      if (xhr.status === 200) {
        notify(xhr.status, xhr.response);
      }
      else if (xhr.status === 204);
      else {
        message = `"${xhr.status}":"${xhr.response}"`
        console.log(message);
        // logging(message)
        notify(xhr.status, xhr.response);
      }
    } else {
      console.log(xhr.status);
      notify('Shutdown Failed', 'Shutdown operation did not success')
    }
  };
  if (typ == 'req') {
    xhr.open('GET', `${localURL}/req=${req}&${message}`);
    xhr.send();
  } else if (typ == 'alive') {
    xhr.open('GET', `${localURL}/alive`);
    xhr.send();
  } else if (typ == 'log') {
    xhr.open('POST', `${localURL}/log`);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify(message))
  }
}

init()
browser.downloads.onCreated.addListener(notifServerDlding);
browser.downloads.onChanged.addListener(onDlChange);