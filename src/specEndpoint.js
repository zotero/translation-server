'use strict';

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
        MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.    See the
        GNU Affero General Public License for more details.
        
        You should have received a copy of the GNU Affero General Public License
        along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
        
        ***** END LICENSE BLOCK *****
*/

const path = require('path');
const fs = require('fs');
const docRoot = `${require('swagger-ui-dist').absolutePath()}/`;
const DOC_CSP = "default-src 'none'; " +
    "script-src 'self' 'unsafe-inline'; connect-src *; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';";
const yaml = require('js-yaml');

function processRequest(ctx) {

    const reqPath = ctx.request.query.path || '/index.html';
    const filePath = path.join(docRoot, reqPath);
    let contentType;

    // Disallow relative paths.
    // Test relies on docRoot ending on a slash.
    if (filePath.substring(0, docRoot.length) !== docRoot) {
        Zotero.debug(`${reqPath} could not be found.`)
        ctx.throw(404, "File not found\n");
    }

    let body = fs.readFileSync(filePath);
    if (reqPath === '/index.html') {
        const css = `
            /* Removes Swagger's image from the header bar */
            .topbar-wrapper .link img {
                display: none;
            }
            /* Adds the application's name in the header bar */
            .topbar-wrapper .link::after {
                content: zotero;
            }
            /* Removes input field and explore button from header bar */
            .swagger-ui .topbar .download-url-wrapper {
                display: none;
            }
            /* Modifies the font in the information area */
            .swagger-ui .info li, .swagger-ui .info p, .swagger-ui .info table, .swagger-ui .info a {
                font-size: 16px;
                line-height: 1.4em;
            }
            /* Removes authorize button and section */
            .scheme-container {
                display: none
            }
        `;
        body = body.toString()
            .replace(/((?:src|href)=['"])/g, '$1?doc&path=')
            // Some self-promotion
            .replace(/<\/style>/, `${css}\n  </style>`)
            .replace(/<title>[^<]*<\/title>/, `<title>Zotero's translation-server</title>`)
            // Replace the default url with ours, switch off validation &
            // limit the size of documents to apply syntax highlighting to
            .replace(/dom_id: '#swagger-ui'/, 'dom_id: "#swagger-ui", ' +
                'docExpansion: "none", defaultModelsExpandDepth: -1, validatorUrl: null, displayRequestDuration: true')
            .replace(/"https:\/\/petstore.swagger.io\/v2\/swagger.json"/,
                '"/?spec"');

        contentType = 'text/html';
    }
    if (/\.js$/.test(reqPath)) {
        contentType = 'text/javascript';
        body = body.toString()
            .replace(/underscore-min\.map/, '?doc&path=lib/underscore-min.map')
            .replace(/sourceMappingURL=/, 'sourceMappingURL=/?doc&path=');
    } else if (/\.png$/.test(reqPath)) {
        contentType = 'image/png';
    } else if (/\.map$/.test(reqPath)) {
        contentType = 'application/json';
    } else if (/\.ttf$/.test(reqPath)) {
        contentType = 'application/x-font-ttf';
    } else if (/\.css$/.test(reqPath)) {
        contentType = 'text/css';
        body = body.toString()
            .replace(/\.\.\/(images|fonts)\//g, '?doc&path=$1/')
            .replace(/sourceMappingURL=/, 'sourceMappingURL=/?doc&path=');
    }

    ctx.set('content-type', contentType);
    ctx.set('content-security-policy', DOC_CSP);
    ctx.set('x-content-security-policy', DOC_CSP);
    ctx.set('x-webkit-csp', DOC_CSP);
    ctx.response.body = (body.toString());

}

module.exports = {
    handle: async function (ctx, _next) {

        let spec = path.resolve('spec.yaml');

        if (spec.constructor !== Object) {
            try {
                spec = yaml.load(fs.readFileSync(spec));;
            } catch (e) {
                spec = {};
            }
        }

        if ({}.hasOwnProperty.call(ctx.request.query || {}, 'spec')) {
            ctx.set('content-type', 'application/json');
            ctx.response.body = spec;
        } else if ({}.hasOwnProperty.call(ctx.request.query || {}, 'doc')) {
            return processRequest(ctx);
        } else {
            _next();
        }
    }
}
