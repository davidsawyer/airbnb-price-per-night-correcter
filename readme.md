# Airbnb Price Per Night Correcter

_A browser extension that gives you the real price per night of an Airbnb stay after accounting for any and all fees_

<p align="center">
  <img src="/misc/demo.gif" width="390px" align="center" alt="demo" />
</p>

## where to find it

[Chrome](https://chrome.google.com/webstore/detail/airbnb-price-per-night-co/lijeilcglmadpkbengpkfnkpmcehecfe) and [Firefox](https://addons.mozilla.org/en-US/firefox/addon/airbnb-price-per-night-correct/)

If you like this project, [send me a tip 🙏🏼](https://www.paypal.me/davidsawyer1/2)

## the pitch

Ever get sick of Airbnb showing you the price per night of a listing and NOT including the taxes and fees in that nightly price? It's misleading, right? No one likes the feeling of getting nickeled and dimed when they're trying to book lodging, especially when those extra fees can make a massive difference in the price per night of the stay. This extension fixes all of that and will hopefully protect you from being fooled into paying more per night of your Airbnb stay than you had originally planned. It will show you the all-in price per night of any Airbnb listing.

APPNC corrects prices in the following situations:

1. basic listings
1. on sale listings
1. listings with a cancellation policy (hidden price details)
1. plus listings
1. handling of a more whitespace-heavy UI that seems to be the treatment side of an A/B test ([before](https://i.imgur.com/LCilfk8.png) vs. [after](https://i.imgur.com/QooSEui.jpg))
1. non-refundable/refundable radio button UI

Note: USD, EUR, and GBP are the only officially supported currencies at the moment. English, Spanish, and French are the only supported languages.

## building and running locally

In order to get up and running locally, you'll need to:

1.  pull down the project
1.  if you use nvm, run `nvm use` to make sure you're on a compatible version of node
1.  run `npm install` from the project root
1.  run `npm run develop` (this will build the JS and CSS that the browser will use and then will continue to listen to changes to source files)
1.  go to `chrome://extensions` in Chrome or `about:debugging` in Firefox
1.  make sure "Developer mode" is on if you're on Chrome
1.  click "Load unpacked extension..." on Chrome or "Load Temporary Add-on" on Firefox
1.  choose the project root directory for Chrome or a zipped directory by gulp for Firefox (you can create a zipped directory for Firefox by running `npm run prod`), and you should now be able to run the extension in your browser!

## todos

-   [ ] investigate showing the correct nightly price for all listings on the search page (seemed VERY infeasible when I last checked)
-   [ ] handle monthly price
-   [ ] handle more currencies

## thanks

-   Nick Beyer - bug hunter
-   [Alex Hofsteede](https://github.com/alex-hofsteede) - code contributions
-   Jamel Boubakri - translation
