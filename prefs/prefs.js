const localURL = "http://127.0.0.1:5000"; //! temp url
var initiated = false;
var audio_stream = document.createElement('audio');
config = new Object;
config.addonConfig = undefined;

function reqListener(e) {
  config.addonConfig = JSON.parse(this.responseText);
}
var addonConfigReq = new XMLHttpRequest();
addonConfigReq.onload = reqListener;
addonConfigReq.overrideMimeType("application/json"); //! necessary?
addonConfigReq.open('GET', 'config.json');
addonConfigReq.send();

function onError(err) {
  console.log(`error = ${err}`);
}

function waitForConfigLoad() {
  if (config.addonConfig) {
    buildWebpage();
    restorePrefs();
  }
  else {
    window.setTimeout(waitForConfigLoad, 10);
  }
}

function buildWebpage() {
  let lastRow = document.querySelector('#prefsLastRow');
  let globalConfig = config.addonConfig;

  for (const key in globalConfig) {
    let inputField = "";
    if (globalConfig[key].type == 'bool') {
      inputField = `<input type="checkbox" id="${key}">`;
    } else if (globalConfig[key].type == 'int') {
      inputField = `<input type="number" id="${key}"`;
      if (globalConfig[key].min !== undefined) {
        inputField += ` min="${globalConfig[key].min}"`;
      }
      if (globalConfig[key].max !== undefined) {
        inputField += ` max="${globalConfig[key].max}"`;
      }
      if (globalConfig[key].step !== undefined) {
        inputField += ` step="${globalConfig[key].step}"`;
      }
      if (globalConfig[key].placeholder !== undefined) {
        inputField += ` placeholder="${globalConfig[key].placeholder}"`;
      }
      inputField += `>`;
    } else if (globalConfig[key].type == 'select') {
      inputField = `<select id="${key}">`;
      for (const idx in globalConfig[key].options) {
        let opt = globalConfig[key].options[idx];
        inputField += `<option value="${opt}">${opt}</option>`;
      }
      inputField += `</select>`;
    } else if (globalConfig[key].type == 'string') {
      inputField = `<input type="text" id="${key}"`;
      if (globalConfig[key].placeholder !== undefined) {
        inputField += ` placeholder="${globalConfig[key].placeholder}"`;
      }
      inputField += `>`;
    } else if (globalConfig[key].type == 'button') {
      inputField = `<button type="${globalConfig[key].btnType}" id="${key}">${globalConfig[key].name}</button>`
    } else {
      // console.log(`buildWebpage() Skipping key: ${key}`);
      continue;
    }
    let tableRow = `
    <tr>
      <td class="col1">
        <label>
          <strong>${globalConfig[key].name}</strong>
          <br>
          <p>${globalConfig[key].description}</p>        
        </label>
      </td>
      <td class="col2">
        ${inputField}
      </td>
    </tr>`;
    let template = document.createElement('template');
    template.innerHTML = tableRow.trim();
    lastRow.parentNode.insertBefore(template.content.firstChild, lastRow);
  }
}

function savePrefs(prefs) {
  if (prefs === undefined) {
    browser.storage.local.get().then(savePrefs, onError);
    return;
  }
  let globalConfig = config.addonConfig;
  for (const key in globalConfig) {
    let inputElement = document.querySelector('#' + key);
    if (inputElement === undefined) {
      console.log(`DL SHUTDOWN ERROR - config element not found in page: ${key}`);
      continue;
    }
    if (globalConfig[key].type == 'bool') {
      prefs[key] = inputElement.checked || false;
    } else if (globalConfig[key].type == 'int') {
      prefs[key] = inputElement.value || globalConfig[key].defaultValue;
      // Prevent going under minimum
      if (globalConfig[key].min !== undefined && prefs[key] < globalConfig[key].min) {
        prefs[key] = globalConfig[key].min;
      }
      // Prevent going over maximum
      if (globalConfig[key].max !== undefined && prefs[key] < globalConfig[key].max) {
        prefs[key] = globalConfig[key].max;
      }
    } else if (globalConfig[key].type == 'select') {
      prefs[key] = inputElement.selectedOptions[0].value;
    } else if (globalConfig[key].type == 'string') {
      prefs[key] = inputElement.value
    } else if (globalConfig[key].type == 'button' || globalConfig[key].type == 'internal') {
      continue;
    } else {
      console.log(`DL SHUTDOWN PREFS SAVE ERROR - config type not recognized: ${key}/${globalConfig[key].type}`);
      continue;
    }
  }
  browser.storage.local.set(prefs);
}

