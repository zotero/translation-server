/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const WebSession = require('./webSession');

// Timeout for select requests, in seconds
const SELECT_TIMEOUT = 60;
const sessionsWaitingForSelection = {};

var requestsSinceGC = 0;


var WebEndpoint = module.exports = {
	handle: async function (ctx, next) {
		ctx.assert(ctx.is('text/plain') || ctx.is('json'), 415);
		
		setTimeout(() => {
			gc();
		});
		
		var data = ctx.request.body;
		
		if (!data) {
			ctx.throw(400, "POST data not provided\n");
		}
		
		// If follow-up URL request, retrieve session and update context
		var query;
		var session;
		if (typeof data == 'object') {
			let sessionID = data.session;
			if (!sessionID) {
				ctx.throw(400, "'session' not provided");
			}
			session = sessionsWaitingForSelection[sessionID];
			if (session) {
				delete sessionsWaitingForSelection[sessionID];
				session.ctx = ctx;
				session.next = next;
				session.data = data;
			} else {
				let single = !!ctx.request.query.single;
				session = new WebSession(ctx, next, data.url, { single });
			}
		}
		else {
			// From https://stackoverflow.com/a/3809435, modified to allow up to 9-char TLDs and IP addresses
			let urlRE = /^(https?:\/\/)?([-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,9}\b|((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|\b)){4})(\S*)$/i;
			
			if (!data.match(urlRE)) {
				ctx.throw(400, "URL not provided");
			}
			
			// Prepend 'http://' if not provided
			if (!data.startsWith('http')) {
				data = 'http://' + data;
			}
			
			let single = !!ctx.request.query.single;
			session = new WebSession(ctx, next, data, { single });
		}
		
		await session.handleURL();
		
		if (ctx.response.status == 300) {
			if(typeof data == 'object') {
				// Select item if this was an item selection query
				session.data = data;
				await session.handleURL();
			} else {
				// Store session if returning multiple choices
				sessionsWaitingForSelection[session.id] = session;
			}
		}
	}
};

/**
 * Perform garbage collection every 10 requests
 */
function gc() {
	if ((++requestsSinceGC) == 10) {
		for (let i in sessionsWaitingForSelection) {
			let session = sessionsWaitingForSelection[i];
			if (session.started && Date.now() >= session.started + SELECT_TIMEOUT * 1000) {
				delete sessionsWaitingForSelection[i];
			}
		}
		requestsSinceGC = 0;
	}
}
