var fetch = require('node-fetch');
var fs = require('fs');
var async = require('async-polling');

// Constants
var baseUrl = 'https://api.experienteventbit.com/';

/**
 * Follows instructions at https://api.experienteventbit.com/docs/
 * to sign in appropriately.
 */
function getAuth() {
  authUrl = baseUrl + 'API/AuthUser';

  credentials = { Username: process.env.experientUsername, Password: process.env.experientPassword };

  authOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  };

  return [ authUrl, authOpts ];

}

function grab(authString) {
  return new Promise(function(resolve, reject) {
    url = baseUrl + 'api/event/EDU161/RptSessionPerformance?IsAttendeeOnly=true&IsNotBoothPersonnel=true&IsNotEstimated=false&IsRegistered=false&IsVerified=false&RangeStart=2016-10-27T19:56:25.000Z&RangeEnd=2016-10-27T20:11:25.000Z';

    opts = {
      headers: { 'X-AUTH-CLAIMS': authString }
    };

    console.log('Attempting to authenticate with header ' + authString);

    fetch(url, opts)
      .then(function(response) {
        if (response.status == 200) {
          var dest = fs.createWriteStream('public/data/traffic.json');
          response.body.pipe(dest);
          console.log('Successfully wrote new JSON.');
          resolve(); // @todo: Add timestamp
        }

        else if (response.status == 400) {
          console.log('Authentication needed.');
          reject();
        }

      });
  });
}

var authString = '';

var polling = async(function(end) {
  console.log(authString);

  grab(authString).then(
    function(response) {
      console.log('Wrote successfully');
    },
    function(error) {
      auth = getAuth();

      fetch(auth[0], auth[1])
        .then(function(res) {
          console.log(res.headers);
          if (res.status == 200) {
            console.log(res.headers['_headers']);

            return res.headers['_headers']['x-auth-claims'];
          }
        })
        .then(function(newAuth) {
          authString = newAuth;
        });
    }
  );

  end();
}, 5000);


polling.on('error', function (error) {
  console.error('error:', error);
});

polling.run();