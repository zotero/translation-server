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

const config = require('config');
const Translate = require('./translation/translate');

const SERVER_FORMATS = {
	"bibtex":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"biblatex":"b6e39b57-8942-4d11-8259-342c46ce395f",
	"bookmarks":"4e7119e0-02be-4848-86ef-79a64185aad8",
	"coins":"05d07af9-105a-4572-99f6-a8e231c0daef",
	csljson: "bc03b4fe-436d-4a1f-ba59-de4d2d7a63f7",
	csv: "25f4c5e2-d790-4daa-a667-797619c7e2f2",
	endnote_xml: "eb7059a4-35ec-4961-a915-3cf58eb9784b",
	evernote: "18dd188a-9afc-4cd6-8775-1980c3ce0fbf",
	"mods":"0e2235e7-babf-413c-9acf-f27cce5f059c",
	"refer":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"rdf_bibliontology":"14763d25-8ba0-45df-8f52-b8d1108e7ac9",
	"rdf_dc":"6e372642-ed9d-4934-b5d1-c11ac758ebb7",
	"rdf_zotero":"14763d24-8ba0-45df-8f52-b8d1108e7ac9",
	refworks_tagged: "1a3506da-a303-4b0a-a1cd-f216e6138d86",
	"ris":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"tei":"032ae9b7-ab90-9205-a479-baf81f49184a",
	"wikipedia":"3f50aaac-7acc-4350-acd0-59cb77faf620"
};

const SERVER_CONTENT_TYPES = {
	"bibtex":"application/x-bibtex",
	"biblatex":"application/x-bibtex",
	"bookmarks":"text/html",
	"coins":"text/html",
	csljson: "application/json",
	csv: "text/csv",
	endnote_xml: "text/xml",
	evernote: "text/xml",
	"mods":"application/mods+xml",
	"refer":"application/x-research-info-systems",
	"rdf_bibliontology":"application/rdf+xml",
	"rdf_dc":"application/rdf+xml",
	"rdf_zotero":"application/rdf+xml",
	refworks_tagged: "text/plain",
	"ris":"application/x-research-info-systems",
	"wikipedia":"text/x-wiki",
	"tei":"text/xml"
};

var ExportEndpoint = module.exports = {
	handle: async function (ctx, next) {
		ctx.assert(ctx.is('json'), 415);
		
		var items = ctx.request.body;
		
		if (!items) {
			ctx.throw(400, "POST data not provided");
		}
		
		var query = ctx.request.query;
		
		var translatorID;
		
		if (!query.format || !(translatorID = SERVER_FORMATS[query.format])) {
			ctx.throw(400, "Invalid format specified");
		}
		
		if (!items.length || !items[0].itemType) {
			ctx.throw(400, "Input must be an array of items as JSON");
		}
		
		var translate = new Translate.Export();
		translate.setTranslator(translatorID);
		translate.setItems(items);
		try {
			await new Promise(function (resolve, reject) {
				translate.setHandler("done", function (obj, status) {
					if (!status) {
						reject();
					}
					else {
						ctx.set('Content-Type', SERVER_CONTENT_TYPES[query.format]);
						ctx.response.body = translate.string;
						resolve();
					}
				});
				translate.translate();
			});
		}
		catch (e) {
			ctx.throw(
				500,
				"An error occurred during translation. Please check translation with the Zotero client.",
				{ expose: true }
			);
		}
	}
};
