var app = {};

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
  url: '/testdata/sessions.json',
  parse: function(response,options) {
    return response;
  },
});


// Renders the collection of sessions.
var SessionView = Backbone.View.extend({
  el: '#sessions',
  template: _.template($('#session-template').html()),
  initialize: function(options) {
    this.traffic = options.traffic;
    this.metadata = options.metadata;

    this.listenTo(this.traffic, "reset", this.render);
    this.listenTo(this.metadata, "reset", this.render);

    this.metadata.fetch({reset:true});
    this.traffic.fetch({reset:true});
  },

  render: function() {
    console.log(this.metadata);

    this.$el.html('');
    this.traffic.each(function(model) {
      var trafficData = model.toJSON();

      var sessionData = {};

      try {
        sessionData = this.metadata.get(model.get("Code")).toJSON();
      } catch (e) {
        // console.log(e); // TypeError
        console.log("Failed code: " + model.get("Code"));
      }

      var output = this.template({ traffic: trafficData, metadata: sessionData });
      this.$el.append(output);

    }, this);

  },

  //
  // render: function() {
  //   this.$el.html('');
  //   this.collection.each(function(model){
  //
  //     var renderArray = model.toJSON();
  //     var sessTemplate = this.template(renderArray);
  //     this.$el.append(sessTemplate);
  //   }, this);
  // },

  //
  // initialize: function() {
  //   this.listenTo(this.collection,"add change", function() {
  //     this.render();
  //   } );

});

var sessionMetadata = new app.SessionList();

var trafficList = new app.TrafficList();

var sessionView = new SessionView({ traffic: trafficList, metadata: sessionMetadata });

setInterval(function() {
  trafficList.fetch();
  sessionMetadata.fetch();

}, 1000);