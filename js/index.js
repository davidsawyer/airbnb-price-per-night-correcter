const DEBUG_MODE = false
const oldCL = console.log
console.log = function(...params) {
    if (DEBUG_MODE) {
        oldCL.apply(this, params)
    }
}

const i18n = {
    en: {
        PER_NIGHT: 'per night',
        TOTAL: 'Total',
        WITHOUT_FEES: 'per night (without fees)',
        WITH_FEES: 'per night, including fees',
    },
    es: {
        PER_NIGHT: 'por noche',
        TOTAL: 'Total',
        WITHOUT_FEES: 'por noche (sin cuota de servicio)',
        WITH_FEES: 'por noche, con cuota de servicio',
    },
    fr: {
        PER_NIGHT: 'par nuit',
        TOTAL: 'Total',
        WITHOUT_FEES: 'par nuit (hors frais de service)',
        WITH_FEES: 'par nuit, frais de service inclus',
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
const { PER_NIGHT, TOTAL, WITHOUT_FEES, WITH_FEES } = translationObj

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
            const result = modifyPerNightPrice()
            if (result) {
                const containerPerNightPriceDiv = $form
                    .prev()
                    .find('div')
                    .first()[0]
                containerPerNightPriceDivObserver = new MutationObserver(handleMutations)
                containerPerNightPriceDivObserver.observe(containerPerNightPriceDiv, { childList: true, subtree: true })
            }
        }
    } else if (!$form.length && containerPerNightPriceDivObserver) {
        // if there's a skinny viewport
        containerPerNightPriceDivObserver = undefined

        // TODO: maybe make this selector a little more specific
        $('#room')
            .find(`:contains("${PER_NIGHT}")`)
            .last()
            .text(WITHOUT_FEES)
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
            if (mutation.addedNodes[0].id && mutation.addedNodes[0].id === CHECKMARK_ID) {
                return
            }

            // TODO: Maybe make this check a little more robust. Checking for something that we're
            // also adding could cause an infinite loop of events and crash the browser.
            if (
                mutation.addedNodes[0].classList &&
                ![...mutation.addedNodes[0].classList.values()].includes(HAS_BEEN_MODIFIED_CLASS)
            ) {
                modifyPerNightPrice()
            }
        }
        console.log(mutation)
    })
}

function modifyPerNightPrice() {
    console.log('modifyPerNightPrice.............................')

    const $form = $('#book_it_form')
    if (!$form.length) {
        return false
    }

    const $originalPerNightPriceDiv = $form
        .prev()
        .find(`:contains("${PER_NIGHT}")`)
        .first()
    if (!$originalPerNightPriceDiv.length) {
        console.log('Can\'t find "per night", or it\'s not in English. Stopping!')
        return false
    }

    const originalPerNightPriceDivText = $originalPerNightPriceDiv.text()
    // there a hidden div before the nightly price that typically says something like "Price:"
    const priceStartIndex = originalPerNightPriceDivText.indexOf(':') + 1
    const priceEndIndex = originalPerNightPriceDivText.indexOf(PER_NIGHT)
    const originalPerNightPrice = originalPerNightPriceDivText.substring(priceStartIndex, priceEndIndex).trim()

    console.log('original per night price:', originalPerNightPrice)

    const totalPrice = safeParseFloat(
        $form
            .find(`div:contains("${TOTAL}")`)
            .last()
            .next()
            .text()
    )

    console.log('total price:', totalPrice)

    const $originalPerNightPriceSpan = $originalPerNightPriceDiv
        .find(`:contains("${originalPerNightPrice}"):not(:has(*))`)
        .last()
    const $originalPerNightSpan = $originalPerNightPriceDiv.find(`:contains(${PER_NIGHT}):not(:has(*))`).last()

    const numOfNightsText = $form
        .find(':contains(" x ")')
        .last()
        .text()

    // if the length of stay has already been set by the user
    if (numOfNightsText) {
        const numOfNights = safeParseFloat(numOfNightsText.match(/ x \d+/g, '')[0])

        console.log('number of nights:', numOfNights)

        const currencyMatches = numOfNightsText.match(/[$€£]/g)
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

        $originalPerNightPriceSpan.text(formattedRealPricePerNight).addClass(HAS_BEEN_MODIFIED_CLASS)
        $originalPerNightSpan.text(WITH_FEES).addClass(HAS_BEEN_MODIFIED_CLASS)
        $originalPerNightSpan.after(`<div id="${CHECKMARK_ID}" class={"${HAS_BEEN_MODIFIED_CLASS}"}></div>`)
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
