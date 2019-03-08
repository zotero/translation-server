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
		MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
		GNU Affero General Public License for more details.
		
		You should have received a copy of the GNU Affero General Public License
		along with Zotero.	If not, see <http://www.gnu.org/licenses/>.
		
		***** END LICENSE BLOCK *****
*/

const config = require('config');
const Translate = require('./translation/translate');

const fields = {
	valid: [
		"itemType",
		"dateAdded",
		"dateModified",
		"tags",
		"attachments",
		"notes",
		"collections",
		"url",
		"rights",
		"series",
		"volume",
		"edition",
		"place",
		"publisher",
		"ISBN",
		"date",
		"callNumber",
		"archiveLocation",
		"extra",
		"accessDate",
		"seriesNumber",
		"numberOfVolumes",
		"libraryCatalog",
		"language",
		"abstractNote",
		"title",
		"shortTitle",
		"numPages",
		"archive",
		"pages",
		"publicationTitle",
		"issue",
		"ISSN",
		"journalAbbreviation",
		"DOI",
		"seriesTitle",
		"seriesText",
		"section",
		"type",
		"medium",
		"runningTime",
		"artworkSize",
		"number",
		"code",
		"session",
		"legislativeBody",
		"history",
		"reporter",
		"court",
		"committee",
		"assignee",
		"priorityNumbers",
		"references",
		"legalStatus",
		"country",
		"applicationNumber",
		"issuingAuthority",
		"filingDate",
		"codeNumber",
		"scale",
		"meetingName",
		"versionNumber",
		"system",
		"programmingLanguage",
		"conferenceName"
	],

	aliasOf: {
		bookTitle: "publicationTitle",
		thesisType: "type",
		university: "publisher",
		letterType: "type",
		manuscriptType: "type",
		interviewMedium: "medium",
		distributor: "publisher",
		videoRecordingFormat: "medium",
		genre: "type",
		artworkMedium: "medium",
		websiteType: "type",
		websiteTitle: "publicationTitle",
		institution: "publisher",
		reportType: "type",
		reportNumber: "number",
		billNumber: "number",
		codeVolume: "volume",
		codePages: "pages",
		dateDecided: "date",
		reporterVolume: "volume",
		firstPage: "pages",
		caseName: "title",
		docketNumber: "number",
		documentNumber: "number",
		patentNumber: "number",
		issueDate: "date",
		dateEnacted: "date",
		publicLawNumber: "number",
		nameOfAct: "title",
		subject: "title",
		mapType: "type",
		blogTitle: "publicationTitle",
		postType: "type",
		forumTitle: "publicationTitle",
		audioRecordingFormat: "medium",
		label: "publisher",
		presentationType: "type",
		studio: "publisher",
		network: "publisher",
		episodeNumber: "number",
		programTitle: "publicationTitle",
		audioFileType: "medium",
		company: "publisher",
		proceedingsTitle: "publicationTitle",
		encyclopediaTitle: "publicationTitle",
		dictionaryTitle: "publicationTitle"
	}
};

class ImportEndpoint {
	async handle(ctx, _next) {
		const translate = new Translate.Import();
		translate.setString(ctx.request.body || '');

		const translators = ctx.request.query.translatorID ? [ ctx.request.query.translatorID ] : (await translate.getTranslators());
		if (translators.length === 0) {
			ctx.throw(500, 'No suitable translators found', { expose: true });
			return;
		}
		translate.setTranslator(translators[0]);
		await translate.translate({ libraryID: 1 });

		ctx.set('Content-Type', 'application/json');
		for (const item of translate._itemSaver.items) {
			this.normalizeItem(item);
		}

		ctx.response.body = JSON.stringify(translate._itemSaver.items, null, 2);
	}

	normalizeItem(item) {
		delete item.id;
		delete item.itemID;

		this.normalizeTags(item);

		for (const note of (item.notes || [])) {
			this.normalizeTags(note);
		}

		for (const [field, baseField] of Object.entries(fields.aliasOf)) {
			if (typeof item[field] === 'string') {
				item[baseField] = item[field];
				delete item[field];
			}
		}

		/*
		for (const [field, value] of Object.entries(item)) {
			if (['string', 'number'].includes(typeof value) && !fields.valid.includes(field)) {
				throw new Error(`Invalid field ${item.itemType}.${field}`);
			}
		}
		*/
	}

	normalizeTags(item) {
		if (item.tags) item.tags = item.tags.map(tag => (typeof tag === 'string') ? { tag } : tag);
		if (item.tags && item.tags.length === 0) delete item.tags;
		if (item.tags) item.tags.sort((a, b) => a.tag.localeCompare(b.tag));
	}
}

module.exports = new ImportEndpoint;
