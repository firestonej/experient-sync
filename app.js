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
  var d = new Date();

  var start = '2016-10-26T' + d.getHours() + ':' + (d.getMinutes() - 5) + ':00';

  var end = '2016-10-26T' + d.getHours() + ':' + d.getMinutes() + ':00';

  var params = {
    IsAttendeeOnly: true,
    IsNotBoothPersonnel: true,
    IsNotEstimated: false,
    IsRegistered: false,
    IsVerified: false,
    RangeStart: start,
    RangeEnd: end,
  };

  console.log(params);
  return params;
}



sessionList.fetch({
  beforeSend: app.preAuth,
  data: $.param(app.buildParams())
});

var sessionView = new app.SessionView({ collection: sessionList });

sessionView.render();