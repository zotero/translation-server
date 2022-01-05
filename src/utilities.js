/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
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
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
    ***** END LICENSE BLOCK *****
*/

var Zotero = require('./zotero');

Zotero.OpenURL = Zotero.requireUtilities('./openurl');
Zotero.Date = Zotero.requireUtilities('./date');

Zotero.Utilities = Zotero.requireUtilities('./utilities');
Zotero.Utilities = {...Zotero.Utilities,
	XRegExp: Zotero.requireUtilities('xregexp-all'),
	Item: Zotero.requireUtilities('./utilities_item')
};
// Due to how Utilities.Translate is constructed from the of
// Utilities, we cannot define it above in the object with the rest
Zotero.Utilities.Translate = Zotero.requireTranslate('./utilities_translate');
var addZoteroUnicodeData = Zotero.requireUtilities('xregexp-unicode-zotero');
addZoteroUnicodeData(Zotero.Utilities.XRegExp);

Zotero.Schema = Zotero.requireUtilities('./schema.js');
Zotero.Schema.init(require('../modules/zotero-schema/schema.json'));

module.exports = Zotero.Utilities;

