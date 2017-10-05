var app = {};

// Session model
app.Session = Backbone.Model.extend({
  defaults: {
    Code: '',
    Name: '',
    ProductID: '',
    Traffic: 0,
  }
});

// Session collection
app.SessionList = Backbone.Collection.extend({
  model: app.Session,
  url: function() {
    var eventCode = 'EDU161';
    var base = 'https://api.experienteventbit.com/api/event/' + eventCode + '/RptSessionPerformance';

    return base;

  },
  parse: function(response, options) {
    return _.filter(response, function(obj) {
      return obj.Traffic > 0;
    });
  }
});

// Renders an individual Session.
app.SessionView = Backbone.View.extend({
  el: '#sessions',
  template: _.template($('#session-template').html()),

  render: function() {
    this.collection.each(function(model){
      var sessTemplate = this.template(model.toJSON());
      this.$el.append(sessTemplate);
    }, this);
  },

  renderItem: function(session) {
    var sessionTemplate = this.template(session.toJSON());
    this.$el.append(sessionTemplate);
  },

  initialize: function() {
    this.listenTo(this.collection,"add", this.renderItem);
  },

});

// Authentication. Needs to be replaced with a fresh X-AUTH-CLAIMS request function.
app.preAuth = function (xhr) {
  var claim = '';
  xhr.setRequestHeader('X-AUTH-CLAIMS', claim);
}

var sessionList = new app.SessionList();

app.buildParams = function() {
  var n = new Date();
  var pollDuration = 5;
  var startTime = new Date(2016, 9, 26, n.getHours(), n.getMinutes() - pollDuration, n.getSeconds());
  var endTime = new Date(2016, 9, 26, n.getHours(), n.getMinutes(), n.getSeconds());

  var start = startTime.toISOString();
  var end = endTime.toISOString();

  var params = {
    IsAttendeeOnly: true,
    IsNotBoothPersonnel: true,
    IsNotEstimated: false,
    IsRegistered: false,
    IsVerified: false,
  };

  console.log(params);
  console.log($.param(params));
  return $.param(params)
    + '&RangeStart=' + start
    + '&RangeEnd=' + end;
}



sessionList.fetch({
  beforeSend: app.preAuth,
  data: app.buildParams()
});

var sessionView = new app.SessionView({ collection: sessionList });

sessionView.render();