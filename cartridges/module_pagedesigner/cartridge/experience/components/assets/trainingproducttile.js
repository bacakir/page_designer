'use strict';

var Template = require('dw/util/Template');
var HashMap = require('dw/util/HashMap');
var URLUtils = require('dw/web/URLUtils');

/**
 * Fallback to the product's name and default product link in case none are explicitly given by the merchant.
 */
function prepareContent(context) {
    // fallback to product name in case no headline is explicitly given
    var content = context.content;
    var product = content.product;
    var priceModel = product.getPriceModel();

    if (!content.text_headline && content.product) {
        content.text_headline = content.product.getName();
    }

    // fallback to product link or home page if no shopping link is explicitly given
    if (!content.shop_now_target) {
        if (product) {
            content.shop_now_target = URLUtils.url('Product-Show', 'pid', product.ID);
        } else {
            content.shop_now_target = URLUtils.url('Home-Show');
        }
    }

    content.description = product.shortDescription.markup || '';
    content.salesPrice = priceModel.maxPrice;
}

/**
 * Render logic for the assets.producttile.
 */
module.exports.render = function (context) {
    prepareContent(context);

    var model = new HashMap();
    var content = context.content;

    var product = content.product;

    if (product) {
        var images = product.getImages('large'); // make the product image type configurable by the component?
        var productImage = images.iterator().next();
        if (productImage) {
            model.image = {
                src : productImage.getAbsURL(),
                alt : productImage.getAlt()
            };
        }
    }

    model.url = content.shop_now_target;

    model.text_headline = content.text_headline;
    model.description = content.description;
    model.price = content.salesPrice.value;

    return new Template('experience/components/assets/trainingproducttile').render(model).text;
};