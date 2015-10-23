
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');

components.register('branches', function(args) {
  return new BranchesViewModel(args.server, args.repoPath);
});

function BranchesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.branches = ko.observableArray();
  this.fetchingProgressBar = components.create('progressBar', { predictionMemoryKey: 'fetching-' + this.repoPath, temporary: true });
  this.current = ko.observable();
  this.fetchLabel = ko.computed(function() {
    if (self.current()) {
      return self.current();
    }
  });
  this.updateBranches();
}
BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.clickFetch = function() { this.updateBranches(); }
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event === 'working-tree-changed' || event.event == 'request-app-content-refresh' || event.event == 'branch-updated') {
    this.updateBranches();
  }
}
BranchesViewModel.prototype.checkoutBranch = function(branch) {
  var self = this;
  this.fetchingProgressBar.start();
  this.server.post('/checkout', { path: this.repoPath, name: branch.name }, function(err) {
    if (err) return;
    self.current(branch.name);
    self.fetchingProgressBar.stop();
  });
}
BranchesViewModel.prototype.updateBranches = function() {
  var self = this;
  this.fetchingProgressBar.start();
  this.server.get('/branches', { path: this.repoPath }, function(err, branches) {
    if (err) {
      self.current("~error");
      return;
    }

    if (branches) {
      var sorted = branches.sort(function(a, b) {
        if (a.name < b.name)
           return -1;
        if (a.name > b.name)
          return 1;
        return 0;
      });
      self.branches(sorted);
      self.current(undefined);
      branches.forEach(function(branch) {
        if (branch.current) {
          self.current(branch.name);
        }
      });
    }

    self.fetchingProgressBar.stop();
  });
}

BranchesViewModel.prototype.branchRemove = function(branch) {
  var self = this;
  var diag = components.create('yesnodialog', { title: 'Are you sure?', details: 'This operation cannot be undone with ungit.'});
  diag.closed.add(function() {
    if (diag.result()) {
      self.server.del('/branches', { name: branch.name, path: self.repoPath }, function(err) {
        if (!err) {
          programEvents.dispatch({ event: 'working-tree-changed' });
        }
      });
    }
  });
  programEvents.dispatch({ event: 'request-show-dialog', dialog: diag });
}
