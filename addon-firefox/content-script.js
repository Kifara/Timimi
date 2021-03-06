var idGenerator = 1;
var data = {};
var tlast = new Date();
var indata = {};
// Checking if the active tab is a  local tiddlywiki file
function checkTW() {
  var results = {};
  // Test for TiddlyWiki Classic
  var versionArea = document.getElementById("versionArea");
  results.isTiddlyWikiClassic =
    document.location.protocol === "file:" &&
    document.getElementById("storeArea") &&
    (versionArea && /TiddlyWiki/.test(versionArea.textContent));
  // Test for TiddlyWiki 5
  var metaTags = document.getElementsByTagName("meta");
  for (var t = 0; t < metaTags.length; t++) {
    if (
      metaTags[t].name === "application-name" &&
      metaTags[t].content === "TiddlyWiki"
    ) {
      results.isTiddlyWiki5 = true;
    }
  }
  results.isTiddlyWiki = results.isTiddlyWikiClassic || results.isTiddlyWiki5;
  // Test for file URI
  if (document.location.protocol === "file:") {
    results.isLocalFile = true;
  }
  return results;
}
// Loading settings from browser storage
var getting = browser.storage.sync.get();
getting.then(onGot, syncError);

function syncError(error) {
  console.log(`Error in getting values from browser storage: ${error}`);
}

function onGot(item) {
  data = item;
  if (data.backup == "yes") {
    console.log("Timimi: Backups enabled");
    console.log("Timimi: Backup method: " + data.bstrategy);
  }
}

var checkTWResults = checkTW();

if (checkTWResults.isTiddlyWiki5 && checkTWResults.isLocalFile) {
  var messageBox = document.getElementById("tiddlyfox-message-box");
  if (!messageBox) {
    messageBox = document.createElement("div");
    messageBox.id = "tiddlyfox-message-box";
    messageBox.style.display = "none";
    document.body.appendChild(messageBox);
  }
  // Listen to initiate message from background script
  // Attach the event handler to the message box
  messageBox.addEventListener("tiddlyfox-save-file", onSaveTiddlyWiki, false);
  messageBox.addEventListener("timimi-action-launch", onActionLaunch, false);

  function onActionLaunch(event) {
    console.log("Timimi: Received event: " + event.type);
    indata = event.detail;
    var LaunchElement = event.target;
    console.log("Timimi: Launching event" + event.detail.escript);
    var sending = browser.runtime.sendMessage({
      exec: data.exec,
      escript: event.detail.escript,
      eparam: event.detail.eparam,
      estdin: event.detail.estdin
    });
    sending.then(launchResponse, launchError);
    function launchResponse(message) {
      LaunchElement.parentNode.removeChild(LaunchElement);
      console.log("Timimi: Launch script event concluded");
    }

    function launchError() {
      console.log(`Timimi: Launch script event error: ${error}`);
    }
  }
  function onSaveTiddlyWiki(event) {
    tbackup = "false";
    if (data.bstrategy == "timed") {
      var now = new Date();
      var diffMs = now - tlast;
      var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
      if (diffMins >= data.tint) {
        tbackup = "true";
        tlast = now;
        console.log("Timimi: Creating Timed Backup");
      }
    }
    // Get the details from the message
    var messageElement = event.target,
      path = messageElement.getAttribute("data-tiddlyfox-path"),
      content = messageElement.getAttribute("data-tiddlyfox-content"),
      backupPath = messageElement.getAttribute("data-tiddlyfox-backup-path"),
      messageId = "tiddlywiki-save-file-response-" + idGenerator++;
    // Send the details to background script. Not using port because we need a promise and port.postMessage is not a promise
    var sending = browser.runtime.sendMessage({
      path: path,
      messageId: idGenerator,
      content: content,
      backupPath: backupPath,
      backup: data.backup,
      bpath: data.bpath,
      bstrategy: data.bstrategy,
      tohrecent: data.tohrecent,
      tohlevel: data.tohlevel,
      psint: data.psint,
      tbackup: tbackup
    });
    sending.then(handleResponse, handleError);

    function handleResponse(message) {
      messageElement.parentNode.removeChild(messageElement);
      console.log("Message ID is " + messageId);
      var event = document.createEvent("Events");
      event.initEvent("tiddlyfox-have-saved-file", true, false);
      event.savedFilePath = path;
      messageElement.dispatchEvent(event);
    }

    function handleError() {
      console.log(`Error: ${error}`);
    }
  }
}
browser.runtime.onMessage.addListener(request => {
  console.log("Timimi: Received stdout in content-script");
  var outdata = cloneInto(
    {
      message: request.stdout,
      title: indata.title,
      sep: indata.sep,
      fields: indata.fields,
      creationFields: indata.creationFields,
      modificationFields: indata.modificationFields
    },
    document.defaultView
  ); //Firefox Specific. See https://stackoverflow.com/a/46081249/7393623
  var event = new CustomEvent("timimi-launch-script-stdout", {
    detail: outdata,
    bubbles: true,
    cancelable: true
  });

  document.dispatchEvent(event);
  console.log("Timimi: Dispatched Event timimi-launch-script-stdout");
  // stdouttitle = "";
});
