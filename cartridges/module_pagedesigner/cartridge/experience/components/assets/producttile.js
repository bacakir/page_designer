'use strict';

var Template = require('dw/util/Template');
var ProductViewModel = require('*/cartridge/experience/viewmodels/ProductViewModel');

/**
 * Render logic for the assets.producttile.
 */
module.exports.render = function (context) {
    var content = context.content;

    var product = content.product;
    var model = ProductViewModel.get(product);

    // overload with explicite configs
    if (content.shop_now_target) {
        model.url = content.shop_now_target;
    }
    if (content.text_headline) {
        model.text_headline = content.text_headline;
    }
    return new Template('experience/components/assets/producttile').render(model).text;
};
