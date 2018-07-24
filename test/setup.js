const config = require('config');
const request = require('supertest');
const chai = require('chai');
const app = require('../src/server');
const Koa = require('koa');
const _ = require('koa-route');
const bodyParser = require('koa-bodyparser');
const TestEndpoint = require('../src/testEndpoint');

// Globals that are available to every test
global.assert = chai.assert;
global.request = function () {
	return request(app.callback())
};
global.testURL = `http://127.0.0.1:${config.get('testPort')}/test/`;

// Serve sample pages for tests
const testApp = new Koa();
testApp.use(_.get('/test/plain', TestEndpoint.handlePlain));
testApp.use(_.get('/test/single', TestEndpoint.handleSingle));
testApp.use(_.get('/test/multiple', TestEndpoint.handleMultiple));
var testServer = testApp.listen(config.get('testPort'));

before(async function () {
	// Wait for translator initialization
	await Promise.delay(500);
});

after(function () {
	testServer.close();
});
