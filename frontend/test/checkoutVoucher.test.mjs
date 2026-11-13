import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'

// Exercise the actual checkout setup with API/store substitutes; no browser or added dependency.
const { descriptor } = parse(
  readFileSync(new URL('../src/views/customer/CheckoutView.vue', import.meta.url), 'utf8'),
)
const compiled = compileScript(descriptor, { id: 'checkout-voucher-test' })
  .content.replace(/^import[^\n]+\n/gm, '')
  .replace('export default', 'return')
const factory = new Function(
  'deps',
  `const {ref,reactive,computed,onMounted,onBeforeUnmount,watch,useRouter,useCartStore,useAuthStore,addressService,orderService,getBookCoverUrl} = deps; ${compiled}`,
)
const plain = (code = '', discount = 0) => ({
  subtotal: 100000,
  shipping_fee: 30000,
  voucher_discount_amount: discount,
  total_amount: 130000 - discount,
  expected_prices: { 1: 100000 },
  items: [{ book_id: 1, quantity: 1, subtotal: 100000 }],
  voucher: code ? { code, user_remaining_uses: 1 } : null,
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function harness(t) {
  const mounted = [],
    cleanup = [],
    pushes = [],
    created = []
  const cart = vue.reactive({
    selectedItems: [
      {
        book_id: 1,
        quantity: 1,
        subtotal: 100000,
        book: { title: 'Test', effective_price: 100000 },
      },
    ],
    selectedBookIds: [1],
    selectedTotalPrice: 100000,
    selectedCount: 1,
    hasSelectedIssues: false,
    fetchCart: async () => ({ success: true }),
  })
  const api = {
    preview: async () => plain(),
    getShippingConfig: async () => ({
      free_shipping_threshold: 300000,
      standard_shipping_fee: 30000,
    }),
    createOrder: async (payload) => {
      created.push(payload)
      return { order: { order_code: 'TEST' } }
    },
  }
  const address = {
    address_id: 10,
    recipient_name: 'Test',
    recipient_phone: '0900000000',
    street_detail: 'Test',
    province: 'Test',
    district: 'Test',
    ward: 'Test',
    is_default: true,
  }
  const scope = vue.effectScope()
  const component = factory({
    ...vue,
    onMounted: (fn) => mounted.push(fn),
    onBeforeUnmount: (fn) => cleanup.push(fn),
    useRouter: () => ({
      push: (value) => pushes.push(value),
      replace: (value) => pushes.push(value),
    }),
    useCartStore: () => cart,
    useAuthStore: () => ({ user: {} }),
    addressService: { getAddresses: async () => ({ addresses: [address] }) },
    orderService: api,
    getBookCoverUrl: () => '',
  })
  const state = scope.run(() => component.setup({}, { expose() {} }))
  t.after(() => {
    for (const fn of cleanup) fn()
    scope.stop()
  })
  for (const fn of mounted) await fn()
  return { state, api, cart, pushes, created }
}

test('Latest voucher preview wins when the customer edits code during a pending request', async (t) => {
  const { state, api } = await harness(t)
  const first = deferred(),
    second = deferred()
  api.preview = (payload) => (payload.voucher_code === 'FIRST' ? first.promise : second.promise)
  state.voucherDraft.value = 'FIRST'
  state.editVoucher()
  const pendingFirst = state.applyVoucher()
  state.voucherDraft.value = 'SECOND'
  state.editVoucher()
  const pendingSecond = state.applyVoucher()
  second.resolve(plain('SECOND', 20000))
  await pendingSecond
  first.resolve(plain('FIRST', 10000))
  await pendingFirst
  assert.equal(state.quote.value.voucher.code, 'SECOND')
  assert.equal(state.totalAmount.value, 110000)
})
test('Invalid voucher shows inline message and blocks checkout; removing it restores plain checkout', async (t) => {
  const { state, api, created } = await harness(t)
  api.preview = async () => {
    throw {
      response: { data: { fieldErrors: { voucher_code: 'Bạn đã dùng hết lượt của mã này.' } } },
    }
  }
  state.voucherDraft.value = 'USED'
  state.editVoucher()
  await state.applyVoucher()
  assert.match(state.voucherError.value, /hết lượt/)
  assert.equal(state.quote.value, null)
  await state.handlePlaceOrder()
  assert.equal(created.length, 0)
  api.preview = async () => plain()
  await state.removeVoucher()
  assert.equal(state.voucherDraft.value, '')
  assert.equal(state.totalAmount.value, 130000)
  await state.handlePlaceOrder()
  assert.equal(created.length, 1)
  assert.equal(created[0].voucher_code, null)
})
test('Price/quote conflict refreshes totals and requires a second explicit order confirmation', async (t) => {
  const { state, api } = await harness(t)
  state.voucherDraft.value = 'SAVE'
  state.editVoucher()
  api.preview = async () => plain('SAVE', 10000)
  await state.applyVoucher()
  let attempts = 0
  api.createOrder = async () => {
    attempts++
    throw { response: { status: 409, data: { code: 'CHECKOUT_CHANGED' } } }
  }
  api.preview = async () => plain('SAVE', 5000)
  await state.handlePlaceOrder()
  assert.equal(attempts, 1)
  assert.equal(state.totalAmount.value, 125000)
  assert.match(state.quoteNotice.value, /xác nhận lại/)
})
test('Order submission uses the server quote and sends one applied code', async (t) => {
  const { state, api, created, pushes } = await harness(t)
  state.voucherDraft.value = 'SAVE'
  state.editVoucher()
  api.preview = async () => plain('SAVE', 10000)
  await state.applyVoucher()
  await state.handlePlaceOrder()
  assert.equal(created[0].voucher_code, 'SAVE')
  assert.deepEqual(created[0].expected_quote, {
    subtotal: 100000,
    shipping_fee: 30000,
    voucher_discount_amount: 10000,
    total_amount: 120000,
  })
  assert.equal(pushes[0].path, '/orders')
})

test('Suggested voucher is applied through a new preview without placing an order', async (t) => {
  const { state, api, created } = await harness(t)
  api.voucherSuggestions = async () => ({
    suggestions: [
      { voucher_id: 1, code: 'BEST', voucher_discount_amount: 20000, total_amount: 110000 },
    ],
  })
  await state.loadSuggestions()
  assert.equal(state.suggestions.value[0].code, 'BEST')
  api.preview = async (payload) => {
    assert.equal(payload.voucher_code, 'BEST')
    return plain('BEST', 20000)
  }
  await state.applySuggested('BEST')
  assert.equal(state.appliedCode.value, 'BEST')
  assert.equal(state.totalAmount.value, 110000)
  assert.equal(created.length, 0)
})
test('Suggestions become invalid when cart quantities change; late responses cannot restore them', async (t) => {
  const { state, api, cart } = await harness(t)
  const pending = deferred()
  api.voucherSuggestions = () => pending.promise
  const request = state.loadSuggestions()
  cart.selectedItems[0].quantity = 2
  await vue.nextTick()
  pending.resolve({ suggestions: [{ voucher_id: 1, code: 'OLD' }] })
  await request
  assert.equal(state.suggestions.value.length, 0)
  assert.equal(state.suggestionsLoaded.value, false)
  assert.equal(state.suggestionBusy.value, false)
})
test('Empty suggestions and suggestion API failures preserve the current checkout quote', async (t) => {
  const { state, api } = await harness(t)
  api.voucherSuggestions = async () => ({ suggestions: [] })
  await state.loadSuggestions()
  assert.equal(state.suggestionsLoaded.value, true)
  assert.equal(state.suggestions.value.length, 0)
  api.voucherSuggestions = async () => {
    throw { response: { data: { message: 'Không tải được ưu đãi' } } }
  }
  await state.loadSuggestions()
  assert.match(state.suggestionError.value, /Không tải/)
  assert.equal(state.quote.value.total_amount, 130000)
})
