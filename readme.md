# Airbnb Price Per Night Correcter

*A browser extension that gives you the real price per night of an Airbnb stay after accounting for any and all fees*

## where to find it

[Chrome](https://chrome.google.com/webstore/detail/airbnb-price-per-night-co/lijeilcglmadpkbengpkfnkpmcehecfe) and [Firefox](https://addons.mozilla.org/en-US/firefox/addon/airbnb-price-per-night-correct/)

If you like this project, [send me a tip 🙏🏼](https://www.paypal.me/davidsawyer1/2)

## building and running locally

In order to get up and running locally, you'll need to:

1. pull down the project
1. if you use nvm, run `nvm use` to make sure you're on a compatible version of node
1. run `npm install` from the project root
1. make sure gulp is installed globally: `npm install -g gulp`
1. run `gulp` (this will build the js file and css file that the browser will use and will continue to listen to changes to source files)
1. go to `chrome://extensions` in Chrome or `about:debugging` in Firefox
1. make sure "Developer mode" is on if you're on Chrome
1. click "Load unpacked extension..." on Chrome or "Load Temporary Add-on"
1. choose the project root directory for Chrome or a zipped directory by gulp for Firefox (via `gulp prod`), and you should be good to go!

## todos
- [ ] handle monthly price
- [ ] add support for Airbnb Plus
- [ ] add prettier
- [ ] add French translation (and general infrastructure to support i18n)
- [ ] handle all currencies
- [ ] include banner on top of page to notify user if the scraping is broken
- [ ] Safari version
- [ ] investigate showing the correct price per night for all listings on the search page

<p align="center">
  <img src="/misc/demo.gif" width="390px" align="center" alt="demo" />
</p>

## thanks

- [Alex Hofsteede](https://github.com/alex-hofsteede)
