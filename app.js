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
  },
  idAttribute: 'Code',
});

app.Traffic = Backbone.Model.extend({
  defaults: {
    Code: '',
    Name: '',
    Traffic: 0,
  }
});

/**
 * COLLECTIONS
 */

// Collection for number of people at each session.
app.TrafficList = Backbone.Collection.extend({
  model: app.Traffic,
  url: '/testdata/traffic.json',
  parse: function(response, options) {
    return _.filter(response, function (obj) {
      return obj.Traffic > 0;
    });
  },
});

// Session metadata collection.
app.SessionList = Backbone.Collection.extend({
  initialize: function(models, options) {
    // this.on("add change", this.updateMetadata);
  },
  model: app.Session,
  url: '/testdata/sessions16.json',
  parse: function(response,options) {
    return response;
  },
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
      "Additional Fee Program",
    ];

    this.listenTo(this.traffic, "reset change", this.render);
    this.listenTo(this.metadata, "reset change", this.render);

    this.metadata.fetch({reset:true});
    this.traffic.fetch({reset:true});
  },

  render: function() {
    this.$el.html('');

    if (this.metadata.size() == 0) {
      console.log('Metadata not loaded yet.')
      this.$el.html('<h5 class="bg-info">Loading metadata...</h5>');
      return;
    }

    if (this.traffic.size() == 0) {
      console.log('No traffic results right now.');
      this.$el.html('<h5 class="bg-info">No session traffic right now.</h5>');
      return;
    }

    this.traffic.each(function(model) {

      try {
        session = this.metadata.get(model.get("Code"));

        if (typeof session !== "undefined" && $.inArray(session.get("Type"), this.acceptedTypes) < 0 ) {
          // console.log(session.get("Type"));
          // console.log(this.acceptedTypes);
          return;
        }

        try {
          var output = this.template({ traffic:  model.toJSON(), metadata: session.toJSON() });
          this.$el.append(output);
        }
        catch (e) {
          // console.log("Render error");
          // console.log(e);
        }
      } catch (e) {
        // TypeError
        console.log("Failed to load metadata for code: " + model.get("Code"));
        console.log(e);
      }

    }, this);

  },

});

var sessionMetadata = new app.SessionList();

var trafficList = new app.TrafficList();

var sessionView = new SessionView({ traffic: trafficList, metadata: sessionMetadata });

var trafficPoll = Backbone.Poller.get(trafficList, {
  delay: 1000
});

var metadataPoll = Backbone.Poller.get(sessionMetadata, {
  delay: 5000,
});


trafficPoll.start();
metadataPoll.start();