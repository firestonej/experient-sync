var fetch = require('node-fetch');
var fs = require('fs');
var async = require('async-polling');
var moment = require('moment');

// Constants
var BASE_URL = 'https://api.experienteventbit.com/';
var POLL_RANGE = 20; // Minutes
var POLL_INTERVAL = 5000; // Milliseconds
var LOG_DATE_START = 'MMMM Do YYYY, h:mm:ss a';
var LOG_DATE_END = 'h:mm:ss a';


/**
 * Follows instructions at https://api.experienteventbit.com/docs/
 * to sign in appropriately.
 */
function getAuth() {
  authUrl = BASE_URL + 'API/AuthUser';

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
    // end = moment();
    /*
     * @todo This is for old data, using current time but mimicking a day of
     *       last year's conference.
     */
    endTime = moment().year(2016).month("Oct").date(27).hour(13);

    startTime = endTime.clone().subtract(POLL_RANGE, 'minutes');

    start = '&RangeStart=' + startTime.toISOString();
    end = '&RangeEnd=' + endTime.toISOString();

    console.log('Polling for range ' + startTime.format('MMMM Do YYYY, h:mm:ss a') + ' to ' + endTime.format('h:mm:ss a'));

    // @todo: Properly build URL with
    url = BASE_URL + 'api/event/EDU161/RptSessionPerformance?IsAttendeeOnly=true&IsNotBoothPersonnel=true&IsNotEstimated=false&IsRegistered=false&IsVerified=false' + start + end;

    opts = {
      headers: { 'X-AUTH-CLAIMS': authString }
    };

    console.log(url);

    console.log('Attempting to fetch...');

    fetch(url, opts)
      .then(function(response) {
        if (response.status == 200) {
          var dest = fs.createWriteStream('public/data/traffic.json');
          response.body.pipe(dest);
          resolve();
        }

        else if (response.status == 400) {
          // console.log(response.json());
          console.log(response.statusText);
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
      console.log('Successfully wrote new JSON. ' + moment());
    },
    function(error) {
      console.log(error);
      auth = getAuth();

      fetch(auth[0], auth[1])
        .then(function(res) {
          console.log(res.status);
          if (res.status == 200) {
            // console.log(res.headers['_headers']);

            return res.headers['_headers']['x-auth-claims'];
          }
        })
        .then(function(newAuth) {
          authString = newAuth;
        });
    }
  );

  end();
}, POLL_INTERVAL);


polling.on('error', function (error) {
  console.error('error:', error);
});

polling.run();