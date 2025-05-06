# KCP-CAF-Receiver
KCP CAF Chromecast Receiver

## Custom Data Needed from Sender
Custom data can be added to the media object for both Android and iOS, here are the references:
https://developers.google.com/android/reference/com/google/android/gms/cast/MediaInfo#public-jsonobject-getcustomdata
https://developers.google.com/cast/docs/reference/ios/interface_g_c_k_media_information#af083a52abe5d4da48cddec65f738246d


1. `accountId` The account id for your video cloud account
1. `videoId` The video id for the current asset.
1. `duration` The duration for the current asset.
1. `referenceId` The reference id for the current asset.
1. `extId` The content item id for the current asset.
1. `graphqlEndpoint` The graphql endpoint to use, ie. https://middleware.kcp.brightcove-qa.services/graphql.
1. `authToken` The auth token to be used for graphql request.
1. `jwtToken` The jwt token to be used for brightcove auth header.

## Additional implementation on Sender side.
1. Implement a custom message listener with name space `urn:x-cast:bc.cast.kcp` as a KCP analytics event listener.
2. Response to Sender for KCP analytics events will be an object with following fields
```
{
  referenceId,
  playbackStatus,
  playbackPosition,
  playbackSpeed,
  subtitleLanguage,
  audioLanguage,
  serverName,
  bitrate,
  errorCode,
  errorMessage,
}
```
