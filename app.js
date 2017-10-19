var app = {};

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
  initialize: function() {
    this.on('change', this.setFullness);
  },
  setFullness: function(changes) {
    try {
      // Peter's magical
      var ratio = (this.get('CurrentTraffic') * 1.4) / this.get('Capacity');
      var fullness = 'Full';

      if (ratio <= .7) {
        fullness =  'Open';
      }
      else if (ratio < .9) {
        fullness =  'Filling up';
      }
      this.set('Class', fullness.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-'));
      this.set('Fullness', fullness);
      this.set('FullnessPercentage', _.min([(ratio * 100).toFixed(),100]));
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
  initialize: function() {
    this.on('change:Traffic', function (thing) {
      newAttr = this.changedAttributes();

      if (this.has('SessionModel')) {

        this.get("SessionModel").set("CurrentTraffic", newAttr.Traffic);
      }


    });
  }
});

/**
 * COLLECTIONS
 */

var base = window.location.protocol + '//' + window.location.hostname;

// Collection for number of people at each session.
app.TrafficList = Backbone.Collection.extend({
  model: app.Traffic,
  url: base + ':8080/data/traffic.json',
  getActiveCount: function() {

  },
  comparator: function(traffic) {
    return -traffic.get("Traffic");
  }
});

// Session metadata collection.
app.SessionList = Backbone.Collection.extend({
  initialize: function(models, options) {
    _.defaults(this, {
      'sortField': 'Title',
      'sortOrder': 'asc',
    });
  },
  comparator: function(model) {
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
  url: '/public/metadata/sessions16.json',
  parse: function(response,options) {
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

  initialize: function(options) {
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

    this.listenTo(this.traffic, "reset change", this.filterSessions);
    this.listenTo(this.metadata, "reset", this.joinSessions);

    this.metadata.fetch({reset:true});
    this.traffic.fetch({reset:true});
  },

  events: {
    "click .sorter li button": "changeSort",
  },

  changeSort: function(event) {
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
    $('.sorter li button').not(event.target).removeClass('asc desc');
    $(event.target).addClass('active');
    $(event.target).addClass(this.activeSessions.sortOrder);
    $('.sorter li button').not(event.target).removeClass('active');
    this.render();
  },

  joinSessions: function() {
    if (this.metadata.size() == 0) {
      console.log('Metadata not loaded yet.');
      this.errorEl.html('Loading metadata...');
      return;
    }

    if (this.traffic.size() == 0) {
      console.log('No traffic data.');
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
        // TypeError
        // console.log("Failed to load metadata for code: " + model.get("Code"));
        // console.log(e);
      }

    }, this);
  },

  filterSessions: function() {
    var filtered = this.metadata.filter(function(t) {
      return t.get('CurrentTraffic') > 0;
    });

    this.activeSessions.reset(filtered);

    this.render();
  },

  render: function() {

    if (this.activeSessions.size() == 0) {
      this.errorEl.html('No session traffic right now.');
      return;
    }

    this.$("#sessions").html('');
    this.errorEl.html('');

    this.activeSessions.each(function(model) {

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

var sessionMetadata = new app.SessionList(null);

var trafficList = new app.TrafficList();

var sessionView = new SessionView({ traffic: trafficList, metadata: sessionMetadata });

var trafficPoll = Backbone.Poller.get(trafficList, {
  delay: 5000,
  continueOnError: true
});

var metadataPoll = Backbone.Poller.get(sessionMetadata, {
  delay: 30000
});

trafficList.on('error', function(k){
  console.error(k);
});


trafficPoll.on('error', function(model){
  console.error('oops! something went wrong');
  console.log(model);
});

metadataPoll.start();
trafficPoll.start();

