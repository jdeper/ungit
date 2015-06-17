var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var path = require('path');
var fs = require('fs');
var npm = require('npm');
var semver = require('semver');
var async = require('async');
var browserify = require('browserify');

module.exports = function(grunt) {

  var packageJson = grunt.file.readJSON('package.json');

  grunt.initConfig({
    pkg: packageJson,
    less: {
      production: {
        files: {
          "public/css/styles.css": ["public/less/styles.less", "public/vendor/css/animate.css", "public/less/d2h.less", "public/less/highlight.less"],
          "components/commit/commit.css": ["components/commit/commit.less"],
          "components/commitdiff/commitdiff.css": ["components/commitdiff/commitdiff.less"],
          "components/graph/graph.css": ["components/graph/graph.less"],
          "components/header/header.css": ["components/header/header.less"],
          "components/home/home.css": ["components/home/home.less"],
          "components/imagediff/imagediff.css": ["components/imagediff/imagediff.less"],
          "components/repository/repository.css": ["components/repository/repository.less"],
          "components/staging/staging.css": ["components/staging/staging.less"],
          "components/stash/stash.css": ["components/stash/stash.less"],
          "components/refreshbutton/refreshbutton.css": ["components/refreshbutton/refreshbutton.less"],
        }
      }
    },
    watch: {
      scripts: {
        files: ['public/source/**/*.js', 'source/**/*.js', 'components/**/*.js'],
        tasks: ['browserify-common', 'browserify-components'],
        options: {
          spawn: false,
        },
      },
      less: {
        files: ['public/less/*.less', 'public/styles/*.less', 'components/**/*.less'],
        tasks: ['less:production'],
        options: {
          spawn: false,
        },
      }
    },
    lineending: {
      // Debian won't accept bin files with the wrong line ending
      production: {
        options: {
          eol: 'lf'
        },
        files: {
          './bin/ungit': ['./bin/ungit'],
          './bin/credentials-helper': ['./bin/credentials-helper']
        }
      },
    },
    release: {
      options: {
        commitMessage: 'Release <%= version %>',
      }
    },
    // Run mocha tests
    mochaTest: {
      options: {
        reporter: 'spec'
      },
      src: 'test/*.js'
    },
    // Plato code analysis
    plato: {
      all: {
        files: {
          'report': ['source/**/*.js', 'public/source/**/*.js'],
        }
      },
    },

    // Minify images (basically just lossless compression)
    imagemin: {
      default: {
        options: {
          optimizationLevel: 3
        },
        files: [{
          expand: true,
          cwd: 'assets/client/images/',
          src: ['**/*.png'],
          dest: 'public/images/'
        }]
      }
    },

    // Embed images in css
    imageEmbed: {
      default: {
        files: {
          "public/css/styles.css": [ "public/css/styles.css" ],
          "components/graph/graph.css": ["components/graph/graph.css"],
          "components/header/header.css": ["components/header/header.css"],
          "components/staging/staging.css": ["components/staging/staging.css"],
        },
        options: {
          deleteAfterEncoding: false
        }
      }
    },
    jshint: {
      options: {
        undef: true, // check for usage of undefined variables
        indent: 2,
        '-W033': true, // ignore Missing semicolon
        '-W041': true, // ignore Use '===' to compare with '0'
        '-W065': true, // ignore Missing radix parameter
        '-W069': true, // ignore ['HEAD'] is better written in dot notation
      },
      web: {
        options: {
          node: true,
          browser: true,
          globals: {
            'ungit': true,
            'io': true,
            'Keen': true,
            'Raven': true
          }
        },
        files: [
          {
            src: ['public/source/**/*.js', 'components/**/*.js'],
            // Filter out the "compiled" components files; see the browserify task for components
            filter: function(src) { return src.indexOf('bundle.js') == -1; }
          }
        ]
      },
      phantomjs: {
        options: {
          phantom: true,
          browser: true,
          globals: {
            '$': true,
            'module': true,
          }
        },
        src: ['clicktests/**/*.js']
      },
      node: {
        options: {
          node: true
        },
        src: [
          'Gruntfile.js',
          'bin/*',
          'source/**/*.js',
        ]
      },
      mocha: {
        options: {
          node: true,
          globals: {
            'it': true,
            'describe': true,
            'before': true,
            'after': true,
            'window': true,
            'document': true,
            'navigator': true
          }
        },
        src: [
          'test/**/*.js',
        ]
      }
    }
  });

  grunt.registerTask('browserify-common', '', function() {
    var done = this.async();
    var b = browserify({
      noParse: ['public/vendor/js/superagent.js'],
      debug: true
    });
    b.add('./public/source/main.js');
    b.require('./public/source/main.js', { expose: 'ungit-main' });

    b.require('./public/source/components.js', { expose: 'ungit-components' });
    b.require('./public/source/program-events.js', { expose: 'ungit-program-events' });
    b.require('./public/source/navigation.js', { expose: 'ungit-navigation' });
    b.require('./public/source/main.js', { expose: 'ungit-main' });
    b.require('./source/utils/vector2.js', { expose: 'ungit-vector2' });
    b.require('./source/address-parser.js', { expose: 'ungit-address-parser' });
    b.require('knockout', { expose: 'knockout' });
    b.require('lodash', { expose: 'lodash' });
    b.require('hasher', { expose: 'hasher' });
    b.require('crossroads', { expose: 'crossroads' });
    b.require('async', { expose: 'async' });
    b.require('moment', { expose: 'moment' });
    b.require('blueimp-md5', { expose: 'blueimp-md5' });
    b.require('color', { expose: 'color' });
    b.require('signals', { expose: 'signals' });
    b.require('util', { expose: 'util' });
    b.require('path', { expose: 'path' });
    b.require('diff2html', { expose: 'diff2html' });
    b.require('highlight.js', { expose: 'highlight.js' });
    var outFile = fs.createWriteStream('./public/js/ungit.js');
    outFile.on('close', function() {
      done();
    });
    b.bundle().pipe(outFile);
  });

  grunt.registerTask('browserify-components', '',  function() {
    var done = this.async();
    async.forEach(fs.readdirSync('components'), function(component, callback) {
      var b = browserify({
        bundleExternal: false,
        debug: true
      });
      b.add('./components/' + component + '/' + component + '.js');
      b.external(['ungit-components',
              'ungit-program-events',
              'ungit-navigation',
              'ungit-main',
              'ungit-vector2',
              'ungit-address-parser',
              'knockout',
              'lodash',
              'hasher',
              'crossroads',
              'async',
              'moment',
              'blueimp-md5']);

      var outFile = fs.createWriteStream('./components/' + component + '/' + component + '.bundle.js');
      outFile.on('close', function() {
        callback();
      });
      b.bundle().pipe(outFile);
    }, function() {
      done();
    });
  });

  grunt.registerTask('clicktest', 'Run clicktests.', function() {
    var done = this.async();
    grunt.log.writeln('Running clicktests...');
    var child = childProcess.execFile(phantomjs.path, [path.join(__dirname, 'clicktests', 'test.all.js')], { maxBuffer: 10*1024*1024});
    child.stdout.on('data', function(data) {
      grunt.log.write(data);
    });
    child.stderr.on('data', function(data) {
      grunt.log.error(data);
    })
    child.on('exit', function(code) {
      grunt.log.writeln('Clicktests exited with code ' + code);
      done(code == 0);
    });
  });

  function bumpDependency(packageJson, dependencyType, packageName, callback) {
    var currentVersion = packageJson[dependencyType][packageName];
    if (currentVersion[0] == '~' || currentVersion[0] == '^') currentVersion = currentVersion.slice(1);
    npm.commands.show([packageName, 'versions'], true, function(err, data) {
      if(err) return callback(err);
      var versions = data[Object.keys(data)[0]].versions.filter(function(v) {
        return v.indexOf('alpha') == -1;
      });
      var latestVersion = versions[versions.length - 1];
      if (semver.gt(latestVersion, currentVersion)) {
        packageJson[dependencyType][packageName] = '~' + latestVersion;
      }
      callback();
    });
  }

  grunt.registerTask('bumpdependencies', 'Bump dependencies to their latest versions.', function() {
    var done = this.async();
    grunt.log.writeln('Bumping dependencies...');
    npm.load(function() {
      var tempPackageJson = JSON.parse(JSON.stringify(packageJson));

      async.parallel([
        async.map.bind(null, Object.keys(tempPackageJson.dependencies), function(dep, callback) {
          // Keep forever-monitor at 1.1.0 until https://github.com/nodejitsu/forever-monitor/issues/38 is fixed
          if (dep == 'forever-monitor') return callback();
          // Socket.io 1.0.0-pre didn't work with phantomjs, so keep it at 0.9.16 for now
          if (dep == 'socket.io') return callback();
          // Superagent 1.x has a new api, need to upgrade to that if we want to bump
          if (dep == 'superagent') return callback();

          bumpDependency(tempPackageJson, 'dependencies', dep, callback);
        }),
        async.map.bind(null, Object.keys(tempPackageJson.devDependencies), function(dep, callback) {
          // Same with imagemin, something with 0.5.0 doesn't work on mac
          if (dep == 'grunt-contrib-imagemin') return callback();
          // For some reason supertest > 0.10 doesn't work with the tests. Haven't investigated why yet.
          if (dep == 'supertest') return callback();

          bumpDependency(tempPackageJson, 'devDependencies', dep, callback);
        })
      ], function() {
        fs.writeFileSync('package.json', JSON.stringify(tempPackageJson, null, 2) + '\n');
        grunt.log.writeln('Dependencies bumped, run npm install to install latest versions.');
        done();
      });

    });
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-lineending');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-plato');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-image-embed');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task, builds everything needed
  grunt.registerTask('default', ['less:production', 'jshint', 'browserify-common', 'browserify-components', 'lineending:production', 'imagemin:default', 'imageEmbed:default']);

  // Run tests
  grunt.registerTask('unittest', ['mochaTest']);
  grunt.registerTask('test', ['unittest', 'clicktest']);

  // Builds, and then creates a release (bump patch version, create a commit & tag, publish to npm)
  grunt.registerTask('publish', ['default', 'test', 'release:patch']);

  // Same as publish but for minor version
  grunt.registerTask('publishminor', ['default', 'test', 'release:minor']);

};
