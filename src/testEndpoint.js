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
	
	handleRedirectPrivate: async function (ctx, _next) {
		// 307 keeps the method and body
		ctx.status = 307;
		ctx.redirect('http://10.0.0.1/');
	},
	
	handleMetaRefreshPrivate: async function (ctx, _next) {
		ctx.response.body = '<html><head><meta http-equiv="refresh" content="0;url=http://10.0.0.1/"></head></html>';
	},
	
	handleMetaRefreshEcho: async function (ctx, _next) {
		ctx.response.body = '<html><head><meta http-equiv="refresh" content="0;url=/test/echo"></head></html>';
	},
	
	handleEcho: async function (ctx, _next) {
		ctx.set('Content-Type', 'text/html');
		ctx.response.body = `<html><body><p id="method">${ctx.method}</p>`
			+ `<p id="length">${ctx.get('Content-Length') || 0}</p>`
			+ `<p id="type">${ctx.get('Content-Type')}</p></body></html>`;
	},
	
	handleMetaRefreshLoop: async function (ctx, _next) {
		ctx.response.body = '<html><head><meta http-equiv="refresh" content="0;url=/test/metaRefreshLoop"></head></html>';
	},
	
	handleRedirectToMetaRefresh: async function (ctx, _next) {
		ctx.redirect('/test/sub/metaRefresh');
	},
	
	handleSubMetaRefresh: async function (ctx, _next) {
		// Relative URL, so it resolves differently against /test/sub/ and /test/
		ctx.response.body = '<html><head><meta http-equiv="refresh" content="0;url=echo"></head></html>';
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
