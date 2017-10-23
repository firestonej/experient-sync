var app = {};

const TRAFFIC_POLL_INTERVAL = 10000;
const METADATA_POLL_INTERVAL = 30000;
const RESET_INTERVAL = 180000; // 3 minutes

/**
 * TEMPLATE HELPERS
 */

/**
 * MODELS
 */

// Session metadata model
app.Session = Backbone.Model.extend({
  defaults: {
    Code: '',
    Title: '',
    CurrentTraffic: 0,
    Capacity: 0,
    Fullness: '',
    FullnessPercentage: 0
  },
  idAttribute: 'Code',
  initialize: function () {
    this.on('change', this.setFullness);
  },
  setFullness: function (changes) {
    try {
      // Peter's magical
      var ratio = (this.get('CurrentTraffic') * 1.4) / this.get('Capacity');
      var fullness = 'Full';

      if (ratio <= .7) {
        fullness = 'Open';
      }
      else if (ratio < .9) {
        fullness = 'Filling up';
      }
      this.set('Class', fullness.toLowerCase().trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-'));
      this.set('Fullness', fullness);
      this.set('FullnessPercentage', _.min([(ratio * 100).toFixed(), 100]));
    }
    catch (e) {
      console.error(e);
    }
  },
});

app.Traffic = Backbone.Model.extend({
  defaults: {
    Code: '',
    Name: '',
    Traffic: 0,
  },
  idAttribute: 'Code',
  initialize: function () {
    this.on('change:Traffic', function (thing) {
      newAttr = this.changedAttributes();

      if (this.has('SessionModel')) {
        console.log('Session ' + this.get("Code") + ' traffic: ' + this.get("SessionModel").get("CurrentTraffic") + ' -> ' + newAttr.Traffic);
        this.get("SessionModel").set("CurrentTraffic", newAttr.Traffic);
      }


    });
  }
});

/**
 * COLLECTIONS
 */


var base = 'http://educause-rooms-data.herokuapp.com';
// var base = 'http://localhost:3000';

// Collection for number of people at each session.
app.TrafficList = Backbone.Collection.extend({
  model: app.Traffic,
  url: base + '/traffic.json',
  getActiveCount: function () {

  },
  comparator: function (traffic) {
    return -traffic.get("Traffic");
  }
});

// Session metadata collection.
app.SessionList = Backbone.Collection.extend({
  initialize: function (models, options) {
    _.defaults(this, {
      'sortField': 'Title',
      'sortOrder': 'asc',
    });
  },
  comparator: function (model) {
    if (this.sortField == 'Title') {
      return model.get('Title').toLowerCase();
    }
    else if (this.sortField == 'FullnessPercentage') {
      // Frustrating user language vs dev language translation
      return parseInt(model.get('FullnessPercentage'));
    }
    else if (this.sortField == 'Room') {
      return model.get('Room').toLowerCase();
    }
  },
  model: app.Session,
  url: './public/metadata/sessions16.json',
  parse: function (response, options) {
    return response;
  }
});

/**
 * VIEWS
 */

// Renders the collection of sessions.
var SessionView = Backbone.View.extend({
  el: '#sessions-wrap',
  template: Handlebars.compile($('#session-template').html()),

  initialize: function (options) {
    this.traffic = options.traffic;
    this.metadata = options.metadata;
    this.acceptedTypes = [
      "Featured Session",
      "Breakout Session",
      "Meeting",
      "Additional Fee Program"
    ];
    this.errorEl = $("#error");

    this.activeSessions = new app.SessionList();

    this.listenTo(this.traffic, "change", this.filterSessions);
    this.listenTo(this.traffic, "reset", this.joinSessions);
    this.listenTo(this.metadata, "reset", this.joinSessions);
  },

  events: {
    "click .sorter li button": "changeSort",
  },

  changeSort: function (event) {
    newSort = $(event.target).attr("data-sort");
    if (this.activeSessions.sortField == newSort) {
      this.activeSessions.sortOrder =
          this.activeSessions.sortOrder == 'asc' ? 'desc' : 'asc';
    }
    else {
      this.activeSessions.sortField = newSort;
    }
    this.activeSessions.sort();

    // Easy but high-overhead way to reverse sort
    if (this.activeSessions.sortOrder == 'desc') {
      this.activeSessions.set(this.activeSessions.models.reverse(), {sort: false});
    }

    // UI cleanup
    $('.sorter li button').removeClass('asc desc');
    $(event.target).addClass('active');
    $(event.target).addClass(this.activeSessions.sortOrder);
    $('.sorter li button').not(event.target).removeClass('active');
    this.render();
  },

  joinSessions: function () {
    if (this.metadata.size() == 0) {
      console.log('Metadata not loaded yet...');
      this.errorEl.html('Loading session information...');
      return;
    }

    if (this.traffic.size() == 0) {
      console.log('No traffic data yet...');
      return;
    }

    this.traffic.each(function (model) {

      try {
        session = this.metadata.get(model.get("Code"));

        if (typeof session == "undefined" || $.inArray(session.get("Type"), this.acceptedTypes) < 0) {
          // console.log(session.get("Type"));
          // console.log(this.acceptedTypes);
          return;
        }

        session.set({
          'CurrentTraffic': model.get("Traffic")
        });

        // Link backwards for .change events
        model.set("SessionModel", session);

      } catch (e) {
        TypeError
        console.log("Failed to load metadata for code: " + model.get("Code"));
        console.log(e);
      }

    }, this);
  },

  filterSessions: function () {
    var filtered = this.metadata.filter(function (t) {
      return t.get('CurrentTraffic') > 0;
    });

    this.activeSessions.reset(filtered);

    // Easy but high-overhead way to reverse sort
    if (this.activeSessions.sortOrder == 'desc') {
      this.activeSessions.set(this.activeSessions.models.reverse(), {sort: false});
    }

    this.render();
  },

  render: function () {
    this.$("#sessions").html('');

    if (this.activeSessions.size() == 0) {
      this.errorEl.html('No session traffic right now.');
      return;
    }

    this.errorEl.html('');

    this.activeSessions.each(function (model) {

      try {
        var output = this.template(model.toJSON());
        this.$("#sessions").append(output);
      }
      catch (e) {
        console.error(e);
      }

    }, this);

  },

});

/**
 * RUNTIME
 */

var sessionMetadata = new app.SessionList(null);

var trafficList = new app.TrafficList();

var sessionView = new SessionView({traffic: trafficList, metadata: sessionMetadata});

var trafficPoll = Backbone.Poller.get(trafficList, {
  delay: TRAFFIC_POLL_INTERVAL,
  continueOnError: true
});

var metadataPoll = Backbone.Poller.get(sessionMetadata, {
  delay: METADATA_POLL_INTERVAL
});

var trafficCount = 1;

trafficPoll.on('fetch', t => {
  if (trafficCount == (RESET_INTERVAL / TRAFFIC_POLL_INTERVAL)) {
    console.log('> App halted automatically.');
    app.End();
  }
  else {
    trafficCount++;
  }
});

trafficPoll.on('error', traffic => {
  console.error('Error loading new traffic data!');
  console.log(traffic);
});

// Start everything
app.Run = function () {
  $('#halt-modal').modal('hide');

  metadataPoll.start();
  trafficPoll.start();

  sessionMetadata.fetch({reset: true});
  trafficList.fetch({reset: true});
};

// Stop everything; notify user
app.End = function () {
  $('#halt-modal').modal();
  trafficCount = 0;
  trafficList.reset(null);
  sessionMetadata.reset(null);
  sessionView.render();
  metadataPoll.stop();
  trafficPoll.stop();
};

$(document).ready(app.Run());

$('#halt-modal').on('click', app.Run);