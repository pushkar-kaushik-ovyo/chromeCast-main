const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();
const NAME_SPACE = 'urn:x-cast:bc.cast.kcp';
const ENABLE_DEBUG = true;
// const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
// castDebugLogger.setEnabled(true);
// castDebugLogger.loggerLevelByEvents = {
//   // 'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
//   'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG
// }
// castDebugLogger.showDebugLogs(true);
// cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.DEBUG);
const playbackEvents = {
  START: "START",
  PLAY: "PLAY",
  BUFFER: "BUFFER",
  PAUSE: "PAUSE",
  SEEK: "SEEK",
  ERROR: "ERROR",
  STOP: "STOP"
}
const WATCHING = {
  ID:null,
  PREV_POSITION:null,
  IN_PROCESS:false,
}
const playerElement = document.getElementById('player');
let firstTimeUpdate = true,
    firstTimePlay = true,
    initialPosition = 0,
    lastPosition = 0,
    thisPageProtocol = document.location.protocol,
    // data-collection api
    baseURL = thisPageProtocol + "//metrics.brightcove.com/tracker?",
    currentSessionId;
/*** Slide banner  ***/
function createText(item){
  item.forEach((item,i)=>{
    let html = '<div class="slide-text">'
    html += '<div>'
    html += '<div><div class="slide-header">'
    html += item.meta.title.en
    html += '</div></div>'
    html += '<div><div class="slide-desc">'
    html += item.meta.description.en
    html += '</div></div>'
    html += '</div>'
    html += '</div>'
    playerElement.shadowRoot.querySelector('#castSlideshowElement').childNodes[i].innerHTML = html;
  })
}
function getBanners(id,limit) {
  return new Promise(function(resolve, reject) {
    const collectURL = 'https://prod-fms.kocowa.com/api/v01/fe/collection/get';
    const fullURL = collectURL + "?id=" + id + "&limit=" + limit;
    var xhr = new XMLHttpRequest();
    let sgwToken = 'anonymous'
    const data = playerManager.getMediaInformation();
    if (data && data.customData){
      if(data.customData.kocowa_custom && data.customData.kocowa_custom.token){
        sgwToken = data.customData.kocowa_custom.token
      }
    }
    console.log(JSON.stringify(data))
    console.log(sgwToken)
    xhr.open("GET", fullURL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", sgwToken);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        try {
            if (xhr.status === 200) {
              var json = JSON.parse(xhr.responseText);
              resolve(json);
            }
        } catch (e) {
          reject(e);
        }
      }
    };
    xhr.send();
  });
};
function setBanners(){
  // up to 10 images
  getBanners(386,10).then((data)=>{
    if (!data || !data.object || !data.object.contents || !data.object.contents.objects) {
      console.log("[BANNER] Invalid data structure received:", data);
      return;
    }
    const bannerList = data.object.contents.objects;
    if (!Array.isArray(bannerList)) {
      console.log("[BANNER] Banner list is not an array:", bannerList);
      return;
    }
    bannerList.forEach((item,index)=>{
      if (item && item.meta && item.meta.img_url) {
        playerElement.style.setProperty('--slideshow-image-' + (index+1), 'url("'+item.meta.img_url+'")');
      }
    });
    createText(bannerList);
  }).catch(error => {
    console.error("[BANNER] Error fetching banners:", error);
  });
}
setBanners();
/*** Slide banner  ***/
/*** Player Style ***/
let styleLoaded = false
function setPlayerStyle(css){
  if(css.length < 1){
    return
  }
  let fullCss = css.join(' ')
  let styleId = document.getElementById("kocowa-style")
  let shadowRootElement, style
  if (typeof(styleId) !== null || typeof(styleId) === undefined){
    shadowRootElement = document.querySelector( 'cast-media-player' ).shadowRoot;
    style = document.createElement( 'style' );
    style.id = "kocowa-style";
  }
  if(shadowRootElement){
    style.innerHTML = fullCss;
    shadowRootElement.appendChild( style );
  }
}
function setPlayerStyleForGoogleTV(css){
  if(css.length < 1 || document.querySelector( 'touch-controls' ) === null){
    return
  }
  let fullCss = css.join(' ')
  let styleId = document.getElementById("kocowa-style-googleTV")
  let shadowRootElement, style
  if (typeof(styleId) !== null || typeof(styleId) === undefined){
    shadowRootElement = document.querySelector( 'touch-controls' ).shadowRoot;
    style = document.createElement( 'style' );
    style.id = "kocowa-style-googleTV";
  }
  if(shadowRootElement){
    style.innerHTML = fullCss;
    shadowRootElement.appendChild( style );
  }
}
function copyThumbnail(){    
  if ( document.querySelector( 'touch-controls' ) === null) {
    return
  }
  let newCtl = document.querySelector( 'touch-controls' ).shadowRoot
  if(newCtl){
    let c1 = newCtl.querySelector( 'goog-video-metadata')
    if (newCtl.querySelector( '#castMetadataImage') !== null){
      return
    }
    let org = document.querySelector( 'cast-media-player' ).shadowRoot
    let orgImg = org.querySelector( '#castMetadataImage' )
    let cln = orgImg.cloneNode(true)
    c1.querySelector('#title').insertAdjacentElement('beforebegin', cln);
  }
}
function removeThumbnail(){
  if ( document.querySelector( 'touch-controls' ) === null) {
    return
  }
  if(document.querySelector( 'touch-controls' ).shadowRoot){
    document.querySelector( 'touch-controls' ).shadowRoot.querySelector( '#castMetadataImage' ).remove()
  }
}
setPlayerStyle(
  [
  '.player { position: fixed; }',
  '#castMetadataImage { width: 180px !important; }',
  '.metadataPlaceHolder { align-self: center !important; }',
  '#slideLogo {position: absolute; right: 80px; bottom: 80px; z-index:101 }',
  '.slideshow.active .slide.visible:before {content:""; position: absolute; right:90px; top: 45px; width: 180px; height: 100px; background-image:url("/assets/images/logo.svg");background-size:contain; background-repeat:no-repeat; z-index: 101;}',
  '.slide-text > div{position: absolute; bottom: 20%; left: 90px; width: 100%;}',
  '.slide-header {width: 45%; font-weight: 700; font-size: 52px; line-height: 52px; margin-bottom: 20px;}',
  '.slide-desc {width: 45%; font-size: 18px; line-height: 28px;}',
  ]
)
/*** Player Style END***/
/*** KCP Analytics setting ***/
// to check if it's main clip
let isMainClip = false,
    isRequested = false,
    bumperClipID = 'kocowa_bumper_clip';
