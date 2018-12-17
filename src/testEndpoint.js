var TestEndpoint = module.exports = {
	handlePlain: async function (ctx, next) {
		ctx.response.body = '<html><head><title>Test</title></head><body>Hello</body></html>';
	},
	
	handleSingle: async function (ctx, next) {
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
	
	handleMultiple: async function (ctx, next) {
		ctx.response.body = '<html><body>'
			+ '<span class="Z3988" title="url_ver=Z39.88-2004&amp;ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fzotero.org%3A2&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=book&amp;rft.btitle=A"></span>'
			+ '<span class="Z3988" title="url_ver=Z39.88-2004&amp;ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fzotero.org%3A2&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=book&amp;rft.btitle=B"></span>'
			+ '<span class="Z3988" title="url_ver=Z39.88-2004&amp;ctx_ver=Z39.88-2004&amp;rfr_id=info%3Asid%2Fzotero.org%3A2&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.genre=book&amp;rft.btitle=C"></span>'
			+ '</body></html>';
	},
	
	handleRedirect: async function (ctx, next) {
		ctx.redirect('/test/single');
	}
};
