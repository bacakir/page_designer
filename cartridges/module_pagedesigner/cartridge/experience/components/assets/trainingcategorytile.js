'use strict';

var Template = require('dw/util/Template');
var HashMap = require('dw/util/HashMap');
var URLUtils = require('dw/web/URLUtils');
var ImageTransformation = require('~/cartridge/experience/utilities/ImageTransformation.js');

/**
 * Render logic for the assets.categorytile.
 */
module.exports.render = function (context) {
    var model = new HashMap();
    var content = context.content;
    var category = content.category;
    /*
    * If no image url was provided, clicking the category tile will lead the user back to the home page.
    */
    if (category) {
        model.url = URLUtils.url('Search-Show', 'cgid', category.ID);
    } else {
        model.url = URLUtils.url('Home-Show');
    }

    model.text_headline = content.text_headline;
    if (content.text_subline) {
        model.text_subline = content.text_subline;
    }
    model.text_alignment = content.text_alignment == 'Left' ? 'left' : 'center';

    if (content.image) {
        var mobileImageTransformation = ImageTransformation.scale(content.image.metaData, 'mobile');
        var desktopImageTransformation = ImageTransformation.scale(content.image.metaData, 'desktop');

        model.image = {
            src: {
                mobile  : ImageTransformation.url(content.image.file, mobileImageTransformation),
                desktop : ImageTransformation.url(content.image.file, desktopImageTransformation)
            },
            alt         : content.image.file.getAlt(),
            focalPointX : content.image.focalPoint.x * 100 + '%',
            focalPointY : content.image.focalPoint.y * 100 + '%'
        };
    }

    model.color = content.color;

    return new Template('experience/components/assets/trainingcategorytile').render(model).text;
};