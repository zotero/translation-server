/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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

const config = require('config');
const XRegExp = require('xregexp');
const md5 = require('md5');
const AWS = require('aws-sdk');
const Lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

module.exports = {
	/**
	 * Handle text search
	 *
	 * @return {Promise<undefined>}
	 */
	handle: async function (ctx, next) {
		// If identifier-search is disabled in the request or unavailable, return 501
		if (ctx.request.query.text === '0'
				|| !config.has('identifierSearchLambda')
				|| !config.get("identifierSearchLambda")) {
			ctx.throw(501, "No identifiers found", { expose: true });
		}
		
		var data = ctx.request.body;
		
		var result = await search(
			data,
			ctx.query && ctx.query.start
		);
		
		// Throw selection if two or more items are found, or the selection flag is marked
		if (result.items.length >= 2 || result.items.length >= 1 && result.select) {
			let newItems = {};
			
			for (let item of result.items) {
				let DOI = item.DOI;
				let ISBN = item.ISBN;
				
				if (!DOI && item.extra) {
					let m = item.extra.match(/DOI: (.*)/);
					if (m) DOI = m[1];
				}
				
				if (!ISBN && item.extra) {
					let m = item.extra.match(/ISBN: (.*)/);
					if (m) ISBN = m[1];
				}
				
				let identifier;
				// DOI has a priority over ISBN for items that have both
				if (DOI) {
					identifier = DOI;
				}
				else if (item.ISBN) {
					identifier = ISBN.split(' ')[0];
				}
				
				newItems[identifier] = {
					itemType: item.itemType,
					title: item.title,
					description: formatDescription(item),
				};
			}
			
			// If there were more results, include a link to the next result set
			if (result.next) {
				ctx.set('Link', `</search?start=${result.next}>; rel="next"`);
			}
			ctx.response.status = 300;
			
			
			//
			// TODO: Differentiate from web request 300
			//
			
			
			ctx.response.body = newItems;
			return;
		}
		
		if (result.items.length === 1) {
			ctx.response.body = Zotero.Utilities.Item.itemToAPIJSON(result.items[0]);
			return;
		}
		
		ctx.response.body = [];
	},
	
	// Expose for stubbing in tests
	queryLambda: async function (query) {
		let params = {
			FunctionName: config.get('identifierSearchLambda'),
			InvocationType: 'RequestResponse',
			Payload: JSON.stringify({query})
		};
		
		let result = await Lambda.invoke(params).promise();
		
		if (result.FunctionError) {
			throw new Error('Lambda error: ' + result.Payload);
		}
		
		identifiers = JSON.parse(result.Payload);
		return identifiers;
	}
};


async function search(query, start) {
	const timeout = config.get('textSearchTimeout') * 1000;
	const startTime = new Date();
	const numResults = 3;
	let identifiers;
	let moreResults = false;
	try {
		identifiers = await module.exports.queryLambda(query);
		
		// If passed a start= parameter, skip ahead
		let startPos = 0;
		if (start) {
			for (let i = 0; i < identifiers.length; i++) {
				if (identifierToToken(identifiers[i]) == start) {
					startPos = i + 1;
					break;
				}
			}
		}
		
		if (identifiers.length > startPos + numResults + 1) {
			moreResults = true;
		}
		
		identifiers = identifiers.slice(startPos);
	} catch(e) {
		Zotero.debug(e, 1);
		return {select: false, items: []};
	}
	
	let items = [];
	let nextLastIdentifier = null;
	for (let identifier of identifiers) {
		let translate = new Zotero.Translate.Search();
		try {
			translate.setIdentifier(identifier);
			let translators = await translate.getTranslators();
			if (!translators.length) {
				if (new Date() > startTime.getTime() + timeout) {
					break;
				}
				continue;
			}
			translate.setTranslator(translators);
			
			let newItems = await translate.translate({
				libraryID: false
			});

			if (newItems.length) {
				let seq = getLongestCommonSequence(newItems[0].title, query);
				if (seq.length >= 6 && seq.split(' ').length >= 2) {
					items.push(newItems[0]);
					// Keep track of last identifier if we're limiting results
					if (moreResults) {
						nextLastIdentifier = identifier;
					}
					if (items.length == numResults) {
						break;
					}
				}
			}
		}
		catch (e) {
			if (e !== translate.ERROR_NO_RESULTS) {
				Zotero.debug(e, 1);
			}
		}
		if (new Date() > startTime.getTime() + timeout) {
			break;
		}
	}
	
	return {
		// Force item selection, even for a single item
		select: true,
		items,
		next: nextLastIdentifier ? identifierToToken(nextLastIdentifier) : null
	};
	
	// // Query Crossref and LoC/GBV in parallel to respond faster to the client
	// let [crossrefItems, libraryItems] = await Promise.all([queryCrossref(query), queryLibraries(query)]);
	//
	// // Subtract book reviews from Crossref
	// crossrefItems = subtractCrossrefItems(crossrefItems, libraryItems);
	//
	// let items = crossrefItems.concat(libraryItems);
	//
	// // Filter out too fuzzy items, by comparing item title (and other metadata) against query
	// return await filterResults(items, query);
}


