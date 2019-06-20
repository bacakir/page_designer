'use strict';

var guard = require('*/cartridge/scripts/guard');
var PageMgr = require('dw/experience/PageMgr');

function show() {
    var page = PageMgr.getPage(request.httpParameterMap.cid.value);
    var params = {};
    if (request.httpParameterMap.view.submitted && request.httpParameterMap.view.value === 'ajax') {
        params.decorator = 'common/layout/ajax';
    }

    if (page != null && page.isVisible()) {
        response.writer.print(PageMgr.renderPage(page.ID, JSON.stringify(params)));
    } else {
        return module.superModule.Show();
    }
}

/** @see module:controllers/Page~show */
exports.Show = guard.ensure(['get'], show);
exports.Include = module.superModule.Include;
