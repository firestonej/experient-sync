var app = {};

/**
 * TEMPLATE HELPERS
 */

Handlebars.registerHelper('capacity_class', function() {

  var fullness = this.traffic.Traffic / this.metadata.Capacity;

  if (fullness <= .3) {
    return 'bg-success';
  }
  else if (fullness < .6) {
    return 'bg-info';
  }
  else if (fullness < .9) {
    return 'bg-warning';
  }

  return 'bg-danger';
});

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

      if (ratio <= .25) {
        fullness =  'Open';
      }
      else if (ratio < .5) {
        fullness =  'Medium';
      }
      else if (ratio < .75) {
        fullness =  'Busy';
      }
      else if (fullness < .95) {
        fullness =  'Crowded'
      }

      this.set('Class', fullness.toLowerCase());
      this.set('Fullness', fullness);
      this.set('FullnessPercentage', (ratio * 100).toFixed());
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

// Collection for number of people at each session.
app.TrafficList = Backbone.Collection.extend({
  model: app.Traffic,
  url: '/public/data/traffic.json',
  parse: function(response, options) {
    return _.filter(response, function (obj) {
      return obj.Traffic > 0;
    });
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
    });
  },
  comparator: function(model) {
    if (this.sortField == 'Title') {
      return model.get('Title').toLowerCase();
    }
    else if (this.sortField == 'FullnessPercentage') {
      return model.get('FullnessPercentage');
    }
    else if (this.sortField == 'Room') {
      return model.get('MeetingRoom').toLowerCase();
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
  el: '#sessions',
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
    this.errorEl = $('#error');

    this.activeSessions = new app.SessionList();

    this.listenTo(this.traffic, "reset change", this.filterSessions);
    this.listenTo(this.metadata, "reset", this.joinSessions);

    this.metadata.fetch({reset:true});
    this.traffic.fetch({reset:true});
  },

  joinSessions: function() {

    if (this.metadata.size() == 0) {
      console.log('Metadata not loaded yet.')
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
          'CurrentTraffic': model.get("Traffic"),
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
    // this.activeSessions.sort();

    this.render();
  },

  render: function() {

    if (this.activeSessions.size() == 0) {
      console.log('No traffic results right now.');
      this.errorEl.html('No session traffic right now.');
      return;
    }

    this.$el.html('');
    this.errorEl.html('');

    this.activeSessions.each(function(model) {

      try {
        var output = this.template(model.toJSON());
        this.$el.append(output);
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

