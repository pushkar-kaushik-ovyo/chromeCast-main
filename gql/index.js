let bcc = {};
bcc.queries = {};
bcc.graphqlEndpoint = "xxx"
bcc.authToken = "xxxx";
bcc.sendGraphQLRequest = function(query, variables) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    var qBody = {
      query: query
    };
    if (variables) qBody.variables = variables;
    
    xhr.open("POST", bcc.graphqlEndpoint, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (bcc.authToken) xhr.setRequestHeader("Authorization", `Bearer ${bcc.authToken}`);
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
    xhr.send(JSON.stringify(qBody));
  });
};