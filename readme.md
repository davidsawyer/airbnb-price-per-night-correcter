# Airbnb Price Per Night Correcter

*A Chrome Extension that gives you the real price per night of an Airbnb stay after accounting for any and all fees*

## building and running locally

In order to get up and running locally, you'll need to:

1. pull down the project
1. if you use nvm, run `nvm use` to make sure you're on a compatible version of node
1. run `npm install` from the project root
1. make sure gulp installed globally: `npm install -g gulp`)
1. run `gulp` (this will build the js file and css file that Chrome will use and continue to listen to changes to source files)
1. go to `chrome://extensions` in Chrome
1. make sure "Developer mode" is on
1. click "Load unpacked extension..."
1. choose the project root directory, and you should be good to go!

## todos
- [ ] include banner on top of page to notify user if the scraping is broken
- [ ] handle non-US currencies
- [ ] firefox version

<p align="center">
  <img src="/dist/images/demo.gif" width="390px" align="center" alt="demo" />
</p>
