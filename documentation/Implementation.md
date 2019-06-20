This page gives details on the implementation of the Reference page and component types which is based on server side script and ISML templating technology. It also includes functional documentation related Asset Components. 

<!-- toc -->

- [Overview](#overview)
- [Page Rendering](#page-rendering)
- [The utilities](#the-utilities)
  * [RegionModelRegistry and RegionModel](#regionregister-and-regionmodel)
  * [ImageTransformation](#imagetransformation)
  * [PageRenderHelper](#pagerenderhelper)
- [Page Layouts](#page-layouts)
  * [Fixed Page Layout](#fixed-page-layout)
  * [Dynamic Page Layout](#dynamic-page-layout)
- [Asset Components](#asset-components)
  * [Category Tile](#category-tile)
  * [Rich Text Component](#rich-text-component)
  * [Headline Banner](#headline-banner)
  * [Product Tile](#product-tile)
  * [Rule Driven Product Tile](#rule-driven-product-tile)
- [Component Layouts](#component-layouts)
  * [X Column Layout](#x-column-layout)
  * [3 by 2 Grid Layout](#3-by-2-grid-layout)
  * [Carousel](#carousel)

<!-- tocstop -->

# Overview

This repository contains two cartridges that can be deployed to a Commerce Cloud instance, example data for site imports, build scripts, a few tests, and some documentation.

The cartridge `module_pagedesigner` contains the implementation of the component and page types.

The cartridge `bm_pagedesigner` contains icons and texts (properties that can be handed to translators) related to those types that will be shown in the visual editor.

Build scripts are explained in the README.md of the repository.

The remainder of this document will focus on the implementation of the page and component types in the cartridge `module_pagedesigner`. The overall structure of this cartridge looks like this:

```
cartridges/module_pagedesigner
└── cartridge
    ├── experience
    │   ├── components
    │   │   ├── assets
    │   │   └── layouts
    │   ├── pages
    │   └── utilities
    ├── static
    │   └── default
    │       └── css
    └── templates
        └── default
            ├── decoration
            └── experience
                ├── components
                │   ├── assets
                │   └── layouts
                └── pages
```

* `cartridge/experience` contains the server side logic and definitions of page and component types
    * `./components/assets` contains components that will have configurable attributes and render visible content. We call them Asset Components
    * `./components/layout` contains components that can contain child components and will render no or only limited visible content by themselves. We call them Layout Components.
    * `./pages` contains the page types
    * `./utilities` contains dwscript files for server side logic not related to a single page or component type.
* `cartridge/static/default/css` contains css for the storefront.
* `cartridge/templates` contains the isml used to render the pages
    * `./default/decoration` contains the isml used to decorate the pages for rendering in the storefront.
    * `./default/experience` contains the isml used for the page and component types. It mirrors the structure of `cartridge/experience`

# Page Rendering

Any storefront controller that wants to render a page has to fetch a page based on a given ID and trigger rendering of the same (if the page is found and currently visible to the current customer).

```javascript
// ...
exports.Show = function () {
    var page = PageMgr.getPage(request.httpParameterMap.cid.stringValue);

    // only render if the page is currently visible (this is driven by the published/unpublished setting,
    // scheduling and customer segmentation as configured for the page)
    if (page != null && page.isVisible()) {
        /*
         * Depending on your storefront implementation you might want to use other decorator templates.
         */
        var params = {
            // according to your storefront implementation pass the desired decorator (e.g. 'common/layout/page' for SFRA)
            decorator : null
        }
        response.writer.print(PageMgr.renderPage(page.ID, JSON.stringify(params)));
    } else {
        response.redirect(URLUtils.httpsHome().toString());
    }
};
exports.Show.public = true;
```

The provided sample page types are implemented as body fragments inside an `<isdecorate>`. You can use the `decorator` parameter to overwrite the decorator that will be used for the page. By default both pages use the simple `decorator.isml`. The details of the page layouts can be seen in the next section.

decorator.isml:
```html
<iscontent type="text/html" charset="UTF-8" compact="true"/>
<!DOCTYPE html>
<html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        
        <iscomment>page meta data</iscomment>
        <title><isprint value="${pdict.CurrentPageMetaData.title}" encoding="off" /></title>
        <meta name="description" content="${pdict.CurrentPageMetaData.description}"/>
        <meta name="keywords" content="${pdict.CurrentPageMetaData.keywords}"/>
        
        <iscomment>static resources for rendering</iscomment>
        <isloop items="${ require('*/cartridge/scripts/assets.js').styles }" var="style">
            <link rel="stylesheet" href="${style}" />
        </isloop>

        <isloop items="${ require('*/cartridge/scripts/assets.js').scripts }" var="script">
            <script defer type="text/javascript" src="${script}"></script>
        </isloop>

    </head>
    <body>
        <isreplace/>
    </body>
</html>
```

Keep in mind that the Page Designer is rendering the page with its own system controller (__SYSTEM__Page-Show?cid=xyz), so the page render logic must be implemented in a way that it also works isolated from a specific decorator template. This is why the default decorator has to be able to include the client side css and js files.

The Page Types both add the css files they need to the collection of assets to ensure they are included in the html head by the decorator, for example:

```html
    <isscript>
        var assets = require('*/cartridge/scripts/assets.js');
        assets.addCss('/css/layout.css');
        assets.addCss('/css/pagedesigner-bootstrap.min.css');
    </isscript>
```

The same applies to all the templates of the various component types that collect their assets as needed.

# The utilities

We have a couple utility scripts to make our live easier. `RegionRegister.js` and `RegionModel.js` make it easier to configure how regions are rendered. `PageRenderHelper` provides various convenience functionality.  `ImageTransformation.js` allows us to create DIS (Dynamic Imaging Service) parameters to create mobile and desktop versions from a single image file.

## assets.js

The information, which styles and scripts are needed is collected by the assets.js registry, as known from SFRA. It ensures only the necessary files are loaded. You will see many calls to `addJs` and `addCss` throughout the page and component types. The decorator then adds the necessary tags to the html head.

## PageRenderHelper

This helper allows us to generically generate the region register/model as outlined above based on the given page or component meta definition (read from its corresponding json file). Furthermore it allows to assemble the page meta data required by the request through the settings of the Page Designer page object and also provides functionality to determine the to be used decorator templates based on the passed render parameters.

## RegionModelRegistry and RegionModel

Page Designer pages are made up of regions that contain components. Each component can itself contain one or multiple regions. When rendering a page, each region and visible component will be wrapped inside an html element. To configure these region html elements and component html elements, you can use the `RegionRenderSetting`. The `RegionModel` wraps those settings to allow using a builder pattern call scheme instead of dealing with the settings object and the `PageMgr`.  The `RegionRegister` holds multiple `RegionModel` objects relating to a single page or parent component.

## ImageTransformation

Independently of the Page Designer, Commerce Cloud can be setup to work with a Dynamic Imaging Service that can resize and crop images before delivering them to the browser. `ImageTransformation` allows to keep multiple DIS configurations based on named devices and create the correct urls.

# Page Layouts
## Fixed Page Layout

The fixed page layout is intended to specify the entire layout and only the content should be configurable. The regions should determine their size by themselves and make sure that the wrapper element of the single component is allowed to fill it by scaling, if necessary.

The page layout will look like this:

![The Fixed Page Layout](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/FixedLayout.png)

These are the files in the `module_pagedesigner` cartridge involved in creating the page layout (unrelated files and directories are not shown):

```
cartridge/
│
├── experience/
│   │
│   ├── pages/
│   │   ├── fixedlayout.js
│   │   └── fixedlayout.json
│   │
│   └── utilities/
│       ├── RegionModel.js
│       ├── RegionsRegister.js
│       └── PageRenderHelper.js
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           └── layout.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── pages/
                └── fixedlayout.isml
```

The fixedlayout.js renders the type defined in fixedlayout.json. In our implementation this is done by calling `new Template(...).render`. The meat of the page type is in the template `fixedlayout.isml` and in `layout.css`. Some of the generic pieces are explained in [Page Rendering](#page-rendering).

The fixed page layout is created utilizing the [Bootstrap Grid](https://getbootstrap.com/docs/4.2/layout/grid/) to create a responsive layout (The same effect can be created using other 'grid' libraries). This means we wrap all our regions in two divs with appropriate Bootstrap classes:

fixedlayout.isml:
```html
<!-- ... -->
<div class="container-fluid page-container px-2 page-designer-reference">
    <div id="${pdict.page.ID}" class="row mx-n2">
    <!-- ... --->
    </div>
</div>
```

The regions of the page need to be styled using Bootstrap classes as well. We apply those classes to the DOM-element that Commerce Cloud will create for each region using `RegionModel` and `RegionRegister` via 'PageRenderHelper' that you find under `cartridge/experience/utilities`

fixedlayout.js:
```javascript
var Template = require('dw/util/Template');
var HashMap = require('dw/util/HashMap');
var PageRenderHelper = require('~/cartridge/experience/utilities/PageRenderHelper.js');

module.exports.render = function (context) {
    var model = new HashMap();
    var page = context.page;
    model.page = page;

    // automatically register configured regions
    model.regions = PageRenderHelper.getRegionModelRegistry(page);

    // determine seo meta data
    model.CurrentPageMetaData = PageRenderHelper.getPageMetaData(page);
    model.decorator = PageRenderHelper.determineDecorator(context);

    // render the page
    var expiryTime = new Date(Date.now());
    expiryTime.setMinutes(expiryTime.getMinutes() + 60);
    response.setExpires(expiryTime);
    return new Template('experience/pages/fixedlayout').render(model).text;
}
```

The resulting calls to render each region in ISML look like this:

```
<isprint value="${pdict.regions.region1.setClassName("region region_landscape-large col-12 col-md-12 px-2").render()}" encoding="off"/>
```

The class “`region`” allows us to apply custom styles to all our regions.

The class “`region_*`” allows us to custom style each grid cell individually.

The class “`col-*`” makes it respond to the Bootstrap Grid styles.

The class “`col-X`” also specifies how much of the page width the region will span on small screens. E.g. 12 means that the region will cover the full grid row it is on.

The class “`col-md-X`” specifies how much of the page width the region will span in medium and large screens. E.g. 4 means that the region will cover one third of the grid row it is on.

The file 'fixedlayout.isml' contains 11 such lines.

fixedlayout.isml:
```
<!-- ... -->
    <isprint value="${pdict.regions.region1.setClassName("region region_landscape-large col-12 col-md-12 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region2.setClassName("region region_square col-12 col-md-4 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region3.setClassName("region region_square col-12 col-md-4 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region4.setClassName("region region_square col-12 col-md-4 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region5.setClassName("region region_landscape-small col-12 col-md-6 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region6.setClassName("region region_landscape-small col-12 col-md-6 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region7.setClassName("region region_portrait-small col-6 col-md-3 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region8.setClassName("region region_portrait-small col-6 col-md-3 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region9.setClassName("region region_portrait-small col-6 col-md-3 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region10.setClassName("region region_portrait-small col-6 col-md-3 px-2").render()}" encoding="off"/>
    <isprint value="${pdict.regions.region11.setClassName("region region_landscape-large col-12 col-md-12 px-2").render()}" encoding="off"/>
<!-- ... -->
```

To achieve the design as desired, we use the following sizes:

| Grid row of final layout | Mobile Size | Desktop Size | Regions |
| --- | --- | --- | --- |
| row 1 = region_landscape-large (top banner) | 12  | 12 | region1 |
| row 2 = region_square (three squares) | 12 | 4 | region 2, region3, region4 |
| row 3 = region_landscape-small (two landscape regions) | 12 | 6 | region5, region6 |
| row 4 = region_portrait-small (4 portrait regions) | 6 | 3 | region7, region8, region9, region10 |
| row 5 = region region_landscape-large (bottom banner) | 12 | 12 | region11 |

Applying these Bootstrap classes results in the correct width and relative positioning of the regions. To make them also have the correct height, we will create some custom CSS rules. The styles for this page type are in `cartridge/static/default/css/layout.css`

To get the regions to always have the correct aspect ratio, even though the width may change when the screen size changes, we use the css attribute `padding`. When `padding` is defined in percentages, those always refer to the width of the parent element, even for `padding-top` and `padding-bottom`. We utilize this by setting a `padding-top` on an empty `::before` pseudo-element in each region. This will create the correct aspect ratio while the region is empty.

layout.css:
```csss
/*...*/
.region:before {
  display: block;
  content: "";
  width: 100%;
}
/*...*/

/* padding-top in percentages refers to parent width
   this allows us to specify an aspect-ratio         */
.region_landscape-large:before {
  padding-top: calc(400 / 1024 * 100%);
}

.region_square:before {
  padding-top: calc(1 / 1 * 100%);
}

.region_landscape-small:before {
  padding-top: calc(1 / 2 * 100%);
}

.region_portrait-small:before {
  padding-top: calc(2 / 1 * 100%);
}
```

Since this will push the actual content below the pseudo-element, we style the (single) component in this region to cover the space that is created by the padding trick instead of using the normal layout flow. Since we did not specify any classes for the components in the regions, they will all get the `experience-component` class.

layout.css:
```sss
.region {
  position: relative;
  margin-bottom: 0.75rem;
}

/*...*/

.region .experience-component {
  position: absolute;
  top: 0;
  bottom: 0;
  /*replicating the gutters*/
  left: 0.5rem;
  right: 0.5rem;
}
/*...*/
```

## Dynamic Page Layout
The Dynamic Page Layout is intended to allow the merchant to freely combine various layout pieces. The actual layouts will utilize the same concepts and styles as the fixed page layout. These are the files in the `module_pagedesigner` cartridge related to this page type:

```
cartridge/
│
├── experience/
│   │
│   ├── pages/
│   │   ├── dynamiclayout.js
│   │   └── dynamiclayout.json
│   │
│   └── utilities/
│       ├── RegionModel.js
│       ├── RegionsRegister.js
│       └── PageRenderHelper.js
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           └── layout.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── pages/
                └── dynamiclayout.isml
```

The difference to the fixed layout is that the page itself does not render any pre-sized regions. Instead it renders a single full width region that will grow as high as needed to fit the child components.

dynamiclayout.isml:
```html
<!-- ... -->
<div class="container px-2">
    <div id="${pdict.page.ID}" class="row mx-n2">
        <isprint value="${pdict.regions.main.setClassName("col-12 px-2").render()}" encoding="off"/>
    </div>
</div>
```

Asset Components will not display properly when inserted directly into this region, because it does not give them a size. They have to be wrapped by a Layout Component first. For the implementation of the layout components see [Component Layouts](#component-layouts).
# Asset Components

The idea behind our dynamic components is to allow merchants to use components in regions of different sizes without having to change the component itself. In other words, the merchant creates a component in the Page Designer, then decides to use this component in a different place. So, they drag the component to its new region. The expected result is that the merchant doesn't have to do anything else. The component is flexible enough that it can deal with the size and aspect ratio of the new region without user intervention. The components need a layout with regions that determine their size independent of their content and the fixed page layout described above does exactly that.

## Category Tile

This description will cover how we solved the just mentioned requirements with the category tile. However, the product tile and headline banner solve these issues in a very similar manner.

This is where the component files can be found within the structure of the `module_pagedesigner` cartridge:
(Files and directories not relevant for our example are left out.)

```
cartridge/
│
├── experience/
│   │
│   └── components/
│       │
│       └── assets/
│           ├── categorytile.js
│           └── categorytile.json
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           ├── categorytile.css
│           └── component.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── components/
                │
                └── assets/
                    └── categorytile.isml
```


The component consists of a DWscript, ISML and CSS. The DWscript in this case is 'categorytile.js' which is a typical controller that is used to expose date to the ISML template. 

Finally, every component has attribute definitions stored in a JSON file, in this case `categorytile.json`. The attribute definitions determine a) how the Page Designer renders the input fields in the component editing modal and b) how the data entered by the users is passed to the `render` function in the `categorytile.js` as the `context.content` parameter.

The structure of the template is a simple figure element with an image and a two-part caption. Here is a sketch of the html we want to produce:

```html
<figure>
  <a>
    <picture>
      <source/>
      <img/>
    </picture>
       <figcaption>
          <div>
              <span/></span>
          </div>
          <div>
              <span/></span>
          </div>
      </figcaption>
  </a>
</figure>
```

Once the template is in place, we need data. The data is exposed during ISML rendering using the `new Template(...).render()` function:

categorytile.js:
```javascript
//...
return new Template('experience/components/assets/categorytile').render(model).text;
//...
```

The `render` function requires the path to the ISML file we want to render and an object that carries all our data, in this case `model`. Exposing the data is pretty straightforward. We want to add the URL for the anchor element, so that the customer will land on the right category page when they click anywhere on our category tile. So, we add a property to the model:

categorytile.js:
```javascript
//...
var URLUtils = require('dw/web/URLUtils');
//...
module.exports.render = function (context) {
    //...
    model.url = URLUtils.url('Search-Show', 'cgid', context.content.category.ID);
    //...
    return new Template('experience/components/assets/categorytile').render(model).text;
}
//...
```

Next, we add a reference to the template. The IMSL renderer stores all the date we pass it via `model` on the `pdict` template variable. As a result we can simply put an expression into the `href` attribute of our anchor element. Once this is rendered with a valid URL, clicking the category tile will navigate the user where the URL points to.

categorytile.isml:
```html
<figure>
  <a href="${pdict.url}">
  <!-- ... --/>
  </a>
</figure>
```

There is more to our category tile. Besides our image, we want to be able to store a heading and an optional subheading and a way to align the headings to the left and center. Rendering the headings works with two different techniques. Since we can expect the merchant to always define a main heading, we are going to use `<isprint>`. The subheading is optional, however, so we need to use the conditional `isif` tag:

categorytile.isml:
```html
<div>
    <span><isprint value="${pdict.text_headline}"/></span>
</div>
<isif condition="${pdict.text_subline}">
    <div>
        <span><isprint value="${pdict.text_subline}"/></span>
    </div>
</isif>
```

The condition attribute of the `isif` tag makes sure that the markup inside the element will only be rendered if the `pdict`-attribute is defined. Since `isif` tags can be used anywhere in the template we can also use it later for the conditional alignment of the headings.
If we add all the conditionals and the data that we need the template and script should look something like this:
(Note, that the variable for the text alignment is already defined.)

categorytile.isml:
```html
<figure>
  <a href="${pdict.url}">
    <picture>
      <source srcset="${pdict.image.src.desktop}" media="(min-width: 48em)"/>
      <img src="${pdict.image.src.mobile}"/>
    </picture>
       <figcaption >
          <div>
              <span><isprint value="${pdict.text_headline}"/></span>
          </div>
          <isif condition="${pdict.text_subline}">
              <div>
                  <span><isprint value="${pdict.text_subline}"/></span>
              </div>
          </isif>
      </figcaption>
  </a>
</figure>
```

categorytile.js:
```javascript
var Template = require('dw/util/Template');
var HashMap = require('dw/util/HashMap');
var URLUtils = require('dw/web/URLUtils');
var ImageTransformation = require('~/cartridge/experience/utilities/ImageTransformation.js');

/**
 * Render logic for the component.categorytile.
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
    if(content.text_subline)
    {
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

    return new Template('experience/components/assets/categorytile').render(model).text;
};
```

Next, we will add CSS so the component fits itself into the fixed-size region. We are going to use the CSS properties [object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) and [object-position](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position) for this. Each region defines a box for content. These two properties allow us to control how the image passed to our template will arrange itself within that box. Even though the region and the image might have their own respective size and aspect ratio, we want the image to display in our region just fine. Note, that this works irrespective of the actual layout as long as the regions have a fixed width and height. The images will also arrange themselves for different views such as desktop and mobile. This can be achieved by setting `object-fit` to `cover` and using passed CSS variables (as given by the image focal point) for proper positioning:

component.css:
```css
.component-figure {
  width: 100%;
  height: 100%;
}

.component-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--focal-point-x) var(--focal-point-y);
}
```

Since this will be used for all images in our cartridge, it lives in the shared `component.css`  and the class name is not category-tile specific.
The `object-fit` property will scale the image to fit the parent element while keeping the image aspect ratio. While `object-position` aligns the image within the parent element. Setting `width` and `height` to `100%` ensures that the image is scaled to fill the entirety of the parent element.
In combination with the fixed regions the browser will effectively crop the scaled image and only show that part which is inside the box.

To Include the css file, we add it to the styles in the PageRenderHelper (we will create the categorytile.css soon):

categorytile.isml:
```html
<isscript>
    var assets = require('*/cartridge/scripts/assets.js');
    assets.addCss('/css/categorytile.css');
    assets.addCss('/css/component.css');
</isscript>
<!-- --!>
```


Next, we simply add the class to our template and it should work:

categorytile.isml:
```html
<figure class="component-figure">
    <!-- ... -->
        <img class="component-image" src="${pdict.image.src}" style="--focal-point-x:${pdict.image.focalPointX}; --focal-point-y:${pdict.image.focalPointY}"/>
    <!-- ... -->
</figure>
```

Now, that the image fits into the region, we can position the text within the region. Positioning the texts consists of two parts: vertical and horizontal positioning. We will start with vertical positioning. Looking at the template you can see that each heading consists of a `<span>` within a `<div>` element which is in turn wrapped within a `<figcaption>` element. The latter will be used for positioning:

categorytile.css:
```css
.category-text_container {
  position: absolute;
  bottom: 40%;
  width: 100%
}
/*...*/
```

We set the CSS position property of the `<figcaption>` to `absolute` so it positions itself in relation to the next higher block element which has a position value of `absolute` or `relative`, in this case a wrapper `div` rendered by the server.  The `bottom` property will push the `<figcaption>` element to the approximate middle of the `<figure>`. The class applies full width to the element for horizontal centering, which we will look at next.

Alignment to the left is default for HTML inline elements which is why it does not need to be specified explicitly. The centering is done by making sure the `<figcaption>` spans the full width of the `<figure>` and then setting its `text-align` property to `center`.

categorytile.isml:
```html
<!-- ... -->
<figcaption class="category-text_container" <isif condition="${pdict.text_alignment === 'center'}">style="text-align: center"</isif>>
<!-- ... -->

```

Last but not least, we are going to make the font-size a little more responsive. Mobile screen sizes vary a lot and we want our captions to grow and shrink with the screen. With desktop screens the situation is different since our layout is restricted to a width of  `80rem` which is `1200px`. This means that for screens larger than that, the components will not get larger. At that point, we don't want our captions to grow with the screen size since they might eventually get bigger than the components themselves
This leaves us with three scenarios: Mobile screen, desktop smaller than `80rem` and desktop `80rem` and above. The CSS for those scenarios looks like this:

categorytile.css:
```css
/*...*/
.category-text {
  padding-right: 0.5rem;
  padding-left: 0.5rem;
  background-color: rgb(0, 95, 178);
  color: white;
  display: inline-block;
}

.category-text_heading {
  font-weight: bold;
  font-size: 4vw;
}

.category-text_subheading {
  font-size: 3vw;
  letter-spacing: 1px;
}

@media (min-width: 768px) and (max-width: 1199.98px) {
  .category-text_heading {
    font-size: 2.5vw;
  }

  .category-text_subheading {
    font-size: 1.25vw;
  }
}

@media (min-width: 1200px) {
  .category-text_heading {
    font-size: 30px;
  }

  .category-text_subheading {
    font-size: 15px;
  }
}
```

The classes without a `@media` query are the standard case which is mobile for us. The CSS unit used here is `vw` which is one percent of the viewport width. In our case, the viewport is the screen, so it is one percent of the screen width. This means that the font-size of `.category-text_heading` is four percent of the screen width. Once the `@media` queries come into play, things become interesting. The query `@media only (min-width: 48em) and (max-width: 79em)` defines the styles for desktop screens narrower than 1200px while `@media only (min-width: 79em)` defines everything greater than that. As you can see, once the maximum size for our layout is reached, we use a fixed font-size. Until then the font grows and shrinks depending on the screen width thanks to CSS `vw`.


### Category Tile Fields 

![Category Tile Screenshot](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/producttilecomponent.jpg)

Category Tile Input Fields 

| Field Name | Required | Description |
| --- | --- | --- |
| Category | Yes  | On click, find category to link to |
| Image | Yes | On click, opens Select Media modal from where you can upload and select or select image.|
| Text Overlay | Heading |The following fields are related to text displayed on top of the image. |
| Heading| Yes | Heading displayed on category image |
| Subheading | Optional | Subheading displayed on category image. |
|Text Alignment | Yes | Select text alignment - left or center. |

## Rich Text Component
The richt text component is a very simple single parameter component, which renders richtext in a div,

This is where the component files can be found within the structure of the `module_pagedesigner` cartridge:
(Files and directories not relevant for our example are left out.)

```
cartridge/
│
├── experience/
│   │
│   └── components/
│       │
│       └── assets/
│           ├── texttile.js
│           └── texttile.json
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           ├── richtext.css
│           └── component.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── components/
                │
                └── assets/
                    └── richtext.isml
```

The serverside model creation and markup are very straightforward.

The css however worth pointing out. It switches the rendering from a geometric grid layout from the other layouts to use the content to define the height.

The rich text component, works best with text heavy pages with 2 columns or 2 roles. For complex layouts with cross grid-cell dependecies, headline banners are better suited.

```css
.region div.experience-component {
    position: unset;
}

div.region_landscape-large:before {
    padding-top:unset;
}

div.region_square:before {
    padding-top:unset;
}

div.region_landscape-small:before {
    padding-top:unset;
}

div.region_portrait-small:before {
    padding-top:unset;
}
```

## Headline Banner

The Headline Banner is very similar to the Category Tile. We have an image that should resize to fill the region, a heading and an optional subheading. The differences are that the Banner has no inherent Link and that the heading and subheading can be edited as rich text instead of plain text only.

This is where the component files can be found within the structure of the `module_pagedesigner` cartridge:
(Files and directories not relevant for our example are left out.)

```
cartridge/
│
├── experience/
│   │
│   └── components/
│       │
│       └── assets/
│           ├── headlinebanner.js
│           └── headlinebanner.json
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           ├── headlinebanner.css
│           └── component.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── components/
                │
                └── assets/
                    └── headlinebanner.isml
```

Most of the implementation is identical to the category tile. We still use the same approach to scale and crop the image,  we still have a `figcaption` for the heading and subheading, and we still use media queries to vary the font size as well as adding the merchant provided text into the markup.

headlinebanner.isml:
```html
<!-- ... -->
<div class="headlinebanner-text headlinebanner-text_heading">
    <isprint value="${pdict.text_headline}" encoding="off"/>
</div>
<isif condition="${pdict.text_subline}">
    <div class="headlinebanner-text headlinebanner-text_subheading">
        <isprint value="${pdict.text_subline}" encoding="off"/>
    </div>
</isif>
<!-- ... -->
```

### Headline Banner Fields 

![Headline Banner Screenshot](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/HeadlineBannerComponent.jpg)

Headline Banner Input Fields 

| Field Name | Required | Description |
| --- | --- | --- |
| Background | Headline | The visual display of hte banner header in the background.|
| Image | Yes | On click, opens Select Media modal from where you can upload and select or select image. |
| Text Overlay | Headline | Overlay text on top of the banner image. |
| Heading Text Box | Yes | Rich text editor to input headline. |
| Subheading Text Box | Optional | Rich text editor to input subheading. |

## Product Tile
The Product Tile is similar to the Category Tile in that it will show an image, resized to fill the entire region. The image will however not be specified by the merchant, instead it will be taken from the product configuration. In addition it shows a Headline defaulting to the product name and a 'Shop Now' button.

This is where the component files can be found within the structure of the `module_pagedesigner` cartridge:
(Files and directories not relevant for our example are left out.)

```
cartridge/
│
├── experience/
│   │
│   └── components/
│       │
│       └── assets/
│           ├── producttile.js
│           └── producttile.json
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           ├── producttile.css
│           └── component.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── components/
                │
                └── assets/
                    └── producttile.isml
```

This component type has two attributes, a product and an optional headline. The product will be resolved by the render engine and provided to the render function. We only need to get the url and alt text configured for the 'large' product image and pass it into the template.

producttile.js:
```javascript
// ...
module.exports.render = function (context) {
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

        model.url = URLUtils.url('Product-Show', 'pid', product.ID);
    } else {
        model.url = URLUtils.url('Home-Show');
    }

    model.text_headline = content.text_headline;

    return new Template('experience/components/assets/producttile').render(model).text;
};
// ...
```

We also want the headline to be the product name if not specified differently by the merchant. We should separate this business logic from presentation logic.

producttile.js:
```javascript
// ...
module.exports.render = function (context) {
    prepareContent(context);
    // ...    
};

/**
 * Fallback to the product's name in case no headline is explicitly given by the merchant.
 */
function prepareContent(context) {
    // fallback to product name in case no headline is explicitly given
    var content = context.content;
    if (!content.text_headline && content.product) {
        content.text_headline = content.product.getName();
    }
};
```

The markup follows the same principles as the category tile. The differences are that there is no focal point, the headline is white text on transparent background and we have a 'Shop Now' button in place of a subheading.

producttile.isml:
```html
<figure class="component-figure product_centered-text">
    <picture>
        <isif condition="${pdict.image}">
            <img class="component-image" src="${pdict.image.src}" <isif condition="${pdict.image.alt}">alt="${pdict.image.alt}" title="${pdict.image.alt}"</isif> />
        </isif>
    </picture>
    <figcaption class="product-text_container">
        <div>
            <span class="product-text"><isprint value="${pdict.text_headline}"/></span>
        </div>
        <div>
            <input class="producttile-button" type="button" onclick="window.location.href='${pdict.url}';" value="${Resource.msg('button.show_now', 'producttile', 'Shop Now')}"/>
        </div>
    </figcaption>
</figure>
```

Since the component sizing is already handled by the generic component classes, we do not need many custom styles, only positioning the text and applying the correct font settings.

producttile.css:
```css
.product-text {
  color: white;
  display: inline-block;
  line-height: 1.25;
  font-size: 1.25rem;
  font-weight: bold;
  padding-bottom: 12px;
}

.product-text_container {
  position: absolute;
  top: 65%;
  width: 100%;
}

.product_centered-text {
  text-align: center;
}

.producttile-button {
  cursor: pointer;
  padding: 0 1rem;
  border: 1px solid rgb(0, 112, 210);
  border-radius: 0.25rem;
  line-height: 1.875rem;
  background-color: white;
  color: rgb(0, 112, 210);
  user-select: none;
}

.producttile-button:hover {
  background-color: rgb(244, 246, 249);
  color: rgb(0, 112, 210);
}
```
### Product Tile Field 

![Product Tile Screenshot](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/producttilecomponent.jpg)

Product Tile Input Fields 

| Field Name | Required | Description |
| --- | --- | --- |
| Product Specifications | Headline | Specify the product to be displayed in this tile. |
| Product | Yes | Type or search for and input product ID. |
| Product Name | Optional | The text overlay to be displayed. If nothing is entered, the product name will be displayed.|
| Button Specification Link | Optional | Specify the link for the "Shop Now" button. If nothing is entered, the product name will be displayed.|

### Rule Driven Product Tile 

![Rule Driven Product Tile Screenshot](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/RuleDrivenProductTile.jpg)

Rule Driven Product Tile Input Fields 

| Field Name | Required | Description |
| --- | --- | --- |
| Product Specifications | Heading | Specify the product to be displayed in this tile. |
| Sorting Rule | Yes | The Sorting rule used to search the whole catalog. |
| Button Specification Link | Optional | Specify the link for the "Shop Now" button. If nothing is entered, the product name will be displayed. |
| Link | Optional | Optional specification for the link to where the user will be directed. If nothing is specified, the link to product SKU selected will be used.


## Rule Driven Product Tile
The Rule Driven Product Tile is similar to the Product Tile in that it will show an image, resized to fill the entire region of a product. The product will be picked from a category and a sorting rule, so merachts can select the topselling dress for instance,

This is where the component files can be found within the structure of the `module_pagedesigner` cartridge:
(Files and directories not relevant for our example are left out.)

```
cartridge/
│
├── experience/
│   │
│   └── components/
│       │
│       └── assets/
│           ├── ruledrivenproducttile.js
│           └── ruledrivenproducttile.json
│
├── static/
│   │
│   └── default/
│       │
│       └── css/
│           ├── producttile.css
│           └── component.css
│
└── templates/
    │
    └── default/
        │
        └── experience/
            │
            └── components/
                │
                └── assets/
                    └── producttile.isml
```

This component type has three attributes, a sorting rule an optional category (which defalt to 'root') and an optional headline. The product will be resolved by the ProductSearchModel API. We only need to get the url and alt text configured for the 'large' product image and pass it into the template.

ruledrivenproducttile.js:
```javascript
// ...
module.exports.render = function (context) {
    var model = new HashMap();

    var content = context.content;

    var sortingRuleID = content.sorting_rule;
    var sortingRule = sortingRuleID ? CatalogMgr.getSortingRule(sortingRuleID) : null;

    model.url = URLUtils.url('Home-Show');

    if (sortingRule) {
        var searchModel = new ProductSearchModel();
        searchModel.setCategoryID('root');
        if (content.category) {
            searchModel.setCategoryID(content.category.ID);
        }
        searchModel.setSortingRule(sortingRule);
        searchModel.search();
        var hits = searchModel.getProductSearchHits();
        var product = hits ? searchModel.getProductSearchHits().next().product : null;
        if (product) {
            var images = product.getImages('large'); // make the product image type configurable by the component?
            var productImage = images.iterator().next();
            if (productImage) {
                model.image = {
                    src : productImage.getAbsURL(),
                    alt : productImage.getAlt()
                };
            }
            if (!content.text_headline && product) {
                content.text_headline = product.getName();
            }

            // fallback to product link or home page if no shopping link is explicitly given
            if (!content.shop_now_target) {
                model.url = URLUtils.url('Product-Show', 'pid', product.ID);
            } else {
                model.url = content.shop_now_target;
            }
        }
    }

    model.text_headline = content.text_headline;

    return new Template('experience/components/assets/producttile').render(model).text;
};
// ...
```

The markup is using the template used already for the product tile. Please refer to the chapter above


# Component Layouts
The [Dynamic Page Layout](#dynamic-page-layout) makes sure that components placed directly in the root region of the page are rendered as full width cells. Each of our Layout Components will then use a separate Bootstrap Grid `row` to create the regions that hold the asset components.

While the Page Designer also allows nesting of Components multiple levels deep, this set of components is not intended for more than one. This means that placing a layout component inside another layout component may result in a 'broken' look. We defined 'component type exclusions' to prevent this (see 2column.json below for an example)

## X Column Layout
 The 1,2,3 and 4 Column Layout create the same look as the rows of the fixed layout page. These are the related files in the `module_pagedesigner` cartridge:

 ```
 cartridge/
 │
 ├── experience/
 │   │
 │   ├── components/
 │   │   │
 │   │   └── layouts
 │   │       ├── 1column.js
 │   │       ├── 1column.json
 │   │       ├── 2column.js
 │   │       ├── 2column.json
 │   │       ├── 3column.js
 │   │       ├── 3column.json
 │   │       ├── 4column.js
 │   │       └── 4column.json
 │   │
 │   └── utilities/
 │       ├── RegionModel.js
 │       ├── RegionsRegister.js
 │       └── PageRenderHelper.js
 │
 ├── static/
 │   │
 │   └── default/
 │       │
 │       └── css/
 │           └── layout.css
 │
 └── templates/
     │
     └── default/
         │
         └── experience/
             │
             └── components/
                 │
                 └── layouts/
                     ├── 1column.isml
                     ├── 2column.isml
                     ├── 3column.isml
                     └── 4column.isml

 ```

Each of these components creates a Bootstrap Grid `row` and renders the appropriate number of regions in it. The regions themselves are styled the same way as in the [Fixed Page Layout](#fixed-page-layout), using the same classes and the same css files. For example the 2 Column Component looks like this:

2column.js:
```javascript
/ ...
module.exports.render = function (context) {
    var model = new HashMap();
    var component = context.component;

    // automatically register configured regions
    model.regions = PageRenderHelper.getRegionModelRegistry(component);

    return new Template('experience/components/layouts/2column').render(model).text;
};
```

2column.isml:
```html
<isscript>
    var assets = require('*/cartridge/scripts/assets.js');
    assets.addCss('/css/layout.css');
    assets.addCss('/css/pagedesigner-bootstrap.min.css');
</isscript>
<div class="row mx-n2">
	<isprint value="${pdict.regions.column1.setClassName("region region_landscape-small col-12 col-md-6 px-2").render()}" encoding="off"/>
	<isprint value="${pdict.regions.column2.setClassName("region region_landscape-small col-12 col-md-6 px-2").render()}" encoding="off"/>
</div>
```

We decided to add the css files again, because we want to make the component types as self contained as possible, so they should not rely on the page type including the css. The PageRenderHelper uses `LinkedHashSet` to make sure each file is only included once.

The json file has to specify the regions of the component the same way the regions of a page are specified. We also include the mentioned component type exclusions to prevent nesting layout components:

2column.json
```json
{
  "id": "2column",
  "name": "1 Row, 2 Column, Landscape",
  "group": "layouts",
  "attribute_definition_groups": [],
  "region_definitions": [
      {
        "id":"column1",
        "name":"Column 1",
        "max_components":1,
        "component_type_exclusions": [
          { "type_id": "1column" },
          { "type_id": "2column" },
          { "type_id": "3column" },
          { "type_id": "4column" },
          { "type_id": "gridcomponentlayout" }
        ]
      },
      {
        "id":"column2",
        "name":"Column 2",
        "max_components":1,
        "component_type_exclusions": [
          { "type_id": "1column" },
          { "type_id": "2column" },
          { "type_id": "3column" },
          { "type_id": "4column" },
          { "type_id": "gridcomponentlayout" }
        ]
      }
  ]
}
```
### 1 x 2 Grid Layout Example

![1x2 Grid Layout](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/1x2.jpg)

### 1 x 3 Grid Layout Example

![1x3 Grid Layout](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/1x3.jpg)

### 1 x 4 Grid Layout Example 

![1x4 Grid Layout](https://github.com/SalesforceCommerceCloud/page-designer-reference/blob/master/documentation/img/1x4.jpg)

## 3 by 2 Grid Layout
The 3 by 2 Grid Layout uses a different approach. It has only one region, that can contain up to 6 children and lay them out in a grid layout. 3 wide and 2 high on Desktop, 2 wide and 3 high on mobile devices. If it contains less than 6 components, it will still have the same size and show empty space. This is consistent with the empty versions of the other layout components. 

These are the files that implement this component:

```
cartridge/
 │
 ├── experience/
 │   │
 │   ├── components/
 │   │   │
 │   │   └── layouts
 │   │       ├── gridcomponentlayout.js
 │   │       └── gridcomponentlayout.json
 │   │
 │   └── utilities/
 │       ├── RegionModel.js
 │       ├── RegionsRegister.js
 │       └── PageRenderHelper.js
 │
 ├── static/
 │   │
 │   └── default/
 │       │
 │       └── css/
 │           ├── gridcomponentlayout.css
 │           └── layout.css
 │
 └── templates/
     │
     └── default/
         │
         └── experience/
             │
             └── components/
                 │
                 └── layouts/
                     └── gridcomponentlayout.isml
```

The grid layout is different from all other regions so far in that it is not the region itself that has the `padding-top` set to achieve a consistent aspect ratio, but a `div` around the region. We still use the existing class `region` and the `padding-top` on a `:before` to achieve this, but the region itself is a Bootstrap Grid `row` styled to stretch to fill its parent element. We then apply classes to the individual component wrappers to make them work in the grid.

Here is a sketch of the html we want to produce:

```html
<div class="region gridcomponentlayout-container col-12 ... "> <!-- part of layout component, constant aspect ratio using ::before and padding-top -->
    <div class="gridcomponentlayout-region row ... "> <!-- region wrapper, fills parent -->
        <div class="gridcomponentlayout-component col-X ..."> <!-- asset component wrapper, sized in percentage of parent -->
            <!-- asset component content -->
        </div>
    </div>
<div>
```

We create it by overriding the classes of both the region wrapper and the component wrapper:

gridcomponentlayout.isml:
```html
<!-- ... -->
<div class="region gridcomponentlayout-container col-12 col-md-12 px-2">
	<isprint value="${pdict.regions.components.setClassName("gridcomponentlayout-region row mx-0").setComponentClassName("gridcomponentlayout-component col-6 col-md-4 px-2").render();}" encoding="off"/>
</div>
```

To achieves a consistently sized Layout that is filled by the inner grid, we apply the `padding-top` at the container and the 'fill parent' styles that the component wrappers get in other layouts to the region wrapper:

gridcomponentlayout.css:
```css
/*...*/
.gridcomponentlayout-region {
  position: absolute;
  top: 0;
  bottom: 0;
  /*replicating gutters negative margin*/
  left: -0.5rem;
  right: -0.5rem;
}

.gridcomponentlayout-container:before {
  /* each child component is 2 by 3, we have 2 by 3 children */
  /* width/height = 2/3 * 2/3 = 4/9 */
  padding-top: calc(9 / 4 * 100%);
}

/* ... */

@media (min-width: 768px) {
  .gridcomponentlayout-container:before {
    /* each child component is 2 by 3, we have 3 by 2 children */
    /* width/height = 2/3 * 3/2 = 1/1 */
    padding-top: calc(1 / 1 * 100%);
  }
  /* ... */
}

```

The width of the asset components is created by the Bootstrap Grid `col-*` classes. To achieve a consistent height we apply our own percentage based rules:

gridcomponentlayout.css:
```css
/*...*/
/* we want to have 3 rows plus gutters */
.gridcomponentlayout-region .gridcomponentlayout-component {
  height: calc(33.33% - 2 * 0.5rem);
  position: relative;
}

@media (min-width: 768px) {
  /* ... */
  .gridcomponentlayout-region .gridcomponentlayout-component {
    /* we want to have 2 rows plus gutters */
    height: calc(50% - 2 * 0.5rem);
  }
}
```


The Grid Layout also has an optional title. If specified by the Merchant, the title will be rendered on top of the actual grid.

gridcomponentlayout.isml:
```html
<isif condition="${pdict.text_headline}">
  <div class="gridcomponentlayout-text_container">
      <span class="gridcomponentlayout-text gridcomponentlayout-text_heading"><isprint value="${pdict.text_headline}"/></span>
  </div>
</isif>
<!-- ... -->
```

It is centered horizontally and utilizes the same sizing mechanisms as the texts in the Asset Components, but is colored differently.

gridcomponentlayout.css:
```css
.gridcomponentlayout-text_container {
  text-align: center;
  width: 100%;
  margin-bottom: 0.75rem;
}

.gridcomponentlayout-text {
  padding-right: 0.75rem;
  padding-left: 0.75rem;
  display: inline-block;
  line-height: 1.25;

  background-color: rgb(250, 250, 249);
  color: rgb(22, 50, 92);
}

.gridcomponentlayout-text_heading {
  font-weight: bold;
  font-size: 4vw;
}

.gridcomponentlayout-text_heading {
  font-weight: bold;
  font-size: 4vw;
}

@media (min-width: 768px) and (max-width: 1199.98px) {
  .gridcomponentlayout-text_heading {
    font-size: 2.5vw;
  }
}

@media (min-width: 1200px) {
  .gridcomponentlayout-text_heading {
    font-size: 30px;
  }
}
/*...*/
```

## Carousel

The Carousel is implemented as a [Bootstrap Carousel](https://getbootstrap.com/docs/4.0/components/carousel/). It uses a single region to house an arbitrary number of subcomponents to be used as slides. The corresponding classes are applied using the `RegionModel`. A wrapper `div` receives the `carousel slide` classes and the `data-` attributes that configure the carousel. The region wrapper receives the `carousel-inner` class. All component wrappers receive the `carousel-item` class and the first component wrapper additionally receives the `active` class.

carousel.isml
```html
<!-- ... -->
<div id="${pdict.id}" class="carousel slide" data-ride="carousel" data-interval="5000">
	<isprint
		value="${pdict.regions.slides
			.setClassName("carousel-inner")
			.setComponentClassName("carousel-item")
			.setComponentClassName("carousel-item active", 0)
			.render()}"
		encoding="off"/>

	<!-- ... -->
</div>
```

The carousel will stretch to fill the component wrapper as configured by the parent component and configure the component wrappers of the slides to fill the carousel. This allows it to be placed in all the Page Layouts and All Layout Components and allows all Asset Components to be placed inside the carousel. While nesting carousels would technically work, it does not produce a good customer experience, so we prevent it using the component type exclusions.
