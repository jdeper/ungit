
var ko = require('knockout');
var components = require('ungit-components');
var addressParser = require('ungit-address-parser');
var navigation = require('ungit-navigation');
var programEvents = require('ungit-program-events');

components.register('path', function(args) {
  return new PathViewModel(args.server, args.path);
});

var PathViewModel = function(server, path) {
  var self = this;
  this.server = server;
  this.repoPath = ko.observable(path);
  this.dirName = this.repoPath().replace('\\', '/')
                   .split('/')
                   .filter(function(s) { return s; })
                   .slice(-1)[0] || '/';

  this.status = ko.observable('loading');
  this.loadingProgressBar = components.create('progressBar', { predictionMemoryKey: 'path-loading-' + path });
  this.loadingProgressBar.start();
  this.cloningProgressBar = components.create('progressBar', {
    predictionMemoryKey: 'path-cloning-' + path,
    fallbackPredictedTimeMs: 10000
  });
  this.cloneUrl = ko.observable();
  this.showDirectoryCreatedAlert = ko.observable(false);
  this.cloneDestinationImplicit = ko.computed(function() {
    var defaultText = 'destination folder';
    if (!self.cloneUrl()) return defaultText;

    var parsedAddress = addressParser.parseAddress(self.cloneUrl());
    return parsedAddress.shortProject || defaultText;
  });
  this.cloneDestination = ko.observable();
  this.repository = ko.observable();
}
PathViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('path', this, {}, parentElement);
}
PathViewModel.prototype.template = 'path';
PathViewModel.prototype.shown = function() {
  this.updateStatus();
}
PathViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.repository())
    this.repository().updateAnimationFrame(deltaT);
}
PathViewModel.prototype.updateStatus = function() {
  var self = this;
  this.server.get('/quickstatus', { path: this.repoPath() }, function(err, status){
    self.loadingProgressBar.stop();
    if (err) return;
    if (status.type == 'inited' || status.type == 'bare') {
      if (self.repoPath() !== status.gitRootPath) {
        self.repoPath(status.gitRootPath);
        programEvents.dispatch({ event: 'navigated-to-path', path: self.repoPath() });
        programEvents.dispatch({ event: 'working-tree-changed' });
      }
      self.status(status.type);
      if (!self.repository()) {
        self.repository(components.create('repository', { server: self.server, path: self }));
      }
    } else if (status.type == 'uninited' || status.type == 'no-such-path') {
      self.status(status.type);
      self.repository(null);
    }
  });
}
PathViewModel.prototype.initRepository = function() {
  var self = this;
  this.server.post('/init', { path: this.repoPath() }, function(err, res) {
    if (err) return;
    self.updateStatus();
  });
}
PathViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'request-credentials') this.cloningProgressBar.pause();
  else if (event.event == 'request-credentials-response') this.cloningProgressBar.unpause();
  else if (event.event == 'working-tree-changed') this.updateStatus();
  else if (event.event == 'request-app-content-refresh') this.updateStatus();

  if (this.repository()) this.repository().onProgramEvent(event);
}
PathViewModel.prototype.cloneRepository = function() {
  var self = this;
  self.status('cloning');
  this.cloningProgressBar.start();
  var dest = this.cloneDestination() || this.cloneDestinationImplicit();

  this.server.post('/clone', { path: this.repoPath(), url: this.cloneUrl(), destinationDir: dest }, function(err, res) {
    self.cloningProgressBar.stop();
    if (err) return;
    navigation.browseTo('repository?path=' + encodeURIComponent(res.path));
  });
}
PathViewModel.prototype.createDir = function() {
  var self = this;
  this.showDirectoryCreatedAlert(true);
  this.server.post('/createDir',  { dir: this.repoPath() }, function() {
    self.updateStatus();
  });
}
