var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('invoice totals and GST match the amounts billed by order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'R1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '', total: billed.total });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
});

test('invoice uses the same HSN GST slab and total as order pricing', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'R1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.deepEqual(
    { subtotal: billed.subtotal, tax: billed.tax, total: billed.total },
    { subtotal: 100, tax: 5, total: 105 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: billed.subtotal, tax: billed.tax, total: billed.total }
  );
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice matches order pricing discount and post-discount GST calculations', function () {
  var items = [{ id: 2, name: 'Tea', sku: 'T1', hsn: '0902', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 50, tax: 171, total: 1121 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice applies the same coupon minimum and maximum rules as order pricing', function () {
  var items = [{ name: 'Staples', price: 100, qty: 1, gstRate: 0 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 0); // Below the configured 500 minimum.
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice splits GST with a rounded half and remainder', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Odd tax', price: 1, qty: 1, gstRate: 5 }]
  });

  assert.equal(figures.tax, 0.05);
  assert.equal(figures.cgst, 0.03);
  assert.equal(figures.sgst, 0.02);
  assert.equal(figures.cgst + figures.sgst, figures.tax);
});

test('rendered invoice omits reconciliation warning when its total matches the ledger', function () {
  var html = invoice.render({
    id: 42,
    customer: 'In-memory Customer',
    items: [{ name: 'Rice', sku: 'R1', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.match(html, /Invoice Total/);
  assert.doesNotMatch(html, /Invoice computed total/);
});