function getKCPA(){
  return window.kcpa || null;
}
function initAnalytics(){
  cLogger("initAnalytics START");
  window.kcpa = new KCPA();
}
function setWatchAnalytics(data){
  cLogger("setWatchAnalytics START")
  if (getKCPA() !== null && getKCPA() !== undefined) {
    if(data !== null && data !== ""){
      getKCPA().initSDKforCast("",data.watch_log_url,data.auth_token,data.request_method,data.check_interval_sec).then(()=>{
        cLogger('initialize success')
        getKCPA().setSessionInfoForCast(data.access_session,data.user_id)
        getKCPA().setWatchContent(
          data.cp,
          data.category,
          data.series_name,
          data.episode_name,
          data.episode_num,
          data.asset_id,
          data.parent_id,
          data.collection_name,
          data.service_type,
          data.user_type,
          data.server_name,
          data.subtitle_lang,
          data.audio_lang,
          data.playback_speed,
          data.duration,
          data.cast_type,
          // data.season_name,
        )
      }).catch(()=>{
        cLogger('initialize failure')
      })
    }
  }
}
function startWatchAnalytics(){
  if (isMainClip && getKCPA().config.watch){
    cLogger('startWatchAnalytics START : ' + JSON.stringify(getKCPA()));
    if(getKCPA() === null){
      return;
    }
    getKCPA().getPlaybackPosition = function(){
      if(playerManager){
        return Math.trunc(playerManager.getCurrentTimeSec());
      }else{
        return -1;
      }
    }
    const playerStats = playerManager.getStats();
    console.log(playerStats)
    getKCPA().getBitrate = function(){
      if(playerStats) {
        return `${playerStats.streamBandwidth}`;
      }else{
        return -1;
      }
    }
    const data = playerManager.getMediaInformation()
    if (data && data.customData){
      if(data.customData.kocowa_custom && data.customData.kocowa_custom.watch_session){
        return getKCPA().startWatch(data.customData.kocowa_custom.watch_session)
      }
    }
  }
}
function updateWatchAnalytics(type,value){
  if(getKCPA() === null){
    return;
  }
  let isStarted = false
  if (getKCPA().config.watch !== null && getKCPA().config.watch.hasOwnProperty('started') ){
    isStarted = getKCPA().config.watch.started;
  }
  if (isMainClip && isStarted && !isRequested){
    cLogger('UPDATE WATCH [' + value + "]");
    switch(type){
        case 0: // playback status
            getKCPA().updatePlaybackStatus(value);
            break
        case 1: // subtitle language
            getKCPA().updateSubtitleLang(value);
            break
        case 2: // audio language  //discard
            getKCPA().updateAudioLang(value);
            break
        case 3: // playback speed
            getKCPA().updatePlaybackSpeed(value);
            break
    }
    if(type === 0 && (value === playbackEvents.BUFFER || value === playbackEvents.PAUSE || value === playbackEvents.SEEK) ){
      if(isCheckingState === true){
        return;
      }else{
        setCurrentTime();
        isCheckingState = true;
        setTimeout(checkState, checkStateInterval, value);
      }
    }
  }
}
/*** KCP Analytics setting END ***/
/*** check prev satus***/
let prevPositionMarker = null;
let isCheckingState = false;
const checkStateInterval = 5000;
function setCurrentTime(){
  prevPositionMarker = getCurrentTime();
  cLogger("setCurrentTime: " + prevPositionMarker);
}
function getCurrentTime(){
  if(playerManager){
    return Math.trunc(playerManager.getCurrentTimeSec());
  }
}
function checkState(value){
  cLogger("[CHECK STATE] Start: " + value);
  cLogger("[CHECK STATE] Action Type: " + getKCPA().config.watch.action_type);
  if (getKCPA().config.watch.action_type !== null && getKCPA().config.watch.action_type === value){
    let cTime = getCurrentTime();
    cLogger("prevPositionMarker: " + prevPositionMarker);
    cLogger("current Time : " + cTime);
    if(prevPositionMarker !== null && cTime !== prevPositionMarker){
      cLogger("[CHECK STATE] PLAYING");
      updateWatchAnalytics(0,playbackEvents.PLAY);
      isCheckingState = false;
      return;
    }else if(prevPositionMarker !== null && cTime === prevPositionMarker) {
      cLogger("[CHECK STATE] NOT PLAYING");
    }
  }
  isCheckingState = false;
}
// BUFFER: "BUFFER",
//   PAUSE: "PAUSE",
//   SEEK: "SEEK",
/*** check prev satus END***/
/*** System Event ***/
context.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, function(systemEvent) {
  cLogger("[PLAYER UPDATE] SENDER_CONNECTED");
});
context.addEventListener(cast.framework.system.EventType.SHUTDOWN, function(systemEvent) {
    cLogger("[PLAYER UPDATE] SHUTDOWN");
    updateWatchAnalytics(0,playbackEvents.STOP);
    // updateWatchingHistory();
    // updateWatchingHistoryFMS('STOP');
    broadcastEventToSender(playbackEvents.STOP);
    cLogger(systemEvent)
});
context.addEventListener(cast.framework.system.EventType.SENDER_DISCONNECTED, function(systemEvent) {
  cLogger("[PLAYER UPDATE] SENDER_DISCONNECTED");
  // systemEvent.reason: 
      //  click stop casting -> requested_by_sender
      //  close sender -> unknown
      //  eorror -> error
  if (systemEvent.reaseon === "error"){
    if(getKCPA() && getKCPA().config !== null && getKCPA().config.watch !== null && getKCPA().config.watch.hasOwnProperty('started')){
      getKCPA().errorWatch(systemEvent.reaseon, 'SENDER_DISCONNECTED');
    }
  }
});
/*** System Event End ***/
/*** Custom Message ***/
context.addCustomMessageListener(NAME_SPACE, function(customEvent) {
  // handle customEvent.
});
/*** Custom Message End ***/
/*** Media Events ***/
playerManager.addEventListener(cast.framework.events.EventType.REQUEST_LOAD,
  event => {
    currentSessionId = generateUUID();
    sendAnalyticsEvent("player_load", event);
    cLogger(event)
    cLogger("[PLAYER UPDATE] REQUEST_LOAD");
    if (styleLoaded === false){
      setPlayerStyleForGoogleTV(
        [
          '#progress-fill { background-color: rgba(255, 80, 227,1); }',
          '#progress-seekable-range { background-color:rgba(255, 80, 227,.8); }',
          '#castMetadataImage { width: 180px; height: 101px; background-size: contain; background-repeat: no-repeat; margin-right: 25px; position: absolute; bottom: 10px}',
          'goog-video-metadata #title { margin-left: 205px; margin-bottom: 15px } '
        ]
      )
      styleLoaded = true
    }
  });
