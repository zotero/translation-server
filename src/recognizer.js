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

// TODO: Move upload logic outside of recognizer.js if uploads will be needed for other purposes

const config = require('config');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const Lambda = new AWS.Lambda({apiVersion: '2015-03-31'});
const S3 = new AWS.S3(config.get('s3Upload'));

let UPLOAD_EXPIRATION = 1 * 60; // 1 minute to initiate upload
let MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB

let Recognizer = module.exports = {
	/**
	 * Directly upload file and get its uploadID
	 *
	 * @param buffer
	 * @return {Promise<string>} uploadID
	 */
	upload: async function (buffer) {
		// Generate UUID
		let uploadID = crypto.randomBytes(16).toString('hex');
		await S3.upload({Key: uploadID, Body: buffer}).promise();
		return uploadID;
	},
	
	remove: async function(uploadID) {
		await S3.deleteObject({Key: uploadID}).promise();
	},
	
	/**
	 * Recognize the uploaded PDF by invoking recognizer Lambda function
	 *
	 * @param uploadID
	 * @return {Promise<Object|null>} Item metadata in translator format
	 */
	recognize: async function (uploadID) {
		let params = {
			FunctionName: config.get('recognizerLambda'),
			InvocationType: 'RequestResponse',
			// Inform recognizer Lambda that we are calling it internally, not over API gateway
			Payload: JSON.stringify({type: 'INTERNAL', body: {action: "recognizeUpload", uploadID}})
		};
		
		let res = await Lambda.invoke(params).promise();
		
		if (res.FunctionError) {
			throw new Error('Lambda error: ' + res.Payload);
		}
		
		res = JSON.parse(res.Payload);
		
		// Retrieve metadata by using recognized identifiers
		let identifiers = [];
		
		if (res.arxiv) {
			identifiers.push({arXiv: res.arxiv});
		}
		
		if (res.doi) {
			identifiers.push({DOI: res.doi});
		}
		
		if (res.isbn) {
			identifiers.push({ISBN: res.isbn});
		}
		
		for (let identifier of identifiers) {
			let translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifier);
			let translators = await translate.getTranslators();
			translate.setTranslator(translators);
			
			try {
				let items = await translate.translate({libraryID: false});
				
				if (items.length) {
					let item = items[0];
					
					// Add some fields if the translated item doesn't have them
					
					if (!item.abstractNote && res.abstract) {
						item.abstractNote = res.abstract;
					}
					
					if (!item.language && res.language) {
						item.language = res.language;
					}
					return item;
				}
			}
			catch (e) {
				Zotero.debug(e);
			}
		}
		
		// Return the extracted metadata
		if (res.title) {
			let item = {};
			item.itemType = 'journalArticle';
			
			if (res.type === 'book-chapter') {
				item.itemType = 'bookSection';
			}
			
			item.title = res.title;
			
			item.creators = [];
			for (let author of res.authors) {
				item.creators.push({
					firstName: author.firstName,
					lastName: author.lastName,
					creatorType: 'author'
				})
			}
			
			if (res.abstract) item.abstractNote = res.abstract;
			if (res.year) item.date = res.year;
			if (res.pages) item.pages = res.pages;
			if (res.volume) item.volume = res.volume;
			if (res.url) item.url = res.url;
			if (res.language) item.language = res.language;
			
			if (item.itemType === 'journalArticle') {
				if (res.issue) item.issue = res.issue;
				if (res.issn) item.issn = res.issn;
				if (res.container) item.publicationTitle = res.container;
			}
			else if (item.itemType === 'bookSection') {
				if (res.container) item.bookTitle = res.container;
				if (res.publisher) item.publisher = res.publisher;
			}
			
			item.libraryCatalog = 'Zotero';
			return item;
		}
		
		return null;
	},
	
	/**
	 * Generate presigned upload params
	 *
	 * @param ctx
	 * @return {Promise<void>}
	 */
	handleUpload: async function (ctx) {
		// Generate UUID
		let uploadID = crypto.randomBytes(16).toString('hex');
		// Generate a presigned POST form, which have to posted from browser to S3.
		// createPresignedPost is used instead of getSignedUrl because it
		// doesn't support file size limiting
		const data = S3.createPresignedPost({
			Fields: {
				key: uploadID
			},
			Expires: UPLOAD_EXPIRATION,
			Conditions: [
				['content-length-range', 0, MAX_PDF_SIZE],
			]
		});
		ctx.body = {uploadID, data};
	},
	
	/**
	 * Recognize the uploaded PDF file
	 *
	 * @param ctx
	 * @return {Promise<void>}
	 */
	handleProcess: async function (ctx) {
		let uploadID = ctx.request.body;
		
		if (!uploadID) {
			ctx.throw(400, "uploadID not provided\n");
		}
		
		try {
			let item = await this.recognize(uploadID);
			ctx.body = Zotero.Utilities.itemToAPIJSON(item);
		}
		catch (e) {
			throw e;
		}
		finally {
			await this.remove(uploadID);
		}
	}
};
