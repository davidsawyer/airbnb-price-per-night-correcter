const DEBUG_MODE = false
const oldCL = console.log
console.log = function(...params) {
    if (DEBUG_MODE) {
        oldCL.apply(this, params)
    }
}

const DAY_MILLIS = 86400000

const i18n = {
    en: {
        PER_NIGHT: 'per night',
        SLASH_NIGHT: '/ night',
        TOTAL: 'Total',
        WITHOUT_FEES: '/ night (without fees)',
        WITH_FEES: '/ night, including fees',
    },
    es: {
        PER_NIGHT: 'por noche',
        SLASH_NIGHT: '/noche',
        TOTAL: 'Total',
        WITHOUT_FEES: '/noche (sin cuota de servicio)',
        WITH_FEES: '/noche, con cuota de servicio',
    },
    fr: {
        PER_NIGHT: 'par nuit',
        SLASH_NIGHT: '/ nuit',
        TOTAL: 'Total',
        WITHOUT_FEES: '/ nuit (hors frais de service)',
        WITH_FEES: '/ nuit, frais de service inclus',
    },
}

const currencyCodes = {
    $: 'USD',
    '€': 'EUR',
    '£': 'GBP',
}

const rawPotentialLanguageCode = $('html').attr('lang') || ''
const potentialLanguageCode = rawPotentialLanguageCode.includes('-')
    ? rawPotentialLanguageCode.substring(0, rawPotentialLanguageCode.indexOf('-'))
    : rawPotentialLanguageCode
const languageCode = Object.keys(i18n).includes(potentialLanguageCode) ? potentialLanguageCode : 'en'
const translationObj = i18n[languageCode]
const { PER_NIGHT, SLASH_NIGHT, TOTAL, WITHOUT_FEES, WITH_FEES } = translationObj

const CHECKMARK_ID = 'airbnb-price-per-night-correcter-checkmark'
const HAS_BEEN_MODIFIED_CLASS = 'airbnb-price-per-night-correcter-has-modified-this'

let containerPerNightPriceDivObserver

const VIEWPORT = Object.freeze({
    SKINNY: 'SKINNY',
    MEDIUM: 'MEDIUM',
    WIDE: 'WIDE',
})

let lastViewportState
let currentViewportState

const fullPageObserver = new MutationObserver(() => {
    const $form = $('#book_it_form')
    if ($form.length) {
        if ($form.closest('#room').length) {
            currentViewportState = VIEWPORT.WIDE
        } else if ($form.closest('div[aria-modal="true"]').length) {
            currentViewportState = VIEWPORT.MEDIUM
        } else {
            currentViewportState = VIEWPORT.SKINNY
        }

        console.log(`${lastViewportState} --> ${currentViewportState}`)

        if (!containerPerNightPriceDivObserver || currentViewportState !== lastViewportState) {
            // attempt to modify the price in case we're returning to a wider viewport from
            // a skinner one where there was no visible book_it_form
            const result = attemptToModifyPerNightPrice()
            if (result) {
                const containerPerNightPriceDiv = $form.closest('div')[0]
                containerPerNightPriceDivObserver = new MutationObserver(handleMutations)
                containerPerNightPriceDivObserver.observe(containerPerNightPriceDiv, { childList: true, subtree: true })
            }
        }
    } else if (!$form.length) {
        // if there's a skinny viewport
        containerPerNightPriceDivObserver = undefined

        // TODO: maybe make this selector a little more specific
        let $perNightSpan = $('#room')
            .find(`span:contains("${PER_NIGHT}"):not(:has(*))`)
            .last()

        // if no "per night" was found in a span, search for a "/ night" span instead
        if (!$perNightSpan.length) {
            $perNightSpan = $('#room')
                .find(`span:contains("${SLASH_NIGHT}"):not(:has(*))`)
                .last()
        }

        if (!$perNightSpan.hasClass(HAS_BEEN_MODIFIED_CLASS)) {
            $perNightSpan.text(WITHOUT_FEES).addClass(HAS_BEEN_MODIFIED_CLASS)
        }
    }

    lastViewportState = currentViewportState
})

// pretty sure observing the body doesn't markedly affect performance
fullPageObserver.observe($('body')[0], { childList: true, subtree: true })

//----------------------------------------------------------------------------------------------------------------------

function handleMutations(mutations) {
    console.log('handling mutations')

    mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
            // don't do anything when we add the checkmark div, or otherwise the browser will get
            // caught in an infinite loop
            if (mutation.addedNodes[0].id && mutation.addedNodes[0].id === CHECKMARK_ID) {
                return
            }

            // TODO: Maybe make this check a little more robust. Checking for something that we're
            // also adding could cause an infinite loop of events and crash the browser.
            if (
                mutation.addedNodes[0].classList &&
                ![...mutation.addedNodes[0].classList.values()].includes(HAS_BEEN_MODIFIED_CLASS)
            ) {
                attemptToModifyPerNightPrice()
            }
        }
        console.log(mutation)
    })
}