playerManager.addEventListener(cast.framework.events.EventType.LOADED_METADATA,
  event => {
    // reset firstTimeUpdate
    firstTimeUpdate = true;
    cLogger("[PLAYER UPDATE] LOADED_METADATA");
  });
playerManager.addEventListener(cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
  event => { // Select Audio and Text tracks here.
    let mediaInfo = event.media;
    // Filter out the parsed in band tracks.
    let filteredTracks = mediaInfo.tracks.filter((track) => {
      return track.name;
    });
    mediaInfo.tracks = filteredTracks;
    cLogger(mediaInfo.tracks);
    cLogger("[PLAYER UPDATE] PLAYER_LOAD_COMPLETE");
    cLogger(event);
    const referenceId = mediaInfo.customData.referenceId;
    let senderData = mediaInfo.customData.kocowa_custom;
    if (referenceId !== "" && referenceId !== null && referenceId !== undefined){
      if (referenceId === bumperClipID){
        isMainClip = false;
      }else{
        isMainClip = true;
      }
      if (senderData && isMainClip) {
        copyThumbnail()
        if (getKCPA() === null || !getKCPA().hasOwnProperty('config')){
          initAnalytics();
        }
        if (getKCPA() !== null || getKCPA().hasOwnProperty('config')) {
          senderData.server_name = mediaInfo.contentId;
          senderData.cast_type = "Google Cast";
          if(mediaInfo.tracks.length === 0){
            senderData.subtitle_lang = 'NONE';
          }else{
            if (senderData.subtitle_lang === "OFF"){
              return;
            }
            if(senderData.subtitle_lang !== "" || senderData.subtitle_lang !== undefined || senderData.subtitle_lang !== null){
              cLogger(senderData.subtitle_lang.toUpperCase());
              try{
                if(enableTextTrackByLanguage(senderData.subtitle_lang)){
                  senderData.subtitle_lang.toUpperCase();
                  cLogger("subtitle_lang: " + senderData.subtitle_lang);
                }
              }catch(e){
                cLogger(e);
                enableTextTrackByLanguage('EN');
                senderData.subtitle_lang = 'EN';
              }
            }
          }
          if (senderData.audio_lang === null || senderData.audio_lang === undefined || senderData.audio_lang.length || 0){
            senderData.audio_lang = "ko";
          }
          if(senderData.playback_position && senderData.playback_position !== 0){
            cLogger("initial playback position: " + senderData.playback_position);
            playerManager.seek(senderData.playback_position);
          }
          if(!getKCPA().config.env['isInitialize']){
            setWatchAnalytics(senderData);
          }
        }
      }
      cLogger("isMainClip " + isMainClip);
    }
    playerManager.setMediaInformation(mediaInfo);
});
playerManager.addEventListener(cast.framework.events.EventType.PLAY,
  event => {
    // Fired when playback is ready to start (ie: after being paused)
    cLogger("[PLAYER UPDATE] PLAY");
  });
