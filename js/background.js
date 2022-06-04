chrome.runtime.onInstalled.addListener(object => {
    if (object.reason === 'install') {
        chrome.storage.sync.set({ roamerPopupDateMillis: new Date().getTime() + 1000 * 60 * 60 * 24 * 30 }) // thirty days from now
    }
})

chrome.runtime.onMessage.addListener(request => {
    if (request.type === 'openRoamerTab') {
        chrome.tabs.create({ url: 'https://tryroamer.com/price-per-night' })
    }
})