function formatDescription(item) {
	let parts = [];
	
	let authors = [];
	for (let creator of item.creators) {
		if (creator.creatorType === 'author' && creator.lastName) {
			authors.push(creator.lastName);
			if (authors.length === 3) break;
		}
	}
	
	if(authors.length) parts.push(authors.join(', '));
	
	if (item.date) {
		let m = item.date.toString().match(/[0-9]{4}/);
		if (m) parts.push(m[0]);
	}
	
	if(item.publicationTitle) {
		parts.push(item.publicationTitle);
	} else if(item.publisher) {
		parts.push(item.publisher);
	}
	
	return parts.join(' \u2013 ');
}


function subtractCrossrefItems(crossrefItems, libraryItems) {
	let items = [];
	for(let crossrefItem of crossrefItems) {
		// Keep books and book sections
		if(['book', 'bookSection'].includes(crossrefItem.itemType)) {
			items.push(crossrefItem);
			continue;
		}
		
		let crossrefTitle = crossrefItem.title;
		// Remove all tags
		crossrefTitle = crossrefTitle.replace(/<\/?\w+[^<>]*>/gi, '');
		crossrefTitle = crossrefTitle.replace(/:/g, ' ');
		
		// Normalize title, split to words, filter out empty array elements
		crossrefTitle = normalize(crossrefTitle).split(' ').filter(x => x).join(' ');
		
		let found = false;
		for(let libraryItem of libraryItems) {
			let libraryTitle = libraryItem.title;
			// Remove all tags
			libraryTitle = libraryTitle.replace(/<\/?\w+[^<>]*>/gi, '');
			libraryTitle = libraryTitle.replace(/:/g, ' ');
			
			// Normalize title, split to words, filter out empty array elements
			libraryTitle = normalize(libraryTitle).split(' ').filter(x => x).join(' ');
			
			if(crossrefTitle.includes(libraryTitle)) {
				found = true;
				break;
			}
		}
		
		if(!found) {
			items.push(crossrefItem);
		}
	}
	
	return items;
}

async function queryCrossref(query) {
	let items = [];
	try {
		let translate = new Zotero.Translate.Search();
		// Crossref REST
		translate.setTranslator("0a61e167-de9a-4f93-a68a-628b48855909");
		translate.setSearch({query});
		items = await translate.translate({libraryID: false});
	}
	catch (e) {
		Zotero.debug(e, 2);
	}
	return items;
}

/**
 * Queries LoC and if that fails, queries GBV
 */
async function queryLibraries(query) {
	let items = [];
	try {
		let translate = new Zotero.Translate.Search();
		// Library of Congress ISBN
		translate.setTranslator("c070e5a2-4bfd-44bb-9b3c-4be20c50d0d9");
		translate.setSearch({query});
		items = await translate.translate({libraryID: false});
	}
	catch (e) {
		Zotero.debug(e, 2);
		try {
			let translate = new Zotero.Translate.Search();
			// Gemeinsamer Bibliotheksverbund ISBN
			translate.setTranslator("de0eef58-cb39-4410-ada0-6b39f43383f9");
			translate.setSearch({query});
			items = await translate.translate({libraryID: false});
		}
		catch (e) {
			Zotero.debug(e, 2);
		}
	}
	return items;
}

/**
 * Decomposes all accents and ligatures,
 * filters out symbols that aren't space or alphanumeric,
 * and lowercases alphabetic symbols.
 */
function normalize(text) {
	let rx = XRegExp('[^\\pL 0-9]', 'g');
	text = XRegExp.replace(text, rx, '');
	text = text.normalize('NFKD');
	text = XRegExp.replace(text, rx, '');
	text = text.toLowerCase();
	return text;
}

/**
 * Checks if a given word equals to any of the authors' names
 */
function hasAuthor(authors, word) {
	return authors.some(author => {
		return (author.firstName && normalize(author.firstName).split(' ').includes(word))
			|| (author.lastName && normalize(author.lastName).split(' ').includes(word));
	});
}

/**
 * Tries to find the longest common words sequence between
 * item title and query text. Query text must include title (or part of it)
 * from the beginning. If there are leftover query words, it tries to
 * validate them against item metadata (currently only authors and year)
 */
