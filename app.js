var app = {};

// App & data refresh times.
const TRAFFIC_POLL_INTERVAL = 10000; // 10 sec
const METADATA_POLL_INTERVAL = 30000; // 30 sec
const RESET_INTERVAL = 180000; // 3 minutes

// Types of session traffic to show.
const TRACKED_TYPES = [
  "Featured Session",
  "Breakout Session",
  "Meeting",
  "Additional Fee Program"
];

// Ratio to bump traffic by, to account for users without beacons
const TRAFFIC_BUMP_RATIO = 1.4;

/**
 * TEMPLATE HELPERS
 */

/**
 * MODELS
 */

// Session metadata model.
// Represents one session at the conference.
app.Session = Backbone.Model.extend({
  defaults: {
    Code: '',
    Title: '',
    CurrentTraffic: 0,
    Capacity: 0,
    Fullness: '',
    FullnessPercentage: 0
  },

  idAttribute: 'Code', // Joins to Traffic.get("Code")
  initialize: function () {
    this.on('change', this.setFullness);
  },

  setFullness: function (changes) {
    try {
      // Peter's magical "1.4" ratio
      var ratio = (this.get('CurrentTraffic') * this.bumpRatio) / this.get('Capacity');

      // Traffic annotation, based on email from James Berg, 10/18:
      // 0-70%: Open
      // 70-90%: Filling Up
      // 90%+: Full
      var fullness = 'Full';
      if (ratio <= .7) {
        fullness = 'Open';
      }
      else if (ratio < .9) {
        fullness = 'Filling up';
      }

      // Set model attrs for front-end.
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

  bumpRatio: TRAFFIC_BUMP_RATIO
});

// Beacon traffic model.
// Represents the current traffic at one beacon.
app.Traffic = Backbone.Model.extend({
  defaults: {
    Code: '',
    Name: '',
    Traffic: 0,
  },

  idAttribute: 'Code', // Joins to Session.get("Code")

  initialize: function () {
    this.on('change:Traffic', function (thing) {
      // Send current traffic to this session's model.
      if (this.has('SessionModel')) {
        newAttr = this.changedAttributes();
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

// Collection for beacon traffic data.
app.TrafficList = Backbone.Collection.extend({
  model: app.Traffic,

  url: base + '/traffic.json',

  comparator: function (traffic) {
    return -traffic.get("Traffic");
  }
});

// Session metadata collection.
app.SessionList = Backbone.Collection.extend({
  model: app.Session,

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

  // Tracked session types.
  acceptedTypes: TRACKED_TYPES,

  initialize: function (options) {
    this.traffic = options.traffic;
    this.metadata = options.metadata;

    this.errorEl = $("#error");

    this.activeSessions = new app.SessionList();

    this.listenTo(this.traffic, "change", this.filterSessions);
    this.listenTo(this.traffic, "reset", this.joinSessions);
    this.listenTo(this.metadata, "reset", this.joinSessions);
  },

  events: {
    "click .sorter li button": "changeSort",
  },

  // Handles sorting events.
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

    // Reverse sort.
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

  // Joins session metadata (from NetFORUM) to beacon data from the
  // Experient eventBit API.
  // The join is performed whenever metadata is reset. Relationships
  // are maintained in individual Session models so that the 'change'
  // Backbone event can manage traffic changes internally.
  joinSessions: function () {
    if (this.metadata.size() == 0) {
      console.log('Metadata not loaded yet...');
      this.errorEl.html('Loading session information...');
      return;
    }

    // Either traffic.json on worker is empty, or there was a problem loading it.
    if (this.traffic.size() == 0) {
      console.log('No traffic data yet...');
      return;
    }

    this.traffic.each(function (model) {

      try {
        session = this.metadata.get(model.get("Code"));

        // Exclude traffic data from untracked types.
        if (typeof session == "undefined" || $.inArray(session.get("Type"), this.acceptedTypes) < 0) {
          return;
        }

        session.set({
          'CurrentTraffic': model.get("Traffic")
        });

        // Link backwards for 'change' events
        model.set("SessionModel", session);

      } catch (e) {
        console.log("Failed to load metadata for code: " + model.get("Code"));
        console.log(e);
      }

    }, this);
  },

  // Exclude empty sessions and kick to render.
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

  // Render session list.
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

// Instantiate everything.
var sessionMetadata = new app.SessionList(null);
var trafficList = new app.TrafficList();
var sessionView = new SessionView({traffic: trafficList, metadata: sessionMetadata});

// Prepare async polls.
var trafficPoll = Backbone.Poller.get(trafficList, {
  delay: TRAFFIC_POLL_INTERVAL,
  continueOnError: true
});

var metadataPoll = Backbone.Poller.get(sessionMetadata, {
  delay: METADATA_POLL_INTERVAL
});

// Set up timeout loop.
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

// Reset collections and restart the app.
app.Run = function () {
  $('#halt-modal').modal('hide');

  metadataPoll.start();
  trafficPoll.start();

  sessionMetadata.fetch({reset: true});
  trafficList.fetch({reset: true});

  sessionView.render();
};

// Stop everything; notify user.
app.End = function () {
  $('#halt-modal').modal();
  trafficCount = 0;
  trafficList.reset(null);
  sessionMetadata.reset(null);
  sessionView.render();
  metadataPoll.stop();
  trafficPoll.stop();
};

// Run everything.
$(document).ready(app.Run);

// Allow user to restart after timeout.
$('#halt-modal').on('click', app.Run);