var fs = require('fs');
var path = require('path');

var TestEndpoint = {
	handlePlain: async function (ctx, _next) {
		ctx.response.body = '<html><head><title>Test</title></head><body>Hello</body></html>';
	},
	
	handleSingle: async function (ctx, _next) {
		var title = ctx.headers['accept-language'] == 'fr' ? 'Titre' : 'Title';
		ctx.response.body = `<html>
			<head>
				<title>${title}</title>
				<link rel="schema.DC" href="http://purl.org/dc/elements/1.1/" />
				<meta name="citation_title" content="${title}"/>
			</head>
			<body>Body</body>
		</html>`;
	},
	
	handleMultiple: async function (ctx, _next) {
		ctx.response.body = '<html><body>'
			+ '<span class="Z3988" title="url_ver=Z39.88-2004&amp;ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fzotero.org%3A2&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=book&amp;rft.btitle=A"></span>'
			+ '<span class="Z3988" title="url_ver=Z39.88-2004&amp;ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fzotero.org%3A2&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=book&amp;rft.btitle=B"></span>'
			+ '<span class="Z3988" title="url_ver=Z39.88-2004&amp;ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fzotero.org%3A2&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=book&amp;rft.btitle=C"></span>'
			+ '</body></html>';
	},
	
	handleRedirect: async function (ctx, _next) {
		ctx.redirect('/test/single');
	},
	
	handleBibTeX: async function (ctx, _next) {
		ctx.set('Content-Type', 'application/x-bibtex');
		ctx.response.body = fs
			.readFileSync(path.join(__dirname, '../test/data/bibtex_response.xml'))
			.toString();
	},
	
	invalidContentType: async function (ctx, _next) {
		ctx.set('Content-Type', 'image/jpeg');
		ctx.response.body = '';
	},
	
	missingContentType: async function (ctx, _next) {
		ctx.response.body = null;
	}
};

module.exports = TestEndpoint;
