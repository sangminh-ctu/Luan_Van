# Flash Sale

## Setup

Run from backend: node scripts/run_migration_007.js
This additive migration creates flash_sale, flash_sale_item and the nullable
order_item.flash_sale_item_id reference. Apply once; it does not update book prices.

Admin: /admin/flash-sales (Khuyến mãi > Flash Sale).
Create a draft, select books and set prices/time, save, then publish from the list.
Forms display Vietnam time (UTC+07:00). API dates include an explicit timezone.
Prices use whole VND, consistent with the existing rounded checkout prices.

## Rules

- Published programs cannot overlap. Draft schedules can overlap.
- Time intervals are [start_at, end_at); adjacent programs are allowed.
- Draft: edit/delete/publish. Upcoming: edit/cancel.
- Active: end early, preserving published status and setting end_at to DB time.
- Ended/cancelled programs are retained for history.
- No quotas or voucher stacking are introduced.
- Effective price is the lower of regular price and active sale price.
- Flash attribution is recorded only if the flash price is strictly cheaper.
- Inactive books are excluded from public results; stock is checked at checkout.
- Placed counts include processing, confirmed, shipping, delivered orders.
  Cancelled orders are excluded. Bestseller counts still use delivered orders only.
- Home displays at most 10 items, 5 columns on desktop. /flash-sale has pagination.
- on_sale still selects ordinary discounts; displayed prices always use effective prices.

## Checkout contract

POST /api/orders also requires expected_prices: an object mapping each selected
book_id to the numeric effective_price currently shown to the customer.
The server never trusts these prices to calculate the order.

After locking inventory, the server obtains clock_timestamp() and reads all prices
in a single statement. A mismatch returns HTTP 409, code PRICE_CHANGED,
and price_changes [{book_id,title,old_price,new_price}]. No stock is deducted.
The client refreshes the cart and requires another explicit order submission.
A price decision already read is retained if an admin ends the program afterwards.

## Tests

From backend: node test/test_flash_sale.js
Requires CREATEDB and pg_dump (override executable via PG_DUMP_PATH).
The script copies schema only into a uniquely named flash_sale_test_* database,
uses synthetic fixtures and drops only that temporary database afterwards.
It never adds test programs to the configured application database.

Backend tests cover interval boundaries, concurrent publishing, effective-price
filtering/sorting, cart and checkout, price conflicts, cancellation, history FKs,
admin access and HTTP overlap errors.
