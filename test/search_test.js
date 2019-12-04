/* global assert:false, request:false, sinon:false */

const config = require('config');
const HTTP = require('../src/http');
const TextSearch = require('../src/textSearch');
const path = require('path');
const fs = require('fs');
const urlParse = require('url');

describe("/search", function () {
	var bookISBN1 = '9781421402833';
	var bookTitle1 = 'The expert cook in enlightenment France';
	
	var articlePMID1 = '30571677';
	var articleTitle1 = 'Ten simple rules for documenting scientific software';
	
	beforeEach(() => {
		var origHTTPRequest = HTTP.request.bind(HTTP);
		sinon.stub(HTTP, 'request').callsFake(async function (method, url, options) {
			if (url.startsWith('http://127.0.0.1')) {
				return origHTTPRequest(method, url, options);
			}
			
			Zotero.debug("Mocking request");
			
			if (url.startsWith('https://www.crossref.org')) {
				return {
					status: 200,
					responseText: '<?xml version="1.0" encoding="UTF-8"?>'
						+ '<doi_records><doi_record key="555-555"><crossref>'
						+ '<error>Either ISSN or Journal title or Proceedings title must be supplied.</error>'
						+ '</crossref></doi_record></doi_records>'
				};
			}
			
			// Mock Library of Congress ISBN lookup
			if (url.startsWith('http://lx2.loc.gov')) {
				var xml = fs.readFileSync(
					path.join(__dirname, 'data', 'loc_book1_response.xml'),
					{
						encoding: 'utf-8'
					}
				);
				return {
					status: 200,
					responseText: xml
				};
			}
			
			if (url.startsWith('https://eutils.ncbi.nlm.nih.gov')) {
				let xml = fs.readFileSync(
					path.join(__dirname, 'data', 'pubmed_article1_response.xml'),
					{
						encoding: 'utf-8'
					}
				);
				return {
					status: 200,
					responseText: xml
				};
			}
			
			Zotero.debug("Unhandled request");
			throw new Error("Unhandled request");
		});
		
		// Mock identifier-search Lambda call
		var origQueryLambda = TextSearch.queryLambda.bind(TextSearch);
		sinon.stub(TextSearch, 'queryLambda').callsFake(function (query) {
			if (query == bookTitle1.toLowerCase()) {
				return Promise.resolve([{"ISBN":"${bookISBN1}"}]);
			}
			return origQueryLambda(query);
		});
	});
	
	afterEach(() => {
		HTTP.request.restore();
		TextSearch.queryLambda.restore();
	});
	
	
	it("should perform a text search", async function () {
		config.identifierSearchLambda = 'IdentifierSearch';
		
		var response = await request()
			.post('/search')
			.set('Content-Type', 'text/plain')
			.send(bookTitle1.toLowerCase());
		assert.equal(response.statusCode, 300);
		var json = response.body;
		assert.lengthOf(Object.keys(json), 1);
		assert.equal(json[bookISBN1].itemType, 'book');
		assert.equal(json[bookISBN1].title, bookTitle1);
	});
	
	
	it("should translate an ISBN", async function () {
		var response = await request()
			.post('/search')
			.set('Content-Type', 'text/plain')
			.send(bookISBN1);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 2);
		assert.equal(json[0].itemType, 'book');
		assert.equal(json[0].title, bookTitle1);
		// This note contains keywords that should probably be tags
		assert.equal(json[1].itemType, 'note');
		assert.equal(json[1].parentItem, json[0].key);
	});
	
	
	it("should translate a PMID", async function () {
		var response = await request()
			.post('/search')
			.set('Content-Type', 'text/plain')
			.send(articlePMID1);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 2);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, articleTitle1);
		// This item contains an attachment (URL)
		assert.equal(json[1].itemType, 'attachment');
		assert.equal(json[1].parentItem, json[0].key);
		assert.equal(json[1].mimeType, 'text/html');
	});
	
	it("should translate a PMID with 'pmid:' prefix", async function () {
		var response = await request()
			.post('/search')
			.set('Content-Type', 'text/plain')
			.send('pmid:' + articlePMID1);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 2);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, articleTitle1);
		// This item contains an attachment (URL)
		assert.equal(json[1].itemType, 'attachment');
		assert.equal(json[1].parentItem, json[0].key);
		assert.equal(json[1].mimeType, 'text/html');
	});
});
