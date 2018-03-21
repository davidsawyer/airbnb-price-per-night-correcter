const DEBUG_MODE = false
const oldCL = console.log
console.log = function() {
    if (DEBUG_MODE) {
        oldCL.apply(this, arguments)
    }
}

const WITHOUT_FEES_TEXT = 'per night (without fees)'
const WITH_FEES_TEXT = 'per night, including fees'
/*
    other possible ways to say the above:
        - real price per night
        - REAL price per night
        - per night, all-in
        - is the full price per night
        - all-in per night
        - per night, after fees
        - per night, after taxes/fees
        - per night, including fees
        - per night, including taxes and fees
*/


let containerPerNightPriceDivObserver

const VIEWPORT = Object.freeze({
    SKINNY: 'SKINNY',
    MEDIUM: 'MEDIUM',
    WIDE: 'WIDE'
})

let lastViewportState
let currentViewportState

const fullPageObserver = new MutationObserver(() => {
    const $form = $('#book_it_form')
    if ($form.length) {
        currentViewportState = $form.closest('#room').length ?
            VIEWPORT.WIDE :
            $form.closest('div[aria-modal="true"]').length ?
                VIEWPORT.MEDIUM :
                VIEWPORT.SKINNY

        console.log(`${lastViewportState} --- ${currentViewportState}`)

        if (! containerPerNightPriceDivObserver || currentViewportState != lastViewportState) {

            // attempt to modify the price in case we're returning to a wider viewport from
            // a skinner one where there was no visible book_it_form
            const result = modifyPerNightPrice()
            if (result) {
                const containerPerNightPriceDiv = $form.prev().find('div').first()[0]
                containerPerNightPriceDivObserver = new MutationObserver(handleMutations)
                containerPerNightPriceDivObserver.observe(containerPerNightPriceDiv, { childList: true, subtree: true })
            }
        }
    } else if (! $form.length && containerPerNightPriceDivObserver) { // if there's a skinny viewport
        containerPerNightPriceDivObserver = undefined

        // TODO: maybe make this selector a little more specific
        $('#room').find(':contains("per night")').last().text(WITHOUT_FEES_TEXT)
    }

    lastViewportState = currentViewportState
})

// pretty sure observing the body doesn't markedly affect performance
fullPageObserver.observe($('body')[0], { childList: true, subtree: true })


//----------------------------------------------------------------------------------------------------------------------


const CHECKMARK_ID = 'airbnb-pernight-price-correcter-checkmark'
const HAS_BEEN_MODIFIED_CLASS = 'airbnb-pernight-price-correcter-has-modified-this'

function handleMutations(mutations) {
    mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
            // don't do anything when we add the checkmark div, or otherwise the browser will get
            // caught in an infinite loop
            if (mutation.addedNodes[0].id && mutation.addedNodes[0].id == CHECKMARK_ID) {
                return
            }

            // TODO: Maybe make this check a little more robust. Checking for something that we're
            // also adding could cause an infinite loop of events and crash the browser.
            if (mutation.addedNodes[0].classList
                && ! [...mutation.addedNodes[0].classList.values()].includes(HAS_BEEN_MODIFIED_CLASS)) {
                modifyPerNightPrice()
            }
        }
        console.log(mutation)
    })
}

function modifyPerNightPrice() {
    console.log('modifyPerNightPrice.............................')

    const $form = $('#book_it_form')
    if (! $form.length) {
        return false
    }

    const $originalPerNightPriceDiv = $form.prev().find(':contains("per night")').first()
    if (! $originalPerNightPriceDiv.length) {
        console.log('Can\'t find "per night", or it\'s not in English. Stopping!')
        return false
    }

    const originalPerNightPriceDivText = $originalPerNightPriceDiv.text()
    const priceEndIndex = originalPerNightPriceDivText.indexOf('per night')
    const originalPerNightPrice = originalPerNightPriceDivText.substring(0, priceEndIndex).trim()

    console.log('original per night price:', $originalPerNightPriceDiv.text())

    const totalPrice = safeParseInt($form.find('div:contains("Total")').last().next().text())

    console.log('total price:', totalPrice)

    const $originalPerNightPriceSpan = $originalPerNightPriceDiv.find(`:contains("${originalPerNightPrice}")`).last()
    const $originalPerNightSpan = $originalPerNightPriceDiv.find(':contains("per night")').last()

    const numOfNightsText = $form.find(':contains(" x ")').last().text()

    // if the length of stay has already been set by the user
    if (numOfNightsText) {
        const numOfNights = safeParseInt(numOfNightsText.match(/ x \d+/g, '')[0])

        console.log('number of nights:', numOfNights)

        const currencySign = $originalPerNightPriceSpan.text().substring(0, 1)

        console.log('currency sign:', currencySign)

        const realPricePerNight = totalPrice / numOfNights
        const formattedRealPricePerNight = currencySign + (
            Number.isInteger(realPricePerNight) ?
                realPricePerNight.toLocaleString('en-US') :
                realPricePerNight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        )

        console.log('real price per night:', formattedRealPricePerNight)

        $originalPerNightPriceSpan.text(formattedRealPricePerNight).addClass(HAS_BEEN_MODIFIED_CLASS)
        $originalPerNightSpan.text(WITH_FEES_TEXT).addClass(HAS_BEEN_MODIFIED_CLASS)
        $originalPerNightSpan.after(`<div id="${CHECKMARK_ID}" class={"${HAS_BEEN_MODIFIED_CLASS}"}></div>`)
    } else {
        $originalPerNightSpan.text(WITHOUT_FEES_TEXT).addClass(HAS_BEEN_MODIFIED_CLASS)
    }

    return true
}

// strip non digits, then return the int
function safeParseInt(str) {
    return parseInt(str.replace(/\D/g, ''), 10)
}
