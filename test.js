import React, { useState, useEffect, useRef, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import shaka from "shaka-player";

import {
  getStorageItem,
  isContentPGLocked,
  setStorageItem,
} from "../../utils/utils";
import getLanguageCode from "../../utils/languageMapper";
import useRemoteKeyEvent from "../../hooks/useRemoteKeyEvent";
import * as Catalog from "../../utils/BrightcoveCatalog";
import useFocusParent from "../../hooks/useFocusParent";
import { makeRequest } from "../../utils/fetchData";
import SubtitleSettings from "./SubtitleSettings";
import Modal from "../../components/Modals/Modal";
import PlayerControls from "./PlayerControl";
import { AstroBBCContext } from "../../App";
import AutoPlay from "../Player/Autoplay";
import PinEntry from "./PinEntry";
import LoadingSpinner from "../../assets/icons/loading-icon.png";

import "./Player.css";

const Player = ({ hasFocus, bubbleFocusUP, changeFocusOwnerApp }) => {
  const ccTranslated = {
    WebkitTransform: "translate(0px, -0px)",
    transform: "translate(0px, 0px)",
    position: "relative",
  };

  const ccNormal = {
    WebkitTransform: "translate(0px, 0px)",
    transform: "translate(0px, 0px)",
    position: "relative",
  };

  const SKIP_AMOUNT = 10;
  const playerRef = useRef(null);
  const [paused, setPaused] = useState(false);
  let navigate = useNavigate();
  const { state } = useLocation() || {};
  const { source } = state || {};
  const [metadata, setMetaData] = useState(state?.metadata || {});
  const [videoURL, setVideoURL] = useState("");
  const [licenseURL, setLicenseURL] = useState("");
  const [player, setPlayer] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const showOverlayRef = useRef();
  const timerRef = useRef(null);
  const updateTimerRef = useRef(null);
  const [restartTimer, setRestartTimer] = useState(false);
  const [percent, setPercent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [autoBlocked, setAutoBlocked] = useState(false);
  const [userChosenCC, setUserChosenCC] = useState("none");
  const [ccLanguageList, setCCLanguageList] = useState([]);
  const [showAutoplay, setShowAutoplay] = useState(false);
  const [isAutoPlaySession, setIsAutoPlaySession] = useState(false);
  const [nextItem, setNextItem] = useState(null);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [contentItem, setContentItem] = useState();
  const AstroContext = useContext(AstroBBCContext);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playerReady, setPlayerReady] = useState(false);
  const [ccStyle, setCCStyle] = useState(ccNormal);
  const [showAudioSettings, setAudioSettings] = useState(false);
  const [userChosenAudio, setUserChosenAudio] = useState("en");
  const [audioLanguageList, setAudioLanguageList] = useState(["en"]);
  const [isLivePlayer, setIsLivePlayer] = useState(
    state?.isLivePlayer ? true : false
  );
  const contentItemRef = useRef();
  const [isLoading, setIsLoading] = useState(true);
  const durationRefInMs = useRef();

  useEffect(() => {
    const refreshUrl = `${process.env.REACT_APP_MIDDLEWARE_URL}/evergent/bbc/refreshToken`;
    const refreshBody = {
      RefreshTokenRequestMessage: {
        grantType: "refresh_token",
        refreshToken: AstroContext.auth.getRefreshToken(),
        operator: "astro",
      },
    };
    makeRequest(refreshUrl, "POST", refreshBody)
      .then((data) => {
        if (
          data &&
          data.RefreshTokenRequestMessage &&
          data.RefreshTokenRequestMessage.responseCode !== "1"
        ) {
          let currentEpochTime =
            Math.floor(new Date().getTime() / 1000) + parseInt(data.expiresIn);
          let userSignInInfo = { ...data, expiresInEpoch: currentEpochTime };
          setStorageItem(
            "astro-bbc-user-info",
            userSignInInfo,
            false,
            true,
            false
          );
        }
      })
      .catch((err) => console.log(err));
  }, []);

  const handlePlayButtonClickWithHiddenControls = (e) => {
    if (
      !showOverlayRef.current &&
      e.keyCode === 13 &&
      playerRef.current.paused
    ) {
      setIsLoading(true);
      play();
    }
  };
  useEffect(() => {
    document.addEventListener(
      "keydown",
      handlePlayButtonClickWithHiddenControls
    );
    const video = playerRef.current;
    if (video) {
      video.addEventListener("timeupdate", onPlayerProgress);
      // event not firing
      // video.addEventListener('oncanplay', onPlayerReady);
      video.addEventListener("ended", onVideoEnded);

      return () => {
        video.removeEventListener("timeupdate", onPlayerProgress);
        video.removeEventListener("oncanplay", onPlayerReady);
        video.removeEventListener("ended", onVideoEnded);
        document.removeEventListener(
          "keydown",
          handlePlayButtonClickWithHiddenControls
        );
      };
    }
  }, []);

  useEffect(() => {
    let videoElements = document.getElementsByTagName("video");
    if (videoElements.length > 0) {
      const videoElement = videoElements[0];

      if (videoElement) {
        const existingTracks = videoElement.querySelectorAll("track");
        existingTracks.forEach((track) => videoElement.removeChild(track));

        subtitleTracks.forEach((track) => {
          const trackElement = document.createElement("track");
          trackElement.kind = track.kind;
          trackElement.srclang = track.srclang;
          trackElement.src = track.src;
          trackElement.default = false;
          videoElement.appendChild(trackElement);
        });
      }
    }
  }, [subtitleTracks]);

  const configureClosedCaptions = (availableTextTracks) => {
    let availableTracks = [];
    let availableCCs = [];
    let supportedLanguages = getStorageItem("supportedLanguages", true, true);
    supportedLanguages = supportedLanguages?.subtitle?.map((e) => e.iso1);

    availableTextTracks.forEach((textTrack) => {
      if (
        textTrack.sources !== null &&
        textTrack.kind === "captions" &&
        supportedLanguages.includes(textTrack.srclang)
      ) {
        let newTrack = {
          kind: "subtitles",
          srclang: textTrack.srclang,
          src: textTrack.sources[0].src.replace("http", "https"),
          default: true,
        };
        availableTracks.push(newTrack);
        if (
          !availableCCs.includes(textTrack.srclang) &&
          textTrack.srclang !== ""
        ) {
          availableCCs.push(textTrack.srclang);
        }
      }
    });

    setSubtitleTracks(availableTracks);
    setCCLanguageList(availableCCs);
  };

  const forceShowCCOnVideoNode = () => {
    var videoTags = document.getElementsByTagName("video");
    if (videoTags[0] !== undefined) {
      let subtitleSettings = getStorageItem("settings", true, true);
      if (videoTags[0].textTracks !== undefined) {
        let tracks = videoTags[0].textTracks;
        let track_language;
        let chosenCC = "";
        if (subtitleSettings !== null && subtitleSettings.subtitle === "On") {
          chosenCC = getLanguageCode(subtitleSettings.language);
        }
        for (let i = 0; i < tracks.length; i++) {
          track_language = tracks[i].language.substr(0, 2);

          if (chosenCC !== "" && track_language === chosenCC) {
            setUserChosenCC(track_language);
            tracks[i].mode = "showing";
            break;
          }
        }
      }
    }
  };

  const getContentMetadata = async (meta) => {
    try {
      let accessToken = AstroContext.userData.accessToken;
      const playbackMetaURL = `${process.env.REACT_APP_MIDDLEWARE_URL}/playback/metadata/${meta.id}`;

      if (isLivePlayer) {
        const response = await Catalog.getLiveVideo(meta.id, accessToken);
        setVideoURL(response.sources[0].src);
        let textTracksSrc = response?.text_tracks || [];
        if (textTracksSrc.length > 0) {
          configureClosedCaptions(textTracksSrc);
        }
        return;
      }

      fetch(playbackMetaURL, {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }).then(async (res) => {
        const data = await res.json();
        setContentItem(data.data.contentItem);
        contentItemRef.current = data?.data?.contentItem;
        if (data.data.contentItem.next !== null) {
          setNextItem(data.data.contentItem.next);
          setAutoBlocked(false);
        } else {
          setNextItem(null);
          setAutoBlocked(true);
        }

        const response = await Catalog.getVideo(data.data.contentItem.extId);
        const { duration = 0 } = response || {};
        durationRefInMs.current = duration;
        const licenseUrl = response?.sources[2]?.key_systems
          ? response?.sources[2]?.key_systems[
              "com.widevine.alpha"
            ]?.license_url?.replace("httpss", "https")
          : "";
        setLicenseURL(licenseUrl);
        setVideoURL(response?.sources[2]?.src?.replace("http", "https"));

        let textTracksSrc = response?.text_tracks || [];
        if (textTracksSrc.length > 0) {
          configureClosedCaptions(textTracksSrc);
        }
      });
    } catch (error) {
      console.error("Error fetching video data:", error);
    }
  };

  useEffect(() => {
    if (metadata) {
      getContentMetadata(metadata);
    }
  }, [metadata]);

  useEffect(() => {
    const initPlayer = async () => {
      const video = playerRef.current;
      if (!video) return;

      const shakaPlayer = new shaka.Player(video);
      window.shakaPlayer = shakaPlayer;
      window.player = playerRef.current;

      setPlayer(shakaPlayer);

      shakaPlayer.addEventListener("loading", () => {
        console.log("loading video event fire");
        setIsLoading(true); // Show loader when the video is loading
      });

      shakaPlayer.addEventListener("loaded", () => {
        const durationInSeconds = parseFloat(
          (durationRefInMs.current / 1000).toFixed(2)
        );
        const continueWatchTimeForPlayer = Math.floor(
          metadata.progress * durationInSeconds
        );
        console.log("loaded video event fire");
        setTimeout(() => {
          playerRef.current.currentTime = continueWatchTimeForPlayer;
        }, 1000);

        setIsLoading(true); // Show loader when the video is loading
      });

      shakaPlayer.addEventListener("buffering", (event) => {
        console.log("buffering video event fire");
        console.log("Buffering:", event.buffering);
      });
      shakaPlayer.addEventListener("waiting", (event) => {
        console.log("waiting video event fire");
        console.log("Buffering:", event.buffering);
      });

      shakaPlayer.addEventListener("trackschanged", (event) => {
        console.log("Tracks changed:", event);
      });

      shakaPlayer.addEventListener("adaptation", (event) => {
        console.log("Adaptation event:", event);
      });

      shakaPlayer.addEventListener("streaming", (event) => {
        console.log("streaming video event fire");
        console.log("Streaming started:", event);
      });

      shakaPlayer.addEventListener("playing", (event) => {
        console.log("playing video event fire", "shaka object");
      });

      shakaPlayer.addEventListener("unloading", (event) => {
        console.log("Player is unloading:", event);
      });

      shakaPlayer.addEventListener("loading", onPlayerReady);

      video.addEventListener("playing", () => {
        console.log("playing video event fire");
        setIsLoading(false); // Show loader when the video is loading
        console.log("Video is playing");
      });
      shakaPlayer.addEventListener("error", onError);

      if (isLivePlayer) {
        shakaPlayer.configure({
          streaming: {
            allowMediaSourceRecoveries: true,
            alwaysStreamText: false,
            avoidEvictionOnQuotaExceededError: false,
            bufferBehind: 5,
            bufferingGoal: 30,
            clearDecodingCache: false,
            crossBoundaryStrategy: "keep",
            disableAudioPrefetch: false,
            disableTextPrefetch: false,
            disableVideoPrefetch: false,
            dontChooseCodecs: false,
            durationBackoff: 1,
            evictionGoal: 1,
            gapDetectionThreshold: 0.5,
            gapJumpTimerTime: 0.25,
            gapPadding: 0,
            ignoreTextStreamFailures: false,
            inaccurateManifestTolerance: 2,
            infiniteLiveStreamDuration: false,
            liveSync: {
              dynamicTargetLatency: {
                enabled: false,
                maxAttempts: 10,
                maxLatency: 4,
                minLatency: 1,
                rebufferIncrement: 0.5,
                stabilityThreshold: 60,
              },
              enabled: false,
              maxPlaybackRate: 1.1,
              minPlaybackRate: 0.95,
              panicMode: false,
              panicThreshold: 60,
              targetLatency: 0.5,
              targetLatencyTolerance: 0.5,
            },
            loadTimeout: 30,
            lowLatencyMode: false,
            maxDisabledTime: 30,
            minTimeBetweenRecoveries: 5,
            observeQualityChanges: false,
            preferNativeDash: false,
            preferNativeHls: true,
            preloadNextUrlWindow: 30,
            rebufferingGoal: 5,
            safeSeekEndOffset: 0,
            safeSeekOffset: 5,
            segmentPrefetchLimit: 1,
            shouldFixTimestampOffset: false,
            stallEnabled: true,
            stallSkip: 0.1,
            stallThreshold: 1,
            startAtSegmentBoundary: false,
            updateIntervalSeconds: 1,
            useNativeHlsOnSafari: true,
            useNativeHlsForFairPlay: false,
            vodDynamicPlaybackRate: false,
            vodDynamicPlaybackRateBufferRatio: 0.5,
            vodDynamicPlaybackRateLowBufferRate: 0.95,
          },
          manifest: {
            availabilityWindowOverride: NaN,
            continueLoadingWhenPaused: true,
            defaultPresentationDelay: 0,
            disableAudio: false,
            disableIFrames: false,
            disableText: false,
            disableThumbnails: false,
            disableVideo: false,
            hls: {
              allowLowLatencyByteRangeOptimization: true,
              allowRangeRequestsToGuessMimeType: false,
              defaultAudioCodec: "mp4a.40.2",
              defaultVideoCodec: "avc1.42E01E",
              disableClosedCaptionsDetection: false,
              disableCodecGuessing: false,
              ignoreImageStreamFailures: false,
              ignoreManifestProgramDateTime: false,
              ignoreManifestTimestampsInSegmentsMode: false,
              ignoreTextStreamFailures: false,
              liveSegmentsDelay: 3,
              mediaPlaylistFullMimeType:
                'video/mp2t; codecs="avc1.42E01E, mp4a.40.2"',
              sequenceMode: false,
              useSafariBehaviorForLive: true,
            },
            ignoreDrmInfo: false,
            ignoreSupplementalCodecs: false,
            raiseFatalErrorOnManifestUpdateRequestFailure: false,
            segmentRelativeVttTiming: false,
            updatePeriod: -1,
          },
        });
      }

      // Configure DRM

      if (licenseURL) {
        shakaPlayer.configure({
          drm: {
            servers: {
              "com.widevine.alpha": licenseURL,
            },
          },
          streaming: {
            failureCallback: function (error) {
              if (error.code === shaka.util.Error.Code.OPERATION_ABORTED) {
                console.error("Aborted request, retrying...", error);
                shakaPlayer.retryStreaming();
              }
            },
          },
        });
      }

      try {
        console.log("Attaching player to video element");
        await shakaPlayer.attach(video);

        console.log("Loading video URL: " + videoURL);
        await shakaPlayer.load(videoURL);

        console.log("The video has now been loaded!");

        const audioTracks = shakaPlayer.getAudioLanguagesAndRoles();
        console.log("audio Tracks:", audioTracks);

        if (audioTracks) {
          let supportedLanguages = getStorageItem(
            "supportedLanguages",
            true,
            true
          );
          supportedLanguages = supportedLanguages?.audio?.map((e) => e.iso1);

          const supportedAudio = audioTracks
            .map((track) => track.language)
            .filter(
              (language) =>
                language === "en" || supportedLanguages.includes(language)
            );

          setAudioLanguageList(supportedAudio);

          let chosenAudio = getStorageItem("settings", true, true)?.audio;
          chosenAudio = getLanguageCode(chosenAudio);
          if (supportedAudio.includes(chosenAudio)) {
            shakaPlayer.selectAudioLanguage(chosenAudio);
            setUserChosenAudio(chosenAudio);
          }
        }

        let localSettings = getStorageItem("pinSettings", true, true);
        if (
          !isAutoPlaySession &&
          localSettings !== null &&
          isContentPGLocked(localSettings.ratingToSave, "0")
        ) {
          //pause
          togglePlay();
          //and show pin entry page, while blocking key presses to other elements
          setShowOverlay(false);
          showOverlayRef.current = false;
          setShowPinEntry(true);
          setSuppressed(true);
          changeFocusOwner("PinEntry");
        } else {
          //pause then play is required because STB doesn't let you play the video when player is autoplay mode
          video.pause();

          video.muted = false;
          video.play();
        }

        setTimeout(() => {
          //force show cc on html video node, since STB doesn't do this automatically
          forceShowCCOnVideoNode();
        }, 250);
      } catch (error) {
        onError(error);
      }
    };

    const onError = (error) => {
      console.error("Error code", error.code, "object", error);
      if (error.detail) {
        console.error("Shaka error details:", error.detail);
      }
    };

    shaka.polyfill.installAll();

    if (shaka.Player.isBrowserSupported()) {
      if (videoURL) {
        initPlayer();
      }
    } else {
      console.error("Browser not supported!");
    }
  }, [videoURL, licenseURL]);

  // commented this code because video was starting from 0 then video was shifting to continuewatch time
  // useEffect(() => {
  //   if (metadata && metadata.progress !== null && playerRef.current && metadata.progress && playerReady && duration) {
  //     // playerRef.current.currentTime = Math.floor(metadata.progress * duration)
  //     debugger
  //   }
  // }, [videoURL, playerReady, duration])

  useEffect(() => {
    if (showOverlay) {
      setCCStyle(ccTranslated);
    } else {
      setCCStyle(ccNormal);
    }
  }, [showOverlay]);

  useEffect(() => {
    return () => clearTimeout(updateTimerRef.current);
  }, []);

  useEffect(() => {
    if (hasFocus) {
      console.log("player gained focus");
      changeFocusOwner("PinEntry");
    } else {
      console.log("player remove");
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
      changeFocusOwner("");
      setUnHandledAction("");
    }
  }, [hasFocus]);

  const [keyState, setFocus, setSuppressed] = useRemoteKeyEvent(
    [
      "OK",
      "FORWARD",
      "PLAY",
      "REVERSE",
      "RIGHT",
      "LEFT",
      "UP",
      "DOWN",
      "STOP",
      "BACK",
    ],
    bubbleFocusUP,
    !showOverlay
  );

  let focusNavMap = {
    PlayerControls: {
      BACK: source,
    },
  };

  const [
    currentFocusOwner,
    setFocusRequest,
    changeFocusOwner,
    unhandledAction,
    setUnHandledAction,
  ] = useFocusParent("", focusNavMap, false, changeFocusOwnerApp);

  function fastForward() {
    skip(1);
  }

  function rewind() {
    skip(-1);
  }

  function skip(direction) {
    if (!playerRef || !playerRef.current) return;
    resetTimer();
    let currentTime = playerRef.current.currentTime;
    let skipAmount = SKIP_AMOUNT;
    if (direction < 0) {
      skipAmount *= -1;
    }
    playerRef.current.currentTime = Math.max(0, currentTime + skipAmount);
  }

  const play = async () => {
    if (playerRef && playerRef.current) {
      if (isLivePlayer) {
        let seekRange = player?.seekRange();

        if (seekRange && seekRange.end !== 0) {
          playerRef.current.currentTime = seekRange.end;
        }
      }

      playerRef.current.play();
      setPaused(false);
    }
  };

  const pause = () => {
    if (playerRef && playerRef.current) {
      playerRef.current.pause();
      if (!playerRef.current.paused) {
        pause();
      }
      setPaused(true);
    }
  };

  const togglePlay = () => {
    if (playerRef && playerRef.current) {
      if (playerRef.current.paused) {
        play();
      } else {
        pause();
      }
    }
    if (playbackRate !== 1) {
      setPlaybackRate(1);
    }
  };

  useEffect(() => {
    changeFocusOwner("PlayerControl");

    if (
      keyState.OK ||
      keyState.UP ||
      keyState.LEFT ||
      keyState.RIGHT ||
      keyState.DOWN
    ) {
      setShowOverlay(true);
      showOverlayRef.current = true;
      //changeFocusOwner("PlayerControl")
    }

    if (keyState.PLAY) {
      togglePlay();
    }

    if (keyState.FORWARD) {
      setShowOverlay(true);
      showOverlayRef.current = true;
      fastForward();
    }

    if (keyState.REVERSE) {
      setShowOverlay(true);
      showOverlayRef.current = true;
      rewind();
    }

    if (keyState.STOP) {
      // Cleanup the video element if it exists
      console.log(" AstroKeyEvent STOP");
      if (player) {
        try {
          console.log("Going to call detach player");
          player.detach();
        } catch (error) {
          console.error("Error destroying Shaka player:", error);
        }
      }

      if (playerRef && playerRef.current) {
        try {
          const video = playerRef.current;
          video.pause();
          video.load(); // Reload the video element to clear the previous source
          video.remove(); // Remove the video element from the DOM
        } catch (error) {
          console.error("Error cleaning up video element:", error);
        }
      }
      bubbleFocusUP({ relieveFocus: true, action: "BACK" });
    }

    if (keyState.BACK) {
      console.log(" AstroKeyEvent STOP");
      if (player) {
        try {
          console.log("Going to call detach player");
          player.detach();
        } catch (error) {
          console.error("Error destroying Shaka player:", error);
        }
      }

      if (playerRef && playerRef.current) {
        try {
          const video = playerRef.current;
          video.pause();
          video.load(); // Reload the video element to clear the previous source
          video.remove(); // Remove the video element from the DOM
        } catch (error) {
          console.error("Error cleaning up video element:", error);
        }
      }
      bubbleFocusUP({ relieveFocus: true, action: "BACK" });
    }
  }, [keyState]);

  useEffect(() => {
    if (unhandledAction !== "") {
      bubbleFocusUP({ relieveFocus: true, action: unhandledAction.action });
    }
  }, [unhandledAction]);

  useEffect(() => {
    if (showOverlay) {
      console.log("restat timer");
      setRestartTimer(false);
      timerRef.current = setTimeout(() => {
        if (!showSubtitleSettings && !showAudioSettings) {
          setShowOverlay(false);
          showOverlayRef.current = false;
          changeFocusOwner("");
          setFocus();
        } else {
          resetTimer();
        }
      }, 3000);
      return () => clearTimeout(timerRef.current);
    }
  }, [showOverlay, restartTimer]);

  function resetTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setRestartTimer(true);
    }
  }

  const toggleSubtitleDisplay = () => {
    setShowSubtitleSettings(!showSubtitleSettings);
    if (!showSubtitleSettings) {
      var videoTags = document.getElementsByTagName("video");
      let track_language = "";
      if (videoTags[0] !== undefined && videoTags[0].textTracks !== undefined) {
        let tracks = videoTags[0].textTracks;
        for (let i = 0; i < tracks.length; i++) {
          track_language = tracks[i].language.substr(0, 2);
          console.log(track_language);
          if (tracks[i].mode === "showing") {
            setUserChosenCC(track_language);
          }
        }
      }
      pause();
      changeFocusOwner("SubtitleSettings");
    } else {
      setIsLoading(true);
      play();
      changeFocusOwner("PlayerControl");
    }
  };

  const toggleAudioDisplay = () => {
    setAudioSettings(!showAudioSettings);
    if (!showAudioSettings) {
      pause();
      changeFocusOwner("AudioSettings");
    } else {
      play();
      changeFocusOwner("PlayerControl");
    }
  };

  function enableCC(language) {
    var videoTags = document.getElementsByTagName("video");
    setUserChosenCC(language);
    let tracks = videoTags[0].textTracks;
    console.log(tracks);

    for (let i = 0; i < tracks.length; i++) {
      let track_language = tracks[i].language;
      if (track_language === language) {
        tracks[i].mode = "showing";
      } else {
        tracks[i].mode = "disabled";
      }
    }
  }

  function enableAudio(language) {
    setUserChosenAudio(language);
    player.selectAudioLanguage(language);
  }

  function triggerAutoPlay() {
    if (!showAutoplay && !autoBlocked) {
      let autoPlaySettings = getStorageItem("settings", true, true);
      // local stored settings could be null, in that case we want to turn on autoplay
      // which is why we are checking for No
      let autoPlayOn = autoPlaySettings?.autoplay !== "No";
      if (autoPlayOn) {
        setShowAutoplay(true);
        setIsAutoPlaySession(true);
        changeFocusOwner("Autoplay");
        setSuppressed(true);
      }
    }
  }

  const playNext = () => {
    if (nextItem !== null) {
      setMetaData(nextItem);
      setShowAutoplay(false);
      pause();
    } else {
      setShowAutoplay(false);
    }
    setSuppressed(false);
  };

  const closeAutoPlay = () => {
    setShowAutoplay(false);
    setSuppressed(false);
    setAutoBlocked(true);
  };

  const onPinVerify = () => {
    setShowPinEntry(false);
    setIsOpen(true);
    setShowOverlay(false);
    showOverlayRef.current = false;
  };

  function PGWarnClosed() {
    setIsOpen(false);
    setSuppressed(false);
    play();
  }

  function PGWarnBacked() {
    bubbleFocusUP({ relieveFocus: true, action: "BACK" });
  }

  const onPlayerProgress = () => {
    //do stuff that needs to be done on progress
    if (playerRef && playerRef.current) {
      checkAutoPlay();
      setDuration(playerRef.current.duration);
      setPercent(playerRef.current.currentTime / playerRef.current.duration);
      if (!updateTimerRef.current) {
        console.log("update trigger");
        updatePlayerProgress();
      }
    }
  };

  function onPlayerReady() {
    console.log("loading video event fire");
    if (!playerReady) {
      setPlayerReady(true);
    }
  }

  function updatePlayerProgress() {
    clearTimeout(updateTimerRef.current);
    if (!playerRef) return;

    updateTimerRef.current = null;
    updateTimerRef.current = setTimeout(() => {
      if (contentItemRef.current) {
        console.log("update player progress");
        if (playerRef.current) {
          AstroContext.auth.updatePlayerProgress(
            contentItemRef.current,
            playerRef.current.currentTime / playerRef.current.duration
          );
        }
        updatePlayerProgress();
      }
    }, 3000);
  }

  const checkAutoPlay = () => {
    if (!playerRef || !playerRef.current) return;

    setDuration(playerRef.current.duration);
    setPercent(playerRef.current.currentTime / playerRef.current.duration);
    if (
      Math.ceil(playerRef.current.duration - playerRef.current.currentTime) ===
        SKIP_AMOUNT &&
      !showAutoplay
    ) {
      triggerAutoPlay();
    }
  };

  const onVideoEnded = () => {
    console.log("VIDEO ENDED");
    let autoPlaySettings = getStorageItem("settings", true, true);
    // local stored settings could be null, in that case we want to turn on autoplay
    // which is why we are checking for No
    let autoPlayOn = false;
    if (
      autoPlaySettings &&
      autoPlaySettings.autoplay &&
      autoPlaySettings.autoplay !== "No"
    ) {
      autoPlayOn = true;
    }
    let videoEnded = true;
    //handle the case where this event is fired incorrectly by the player
    if (
      playerRef &&
      playerRef.current &&
      playerRef.current.duration - playerRef.current.currentTime > SKIP_AMOUNT
    ) {
      videoEnded = false;
    }

    if ((!nextItem || !autoPlayOn) && videoEnded) {
      bubbleFocusUP({ relieveFocus: true, action: "BACK" });
    }
  };

  const { currentProgram, liveItemDetails } = metadata || {};

  console.log({ isLoading });

  return (
    <React.Fragment>
      <div className="player-container">
        {isLoading && (
          <div className="loader-overlay">
            <img className="player-loading-screen-icon " src={LoadingSpinner} />
          </div>
        )}
        <video
          ref={playerRef}
          style={{ width: "1920px", height: "1080px", ...ccStyle }}
        ></video>
      </div>
      {!isLoading && showOverlay && (
        <div className="player-overlay">
          <div className="player-control-abs-container">
            <PlayerControls
              hasFocus={currentFocusOwner === "PlayerControl"}
              bubbleFocusUP={setUnHandledAction}
              skip={skip}
              togglePlay={togglePlay}
              duration={duration}
              paused={paused}
              resetTimer={resetTimer}
              showCCSettings={toggleSubtitleDisplay}
              toggleAudioDisplay={toggleAudioDisplay}
              percent={percent}
              player={player}
              playerRef={playerRef}
              enableAudioButton={audioLanguageList.length > 1}
              isLivePlayer={isLivePlayer}
              settingsOverLay={showAudioSettings || showSubtitleSettings}
            />
          </div>
          <div className="player-tile-details-container">
            <p className="details-title">
              {metadata?.tile?.header ||
                metadata?.slide?.header ||
                currentProgram?.name ||
                liveItemDetails?.name ||
                metadata?.name}
            </p>
            <p className="details-subtitle">
              {metadata?.tile?.subHeader || metadata?.slide?.subHeader}
            </p>
          </div>
        </div>
      )}
      {showSubtitleSettings && (
        <div className="subtitle-settings-abs-container">
          <SubtitleSettings
            hasFocus={currentFocusOwner === "SubtitleSettings"}
            bubbleFocusUP={setUnHandledAction}
            closeCCSettings={toggleSubtitleDisplay}
            availCCs={ccLanguageList}
            enableCC={enableCC}
            chosenCC={userChosenCC}
          />
        </div>
      )}
      {showAudioSettings && (
        <div className="subtitle-settings-abs-container">
          <SubtitleSettings
            hasFocus={currentFocusOwner === "AudioSettings"}
            bubbleFocusUP={setUnHandledAction}
            closeCCSettings={toggleAudioDisplay}
            availCCs={audioLanguageList}
            enableCC={enableAudio}
            chosenCC={userChosenAudio}
            isAudio={true}
          />
        </div>
      )}
      {showAutoplay && nextItem !== null && (
        <div className="autoplay-abs-container">
          <AutoPlay
            hasFocus={currentFocusOwner === "Autoplay"}
            bubbleFocusUP={setUnHandledAction}
            onFinish={playNext}
            onCancel={closeAutoPlay}
            item={nextItem}
          />
        </div>
      )}
      {showPinEntry && (
        <div className="player-pin-entry-abs-container">
          <PinEntry
            hasFocus={currentFocusOwner === "PinEntry"}
            bubbleFocusUP={setUnHandledAction}
            onVerify={onPinVerify}
          />
        </div>
      )}
      <Modal
        open={isOpen}
        hasFocus={isOpen}
        onClose={PGWarnClosed}
        showBtwo={true}
        buttonOneText={"Continue"}
        buttonTwoText={"Go Back"}
        onCancel={PGWarnBacked}
        title={"Warning"}
        subtitle={
          metadata?.certification?.name !== null
            ? metadata?.certification?.name
            : ""
        }
        subtitleDesc={
          metadata?.certification?.description !== null
            ? metadata?.certification?.description
            : ""
        }
        fullScreen={true}
      ></Modal>
    </React.Fragment>
  );
};

export default Player;
