var fetch = require('node-fetch');
var fs = require('fs');

authUrl = 'https://api.experienteventbit.com/API/AuthUser';

authOpts = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify( { Username: "EXPOREG\\development", Password: "EDU171api" } )
};

fetch(authUrl, authOpts)
  .then(function(res) {

    console.log(res.headers['_headers']);

    url = 'https://api.experienteventbit.com/api/event/EDU161/RptSessionPerformance?IsAttendeeOnly=true&IsNotBoothPersonnel=true&IsNotEstimated=false&IsRegistered=false&IsVerified=false&RangeStart=2016-10-27T19:56:25.000Z&RangeEnd=2016-10-27T20:11:25.000Z';

    opts = {
      headers: { 'X-AUTH-CLAIMS': res.headers['_headers']['x-auth-claims'] }
    };

    console.log(opts);

    fetch(url, opts)
      .then(function(res) {
        var dest = fs.createWriteStream('public/data/traffic.json');
        res.body.pipe(dest);
      });

  });