playerManager.addEventListener(cast.framework.events.EventType.PLAYING,
  event => {
    let dateTime = new Date();
    event.timeStamp = dateTime.valueOf();
    if(isMainClip){
      if (firstTimePlay) {
        cLogger("[PLAYER UPDATE] START");
        sendAnalyticsEvent("video_view", event);
        broadcastEventToSender(playbackEvents.START);
        // updateWatchingHistoryFMS('START')
        //to prevent startWatchAnalytics() from being executed twice while this process
        if(!isRequested){
          isRequested = true;
          cLogger("isRequested = " + isRequested);
          startWatchAnalytics().then(response =>{
            if(response.result == "failure") {
              cLogger('startWatchAnalytics FAILURE : ' + JSON.stringify(response.message));
              getKCPA().config.watch = null;
            }else if(response.result == "success"){
              cLogger('startWatchAnalytics SUCCESS');
              getKCPA().config.env.isInitialize = true;
              cLogger('KCPA isInitialized: ' + getKCPA().config.env.isInitialize);
              // if(getKCPA().config.watch.loop_interval){
              //   loopMaintain = true;
              //   watchingHistoryLoopStart();
              // }
              firstTimePlay = false;
            }
          }).catch((e)=>{
            cLogger('startWatchAnalytics FAILURE : ' + JSON.stringify(e));
            getKCPA().config.watch = null;
          }).finally(()=>{
            isRequested = false
            cLogger("isRequested = " + isRequested)
          })
        }
        return
      }
      cLogger("[PLAYER UPDATE] PLAYING")
      sendAnalyticsEvent("play_request", event);
      broadcastEventToSender(playbackEvents.PLAY);
      updateWatchAnalytics(0,playbackEvents.PLAY);
    }
  });
playerManager.addEventListener(cast.framework.events.EventType.PAUSE,
  event => {
    let dateTime = new Date(),
        thisPosition = dateTime.valueOf(),
        range = "";
    event.timeStamp = thisPosition; 
    range = ((lastPosition - initialPosition) / 1000).toString() + ".." + ((thisPosition - initialPosition) / 1000).toString();
    lastPosition = thisPosition;
    event.range = range;
    sendAnalyticsEvent("video_engagement", event);
    cLogger("[PLAYER UPDATE] PAUSE");
    broadcastEventToSender(playbackEvents.PAUSE);
    updateWatchAnalytics(0,playbackEvents.PAUSE);
    // updateWatchingHistory();
    // updateWatchingHistoryFMS('PAUSE');
  });
