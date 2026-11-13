import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'
const { descriptor } = parse(
  readFileSync(new URL('../src/views/customer/AccountView.vue', import.meta.url), 'utf8'),
)
const source = compileScript(descriptor, { id: 'membership-account-test' })
  .content.replace(/^import[^\n]+\n/gm, '')
  .replace('export default', 'return')
const factory = new Function(
  'deps',
  `const localStorage = {getItem:()=>null}; const {ref,reactive,computed,onMounted,nextTick,useRoute,useRouter,useAuthStore,userService,addressService}=deps; ${source}`,
)
test('Account rank comes from backend spending, and locked offers do not inflate the available count', async (t) => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const component = factory({
    ...vue,
    onMounted() {},
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace() {} }),
    useAuthStore: () => ({ user: { reward_points_balance: 9999999 }, updateUser() {} }),
    addressService: {},
    userService: {
      getMe: async () => ({
        user: { user_id: 1, full_name: 'Test', reward_points_balance: 9999999 },
        membership: {
          eligible_spend: 1250000,
          current_tier: { tier_id: 2, tier_name: 'Vàng' },
          next_tier: { tier_name: 'Kim Cương' },
          remaining_spend: 1750000,
          progress_percent: 12,
        },
        tiers: [
          { tier_id: 1, tier_name: 'Bạc' },
          { tier_id: 2, tier_name: 'Vàng' },
          { tier_id: 3, tier_name: 'Kim Cương' },
        ],
        vouchers: [
          { code: 'AVAILABLE', eligible: true },
          { code: 'LOCKED', eligible: false },
        ],
      }),
    },
  })
  const state = scope.run(() => component.setup({}, { expose() {} }))
  await state.fetchAccountData()
  assert.match(state.memberTier.value.name, /Vàng/)
  assert.equal(state.memberTier.value.nextNeeded, 1750000)
  assert.equal(state.availableVoucherCount.value, 1)
  assert.equal(state.membershipTiers.value.length, 3)
})
