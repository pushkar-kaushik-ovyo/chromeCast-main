bcc.queries.WATCHITEM_MUTATION = `mutation watchItem($extId:String!, $progress:Float) {
  watchItem(extId:$extId, progress:$progress){
    watchItem {
      id
      episode {
        extId
      }
      userId
      updatedAt
      progress
    }
  }
}`;

bcc.queries.REMOVEWATCHITEM_MUTATION = `mutation removeWatchItem($input: WatchItemInput!) {
  removeWatchItem(input: $input) {
    totalCount
  }
}`