playerManager.addEventListener(cast.framework.events.EventType.SEEKING,
  event => {
    cLogger("[PLAYER UPDATE] SEEKING");
    broadcastEventToSender(playbackEvents.SEEK);
    updateWatchAnalytics(0,playbackEvents.SEEK);
  });
playerManager.addEventListener(cast.framework.events.EventType.SEEKED,
  event => {
    cLogger("[PLAYER UPDATE] SEEKED");
    // updateWatchingHistory();
    // updateWatchingHistoryFMS('SEEK');
  }); 
playerManager.addEventListener(cast.framework.events.EventType.BUFFERING,
  event => {
    cLogger("[PLAYER UPDATE] BUFFERING: " + JSON.stringify(event));
    if(event.isBuffering){
      updateWatchAnalytics(0,playbackEvents.BUFFER);
    }else if(!event.isBuffering) {
      //IDLE PLAYING PAUSED BUFFERING
      // PLAYING: EventType.SEEKING
      //buffer.false event comes after state come
      if (getKCPA() !== null && getKCPA().config !== null && getKCPA().config.watch !== null && getKCPA().config.watch.action_type !== null){
        cLogger("KCPA action_type: " + getKCPA().config.watch.action_type);
        if(getKCPA().config.watch.action_type == playbackEvents.BUFFER){
          if (playerManager.getPlayerState() === "PLAYING"){
            cLogger("getPlayerState:" + playerManager.getPlayerState());
            updateWatchAnalytics(0,playbackEvents.PLAY);
          }else if (playerManager.getPlayerState() === "PAUSED"){
            updateWatchAnalytics(0,playbackEvents.PAUSE);
          }else if (playerManager.getPlayerState() === "IDLE"){
            cLogger(cast.framework.messages.idleReason);
          }
        }
      }
    }
    broadcastEventToSender(playbackEvents.BUFFER);
  });
// gets triggered when a media in finished, will triggered once for each queue item that finishes.
playerManager.addEventListener(cast.framework.events.EventType.MEDIA_FINISHED,
  event => {
    cLogger("[PLAYER UPDATE] MEDIA_FINISHED")
    if(isMainClip){
      removeThumbnail()
      // removeWatchingHistory();
      firstTimePlay = true
    }
    updateWatchAnalytics(0,playbackEvents.STOP);
    // loopMaintain = false;
    broadcastEventToSender(playbackEvents.STOP);
    // updateWatchingHistoryFMS('STOP');
  });
// added by bc 240201
  playerManager.addEventListener(cast.framework.events.EventType.MEDIA_STATUS,
    event => {
      // Write your own event handling code, for example
      // using the event.mediaStatus value
      // Full logic start here to ignore duplicate captions and display full name of caption if it is short name 
      const mediaStatus = event.mediaStatus;
      if (mediaStatus && mediaStatus.media && mediaStatus.media.tracks) {
        const uniqueLanguages = new Set();
        const uniqueArray = [];
        mediaStatus.media.tracks.forEach(obj => {
          // Convert the "type" and "language" values to lowercase for case-insensitive comparison
          const typeLowerCase = obj.type.toLowerCase();
          const languageLowerCase = obj.language.toLowerCase();
          // Check if the type is 'text' and the language is not already in the set
          if (typeLowerCase === 'text' && !uniqueLanguages.has(languageLowerCase)) {
            uniqueLanguages.add(languageLowerCase);
            uniqueArray.push(obj);
          } else if (typeLowerCase !== 'text'  && !uniqueLanguages.has(languageLowerCase)) {
            uniqueArray.push(obj);
            uniqueLanguages.add(languageLowerCase);
            uniqueArray.push(obj);
          }
        });  
        uniqueArray.forEach(obj => {
            const typeLowerCase = obj.type.toLowerCase();
            const fullName = languageMap[obj.name] || obj.name;
            if (typeLowerCase === 'text' && fullName) {
                obj.name = fullName;
            }
        });    
        mediaStatus.media.tracks = uniqueArray;
      }
      // End here. 
    });
playerManager.addEventListener(cast.framework.events.EventType.REQUEST_PLAYBACK_RATE_CHANGE,
  event => {
    let playbackRate = event.requestData.playbackRate || 1;
    let mediaElement = playerElement.getMediaElement();
    mediaElement.playbackRate = playbackRate;
    cLogger("[PLAYER UPDATE] REQUEST_PLAYBACK_RATE_CHANGE")
    updateWatchAnalytics(3,playbackRate)
  });
