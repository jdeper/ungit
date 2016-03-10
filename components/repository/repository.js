
var ko = require('knockout');
var components = require('ungit-components');
var async = require('async');
var _ = require('lodash');

components.register('repository', function(args) {
  return new RepositoryViewModel(args.server, args.repoPath);
});

var RepositoryViewModel = function(server, repoPath) {
  var self = this;

  this.server = server;
  this.repoPath = repoPath;
  this.gitErrors = components.create('gitErrors', { server: server, repoPath: repoPath });
  this.graph = components.create('graph', { server: server, repoPath: repoPath });
  this.remotes = components.create('remotes', { server: server, repoPath: repoPath });
  this.submodules = components.create('submodules', { server: server, repoPath: repoPath });
  this.stash = components.create('stash', { server: server, repoPath: repoPath });
  this.staging = components.create('staging', { server: server, repoPath: repoPath });
  this.branches = components.create('branches', { server: server, repoPath: repoPath });
  this.showLog = this.staging.isStageValid;
  this.server.watchRepository(repoPath);
  this.isSubmodule = ko.observable(false);
  this.parentModulePath = ko.observable();
  this.parentModuleLink = ko.observable();
  this.refreshSubmoduleStatus();
  if (window.location.search.indexOf('noheader=true') >= 0) {
    this.refreshButton = components.create('refreshbutton');
  } else {
    this.refreshButton = false;
  }
}
RepositoryViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('repository', this, {}, parentElement);
}
RepositoryViewModel.prototype.onProgramEvent = function(event) {
  if (this.gitErrors.onProgramEvent) this.gitErrors.onProgramEvent(event);
  if (this.graph.onProgramEvent) this.graph.onProgramEvent(event);
  if (this.staging.onProgramEvent) this.staging.onProgramEvent(event);
  if (this.stash.onProgramEvent) this.stash.onProgramEvent(event);
  if (this.remotes.onProgramEvent) this.remotes.onProgramEvent(event);
  if (this.submodules.onProgramEvent) this.submodules.onProgramEvent(event);
  if (this.branches.onProgramEvent) this.branches.onProgramEvent(event);

  // If we get a reconnect event it's usually because the server crashed and then restarted
  // or something like that, so we need to tell it to start watching the path again
  if (event.event == 'connected') {
    this.server.watchRepository(this.repoPath);
  } else if (event.event == 'request-app-content-refresh') {

  }
}
RepositoryViewModel.prototype.updateAnimationFrame = function(deltaT) {
  if (this.graph.updateAnimationFrame) this.graph.updateAnimationFrame(deltaT);
}
RepositoryViewModel.prototype.refreshSubmoduleStatus = function() {
  var self = this;
  this.server.get('/baserepopath', { path: this.repoPath }, function(err, baseRepoPath) {
    if (err || !baseRepoPath.path) {
      self.isSubmodule(false);
      return true;
    }

    self.server.get('/submodules', { path: baseRepoPath.path }, function(err, submodules) {
      if (!err && Array.isArray(submodules)) {
        var baseName = self.repoPath.replace(/^.*[\\\/]/, '');

        for (var n = 0; n < submodules.length; n++) {
          if (submodules[n].path === baseName) {
            self.isSubmodule(true);
            self.parentModulePath(baseRepoPath.path);
            self.parentModuleLink('/#/repository?path=' + encodeURIComponent(baseRepoPath.path));
            return;
          }
        }
      }

      self.isSubmodule(false);
      return true;
    });
  });
}