async function filterResults(items, query) {
	let filteredItems = [];
	let select = false;

	// Normalize query, split to words, filter out empty array elements
	let queryWords = normalize(query).split(' ').filter(x => x);
	
	for (let item of items) {
		let DOI = item.DOI;
		let ISBN = item.ISBN;
		
		if (!DOI && item.extra) {
			let m = item.extra.match(/DOI: (.*)/);
			if (m) DOI = m[1];
		}
		
		if (!ISBN && item.extra) {
			let m = item.extra.match(/ISBN: (.*)/);
			if (m) ISBN = m[1];
		}
		
		if (!DOI && !ISBN) continue;
		let title = item.title;
		// Remove all tags
		title = title.replace(/<\/?\w+[^<>]*>/gi, '');
		title = title.replace(/:/g, ' ');
		
		// Normalize title, split to words, filter out empty array elements
		let titleWords = normalize(title).split(' ').filter(x => x);
		
		let longestFrom = 0;
		let longestLen = 0;
		
		// Finds the longest common words sequence between query text and item.title
		for (let i = 0; i < queryWords.length; i++) {
			for (let j = queryWords.length; j > 0; j--) {
				let a = queryWords.slice(i, j);
				for (let k = 0; k < titleWords.length - a.length + 1; k++) {
					let b = titleWords.slice(k, a.length + k);
					if (a.length && b.length && a.join(' ') === b.join(' ')) {
						if (a.length > longestLen) {
							longestFrom = i;
							longestLen = b.length;
						}
					}
				}
			}
		}
		
		// At least two common words sequence must be found between query and title
		if (longestLen < 1) continue;
		
		// Longest common sequence of words
		let foundPart = queryWords.slice(longestFrom, longestLen);
		
		// Remaining words
		let rems = queryWords.slice(0, longestFrom);
		rems = rems.concat(queryWords.slice(longestLen));
		
		// If at least one remaining word is left, it tries to compare it against item metadata.
		// Otherwise the whole query text is found in the title, and we have a full match
		if (rems.length) {
			let foundAuthor = false;
			let needYear = false;
			let foundYear = false;
			
			// Still remaining words
			let rems2 = [];
			
			for (let rem of rems) {
				// Ignore words
				if (['the', 'a', 'an'].indexOf(rem) >= 0) continue;
				
				// If the remaining word has at least 2 chars and exists in metadata authors
				if (rem.length >= 2 && hasAuthor(item.creators, rem)) {
					foundAuthor = true;
					continue;
				}
				
				// If the remaining word is a 4 digit number (year)
				if (/^[0-9]{4}$/.test(rem)) {
					needYear = true;
					
					if (item.date) {
						// If the remaining word exists in the item date
						let m = item.date.toString().match(/[0-9]{4}/);
						if (m && m[0] === rem) {
							foundYear = true;
							continue;
						}
					}
				}
				
				// Push the word that is still remaining
				rems2.push(rem);
			}
			
			// If a year exists in the query, but is not matched to the item date
			if (needYear && !foundYear) continue;
			
			// If there are still remaining words and none of authors are found
			if (rems2.length && !foundAuthor) continue;
		}
		
		// If the query part that was found in title is shorter than 30 symbols
		if (foundPart.join(' ').length < 30) select = true;
		
		filteredItems.push({
			matchedLen: foundPart.join(' ').length,
			titleLen: titleWords.join(' ').length,
			item
		});
	}
	
	// Sort results by matched text length
	// and how close the matched text length is to title length
	filteredItems.sort(function (a, b) {
		if (b.matchedLen < a.matchedLen) return -1;
		if (b.matchedLen > a.matchedLen) return 1;
		return Math.abs(a.matchedLen - a.titleLen) - Math.abs(b.matchedLen - b.titleLen);
	});
	
	filteredItems = filteredItems.map(item => item.item);
	
	return {select, items: filteredItems};
}

function getLongestCommonSequence(title, query) {
	title = title.replace(/<\/?\w+[^<>]*>/gi, '');
	title = title.replace(/:/g, ' ');
	
	query = query.replace(/:/g, ' ');
	
	// Normalize, split to words and filter out empty array elements
	let titleWords = normalize(title).split(' ').filter(x => x);
	let queryWords = normalize(query).split(' ').filter(x => x);
	
	let longestFrom = 0;
	let longestLen = 0;
	
	// Finds the longest common words sequence between query text and item.title
	for (let i = 0; i < queryWords.length; i++) {
		for (let j = queryWords.length; j > 0; j--) {
			let a = queryWords.slice(i, j);
			for (let k = 0; k < titleWords.length - a.length + 1; k++) {
				let b = titleWords.slice(k, a.length + k);
				if (a.length && b.length && a.join(' ') === b.join(' ')) {
					if (a.length > longestLen) {
						longestFrom = i;
						longestLen = b.length;
					}
				}
			}
		}
	}
	
	return queryWords.slice(longestFrom, longestFrom + longestLen).join(' ');
}

function identifierToToken(identifier) {
	return md5(JSON.stringify(identifier));
}
