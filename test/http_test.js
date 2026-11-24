/* global assert:false, sinon:false, testURL:false */

const config = require('config');

describe("Zotero.HTTP", function () {
	describe("#isPublicAddress()", function () {
		it("should allow public addresses", function () {
			let addresses = [
				'1.2.3.4',
				'208.80.154.224',
				'2620:0:861:ed1a::1'
			];
			for (let address of addresses) {
				assert.isTrue(Zotero.HTTP.isPublicAddress(address), address);
			}
		});
		
		it("should reject non-public addresses", function () {
			let addresses = [
				'0.0.0.0',
				'127.0.0.1',
				'10.0.0.1',
				'172.16.0.1',
				'192.168.0.1',
				'169.254.169.254',
				'100.64.0.1',
				'::',
				'::1',
				'fc00::1',
				'fe80::1',
				'::ffff:10.0.0.1'
			];
			for (let address of addresses) {
				assert.isFalse(Zotero.HTTP.isPublicAddress(address), address);
			}
		});
	});
	
	describe("#request()", function () {
		beforeEach(function () {
			config.allowPrivateAddresses = false;
		});
		
		afterEach(function () {
			config.allowPrivateAddresses = true;
			sinon.restore();
		});
		
		it("should reject a URL that resolves to a private address", async function () {
			let e = await Zotero.HTTP.request('GET', testURL + 'plain').catch(e => e);
			assert.instanceOf(e, Zotero.HTTP.BlockedURLError);
		});
		
		it("should reject a non-http(s) URL", async function () {
			let e = await Zotero.HTTP.request('GET', 'file:///etc/passwd').catch(e => e);
			assert.instanceOf(e, Zotero.HTTP.BlockedURLError);
		});
		
		describe("with the test server allowed", function () {
			beforeEach(function () {
				// Allow 127.0.0.1 only, so the first hop reaches the test server
				sinon.stub(Zotero.HTTP, 'isPublicAddress').callsFake(address => address == '127.0.0.1');
			});
			
			it("should reject an HTTP redirect to a private address", async function () {
				let e = await Zotero.HTTP.request(
					'POST', testURL + 'redirectPrivate', { body: 'a=b' }
				).catch(e => e);
				assert.instanceOf(e, Zotero.HTTP.BlockedURLError);
			});
			
			it("should reject a meta refresh to a private address", async function () {
				let e = await Zotero.HTTP.request(
					'GET', testURL + 'metaRefreshPrivate', { responseType: 'document' }
				).catch(e => e);
				assert.instanceOf(e, Zotero.HTTP.BlockedURLError);
			});
			
			it("should follow an HTTP redirect to an allowed address", async function () {
				let xmlhttp = await Zotero.HTTP.request(
					'GET', testURL + 'redirect', { responseType: 'document' }
				);
				assert.equal(xmlhttp.responseURL, testURL + 'single');
			});
		});
	});
});
