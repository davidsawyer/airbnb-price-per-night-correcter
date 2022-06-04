;(async function() {
    const DEBUG_MODE = false // change this to true if you want to see debug logs in the JS console!
    const oldCL = console.log
    console.log = function(...params) {
        if (DEBUG_MODE) {
            oldCL.apply(this, params)
        }
    }

    const CHECKMARK_CLASS = 'appnc-checkmark'
    const HAS_BEEN_MODIFIED_CLASS = 'appnc-has-modified-this'
    const PER_NIGHT_ID = 'appnc-with-fees-line'
    const WITH_FEES_ID = 'appnc-with-fees-line'
    const TAXES_LINE_ID = 'appnc-taxes-line'

    const buildCheckmark = (tooltipText, width = 120) =>
        `<div class="${HAS_BEEN_MODIFIED_CLASS} ${CHECKMARK_CLASS} appnc-tooltip">
            <span class="appnc-tooltiptext" style="width: ${width}px; margin-left: ${(-1 * width) /
            2}px">${tooltipText}</span>
        </div>`

    let initialBookingPageQuery

    function getBookingPageQuery() {
        const urlParams = new URLSearchParams(new URL(window.location).search)
        const checkInDateString = urlParams.get('check_in')
        const checkOutDateString = urlParams.get('check_out')
        if (!checkOutDateString && !checkInDateString) {
            return null
        }

        const listingId = window.location.pathname.match(/\d+/) && window.location.pathname.match(/\d+/)[0]
        const guestCurrency = 'USD' // fix dis
        const numberOfAdults = urlParams.get('adults')
        const numberOfChildren = urlParams.get('children')
        const numberOfGuests = urlParams.get('guests')
        const numberOfInfants = urlParams.get('infants')
        const numberOfPets = urlParams.get('pets')

        return `${listingId}?&checkin=${checkInDateString}&checkout=${checkOutDateString}&guestCurrency=${guestCurrency}&productId=${listingId}&numberOfAdults=${numberOfAdults}&numberOfChildren=${numberOfChildren}&numberOfGuests=${numberOfGuests}&numberOfInfants=${numberOfInfants}&numberOfPets=${numberOfPets}`
    }

    async function fetchPricesFromBookItPageInBackground() {
        const bookingPageQuery = getBookingPageQuery()
        if (!bookingPageQuery) {
            console.log('No dates in the URL. Not making background booking page request!')
            return {
                formattedTaxAmount: null,
                formattedServiceFeeAmount: null,
                formattedTotalAmountAfterAllTaxesAndFees: null,
            }
        }

        console.log('Fetching booking page in the background...')

        const unwrappedHtmlPayload = await fetch(`https://www.airbnb.com/book/stays/${bookingPageQuery}`)

        const htmlPayload = await unwrappedHtmlPayload.text()

        initialBookingPageQuery = getBookingPageQuery()

        const productPriceBreakdownIndex = htmlPayload.indexOf('productPriceBreakdown')
        const paymentPlansIndex = htmlPayload.indexOf('paymentPlans')
        const stringifiedPaymentJson = htmlPayload
            .substring(productPriceBreakdownIndex + 24, paymentPlansIndex - 3)
            .replace(/\\/g, '')
        console.log(stringifiedPaymentJson)
        const paymentJson = JSON.parse(stringifiedPaymentJson)

        const taxPriceItem = paymentJson.priceBreakdown.priceItems.find(priceItem => priceItem.type === 'TAXES')
        const serviceFeePriceItem = paymentJson.priceBreakdown.priceItems.find(
            priceItem => priceItem.type === 'AIRBNB_GUEST_FEE'
        )

        return {
            formattedTaxAmount: taxPriceItem.total.amountFormatted,
            formattedServiceFeeAmount: serviceFeePriceItem.total.amountFormatted,
            formattedTotalAmountAfterAllTaxesAndFees: paymentJson.priceBreakdown.total.total.amountFormatted,
        }
    }

    let {
        formattedTaxAmount,
        formattedServiceFeeAmount,
        formattedTotalAmountAfterAllTaxesAndFees,
    } = await fetchPricesFromBookItPageInBackground()

    chrome.storage.sync.get('hasShownRoamerPopup', ({ hasShownRoamerPopup }) => {
        if (!hasShownRoamerPopup) {
            chrome.storage.sync.get('roamerPopupDateMillis', ({ roamerPopupDateMillis }) => {
                const now = new Date().getTime()
                if (!roamerPopupDateMillis || now > roamerPopupDateMillis) {
                    chrome.storage.sync.set({ hasShownRoamerPopup: true })
                    chrome.runtime.sendMessage({
                        type: 'openRoamerTab',
                    })
                }
            })
        }
    })

    const DAY_MILLIS = 86400000

    const i18n = {
        en: {
            PER_NIGHT: 'night',
            SLASH_NIGHT: '/ night',
            TOTAL: 'Total',
            TOTAL_BEFORE_TAXES: 'Total before taxes',
            WITHOUT_FEES: '&nbsp;night (without fees)',
            WITH_FEES: '&nbsp;night, including fees',
        },
        es: {
            PER_NIGHT: 'por noche',
            SLASH_NIGHT: '/noche',
            TOTAL: 'Total',
            TOTAL_BEFORE_TAXES: 'Total antes de impuestos',
            WITHOUT_FEES: ' noche (sin cuota de servicio)',
            WITH_FEES: ' noche, con cuota de servicio',
        },
        fr: {
            PER_NIGHT: 'par nuit',
            SLASH_NIGHT: '/ nuit',
            TOTAL: 'Total',
            TOTAL_BEFORE_TAXES: 'Total hors taxes',
            WITHOUT_FEES: 'nuit (hors frais de service)',
            WITH_FEES: ' nuit, frais de service inclus',
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
    const { PER_NIGHT, SLASH_NIGHT, TOTAL, TOTAL_BEFORE_TAXES, WITHOUT_FEES, WITH_FEES } = translationObj

    let containerPerNightPriceDivObserver
    let bookItElementSelector

    // This is what we use to tell if we need to do a recalculation.
    let totalPriceOnPage
    let isRefetchingBookingPage

    const VIEWPORT = Object.freeze({
        SKINNY: 'SKINNY',
        MEDIUM: 'MEDIUM',
        WIDE: 'WIDE',
    })

    let lastViewportState
    let currentViewportState

    const fullPageObserver = new MutationObserver(mutations => {
        console.log(`MUTATIONS FROM FULL PAGE OBSERVER`)
        console.log(mutations)

        if (!bookItElementSelector) {
            if ($('#book_it_form').length) {
                bookItElementSelector = '#book_it_form'
            } else if ($('[data-plugin-in-point-id="BOOK_IT_SIDEBAR"]').length) {
                bookItElementSelector = '[data-plugin-in-point-id="BOOK_IT_SIDEBAR"]'
            }
            console.log('here is our chosen bookItElementSelector:', bookItElementSelector)
        }

        const $form = $(bookItElementSelector)
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
                // a skinnier one where there was no visible book_it_form
                const result = attemptToModifyPerNightPrice()
                if (result) {
                    // const containerPerNightPriceDiv = $form.closest('div')[0]
                    const containerPerNightPriceDiv = $form.parent()[0]
                    containerPerNightPriceDivObserver = new MutationObserver(handleMutations)
                    containerPerNightPriceDivObserver.observe(containerPerNightPriceDiv, {
                        childList: true,
                        subtree: true,
                    })
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
                $perNightSpan.html(WITHOUT_FEES).addClass(HAS_BEEN_MODIFIED_CLASS)
            }
        }

        lastViewportState = currentViewportState
    })

    // pretty sure observing the body doesn't markedly affect performance
    fullPageObserver.observe($('body')[0], { childList: true, subtree: true })

    //----------------------------------------------------------------------------------------------------------------------

    function handleMutations(mutations) {
        console.log('handling mutations')

        console.log(mutations)

        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                // TODO: Maybe make this check a little more robust. Checking for something that we're
                // also adding could cause an infinite loop of events and crash the browser.
                if (
                    mutation.addedNodes[0].classList &&
                    ![...mutation.addedNodes[0].classList.values()].includes(HAS_BEEN_MODIFIED_CLASS) &&
                    ![...mutation.addedNodes[0].classList.values()].includes(CHECKMARK_CLASS)
                ) {
                    attemptToModifyPerNightPrice(mutation)
                }
            }
            console.log(mutation)
        })
    }

    async function attemptToModifyPerNightPrice(mutation) {
        const $form = $(bookItElementSelector)
        if (!$form.length) {
            console.log('Couldn\'t find "book it" form! Stopping.')
            return false
        }

        const $totalBeforeTaxesTextDiv = $form
            .find(`:contains("${TOTAL}"):not(:has(*))`) // find leaf node that contains the word "total"
            .last()

        let totalPriceText
        let $totalPriceTextCandidate = $totalBeforeTaxesTextDiv.parent()
        for (let i = 0; i < 5; i++) {
            if (
                $totalPriceTextCandidate.text().length > (totalPriceOnPage ? TOTAL : TOTAL_BEFORE_TAXES).length + 2 &&
                $totalPriceTextCandidate.text().includes('$')
            ) {
                totalPriceText = $totalPriceTextCandidate.text()
                break
            }
            $totalPriceTextCandidate = $totalPriceTextCandidate.parent()
        }

        if (!totalPriceText) {
            // if the user clears the dates after previously having some set, let's wipe any trace of us being there
            $(`#${PER_NIGHT_ID}`)
                .html(`&nbsp;${PER_NIGHT}`)
                .attr('id', null)
                .removeClass(HAS_BEEN_MODIFIED_CLASS)

            $(`.${CHECKMARK_CLASS}`).remove()

            console.log("No total price found, probably because dates haven't been chosen. Stopping!")
            return
        }

        const $totalPriceExcludingTaxDiv = $totalPriceTextCandidate.find(':contains("$"):not(:has(*))')
        const newTotalPriceOnPage = safeParseFloat($totalPriceExcludingTaxDiv.text())

        if (totalPriceOnPage === newTotalPriceOnPage) {
            console.log('Total price on the page is unchanged. Stopping!')
            return
        }

        totalPriceOnPage = newTotalPriceOnPage

        console.log('attemptToModifyPerNightPrice.............................')

        if (initialBookingPageQuery !== getBookingPageQuery()) {
            ;({
                formattedTaxAmount,
                formattedServiceFeeAmount,
                formattedTotalAmountAfterAllTaxesAndFees,
            } = await fetchPricesFromBookItPageInBackground())
        }

        if (!formattedTaxAmount && !formattedServiceFeeAmount && !formattedTotalAmountAfterAllTaxesAndFees) {
            return false
        }

        console.log('yooooooo')
        console.log('yooooooo')
        console.log(mutation)
        console.log('yooooooo')
        console.log('yooooooo')

        // Airbnb does something with accessibility where they will have an element that will often contain "per night",
        // but it'll have a very small height, often just one pixel tall. We don't want to grab that element; we want the
        // one that the user actually sees. So let's just get all the elements in the form that are saying either "per
        // night" or "/ night" and then get the actually visible element from that list.
        const originalPerNightPriceDivCandidates = [...$form.closest('div').find(`:contains("${PER_NIGHT}")`)].concat([
            ...$form.closest('div').find(`:contains("${SLASH_NIGHT}")`),
        ])
        const perNightLeafNode = originalPerNightPriceDivCandidates.filter(
            div => $(div).height() > 4 && !$(div).children().length
        )
        const $originalPerNightPriceDiv = $(perNightLeafNode).closest('div')

        if (!$originalPerNightPriceDiv.length) {
            console.log('Can\'t find "per night" nor "/ night", or it\'s not in a supported language. Stopping!')
            return false
        }

        // if ($originalPerNightPriceDiv.hasClass(HAS_BEEN_MODIFIED_CLASS)) {
        //     console.log("We've already done our modifications. Stopping!")
        //     return false
        // }

        const originalPerNightPriceDivText = $originalPerNightPriceDiv.text()

        // There is a hidden div before the nightly price that typically says something like "Price:".
        // If it's a discounted listing, it will have something like "Previous price:$99 Discounted price:",
        // so that's why we want to check for the last index, so we can capture that potentially discounted price.
        const priceStartIndex = originalPerNightPriceDivText.lastIndexOf(':') + 1
        const priceEndIndex =
            originalPerNightPriceDivText.indexOf(PER_NIGHT) !== -1
                ? originalPerNightPriceDivText.indexOf(PER_NIGHT)
                : originalPerNightPriceDivText.indexOf(SLASH_NIGHT)
        const dirtyOriginalPerNightPrice = originalPerNightPriceDivText.substring(priceStartIndex, priceEndIndex).trim()

        const currencyMatches = dirtyOriginalPerNightPrice.match(/[$€£]/g)
        if (!currencyMatches) {
            console.log('Could not match on a currency symbol. Stopping!')
            return false
        }

        const currencySign = currencyMatches[0]
        const currencyCode = currencyCodes[currencySign]

        console.log('currency sign:', currencySign)

        // the dirtyOriginalPerNightPrice could have multiple prices in it if it was a discounted listed, so we just want
        // to grab the latter, non-crossed-out price to be our originalPerNightPrice
        const originalPerNightPrice = dirtyOriginalPerNightPrice
            .substring(dirtyOriginalPerNightPrice.lastIndexOf(currencySign))
            .trim()

        console.log('original per night price:', originalPerNightPrice)

        const $originalNightlyPriceSpan = $originalPerNightPriceDiv
            .find(`:contains("${originalPerNightPrice}"):not(:has(*))`) // find leaf node with original price
            .last()

        // find leaf node with "per night" or similar phrase
        let $originalPerNightSpan = $originalPerNightPriceDiv
            .find(`span:not(.${HAS_BEEN_MODIFIED_CLASS}):contains(${PER_NIGHT}):not(:has(*))`)
            .last()

        let isDiscountedListing = false

        // if no "per night" was found in a span, it might be a discounted listing, so search for a "/ night" span instead
        if (!$originalPerNightSpan.length) {
            console.log('we got ourselves a pesky discounted listing!')
            $originalPerNightSpan = $originalPerNightPriceDiv
                .find(`span:not(.${HAS_BEEN_MODIFIED_CLASS}):contains(${SLASH_NIGHT}):not(:has(*))`)
                .last()
            isDiscountedListing = true
        }

        const currencySymbol = Object.keys(currencyCodes).find(key => currencyCodes[key] === currencyCode)

        const $serviceFeeTextDiv = $('body').find(':contains("Service fee"):not(:has(*))')
        const $serviceFeeLine = $serviceFeeTextDiv.closest(`:contains("${currencySymbol}")`)

        let $taxesLine = $(`#${TAXES_LINE_ID}`)
        if (!$taxesLine.length) {
            // copy the service fee line and duplicate it right below
            $taxesLine = $serviceFeeLine.clone().appendTo($serviceFeeLine.parent())

            // replace all things service fee with all things taxes
            $taxesLine
                .attr('id', TAXES_LINE_ID)
                .addClass(HAS_BEEN_MODIFIED_CLASS)
                .find(':contains("Service fee"):not(:has(*))')
                .text('Taxes')
                .css('display', 'inline')
                .after(
                    buildCheckmark(
                        `APPNC has automagically fetched the taxes that
                    will be charged for this listing. Airbnb normally
                    hides this info until right before you pay!`,
                        372
                    )
                )
        }

        $taxesLine.find(`:contains("${currencySymbol}"):not(:has(*))`).text(formattedTaxAmount)

        $serviceFeeLine
            .find(`:contains("${currencySymbol}"):not(:has(*))`)
            .addClass(HAS_BEEN_MODIFIED_CLASS)
            .text(formattedServiceFeeAmount)

        if (!$serviceFeeTextDiv.hasClass(HAS_BEEN_MODIFIED_CLASS)) {
            $serviceFeeTextDiv
                .addClass(HAS_BEEN_MODIFIED_CLASS)
                .css('display', 'inline')
                .after(
                    buildCheckmark(
                        `Airbnb often likes to round this to the nearest whole
                    number, so in order to get all these line items to add
                    up to the actual total price you'll see on the booking
                    screen, we're gonna show cents here 🧐`,
                        390
                    )
                )
        }

        const safeTaxAmount = formattedTaxAmount ? safeParseFloat(formattedTaxAmount) : 0
        const totalAmountAfterAllTaxesAndFees = safeParseFloat(formattedTotalAmountAfterAllTaxesAndFees)

        console.log('safe tax amount:', safeTaxAmount)

        console.log('total price text:', totalPriceText)
        console.log('total price:', totalAmountAfterAllTaxesAndFees)

        const urlParams = new URLSearchParams(new URL(window.location).search)
        const checkInDateString = urlParams.get('check_in')
        const checkOutDateString = urlParams.get('check_out')

        // the difference between the first day and last day
        const numOfNights =
            (new Date(checkOutDateString).getTime() - new Date(checkInDateString).getTime()) / DAY_MILLIS

        console.log('number of nights:', numOfNights)

        const realPricePerNight = totalAmountAfterAllTaxesAndFees / numOfNights

        console.log('real price per night, unformatted:', realPricePerNight)

        const localeStringOptions = {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: Number.isInteger(realPricePerNight) ? 0 : 2,
            maximumFractionDigits: Number.isInteger(realPricePerNight) ? 0 : 2,
        }
        const formattedRealPricePerNight = realPricePerNight.toLocaleString(languageCode, localeStringOptions)

        const reformattedTotalAmountAfterAllTaxesAndFees = totalAmountAfterAllTaxesAndFees.toLocaleString(
            languageCode,
            localeStringOptions
        )

        console.log('🏁 formatted real price per night 🏁:', formattedRealPricePerNight)

        if (!$totalBeforeTaxesTextDiv.hasClass(HAS_BEEN_MODIFIED_CLASS)) {
            $totalBeforeTaxesTextDiv.after(buildCheckmark('This is the real total price after all fees AND taxes', 255))
        }

        $totalBeforeTaxesTextDiv
            .addClass(HAS_BEEN_MODIFIED_CLASS)
            .css('display', 'inline-block')
            .text(TOTAL)

        $totalPriceExcludingTaxDiv.text(reformattedTotalAmountAfterAllTaxesAndFees)

        $originalNightlyPriceSpan.text(formattedRealPricePerNight).addClass(HAS_BEEN_MODIFIED_CLASS)

        if (!$(`#${WITH_FEES_ID}`).length) {
            $originalPerNightSpan.after(
                buildCheckmark('This is the complete nightly price\nafter all fees AND taxes', 230)
            )
        }

        $originalPerNightSpan
            .html(WITH_FEES)
            .addClass(HAS_BEEN_MODIFIED_CLASS)
            .attr('id', WITH_FEES_ID)

        if (isDiscountedListing) {
            // obliterate struck-through price span's container div
            const $leafSpans = $originalPerNightPriceDiv.find('span:not(:has(*))')
            $leafSpans.each(function() {
                const $span = $(this)
                if ($span.css('text-decoration').includes('line-through')) {
                    $span.remove()
                }
            })
        }

        totalPriceOnPage = totalAmountAfterAllTaxesAndFees

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
})()
