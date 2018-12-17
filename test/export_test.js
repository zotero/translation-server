var { JSDOM } = require('jsdom');
const dom = new JSDOM('<html></html>');
const DOMParser = dom.window.DOMParser;

describe("/export", function () {
	var json = [{"key":"Q5VYZIG2","version":0,"itemType":"newspaperArticle","creators":[{"firstName":"Keith","lastName":"Collins","creatorType":"author"}],"tags":[{"tag":"Net Neutrality","type":1},{"tag":"Pai, Ajit","type":1},{"tag":"Federal Communications Commission","type":1},{"tag":"Regulation and Deregulation of Industry","type":1},{"tag":"Computers and the Internet","type":1}],"title":"Net Neutrality Has Officially Been Repealed. Here’s How That Could Affect You.","section":"Technology","url":"https://www.nytimes.com/2018/06/11/technology/net-neutrality-repeal.html","abstractNote":"Net Neutrality rules that required internet service providers to offer equal access to all web content are no longer in effect as of Monday.","language":"en-US","libraryCatalog":"NYTimes.com","accessDate":"2018-08-21T08:23:37Z","date":"2018-06-11","publicationTitle":"The New York Times","ISSN":"0362-4331"}];
	
	it("should export to BibTeX", async function () {
		var response = await request()
			.post('/export?format=bibtex')
			.send(json)
			.expect(200);
		assert.isTrue(response.text.trim().startsWith('@article'));
	});
	
	it("should export to RIS", async function () {
		var response = await request()
			.post('/export?format=ris')
			.send(json)
			.expect(200);
		assert.isTrue(response.text.startsWith('TY  - NEWS'));
	});
	
	it("should export COinS", async function () {
		var response = await request()
			.post('/export?format=coins')
			.send(json)
			.expect(200)
			.expect('Content-Type', 'text/html');
		assert.isTrue(response.text.startsWith("<span class='Z3988'"));
	});
	
	it("should export CSL JSON", async function () {
		var date = "2017-06-29T15:02:20Z";
		var json = [{
			itemType: "journalArticle",
			creators: [
				{
					firstName: "First",
					lastName: "Last",
					creatorType: "Author"
				}
			],
			extra: `original-date: ${date}`
		}];
		var response = await request()
			.post('/export?format=csljson')
			.send(json)
			.expect(200)
			.expect('Content-Type', 'application/json');
		assert.equal(response.body[0].type, 'article-journal');
		// TODO: Put in 'original-date' property
		assert.equal(response.body[0].note, `original-date: ${date}`);
	});
	
	it("should export Zotero RDF", async function () {
		var response = await request()
			.post('/export?format=rdf_zotero')
			.send(json)
			.expect(200)
			.expect('Content-Type', 'application/rdf+xml');
		var dp = new DOMParser();
		var doc = dp.parseFromString(response.text, 'text/xml');
		assert.equal(doc.documentElement.localName, 'RDF');
	});
});
