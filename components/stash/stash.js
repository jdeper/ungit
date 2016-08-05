
var ko = require('knockout');
var moment = require('moment');
var components = require('ungit-components');

components.register('stash', function(args) {
  return new StashViewModel(args.server, args.repoPath);
});

function StashItemViewModel(stash, data) {
  this.stash = stash;
  this.server = stash.server;
  this.id = data.reflogId;
  this.sha1 = data.sha1;
  this.title = data.reflogName + ' ' + moment(new Date(data.commitDate)).fromNow();
  this.message = data.message;
  this.stashPopProgressBar = components.create('progressBar', { predictionMemoryKey: 'stash-pop', temporary: true });
  this.showCommitDiff = ko.observable(false);

  this.commitDiff = ko.observable(components.create('commitDiff', {
    fileLineDiffs: data.fileLineDiffs.slice(),
    sha1: this.sha1,
    repoPath: stash.repoPath,
    server: stash.server
  }));
}
StashItemViewModel.prototype.pop = function() {
  var self = this;
  this.stashPopProgressBar.start();
  this.server.del('/stashes/' + this.id, { path: this.stash.repoPath(), pop: true }, function(err, res) {
    self.stashPopProgressBar.stop();
  });
}
StashItemViewModel.prototype.drop = function() {
  var self = this;
  this.stashPopProgressBar.start();
  this.server.del('/stashes/' + this.id, { path: this.stash.repoPath() }, function(err, res) {
    self.stashPopProgressBar.stop();
  });
}
StashItemViewModel.prototype.toggleShowCommitDiffs = function() {
  this.showCommitDiff(!this.showCommitDiff());
}

function StashViewModel(server, repoPath) {
  var self = this;
  this.server = server;
  this.repoPath = repoPath;
  this.stashedChanges = ko.observable([]);
  this.isShow = ko.observable(localStorage['showStash'] === 'true');
  this.visible = ko.computed(function() { return self.stashedChanges().length > 0 && self.isShow(); });
  this.refresh();
}

StashViewModel.prototype.updateNode = function(parentElement) {
  if (!this.isDisabled) ko.renderTemplate('stash', this, {}, parentElement);
}
StashViewModel.prototype.onProgramEvent = function(event) {
  if (event.event == 'request-app-content-refresh' ||
    event.event == 'working-tree-changed' ||
    event.event == 'git-directory-changed')
    this.refresh();
}
StashViewModel.prototype.refresh = function() {
  var self = this;
  this.server.get('/stashes', { path: this.repoPath() }, function(err, stashes) {
    if (err) {
      if (err.errorCode == 'no-such-path') return true;
      return;
    }

    var changed = self.stashedChanges().length != stashes.length;
    if (!changed) {
      changed = !self.stashedChanges().every(function(item1) {
        return stashes.some(function(item2) {
          return item1.sha1 == item2.sha1;
        });
      });
    }

    if (changed) {
      self.stashedChanges(stashes.map(function(item) { return new StashItemViewModel(self, item); }));
    }
  });
}
StashViewModel.prototype.toggleShowStash = function() {
  this.isShow(!this.isShow());
  localStorage['showStash'] = this.isShow();
}