playerManager.addEventListener(cast.framework.events.EventType.REQUEST_EDIT_TRACKS_INFO,
  event => {
    cLogger("[PLAYER UPDATE] REQUEST_EDIT_TRACKS_INFO")
    cLogger(event)
    if (!event.requestData.activeTrackIds.length) {
      playerManager.broadcastStatus();
    }
    const activeId = event.requestData.activeTrackIds
    const mediaInfo = playerManager.getMediaInformation();
    enableTextTracksByIds(activeId);
    if(activeId.length !== 0 ){
      cLogger("mediaInfo: " + mediaInfo)
      mediaInfo.tracks.forEach(function(item){
        cLogger(item.language)
        if (item.trackId === activeId[0]){
          updateWatchAnalytics(1,item.language)
          return
        }
      });
    }else if(activeId.length === 0){
      updateWatchAnalytics(1,"OFF")
    }
  });
  // playerManager.addEventListener(cast.framework.events.EventType.REQUEST_EDIT_AUDIO_TRACKS,
  //   event => {
  //     cLogger("[PLAYER UPDATE] REQUEST_EDIT_AUDIO_TRACKS")
  //     cLogger(event)
  //   });
playerManager.addEventListener(cast.framework.events.EventType.ERROR,
  event => {
    let errorMessage;
    try {
      errorMessage = JSON.stringify(event.error)
    } catch(e) {
      errorMessage = event.reason;
    }
    cLogger(event.error);
    cLogger(event)
    broadcastEventToSender(playbackEvents.ERROR, {
      errorCode: event.detailedErrorCode,
      errorMessage: errorMessage
    });
    cLogger("[PLAYER UPDATE] ERROR")
    cLogger(event.detailedErrorCode + "   " + errorMessage)
    if(getKCPA() && getKCPA().config !== null && getKCPA().config.watch !== null && getKCPA().config.watch.hasOwnProperty('started')){
      getKCPA().errorWatch(event.detailedErrorCode, errorMessage);
    }
  });
