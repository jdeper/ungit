var expect = require('expect.js');
var request = require('supertest');
var express = require('express');
var fs = require('fs');
var path = require('path');
var async = require('async');
var async = require('async');
var restGit = require('../source/git-api');
var common = require('./common.js');
var wrapErrorHandler = common.wrapErrorHandler;

var app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

var req = request(app);

describe('git-api diff', function () {

	var testDir;

	before(function(done) {
		common.createEmptyRepo(req, function(err, dir) {
			if (err) return done(err);
			testDir = dir;
			done();
		});
	});

	var testFile = 'afile.txt';
	var testImage = 'icon.png'

	it('diff on non existing file should fail', function(done) {
		req
			.get(restGit.pathPrefix + '/diff')
			.query({ path: testDir, file: testFile })
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(400)
			.end(wrapErrorHandler(done));
	});

	var content;

	it('should be possible to create a file', function(done) {
		content = ['A', 'few', 'lines', 'of', 'content', ''];
		common.post(req, '/testing/createfile', { file: path.join(testDir, testFile), content: content.join('\n') }, done);
	});

	it('should be possible to create an image file', function(done) {
		common.post(req, '/testing/createimagefile', { file: path.join(testDir, testImage) }, done);
	});

	it('diff on created file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
			for(var i = 0; i < content.length; i++) {
				expect(res.body.indexOf(content[i])).to.be.above(-1);
			}
			done();
		});
	});

	it('diff on image file should work', function(done) {
		common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }, function(err, res) {

			if (err) return done(err);
			expect(res.body.toString()).to.be('png');
			done();
		});
	});

	it('should be possible to commit a file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testFile] }, done);
	});
	it('should be possible to commit an image file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testImage] }, done);
	});

	it('diff on commited file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
			expect(res.body).to.be.an('array');
			expect(res.body.length).to.be(0);
			done();
		});
	});

	it('diff on commited image file should work', function(done) {
		common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }, function(err, res) {

			if (err) return done(err);
			expect(res.body.toString()).to.be('png');
			done();
		});
	});

	it('should be possible to modify a file', function(done) {
		content.splice(2, 0, 'more');
		common.post(req, '/testing/changefile', { file: path.join(testDir, testFile), content: content.join('\n') }, done);
	});

	it('should be possible to modify an image file', function(done) {
		common.post(req, '/testing/changeimagefile', { file: path.join(testDir, testImage) }, done);
	});

	it('diff on modified file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
			expect(res.body.indexOf('diff --git a/afile.txt b/afile.txt')).to.be.above(-1);
			expect(res.body.indexOf('+more')).to.be.above(-1);
			done();
		});
	});

	it('getting current image file should work', function(done) {
		common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'current' }, function(err, res) {
			if (err) return done(err);
			expect(res.body.toString()).to.be('png ~~');
			done();
		});
	});

	it('getting previous image file should work', function(done) {
		common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' }, function(err, res) {
			if (err) return done(err);
			expect(res.body.toString()).to.be('png');
			done();
		});
	});

	it('should be possible to commit a file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testFile] }, done);
	});

	it('removing a test file should work', function(done) {
		common.post(req, '/testing/removefile', { file: path.join(testDir, testFile) }, done);
	});

	it('should be possible to commit an image file', function(done) {
		common.post(req, '/commit', { path: testDir, message: "Init", files: [testImage] }, done);
	});
	it('removing a test image file should work', function(done) {
		common.post(req, '/testing/removefile', { file: path.join(testDir, testImage) }, done);
	});

	it('diff on removed file should work', function(done) {
		common.get(req, '/diff', { path: testDir, file: testFile }, function(err, res) {
			if (err) return done(err);
			expect(res.body.indexOf('deleted file')).to.be.above(-1);
			expect(res.body.indexOf("@@ -1,6 +0,0 @@")).to.be.above(-1);
			done();
		});
	});

	it('getting previous image file should work', function(done) {
		common.getPng(req, '/diff/image', { path: testDir, filename: testImage, version: 'HEAD' }, function(err, res) {
			if (err) return done(err);
			expect(res.body.toString()).to.be('png ~~');
			done();
		});
	});

	after(function(done) {
		common.post(req, '/testing/cleanup', undefined, done);
	});

});