function restorePrefs() {
  browser.storage.local.get()
    .then(prefs => {
      let globalConfig = config.addonConfig
      for (let key in globalConfig) {
        let inputElement = document.querySelector('#' + key);
        if (inputElement === undefined) {
          console.log(`DL SHUTDOWN ERROR - config element not found in page: ${key}`);
          continue;
        }
        if (globalConfig[key].type == 'bool') {
          inputElement.checked = prefs[key] ? prefs[key] : globalConfig[key].defaultValue;

        } else if (globalConfig[key].type == 'int' || globalConfig[key].type == 'string') {
          inputElement.value = prefs[key] ? prefs[key] : globalConfig[key].defaultValue;
        } else if (globalConfig[key].type == 'select') {
          let defaultIdx = 0;
          let currIdx = undefined;
          for (let idx = 0; idx < inputElement.childElementCount; idx++) {
            if (inputElement[idx].value == prefs[key]) {
              currIdx = idx;
            } else if (inputElement[idx].value == globalConfig[key].defaultValue) {
              defaultIdx = idx;
            }
          }
          currIdx = currIdx ? currIdx : defaultIdx;
          inputElement[currIdx].selected = true;
        } else if (globalConfig[key].type == 'internal' || globalConfig[key].type == 'button') {
          continue;
        } else {
          console.log(`DL SHUTDOWN PREFS RESTORE ERROR - config type not recognized: ${key}/${globalConfig[key].type}`);
          continue;
        }
      }
    }, onError);
}

function restoreDefaults() {
  browser.storage.local.clear();
  logging('"restore defaults"')
  restorePrefs();
}

function loadPrefs(callback) {
  browser.storage.local.get()
    .then((result) => {
      var prefs = Object();
      if (!initiated) {
        for (const key in config.addonConfig) {
          prefs[key] = config.addonConfig[key].defaultValue;
        }
        initiated = true;
      }
      for (const key in result) {
        prefs[key] = result[key];
      }
      callback(prefs);
    }, onError);
}

var SOUND_NAME_TO_FILE = {
  bell: 'bell.ogg',
  ding: 'ding.oga',
  pop: 'pop.oga'
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

function abortShutdown() {
  reqServer('req', 'abort');
  logging('"abort shutdown"')
}

function fullLogging() { // log downloading events and interrupted events
  downloading = 0;
  message = `"DownloadEvents":\n`;
  browser.downloads.search({})
    .then((downloads) => {
      message += `[\n`;
      for (const download of downloads) {
        if (download.state != browser.downloads.State.COMPLETE) {
          message += `\t{"filename":"${download.filename}","url":"${download.url}","state":"${download.state}","error":"${download.error}"},\n`;
        }
      }
      message.slice(0, -1);
      message += `],\n`;
      browser.storage.local.get().then(prefs => {
        message += JSON.stringify(prefs) + '\n';
        logging(message);
      });
    }, onError)
}


function logging(message) { // not local logging updating
  browser.storage.local.get('logging')
    .then((result) => {
      if (result.logging) {
        reqServer('log', req = '', message = `{"prefs.js": ${message}}`);
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
  } else if (typ == 'log') {
    xhr.open('POST', `${localURL}/log`);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify(message));
  }
}

function submitPrefsForm(e) {
  e.preventDefault();
  if (e.submitter.id == 'restore_default') {
    restoreDefaults();
  } else if (e.submitter.id == 'abort_shutdown') {
    abortShutdown();
  } else if (e.submitter.id == 'save') {
    savePrefs();
  } else if (e.submitter.id == 'full_logging') {
    fullLogging();
  } else {
    message = `submitPrefsForm submitter not recognized: ${e.submitter.id}`;
    console.log(message);
    console.log(e);
    logging(message);
  }
}

document.addEventListener('DOMContentLoaded', waitForConfigLoad);
document.querySelector('#prefsForm').addEventListener('submit', submitPrefsForm);
document.querySelector('#prefsForm').addEventListener('focusout', () => savePrefs);