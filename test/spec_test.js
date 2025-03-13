/* global assert:false, request:false */

describe("/", function () {
	it("should get doc page", async function () {
		var response = await request()
			.get('/?doc');
		assert.equal(response.statusCode, 200);
	});
	
	it("should get spec json", async function () {
		var response = await request()
			.get('/?spec');
		assert.equal(response.statusCode, 200);
		var json = response.body;
		assert.ok(json.openapi);
	});
	
});