function attemptToModifyPerNightPrice() {
    console.log('attemptToModifyPerNightPrice.............................')

    const $form = $('#book_it_form')
    if (!$form.length) {
        return false
    }

    const $originalPerNightPriceDiv = $form
        .closest('div')
        .find(`:contains("${PER_NIGHT}")`)
        .first()

    if (!$originalPerNightPriceDiv.length) {
        console.log('Can\'t find "per night", or it\'s not in a supported language. Stopping!')
        return false
    }

    const originalPerNightPriceDivText = $originalPerNightPriceDiv.text()

    // There is a hidden div before the nightly price that typically says something like "Price:".
    // If it's a discounted listing, it will have something like "Previous price:$99 Discounted price:",
    // so that's why we want to check for the last index, so we can capture that potentially discounted price.
    const priceStartIndex = originalPerNightPriceDivText.lastIndexOf(':') + 1
    const priceEndIndex = originalPerNightPriceDivText.indexOf(PER_NIGHT)
    const originalPerNightPrice = originalPerNightPriceDivText.substring(priceStartIndex, priceEndIndex).trim()

    console.log('original per night price:', originalPerNightPrice)

    const totalPriceText = $form
        .find(`div:contains("${TOTAL}")`)
        .last()
        .next()
        .text()
    const totalPrice = safeParseFloat(totalPriceText)

    console.log('total price text:', totalPriceText)
    console.log('total price:', totalPrice)

    const $originalPriceSpan = $originalPerNightPriceDiv
        .find(`:contains("${originalPerNightPrice}"):not(:has(*))`) // find leaf node with original price
        .last()

    if ($originalPriceSpan.hasClass(HAS_BEEN_MODIFIED_CLASS)) {
        return false
    }

    // find leaf node with "per night" or applicable phrase
    let $originalPerNightSpan = $originalPerNightPriceDiv.find(`span:contains(${PER_NIGHT}):not(:has(*))`).last()
    let isDiscountedListing = false

    // if no "per night" was found in a span, it must be a discounted listing, so search for a "/ night" span instead
    if (!$originalPerNightSpan.length) {
        console.log('we got ourselves a pesky discounted listing!')
        $originalPerNightSpan = $originalPerNightPriceDiv.find(`span:contains(${SLASH_NIGHT}):not(:has(*))`).last()
        isDiscountedListing = true
    }

    // grab the number of nights from doing date math on the check_out/check_in URL params because the number of nights
    // text might be hidden and not anywhere in the DOM
    const urlParams = new URLSearchParams(new URL(window.location).search)
    const checkOutDateString = urlParams.get('check_out')
    const checkInDateString = urlParams.get('check_in')

    // if the length of stay has been set by the user
    if (checkOutDateString && checkInDateString) {
        // the difference between the first day and last day
        const numOfNights =
            (new Date(checkOutDateString).getTime() - new Date(checkInDateString).getTime()) / DAY_MILLIS

        console.log('number of nights:', numOfNights)

        const currencyMatches = totalPriceText.match(/[$€£]/g)
        if (!currencyMatches) {
            return false
        }

        const currencySign = currencyMatches[0]
        const currencyCode = currencyCodes[currencySign]

        console.log('currency sign:', currencySign)

        const realPricePerNight = totalPrice / numOfNights

        const localeStringOptions = {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: Number.isInteger(realPricePerNight) ? 0 : 2,
            maximumFractionDigits: Number.isInteger(realPricePerNight) ? 0 : 2,
        }
        const formattedRealPricePerNight = realPricePerNight.toLocaleString(languageCode, localeStringOptions)

        $originalPriceSpan.text(formattedRealPricePerNight).addClass(HAS_BEEN_MODIFIED_CLASS)
        $originalPerNightSpan.text(WITH_FEES).addClass(HAS_BEEN_MODIFIED_CLASS)
        $originalPerNightSpan.after(`<div id="${CHECKMARK_ID}" class="${HAS_BEEN_MODIFIED_CLASS}"></div>`)

        if (isDiscountedListing) {
            // obliterate struck-through price span's container div
            const $leafSpans = $originalPerNightPriceDiv.find('span:not(:has(*))')
            $leafSpans.each(function() {
                const $span = $(this)
                if ($span.css('text-decoration').includes('line-through')) {
                    $span.closest('div').remove()
                }
            })
        }
    } else {
        $originalPerNightSpan.text(WITHOUT_FEES).addClass(HAS_BEEN_MODIFIED_CLASS)
    }

    return true
}

// strip characters that aren't digit or the decimal separator then return the float
function safeParseFloat(str) {
    const decimalSeparator = Intl.NumberFormat(languageCode)
        .format('1.1')
        .charAt(1)
    const cleanPattern = new RegExp(`[^0-9${decimalSeparator}]`, 'g')
    const cleanedNumberString = str.replace(cleanPattern, '')
    const normalizedNumberString = cleanedNumberString.replace(decimalSeparator, '.')

    return parseFloat(normalizedNumberString)
}