/*** Media Events End ***/
/*** DRM ***/
// Update playback config licenseUrl according to provided value in load request.
playerManager.setMediaPlaybackInfoHandler((loadRequest, playbackConfig) => {
  if (loadRequest.media.customData && loadRequest.media.customData.licenseUrl) {
    playbackConfig.licenseUrl = loadRequest.media.customData.licenseUrl;
  } else if (loadRequest.media && loadRequest.media.contentId) {
    console.log("[DRM] Extracting license URL from manifest");
    console.log("[DRM] Manifest URL:", loadRequest.media.contentId);

    // Extract license URL from the manifest
    const extractLicenseUrl = async (manifestUrl) => {
      try {
        console.log("[DRM] Fetching manifest file...");
        const response = await fetch(manifestUrl);
        const mpdText = await response.text();
        console.log("[DRM] Manifest content length:", mpdText.length);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(mpdText, "application/xml");

        // Look specifically for Widevine ContentProtection
        const widevineProtection = Array.from(
          xmlDoc.getElementsByTagName("ContentProtection")
        ).find(
          (elem) =>
            elem.getAttribute("schemeIdUri") ===
            "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"
        );

        if (widevineProtection) {
          const licenseUrl = widevineProtection.getAttribute(
            "bc:licenseAcquisitionUrl"
          );
          console.log("[DRM] Found Widevine license URL:", licenseUrl);
          return licenseUrl;
        }

        console.log("[DRM] No Widevine license URL found in manifest");
        return null;
      } catch (error) {
        console.log("[DRM] Error extracting license URL:", error);
        return null;
      }
    };

    // Get the manifest URL from contentId
    const manifestUrl = loadRequest.media.contentId;

    // Extract and set the license URL
    extractLicenseUrl(manifestUrl)
      .then((licenseUrl) => {
        if (licenseUrl) {
          console.log("[DRM] Setting license URL:", licenseUrl);
          playbackConfig.licenseUrl = licenseUrl;
      
          playbackConfig.drm = {
            servers: {
              "com.widevine.alpha": licenseUrl,
            },
            streaming: {
              failureCallback: function (error) {
                if (error.code === 6007) {
                  // OPERATION_ABORTED
                  console.error("[DRM] Aborted request, retrying...", error);
                  // Retry logic if needed
                }
              },
            },
          };
        } else {
          console.log(
            "[DRM] Warning: No Widevine license URL found in the manifest"
          );
        }
      })
      .catch((error) => {
        console.log("[DRM] Error in license URL extraction process:", error);
      });
  }
   // Add authentication headers if needed
   if (loadRequest.media.customData && loadRequest.media.customData.jwtToken) {
    playbackConfig.drm = playbackConfig.drm || {};
    playbackConfig.drm.licenseRequestHeaders = {
      "bcov-auth": loadRequest.media.customData.jwtToken
    };
  }
  return playbackConfig;
});
/*** DRM End ***/
/*** Interceptors ***/
// intercept the LOAD request to be able to read in a contentId and get data
playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.LOAD, loadRequestData => {
    /*** Do something to the loadRequestData if necessary ***/
    const customData = loadRequestData.media.customData;
    cLogger(customData)
    if (customData) {
      if (customData.authToken) {
        bcc.authToken = customData.authToken;
      }
      if (customData.graphqlEndpoint) {
        bcc.graphqlEndpoint = customData.graphqlEndpoint;
      }
      if (customData.activeTrackIds) {
        loadRequestData.activeTrackIds = customData.activeTrackIds;
      }
    }
    return loadRequestData;
});
// added by bc 240201
playerManager.setMessageInterceptor(cast.framework.messages.MessageType.LOAD, (loadRequestData) => {
  const mediaInfo = playerManager.getMediaInformation();
  if (!mediaInfo) return;
  try{
    const customData = mediaInfo.customData;
    const activeTrackIds = customData.activeTrackIds || [];
    if (customData.selectedTextTrackLocale) {
      const selectedTextTrackLocale = customData.selectedTextTrackLocale;
      // Find the track with the specified language (selectedTextTrackLocale)
      const matchingTrack = loadRequestData.media.tracks.find(
        (track) => track.language === selectedTextTrackLocale
      );
      if (matchingTrack) {
        // Enable the specified language's track by adding its trackId to activeTrackIds
        activeTrackIds.push(matchingTrack.trackId);
      }
    }
    // Set the modified activeTrackIds back to loadRequestData
    loadRequestData.activeTrackIds = activeTrackIds;
  }catch(err){
    console.log(err);
  }
  return loadRequestData;
});
/*** Interceptors End ***/
/*** Utils ***/
function cLogger(msg) {
  if (ENABLE_DEBUG) {
    console.log(msg);
  }
};
/**
* Injects API calls into the head of a document
* as the src for a img tag
* img is better than script tag for CORS
* @param {string} requestURL The URL to call to send the data
* @return true
*/
const sendData = function(requestURL) {
  let scriptElement = document.createElement("img");
  scriptElement.setAttribute("src", requestURL);
  document.getElementsByTagName("body")[0].appendChild(scriptElement);
  scriptElement.onload = function() {
    scriptElement.remove();
  }
  return true;
}
// send analytics event
const sendAnalyticsEvent = function(eventType, evt) {
  let urlStr = "",
  mediaInfo = playerManager.getMediaInformation(),
  mediaMetadata = mediaInfo.metadata || {},
  mediaCustomData = mediaInfo.customData || {},
  time = evt.timeStamp,
  dateTime = new Date(parseInt(evt.timeStamp)),
  destination = encodeURIComponent(window.location.href),
  source = encodeURIComponent(document.referrer);
  // add params for all requests
  urlStr = "event=" + eventType + 
  "&domain=videocloud&account=" + mediaCustomData.accountId + 
  "&time=" + time + 
  "&destination=" + destination + 
  "&session=" + currentSessionId + 
  "&device_type=other";
  // source will be empty for direct traffic
  if (source !== "") {
    urlStr += "&source=" + source;
  }
  // add params specific to video events
  if (eventType === "video_impression" || eventType === "video_view" || eventType === "video_engagement") {
    urlStr += "&video=" + mediaCustomData.videoId + "&video_name=" + encodeURIComponent(mediaMetadata.title);
  }
  // add params specific to video_engagement events
  if (eventType === "video_engagement" || eventType === "play_request" || eventType === "video_impression") {
    urlStr += "&video_duration=" + mediaCustomData.duration;
    if (eventType === "video_engagement")
      urlStr += "&range=" + evt.range;
  }
  // add the base URL
  urlStr = baseURL + urlStr;
  // make the request
  sendData(urlStr);
  return;
}
const generateUUID = function() {
  return (function() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  })();
}
const sendRequest = function(options) {
  return new Promise((resolve, reject) => {
    options.success = function(data, textStatus, xhr) {
      resolve(data);
    };
    options.error = function(err) {
      reject(err);
    };
    $.ajax(options);
  });
}
const getBaseURL = function(url) {
  let pathArray = url.split( "/" );
  let protocol = pathArray[0];
  let host = pathArray[2];
  return `${protocol}//${host}`;
}
const broadcastEventToSender = function(eventType, data) {
  const mediaInfo = playerManager.getMediaInformation();
  if (!mediaInfo) return;
  const customData = mediaInfo.customData;
  const playerStats = playerManager.getStats();
  let eventData = {
    referenceId: customData.referenceId || "",
    playbackStatus: eventType,
    playbackPosition: playerManager.getCurrentTimeSec(),
    playbackSpeed: playerManager.getPlaybackRate() + "",
    subtitleLanguage: "",
    audioLanguage: "",
    serverName: getBaseURL(mediaInfo.contentId),
    bitrate: `${playerStats.width}x${playerStats.height}@${playerStats.streamBandwidth}`
  };
  if (mediaInfo.tracks && mediaInfo.tracks.length && isMainClip) {
    const textTracksManager = playerManager.getTextTracksManager();
    const audioTracksManager = playerManager.getAudioTracksManager();
    const activeTextTrack = textTracksManager.getActiveTracks().length ? 
    textTracksManager.getActiveTracks()[0] : {};
    const activeAudioTrack = audioTracksManager.getActiveTrack();
    // eventData.subtitleLanguage = activeTextTrack !== {} ? activeTextTrack.language : "";
    eventData.subtitleLanguage = Object.keys(activeTextTrack).length !== 0 ? activeTextTrack.language : "";
    eventData.audioLanguage = activeAudioTrack ? activeAudioTrack.language : "";
  }
  context.sendCustomMessage(
    NAME_SPACE,
    undefined,
    Object.assign(eventData, data)
  );
}
/*** Utils End ***/
const enableAudioTrackByLanguage = function(lang) {
  const audioTracksManager = playerManager.getAudioTracksManager();
  // Set the first matching language audio track to be active
  audioTracksManager.setActiveByLanguage(lang);
};
const enableAudioTrackById = function(id) {
  const audioTracksManager = playerManager.getAudioTracksManager();
  // Set the first matching language audio track to be active
  audioTracksManager.setActiveById(id);
};
const enableTextTrackByLanguage = function(lang) {
  const textTracksManager = playerManager.getTextTracksManager();
  // Set the first matching language text track to be active
  textTracksManager.setActiveByLanguage(lang);
};
const enableTextTracksByIds = function(ids) {
  const textTracksManager = playerManager.getTextTracksManager();
  // Set the first matching language text track to be active
  try{
    textTracksManager.setActiveByIds(ids);
  }catch(e){
    return
  }
};
const playbackConfig = new cast.framework.PlaybackConfig();
// Sets the player to start playback as soon as there are five seconds of
// media contents buffered. Default is 10.
playbackConfig.autoResumeDuration = 5;
/**
 * A function to customize request to get a caption segment.
 * captionsRequestHandler is not supported for Shakaplayer. Its value will be ignored. 
 *
 * @param {cast.framework.NetworkRequestInfo} networkReqInfo HTTP(s) Request/Response information.
 */
