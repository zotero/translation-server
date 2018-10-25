const config = require('config');

module.exports = async (ctx, next) => {
	if (ctx.headers.origin) {
		let allowedOrigins = config.get('allowedOrigins').filter(x => x);
		let allAllowed = allowedOrigins.includes('*');
		if (allAllowed || allowedOrigins.includes(ctx.headers.origin)) {
			ctx.set("Access-Control-Allow-Origin", allAllowed ? '*' : ctx.headers.origin);
			ctx.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
			ctx.set("Access-Control-Allow-Headers", "Content-Type");
			ctx.set("Access-Control-Expose-Headers", "Link");
		}
	}
	await next();
};