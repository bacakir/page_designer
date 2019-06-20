'use strict';

var server = require('server');
server.extend(module.superModule);

var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var pageMetaData = require('*/cartridge/scripts/middleware/pageMetaData');
var PageMgr = require('dw/experience/PageMgr');

server.append('Show', consentTracking.consent, function (req, res, next) {
    var page = PageMgr.getPage(req.querystring.cid);
    var params = {};
    if (page != null && page.isVisible()) {
        if (!page.hasVisibilityRules()) {
            var ONE_WEEK = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
            response.setExpires(ONE_WEEK);
        }

        if (req.querystring.view && req.querystring.view === 'ajax') {
            params.decorator = 'common/layout/ajax';
        }
        response.writer.print(PageMgr.renderPage(page.ID, JSON.stringify(params)));
    } else {
        next();
    }
}, pageMetaData.computedPageMetaData);

module.exports = server.exports();