// playbackConfig.captionsRequestHandler = function(networkReqInfo) {
// };
/**
 * Handler to process license data. The handler is passed the license data, and returns the modified license data.
 *
 * @param {Uint8Array} licenseData license data
 * @return {Uint8Array}
 */
playbackConfig.licenseHandler = function(licenseData) {
  return licenseData;
};
/**
 * A function to customize request to get a license.
 *
 * @param {cast.framework.NetworkRequestInfo} networkReqInfo HTTP(s) Request/Response information.
 */
playbackConfig.licenseRequestHandler = function(networkReqInfo) {
  const customData = playerManager.getMediaInformation().customData;
  networkReqInfo.headers["bcov-auth"] = customData.jwtToken;
};
/**
 * Handler to process manifest data. The handler is passed the manifest, and returns the modified manifest.
 *
 * @param {String} manifest The manifest string
 * @return {String}
 */
playbackConfig.manifestHandler = function(manifest) {
  return manifest;
};
/**
 * A function to customize request to get a manifest.
 *
 * @param {cast.framework.NetworkRequestInfo} networkReqInfo HTTP(s) Request/Response information.
 */
playbackConfig.manifestRequestHandler = function(networkReqInfo) {
};
/**
 * Handler to process segment data. The handler is passed the segment data, and returns the modified segment data.
 *
 * @param {Uint8Array} segment The original segment
 * @return {Uint8Array}
 */
playbackConfig.segmentHandler = function(segment) {
  return segment;
};
/**
 * A function to customize request information to get a media segment.
 *
 * @param {cast.framework.NetworkRequestInfo} networkReqInfo HTTP(s) Request/Response information.
 */
playbackConfig.segmentRequestHandler = function(networkReqInfo) {
};
//context.start({queue: myCastQueue, playbackConfig: playbackConfig});
context.start({
  playbackConfig: playbackConfig,
});